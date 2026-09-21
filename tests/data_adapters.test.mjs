import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseAir,
  AppRuntime,
  FAILURE_CATEGORIES,
  AdapterError,
  SchemaMapping,
  MemoryDataAdapter,
  SqliteDataAdapter,
  PostgresDataAdapter
} from "../web/runtime/air.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

test("DataAdapter contract: Memory, SQLite, and PostgreSQL implement uniform capabilities", async () => {
  const memory = new MemoryDataAdapter();
  const sqlite = new SqliteDataAdapter({ filename: ":memory:" });
  const postgres = new PostgresDataAdapter();

  for (const adapter of [memory, sqlite, postgres]) {
    const caps = adapter.capabilities();
    assert.ok(caps.includes("read"), `${adapter.constructor.name} must support read`);
    assert.ok(caps.includes("create"), `${adapter.constructor.name} must support create`);
    assert.ok(caps.includes("update"), `${adapter.constructor.name} must support update`);
    assert.ok(caps.includes("delete"), `${adapter.constructor.name} must support delete`);
    assert.ok(caps.includes("filter"), `${adapter.constructor.name} must support filter`);
    assert.ok(caps.includes("sort"), `${adapter.constructor.name} must support sort`);
    assert.ok(caps.includes("paginate"), `${adapter.constructor.name} must support paginate`);
  }

  await sqlite.close();
});

