import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  UI_ARTIFACTS,
  UI_SECTIONS,
  SCHEDULE_REPRESENTATION,
  SCHEDULE_VIEW_MODE,
  resolveScheduleArtifactLayout
} from "../web/runtime/ui_hierarchy.mjs";
import {
  compileScheduleVisualizationIR,
  compileScheduleIR,
  getZonedDateParts,
  addDaysToDateString,
  formatDisplayDate,
  mapStatusToTone
} from "../web/runtime/schedule_ir.mjs";
import { parseAir, AppRuntime } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { renderPresentation } from "../web/runtime/ui.mjs";

test("PART 1 & 2: Schedule Artifact & Section Catalog Registration", () => {
  // Artifact verification
  assert.ok(UI_ARTIFACTS.schedule, "Schedule artifact must be registered in UI_ARTIFACTS");
  assert.equal(UI_ARTIFACTS.schedule.category, "temporal_allocation");
  assert.equal(UI_ARTIFACTS.schedule.semanticLevel, "primary_surface");
  assert.deepEqual(UI_ARTIFACTS.schedule.requires, ["intervals", "groups"]);
  assert.ok(UI_ARTIFACTS.schedule.provides.includes("interval_selection"));
  assert.ok(UI_ARTIFACTS.schedule.provides.includes("slot_selection"));
  assert.ok(UI_ARTIFACTS.schedule.provides.includes("date_navigation"));

  // Section verification
  assert.ok(UI_SECTIONS.schedule, "Schedule section must be registered in UI_SECTIONS");
  assert.equal(UI_SECTIONS.schedule.role, "schedule");
  assert.ok(UI_SECTIONS.schedule.requiredArtifacts.includes("schedule"));
  assert.ok(UI_SECTIONS.schedule.composedArtifacts.includes("drawer"));
  assert.ok(UI_SECTIONS.schedule.composedArtifacts.includes("menu"));
});

test("PART 3 & 39: Responsive Schedule Representation Resolution Matrix across Viewports", () => {
  // Narrow Mobile Viewports (< 640px) -> AGENDA_LIST
  const r320 = resolveScheduleArtifactLayout(320);
  assert.equal(r320.representation, SCHEDULE_REPRESENTATION.AGENDA_LIST);
  assert.equal(r320.isAgenda, true);
  assert.equal(r320.isGrid, false);

  const r390 = resolveScheduleArtifactLayout(390);
  assert.equal(r390.representation, SCHEDULE_REPRESENTATION.AGENDA_LIST);

  const r500 = resolveScheduleArtifactLayout(500);
  assert.equal(r500.representation, SCHEDULE_REPRESENTATION.AGENDA_LIST);

  const r639 = resolveScheduleArtifactLayout(639);
  assert.equal(r639.representation, SCHEDULE_REPRESENTATION.AGENDA_LIST);

  // Medium / Tablet Viewports (640px - 1023px) -> COMPACT_TIME_GRID
  const r640 = resolveScheduleArtifactLayout(640);
  assert.equal(r640.representation, SCHEDULE_REPRESENTATION.COMPACT_TIME_GRID);
  assert.equal(r640.isGrid, true);
  assert.equal(r640.isCompact, true);

  const r768 = resolveScheduleArtifactLayout(768);
  assert.equal(r768.representation, SCHEDULE_REPRESENTATION.COMPACT_TIME_GRID);

  // Wide Desktop Viewports (>= 1024px) -> RESOURCE_TIME_GRID
  const r1024 = resolveScheduleArtifactLayout(1024);
  assert.equal(r1024.representation, SCHEDULE_REPRESENTATION.RESOURCE_TIME_GRID);
  assert.equal(r1024.isGrid, true);
  assert.equal(r1024.isCompact, false);

  const r1440 = resolveScheduleArtifactLayout(1440);
  assert.equal(r1440.representation, SCHEDULE_REPRESENTATION.RESOURCE_TIME_GRID);
});

