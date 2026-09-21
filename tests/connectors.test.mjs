import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  FAILURE_CATEGORIES,
  AdapterError,
  EventEnvelope,
  ConnectorManifest,
  Connector,
  RestConnectorAdapter,
  McpConnectorAdapter,
  ConnectorRegistry
} from "../web/runtime/air.mjs";

test("ConnectorManifest: Validates structure, exports capabilities, and serializes cleanly", () => {
  const manifest = new ConnectorManifest({
    id: "stripe_payment",
    name: "Stripe Payment Gateway",
    version: "2.1.0",
    protocol: "rest",
    description: "Processes customer credit card charges, refunds, and subscriptions",
    capabilities: ["payments", "refunds", "subscriptions", "events"],
    resources: [
      { name: "charges", description: "Customer payment transactions", fields: ["id", "amount", "currency", "status"] },
      { name: "customers", description: "Customer billing records", fields: ["id", "email", "default_source"] }
    ],
    actions: [
      {
        name: "create_charge",
        description: "Charges a credit card or payment method",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Amount in cents" },
            currency: { type: "string", description: "3-letter currency code" },
            customerId: { type: "string", description: "Customer ID" }
          },
          required: ["amount", "currency"]
        }
      },
      {
        name: "refund_charge",
        description: "Refunds a previous charge",
        parameters: {
          type: "object",
          properties: {
            chargeId: { type: "string" },
            amount: { type: "number" }
          },
          required: ["chargeId"]
        }
      }
    ],
    events: [
      { name: "charge.succeeded", description: "Fired when a payment is successfully processed" },
      { name: "charge.failed", description: "Fired when a payment attempt fails" }
    ]
  });

  assert.equal(manifest.id, "stripe_payment");
  assert.equal(manifest.name, "Stripe Payment Gateway");
  assert.equal(manifest.actions.length, 2);
  assert.equal(manifest.resources.length, 2);
  assert.equal(manifest.events.length, 2);

  const json = manifest.toJSON();
  assert.equal(json.id, "stripe_payment");

  // AI Prompt Context generation check
  const promptContext = manifest.toAiPromptContext();
  assert.ok(promptContext.includes("stripe_payment"));
  assert.ok(promptContext.includes("create_charge(amount, currency, customerId)"));
  assert.ok(promptContext.includes("charge.succeeded"));
});

test("EventEnvelope: Standardized lifecycle event normalization", () => {
  const envelope = new EventEnvelope({
    id: "evt_101",
    source: "stripe_payment",
    type: "charge.succeeded",
    data: { amount: 5000, currency: "USD", customerId: "cust_99" }
  });

  assert.equal(envelope.id, "evt_101");
  assert.equal(envelope.source, "stripe_payment");
  assert.equal(envelope.type, "charge.succeeded");
  assert.equal(envelope.data.amount, 5000);
  assert.equal(envelope.version, "1.0.0");
  assert.ok(envelope.timestamp);

  const serialized = envelope.toJSON();
  assert.equal(serialized.type, "charge.succeeded");
});

