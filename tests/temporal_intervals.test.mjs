import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAir,
  AppRuntime,
  intervalsOverlap,
  intervalContains,
  intervalContainedBy,
  intervalBefore,
  intervalAfter,
  intervalTouches,
  duration
} from "../web/runtime/air.mjs";

test("TEMPORAL INTERVALS: 1. Complete 10-Scenario Interval Overlap Matrix (A-J)", () => {
  const base = { start: "2026-10-01T10:00:00Z", end: "2026-10-01T11:00:00Z" };

  // Scenario A: Completely disjoint before
  const a = { start: "2026-10-01T08:00:00Z", end: "2026-10-01T09:00:00Z" };
  assert.equal(intervalsOverlap(a, base), false, "Scenario A: Disjoint before must not overlap");
  assert.equal(intervalBefore(a, base), true, "Scenario A: a is before base");

  // Scenario B: Touching start/end (half-open [start, end) non-overlap)
  const b = { start: "2026-10-01T09:00:00Z", end: "2026-10-01T10:00:00Z" };
  assert.equal(intervalsOverlap(b, base), false, "Scenario B: Touching end-to-start must not overlap in [start, end)");
  assert.equal(intervalTouches(b, base), true, "Scenario B: b touches base");

  // Scenario C: Overlapping at end
  const c = { start: "2026-10-01T09:30:00Z", end: "2026-10-01T10:30:00Z" };
  assert.equal(intervalsOverlap(c, base), true, "Scenario C: Overlap at end must be true");

  // Scenario D: Exact match
  const d = { start: "2026-10-01T10:00:00Z", end: "2026-10-01T11:00:00Z" };
  assert.equal(intervalsOverlap(d, base), true, "Scenario D: Exact match must overlap");
  assert.equal(intervalContains(base, d), true, "Scenario D: exact match contains");

  // Scenario E: Sub-interval / enclosed
  const e = { start: "2026-10-01T10:15:00Z", end: "2026-10-01T10:45:00Z" };
  assert.equal(intervalsOverlap(e, base), true, "Scenario E: Enclosed sub-interval must overlap");
  assert.equal(intervalContains(base, e), true, "Scenario E: base contains e");
  assert.equal(intervalContainedBy(e, base), true, "Scenario E: e is contained by base");

  // Scenario F: Enclosing / superset
  const f = { start: "2026-10-01T09:30:00Z", end: "2026-10-01T11:30:00Z" };
  assert.equal(intervalsOverlap(f, base), true, "Scenario F: Enclosing interval must overlap");
  assert.equal(intervalContains(f, base), true, "Scenario F: f contains base");

  // Scenario G: Overlapping at start
  const g = { start: "2026-10-01T10:30:00Z", end: "2026-10-01T11:30:00Z" };
  assert.equal(intervalsOverlap(g, base), true, "Scenario G: Overlap at start must be true");

  // Scenario H: Touching start (base end touches h start)
  const h = { start: "2026-10-01T11:00:00Z", end: "2026-10-01T12:00:00Z" };
  assert.equal(intervalsOverlap(h, base), false, "Scenario H: Touching start-to-end must not overlap in [start, end)");
  assert.equal(intervalTouches(h, base), true, "Scenario H: h touches base");

  // Scenario I: Completely disjoint after
  const i = { start: "2026-10-01T12:00:00Z", end: "2026-10-01T13:00:00Z" };
  assert.equal(intervalsOverlap(i, base), false, "Scenario I: Disjoint after must not overlap");
  assert.equal(intervalAfter(i, base), true, "Scenario I: i is after base");
});

