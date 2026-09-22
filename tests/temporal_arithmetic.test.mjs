import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseAir,
  parseSeedData,
  AppRuntime,
  MemoryStorage,
  Duration,
  MoneyRate,
  parseMoneyToMinorUnits,
  parseDurationLiteral,
  addDurationToInstant,
  subtractInstants,
  multiplyMoneyRate,
  getIntervalDuration,
  tokenizeLine
} from "../web/runtime/air.mjs";

test("Temporal Arithmetic & Canonical Exact Money Rate Semantics Suite", async (t) => {

  await t.test("1. Exact Money-to-Minor-Units Decimal Parsing (Zero Float Drift)", () => {
    assert.equal(parseMoneyToMinorUnits("19.99"), 1999n);
    assert.equal(parseMoneyToMinorUnits("10.01"), 1001n);
    assert.equal(parseMoneyToMinorUnits("0.10"), 10n);
    assert.equal(parseMoneyToMinorUnits("0.20"), 20n);
    assert.equal(parseMoneyToMinorUnits("0.29"), 29n);
    assert.equal(parseMoneyToMinorUnits("50"), 5000n);
    assert.equal(parseMoneyToMinorUnits("-19.99"), -1999n);
    assert.equal(parseMoneyToMinorUnits("-50"), -5000n);
    assert.equal(parseMoneyToMinorUnits("1.005"), 101n); // rounded half-away-from-zero on 3rd digit
    assert.equal(parseMoneyToMinorUnits("999999999999.99"), 99999999999999n);
    assert.equal(parseMoneyToMinorUnits(19.99), 1999n);
    assert.equal(parseMoneyToMinorUnits(50), 5000n);
    assert.equal(parseMoneyToMinorUnits(null), null);
    assert.equal(parseMoneyToMinorUnits(""), null);
    assert.equal(parseMoneyToMinorUnits("abc"), null);
  });

  await t.test("2. MoneyRate Class Construction, Strict Validation, and Exact Storage", () => {
    const r1 = new MoneyRate("19.99", "USD", "h");
    assert.equal(typeof r1.minorUnits, "bigint");
    assert.equal(r1.minorUnits, 1999n);
    assert.equal(r1.currency, "USD");
    assert.equal(r1.unit, "h");
    assert.equal(r1.unitMs, 3600000);
    assert.equal(r1.amount, 19.99);
    assert.equal(r1.toString(), "USD 19.99/h");
    assert.equal(r1.toJSON(), 19.99);

    // Rate with minutes
    const rMin = new MoneyRate("0.05", "USD", "m");
    assert.equal(rMin.minorUnits, 5n);
    assert.equal(rMin.unitMs, 60000);
    assert.equal(rMin.toString(), "USD 0.05/m");

    // Rate with days
    const rDay = new MoneyRate("100", "EUR", "d");
    assert.equal(rDay.minorUnits, 10000n);
    assert.equal(rDay.unitMs, 86400000);
    assert.equal(rDay.currency, "EUR");
    assert.equal(rDay.toString(), "EUR 100/d");

    // Rate with seconds
    const rSec = new MoneyRate("1", "GBP", "s");
    assert.equal(rSec.minorUnits, 100n);
    assert.equal(rSec.unitMs, 1000);
    assert.equal(rSec.toString(), "GBP 1/s");

    // Very large rate
    const rLarge = new MoneyRate("999999999999.99", "USD", "h");
    assert.equal(rLarge.minorUnits, 99999999999999n);
    assert.equal(rLarge.amount, 999999999999.99);

    // Strict validation: Reject missing/invalid unit (no silent hourly fallback)
    assert.throws(() => new MoneyRate("50", "USD", ""), (err) => err.message.includes("rate unit must be one of s, m, h, d"));
    assert.throws(() => new MoneyRate("50", "USD", "hour"), (err) => err.message.includes("rate unit must be one of s, m, h, d"));
    assert.throws(() => new MoneyRate("50", "USD", "week"), (err) => err.message.includes("rate unit must be one of s, m, h, d"));
    assert.throws(() => new MoneyRate("50", "USD", "foo"), (err) => err.message.includes("rate unit must be one of s, m, h, d"));
    assert.throws(() => new MoneyRate("50", "USD", null), (err) => err.message.includes("rate unit must be one of s, m, h, d"));

    // Strict validation: Reject missing/invalid currency (no silent USD fallback)
    assert.throws(() => new MoneyRate("50", "", "h"), (err) => err.message.includes("valid 3-letter currency code"));
    assert.throws(() => new MoneyRate("50", "US", "h"), (err) => err.message.includes("valid 3-letter currency code"));
    assert.throws(() => new MoneyRate("50", null, "h"), (err) => err.message.includes("valid 3-letter currency code"));
  });

  await t.test("3. Static Typecheck: Rejection of Plain Money × Duration & Currency Mismatches", () => {
    // 1. Plain money * duration must be rejected (money cannot masquerade as rate)
    assert.throws(() => {
      parseAir(`
air version=2
app test_plain_money title="Test"
resource plans label=name
field plans.name text required
field plans.cost money currency=USD required default=50
manage plans lifecycle=delete
access plans view=role:operator edit=role:operator

resource bookings label=title
field bookings.title text required
field bookings.plan ref=plans required
field bookings.start_at datetime required
field bookings.end_at datetime required
field bookings.period interval start=start_at end=end_at
field bookings.quote money currency=USD computed="period.duration * plan.cost"
manage bookings lifecycle=delete
access bookings view=role:operator edit=role:operator
`);
    }, (err) => err.message.includes("requires a duration and a rate") || err.message.includes("cannot multiply"));

    // 2. Currency mismatch (rate is EUR/h, computed money field declares USD)
    assert.throws(() => {
      parseAir(`
air version=2
app test_currency_mismatch title="Test"
resource plans label=name
field plans.name text required
field plans.hourly_rate rate currency=EUR unit=h required default=50
manage plans lifecycle=delete
access plans view=role:operator edit=role:operator

resource bookings label=title
field bookings.title text required
field bookings.plan ref=plans required
field bookings.start_at datetime required
field bookings.end_at datetime required
field bookings.period interval start=start_at end=end_at
field bookings.quote money currency=USD computed="period.duration * plan.hourly_rate"
manage bookings lifecycle=delete
access bookings view=role:operator edit=role:operator
`);
    }, (err) => err.message.includes("currency `USD` does not match rate currency `EUR`"));
  });

  await t.test("4. Exact Rational Money Arithmetic with BigInt & Symmetric Half-Away-From-Zero", () => {
    // Part 9: USD 20/hour * 90 minutes = USD 30.00
    const m1 = multiplyMoneyRate(new MoneyRate("20", "USD", "h"), "USD", 5400000);
    assert.equal(m1.amount, 30);
    assert.equal(m1.minorUnits, 3000n);
    assert.equal(m1.currency, "USD");

    // Part 10: USD 0.05/minute * 30 seconds = USD 0.03 (symmetric half-away-from-zero)
    const m2 = multiplyMoneyRate(new MoneyRate("0.05", "USD", "m"), "USD", 30000);
    assert.equal(m2.amount, 0.03);
    assert.equal(m2.minorUnits, 3n);

    // Part 11: USD 100/day * 12 hours = USD 50.00 (1d = 24 elapsed hours)
    const m3 = multiplyMoneyRate(new MoneyRate("100", "USD", "d"), "USD", 43200000);
    assert.equal(m3.amount, 50);
    assert.equal(m3.minorUnits, 5000n);

    // Part 11: USD 100/day * 36 hours = USD 150.00
    const m4 = multiplyMoneyRate(new MoneyRate("100", "USD", "d"), "USD", 129600000);
    assert.equal(m4.amount, 150);
    assert.equal(m4.minorUnits, 15000n);

    // Part 12 & 16: Negative rate (-20 USD/h * 2h = -40 USD)
    const mNeg = multiplyMoneyRate(new MoneyRate("-20", "USD", "h"), "USD", 7200000);
    assert.equal(mNeg.amount, -40);
    assert.equal(mNeg.minorUnits, -4000n);

    // Part 17: Zero rate
    const mZero = multiplyMoneyRate(new MoneyRate("0", "USD", "h"), "USD", 18000000);
    assert.equal(mZero.amount, 0);
    assert.equal(mZero.minorUnits, 0n);

    // Part 10 & 18: Very large rate & exact BigInt multiplication
    const mLarge = multiplyMoneyRate(new MoneyRate("999999999999.99", "USD", "h"), "USD", 7200000); // 2 hours
    assert.equal(mLarge.amount, 1999999999999.98);
    assert.equal(mLarge.minorUnits, 199999999999998n);
  });

  await t.test("5. No Field-Name Semantics (Field Identifier Independence)", () => {
    // Proves that field identifiers "foo", "price", "billing_amount" behave identically based strictly on declared type/unit
    const agnosticAir = `
air version=2
app test_agnostic title="Agnostic"
resource providers label=name
field providers.name text required
field providers.foo rate currency=USD unit=h required default=40
field providers.price rate currency=USD unit=m required default=2
field providers.billing_amount rate currency=USD unit=d required default=120
manage providers lifecycle=delete
access providers view=role:operator edit=role:operator

resource sessions label=title
field sessions.title text required
field sessions.provider ref=providers required
field sessions.start_time datetime required
field sessions.end_time datetime required
field sessions.period interval start=start_time end=end_time
field sessions.quote_a money currency=USD computed="period.duration * provider.foo"
field sessions.quote_b money currency=USD computed="period.duration * provider.price"
field sessions.quote_c money currency=USD computed="period.duration * provider.billing_amount"
manage sessions lifecycle=delete
access sessions view=role:operator edit=role:operator
`;
    const model = parseAir(agnosticAir);
    const runtime = new AppRuntime(model, {
      seedData: new Map([
        ["providers", [{ id: "p1", name: "Alpha", foo: 40, price: 2, billing_amount: 120 }]],
        ["sessions", [{ id: "s1", title: "Test", provider: "p1", start_time: "2026-09-22T10:00:00.000Z", end_time: "2026-09-22T12:00:00.000Z" }]]
      ]),
      principal: { roles: ["operator"] }
    });

    const session = runtime.get("sessions", "s1");
    // period is 2 hours
    // quote_a: 2h * $40/h = $80
    assert.equal(session.quote_a, 80);
    // quote_b: 120m * $2/m = $240
    assert.equal(session.quote_b, 240);
    // quote_c: 2h * $120/24h ($5/h) = $10
    assert.equal(session.quote_c, 10);
  });

  await t.test("6. Reservation Hub Lead-Time Invariant & Computed Quote with First-Class Rate", () => {
    const airSource = fs.readFileSync("apps/reservation-hub.air", "utf8");
    const seedSource = fs.readFileSync("data/reservation-hub.seed.json", "utf8");
    const model = parseAir(airSource);
    const seedData = parseSeedData(seedSource, model);

    const fixedClock = () => new Date("2026-09-22T10:00:00.000Z");
    const runtime = new AppRuntime(model, {
      seedData,
      storage: new MemoryStorage(),
      principal: { roles: ["admin", "operator"] },
      clock: fixedClock
    });

    // 1. Check computed quote on existing reservations (res_boardroom is rate 150 USD/h)
    const reservations = runtime.query("reservations", { paginate: false }).records;
    const res1 = reservations.find((r) => r.id === "resv_01");
    assert.ok(res1);
    // resv_01 is 1 day (24h) on res_boardroom ($150/h) -> 24 * 150 = 3600
    assert.equal(res1.quote, 3600);

    // 2. Reject booking with start_at < now + 2h (today's start 00:00 UTC < now 10:00 UTC + 2h)
    const tooSoonRes = runtime.create("reservations", {
      title: "Urgent Same-Day Meeting",
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: "2026-09-22",
      end_at: "2026-09-22",
      attendees: 4,
      status: "Requested",
      amount: 300,
      created_at: "2026-09-22"
    });
    assert.equal(tooSoonRes.record, null);
    assert.ok(tooSoonRes.errors.lead_time || tooSoonRes.errors.start_at);
    assert.match(tooSoonRes.errors.lead_time || tooSoonRes.errors.start_at, /2 hours in advance/);

    // 3. Accept booking with start_at >= now + 2h (future date 2026-09-26)
    const validRes = runtime.create("reservations", {
      title: "Advanced Planned Meeting",
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: "2026-09-26",
      end_at: "2026-09-26",
      attendees: 4,
      status: "Requested",
      amount: 3600,
      created_at: "2026-09-22"
    });
    assert.ok(validRes.record);
    assert.equal(validRes.record.status, "Requested");
    
    // Verify computed quote is 24h * $150/h = $3600
    const loadedValid = runtime.get("reservations", validRes.record.id);
    assert.equal(loadedValid.quote, 3600);

    // 4. Dynamic Quote Recomputation upon Resource Rate Change
    // Update resource rate from 150 to 200
    runtime.update("resources", "res_boardroom", { hourly_rate: 200 });
    const reloaded = runtime.get("reservations", validRes.record.id);
    // Stored contractual amount is untouched ($3600)
    assert.equal(reloaded.amount, 3600);
    // Virtual quote reflects updated rate: 24h * $200/h = $4800
    assert.equal(reloaded.quote, 4800);
  });

  await t.test("7. Rate Unit Change Benchmark (Hourly -> Daily)", () => {
    // Changing billing rate from hourly to daily is a 1-line semantic change on the rate field declaration
    const modifiedAir = fs.readFileSync("apps/reservation-hub.air", "utf8")
      .replace("field resources.hourly_rate rate currency=USD unit=h required default=50",
               "field resources.hourly_rate rate currency=USD unit=d required default=50");
    const modModel = parseAir(modifiedAir);
    assert.equal(modModel.entities.get("resources").fieldMap.get("hourly_rate").unit, "d");

    // Computed quote expression remains untouched: "booking_period.duration * resource.hourly_rate"
    const seedSource = fs.readFileSync("data/reservation-hub.seed.json", "utf8");
    const seedData = parseSeedData(seedSource, modModel);
    const runtime = new AppRuntime(modModel, {
      seedData,
      storage: new MemoryStorage(),
      principal: { roles: ["admin", "operator"] }
    });
    // For resv_01 (1 day on res_boardroom with daily rate $150/day), quote is now 1d * $150/d = $150
    const res1 = runtime.get("reservations", "resv_01");
    assert.equal(res1.quote, 150);
  });

  await t.test("8. Multi-Domain Genericity (Parking, Timesheets, Equipment Rental)", () => {
    // Domain A: Parking Garage ($5/hour rate)
    const parkingAir = `
air version=2
app parking_system title="Parking Management" timezone="UTC"
resource garages label=name
field garages.name text required
field garages.hourly_rate rate currency=USD unit=h required default=5
manage garages lifecycle=delete
access garages view=role:operator edit=role:operator

resource tickets label=code
field tickets.code text required
field tickets.garage ref=garages required
field tickets.entry_at datetime required
field tickets.exit_at datetime required
field tickets.parking_interval interval start=entry_at end=exit_at
field tickets.total_due money currency=USD computed="parking_interval.duration * garage.hourly_rate"
manage tickets lifecycle=delete
access tickets view=role:operator edit=role:operator
`;
    const parkingModel = parseAir(parkingAir);
    const parkingRuntime = new AppRuntime(parkingModel, {
      seedData: new Map([
        ["garages", [{ id: "g1", name: "Downtown Core", hourly_rate: 6 }]],
        ["tickets", [{ id: "t1", code: "T-100", garage: "g1", entry_at: "2026-09-22T08:00:00.000Z", exit_at: "2026-09-22T11:30:00.000Z" }]]
      ]),
      principal: { roles: ["operator"] }
    });
    const ticket = parkingRuntime.get("tickets", "t1");
    // 3.5h * $6/h = $21.00
    assert.equal(ticket.total_due, 21);

    // Domain B: Consultant Timesheets (150 EUR/hour rate)
    const timesheetAir = `
air version=2
app consulting_hub title="Consulting Timesheets" timezone="UTC"
resource consultants label=name
field consultants.name text required
field consultants.billable_rate rate currency=EUR unit=h required default=120
manage consultants lifecycle=delete
access consultants view=role:operator edit=role:operator

resource timesheets label=task
field timesheets.task text required
field timesheets.consultant ref=consultants required
field timesheets.start_time datetime required
field timesheets.end_time datetime required
field timesheets.work_period interval start=start_time end=end_time
field timesheets.earnings money currency=EUR computed="work_period.duration * consultant.billable_rate"
manage timesheets lifecycle=delete
access timesheets view=role:operator edit=role:operator
`;
    const timesheetModel = parseAir(timesheetAir);
    const tsRuntime = new AppRuntime(timesheetModel, {
      seedData: new Map([
        ["consultants", [{ id: "c1", name: "Senior Architect", billable_rate: 150 }]],
        ["timesheets", [{ id: "ts1", task: "Security Audit", consultant: "c1", start_time: "2026-09-22T09:00:00.000Z", end_time: "2026-09-22T17:00:00.000Z" }]]
      ]),
      principal: { roles: ["operator"] }
    });
    const entry = tsRuntime.get("timesheets", "ts1");
    // 8h * 150 EUR = 1200 EUR
    assert.equal(entry.earnings, 1200);

    // Domain C: Equipment Rental ($80/day rate)
    const equipmentAir = `
air version=2
app equipment_hire title="Equipment Hire" timezone="UTC"
resource equipment label=name
field equipment.name text required
field equipment.daily_hire rate currency=USD unit=d required default=80
manage equipment lifecycle=delete
access equipment view=role:operator edit=role:operator

resource rentals label=renter
field rentals.renter text required
field rentals.equipment ref=equipment required
field rentals.start_date datetime required
field rentals.end_date datetime required
field rentals.rental_interval interval start=start_date end=end_date
field rentals.charge money currency=USD computed="rental_interval.duration * equipment.daily_hire"
manage rentals lifecycle=delete
access rentals view=role:operator edit=role:operator
`;
    const eqModel = parseAir(equipmentAir);
    const eqRuntime = new AppRuntime(eqModel, {
      seedData: new Map([
        ["equipment", [{ id: "eq1", name: "High-Speed Drone Kit", daily_hire: 100 }]],
        ["rentals", [{ id: "r1", renter: "Acme Corp", equipment: "eq1", start_date: "2026-09-22T00:00:00.000Z", end_date: "2026-09-24T12:00:00.000Z" }]]
      ]),
      principal: { roles: ["operator"] }
    });
    const rental = eqRuntime.get("rentals", "r1");
    // 2.5 days * $100/day = $250.00
    assert.equal(rental.charge, 250);
  });

  await t.test("9. Performance Overhead & Latency Evaluation", () => {
    const rate = new MoneyRate("75.5", "USD", "h");
    const start1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      multiplyMoneyRate(rate, "USD", 5400000);
      addDurationToInstant("2026-09-22T10:00:00.000Z", 7200000);
    }
    const elapsed1k = performance.now() - start1;
    assert.ok(elapsed1k < 100, `1,000 temporal arithmetic operations took ${elapsed1k.toFixed(2)}ms (< 100ms budget)`);

    const start10k = performance.now();
    for (let i = 0; i < 10000; i++) {
      multiplyMoneyRate(rate, "USD", 3600000 * (i % 8 + 1));
    }
    const elapsed10k = performance.now() - start10k;
    assert.ok(elapsed10k < 200, `10,000 rate derivations took ${elapsed10k.toFixed(2)}ms (< 200ms budget)`);
  });
});
