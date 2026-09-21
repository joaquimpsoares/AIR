import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  parseAir,
  AppRuntime,
  compilePresentation,
  serializePresentationIr,
  FAILURE_CATEGORIES,
  AdapterError,
  SECURITY_ERROR_CODES,
  SecurityError,
  FIELD_CLASSIFICATIONS,
  AUTHORITY_CLASSES,
  RedactionEngine,
  globalRedactor,
  SecretHandle,
  SecretProvider,
  DevelopmentSecretProvider,
  Capability,
  CapabilitySet,
  SecurityAuditLogger,
  globalAuditLogger,
  TrustedAdapterDefinition,
  TrustedAdapterRegistry,
  globalTrustedRegistry,
  NetworkDestinationPolicy,
  CapabilityEngine,
  deriveRequestedCapabilities,
  inspectCapabilities,
  inspectSecurity,
  diffCapabilities,
  MemoryDataAdapter,
  SqliteDataAdapter,
  PostgresDataAdapter,
  ConnectorManifest,
  ConnectorRegistry,
  RestConnectorAdapter,
  McpConnectorAdapter
} from "../web/runtime/air.mjs";

const TEST_SECRET_SENTINEL = "AIR_TEST_SECRET_DO_NOT_LEAK_7F3A99B_LIVE_PROD";
const TEST_SECRET_ID = "CRM_DATABASE_CREDENTIAL";