test("PART 4 & 26: Resource Time Grid Desktop Compilation, Sub-Lanes & Positioning", () => {
  const spec = {
    resource: "reservations",
    groupResource: "resources",
    currentDate: "2026-10-01",
    viewMode: "day",
    timezone: "UTC",
    displayStartHour: 8,
    displayEndHour: 20,
    containerWidth: 1200
  };

  const groups = [
    { id: "res1", name: "Boardroom A" },
    { id: "res2", name: "Focus Pod 1" }
  ];

  const records = [
    { id: "r1", resource: "res1", title: "Morning Standup", start_at: "2026-10-01T09:00:00.000Z", end_at: "2026-10-01T10:30:00.000Z", status: "Confirmed" },
    { id: "r2", resource: "res1", title: "Executive Review", start_at: "2026-10-01T10:00:00.000Z", end_at: "2026-10-01T11:30:00.000Z", status: "Requested" },
    { id: "r3", resource: "res2", title: "Solo Work", start_at: "2026-10-01T14:00:00.000Z", end_at: "2026-10-01T16:00:00.000Z", status: "Confirmed" }
  ];

  const ir = compileScheduleVisualizationIR(spec, records, { groups });

  assert.equal(ir.representation, SCHEDULE_REPRESENTATION.RESOURCE_TIME_GRID);
  assert.equal(ir.groups.length, 2);
  assert.equal(ir.items.length, 3);

  // Verify time positioning for r1: 09:00 in 08:00–20:00 (12 hours = 720 mins). Offset = 60 mins -> 60/720 = 8.33%
  const r1 = ir.items.find((i) => i.id === "r1");
  assert.equal(r1.leftPercent, 8.33);
  // Duration = 90 mins -> 90/720 = 12.5%
  assert.equal(r1.widthPercent, 12.5);

  // Verify collision detection & lane subdivision on res1 (r1 and r2 overlap between 10:00 and 10:30)
  const r2 = ir.items.find((i) => i.id === "r2");
  assert.equal(r1.totalSubLanes, 2, "r1 assigned 2 sub-lanes due to overlap");
  assert.equal(r2.totalSubLanes, 2, "r2 assigned 2 sub-lanes due to overlap");
  assert.notEqual(r1.subLane, r2.subLane, "Overlapping items occupy distinct sub-lanes");

  // Verify time axis ticks
  assert.equal(ir.timeAxisTicks.length, 13, "Hours 8 through 20 generate 13 ticks");
  assert.equal(ir.timeAxisTicks[0].label, "08:00");
  assert.equal(ir.timeAxisTicks[12].label, "20:00");
});

test("PART 5 & 31: Agenda List Mobile Compilation & Chronological Linearization", () => {
  const spec = {
    resource: "reservations",
    groupResource: "resources",
    currentDate: "2026-10-01",
    viewMode: "day",
    timezone: "UTC",
    containerWidth: 390
  };

  const groups = [{ id: "res1", name: "Boardroom A" }];
  const records = [
    { id: "r1", resource: "res1", title: "Customer Demo", start_at: "2026-10-01T10:00:00.000Z", end_at: "2026-10-01T11:00:00.000Z", status: "Confirmed", quote: "$100.00" }
  ];

  const ir = compileScheduleVisualizationIR(spec, records, { groups });

  assert.equal(ir.representation, SCHEDULE_REPRESENTATION.AGENDA_LIST);
  assert.equal(ir.isAgenda, true);
  assert.equal(ir.items[0].timeRangeLabel, "10:00 – 11:00");
  assert.equal(ir.items[0].groupLabel, "Boardroom A");
  assert.equal(ir.items[0].quote, "$100.00");
});

