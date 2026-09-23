import test from "node:test";
import assert from "node:assert/strict";
import { parseAir, AppRuntime, MemoryStorage, Ratio, parseRatioOrPercentLiteral } from "../web/runtime/air.mjs";

test("EXACT QUANTITY & MONEY ALGEBRA v1 Test Suite", async (t) => {
  await t.test("1. Discrete Integer Type Semantics & Rejection of Fractional Values", () => {
    const airSource = `air version=2
app test_integers
resource stock_levels label=sku
field stock_levels.sku text required
field stock_levels.count integer required default=0 min=0 max=1000
manage stock_levels lifecycle=archive
access stock_levels view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    assert.equal(model.entities.get("stock_levels").fieldMap.get("count").type, "integer");

    const runtime = new AppRuntime(model, {
      seedData: { stock_levels: [{ id: "s1", sku: "SKU-001", count: 42 }] },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    const s1 = runtime.get("stock_levels", "s1");
    assert.equal(s1.count, 42);

    // Valid integer creation
    const created = runtime.create("stock_levels", { sku: "SKU-002", count: 150 });
    assert.equal(created.record.count, 150);

    // Rejection of fractional floats in integer field
    const resFloat = runtime.create("stock_levels", { sku: "SKU-003", count: 12.5 });
    assert.equal(resFloat.record, null);
    assert.match(resFloat.errors.count, /must be a valid safe integer|must be an integer/);

    // Rejection of string containing fractional float in integer field
    const resStrFloat = runtime.create("stock_levels", { sku: "SKU-004", count: "3.1415" });
    assert.equal(resStrFloat.record, null);
    assert.match(resStrFloat.errors.count, /must be an integer/);

    // Rejection of bounds violation (below min=0 or above max=1000)
    const resMin = runtime.create("stock_levels", { sku: "SKU-005", count: -5 });
    assert.equal(resMin.record, null);
    assert.match(resMin.errors.count, /must be at least 0/);

    const resMax = runtime.create("stock_levels", { sku: "SKU-006", count: 1005 });
    assert.equal(resMax.record, null);
    assert.match(resMax.errors.count, /cannot be greater than 1000/);

    // Large safe integer verification
    const safeBigAir = `air version=2
app test_safe_integers
resource metrics label=name
field metrics.name text required
field metrics.huge integer required
manage metrics lifecycle=archive
access metrics view=role:admin edit=role:admin
`;
    const safeRuntime = new AppRuntime(parseAir(safeBigAir), { storage: new MemoryStorage(), principal: { roles: ["admin"] } });
    const hugeNum = 9007199254740991; // Number.MAX_SAFE_INTEGER
    const bigRec = safeRuntime.create("metrics", { name: "Big", huge: hugeNum });
    assert.equal(bigRec.record.huge, hugeNum);
  });

  await t.test("2. Exact Ratio Type, Percentage Literals, and Fraction Arithmetic", () => {
    // Exact Ratio construction & GCD simplification
    const r1 = new Ratio(10n, 100n); // 10% -> 1/10
    assert.equal(r1.numerator, 1n);
    assert.equal(r1.denominator, 10n);
    assert.equal(r1.toPercentage(), 10);
    assert.equal(r1.toString(), "10%");

    const r2 = parseRatioOrPercentLiteral("7.5%"); // 7.5% -> 75/1000 -> 3/40
    assert.equal(r2.numerator, 3n);
    assert.equal(r2.denominator, 40n);
    assert.equal(r2.toPercentage(), 7.5);

    const r3 = parseRatioOrPercentLiteral("33.333%");
    assert.equal(r3.numerator, 33333n);
    assert.equal(r3.denominator, 100000n);

    const r4 = parseRatioOrPercentLiteral("1/3"); // Exact 1/3 fraction
    assert.equal(r4.numerator, 1n);
    assert.equal(r4.denominator, 3n);
    assert.equal(r4.toRatio(), 1 / 3);
    assert.equal(r4.toString(), "33.33%");

    // Zero denominator rejected
    assert.throws(() => new Ratio(10n, 0n), /Ratio denominator cannot be zero/);

    // Ratio field parsing in AIR model
    const airRatio = `air version=2
app test_ratios
resource taxes label=name
field taxes.name text required
field taxes.rate ratio required default="15%"
manage taxes lifecycle=archive
access taxes view=role:admin edit=role:admin
`;
    const ratioModel = parseAir(airRatio);
    assert.equal(ratioModel.entities.get("taxes").fieldMap.get("rate").type, "ratio");
    const ratioRuntime = new AppRuntime(ratioModel, { storage: new MemoryStorage(), principal: { roles: ["admin"] } });
    const taxRec = ratioRuntime.create("taxes", { name: "VAT", rate: "20%" });
    assert.equal(taxRec.record.rate.toPercentage(), 20);
    assert.equal(taxRec.record.rate.toString(), "20%");
  });

  await t.test("3. Quantity × Money Exact Minor-Unit Multiplication", () => {
    const airSource = `air version=2
app test_qty_money
resource order_items label=sku
field order_items.sku text required
field order_items.quantity integer required default=1 min=1
field order_items.unit_price money currency=USD required default=0
field order_items.line_total money currency=USD computed="quantity * unit_price"
manage order_items lifecycle=archive
access order_items view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        order_items: [
          { id: "i1", sku: "A", quantity: 3, unit_price: 19.99 },
          { id: "i2", sku: "B", quantity: 100, unit_price: 0.05 },
          { id: "i3", sku: "C", quantity: 1000000, unit_price: 999.99 } // Large scale
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    // 3 * $19.99 = $59.97 (exact minor units 5997n)
    const i1 = runtime.get("order_items", "i1");
    assert.equal(i1.line_total, 59.97);

    // 100 * $0.05 = $5.00
    const i2 = runtime.get("order_items", "i2");
    assert.equal(i2.line_total, 5.00);

    // 1,000,000 * $999.99 = $999,990,000.00 exact without float drift
    const i3 = runtime.get("order_items", "i3");
    assert.equal(i3.line_total, 999990000.00);

    // Commutativity: unit_price * quantity
    const commuteAir = `air version=2
app test_commute
resource items label=quantity
field items.quantity integer required default=4
field items.unit_price money currency=EUR required default=12.50
field items.total money currency=EUR computed="unit_price * quantity"
manage items lifecycle=archive
access items view=role:admin edit=role:admin
`;
    const commuteRuntime = new AppRuntime(parseAir(commuteAir), {
      seedData: { items: [{ id: "c1", quantity: 4, unit_price: 12.50 }] },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });
    assert.equal(commuteRuntime.get("items", "c1").total, 50.00);
  });

  await t.test("4. Ratio × Money Arithmetic with Symmetric Half-Away-From-Zero Midpoint Rounding", () => {
    const airSource = `air version=2
app test_ratio_money
resource quotes label=subtotal
field quotes.subtotal money currency=USD required
field quotes.discount_rate ratio required default="10%"
field quotes.discount_amount money currency=USD computed="subtotal * discount_rate"
manage quotes lifecycle=archive
access quotes view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        quotes: [
          // 1. Exact 10% of $120.00 = $12.00
          { id: "q1", subtotal: 120.00, discount_rate: "10%" },
          // 2. 7.5% of $80.00 = $6.00
          { id: "q2", subtotal: 80.00, discount_rate: "7.5%" },
          // 3. Midpoint test: $0.05 * 50% = 5 minor * 1/2 = 2.5 minor -> rounds to 3 minor = $0.03
          { id: "q3", subtotal: 0.05, discount_rate: "50%" },
          // 4. Negative midpoint test: -$0.05 * 50% = -2.5 minor -> rounds symmetrically away from zero to -3 minor = -$0.03
          { id: "q4", subtotal: -0.05, discount_rate: "50%" },
          // 5. 33.333% of $100.00 = 10000 * 33333 / 100000 = 3333.3 minor -> rounds to 3333 minor = $33.33
          { id: "q5", subtotal: 100.00, discount_rate: "33.333%" }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    assert.equal(runtime.get("quotes", "q1").discount_amount, 12.00);
    assert.equal(runtime.get("quotes", "q2").discount_amount, 6.00);
    assert.equal(runtime.get("quotes", "q3").discount_amount, 0.03);
    assert.equal(runtime.get("quotes", "q4").discount_amount, -0.03);
    assert.equal(runtime.get("quotes", "q5").discount_amount, 33.33);
  });

  await t.test("5. Compound Money Expressions, Operator Precedence & Parentheses", () => {
    const airSource = `air version=2
app test_compound
resource invoices label=number
field invoices.number text required
field invoices.quantity integer required default=5
field invoices.unit_price money currency=USD required default=20
field invoices.discount money currency=USD required default=15
field invoices.tax money currency=USD required default=8.50
# Precedence: quantity * unit_price is evaluated first, then - discount + tax
field invoices.total money currency=USD computed="quantity * unit_price - discount + tax"
manage invoices lifecycle=archive
access invoices view=role:admin edit=role:admin
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        invoices: [
          // 5 * $20.00 = $100.00; $100.00 - $15.00 + $8.50 = $93.50
          { id: "inv1", number: "INV-001", quantity: 5, unit_price: 20.00, discount: 15.00, tax: 8.50 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });

    const inv = runtime.get("invoices", "inv1");
    assert.equal(inv.total, 93.50);

    // Dynamic update test: changing quantity updates computed total
    runtime.update("invoices", "inv1", { quantity: 10 });
    // 10 * $20.00 = $200.00; $200.00 - $15.00 + $8.50 = $193.50
    assert.equal(runtime.get("invoices", "inv1").total, 193.50);
  });

  await t.test("6. Strict Static Type Checking & Rejection of Type Mismatches", () => {
    // Rejection of Currency Mismatch in addition (USD + EUR)
    assert.throws(() => {
      parseAir(`air version=2
app test_mismatch
resource deals label=name
field deals.name text required
field deals.us_cost money currency=USD required default=10
field deals.eu_cost money currency=EUR required default=10
field deals.combined money currency=USD computed="us_cost + eu_cost"
manage deals lifecycle=archive
access deals view=role:admin edit=role:admin
`);
    }, /currency mismatch: cannot add \`USD\` and \`EUR\`/);

    // Rejection of Money * Money
    assert.throws(() => {
      parseAir(`air version=2
app test_money_money
resource test label=id
field test.price1 money currency=USD required default=10
field test.price2 money currency=USD required default=20
field test.invalid money currency=USD computed="price1 * price2"
manage test lifecycle=archive
access test view=role:admin edit=role:admin
`);
    }, /cannot multiply \`money\` and \`money\`/);

    // Rejection of Ratio * Duration
    assert.throws(() => {
      parseAir(`air version=2
app test_ratio_duration
resource test label=id
field test.pct ratio required default="50%"
field test.dur duration required default="1h"
field test.invalid money currency=USD computed="pct * dur"
manage test lifecycle=archive
access test view=role:admin edit=role:admin
`);
    }, /cannot multiply \`ratio\` and \`duration\`/);
  });

  await t.test("7. Domain Genericity across Diverse Business Applications", () => {
    // 1. Ticketing & Seat Booking
    const ticketingAir = `air version=2
app event_tickets
resource bookings label=ref
field bookings.ref text required
field bookings.seats integer required default=2 min=1
field bookings.ticket_price money currency=GBP required default=45.00
field bookings.booking_fee money currency=GBP required default=3.50
field bookings.subtotal money currency=GBP computed="seats * ticket_price + booking_fee"
manage bookings lifecycle=archive
access bookings view=role:admin edit=role:admin
`;
    const ticketRuntime = new AppRuntime(parseAir(ticketingAir), {
      seedData: { bookings: [{ id: "b1", ref: "TKT-101", seats: 4, ticket_price: 45.00, booking_fee: 3.50 }] },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });
    // 4 * 45 + 3.50 = 183.50 GBP
    assert.equal(ticketRuntime.get("bookings", "b1").subtotal, 183.50);

    // 2. Spare Parts & Assembly Costing
    const sparePartsAir = `air version=2
app spare_parts
resource assemblies label=part_code
field assemblies.part_code text required
field assemblies.batch_quantity integer required default=100
field assemblies.unit_cost money currency=USD required default=1.25
field assemblies.assembly_cost money currency=USD computed="batch_quantity * unit_cost"
manage assemblies lifecycle=archive
access assemblies view=role:admin edit=role:admin
`;
    const spareRuntime = new AppRuntime(parseAir(sparePartsAir), {
      seedData: { assemblies: [{ id: "a1", part_code: "PRT-900", batch_quantity: 250, unit_cost: 1.25 }] },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });
    // 250 * 1.25 = 312.50 USD
    assert.equal(spareRuntime.get("assemblies", "a1").assembly_cost, 312.50);

    // 3. SaaS Seat Licensing with Discount Percentage
    const saasAir = `air version=2
app saas_billing
resource accounts label=name
field accounts.name text required
field accounts.seat_count integer required default=10
field accounts.seat_price money currency=USD required default=15.00
field accounts.gross_fee money currency=USD computed="seat_count * seat_price"
field accounts.discount_ratio ratio required default="20%"
field accounts.discount_val money currency=USD computed="gross_fee * discount_ratio"
field accounts.net_total money currency=USD computed="gross_fee - discount_val"
manage accounts lifecycle=archive
access accounts view=role:admin edit=role:admin
`;
    const saasRuntime = new AppRuntime(parseAir(saasAir), {
      seedData: { accounts: [{ id: "acct1", name: "Acme Corp", seat_count: 50, seat_price: 20.00, discount_ratio: "15%" }] },
      storage: new MemoryStorage(),
      principal: { roles: ["admin"] }
    });
    // 50 * $20 = $1000.00; discount 15% of $1000 = $150.00; net = $850.00
    const acct = saasRuntime.get("accounts", "acct1");
    assert.equal(acct.gross_fee, 1000.00);
    assert.equal(acct.discount_val, 150.00);
    assert.equal(acct.net_total, 850.00);
  });
});
