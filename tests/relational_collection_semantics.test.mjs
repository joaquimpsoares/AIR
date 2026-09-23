import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAir, AppRuntime, AirError, MemoryStorage } from "../web/runtime/air.mjs";

describe("RELATIONAL COLLECTION SEMANTICS v1 Test Suite", async () => {

  await it("1. Reverse Relationship Discovery & Basic Aggregates (sum, count, min, max, avg)", () => {
    const airSource = `air version=2
app test_relational
resource orders label=order_number
field orders.order_number text required
field orders.line_count integer computed="count(order_lines)"
field orders.subtotal money currency=USD computed="sum(order_lines.line_total)"
field orders.min_line money currency=USD computed="min(order_lines.line_total)"
field orders.max_line money currency=USD computed="max(order_lines.line_total)"
field orders.avg_line money currency=USD computed="avg(order_lines.line_total)"
manage orders lifecycle=archive
access orders view=role:admin edit=role:admin

resource order_lines label=order
field order_lines.order ref=orders required
field order_lines.quantity integer required default=1
field order_lines.unit_price money currency=USD required default=0
field order_lines.line_total money currency=USD computed="quantity * unit_price"
manage order_lines lifecycle=delete
access order_lines view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        orders: [{ id: "o1", order_number: "ORD-001" }, { id: "o2", order_number: "ORD-002" }],
        order_lines: [
          { id: "l1", order: "o1", quantity: 2, unit_price: 10.50 }, // 21.00
          { id: "l2", order: "o1", quantity: 1, unit_price: 9.50 },  // 9.50
          { id: "l3", order: "o1", quantity: 3, unit_price: 20.00 }, // 60.00
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    const o1 = runtime.get("orders", "o1");
    assert.equal(o1.line_count, 3, "count(order_lines) equals 3");
    assert.equal(o1.subtotal, 90.50, "sum(order_lines.line_total) equals 90.50 (21.00 + 9.50 + 60.00)");
    assert.equal(o1.min_line, 9.50, "min(order_lines.line_total) equals 9.50");
    assert.equal(o1.max_line, 60.00, "max(order_lines.line_total) equals 60.00");
    // avg = 90.50 / 3 = 30.1666... with half-away-from-zero rounding -> 30.17
    assert.equal(o1.avg_line, 30.17, "avg(order_lines.line_total) equals exact rounded 30.17");

    // Empty order (o2)
    const o2 = runtime.get("orders", "o2");
    assert.equal(o2.line_count, 0, "count of empty collection is 0");
    assert.equal(o2.subtotal, 0, "sum of empty collection is 0");
    assert.equal(o2.min_line, null, "min of empty collection is null");
    assert.equal(o2.max_line, null, "max of empty collection is null");
    assert.equal(o2.avg_line, null, "avg of empty collection is null");
  });

  await it("2. Exact Minor-Unit Money Arithmetic with Zero Binary Float Drift", () => {
    const airSource = `air version=2
app test_drift
resource invoices label=number
field invoices.number text required
field invoices.total money currency=USD computed="sum(invoice_items.amount)"
manage invoices lifecycle=archive
access invoices view=role:admin edit=role:admin

resource invoice_items label=invoice
field invoice_items.invoice ref=invoices required
field invoice_items.amount money currency=USD required
manage invoice_items lifecycle=delete
access invoice_items view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    // 0.1 + 0.2 in standard JS float is 0.30000000000000004
    const runtime = new AppRuntime(model, {
      seedData: {
        invoices: [{ id: "inv1", number: "INV-1" }],
        invoice_items: [
          { id: "i1", invoice: "inv1", amount: 0.10 },
          { id: "i2", invoice: "inv1", amount: 0.20 },
          { id: "i3", invoice: "inv1", amount: 0.03 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    const inv = runtime.get("invoices", "inv1");
    assert.strictEqual(inv.total, 0.33, "Exact minor-unit sum eliminates binary float drift");
  });

  await it("3. Filtered Child Aggregates (where condition in aggregate)", () => {
    const airSource = `air version=2
app test_filtered_agg
resource orders label=order_number
field orders.order_number text required
field orders.active_total money currency=USD computed="sum(order_lines.line_total where status!=Cancelled)"
field orders.fulfilled_count integer computed="count(order_lines where status==Fulfilled)"
manage orders lifecycle=archive
access orders view=role:admin edit=role:admin

resource order_lines label=order
field order_lines.order ref=orders required
field order_lines.line_total money currency=USD required
field order_lines.status enum values=Pending,Fulfilled,Cancelled required default=Pending
manage order_lines lifecycle=delete
access order_lines view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        orders: [{ id: "o1", order_number: "ORD-1" }],
        order_lines: [
          { id: "l1", order: "o1", line_total: 50.00, status: "Fulfilled" },
          { id: "l2", order: "o1", line_total: 30.00, status: "Pending" },
          { id: "l3", order: "o1", line_total: 100.00, status: "Cancelled" }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    const o1 = runtime.get("orders", "o1");
    assert.equal(o1.active_total, 80.00, "active_total filters out Cancelled line item");
    assert.equal(o1.fulfilled_count, 1, "fulfilled_count matches only Fulfilled line items");
  });

  await it("4. Compound Expressions Involving Collection Aggregates", () => {
    const airSource = `air version=2
app test_compound_agg
resource orders label=order_number
field orders.order_number text required
field orders.discount_rate ratio required default=10%
field orders.shipping_fee money currency=USD required default=15.00
field orders.grand_total money currency=USD computed="sum(order_lines.line_total) * (1 - discount_rate) + shipping_fee"
manage orders lifecycle=archive
access orders view=role:admin edit=role:admin

resource order_lines label=order
field order_lines.order ref=orders required
field order_lines.line_total money currency=USD required
manage order_lines lifecycle=delete
access order_lines view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        orders: [{ id: "o1", order_number: "ORD-1", discount_rate: "10%", shipping_fee: 15.00 }],
        order_lines: [
          { id: "l1", order: "o1", line_total: 60.00 },
          { id: "l2", order: "o1", line_total: 40.00 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    const o1 = runtime.get("orders", "o1");
    // sum = 100, discounted = 100 * 0.9 = 90, grand_total = 90 + 15 = 105
    assert.equal(o1.grand_total, 105.00, "Compound expression with aggregate, ratio arithmetic, and money addition evaluates accurately");
  });

  await it("5. Quantifiers in Workflow State Machine Transition Guards (all, any, none)", () => {
    const airSource = `air version=2
app test_quantifiers
resource orders label=order_number
field orders.order_number text required
field orders.status enum values=Draft,Submitted,Allocated,Fulfilled,Cancelled required default=Draft
manage orders lifecycle=archive
access orders view=role:operator edit=role:operator
process orders state=status initial=Draft terminal=Fulfilled,Cancelled history
transition orders.submit from=Draft to=Submitted action=submit by=role:operator when="count(order_lines) > 0"
transition orders.allocate from=Submitted to=Allocated action=allocate by=role:operator
transition orders.fulfill from=Submitted,Allocated to=Fulfilled action=fulfill by=role:operator when="all(order_lines where status==Fulfilled)"
transition orders.cancel from=Draft,Submitted,Allocated to=Cancelled action=cancel by=role:operator when="none(order_lines where status==Fulfilled)"

resource order_lines label=order
field order_lines.order ref=orders required
field order_lines.status enum values=Pending,Allocated,Fulfilled,Cancelled required default=Pending
manage order_lines lifecycle=delete
access order_lines view=role:operator edit=role:operator
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        orders: [
          { id: "o_empty", order_number: "ORD-EMPTY", status: "Draft" },
          { id: "o_partial", order_number: "ORD-PARTIAL", status: "Submitted" },
          { id: "o_ready", order_number: "ORD-READY", status: "Submitted" }
        ],
        order_lines: [
          { id: "l1", order: "o_partial", status: "Fulfilled" },
          { id: "l2", order: "o_partial", status: "Pending" },
          { id: "l3", order: "o_ready", status: "Fulfilled" },
          { id: "l4", order: "o_ready", status: "Fulfilled" }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["operator"] }
    });

    // 1. Submit on empty order fails because count(order_lines) > 0 is not satisfied
    assert.throws(() => {
      runtime.transition("orders", "o_empty", "submit");
    }, /cannot submit|condition/i, "Empty order cannot be submitted when count(order_lines) > 0 is required");

    // 2. Fulfill on partial order fails because not all lines are Fulfilled
    assert.throws(() => {
      runtime.transition("orders", "o_partial", "fulfill");
    }, /cannot fulfill|condition/i, "Partially fulfilled order cannot transition to Fulfilled when all() guard is not met");

    // 3. Fulfill on ready order succeeds because all lines are Fulfilled
    const fulfillRes = runtime.transition("orders", "o_ready", "fulfill");
    assert.equal(fulfillRes.record.status, "Fulfilled", "Order with all lines fulfilled transitions to Fulfilled");

    // 4. Cancel on partial order fails because none(status==Fulfilled) fails (l1 is Fulfilled)
    assert.throws(() => {
      runtime.transition("orders", "o_partial", "cancel");
    }, /cannot cancel|condition/i, "Order cannot be cancelled when none(status==Fulfilled) is violated");
  });

  await it("6. Empty Collection Semantics (vacuous truth for all, false for any, true for none)", () => {
    const airSource = `air version=2
app test_vacuous
resource projects label=name
field projects.name text required
field projects.status enum values=Active,Completed,Archived required default=Active
manage projects lifecycle=archive
access projects view=role:admin edit=role:admin
process projects state=status initial=Active terminal=Completed,Archived history
transition projects.complete from=Active to=Completed action=complete by=role:admin when="all(tasks where status==Done)"
transition projects.archive from=Active to=Archived action=archive by=role:admin when="none(tasks where status==InProgress)"

resource tasks label=title
field tasks.project ref=projects required
field tasks.title text required
field tasks.status enum values=Todo,InProgress,Done required default=Todo
manage tasks lifecycle=delete
access tasks view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        projects: [{ id: "p_empty", name: "Empty Project", status: "Active" }],
        tasks: []
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    // In classical mathematical logic:
    // all(empty) is VACUOUSLY TRUE
    // none(empty) is TRUE
    const completeRes = runtime.transition("projects", "p_empty", "complete");
    assert.equal(completeRes.record.status, "Completed", "all(empty) evaluates to true (vacuous truth)");

    // Reset and test none(empty)
    runtime.reset();
    const archiveRes = runtime.transition("projects", "p_empty", "archive");
    assert.equal(archiveRes.record.status, "Archived", "none(empty) evaluates to true");
  });

  await it("7. Generic Cross-Resource Lookups with one(...) and Cardinality Enforcement", () => {
    const airSource = `air version=2
app test_lookup_cardinality
resource products label=name
field products.sku text required unique
field products.name text required
manage products lifecycle=archive
access products view=role:admin edit=role:admin

resource inventory_balances label=product
field inventory_balances.product ref=products required
field inventory_balances.warehouse text required
field inventory_balances.quantity_on_hand integer required default=0
manage inventory_balances lifecycle=archive
access inventory_balances view=role:admin edit=role:admin

resource order_lines label=product
field order_lines.product ref=products required
field order_lines.warehouse text required
field order_lines.available_stock integer computed="one(inventory_balances where product==product&warehouse==warehouse).quantity_on_hand"
manage order_lines lifecycle=delete
access order_lines view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        products: [
          { id: "p1", sku: "SKU-1", name: "Widget A" },
          { id: "p2", sku: "SKU-2", name: "Widget B" },
          { id: "p_dup", sku: "SKU-DUP", name: "Widget Dup" }
        ],
        inventory_balances: [
          { id: "ib1", product: "p1", warehouse: "W1", quantity_on_hand: 42 },
          // ib_dup1 and ib_dup2 will create cardinality error for p_dup at W1
          { id: "ib_dup1", product: "p_dup", warehouse: "W1", quantity_on_hand: 10 },
          { id: "ib_dup2", product: "p_dup", warehouse: "W1", quantity_on_hand: 20 }
        ],
        order_lines: [
          { id: "ol_match", product: "p1", warehouse: "W1" },
          { id: "ol_missing", product: "p2", warehouse: "W1" },
          { id: "ol_dup", product: "p_dup", warehouse: "W1" }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    // 1. Single match: returns quantity_on_hand = 42
    const matchLine = runtime.get("order_lines", "ol_match");
    assert.equal(matchLine.available_stock, 42, "one(...) matches single record and extracts field");

    // 2. Zero match: returns null
    const missingLine = runtime.get("order_lines", "ol_missing");
    assert.equal(missingLine.available_stock, null, "one(...) with 0 matches evaluates to null without throwing");

    // 3. Multiple matches: throws AIR_CARDINALITY_ERROR
    assert.throws(() => {
      runtime.get("order_lines", "ol_dup");
    }, (err) => {
      return err instanceof AirError && err.code === "AIR_CARDINALITY_ERROR";
    }, "one(...) with > 1 matches throws AIR_CARDINALITY_ERROR");
  });

  await it("8. Composite Unique Constraints (Declaration, Creation, Update Self-Exclusion & Non-Null Policy)", () => {
    const airSource = `air version=2
app test_composite_unique
resource inventory_balances label=product
field inventory_balances.product text required
field inventory_balances.warehouse text required
field inventory_balances.quantity integer required default=0
unique inventory_balances.product_warehouse fields=product,warehouse deny="Product already exists in this warehouse"
manage inventory_balances lifecycle=archive
access inventory_balances view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        inventory_balances: [
          { id: "ib1", product: "PROD-1", warehouse: "WH-A", quantity: 100 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    // 1. Creation with duplicate composite key fails
    const dupRes = runtime.create("inventory_balances", { product: "PROD-1", warehouse: "WH-A", quantity: 50 });
    assert.equal(dupRes.record, null);
    assert.ok(dupRes.errors.product || dupRes.errors.product_warehouse, "Duplicate composite key is rejected on create");

    // 2. Creation with different warehouse succeeds
    const newRes = runtime.create("inventory_balances", { product: "PROD-1", warehouse: "WH-B", quantity: 50 });
    assert.ok(newRes.record);
    assert.equal(newRes.record.warehouse, "WH-B");

    // 3. Update self-exclusion: updating quantity on ib1 without changing product/warehouse succeeds
    const updateSelf = runtime.update("inventory_balances", "ib1", { quantity: 120 });
    assert.ok(updateSelf.record);
    assert.equal(updateSelf.record.quantity, 120, "Updating record without changing composite key excludes itself from conflict");

    // 4. Update to conflict with another record fails
    const updateConflict = runtime.update("inventory_balances", newRes.record.id, { warehouse: "WH-A" });
    assert.equal(updateConflict.record, null);
    assert.ok(updateConflict.errors.product || updateConflict.errors.product_warehouse, "Updating composite key to match existing record is rejected");
  });

  await it("9. Reactive Propagation Across Collection Mutations", () => {
    const airSource = `air version=2
app test_reactive_prop
resource orders label=order_number
field orders.order_number text required
field orders.subtotal money currency=USD computed="sum(order_lines.line_total)"
manage orders lifecycle=archive
access orders view=role:admin edit=role:admin

resource order_lines label=order
field order_lines.order ref=orders required
field order_lines.line_total money currency=USD required
manage order_lines lifecycle=delete
access order_lines view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        orders: [{ id: "o1", order_number: "ORD-1" }],
        order_lines: [
          { id: "l1", order: "o1", line_total: 50.00 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    assert.equal(runtime.get("orders", "o1").subtotal, 50.00);

    // Create a new line
    const l2 = runtime.create("order_lines", { order: "o1", line_total: 25.00 });
    assert.equal(runtime.get("orders", "o1").subtotal, 75.00, "Subtotal updates reactively on line creation");

    // Update line total
    runtime.update("order_lines", l2.record.id, { line_total: 35.00 });
    assert.equal(runtime.get("orders", "o1").subtotal, 85.00, "Subtotal updates reactively on line update");

    // Delete line
    runtime.delete("order_lines", l2.record.id);
    assert.equal(runtime.get("orders", "o1").subtotal, 50.00, "Subtotal updates reactively on line deletion");
  });

  await it("10. Dependency Recursion Cycle Detection (AIR_CYCLE_DETECTED)", () => {
    const airSource = `air version=2
app test_cycle
resource nodes label=name
field nodes.name text required
field nodes.parent ref=nodes
field nodes.val_a integer computed="val_b + 1"
field nodes.val_b integer computed="val_a + 1"
manage nodes lifecycle=archive
access nodes view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        nodes: [{ id: "n1", name: "Node 1" }]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    assert.throws(() => {
      runtime.get("nodes", "n1");
    }, (err) => {
      return err instanceof AirError && (err.code === "AIR_CYCLE_DETECTED" || err.message.includes("cycle"));
    }, "Direct or indirect cyclic computation stack throws AIR_CYCLE_DETECTED");
  });

  await it("11. Security and Authority Filtering in Collection Queries vs Canonical Internal Aggregation", () => {
    const airSource = `air version=2
app test_security_agg
resource accounts label=name
field accounts.name text required
field accounts.total_balance money currency=USD computed="sum(transactions.amount)"
manage accounts lifecycle=archive
access accounts view=role:admin|role:user edit=role:admin

resource transactions label=account
field transactions.account ref=accounts required
field transactions.amount money currency=USD required
field transactions.is_confidential bool required default=false
manage transactions lifecycle=archive
access transactions view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtimeAdmin = new AppRuntime(model, {
      seedData: {
        accounts: [{ id: "acc1", name: "Account 1" }],
        transactions: [
          { id: "t1", account: "acc1", amount: 100.00 },
          { id: "t2", account: "acc1", amount: 200.00, _archived_at: "2026-01-01T00:00:00Z" } // Archived
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    const accAdmin = runtimeAdmin.get("accounts", "acc1");
    assert.equal(accAdmin.total_balance, 100.00, "Archived transactions are excluded from aggregate");

    // Runtime with user role (can view accounts, cannot view transactions)
    const runtimeUser = new AppRuntime(model, {
      seedData: {
        accounts: [{ id: "acc1", name: "Account 1" }],
        transactions: [
          { id: "t1", account: "acc1", amount: 100.00 },
          { id: "t2", account: "acc1", amount: 200.00, _archived_at: "2026-01-01T00:00:00Z" }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["user"] }
    });

    // Semantic Internal Read Scope: Parent computed field reflects canonical truth ($100.00)
    const accUser = runtimeUser.get("accounts", "acc1");
    assert.equal(accUser.total_balance, 100.00, "Parent computed aggregate reflects authoritative canonical calculation");

    // Actor Presentation / Query Scope: User cannot query or read individual transaction records
    const userTxQuery = runtimeUser.query("transactions");
    assert.equal(userTxQuery.records.length, 0, "Actor presentation query does not return unauthorized child records");
    assert.equal(runtimeUser.get("transactions", "t1"), null, "Actor direct get returns null for unauthorized child record");
  });

  await it("12. Multi-Domain Genericity (Inventory Hub, Hotel Booking, Clinic, Manufacturing BOM)", () => {
    // Hotel booking: room bill aggregation
    const hotelAir = `air version=2
app hotel_booking
resource bookings label=guest_name
field bookings.guest_name text required
field bookings.total_bill money currency=USD computed="sum(charges.amount)"
manage bookings lifecycle=archive
access bookings view=role:clerk edit=role:clerk

resource charges label=booking
field charges.booking ref=bookings required
field charges.description text required
field charges.amount money currency=USD required
manage charges lifecycle=delete
access charges view=role:clerk edit=role:clerk
`;
    const hotelModel = parseAir(hotelAir);
    const hotelRuntime = new AppRuntime(hotelModel, {
      seedData: {
        bookings: [{ id: "b1", guest_name: "John Doe" }],
        charges: [
          { id: "c1", booking: "b1", description: "Room Night 1", amount: 150.00 },
          { id: "c2", booking: "b1", description: "Room Service", amount: 45.50 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["clerk"] }
    });
    assert.equal(hotelRuntime.get("bookings", "b1").total_bill, 195.50, "Hotel booking domain bill aggregation works generically");

    // Manufacturing BOM: parts count and total cost
    const bomAir = `air version=2
app manufacturing_bom
resource assemblies label=name
field assemblies.name text required
field assemblies.part_count integer computed="count(assembly_items)"
field assemblies.total_cost money currency=USD computed="sum(assembly_items.item_cost)"
manage assemblies lifecycle=archive
access assemblies view=role:engineer edit=role:engineer

resource assembly_items label=assembly
field assembly_items.assembly ref=assemblies required
field assembly_items.qty integer required default=1
field assembly_items.cost_each money currency=USD required default=0
field assembly_items.item_cost money currency=USD computed="qty * cost_each"
manage assembly_items lifecycle=delete
access assembly_items view=role:engineer edit=role:engineer
`;
    const bomModel = parseAir(bomAir);
    const bomRuntime = new AppRuntime(bomModel, {
      seedData: {
        assemblies: [{ id: "a1", name: "Drone Motor Unit" }],
        assembly_items: [
          { id: "ai1", assembly: "a1", qty: 4, cost_each: 12.50 }, // 50.00
          { id: "ai2", assembly: "a1", qty: 1, cost_each: 30.00 }  // 30.00
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["engineer"] }
    });
    const drone = bomRuntime.get("assemblies", "a1");
    assert.equal(drone.part_count, 2, "BOM part count is 2");
    assert.equal(drone.total_cost, 80.00, "BOM total cost is $80.00");
  });

  await it("13. Hidden OrderLine Subtotal Proof", () => {
    const airSource = `air version=2
app test_hidden_order_line
resource orders label=order_number
field orders.order_number text required
field orders.subtotal money currency=USD computed="sum(order_lines.line_total)"
manage orders lifecycle=archive
access orders view=role:customer|role:admin edit=role:admin

resource order_lines label=order
field order_lines.order ref=orders required
field order_lines.line_total money currency=USD required
manage order_lines lifecycle=delete
access order_lines view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        orders: [{ id: "o1", order_number: "ORD-100" }],
        order_lines: [
          { id: "ol1", order: "o1", line_total: 45.00 },
          { id: "ol2", order: "o1", line_total: 55.00 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["customer"] }
    });

    // Customer can view orders, but not order_lines
    const order = runtime.get("orders", "o1");
    assert.equal(order.subtotal, 100.00, "Order subtotal reflects full canonical $100.00 despite hidden lines");
    assert.equal(runtime.query("order_lines").records.length, 0, "Querying order_lines directly returns empty for customer");
  });

  await it("14. Hidden Composite Unique Conflict Proof", () => {
    const airSource = `air version=2
app test_hidden_unique
resource balances label=sku
field balances.sku text required
field balances.warehouse text required
unique balances.sku_wh fields=sku,warehouse deny="Duplicate SKU and Warehouse"
manage balances lifecycle=archive
access balances view=role:admin edit=role:clerk|role:admin create=role:clerk|role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        balances: [
          { id: "b1", sku: "WIDGET-1", warehouse: "MAIN" }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["clerk"] }
    });

    // Clerk cannot view existing balances, but tries to create a duplicate
    assert.equal(runtime.query("balances").records.length, 0, "Clerk cannot browse balances");
    const res = runtime.create("balances", { sku: "WIDGET-1", warehouse: "MAIN" });
    assert.equal(res.record, null, "Creation is rejected due to canonical uniqueness violation");
    assert.ok(res.errors.sku || res.errors.sku_wh, "Returns error for duplicate composite key");
  });

  await it("15. Hidden Child Workflow Guard Proof", () => {
    const airSource = `air version=2
app test_hidden_guard
resource orders label=order_number
field orders.order_number text required
field orders.status enum values=draft,ready,shipped required default=draft
process orders state=status initial=draft terminal=shipped history
transition orders.prepare from=draft to=ready action=prepare by=role:staff
transition orders.ship from=ready to=shipped action=ship by=role:staff when="all(items where packed==true)"
manage orders lifecycle=archive
access orders view=role:staff edit=role:staff

resource items label=order
field items.order ref=orders required
field items.packed bool required default=false
manage items lifecycle=delete
access items view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        orders: [{ id: "o1", order_number: "ORD-200", status: "ready" }],
        items: [
          { id: "i1", order: "o1", packed: true },
          { id: "i2", order: "o1", packed: false }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["staff"] }
    });

    // Staff tries to execute action `ship`. Staff cannot view items, but guard evaluates canonical items
    assert.equal(runtime.query("items").records.length, 0, "Staff cannot browse items directly");
    assert.throws(() => {
      runtime.transition("orders", "o1", "ship");
    }, /cannot ship|condition/i, "Guard evaluation fails because hidden item i2 is not packed");
  });

});