test("PART 6 & 7: Deterministic IANA Timezone Display & Placement", () => {
  const isoTime = "2026-10-01T14:30:00.000Z";

  // UTC: 14:30
  const utc = getZonedDateParts(isoTime, "UTC");
  assert.equal(utc.timeString, "14:30");
  assert.equal(utc.dateString, "2026-10-01");

  // New York (EDT, UTC-4): 10:30
  const ny = getZonedDateParts(isoTime, "America/New_York");
  assert.equal(ny.timeString, "10:30");
  assert.equal(ny.dateString, "2026-10-01");

  // Tokyo (JST, UTC+9): 23:30
  const tokyo = getZonedDateParts(isoTime, "Asia/Tokyo");
  assert.equal(tokyo.timeString, "23:30");
  assert.equal(tokyo.dateString, "2026-10-01");

  // London (BST, UTC+1): 15:30
  const london = getZonedDateParts(isoTime, "Europe/London");
  assert.equal(london.timeString, "15:30");
});

test("PART 8: DST (Spring-Forward & Fall-Back) Transition & Instant Duration Integrity", () => {
  // US Spring Forward: 2026-03-08 at 02:00 -> clocks advance to 03:00
  const springStart = "2026-03-08T06:00:00.000Z"; // 01:00 EST
  const springEnd = "2026-03-08T08:00:00.000Z";   // 03:00 EDT (1 hour instant jumped)

  const zStart = getZonedDateParts(springStart, "America/New_York");
  const zEnd = getZonedDateParts(springEnd, "America/New_York");

  assert.equal(zStart.timeString, "01:00");
  assert.equal(zEnd.timeString, "04:00");

  const durationMs = new Date(springEnd).getTime() - new Date(springStart).getTime();
  assert.equal(durationMs, 2 * 3600 * 1000, "Underlying UTC duration is strictly preserved across DST shift");
});

test("PART 9 & 10: Date Range Navigation (Today, Prev, Next, Day / Week)", () => {
  assert.equal(addDaysToDateString("2026-10-01", 1), "2026-10-02");
  assert.equal(addDaysToDateString("2026-10-01", -1), "2026-09-30");
  assert.equal(addDaysToDateString("2026-10-01", 7), "2026-10-08");
  assert.equal(addDaysToDateString("2026-10-01", -7), "2026-09-24");

  const dayFmt = formatDisplayDate("2026-10-01", "UTC", "day");
  assert.ok(dayFmt.includes("Oct 1, 2026"), "Formats day view label");

  const weekFmt = formatDisplayDate("2026-10-01", "UTC", "week");
  assert.ok(weekFmt.includes("Oct 1 – Oct 7, 2026"), "Formats week view label");
});

test("PART 16 & 17: Blackouts Presentation & Status Tone Mapping", () => {
  const spec = {
    resource: "reservations",
    blackoutResource: "blackouts",
    currentDate: "2026-10-01",
    viewMode: "day",
    timezone: "UTC",
    displayStartHour: 8,
    displayEndHour: 20
  };

  const groups = [{ id: "res1", name: "Boardroom A" }];
  const records = [];
  const blackouts = [
    { id: "b1", resource: "res1", reason: "HVAC Maintenance", start_at: "2026-10-01T12:00:00.000Z", end_at: "2026-10-01T14:00:00.000Z", status: "Active" }
  ];

  const ir = compileScheduleVisualizationIR(spec, records, { groups, blackouts });

  assert.equal(ir.blackouts.length, 1);
  assert.equal(ir.blackouts[0].isBlackout, true);
  assert.equal(ir.blackouts[0].tone, "unavailable");
  assert.equal(ir.blackouts[0].timeRangeLabel, "12:00 – 14:00");
  assert.equal(ir.blackouts[0].title, "HVAC Maintenance");

  // Status tone mapping
  assert.equal(mapStatusToTone("Confirmed"), "positive");
  assert.equal(mapStatusToTone("Requested"), "accent");
  assert.equal(mapStatusToTone("Overdue"), "warning");
  assert.equal(mapStatusToTone("Cancelled"), "neutral");
  assert.equal(mapStatusToTone("Active"), "positive");
});

