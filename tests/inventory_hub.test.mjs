import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseAir,
  parseSeedData,
  AppRuntime,
  MemoryStorage,
  tokenizeLine,
  applyPatch
} from "../web/runtime/air.mjs";
import {
  compileVisualizationIR,
  compileWorkflowGraph,
  compileTimelineGraph,
  VISUAL_INTENTS,
  DATA_VISUALIZATION_REPRESENTATIONS,
  SEMANTIC_GRAPH_REPRESENTATIONS
} from "../web/runtime/visualization_ir.mjs";

function createTestRuntime(airSource, seedSource, principal = { roles: ["admin", "operator"] }) {
  const model = parseAir(airSource);
  const seedData = parseSeedData(seedSource, model);
  let next = 100;
  return new AppRuntime(model, {
    seedData,
    storage: new MemoryStorage(),
    principal,
    idFactory: (resource) => `${resource}_${next++}`
  });
}

test("Inventory & Order Management Benchmark Suite (Inventory Hub)", async (t) => {
  const airSource = fs.readFileSync("apps/inventory-hub.air", "utf8");
  const seedSource = fs.readFileSync("data/inventory-hub.seed.json", "utf8");

  await t.test("1. AIR Schema Parsing & Model Compilation", () => {
    const model = parseAir(airSource);
    assert.equal(model.app.id, "inventory_hub");
    assert.equal(model.app.title, "Inventory Hub");

    // Verify all 9 requested resources exist
    assert.ok(model.entities.has("products"), "products entity must exist");
    assert.ok(model.entities.has("warehouses"), "warehouses entity must exist");
    assert.ok(model.entities.has("inventory_balances"), "inventory_balances entity must exist");
    assert.ok(model.entities.has("customers"), "customers entity must exist");
    assert.ok(model.entities.has("orders"), "orders entity must exist");
    assert.ok(model.entities.has("order_lines"), "order_lines entity must exist");
    assert.ok(model.entities.has("stock_movements"), "stock_movements entity must exist");
    assert.ok(model.entities.has("transfers"), "transfers entity must exist");
    assert.ok(model.entities.has("returns"), "returns entity must exist");

    // Verify processes
    assert.ok(model.processes.has("orders"), "orders process must exist");
    assert.ok(model.processes.has("transfers"), "transfers process must exist");
    assert.ok(model.processes.has("returns"), "returns process must exist");

    const orderProcess = model.processes.get("orders");
    assert.equal(orderProcess.initial, "Draft");
    assert.deepEqual(new Set(orderProcess.terminal), new Set(["Fulfilled", "Cancelled"]));
  });

  await t.test("2. End-to-End Runtime CRUD & Data Storage Integrity", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    assert.equal(runtime.records("products").length, 6);
    assert.equal(runtime.records("warehouses").length, 3);
    assert.equal(runtime.records("inventory_balances").length, 8);
    assert.equal(runtime.records("customers").length, 4);
    assert.equal(runtime.records("orders").length, 5);
    assert.equal(runtime.records("order_lines").length, 6);
    assert.equal(runtime.records("stock_movements").length, 5);
    assert.equal(runtime.records("transfers").length, 2);
    assert.equal(runtime.records("returns").length, 2);

    // Create a new product
    const newProd = runtime.create("products", {
      sku: "SKU-MON-007",
      name: "4K Ultra-Wide Monitor",
      category: "Electronics",
      unit_price: 699.00,
      status: "Active"
    });
    assert.ok(newProd.record.id);
    assert.equal(newProd.record.sku, "SKU-MON-007");

    // Create an inventory balance for the new product
    const newBal = runtime.create("inventory_balances", {
      product: newProd.record.id,
      warehouse: "wh_01",
      quantity_on_hand: 20,
      quantity_reserved: 0,
      reorder_level: 5,
      status: "InStock"
    });
    assert.ok(newBal.record.id);
    assert.equal(newBal.record.quantity_on_hand, 20);
  });

  await t.test("3. Quantity Semantics, Numeric Boundaries & Physical Unit Status", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    // Test positive integer stock
    const bal = runtime.records("inventory_balances").find((b) => b.id === "bal_01");
    assert.equal(bal.quantity_on_hand, 45);
    assert.equal(typeof bal.quantity_on_hand, "number");

    // Quantity is now represented as discrete integer type.
    // Test fractional stock: AIR rejects 10.5 because integer type enforces discrete integrity
    const fractionalBal = runtime.create("inventory_balances", {
      product: "prod_06",
      warehouse: "wh_01",
      quantity_on_hand: 10.5,
      quantity_reserved: 0,
      reorder_level: 5,
      status: "InStock"
    });
    assert.equal(fractionalBal.record, null, "Integer type strictly rejects floating point values (QUANTITY_SEMANTICS_GAP is closed)");
    assert.match(fractionalBal.errors.quantity_on_hand, /must be an integer|must be a valid safe integer/);

    // Test zero stock
    const zeroBal = runtime.records("inventory_balances").find((b) => b.id === "bal_07");
    assert.equal(zeroBal.quantity_on_hand, 0);
    assert.equal(zeroBal.status, "OutOfStock");
  });

  await t.test("4. Order Lines & Price Snapshot Semantics", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    // Order Lines reference parent Order and Product
    const ord01Lines = runtime.records("order_lines").filter((l) => l.order === "ord_01");
    assert.equal(ord01Lines.length, 2);

    // Price snapshot verification:
    // When Product unit_price changes, existing order_line snapshot remains untouched
    const prod01 = runtime.records("products").find((p) => p.id === "prod_01");
    assert.equal(prod01.unit_price, 89.99);

    // Update product price
    runtime.update("products", "prod_01", { unit_price: 109.99 });
    const updatedProd = runtime.records("products").find((p) => p.id === "prod_01");
    assert.equal(updatedProd.unit_price, 109.99);

    // Existing order line retains its snapshotted unit_price and evaluates computed line_total
    const line01 = runtime.get("order_lines", "line_01");
    assert.equal(line01.unit_price, 89.99);
    assert.equal(line01.line_total, 269.97);
  });

  await t.test("5. Arithmetic & Compiler Gaps Audit (Verified Exact Algebra & Remaining Gaps)", () => {
    // 1. QUANTITY_MONEY_MULTIPLICATION_GAP: NOW CLOSED
    // Test that declaring computed="quantity * unit_price" compiles and evaluates cleanly
    const multiplicationAir = `air version=2
app test_gap
resource products label=name
field products.name text required
field products.unit_price money currency=USD required default=10
manage products lifecycle=archive
access products view=role:admin edit=role:admin
resource order_lines label=quantity
field order_lines.quantity integer required default=3
field order_lines.unit_price money currency=USD required default=15
field order_lines.line_total money currency=USD computed="quantity * unit_price"
manage order_lines lifecycle=archive
access order_lines view=role:admin edit=role:admin
`;
    const multModel = parseAir(multiplicationAir);
    const multRuntime = new AppRuntime(multModel, {
      seedData: { order_lines: [{ id: "l1", quantity: 3, unit_price: 15 }] },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });
    const line = multRuntime.get("order_lines", "l1");
    assert.equal(line.line_total, 45, "quantity * unit_price evaluates to exact money");

    // 2. RELATED_LINE_ITEM_AGGREGATION_GAP: NOW CLOSED
    // In AIR, computed expressions support reverse relation aggregation: sum(order_lines.line_total)
    const aggregationAir = `air version=2
app test_gap
resource orders label=order_number
field orders.order_number text required
field orders.subtotal money currency=USD computed="sum(order_lines.line_total)"
manage orders lifecycle=archive
access orders view=role:admin edit=role:admin
resource order_lines label=order
field order_lines.order ref=orders required
field order_lines.line_total money currency=USD required default=20
manage order_lines lifecycle=delete
access order_lines view=role:admin edit=role:admin
`;
    const aggModel = parseAir(aggregationAir);
    const aggRuntime = new AppRuntime(aggModel, {
      seedData: {
        orders: [{ id: "o1", order_number: "ORD-1" }],
        order_lines: [
          { id: "l1", order: "o1", line_total: 25.5 },
          { id: "l2", order: "o1", line_total: 14.5 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });
    const orderWithSubtotal = aggRuntime.get("orders", "o1");
    assert.equal(orderWithSubtotal.subtotal, 40, "sum(order_lines.line_total) aggregates child line items into exact subtotal");

    // 3. PERCENT_MONEY_ARITHMETIC_GAP & RATIO_MONEY_MULTIPLICATION_GAP: NOW CLOSED
    // Test that declaring discount as subtotal * 10% compiles and evaluates cleanly
    const percentAir = `air version=2
app test_gap
resource orders label=order_number
field orders.order_number text required
field orders.subtotal money currency=USD required default=100
field orders.discount money currency=USD computed="subtotal * 10%"
manage orders lifecycle=archive
access orders view=role:admin edit=role:admin
`;
    const pctModel = parseAir(percentAir);
    const pctRuntime = new AppRuntime(pctModel, {
      seedData: { orders: [{ id: "o1", order_number: "ORD-1", subtotal: 250 }] },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });
    const pctOrder = pctRuntime.get("orders", "o1");
    assert.equal(pctOrder.discount, 25, "subtotal * 10% evaluates to exact $25.00");

    // 4. INVALID TYPE COMBINATIONS: STRICTLY REJECTED
    const invalidMoneyMoney = `air version=2
app test_gap
resource orders label=order_number
field orders.order_number text required
field orders.subtotal money currency=USD required default=100
field orders.tax money currency=USD required default=10
field orders.bad money currency=USD computed="subtotal * tax"
manage orders lifecycle=archive
access orders view=role:admin edit=role:admin
`;
    assert.throws(
      () => parseAir(invalidMoneyMoney),
      /AIR_TYPE_COMPUTED_MISMATCH|cannot multiply \`money\` and \`money\`/,
      "Compiler must reject money * money multiplication"
    );
  });

  await t.test("6. Order Lifecycle & State Machine Transitions", () => {
    const runtime = createTestRuntime(airSource, seedSource, { roles: ["operator"] });

    // ord_02 is Submitted
    const allocateRes = runtime.transition("orders", "ord_02", "allocate");
    assert.equal(allocateRes.record.status, "Allocated");

    // Partial fulfillment transition
    const partialRes = runtime.transition("orders", "ord_02", "partial_fulfill");
    assert.equal(partialRes.record.status, "PartiallyFulfilled");

    // Complete fulfillment transition
    const fulfillRes = runtime.transition("orders", "ord_02", "fulfill");
    assert.equal(fulfillRes.record.status, "Fulfilled");

    // Cancellation of a draft order
    const draftOrder = runtime.create("orders", {
      order_number: "ORD-2026-9999",
      customer: "cust_01",
      status: "Draft",
      subtotal: 100,
      total: 100
    }).record;
    const cancelRes = runtime.transition("orders", draftOrder.id, "cancel", { comment: "Customer changed mind" });
    assert.equal(cancelRes.record.status, "Cancelled");
  });

  await t.test("7. Warehouse Transfers & Return Workflows", () => {
    const runtime = createTestRuntime(airSource, seedSource, { roles: ["operator"] });

    // Transfer lifecycle: Requested -> InTransit -> Completed
    const trf = runtime.create("transfers", {
      product: "prod_02",
      source_warehouse: "wh_01",
      destination_warehouse: "wh_02",
      quantity: 5,
      status: "Requested"
    }).record;

    const dispatchRes = runtime.transition("transfers", trf.id, "dispatch");
    assert.equal(dispatchRes.record.status, "InTransit");

    const completeRes = runtime.transition("transfers", trf.id, "complete");
    assert.equal(completeRes.record.status, "Completed");

    // Return lifecycle: Pending -> Received -> Inspected -> Restocked
    const ret = runtime.create("returns", {
      order: "ord_01",
      product: "prod_02",
      quantity: 1,
      reason: "Defective",
      status: "Pending"
    }).record;

    const recvRes = runtime.transition("returns", ret.id, "receive");
    assert.equal(recvRes.record.status, "Received");

    const inspRes = runtime.transition("returns", ret.id, "inspect");
    assert.equal(inspRes.record.status, "Inspected");

    const restockRes = runtime.transition("returns", ret.id, "restock");
    assert.equal(restockRes.record.status, "Restocked");
  });

  await t.test("8. Visualizations & Analytics Compilation", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    // Chart 1: Stock by Warehouse
    const stockByWh = compileVisualizationIR({
      title: "Stock by Warehouse",
      dimension: "warehouse",
      measure: "quantity_on_hand",
      aggregate: "sum",
      intent: VISUAL_INTENTS.COMPARE
    }, runtime.records("inventory_balances"));
    assert.equal(stockByWh.intent, VISUAL_INTENTS.COMPARE);
    assert.ok(stockByWh.exactData.length > 0);
    assert.equal(stockByWh.grandTotal, 261);

    // Chart 2: Products by Category
    const prodByCat = compileVisualizationIR({
      title: "Products by Category",
      dimension: "category",
      measure: "id",
      aggregate: "count",
      intent: VISUAL_INTENTS.COMPOSITION
    }, runtime.records("products"));
    assert.equal(prodByCat.intent, VISUAL_INTENTS.COMPOSITION);
    assert.ok(prodByCat.exactData.length > 0);

    // Chart 3: Orders by Status
    const ordersByStatus = compileVisualizationIR({
      title: "Orders by Status",
      dimension: "status",
      measure: "id",
      aggregate: "count",
      intent: VISUAL_INTENTS.COMPARE
    }, runtime.records("orders"));
    assert.equal(ordersByStatus.intent, VISUAL_INTENTS.COMPARE);
    assert.ok(ordersByStatus.exactData.length > 0);

    // Chart 4: Total Billed Revenue (Money aggregation)
    const revenueViz = compileVisualizationIR({
      title: "Revenue by Order Status",
      dimension: "status",
      measure: "total",
      aggregate: "sum",
      format: "currency",
      currency: "USD",
      intent: VISUAL_INTENTS.COMPARE
    }, runtime.query("orders", { paginate: false }).records);
    assert.ok(revenueViz.grandTotal > 0);
    assert.equal(revenueViz.formattedGrandTotal, "$3,345.79");
  });

  await t.test("9. Responsive Recomposition & Zero Visual Regression", () => {
    const runtime = createTestRuntime(airSource, seedSource);
    const viewports = [1440, 1024, 768, 500, 390, 320];

    for (const vp of viewports) {
      const viz = compileVisualizationIR({
        dimension: "warehouse",
        measure: "quantity_on_hand",
        aggregate: "sum",
        intent: VISUAL_INTENTS.COMPARE,
        containerWidth: vp
      }, runtime.records("inventory_balances"));

      if (vp >= 640) {
        assert.equal(viz.representation, DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR);
      } else if (vp >= 420) {
        assert.equal(viz.representation, DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR);
      } else {
        assert.equal(viz.representation, DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_BAR);
      }

      const model = parseAir(airSource);
      const wfGraph = compileWorkflowGraph(model.processes.get("orders"), "Draft", { containerWidth: vp });
      if (vp < 480) {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.VERTICAL_STATE_PATH);
      } else if (vp < 768) {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.COMPACT_WORKFLOW_GRAPH);
      } else {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.SPATIAL_WORKFLOW_GRAPH);
      }
    }
  });

  await t.test("10. Modification Compression Scenarios (MOD1 - MOD5)", () => {
    // MOD 1: "Change reorder level for Product X from 5 to 10"
    const mod1Patch = `set field inventory_balances.reorder_level default=10`;
    const mod1Tokens = tokenizeLine(mod1Patch, 1).length;
    assert.equal(mod1Tokens, 4);

    // MOD 2: "Add a 10% discount to this order"
    // Fails because ratio/percent money arithmetic is unsupported
    // Documented as PERCENT_MONEY_ARITHMETIC_GAP

    // MOD 3: "Prevent an order from being submitted if any line quantity exceeds available stock"
    // Fails because cross-resource child collection queries are unsupported in invariants
    // Documented as CHILD_COLLECTION_GUARD_GAP & CROSS_RESOURCE_INVENTORY_CONSTRAINT_GAP

    // MOD 4: "Show only low-stock inventory items"
    const mod4Patch = `add highlight inventory_balances.low_stock when="quantity_on_hand<=reorder_level&quantity_on_hand>0" tone=warning`;
    const mod4Tokens = tokenizeLine(mod4Patch, 1).length;
    assert.equal(mod4Tokens, 5);

    // MOD 5: "Change the stock chart from grouping by warehouse to grouping by product category"
    const mod5Patch = `set insight inventory_balances.by_warehouse group=product label="Stock by Product"`;
    const mod5Tokens = tokenizeLine(mod5Patch, 1).length;
    assert.equal(mod5Tokens, 5);
  });
});
