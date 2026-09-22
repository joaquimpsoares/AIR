import test from "node:test";
import assert from "node:assert/strict";
import { parseAir, AppRuntime } from "../web/runtime/air.mjs";
import {
  parseMoneyToMinorUnits,
  roundHalfAwayFromZero,
  formatDimensionKey
} from "../web/runtime/visualization_ir.mjs";

const testModelSource = `
air version=2
app test_suite title="Semantic Time & Events Suite" timezone="Europe/Madrid"
resource tasks singular=Task plural=Tasks label=title
field tasks.title text required=true
field tasks.status enum values=Todo,InProgress,Done default=Todo
field tasks.due_date date
manage tasks create=true edit=true delete=true lifecycle=archive

highlight tasks.overdue when="due_date<today&status!=Done" tone=danger
highlight tasks.done when="status==Done" tone=positive

resource projects singular=Project plural=Projects label=name
field projects.name text required=true
field projects.status enum values=Planning,Active,Completed default=Planning
manage projects create=true edit=true delete=true lifecycle=archive

process projects state=status initial=Planning terminal=Completed history=true
transition projects.start from=Planning to=Active action=start by=role:operator event=started
transition projects.complete from=Active to=Completed action=complete by=role:operator event=completed

overview title="Operations Hub Overview"
insight projects.completion_trend op=count source=events.projects where="to==Completed" label="Project Completion Trend"
`;

test("business timezone determinism and clock injection", () => {
  const model = parseAir(testModelSource);
  assert.equal(model.app.timezone, "Europe/Madrid");

  // UTC instant: 2026-03-31T23:30:00Z -> In Europe/Madrid (UTC+2 DST) it is 2026-04-01T01:30:00
  const clock = () => new Date("2026-03-31T23:30:00Z");
  const runtime = new AppRuntime(model, { clock });

  assert.equal(runtime.currentDate(), "2026-04-01");
  assert.equal(runtime.currentDate("UTC"), "2026-03-31");
  assert.equal(runtime.currentDate("America/New_York"), "2026-03-31");
});

test("formatDimensionKey respects business timezone", () => {
  // 2026-03-31 23:30 UTC -> month in Europe/Madrid is "Apr 2026", in UTC is "Mar 2026"
  const utcFormatted = formatDimensionKey("2026-03-31T23:30:00Z", "date", "month", { timezone: "UTC" });
  assert.equal(utcFormatted, "Mar 2026");

  const madridFormatted = formatDimensionKey("2026-03-31T23:30:00Z", "date", "month", { timezone: "Europe/Madrid" });
  assert.equal(madridFormatted, "Apr 2026");
});

test("temporal comparison in highlight: overdue tasks highlighted dynamically", () => {
  const model = parseAir(testModelSource);
  // Base clock: 2026-09-22
  const clock = () => new Date("2026-09-22T10:00:00Z");
  const runtime = new AppRuntime(model, {
    clock,
    seedData: {
      tasks: [
        { id: "t_overdue", title: "Audit security logs", due_date: "2026-09-20", status: "InProgress" },
        { id: "t_future", title: "Deploy release", due_date: "2026-09-25", status: "InProgress" },
        { id: "t_done_past", title: "Initial setup", due_date: "2026-09-15", status: "Done" },
        { id: "t_today", title: "Check metrics", due_date: "2026-09-22", status: "Todo" }
      ]
    }
  });

  const overdue = runtime.records("tasks").find((t) => t.id === "t_overdue");
  const future = runtime.records("tasks").find((t) => t.id === "t_future");
  const donePast = runtime.records("tasks").find((t) => t.id === "t_done_past");
  const todayTask = runtime.records("tasks").find((t) => t.id === "t_today");

  assert.equal(runtime.highlight("tasks", overdue), "danger");
  assert.equal(runtime.highlight("tasks", future), null);
  assert.equal(runtime.highlight("tasks", donePast), "positive");
  assert.equal(runtime.highlight("tasks", todayTask), null);
});

test("read-only event stream projection and event metrics", () => {
  const model = parseAir(testModelSource);
  let now = new Date("2026-09-20T10:00:00Z");
  const runtime = new AppRuntime(model, {
    clock: () => now,
    principal: { roles: ["operator"] },
    seedData: {
      projects: [
        { id: "p1", name: "Alpha", status: "Planning" },
        { id: "p2", name: "Beta", status: "Active" }
      ]
    }
  });

  // Perform transitions
  now = new Date("2026-09-21T11:00:00Z");
  runtime.transition("projects", "p1", "start");

  now = new Date("2026-09-22T14:00:00Z");
  runtime.transition("projects", "p1", "complete");

  now = new Date("2026-09-23T09:00:00Z");
  runtime.transition("projects", "p2", "complete");

  const events = runtime.events("projects");
  assert.ok(events.length >= 3);
  assert.ok(Object.isFrozen(events));

  // Query overview insight on events.projects
  const overview = model.pages.find((p) => p.type === "dashboard");
  const completionMetric = overview.metrics.find((m) => m.id === "completion_trend");
  assert.ok(completionMetric);

  const completionCount = runtime.metric(completionMetric);
  assert.equal(completionCount, 2);
});

test("exact minor units parsing and symmetric half-away-from-zero rounding", () => {
  assert.equal(parseMoneyToMinorUnits("1250000.50"), 125000050n);
  assert.equal(parseMoneyToMinorUnits("-1250000.50"), -125000050n);
  assert.equal(parseMoneyToMinorUnits("0.01"), 1n);
  assert.equal(parseMoneyToMinorUnits("-0.01"), -1n);

  assert.equal(roundHalfAwayFromZero(0.5), 1);
  assert.equal(roundHalfAwayFromZero(-0.5), -1);
  assert.equal(roundHalfAwayFromZero(1.5), 2);
  assert.equal(roundHalfAwayFromZero(-1.5), -2);
});