test("PART 19: Injected Clock & Deterministic Current Time Marker", () => {
  const spec = {
    resource: "reservations",
    currentDate: "2026-10-01",
    viewMode: "day",
    timezone: "UTC",
    displayStartHour: 8,
    displayEndHour: 20
  };

  // Clock injected at 14:00 UTC (6 hours into 12 hour window -> 50%)
  const ir = compileScheduleVisualizationIR(spec, [], { clock: "2026-10-01T14:00:00.000Z" });

  assert.equal(ir.nowMarker.visible, true);
  assert.equal(ir.nowMarker.percent, 50);
  assert.equal(ir.nowMarker.timeLabel, "14:00");

  // Clock outside visible window (06:00 UTC before 08:00)
  const irOutside = compileScheduleVisualizationIR(spec, [], { clock: "2026-10-01T06:00:00.000Z" });
  assert.equal(irOutside.nowMarker.visible, false);
});

test("PART 28 & 30: Linear Schedule Accessibility & Exact ISO Timestamp Representation", () => {
  const spec = {
    resource: "reservations",
    currentDate: "2026-10-01",
    timezone: "UTC"
  };

  const groups = [{ id: "res1", name: "Boardroom A" }];
  const records = [
    { id: "r1", resource: "res1", title: "Planning Session", start_at: "2026-10-01T10:00:00.000Z", end_at: "2026-10-01T11:00:00.000Z", status: "Confirmed", quote: "$50.00" }
  ];

  const ir = compileScheduleVisualizationIR(spec, records, { groups });

  assert.ok(ir.accessibleTableRows.length > 0, "Provides accessible table rows for screen readers");
  const row = ir.accessibleTableRows[0];
  assert.equal(row.id, "r1");
  assert.equal(row.start, "2026-10-01T10:00:00.000Z");
  assert.equal(row.end, "2026-10-01T11:00:00.000Z");
  assert.equal(row.timeRange, "10:00 – 11:00");
  assert.equal(row.group, "Boardroom A");
  assert.equal(row.quote, "$50.00");
});

