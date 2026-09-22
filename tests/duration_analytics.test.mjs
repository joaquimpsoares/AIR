import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseAir,
  parseSeedData,
  AppRuntime,
  MemoryStorage,
  Duration,
  UtilizationRatio,
  roundSymmetricRational,
  parseDurationLiteral,
  subtractInstants,
  getIntervalDuration,
  clipInterval,
  intervalUnion,
  computeUtilization,
  correlateEventDurations
} from "../web/runtime/air.mjs";
import {
  compileVisualizationIR,
  formatMetricValue,
  VISUAL_INTENTS
} from "../web/runtime/visualization_ir.mjs";

test("Duration Analytics v1 Comprehensive Test Suite", async (t) => {

  await t.test("0. Canonical Symmetric Half-Away-From-Zero Integer Rational Rounding", () => {
    // Exact midpoint +1.5 -> +2, -1.5 -> -2
    assert.equal(roundSymmetricRational(3, 2), 2);
    assert.equal(roundSymmetricRational(-3, 2), -2);

    // Exact midpoint +2.5 -> +3, -2.5 -> -3
    assert.equal(roundSymmetricRational(5, 2), 3);
    assert.equal(roundSymmetricRational(-5, 2), -3);

    // Exact midpoint +0.5 -> +1, -0.5 -> -1
    assert.equal(roundSymmetricRational(1, 2), 1);
    assert.equal(roundSymmetricRational(-1, 2), -1);

    // Non-midpoint positive
    assert.equal(roundSymmetricRational(4, 2), 2);
    assert.equal(roundSymmetricRational(7, 3), 2); // 2.333 -> 2
    assert.equal(roundSymmetricRational(8, 3), 3); // 2.666 -> 3

    // Non-midpoint negative
    assert.equal(roundSymmetricRational(-4, 2), -2);
    assert.equal(roundSymmetricRational(-7, 3), -2); // -2.333 -> -2
    assert.equal(roundSymmetricRational(-8, 3), -3); // -2.666 -> -3

    // Zero cases and invalid denominator
    assert.equal(roundSymmetricRational(0, 5), 0);
    assert.equal(roundSymmetricRational(5, 0), 0);
    assert.equal(roundSymmetricRational(0, 0), 0);
  });

  await t.test("1. Duration Aggregations (Sum, Avg, Min, Max) & Exact Milliseconds Integrity", () => {
    const airSource = `
air version=2
app timesheet_app title="Timesheet Analytics" initial=overview timezone="UTC"
theme mode=dark accent=violet
capability storage.local

resource employees label=name
field employees.name text required
manage employees lifecycle=delete
access employees view=role:operator edit=role:operator

resource timesheets label=description
field timesheets.employee ref=employees required
field timesheets.description text required
field timesheets.time_spent duration required default=1h
field timesheets.date date required default=today
manage timesheets lifecycle=delete
access timesheets view=role:operator edit=role:operator

overview title="Timesheet Overview"
insight timesheets.total_time op=sum field=time_spent label="Total Time"
insight timesheets.avg_time op=avg field=time_spent label="Average Time"
insight timesheets.min_time op=min field=time_spent label="Minimum Time"
insight timesheets.max_time op=max field=time_spent label="Maximum Time"
insight timesheets.by_employee op=sum group=employee field=time_spent label="Time by Employee"
`;

    const seedSource = {
      employees: [
        { id: "emp_alice", name: "Alice" },
        { id: "emp_bob", name: "Bob" }
      ],
      timesheets: [
        { id: "ts_1", employee: "emp_alice", description: "Design", time_spent: "2h", date: "2026-06-01" },
        { id: "ts_2", employee: "emp_alice", description: "Review", time_spent: "1h 30m", date: "2026-06-01" },
        { id: "ts_3", employee: "emp_bob", description: "Coding", time_spent: "4h", date: "2026-06-01" },
        { id: "ts_4", employee: "emp_bob", description: "Debugging", time_spent: "30m", date: "2026-06-01" }
      ]
    };

    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: seedSource,
      principal: { roles: ["operator"] }
    });

    const overview = model.pageMap.get("overview");
    const totalMetric = overview.metrics.find((m) => m.id === "total_time");
    const avgMetric = overview.metrics.find((m) => m.id === "avg_time");
    const minMetric = overview.metrics.find((m) => m.id === "min_time");
    const maxMetric = overview.metrics.find((m) => m.id === "max_time");
    const byEmpMetric = overview.metrics.find((m) => m.id === "by_employee");

    // Total: 2h (7200000) + 1.5h (5400000) + 4h (14400000) + 0.5h (1800000) = 8h (28800000 ms)
    const total = runtime.metric(totalMetric);
    assert.ok(total instanceof Duration, "Total should return a Duration instance");
    assert.equal(total.ms, 28800000);
    assert.equal(total.hours, 8);
    assert.equal(runtime.formatMetric(totalMetric, total), "8h");

    // Avg: 28800000 / 4 = 7200000 ms (2h)
    const avg = runtime.metric(avgMetric);
    assert.ok(avg instanceof Duration);
    assert.equal(avg.ms, 7200000);
    assert.equal(avg.hours, 2);
    assert.equal(runtime.formatMetric(avgMetric, avg), "2h");

    // Min: 30m = 1800000 ms
    const min = runtime.metric(minMetric);
    assert.ok(min instanceof Duration);
    assert.equal(min.ms, 1800000);
    assert.equal(runtime.formatMetric(minMetric, min), "30m");

    // Max: 4h = 14400000 ms
    const max = runtime.metric(maxMetric);
    assert.ok(max instanceof Duration);
    assert.equal(max.ms, 14400000);
    assert.equal(runtime.formatMetric(maxMetric, max), "4h");

    // Group breakdown
    const byEmp = runtime.metric(byEmpMetric);
    assert.ok(byEmp.Alice instanceof Duration);
    assert.equal(byEmp.Alice.ms, 12600000); // 3h 30m
    assert.ok(byEmp.Bob instanceof Duration);
    assert.equal(byEmp.Bob.ms, 16200000); // 4h 30m
    assert.equal(runtime.formatMetric(byEmpMetric, byEmp), "Alice 210m · Bob 270m");
  });

  await t.test("2. Interval-Derived Duration Aggregation (booking_period.duration)", () => {
    const airSource = `
air version=2
app booking_duration_app title="Booking Duration" initial=overview timezone="UTC"
theme mode=dark accent=violet
capability storage.local

resource rooms label=name
field rooms.name text required
manage rooms lifecycle=delete
access rooms view=role:operator edit=role:operator

resource bookings label=title
field bookings.title text required
field bookings.room ref=rooms required
field bookings.start_at datetime required
field bookings.end_at datetime required
field bookings.booking_period interval start=start_at end=end_at
manage bookings lifecycle=delete
access bookings view=role:operator edit=role:operator

overview title="Booking Overview"
insight bookings.total_duration op=sum field=booking_period.duration label="Total Booked Duration"
insight bookings.avg_duration op=avg field=booking_period.duration label="Average Booking Duration"
`;

    const seedSource = {
      rooms: [{ id: "rm_1", name: "Executive Suite" }],
      bookings: [
        { id: "b1", title: "Meeting 1", room: "rm_1", start_at: "2026-06-01T09:00:00.000Z", end_at: "2026-06-01T11:00:00.000Z" }, // 2h = 7200000
        { id: "b2", title: "Meeting 2", room: "rm_1", start_at: "2026-06-01T13:00:00.000Z", end_at: "2026-06-01T16:00:00.000Z" }, // 3h = 10800000
        { id: "b3", title: "Meeting 3", room: "rm_1", start_at: "2026-06-01T17:00:00.000Z", end_at: "2026-06-01T18:30:00.000Z" }  // 1.5h = 5400000
      ]
    };

    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: seedSource,
      principal: { roles: ["operator"] }
    });

    const overview = model.pageMap.get("overview");
    const totalMetric = overview.metrics.find((m) => m.id === "total_duration");
    const avgMetric = overview.metrics.find((m) => m.id === "avg_duration");

    const total = runtime.metric(totalMetric);
    assert.ok(total instanceof Duration);
    assert.equal(total.ms, 23400000); // 6.5h
    assert.equal(total.hours, 6.5);

    const avg = runtime.metric(avgMetric);
    assert.ok(avg instanceof Duration);
    assert.equal(avg.ms, 7800000); // 2h 10m
  });

  await t.test("3. Resource Utilization Model (Interval Clipping, Union, Zero Double-Counting, Exact Rational Type)", () => {
    // Window: 2026-06-01T00:00:00.000Z to 2026-06-02T00:00:00.000Z (24h = 86400000 ms)
    const windowStart = "2026-06-01T00:00:00.000Z";
    const windowEnd = "2026-06-02T00:00:00.000Z";

    // Scenario A: Disjoint intervals
    // 09:00 - 12:00 (3h = 10800000) and 14:00 - 17:00 (3h = 10800000) -> Total 6h (21600000) / 24h (86400000) = 25%
    const recordsA = [
      { start_at: "2026-06-01T09:00:00.000Z", end_at: "2026-06-01T12:00:00.000Z" },
      { start_at: "2026-06-01T14:00:00.000Z", end_at: "2026-06-01T17:00:00.000Z" }
    ];
    const utilA = computeUtilization(recordsA, "booking_period", windowStart, windowEnd);
    assert.ok(utilA instanceof UtilizationRatio, "Utilization should return an exact UtilizationRatio");
    assert.equal(utilA.numerator, 21600000);
    assert.equal(utilA.denominator, 86400000);
    assert.equal(utilA.occupiedMs, 21600000);
    assert.equal(utilA.windowMs, 86400000);
    assert.equal(utilA.occupiedDuration.ms, 21600000);
    assert.equal(utilA.windowDuration.ms, 86400000);
    assert.equal(utilA.toRatio(), 0.25);
    assert.equal(utilA.toPercentage(), 25);
    assert.equal(utilA.toString(), "25%");
    assert.deepEqual(utilA.toJSON(), { type: "ratio", numerator: 21600000, denominator: 86400000 });

    // Scenario B: Overlapping intervals (Union prevents double-counting)
    // 09:00 - 13:00 (4h) and 11:00 - 15:00 (4h) -> Merged: 09:00 - 15:00 (6h) / 24h = 25% (NOT 8h)
    const recordsB = [
      { start_at: "2026-06-01T09:00:00.000Z", end_at: "2026-06-01T13:00:00.000Z" },
      { start_at: "2026-06-01T11:00:00.000Z", end_at: "2026-06-01T15:00:00.000Z" }
    ];
    const utilB = computeUtilization(recordsB, "booking_period", windowStart, windowEnd);
    assert.ok(utilB instanceof UtilizationRatio);
    assert.equal(utilB.numerator, 21600000);
    assert.equal(utilB.denominator, 86400000);
    assert.equal(utilB.toRatio(), 0.25, "Overlapping intervals must be merged with zero double-counting");

    // Scenario C: Intervals extending outside window (Strict clipping)
    // 2026-05-31T20:00:00.000Z - 2026-06-01T06:00:00.000Z (Clipped: 00:00 - 06:00 = 6h)
    // 2026-06-01T18:00:00.000Z - 2026-06-02T06:00:00.000Z (Clipped: 18:00 - 24:00 = 6h)
    // Total inside window = 12h / 24h = 50%
    const recordsC = [
      { start_at: "2026-05-31T20:00:00.000Z", end_at: "2026-06-01T06:00:00.000Z" },
      { start_at: "2026-06-01T18:00:00.000Z", end_at: "2026-06-02T06:00:00.000Z" }
    ];
    const utilC = computeUtilization(recordsC, "booking_period", windowStart, windowEnd);
    assert.ok(utilC instanceof UtilizationRatio);
    assert.equal(utilC.numerator, 43200000);
    assert.equal(utilC.denominator, 86400000);
    assert.equal(utilC.toRatio(), 0.5, "Boundary overflowing intervals must be clipped strictly to analysis window");

    // Scenario D: Touching intervals at boundary
    // 09:00 - 12:00 and 12:00 - 15:00 -> Merged: 09:00 - 15:00 (6h) / 24h = 25%
    const recordsD = [
      { start_at: "2026-06-01T09:00:00.000Z", end_at: "2026-06-01T12:00:00.000Z" },
      { start_at: "2026-06-01T12:00:00.000Z", end_at: "2026-06-01T15:00:00.000Z" }
    ];
    const utilD = computeUtilization(recordsD, "booking_period", windowStart, windowEnd);
    assert.ok(utilD instanceof UtilizationRatio);
    assert.equal(utilD.toRatio(), 0.25);

    // Scenario E: Zero-denominator safety
    const utilZeroWindow = computeUtilization(recordsA, "booking_period", windowStart, windowStart);
    assert.ok(utilZeroWindow instanceof UtilizationRatio);
    assert.equal(utilZeroWindow.numerator, 0);
    assert.equal(utilZeroWindow.denominator, 1);
    assert.equal(utilZeroWindow.toRatio(), 0, "Zero-duration window must return exact canonical 0/1 ratio without NaN/Infinity");
  });

  await t.test("4. Event Duration Correlation (Lifecycle Elapsed Time e.g. Open -> Resolved)", () => {
    const history1 = [
      { event: "created", action: "create", from: null, to: "Open", at: "2026-06-01T10:00:00.000Z" },
      { event: "triaged", action: "triage", from: "Open", to: "Triaged", at: "2026-06-01T10:30:00.000Z" },
      { event: "in_progress", action: "start_work", from: "Triaged", to: "InProgress", at: "2026-06-01T11:00:00.000Z" },
      { event: "resolved", action: "resolve", from: "InProgress", to: "Resolved", at: "2026-06-01T13:00:00.000Z" }
    ];

    // Correlate Open -> Resolved: 10:00 to 13:00 = 3h (10800000 ms)
    const dur1 = correlateEventDurations(history1, "Open", "Resolved");
    assert.ok(dur1 instanceof Duration);
    assert.equal(dur1.ms, 10800000);
    assert.equal(dur1.hours, 3);

    // Correlate Triaged -> Resolved: 10:30 to 13:00 = 2.5h (9000000 ms)
    const dur2 = correlateEventDurations(history1, "Triaged", "Resolved");
    assert.ok(dur2 instanceof Duration);
    assert.equal(dur2.ms, 9000000);
    assert.equal(dur2.hours, 2.5);

    // Incomplete history (Unresolved request: Open -> InProgress, no Resolved yet)
    const historyIncomplete = [
      { event: "created", action: "create", from: null, to: "Open", at: "2026-06-01T10:00:00.000Z" },
      { event: "in_progress", action: "start_work", from: "Open", to: "InProgress", at: "2026-06-01T11:00:00.000Z" }
    ];
    const durIncomplete = correlateEventDurations(historyIncomplete, "Open", "Resolved");
    assert.equal(durIncomplete, null, "Incomplete transition must return null without throwing");
  });

  await t.test("5. Multi-Domain End-to-End: Reservation Hub & Operations Hub Verification", () => {
    // 1. Reservation Hub utilization & duration
    const resAir = `
air version=2
app res_analytics title="Reservation Analytics" initial=overview timezone="UTC"
theme mode=dark accent=violet
capability storage.local

resource rooms label=name
field rooms.name text required
manage rooms lifecycle=delete
access rooms view=role:operator edit=role:operator

resource reservations label=title
field reservations.title text required
field reservations.room ref=rooms required
field reservations.start_at datetime required
field reservations.end_at datetime required
field reservations.booking_period interval start=start_at end=end_at
field reservations.status enum values=Requested,Confirmed,Completed,Cancelled required default=Confirmed
manage reservations lifecycle=delete
access reservations view=role:operator edit=role:operator

overview title="Overview"
insight reservations.room_utilization op=utilization overlaps=booking_period window="2026-06-01T00:00:00.000Z..2026-06-02T00:00:00.000Z" group=room label="Room Utilization"
insight reservations.avg_duration op=avg field=booking_period.duration label="Average Booking Duration"
`;

    const resSeed = {
      rooms: [
        { id: "rm_boardroom", name: "Boardroom" },
        { id: "rm_studio", name: "Podcast Studio" }
      ],
      reservations: [
        // Boardroom: 09:00 - 15:00 = 6h / 24h = 25%
        { id: "r1", title: "Strategy Session", room: "rm_boardroom", start_at: "2026-06-01T09:00:00.000Z", end_at: "2026-06-01T15:00:00.000Z", status: "Confirmed" },
        // Podcast Studio: 10:00 - 16:00 = 6h, and overlapping 12:00 - 18:00 (Merged: 10:00 - 18:00 = 8h / 24h = 33.33%)
        { id: "r2", title: "Recording 1", room: "rm_studio", start_at: "2026-06-01T10:00:00.000Z", end_at: "2026-06-01T16:00:00.000Z", status: "Confirmed" },
        { id: "r3", title: "Recording 2", room: "rm_studio", start_at: "2026-06-01T12:00:00.000Z", end_at: "2026-06-01T18:00:00.000Z", status: "Confirmed" }
      ]
    };

    const resModel = parseAir(resAir);
    const resRuntime = new AppRuntime(resModel, {
      seedData: resSeed,
      principal: { roles: ["operator"] }
    });

    const resOverview = resModel.pageMap.get("overview");
    const utilMetric = resOverview.metrics.find((m) => m.id === "room_utilization");
    const avgDurMetric = resOverview.metrics.find((m) => m.id === "avg_duration");

    const utilBreakdown = resRuntime.metric(utilMetric);
    assert.ok(utilBreakdown.Boardroom instanceof UtilizationRatio);
    assert.ok(utilBreakdown["Podcast Studio"] instanceof UtilizationRatio);
    assert.equal(utilBreakdown.Boardroom.toRatio(), 0.25);
    assert.equal(utilBreakdown.Boardroom.toPercentage(), 25);
    assert.equal(utilBreakdown["Podcast Studio"].toPercentage(), 33);
    assert.equal(resRuntime.formatMetric(utilMetric, utilBreakdown), "Boardroom 25% · Podcast Studio 33%");

    const avgDur = resRuntime.metric(avgDurMetric);
    assert.ok(avgDur instanceof Duration);
    // r1: 6h, r2: 6h, r3: 6h -> Avg: 6h (21600000 ms)
    assert.equal(avgDur.ms, 21600000);
    assert.equal(resRuntime.formatMetric(avgDurMetric, avgDur), "6h");

    // 2. Operations Hub: Time-to-resolution event correlation
    const opsAir = `
air version=2
app ops_analytics title="Operations Analytics" initial=overview timezone="UTC"
theme mode=dark accent=violet
capability storage.local

resource service_requests label=title
field service_requests.title text required
field service_requests.status enum values=Open,InProgress,Resolved,Closed required default=Open
manage service_requests lifecycle=delete
access service_requests view=role:operator edit=role:operator
process service_requests state=status initial=Open terminal=Closed history
transition service_requests.start from=Open to=InProgress action=start by=role:operator event=in_progress
transition service_requests.resolve from=InProgress to=Resolved action=resolve by=role:operator event=resolved
transition service_requests.close from=Resolved to=Closed action=close by=role:operator event=closed

overview title="Overview"
insight service_requests.mttr op=avg source=events.service_requests from=Open to=Resolved label="Mean Time to Resolution"
insight service_requests.max_resolution op=max source=events.service_requests from=Open to=Resolved label="Longest Resolution Time"
`;

    const opsSeed = {
      service_requests: [
        {
          id: "req_1", title: "Database Slowdown", status: "Resolved",
          _air_history: [
            { event: "created", action: "create", from: null, to: "Open", at: "2026-06-01T08:00:00.000Z" },
            { event: "in_progress", action: "start", from: "Open", to: "InProgress", at: "2026-06-01T08:30:00.000Z" },
            { event: "resolved", action: "resolve", from: "InProgress", to: "Resolved", at: "2026-06-01T10:00:00.000Z" } // 2h = 7200000
          ]
        },
        {
          id: "req_2", title: "API Timeout", status: "Resolved",
          _air_history: [
            { event: "created", action: "create", from: null, to: "Open", at: "2026-06-01T09:00:00.000Z" },
            { event: "in_progress", action: "start", from: "Open", to: "InProgress", at: "2026-06-01T09:15:00.000Z" },
            { event: "resolved", action: "resolve", from: "InProgress", to: "Resolved", at: "2026-06-01T13:00:00.000Z" } // 4h = 14400000
          ]
        },
        {
          id: "req_3", title: "Pending Issue", status: "InProgress",
          _air_history: [
            { event: "created", action: "create", from: null, to: "Open", at: "2026-06-01T10:00:00.000Z" },
            { event: "in_progress", action: "start", from: "Open", to: "InProgress", at: "2026-06-01T10:15:00.000Z" }
            // Not resolved yet -> filtered out from completed MTTR
          ]
        }
      ]
    };

    const opsModel = parseAir(opsAir);
    const opsRuntime = new AppRuntime(opsModel, {
      seedData: opsSeed,
      principal: { roles: ["operator"] }
    });

    const opsOverview = opsModel.pageMap.get("overview");
    const mttrMetric = opsOverview.metrics.find((m) => m.id === "mttr");
    const maxResMetric = opsOverview.metrics.find((m) => m.id === "max_resolution");

    // Completed: req_1 (2h) + req_2 (4h) -> Avg: 3h (10800000 ms)
    const mttr = opsRuntime.metric(mttrMetric);
    assert.ok(mttr instanceof Duration);
    assert.equal(mttr.ms, 10800000);
    assert.equal(mttr.hours, 3);
    assert.equal(opsRuntime.formatMetric(mttrMetric, mttr), "3h");

    // Max: req_2 (4h) = 14400000 ms
    const maxRes = opsRuntime.metric(maxResMetric);
    assert.ok(maxRes instanceof Duration);
    assert.equal(maxRes.ms, 14400000);
    assert.equal(opsRuntime.formatMetric(maxResMetric, maxRes), "4h");
  });

  await t.test("6. Visualization IR Duration Measure & Accessible Exact Data Tables with Utilization Ratio", () => {
    const records = [
      { category: "Engineering", duration_ms: 14400000 }, // 4h
      { category: "Design", duration_ms: 7200000 },       // 2h
      { category: "Operations", duration_ms: 10800000 }   // 3h
    ];

    const vizIR = compileVisualizationIR({
      title: "Team Duration Allocation",
      measure: "duration_ms",
      aggregate: "sum",
      dimension: "category",
      format: "duration",
      intent: VISUAL_INTENTS.COMPARE
    }, records);

    assert.equal(vizIR.title, "Team Duration Allocation");
    assert.equal(vizIR.format, "duration");
    assert.equal(vizIR.exactData.length, 3);
    assert.equal(vizIR.exactData[0].formattedValue, "4h");
    assert.equal(vizIR.exactData[1].formattedValue, "2h");
    assert.equal(vizIR.exactData[2].formattedValue, "3h");
    assert.equal(vizIR.formattedGrandTotal, "9h");
    assert.ok(vizIR.accessibleSummary.includes("Total aggregate is 9h"));

    // Exact data table with UtilizationRatio
    const utilRecords = [
      { resource: "Studio A", utilization: new UtilizationRatio(21600000, 86400000) }, // 6h / 24h = 25%
      { resource: "Studio B", utilization: new UtilizationRatio(43200000, 86400000) }  // 12h / 24h = 50%
    ];

    const utilVizIR = compileVisualizationIR({
      title: "Studio Utilization",
      measure: "utilization",
      aggregate: "avg",
      dimension: "resource",
      format: "percentage",
      intent: VISUAL_INTENTS.COMPARE
    }, utilRecords);

    assert.equal(utilVizIR.exactData.length, 2);
    assert.equal(utilVizIR.exactData[0].dimension, "Studio A");
    assert.deepEqual(utilVizIR.exactData[0].ratio, { numerator: 21600000, denominator: 86400000 });
    assert.ok(utilVizIR.exactData[0].occupiedDuration instanceof Duration);
    assert.equal(utilVizIR.exactData[0].occupiedDuration.ms, 21600000);
    assert.ok(utilVizIR.exactData[0].windowDuration instanceof Duration);
    assert.equal(utilVizIR.exactData[0].windowDuration.ms, 86400000);
    assert.equal(utilVizIR.exactData[0].formattedValue, "25%");
  });

  await t.test("7. Performance Benchmark (10, 1,000, and 10,000 Records)", () => {
    const generateRecords = (count) => {
      const records = [];
      const baseTime = Date.parse("2026-06-01T00:00:00.000Z");
      for (let i = 0; i < count; i++) {
        const startMs = baseTime + (i % 100) * 3600000;
        const endMs = startMs + 7200000; // 2 hours
        records.push({
          id: `rec_${i}`,
          start_at: new Date(startMs).toISOString(),
          end_at: new Date(endMs).toISOString(),
          booking_period: {
            start: new Date(startMs).toISOString(),
            end: new Date(endMs).toISOString()
          }
        });
      }
      return records;
    };

    const windowStart = "2026-06-01T00:00:00.000Z";
    const windowEnd = "2026-06-05T00:00:00.000Z";

    // 10 records
    const records10 = generateRecords(10);
    const t0 = performance.now();
    const util10 = computeUtilization(records10, "booking_period", windowStart, windowEnd);
    const time10 = performance.now() - t0;
    assert.ok(time10 < 10, `10 records evaluation took ${time10}ms (<10ms)`);
    assert.ok(util10.toRatio() > 0);

    // 1,000 records
    const records1000 = generateRecords(1000);
    const t1 = performance.now();
    const util1000 = computeUtilization(records1000, "booking_period", windowStart, windowEnd);
    const time1000 = performance.now() - t1;
    assert.ok(time1000 < 50, `1,000 records evaluation took ${time1000}ms (<50ms)`);
    assert.ok(util1000.toRatio() > 0);

    // 10,000 records
    const records10000 = generateRecords(10000);
    const t2 = performance.now();
    const util10000 = computeUtilization(records10000, "booking_period", windowStart, windowEnd);
    const time10000 = performance.now() - t2;
    assert.ok(time10000 < 200, `10,000 records evaluation took ${time10000}ms (<200ms)`);
    assert.ok(util10000.toRatio() > 0);
  });

});