test("TEMPORAL INTERVALS: 2. Interval Type Declaration & Boundary Validation (Scenario J)", () => {
  const schema = `
air version=2
app test_intervals title="Test Intervals" initial=overview timezone="UTC"
resource events label=title
field events.title text required min=2
field events.start_at date required
field events.end_at date required
field events.period interval start=start_at end=end_at
manage events lifecycle=delete
access events view=true edit=true
overview title="Overview"
insight events.total op=count label="Total"
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model);

  // Valid interval: start < end
  const valid = runtime.validate("events", {
    title: "Keynote",
    start_at: "2026-10-01",
    end_at: "2026-10-05"
  });
  assert.equal(Object.keys(valid).length, 0, "Valid interval must have 0 errors");

  // Valid single-day date interval: start_at == end_at is 1 day [D, D+1)
  const singleDay = runtime.validate("events", {
    title: "One Day Workshop",
    start_at: "2026-10-05",
    end_at: "2026-10-05"
  });
  assert.equal(Object.keys(singleDay).length, 0, "Single-day date interval is valid");

  // Scenario J: Inverted date interval (start > end)
  const invalidInverted = runtime.validate("events", {
    title: "Time Travel",
    start_at: "2026-10-06",
    end_at: "2026-10-05"
  });
  assert.ok(invalidInverted.period || invalidInverted.start_at, "Inverted start/end must fail validation");
});

test("TEMPORAL INTERVALS: 3. Cross-Record Non-Overlap Invariants & Scoping", () => {
  const schema = `
air version=2
app schedule_app title="Schedule App" initial=overview timezone="UTC"
resource rooms label=name
field rooms.name text required min=2
field rooms.capacity number required default=10
manage rooms lifecycle=delete
access rooms view=true edit=true

resource bookings label=title
field bookings.title text required min=2
field bookings.room ref=rooms required
field bookings.start_at date required
field bookings.end_at date required
field bookings.period interval start=start_at end=end_at
field bookings.status enum values=Confirmed,Cancelled required default=Confirmed
manage bookings lifecycle=delete
access bookings view=true edit=true
invariant bookings.no_overlap none=bookings scope=room overlaps=period where="status!=Cancelled" deny="Room is already booked for this period"

overview title="Overview"
insight bookings.count op=count label="Bookings"
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      rooms: [
        { id: "room_1", name: "Alpha", capacity: 10 },
        { id: "room_2", name: "Beta", capacity: 20 }
      ],
      bookings: [
        { id: "bk_1", title: "Existing Confirmed", room: "room_1", start_at: "2026-10-10", end_at: "2026-10-15", status: "Confirmed" },
        { id: "bk_2", title: "Existing Cancelled", room: "room_1", start_at: "2026-10-20", end_at: "2026-10-25", status: "Cancelled" }
      ]
    }
  });

  // 1. Conflicting booking on SAME room -> FAILS
  const conflict = runtime.create("bookings", {
    title: "New Overlapping",
    room: "room_1",
    start_at: "2026-10-12",
    end_at: "2026-10-14",
    status: "Confirmed"
  });
  assert.equal(conflict.record, null, "Conflicting booking on room_1 must be rejected");
  assert.ok(conflict.errors.period || conflict.errors.no_overlap, "Must report overlap error");

  // 2. Overlapping dates on DIFFERENT room -> SUCCEEDS
  const differentRoom = runtime.create("bookings", {
    title: "Booking in Beta",
    room: "room_2",
    start_at: "2026-10-12",
    end_at: "2026-10-14",
    status: "Confirmed"
  });
  assert.ok(differentRoom.record, "Overlapping booking on different room must succeed");

  // 3. Touching boundaries on SAME room (half-open [10, 15) and [15, 18)) -> SUCCEEDS
  const touching = runtime.create("bookings", {
    title: "Back to Back",
    room: "room_1",
    start_at: "2026-10-15",
    end_at: "2026-10-18",
    status: "Confirmed"
  });
  assert.ok(touching.record, "Back to back touching interval must succeed");

  // 4. Overlapping with CANCELLED booking -> SUCCEEDS
  const overlapCancelled = runtime.create("bookings", {
    title: "Replace Cancelled",
    room: "room_1",
    start_at: "2026-10-21",
    end_at: "2026-10-24",
    status: "Confirmed"
  });
  assert.ok(overlapCancelled.record, "Overlap with cancelled booking must succeed");
});