test("RestConnectorAdapter: End-to-end HTTP interaction and error mapping", async () => {
  // 1. Setup local HTTP test server
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsedBody = body ? JSON.parse(body) : null;

    if (url.pathname === "/actions/create_charge" && req.method === "POST") {
      if (!parsedBody?.amount) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "amount is required" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ chargeId: "ch_test_123", status: "succeeded", amount: parsedBody.amount }));
    }

    if (url.pathname === "/actions/unauthorized_action") {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Invalid API key" }));
    }

    if (url.pathname === "/actions/forbidden_action") {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Forbidden scope" }));
    }

    if (url.pathname === "/actions/conflict_action") {
      res.writeHead(409, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Duplicate idempotency key" }));
    }

    if (url.pathname === "/actions/server_error") {
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Upstream gateway unavailable" }));
    }

    if (url.pathname === "/resources/charges" && req.method === "GET") {
      const customer = url.searchParams.get("customer");
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        records: [
          { id: "ch_01", customer, amount: 2500 }
        ]
      }));
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const manifest = new ConnectorManifest({
    id: "rest_payment",
    name: "Payment REST Service",
    protocol: "rest",
    capabilities: ["payments"]
  });

  const adapter = new RestConnectorAdapter(manifest, { baseUrl });

  try {
    // 1. Success Action
    const charge = await adapter.invoke("create_charge", { amount: 10000, currency: "USD" });
    assert.equal(charge.chargeId, "ch_test_123");
    assert.equal(charge.status, "succeeded");

    // 2. 400 Bad Request -> INVALID_REQUEST
    await assert.rejects(
      async () => adapter.invoke("create_charge", {}),
      (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.INVALID_REQUEST
    );

    // 3. 401 Unauthorized -> UNAUTHORIZED
    await assert.rejects(
      async () => adapter.invoke("unauthorized_action", {}),
      (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.UNAUTHORIZED
    );

    // 4. 403 Forbidden -> FORBIDDEN
    await assert.rejects(
      async () => adapter.invoke("forbidden_action", {}),
      (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.FORBIDDEN
    );

    // 5. 409 Conflict -> CONFLICT
    await assert.rejects(
      async () => adapter.invoke("conflict_action", {}),
      (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.CONFLICT
    );

    // 6. 503 Unavailable -> UNAVAILABLE
    await assert.rejects(
      async () => adapter.invoke("server_error", {}),
      (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.UNAVAILABLE
    );

    // 7. Query Resource
    const queryRes = await adapter.queryResource("charges", { customer: "cust_1" });
    assert.equal(queryRes.records.length, 1);
    assert.equal(queryRes.records[0].customer, "cust_1");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("McpConnectorAdapter: JSON-RPC tool invocation, resource retrieval, and dynamic discovery", async () => {
  // Local MCP mock server fixture
  const rpcHandler = async (req) => {
    if (req.method === "tools/list") {
      return {
        result: {
          tools: [
            {
              name: "calculate_tax",
              description: "Calculates sales tax based on jurisdiction and amount",
              inputSchema: {
                type: "object",
                properties: {
                  amount: { type: "number" },
                  country: { type: "string" }
                }
              }
            },
            {
              name: "validate_vat",
              description: "Validates EU VAT numbers via VIES",
              inputSchema: {
                type: "object",
                properties: { vatNumber: { type: "string" } }
              }
            }
          ]
        }
      };
    }

    if (req.method === "resources/list") {
      return {
        result: {
          resources: [
            {
              uri: "tax://rates/eu",
              name: "EU Tax Rates",
              description: "Standard VAT rates per country",
              mimeType: "application/json"
            }
          ]
        }
      };
    }

    if (req.method === "tools/call") {
      const { name, arguments: args } = req.params;
      if (name === "calculate_tax") {
        if (!args.amount) {
          return {
            error: { code: -32602, message: "Invalid params: amount is required" }
          };
        }
        return {
          result: { tax: args.amount * 0.20, rate: 0.20, currency: "EUR" }
        };
      }
      return {
        error: { code: -32601, message: `Tool ${name} not found` }
      };
    }

    if (req.method === "resources/read") {
      if (req.params.uri === "tax://rates/eu") {
        return {
          result: { contents: [{ uri: "tax://rates/eu", text: '{"FR":0.20,"DE":0.19,"ES":0.21}' }] }
        };
      }
      return {
        error: { code: -32000, message: `Resource ${req.params.uri} not found` }
      };
    }

    return { error: { code: -32601, message: "Method not found" } };
  };

  const manifest = new ConnectorManifest({
    id: "tax_service",
    name: "Tax Calculation Service",
    protocol: "mcp",
    capabilities: ["tax", "validation"]
  });

  const mcpAdapter = new McpConnectorAdapter(manifest, { rpcHandler });

  // 1. Dynamic MCP Discovery
  const discovered = await mcpAdapter.discoverFromMcpServer();
  assert.equal(discovered.actions.length, 2);
  assert.equal(discovered.actions[0].name, "calculate_tax");
  assert.equal(discovered.resources.length, 1);
  assert.equal(discovered.resources[0].uri, "tax://rates/eu");

  // 2. Invoke Tool
  const taxResult = await mcpAdapter.invoke("calculate_tax", { amount: 500, country: "FR" });
  assert.equal(taxResult.tax, 100);
  assert.equal(taxResult.rate, 0.20);

  // 3. Error code mapping: -32602 -> INVALID_REQUEST
  await assert.rejects(
    async () => mcpAdapter.invoke("calculate_tax", {}),
    (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.INVALID_REQUEST
  );

  // 4. Error code mapping: -32601 -> UNSUPPORTED
  await assert.rejects(
    async () => mcpAdapter.invoke("nonexistent_tool", {}),
    (err) => err instanceof AdapterError && err.category === FAILURE_CATEGORIES.UNSUPPORTED
  );

  // 5. Query Resource
  const resourceRes = await mcpAdapter.queryResource("tax://rates/eu");
  assert.ok(resourceRes.contents[0].text.includes("0.20"));
});

test("ConnectorRegistry: Registration, Event Dispatch, and AI Semantic Discovery", () => {
  const registry = new ConnectorRegistry();

  // Create two connectors
  const c1 = new RestConnectorAdapter({
    id: "payment_stripe",
    name: "Stripe Payments",
    protocol: "rest",
    description: "Credit card processing and subscription billing",
    capabilities: ["payments", "subscriptions"],
    actions: [{ name: "charge", description: "Process a payment charge", parameters: { properties: { amount: {} } } }]
  });

  const c2 = new McpConnectorAdapter({
    id: "tax_engine",
    name: "Vertex Tax Engine",
    protocol: "mcp",
    description: "Automated VAT and global tax rate calculations",
    capabilities: ["tax", "compliance"],
    actions: [{ name: "calc_tax", description: "Calculate VAT for order", parameters: { properties: { total: {} } } }]
  });

  registry.register(c1);
  registry.register(c2);

  assert.equal(registry.list().length, 2);
  assert.ok(registry.has("payment_stripe"));
  assert.ok(registry.has("tax_engine"));

  // 1. Semantic Discovery for AI
  const paymentMatches = registry.discover("payment");
  assert.equal(paymentMatches.length, 1);
  assert.equal(paymentMatches[0].id, "payment_stripe");

  const taxMatches = registry.discover("vat");
  assert.equal(taxMatches.length, 1);
  assert.equal(taxMatches[0].id, "tax_engine");

  // 2. AI Prompt Context generation and Token/Character Efficiency
  const aiContext = registry.toAiPromptContext();
  assert.ok(aiContext.includes("payment_stripe"));
  assert.ok(aiContext.includes("tax_engine"));
  assert.ok(aiContext.includes("charge(amount)"));
  assert.ok(aiContext.includes("calc_tax(total)"));

  // Verify compact footprint (under 1KB total for 2 rich connectors with 0 transport code)
  const charLength = aiContext.length;
  assert.ok(charLength < 1000, `AI Prompt Context should be compact, got ${charLength} characters`);

  // 3. Event Bus Integration
  const eventsReceived = [];
  c1.on("payment.received", (evt) => eventsReceived.push(evt));

  const dispatched = c1.emit("payment.received", { chargeId: "ch_99", amount: 2000 });
  assert.equal(eventsReceived.length, 1);
  assert.equal(eventsReceived[0].data.amount, 2000);
  assert.equal(dispatched.source, "payment_stripe");
});