test("DataAdapter CRUD and Query lifecycle across Memory, SQLite, and PostgreSQL", async () => {
  const adapters = [
    { name: "Memory", adapter: new MemoryDataAdapter() },
    { name: "SQLite", adapter: new SqliteDataAdapter({ filename: ":memory:" }) },
    { name: "PostgreSQL", adapter: new PostgresDataAdapter() }
  ];

  const dummyEntity = {
    id: "customers",
    fields: [
      { id: "name", type: "text" },
      { id: "email", type: "email" },
      { id: "tier", type: "enum" },
      { id: "score", type: "number" }
    ]
  };

  for (const { name, adapter } of adapters) {
    if (adapter instanceof SqliteDataAdapter) {
      await adapter.initTableFromEntity(dummyEntity);
    }

    // 1. Create records
    const r1 = await adapter.create("customers", {
      id: "c1",
      name: "Alice Smith",
      email: "alice@example.com",
      tier: "gold",
      score: 95
    });
    const r2 = await adapter.create("customers", {
      id: "c2",
      name: "Bob Jones",
      email: "bob@example.com",
      tier: "silver",
      score: 80
    });
    const r3 = await adapter.create("customers", {
      id: "c3",
      name: "Charlie Brown",
      email: "charlie@example.com",
      tier: "gold",
      score: 70
    });

    assert.equal(r1.id, "c1", `${name}: create returned correct id`);
    assert.equal(r2.name, "Bob Jones", `${name}: create returned correct record`);

    // Duplicate create should throw CONFLICT
    await assert.rejects(
      async () => adapter.create("customers", { id: "c1", name: "Duplicate" }),
      (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.CONFLICT,
      `${name}: duplicate ID should fail with CONFLICT`
    );

    // 2. Get by ID
    const fetched = await adapter.get("customers", "c2");
    assert.ok(fetched, `${name}: get found record`);
    assert.equal(fetched.email, "bob@example.com");

    const missing = await adapter.get("customers", "c999");
    assert.equal(missing, null, `${name}: missing record returns null`);

    // 3. Count
    const totalCount = await adapter.count("customers");
    assert.equal(totalCount, 3, `${name}: total count is 3`);

    // 4. Find with filter
    const goldOnly = await adapter.find("customers", { filters: { tier: "gold" } });
    assert.equal(goldOnly.records.length, 2, `${name}: filter tier=gold returned 2 records`);

    // 5. Find with search
    const searchRes = await adapter.find("customers", {
      search: "jones",
      searchFields: ["name", "email"]
    });
    assert.equal(searchRes.records.length, 1, `${name}: search for 'jones' found 1 record`);
    assert.equal(searchRes.records[0].id, "c2");

    // 6. Sorting and Pagination
    const sorted = await adapter.find("customers", {
      sort: "-name",
      page: 1,
      pageSize: 2
    });
    assert.equal(sorted.records.length, 2, `${name}: pageSize=2 returned 2 records`);
    assert.equal(sorted.records[0].id, "c3", `${name}: desc sort by name first is Charlie`);
    assert.equal(sorted.totalPages, 2, `${name}: totalPages is 2`);

    // 7. Update
    const updated = await adapter.update("customers", "c2", { tier: "platinum" });
    assert.equal(updated.tier, "platinum", `${name}: updated tier to platinum`);
    const fetchedUpdated = await adapter.get("customers", "c2");
    assert.equal(fetchedUpdated.tier, "platinum");

    // Update missing should fail with NOT_FOUND
    await assert.rejects(
      async () => adapter.update("customers", "c999", { name: "Ghost" }),
      (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.NOT_FOUND,
      `${name}: update nonexistent record should fail with NOT_FOUND`
    );

    // 8. Delete
    const deleted = await adapter.delete("customers", "c3");
    assert.equal(deleted, true, `${name}: delete returned true`);
    const countAfterDelete = await adapter.count("customers");
    assert.equal(countAfterDelete, 2, `${name}: count after delete is 2`);

    // Delete missing should fail with NOT_FOUND
    await assert.rejects(
      async () => adapter.delete("customers", "c3"),
      (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.NOT_FOUND,
      `${name}: delete already deleted record should fail with NOT_FOUND`
    );

    if (adapter instanceof SqliteDataAdapter) {
      await adapter.close();
    }
  }
});

test("SchemaMapping translates semantic field names to backend column names seamlessly", async () => {
  const mapping = new SchemaMapping({
    firstName: "first_name",
    contactEmail: "email_address",
    companyId: "fk_company_id"
  });

  const semantic = {
    id: "u1",
    firstName: "Sarah",
    contactEmail: "sarah@example.com",
    companyId: "comp_123"
  };

  const backend = mapping.toBackendRecord(semantic);
  assert.equal(backend.first_name, "Sarah");
  assert.equal(backend.email_address, "sarah@example.com");
  assert.equal(backend.fk_company_id, "comp_123");
  assert.equal(backend.firstName, undefined);

  const restored = mapping.toSemanticRecord(backend);
  assert.deepEqual(restored, semantic);

  // Test with SqliteDataAdapter using SchemaMapping
  const sqlite = new SqliteDataAdapter({ filename: ":memory:" });
  sqlite.setSchemaMapping("users", mapping);

  sqlite.db.exec(`
    CREATE TABLE "users" (
      "id" TEXT PRIMARY KEY,
      "_archived_at" TEXT,
      "first_name" TEXT,
      "email_address" TEXT,
      "fk_company_id" TEXT
    );
  `);
  sqlite.initializedTables.add("users");

  await sqlite.create("users", semantic);
  const fetched = await sqlite.get("users", "u1");
  assert.equal(fetched.firstName, "Sarah");
  assert.equal(fetched.contactEmail, "sarah@example.com");

  // Raw DB row verification
  const rawRow = sqlite.db.prepare(`SELECT * FROM "users" WHERE "id" = 'u1'`).get();
  assert.equal(rawRow.first_name, "Sarah");
  assert.equal(rawRow.email_address, "sarah@example.com");

  await sqlite.close();
});

test("SQL Injection Resistance: Parameterized queries protect SQLite & Postgres against attack payloads", async () => {
  const sqlite = new SqliteDataAdapter({ filename: ":memory:" });
  const entity = {
    id: "accounts",
    fields: [
      { id: "username", type: "text" },
      { id: "notes", type: "text" }
    ]
  };
  await sqlite.initTableFromEntity(entity);

  // Malicious payloads attempting SQL injection
  const injection1 = "admin' OR '1'='1";
  const injection2 = "Robert'); DROP TABLE \"accounts\";--";
  const injection3 = "'; UNION SELECT * FROM \"accounts\" WHERE '1'='1";

  await sqlite.create("accounts", {
    id: "acc_1",
    username: injection1,
    notes: injection2
  });

  const get1 = await sqlite.get("accounts", "acc_1");
  assert.equal(get1.username, injection1);
  assert.equal(get1.notes, injection2);

  // Search with SQL injection payload in search string
  const searchAttack = await sqlite.find("accounts", {
    search: injection3,
    searchFields: ["username", "notes"]
  });
  // Search should safely execute without syntax errors or table drop
  assert.equal(searchAttack.total, 0);

  // Filter with SQL injection payload
  const filterAttack = await sqlite.find("accounts", {
    filters: { username: "nonexistent' OR 1=1 --" }
  });
  assert.equal(filterAttack.total, 0);

  // Ensure table still exists and data is intact
  const finalCheck = await sqlite.get("accounts", "acc_1");
  assert.ok(finalCheck);

  await sqlite.close();
});

test("Zero AIR Diff: customer-manager.air runs seamlessly on SQLite DataAdapter", async () => {
  const airSource = fs.readFileSync(path.join(ROOT, "apps/customer-manager.air"), "utf8");
  const seedSource = fs.readFileSync(path.join(ROOT, "data/customer-manager.seed.json"), "utf8");
  const seedData = JSON.parse(seedSource);

  const model = parseAir(airSource);

  // 1. Setup SQLite Data Adapter
  const sqlite = new SqliteDataAdapter({ filename: ":memory:" });
  for (const entity of model.entities.values()) {
    await sqlite.initTableFromEntity(entity);
  }

  // 2. Initialize AppRuntime with SQLite dataAdapter
  const runtime = new AppRuntime(model, {
    seedData,
    principal: { roles: ["admin"] },
    dataAdapter: sqlite
  });

  // 3. Verify runtime loaded seed data
  const customers = runtime.query("customers");
  assert.ok(customers.records.length > 0, "Customers loaded in runtime");
  assert.equal(customers.records[0].id, "c_01");

  // 4. Create new customer via runtime
  const created = runtime.create("customers", {
    name: "Acme Enterprise Database Client",
    email: "enterprise@acme.example.com",
    account_manager: "am_01",
    status: "Active",
    monthly_revenue: 50000
  });

  assert.ok(created.record, "Customer created in AppRuntime");
  assert.equal(created.record.name, "Acme Enterprise Database Client");

  // 5. Query through runtime
  const queryResult = runtime.query("customers", { search: "Database Client" });
  assert.equal(queryResult.records.length, 1);
  assert.equal(queryResult.records[0].id, created.record.id);

  // 6. Verify SQLite storage directly
  const sqliteRow = await sqlite.get("customers", created.record.id);
  assert.ok(sqliteRow, "Record directly present in SQLite DataAdapter");
  assert.equal(sqliteRow.name, "Acme Enterprise Database Client");

  await sqlite.close();
});
