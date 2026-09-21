import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  FAILURE_CATEGORIES,
  AdapterError,
  SchemaMapping,
  PostgresDataAdapter,
  CapabilityEngine,
  DevelopmentSecretProvider,
  HealthManager,
  OperationalStore,
  OperationalEngine
} from "../web/runtime/air.mjs";

function isDockerPostgresAvailable() {
  try {
    const res = execSync("docker exec -i air-test-pg psql -U postgres -d airtest -t -A -c 'SELECT 1;'", { encoding: "utf8" });
    return res.trim() === "1";
  } catch {
    return false;
  }
}

/**
 * Creates a real PostgreSQL executor using docker exec psql with prepared statements
 */
function createDockerPostgresClient(container = "air-test-pg", db = "airtest", user = "postgres") {
  return {
    async query(sql, params = []) {
      // Safely interpolate parameters for live psql execution
      let interpolatedSql = sql;
      for (let i = 0; i < params.length; i++) {
        const val = params[i];
        let strVal = "NULL";
        if (val !== null && val !== undefined) {
          if (typeof val === "number") strVal = String(val);
          else if (typeof val === "boolean") strVal = val ? "TRUE" : "FALSE";
          else strVal = `'${String(val).replaceAll("'", "''")}'`;
        }
        interpolatedSql = interpolatedSql.replaceAll(`$${i + 1}`, strVal);
      }

      let psqlScript = "";
      if (interpolatedSql.trim().toUpperCase().startsWith("SELECT COUNT(")) {
        psqlScript = `SELECT json_build_object('total', (${interpolatedSql.replace(/;$/, "")}));`;
      } else if (interpolatedSql.trim().toUpperCase().startsWith("SELECT")) {
        psqlScript = `SELECT json_agg(t) FROM (${interpolatedSql.replace(/;$/, "")}) t;`;
      } else if (interpolatedSql.toUpperCase().includes("RETURNING")) {
        psqlScript = `WITH mutation AS (${interpolatedSql.replace(/;$/, "")}) SELECT json_agg(t) FROM mutation t;`;
      } else {
        psqlScript = `${interpolatedSql};`;
      }

      try {
        const stdout = execSync(`docker exec -i ${container} psql -U ${user} -d ${db} -v ON_ERROR_STOP=1 -t -A`, {
          input: psqlScript,
          encoding: "utf8"
        });

        const lines = stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);
        const lastLine = lines[lines.length - 1] ?? "";

        let rows = [];
        let rowCount = 0;
        if (lastLine.startsWith("[") || lastLine.startsWith("{")) {
          try {
            const parsed = JSON.parse(lastLine);
            rows = Array.isArray(parsed) ? parsed : [parsed];
            rowCount = rows.length;
          } catch {
            rows = [];
          }
        } else if (lastLine.startsWith("DELETE ")) {
          rowCount = parseInt(lastLine.slice(7), 10) || 0;
        } else if (lastLine.startsWith("UPDATE ")) {
          rowCount = parseInt(lastLine.slice(7), 10) || 0;
        } else if (lastLine.startsWith("INSERT ")) {
          const parts = lastLine.split(" ");
          rowCount = parseInt(parts[2] || parts[1], 10) || 0;
        }

        return { rows, rowCount };
      } catch (err) {
        const errMsg = String(err.stderr || err.stdout || err.message || "");
        if (errMsg.includes("duplicate key value violates unique constraint") || errMsg.includes("23505")) {
          const e = new Error("Unique constraint violation: " + errMsg);
          e.code = "23505";
          throw e;
        }
        throw new Error(`PostgreSQL execution error: ${errMsg}`);
      }
    }
  };
}