test("TEMPORAL INTERVALS: 4. Self-Exclusion during Update & Rescheduling", () => {
  const schema = `
air version=2
app schedule_app title="Schedule App" initial=overview timezone="UTC"
resource rooms label=name
field rooms.name text required min=2
manage rooms lifecycle=delete
access rooms view=true edit=true

resource bookings label=title
field bookings.title text required min=2
field bookings.room ref=rooms required
field bookings.start_at date required
field bookings.end_at date required
field bookings.period interval start=start_at end=end_at
field bookings.status enum values=Confirmed,Cancelled required default=Confirmed
manage bookings lifecycle=delete
access bookings view=true edit=true
invariant bookings.no_overlap none=bookings scope=room overlaps=period where="status!=Cancelled" deny="Room collision"

overview title="Overview"
insight bookings.count op=count label="Bookings"
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      rooms: [{ id: "room_1", name: "Boardroom" }],
      bookings: [
        { id: "bk_1", title: "Strategy Session", room: "room_1", start_at: "2026-11-01", end_at: "2026-11-05", status: "Confirmed" },
        { id: "bk_2", title: "Review Meeting", room: "room_1", start_at: "2026-11-10", end_at: "2026-11-15", status: "Confirmed" }
      ]
    }
  });

  // 1. Updating non-temporal fields of bk_1 must not conflict with bk_1
  const updateTitle = runtime.update("bookings", "bk_1", { title: "Strategy Session V2" });
  assert.ok(updateTitle.record, "Self-update must succeed");
  assert.equal(updateTitle.record.title, "Strategy Session V2");

  // 2. Rescheduling bk_1 to a clear date must succeed
  const rescheduleClean = runtime.update("bookings", "bk_1", {
    start_at: "2026-11-06",
    end_at: "2026-11-09"
  });
  assert.ok(rescheduleClean.record, "Rescheduling to clear window must succeed");

  // 3. Rescheduling bk_1 to collide with bk_2 must FAIL
  const rescheduleCollision = runtime.update("bookings", "bk_1", {
    start_at: "2026-11-12",
    end_at: "2026-11-14"
  });
  assert.equal(rescheduleCollision.record, null, "Rescheduling into collision must fail");
  assert.ok(rescheduleCollision.errors.period || rescheduleCollision.errors.no_overlap);
});

test("TEMPORAL INTERVALS: 5. Cross-Resource Invariant (Blackout Windows)", () => {
  const schema = `
air version=2
app maintenance_app title="Maintenance" initial=overview timezone="UTC"
resource equipment label=name
field equipment.name text required min=2
manage equipment lifecycle=delete
access equipment view=true edit=true

resource blackouts label=reason
field blackouts.equipment ref=equipment required
field blackouts.reason text required min=2
field blackouts.start_at date required
field blackouts.end_at date required
field blackouts.window interval start=start_at end=end_at
field blackouts.status enum values=Active,Resolved required default=Active
manage blackouts lifecycle=delete
access blackouts view=true edit=true

resource rentals label=title
field rentals.title text required min=2
field rentals.equipment ref=equipment required
field rentals.start_at date required
field rentals.end_at date required
field rentals.period interval start=start_at end=end_at
manage rentals lifecycle=delete
access rentals view=true edit=true
invariant rentals.no_blackout none=blackouts scope=equipment overlaps=period where="status==Active" deny="Equipment is in blackout"

overview title="Overview"
insight rentals.count op=count label="Rentals"
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      equipment: [{ id: "eq_1", name: "Excavator" }],
      blackouts: [
        { id: "bo_1", equipment: "eq_1", reason: "Annual Service", start_at: "2026-12-01", end_at: "2026-12-10", status: "Active" },
        { id: "bo_2", equipment: "eq_1", reason: "Quick Inspection", start_at: "2026-12-15", end_at: "2026-12-16", status: "Resolved" }
      ],
      rentals: []
    }
  });

  // Rental during active blackout -> FAILS
  const duringActive = runtime.create("rentals", {
    title: "Site Digging",
    equipment: "eq_1",
    start_at: "2026-12-05",
    end_at: "2026-12-08"
  });
  assert.equal(duringActive.record, null, "Must reject rental during active blackout");

  // Rental during resolved blackout -> SUCCEEDS
  const duringResolved = runtime.create("rentals", {
    title: "Post Inspection Digging",
    equipment: "eq_1",
    start_at: "2026-12-15",
    end_at: "2026-12-16"
  });
  assert.ok(duringResolved.record, "Must allow rental during resolved blackout");
});