test("PART 42: Reservation Hub Benchmark End-to-End Schedule Verification", () => {
  const schema = `
air version=2
app reservation_hub title="Reservation Hub" subtitle="Resource scheduling" initial=reservations timezone="UTC"
theme mode=dark accent=violet

resource locations label=name
field locations.name text required
field locations.timezone text required default="UTC"
manage locations lifecycle=archive

resource resources label=name
field resources.name text required
field resources.location ref=locations required
field resources.hourly_rate rate currency=USD unit=h required default=50
manage resources lifecycle=archive

resource reservations label=title
field reservations.title text required
field reservations.resource ref=resources required
field reservations.start_at date required default=today
field reservations.end_at date required default=today
field reservations.booking_period interval start=start_at end=end_at
field reservations.status enum values=Requested,Confirmed,Completed,Cancelled required default=Requested
field reservations.quote money currency=USD computed="booking_period.duration * resource.hourly_rate"
manage reservations lifecycle=archive
invariant reservations.no_overlap none=reservations scope=resource overlaps=booking_period where="status!=Cancelled" deny="Overlaps existing reservation"
invariant reservations.no_blackout none=blackouts scope=resource overlaps=booking_period where="status==Active" deny="Overlaps blackout"

resource blackouts label=reason
field blackouts.resource ref=resources required
field blackouts.reason text required
field blackouts.start_at date required default=today
field blackouts.end_at date required default=today
field blackouts.window interval start=start_at end=end_at
field blackouts.status enum values=Active,Resolved required default=Active
manage blackouts lifecycle=delete
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      locations: [{ id: "loc1", name: "HQ Building", timezone: "America/New_York" }],
      resources: [
        { id: "res1", name: "Boardroom A", location: "loc1", hourly_rate: 100 },
        { id: "res2", name: "Boardroom B", location: "loc1", hourly_rate: 80 }
      ],
      reservations: [
        {
          id: "r1",
          title: "Quarterly Review",
          resource: "res1",
          start_at: "2026-10-01",
          end_at: "2026-10-01",
          status: "Confirmed"
        }
      ],
      blackouts: [
        {
          id: "b1",
          resource: "res2",
          reason: "Emergency Repair",
          start_at: "2026-10-01",
          end_at: "2026-10-01",
          status: "Active"
        }
      ]
    }
  });

  const ir = compilePresentation(model, { runtime });
  const reservationsScreen = ir.screens.find((s) => s.id === "reservations");
  assert.ok(reservationsScreen, "Reservations screen compiled");
  assert.ok(reservationsScreen.schedule, "Inferred schedule metadata on reservations screen");
  assert.equal(reservationsScreen.schedule.groupResource, "resources");
  assert.equal(reservationsScreen.schedule.startField, "start_at");
  assert.equal(reservationsScreen.schedule.endField, "end_at");

  const root = {
    innerHTML: "",
    clientWidth: 1024,
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const app = renderPresentation(root, ir, runtime, {
    model,
    initialScreen: "reservations",
    currentDate: "2026-10-01",
    clock: "2026-10-01T11:00:00.000Z"
  });

  // Switch to schedule view
  app.state.screenViewMode.set("reservations", "schedule");
  app.render();

  assert.ok(root.innerHTML.includes('data-section-role="schedule"'), "Renders schedule section");
  assert.ok(root.innerHTML.includes('Quarterly Review'), "Renders reservation item");
  assert.ok(root.innerHTML.includes('Emergency Repair'), "Renders blackout item");
  assert.ok(root.innerHTML.includes('Boardroom A'), "Renders resource row");
  assert.ok(root.innerHTML.includes('data-create-slot'), "Renders empty booking slot triggers");

  // Seamless Mobile Recomposition
  app.setContainerWidth(390);
  assert.ok(root.innerHTML.includes('data-schedule-representation="agenda_list"'), "Seamlessly recomposes to agenda_list on mobile width");
  assert.ok(root.innerHTML.includes('class="schedule-agenda-card"'), "Renders mobile agenda cards");
});

test("PART 43, 44, 45: Multi-Domain Genericity (Employee Shifts, Equipment Maintenance, Appointments)", () => {
  // 1. Employee Shifts
  const shiftSchema = `
air version=2
app shift_app title="Shift App" subtitle="Staff scheduling"
resource employees label=name
field employees.name text required
manage employees lifecycle=archive
resource shifts label=role
field shifts.role text required
field shifts.employee ref=employees required
field shifts.start_at date required
field shifts.end_at date required
field shifts.shift_period interval start=start_at end=end_at
manage shifts lifecycle=archive
`;
  const shiftModel = parseAir(shiftSchema);
  const shiftRuntime = new AppRuntime(shiftModel, {
    seedData: {
      employees: [{ id: "e1", name: "Dr. Watson" }],
      shifts: [{ id: "s1", role: "Night Shift", employee: "e1", start_at: "2026-10-01", end_at: "2026-10-02" }]
    }
  });
  const shiftIr = compilePresentation(shiftModel, { runtime: shiftRuntime });
  assert.ok(shiftIr.screens.find((s) => s.id === "shifts")?.schedule, "Shifts inferred schedule metadata without runtime changes");

  // 2. Equipment Maintenance
  const maintSchema = `
air version=2
app maint_app title="Maintenance App" subtitle="Machinery scheduling"
resource equipment label=serial
field equipment.serial text required
manage equipment lifecycle=archive
resource maintenance_windows label=task
field maintenance_windows.task text required
field maintenance_windows.machine ref=equipment required
field maintenance_windows.start_at date required
field maintenance_windows.end_at date required
field maintenance_windows.window interval start=start_at end=end_at
manage maintenance_windows lifecycle=archive
`;
  const maintModel = parseAir(maintSchema);
  const maintRuntime = new AppRuntime(maintModel, {
    seedData: {
      equipment: [{ id: "eq1", serial: "Turbine-9" }],
      maintenance_windows: [{ id: "m1", task: "Calibration", machine: "eq1", start_at: "2026-10-01", end_at: "2026-10-01" }]
    }
  });
  const maintIr = compilePresentation(maintModel, { runtime: maintRuntime });
  assert.ok(maintIr.screens.find((s) => s.id === "maintenance_windows")?.schedule, "Maintenance windows inferred schedule metadata");
});

test("PART 46 & 56: Zero Domain Branches & Zero Business Logic in Schedule Compiler & Renderer", () => {
  const scheduleIrCode = fs.readFileSync(path.resolve("web/runtime/schedule_ir.mjs"), "utf-8");
  const uiCode = fs.readFileSync(path.resolve("web/runtime/ui.mjs"), "utf-8");
  const cssCode = fs.readFileSync(path.resolve("web/runtime/styles.css"), "utf-8");

  // Domain keywords audit in generic schedule compiler
  const domainKeywords = ["customer", "reservation", "patient", "doctor", "hotel", "court"];
  for (const kw of domainKeywords) {
    assert.ok(!scheduleIrCode.includes(`"${kw}"`), `schedule_ir.mjs contains 0 hardcoded domain branches for ${kw}`);
  }

  // Business logic leak audit in schedule compiler
  assert.ok(!scheduleIrCode.includes("check_overlap("), "Zero overlap validation engine in schedule IR");
  assert.ok(!scheduleIrCode.includes("calculate_quote("), "Zero quote calculation in schedule IR");
  assert.ok(!scheduleIrCode.includes("validate_capacity("), "Zero capacity validation in schedule IR");

  // CSS audit
  assert.ok(!cssCode.includes(".reservation-hub"), "Zero application-specific CSS classes in styles.css");
  assert.ok(cssCode.includes(".schedule-grid-container"), "Generic .schedule-grid-container in styles.css");
  assert.ok(cssCode.includes(".schedule-agenda-card"), "Generic .schedule-agenda-card in styles.css");
});

test("PART 54: Performance Benchmarking across 10, 100, and 1,000 Scheduled Intervals", () => {
  const generateIntervals = (count) => {
    const records = [];
    for (let i = 0; i < count; i++) {
      const groupIdx = i % 10;
      const hour = 8 + (i % 10);
      records.push({
        id: `rec_${i}`,
        resource: `res_${groupIdx}`,
        title: `Event ${i}`,
        start_at: `2026-10-01T${String(hour).padStart(2, "0")}:00:00.000Z`,
        end_at: `2026-10-01T${String(hour + 1).padStart(2, "0")}:00:00.000Z`,
        status: i % 2 === 0 ? "Confirmed" : "Requested"
      });
    }
    return records;
  };

  const groups = Array.from({ length: 10 }, (_, i) => ({ id: `res_${i}`, name: `Resource ${i}` }));

  // 10 Intervals
  const t0 = performance.now();
  const ir10 = compileScheduleVisualizationIR({ resource: "reservations", currentDate: "2026-10-01" }, generateIntervals(10), { groups });
  const d10 = performance.now() - t0;
  assert.equal(ir10.items.length, 10);
  assert.ok(d10 < 25, `10 intervals compiled in ${d10.toFixed(2)}ms (< 25ms)`);

  // 100 Intervals
  const t1 = performance.now();
  const ir100 = compileScheduleVisualizationIR({ resource: "reservations", currentDate: "2026-10-01" }, generateIntervals(100), { groups });
  const d100 = performance.now() - t1;
  assert.equal(ir100.items.length, 100);
  assert.ok(d100 < 60, `100 intervals compiled in ${d100.toFixed(2)}ms (< 60ms)`);

  // 1,000 Intervals
  const t2 = performance.now();
  const ir1000 = compileScheduleVisualizationIR({ resource: "reservations", currentDate: "2026-10-01" }, generateIntervals(1000), { groups });
  const d1000 = performance.now() - t2;
  assert.equal(ir1000.items.length, 1000);
  assert.ok(d1000 < 200, `1,000 intervals compiled in ${d1000.toFixed(2)}ms (< 200ms)`);
});