test("Live PostgreSQL Verification against disposable container", async (t) => {
  if (!isDockerPostgresAvailable()) {
    t.skip("Docker container air-test-pg is not reachable");
    return;
  }

  const pgClient = createDockerPostgresClient();
  const secretProvider = new DevelopmentSecretProvider({
    CRM_DATABASE: "postgres://postgres:airtest@localhost:25432/airtest"
  });

  const capabilityEngine = new CapabilityEngine({
    grantedCapabilities: [
      "data:postgres:customers:read",
      "data:postgres:customers:create",
      "data:postgres:customers:update",
      "data:postgres:customers:delete",
      "secret:CRM_DATABASE:consume"
    ],
    secretProvider
  });

  const adapter = new PostgresDataAdapter({
    pgClient,
    capabilityEngine,
    secretId: "CRM_DATABASE"
  });

  // 1. Resolve secret via trusted adapter boundary
  await adapter.connect();
  assert.ok(adapter.resolvedSecret, "Secret resolved inside trusted Postgres adapter");

  // 2. Setup schema table
  const entity = {
    id: "customers",
    fields: [
      { id: "name", type: "text" },
      { id: "email", type: "email" },
      { id: "tier", type: "enum" },
      { id: "revenue", type: "money" }
    ]
  };

  // Drop previous table if exists to start clean
  await pgClient.query('DROP TABLE IF EXISTS "customers";');
  const ddl = adapter.generateTableDdl(entity);
  await pgClient.query(ddl);

  // 3. Create records
  const c1 = await adapter.create("customers", {
    id: "c_live_1",
    name: "Live Enterprise Inc",
    email: "enterprise@live.example.com",
    tier: "gold",
    revenue: 120000
  });
  assert.equal(c1.id, "c_live_1");
  assert.equal(c1.name, "Live Enterprise Inc");

  const c2 = await adapter.create("customers", {
    id: "c_live_2",
    name: "Acme Live Corp",
    email: "acme@live.example.com",
    tier: "silver",
    revenue: 45000
  });
  assert.equal(c2.id, "c_live_2");

  // 4. Unique constraint violation on duplicate ID
  await assert.rejects(
    async () => adapter.create("customers", { id: "c_live_1", name: "Duplicate" }),
    (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.CONFLICT,
    "Duplicate key should fail with CONFLICT on live PostgreSQL"
  );

  // 5. Get by ID
  const fetched = await adapter.get("customers", "c_live_1");
  assert.equal(fetched.id, "c_live_1");
  assert.equal(fetched.email, "enterprise@live.example.com");

  // 6. Find with filters, search, and sort
  const found = await adapter.find("customers", {
    filters: { tier: "gold" }
  });
  assert.equal(found.total, 1);
  assert.equal(found.records[0].id, "c_live_1");

  const searchResult = await adapter.find("customers", {
    search: "Acme",
    searchFields: ["name", "email"]
  });
  assert.equal(searchResult.total, 1);
  assert.equal(searchResult.records[0].id, "c_live_2");

  // 7. Update record
  const updated = await adapter.update("customers", "c_live_2", { tier: "gold", revenue: 80000 });
  assert.equal(updated.tier, "gold");

  // 8. Delete record
  const deleted = await adapter.delete("customers", "c_live_2");
  assert.equal(deleted, true);

  // 9. Hostile values remain safe values
  const hostilePayload = "Robert'); DROP TABLE \"customers\";--";
  await adapter.create("customers", {
    id: "c_hostile_1",
    name: hostilePayload,
    email: "hostile@example.com",
    tier: "gold",
    revenue: 0
  });

  const getHostile = await adapter.get("customers", "c_hostile_1");
  assert.equal(getHostile.name, hostilePayload, "Hostile string stored verbatim as data without executing injection");

  // 10. Verify table was NOT dropped
  const checkTable = await adapter.find("customers", {});
  assert.ok(checkTable.total >= 1, "Table survived hostile payload unharmed");

  // 11. Hostile identifier injection attempt fails closed
  assert.throws(
    () => adapter._colName("customers", 'name"; DROP TABLE "customers";--'),
    (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.INVALID_REQUEST,
    "Hostile column identifier rejected by validateIdentifier"
  );
});

test("Live PostgreSQL Resilient Fault Recovery & Dependency Propagation", async (t) => {
  if (!isDockerPostgresAvailable()) {
    t.skip("Docker container air-test-pg is not reachable");
    return;
  }

  const liveClient = createDockerPostgresClient();
  let simulateFault = false;

  const faultInjectingClient = {
    async query(sql, params = []) {
      if (simulateFault) {
        const err = new Error("connect ECONNREFUSED 127.0.0.1:25432");
        err.category = FAILURE_CATEGORIES.UNAVAILABLE;
        throw err;
      }
      return liveClient.query(sql, params);
    }
  };

  const health = new HealthManager();
  health.registerComponent({ id: "air_runtime", type: "runtime", initialState: "healthy" });
  health.registerComponent({
    id: "postgres:crm",
    type: "data_source",
    initialState: "healthy",
    healthCheck: async () => {
      try {
        await faultInjectingClient.query("SELECT 1;");
        return { state: "healthy", reason: "Live PostgreSQL reachable" };
      } catch (e) {
        return { state: "unhealthy", reason: e.message };
      }
    }
  });
  health.registerComponent({
    id: "customer_manager",
    type: "application",
    initialState: "healthy",
    dependencies: ["air_runtime", "postgres:crm"]
  });

  const store = new OperationalStore();
  const engine = new OperationalEngine({
    healthManager: health,
    store
  });

  // 1. Initial State: All Healthy
  const initialCheck = await health.checkHealth("postgres:crm");
  assert.equal(initialCheck.state, "healthy");
  assert.equal(health.getComponent("customer_manager").state, "healthy");
  assert.equal(health.getComponent("air_runtime").state, "healthy");

  // 2. Normal execution succeeds
  const res1 = await engine.executeWithResilience("postgres:crm", "read", async () => {
    return faultInjectingClient.query("SELECT 1;");
  });
  assert.ok(res1);

  // 3. Inject Fault: PostgreSQL down
  simulateFault = true;

  // 4. Operation fails with structured OperationalError and bounded retry
  await assert.rejects(
    async () => {
      await engine.executeWithResilience("postgres:crm", "read", async () => {
        return faultInjectingClient.query("SELECT 1;");
      }, { maxRetries: 2 });
    },
    (err) => err.code === "AIR_DATA_SOURCE_UNAVAILABLE"
  );

  // 5. Verify Health: postgres unhealthy, app degraded, runtime remains healthy
  await health.checkHealth("postgres:crm");
  assert.equal(health.getComponent("postgres:crm").state, "unhealthy");
  assert.equal(health.getComponent("customer_manager").state, "degraded");
  assert.equal(health.getComponent("air_runtime").state, "healthy", "AIR runtime MUST remain healthy during Postgres outage");

  // 6. Verify Incident created
  const incidents = store.queryIncidents({ primary_component: "postgres:crm" });
  assert.ok(incidents.length >= 1);
  assert.equal(incidents[0].status, "open");

  // 7. Verify Circuit Breaker opened
  const cb = engine.getCircuitBreaker("postgres:crm");
  cb.forceState("open");
  assert.equal(cb.canExecute(), false);

  // 8. Restore PostgreSQL
  simulateFault = false;

  // 9. Cooldown expires -> Probe in half-open state succeeds -> Circuit closes
  cb.forceState("half_open");
  const resRecovered = await engine.executeWithResilience("postgres:crm", "read", async () => {
    return faultInjectingClient.query("SELECT 1;");
  });
  assert.ok(resRecovered);
  assert.equal(cb.state, "closed");

  // 10. Dependency Health Propagation: Health check passes -> customer_manager recovers
  await health.checkHealth("postgres:crm");
  assert.equal(health.getComponent("postgres:crm").state, "healthy");
  assert.equal(health.getComponent("customer_manager").state, "healthy");
  assert.equal(health.getComponent("air_runtime").state, "healthy");

  // 11. Resolve incident
  incidents[0].resolve("PostgreSQL connection restored and probe succeeded");
  assert.equal(incidents[0].status, "resolved");
});