test("1 & 2. Secret Handle: Value is never extractable by AIR and raw retrieval fails closed", async () => {
  const secretProvider = new DevelopmentSecretProvider({
    [TEST_SECRET_ID]: TEST_SECRET_SENTINEL
  });

  const engine = new CapabilityEngine({
    applicationId: "untrusted_air_app",
    grantedCapabilities: [`secret:${TEST_SECRET_ID}:consume`],
    secretProvider
  });

  // Attempt raw secret resolution by untrusted application (fails closed)
  await assert.rejects(
    async () => engine.resolveSecretForAdapter(TEST_SECRET_ID, "untrusted_adapter@1", "connect"),
    (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.ADAPTER_UNTRUSTED,
    "Untrusted adapter identity cannot resolve secrets"
  );

  // Trusted adapter resolution returns an opaque SecretHandle
  const handle = await engine.resolveSecretForAdapter(TEST_SECRET_ID, "postgres@1", "connect");
  assert.equal(handle instanceof SecretHandle, true);
  assert.equal(handle.id, TEST_SECRET_ID);
  assert.equal(handle.opaque, true);

  // Attempt unwrapping without trusted proof
  assert.throws(
    () => handle.unwrap("untrusted_app", { isTrustedAdapter: false }),
    (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.SECRET_DENIED,
    "Unwrapping requires trusted adapter proof"
  );

  // Serialized representation of SecretHandle must NEVER contain the raw secret
  const serialized = JSON.stringify(handle);
  assert.ok(!serialized.includes(TEST_SECRET_SENTINEL), "JSON serialization must not leak secret sentinel");
  assert.ok(serialized.includes("[SECRET_HANDLE_PROTECTED]"));
});

test("3 & 4. Network Destination Policy: Blocks ungranted destinations and catches redirects", async () => {
  const allowedServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  });

  const redirectServer = http.createServer((req, res) => {
    // Malicious redirect to an unauthorized host (e.g. metadata service or internal port)
    res.writeHead(302, {
      "Location": "http://169.254.169.254/latest/meta-data/"
    });
    res.end();
  });

  await new Promise((r) => allowedServer.listen(0, r));
  await new Promise((r) => redirectServer.listen(0, r));

  const allowedPort = allowedServer.address().port;
  const redirectPort = redirectServer.address().port;

  const networkPolicy = new NetworkDestinationPolicy([
    `localhost:${allowedPort}`,
    `localhost:${redirectPort}`
  ]);

  const manifest = new ConnectorManifest({
    id: "payment_gw",
    name: "Payment Gateway",
    protocol: "rest"
  });

  const adapterAllowed = new RestConnectorAdapter(manifest, {
    baseUrl: `http://localhost:${allowedPort}`,
    networkPolicy
  });

  const adapterRedirect = new RestConnectorAdapter(manifest, {
    baseUrl: `http://localhost:${redirectPort}`,
    networkPolicy
  });

  try {
    // Allowed destination succeeds
    const ok = await adapterAllowed.invoke("status", {});
    assert.equal(ok.status, "ok");

    // Request to ungranted destination fails closed
    const ungrantedAdapter = new RestConnectorAdapter(manifest, {
      baseUrl: "http://malicious-external-api.evil.com",
      networkPolicy
    });
    await assert.rejects(
      async () => ungrantedAdapter.invoke("status", {}),
      (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.NETWORK_DENIED,
      "Request to ungranted destination must fail closed with AIR_NETWORK_DENIED"
    );

    // Redirect to ungranted destination (169.254.169.254) fails closed
    await assert.rejects(
      async () => adapterRedirect.invoke("status", {}),
      (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.NETWORK_DENIED,
      "Redirect to ungranted destination must fail closed with AIR_NETWORK_DENIED"
    );
  } finally {
    await new Promise((r) => allowedServer.close(r));
    await new Promise((r) => redirectServer.close(r));
  }
});

test("5 & 6. MCP Security: Discovered destructive tools are NOT authorized without explicit grant", async () => {
  const rpcHandler = async (req) => {
    if (req.method === "tools/list") {
      return {
        result: {
          tools: [
            { name: "read_project", description: "Safe project reader" },
            { name: "delete_project", description: "Dangerous project destructor" }
          ]
        }
      };
    }
    if (req.method === "tools/call") {
      return { result: { executed: req.params.name } };
    }
    return { result: {} };
  };

  const capabilityEngine = new CapabilityEngine({
    applicationId: "mcp_app",
    grantedCapabilities: [
      "connector:project_mcp:action:read_project:invoke"
      // Note: delete_project is NOT granted
    ]
  });

  const manifest = new ConnectorManifest({
    id: "project_mcp",
    name: "Project Manager MCP",
    protocol: "mcp"
  });

  const adapter = new McpConnectorAdapter(manifest, {
    rpcHandler,
    capabilityEngine
  });

  // 1. Discovery sees BOTH tools
  const discovered = await adapter.discoverFromMcpServer();
  assert.equal(discovered.actions.length, 2);
  assert.ok(discovered.actions.some((a) => a.name === "delete_project"));

  // 2. Granted tool execution succeeds
  const readRes = await adapter.invoke("read_project", { id: "p1" });
  assert.equal(readRes.executed, "read_project");

  // 3. Discovered but UNGRANTED tool execution FAILS CLOSED
  await assert.rejects(
    async () => adapter.invoke("delete_project", { id: "p1" }),
    (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.CONNECTOR_DENIED,
    "Invoking ungranted MCP tool must fail closed with AIR_CONNECTOR_DENIED"
  );
});

test("7, 18, 19. Two-Key Authorization: Semantic Authority + Infrastructure Capability both required", async () => {
  const airSource = `
    air version=2
    app crm title="CRM" subtitle="Customer Manager" initial=customers
    resource customers
    field customers.name text required
    manage customers create=admin edit=admin delete=admin
    access customers view=role:admin|role:viewer create=role:admin edit=role:admin
  `;

  const model = parseAir(airSource);

  // Scenario A: User is Admin, but Deployment grants ONLY READ capability
  const readOnlyEngine = new CapabilityEngine({
    applicationId: "crm_app",
    grantedCapabilities: ["data:*:customers:read"]
  });

  const runtimeReadOnly = new AppRuntime(model, {
    principal: { roles: ["admin"] }, // Has semantic authority
    capabilityEngine: readOnlyEngine // Lacks infrastructure write capability
  });

  // Read works
  const list = runtimeReadOnly.query("customers");
  assert.ok(Array.isArray(list.records));

  // Write fails due to missing infrastructure capability
  assert.throws(
    () => runtimeReadOnly.create("customers", { name: "Test Customer" }),
    (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.DATA_DENIED,
    "Admin cannot write if deployment granted only read capability"
  );

  // Scenario B: Deployment grants WRITE capability, but Principal is non-admin
  const fullWriteEngine = new CapabilityEngine({
    applicationId: "crm_app",
    grantedCapabilities: [
      "data:*:customers:read",
      "data:*:customers:create"
    ]
  });

  const runtimeNonAdmin = new AppRuntime(model, {
    principal: { roles: ["viewer"] }, // Lacks semantic authority
    capabilityEngine: fullWriteEngine // Has infrastructure write capability
  });

  // Write fails due to missing semantic authority
  assert.throws(
    () => runtimeNonAdmin.create("customers", { name: "Test Customer" }),
    /current principal is not permitted to create/,
    "Non-admin cannot write even if infrastructure capability exists"
  );

  // Scenario C: Both Semantic Authority AND Infrastructure Capability are present
  const runtimeFull = new AppRuntime(model, {
    principal: { roles: ["admin"] },
    capabilityEngine: fullWriteEngine
  });

  const created = runtimeFull.create("customers", { name: "Authorized Customer" });
  assert.ok(created.record);
  assert.equal(created.record.name, "Authorized Customer");
});

test("8, 20, 21, 22. AI Authority Boundary: Redacts secrets, headers, and separates metadata from records", async () => {
  const secretProvider = new DevelopmentSecretProvider({
    [TEST_SECRET_ID]: TEST_SECRET_SENTINEL
  });

  const registry = new ConnectorRegistry();
  const c1 = new RestConnectorAdapter({
    id: "billing_service",
    name: "Billing Service",
    protocol: "rest",
    description: `Billing connector with sensitive key ${TEST_SECRET_SENTINEL}`,
    actions: [
      { name: "charge", description: `Charges customer with Bearer ${TEST_SECRET_SENTINEL}` }
    ]
  });

  registry.register(c1);

  // AI Prompt Context must NEVER leak registered secrets or Bearer tokens
  const aiPromptContext = registry.toAiPromptContext();
  assert.ok(!aiPromptContext.includes(TEST_SECRET_SENTINEL), "AI prompt context must not contain secret sentinel");
  assert.ok(aiPromptContext.includes("[REDACTED]"));

  // AI Application Data boundary: Default is metadata only
  const airSource = `
    air version=2
    app secret_crm title="Secret CRM" subtitle="Sensitive CRM" initial=customers
    resource customers
    field customers.name text required
    field customers.ssn text
    manage customers
  `;
  const model = parseAir(airSource);
  // Mark SSN field as SECRET classification
  model.entities.get("customers").fieldMap.get("ssn").classification = FIELD_CLASSIFICATIONS.SECRET;

  const capabilityEngine = new CapabilityEngine({
    applicationId: "crm_ai",
    grantedCapabilities: ["data:*:customers:read"] // Note: NO ai:data:*:read grant
  });

  const runtime = new AppRuntime(model, {
    seedData: {
      customers: [{ id: "c1", name: "Alice", ssn: "000-12-3456" }]
    },
    capabilityEngine
  });

  // Default AI context: Metadata only, records are not included
  const defaultAiContext = runtime.toAiContext();
  assert.equal(defaultAiContext.records, undefined, "AI context by default has no records");
  assert.equal(defaultAiContext.entities.length, 1);

  // Requesting records without AI capability FAILS CLOSED
  assert.throws(
    () => runtime.toAiContext({ includeRecords: true }),
    (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.AI_CONTEXT_DENIED,
    "AI context requesting production records without AI data capability must fail closed"
  );

  // With explicit AI record capability, secret fields (SSN) are redacted
  capabilityEngine.updateGrants([
    "data:*:customers:read",
    "ai:data:*:read"
  ]);

  const recordContext = runtime.toAiContext({ includeRecords: true });
  assert.ok(recordContext.records.customers);
  assert.equal(recordContext.records.customers[0].name, "Alice");
  assert.equal(recordContext.records.customers[0].ssn, "[REDACTED_SECRET]", "Secret classification field must be redacted");
});

test("9, 10, 23. Redaction Engine: Sanitizes logs, error objects, and audit events", () => {
  const redactor = new RedactionEngine({
    knownSecrets: [TEST_SECRET_SENTINEL]
  });

  // 1. Nested Object Redaction
  const dirtyObject = {
    apiKey: TEST_SECRET_SENTINEL,
    nested: {
      password: "my_super_secret_password",
      authorization: `Bearer ${TEST_SECRET_SENTINEL}`,
      safeField: "Public Information"
    }
  };

  const cleanObject = redactor.redactObject(dirtyObject);
  assert.equal(cleanObject.apiKey, "[REDACTED]");
  assert.equal(cleanObject.nested.password, "[REDACTED]");
  assert.equal(cleanObject.nested.authorization, "[REDACTED]");
  assert.equal(cleanObject.nested.safeField, "Public Information");

  // 2. Audit Event Redaction
  const auditLogger = new SecurityAuditLogger();
  const loggedEvent = auditLogger.log({
    actor: "admin",
    operation: "test.op",
    resource: `connection_to_${TEST_SECRET_SENTINEL}`,
    decision: "allowed",
    reason: `Authenticated with key ${TEST_SECRET_SENTINEL}`
  });

  assert.ok(!loggedEvent.resource.includes(TEST_SECRET_SENTINEL));
  assert.ok(!loggedEvent.reason.includes(TEST_SECRET_SENTINEL));
});

test("11, 26, 32. Presentation IR & Browser Boundary: Never contains SecretHandles or credentials", () => {
  const airSource = `
    air version=2
    app secure_app title="Secure App" subtitle="No Secrets In UI" initial=items
    resource items
    field items.title text required
    manage items
    access items view=role:admin
  `;

  const model = parseAir(airSource);
  const ir = compilePresentation(model);
  const serializedIr = serializePresentationIr(ir);

  assert.ok(!serializedIr.includes(TEST_SECRET_SENTINEL));
  assert.ok(!serializedIr.includes("SecretHandle"));
  assert.ok(!serializedIr.includes("password"));
});

test("12, 28, 31. Capability Diff & Privilege Escalation Detection", () => {
  const oldAppSource = `
    air version=2
    app test_app title="App v1" initial=invoices
    resource invoices
    field invoices.amount money currency=USD
    manage invoices
  `;

  const newAppSource = `
    air version=2
    app test_app title="App v2" initial=invoices
    resource invoices
    field invoices.amount money currency=USD
    manage invoices
    resource payments
    field payments.amount money currency=USD
    manage payments
  `;

  const oldModel = parseAir(oldAppSource);
  const newModel = parseAir(newAppSource);

  const diff = diffCapabilities(oldModel, newModel);
  assert.equal(diff.hasEscalation, true, "Privilege increase must be detected");
  assert.ok(diff.added.some((c) => c.includes("payments:read")));
  assert.ok(diff.added.some((c) => c.includes("payments:create")));

  const human = diff.toHumanString();
  assert.ok(human.includes("PRIVILEGE INCREASE DETECTED"));
  assert.ok(human.includes("+ data:*:payments:read"));
});

test("27, 40. Capability Revocation & Grant Update: Stale authority is immediately denied", () => {
  const engine = new CapabilityEngine({
    applicationId: "revocation_app",
    grantedCapabilities: [
      "data:*:customers:read",
      "data:*:customers:create"
    ]
  });

  // 1. Allowed initially
  assert.doesNotThrow(() => engine.assertCapability("data:*:customers:create"));

  // 2. Revoke create capability
  engine.updateGrants(["data:*:customers:read"]);

  // 3. Stale create authority is immediately denied
  assert.throws(
    () => engine.assertCapability("data:*:customers:create"),
    (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.DATA_DENIED,
    "Revoked capability must be immediately denied"
  );
});

test("42. Secret Rotation: DevelopmentSecretProvider rotates value without AIR changes", async () => {
  const provider = new DevelopmentSecretProvider({
    DB_KEY: "initial_secret_v1_9988"
  });

  const engine = new CapabilityEngine({
    applicationId: "rotation_app",
    grantedCapabilities: ["secret:DB_KEY:consume"],
    secretProvider: provider
  });

  // Resolve v1
  const h1 = await engine.resolveSecretForAdapter("DB_KEY", "postgres@1", "connect");
  assert.equal(h1.unwrap("postgres@1", { isTrustedAdapter: true }), "initial_secret_v1_9988");

  // Rotate secret value
  provider.rotateSecret("DB_KEY", "rotated_secret_v2_1122");

  // Resolve v2
  const h2 = await engine.resolveSecretForAdapter("DB_KEY", "postgres@1", "connect");
  assert.equal(h2.unwrap("postgres@1", { isTrustedAdapter: true }), "rotated_secret_v2_1122");
});

test("44 & 45. Compiled Artifact & Source Security Scan: Sentinel does not leak into artifacts", () => {
  const airSource = `
    air version=2
    app demo_app title="Demo Sentinel Check" initial=notes
    resource notes
    field notes.text text
    manage notes
  `;

  const model = parseAir(airSource);
  const ir = compilePresentation(model);
  const serializedIr = serializePresentationIr(ir);

  // Scan compiled Presentation IR
  assert.ok(!serializedIr.includes(TEST_SECRET_SENTINEL), "Presentation IR must not contain test sentinel");

  // Scan inspection output
  const secInspection = inspectSecurity(model, {
    adapter: "postgres@1"
  });
  const inspectionText = secInspection.toHumanString();
  assert.ok(!inspectionText.includes(TEST_SECRET_SENTINEL), "Security inspection must not contain test sentinel");
});