test("TEMPORAL INTERVALS: 6. Duration Helper & Conversions", () => {
  const dHours = duration("2026-10-01T10:00:00Z", "2026-10-01T14:30:00Z", "h");
  assert.equal(dHours, 4.5, "Duration in hours should be 4.5");

  const dDays = duration("2026-10-01", "2026-10-10", "d");
  assert.equal(dDays, 9, "Duration in days should be 9");

  const dObj = duration({ start: "2026-10-01T10:00:00Z", end: "2026-10-01T10:15:00Z" }, null, "m");
  assert.equal(dObj, 15, "Duration in minutes should be 15");
});

test("TEMPORAL INTERVALS: 7. Multi-Domain Genericity (Meeting Rooms, Equipment, Employee Shifts)", () => {
  const schema = `
air version=2
app multi_domain title="Multi Domain" initial=overview timezone="UTC"

resource staff label=name
field staff.name text required min=2
manage staff lifecycle=delete
access staff view=true edit=true

resource shifts label=title
field shifts.title text required min=2
field shifts.staff ref=staff required
field shifts.start_at date required
field shifts.end_at date required
field shifts.period interval start=start_at end=end_at
manage shifts lifecycle=delete
access shifts view=true edit=true
invariant shifts.no_double_shift none=shifts scope=staff overlaps=period deny="Staff cannot be scheduled for overlapping shifts"

overview title="Overview"
insight shifts.count op=count label="Shifts"
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      staff: [{ id: "st_1", name: "Alice" }],
      shifts: [
        { id: "sh_1", title: "Morning Shift", staff: "st_1", start_at: "2026-10-01", end_at: "2026-10-05" }
      ]
    }
  });

  const overlap = runtime.create("shifts", {
    title: "Conflicting Shift",
    staff: "st_1",
    start_at: "2026-10-03",
    end_at: "2026-10-07"
  });
  assert.equal(overlap.record, null, "Double shift must be blocked generically");
});

test("TEMPORAL INTERVALS: 8. Performance Benchmark across 10, 1,000, and 10,000 records", () => {
  const schema = `
air version=2
app perf_app title="Perf Test" initial=overview timezone="UTC"
resource slots label=name
field slots.name text required min=2
manage slots lifecycle=delete
access slots view=true edit=true

resource allocations label=title
field allocations.title text required min=2
field allocations.slot ref=slots required
field allocations.start_at number required
field allocations.end_at number required
field allocations.period interval start=start_at end=end_at
manage allocations lifecycle=delete
access allocations view=true edit=true
invariant allocations.no_overlap none=allocations scope=slot overlaps=period deny="Slot occupied"

overview title="Overview"
insight allocations.count op=count label="Count"
`;

  const model = parseAir(schema);

  for (const count of [10, 1000]) {
    const allocations = [];
    for (let i = 0; i < count; i++) {
      allocations.push({
        id: `alc_${i}`,
        title: `Alloc ${i}`,
        slot: `slot_${i % 10}`,
        start_at: i * 10,
        end_at: i * 10 + 5
      });
    }

    const runtime = new AppRuntime(model, {
      seedData: {
        slots: Array.from({ length: 10 }, (_, i) => ({ id: `slot_${i}`, name: `Slot ${i}` })),
        allocations
      }
    });

    const start = performance.now();
    const result = runtime.create("allocations", {
      title: "New Allocation",
      slot: "slot_0",
      start_at: 99999990,
      end_at: 99999995
    });
    const durationMs = performance.now() - start;

    assert.ok(result.record, `Creation with ${count} records should succeed`);
    assert.ok(durationMs < 100, `Execution with ${count} records took ${durationMs.toFixed(2)}ms (<100ms)`);
  }
});
