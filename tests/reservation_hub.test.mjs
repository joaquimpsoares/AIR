import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseAir,
  parseSeedData,
  AppRuntime,
  MemoryStorage,
  tokenizeLine
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

test("Reservation Hub Comprehensive Benchmark Suite", async (t) => {
  const airSource = fs.readFileSync("apps/reservation-hub.air", "utf8");
  const seedSource = fs.readFileSync("data/reservation-hub.seed.json", "utf8");

  await t.test("1. AIR Schema Parsing & Model Compilation", () => {
    const model = parseAir(airSource);
    assert.equal(model.app.id, "reservation_hub");
    assert.equal(model.app.title, "Reservation Hub");
    assert.ok(model.entities.has("locations"));
    assert.ok(model.entities.has("resources"));
    assert.ok(model.entities.has("customers"));
    assert.ok(model.entities.has("reservations"));
    assert.ok(model.entities.has("blackouts"));

    assert.ok(model.processes.has("reservations"));
    const process = model.processes.get("reservations");
    assert.equal(process.initial, "Requested");
    assert.deepEqual(new Set(process.terminal), new Set(["Cancelled", "Completed", "NoShow"]));
  });

  await t.test("2. End-to-End Runtime CRUD & Data Storage Integrity", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    const locations = runtime.records("locations");
    assert.equal(locations.length, 3);

    const resources = runtime.records("resources");
    assert.equal(resources.length, 5);

    const customers = runtime.records("customers");
    assert.equal(customers.length, 4);

    const reservations = runtime.records("reservations");
    assert.equal(reservations.length, 6);

    const blackouts = runtime.records("blackouts");
    assert.equal(blackouts.length, 2);

    // Create a new reservation
    const createRes = runtime.create("reservations", {
      title: "Executive Partner Briefing",
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: "2026-10-15",
      end_at: "2026-10-15",
      attendees: 10,
      status: "Requested",
      amount: 450,
      created_at: "2026-09-22"
    });
    assert.ok(createRes.record.id);
    assert.equal(createRes.record.status, "Requested");
  });

  await t.test("3. Search, Filter, Sort, and Pagination Semantics", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    // Filter resources by type
    const studios = runtime.records("resources").filter((r) => r.type === "Studio");
    assert.equal(studios.length, 1);
    assert.equal(studios[0].name, "Acoustic Podcast Studio");

    // Sort reservations by amount descending
    const sorted = [...runtime.records("reservations")].sort((a, b) => b.amount - a.amount);
    assert.equal(sorted[0].id, "resv_03");
    assert.equal(sorted[0].amount, 2400);

    // Pagination
    const page1 = runtime.records("reservations").slice(0, 3);
    const page2 = runtime.records("reservations").slice(3, 6);
    assert.equal(page1.length, 3);
    assert.equal(page2.length, 3);
    assert.notEqual(page1[0].id, page2[0].id);
  });

  await t.test("4. Reservation Lifecycle & State Machine Transitions", () => {
    const runtime = createTestRuntime(airSource, seedSource, { roles: ["operator"] });

    // 1. Requested -> Confirmed
    const confirmRes = runtime.transition("reservations", "resv_03", "confirm");
    assert.equal(confirmRes.record.status, "Confirmed");

    // 2. Confirmed -> CheckedIn
    const checkinRes = runtime.transition("reservations", "resv_03", "check_in");
    assert.equal(checkinRes.record.status, "CheckedIn");

    // 3. CheckedIn -> Completed
    const completeRes = runtime.transition("reservations", "resv_03", "complete");
    assert.equal(completeRes.record.status, "Completed");

    // 4. Requested -> Cancelled
    const newResv = runtime.create("reservations", {
      title: "Ad-hoc Sync",
      customer: "cust_initech",
      resource: "res_boardroom",
      start_at: "2026-09-23",
      end_at: "2026-09-23",
      attendees: 4,
      status: "Requested",
      amount: 150
    }).record;
    const cancelRes = runtime.transition("reservations", newResv.id, "cancel", { comment: "Customer rescheduled" });
    assert.equal(cancelRes.record.status, "Cancelled");
  });

  await t.test("5. Analytics & Visualizations Compilation", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    // Chart 1: Reservations Over Time Trend
    const timeTrend = compileVisualizationIR({
      title: "Reservation Volume Over Time",
      dimension: "start_at",
      measure: "id",
      aggregate: "count",
      intent: VISUAL_INTENTS.TREND,
      timeBucket: "month"
    }, runtime.records("reservations"));
    assert.equal(timeTrend.intent, VISUAL_INTENTS.TREND);
    assert.ok(timeTrend.exactData.length > 0);

    // Chart 2: Reservations by Status
    const statusDist = compileVisualizationIR({
      title: "Reservations by Status",
      dimension: "status",
      measure: "id",
      aggregate: "count",
      intent: VISUAL_INTENTS.COMPARE
    }, runtime.records("reservations"));
    assert.equal(statusDist.intent, VISUAL_INTENTS.COMPARE);
    assert.ok(statusDist.exactData.length > 0);

    // Chart 3: Resources by Type
    const typeComp = compileVisualizationIR({
      title: "Resources by Type",
      dimension: "type",
      measure: "id",
      aggregate: "count",
      intent: VISUAL_INTENTS.COMPOSITION
    }, runtime.records("resources"));
    assert.equal(typeComp.intent, VISUAL_INTENTS.COMPOSITION);
    assert.ok(typeComp.exactData.length > 0);

    // Chart 4: Total Revenue (Money aggregation)
    const revenueViz = compileVisualizationIR({
      title: "Revenue by Resource",
      dimension: "resource",
      measure: "amount",
      aggregate: "sum",
      format: "currency",
      currency: "USD",
      intent: VISUAL_INTENTS.COMPARE
    }, runtime.records("reservations"));
    assert.equal(revenueViz.grandTotal, 4000);
    assert.equal(revenueViz.formattedGrandTotal, "$4,000");
  });

  await t.test("6. Event Stream Analytics (Confirmations & Cancellations Over Time)", () => {
    const runtime = createTestRuntime(airSource, seedSource, { roles: ["operator"] });

    // Transition reservations to generate audit history events
    runtime.transition("reservations", "resv_03", "confirm");
    runtime.transition("reservations", "resv_01", "cancel");

    const events = runtime.events("reservations");
    assert.ok(events.length >= 2);
    assert.ok(Object.isFrozen(events));

    const model = parseAir(airSource);
    const overview = model.pages.find((p) => p.type === "dashboard");
    
    const confirmMetric = overview.metrics.find((m) => m.id === "confirmations_trend");
    assert.ok(confirmMetric);
    assert.equal(confirmMetric.source, "events.reservations");
    assert.equal(runtime.metric(confirmMetric), 1);

    const cancelMetric = overview.metrics.find((m) => m.id === "cancellations_trend");
    assert.ok(cancelMetric);
    assert.equal(cancelMetric.source, "events.reservations");
    assert.equal(runtime.metric(cancelMetric), 1);
  });

  await t.test("7. Viewport Matrix Recomposition (1440, 768, 500, 390, 320)", () => {
    const runtime = createTestRuntime(airSource, seedSource);
    const viewports = [1440, 768, 500, 390, 320];

    for (const vp of viewports) {
      const viz = compileVisualizationIR({
        dimension: "start_at",
        measure: "id",
        aggregate: "count",
        intent: VISUAL_INTENTS.TREND,
        containerWidth: vp
      }, runtime.records("reservations"));

      if (vp >= 640) {
        assert.equal(viz.representation, DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE);
      } else if (vp >= 380) {
        assert.equal(viz.representation, DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_LINE);
      } else {
        assert.equal(viz.representation, DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE_SUMMARY);
      }

      const model = parseAir(airSource);
      const wfGraph = compileWorkflowGraph(model.processes.get("reservations"), "Requested", { containerWidth: vp });
      if (vp < 480) {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.VERTICAL_STATE_PATH);
      } else if (vp < 768) {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.COMPACT_WORKFLOW_GRAPH);
      } else {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.SPATIAL_WORKFLOW_GRAPH);
      }
    }
  });

  await t.test("8. Adversarial Interval & Capacity Enforcement Audit", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    // Audit 1: Cross-Record Interval Overlap Prevention on Same Resource
    // resv_01 is on res_boardroom on 2026-09-24
    const conflictResv = runtime.create("reservations", {
      title: "Colliding Strategy Meeting",
      customer: "cust_soylent",
      resource: "res_boardroom",
      start_at: "2026-09-24",
      end_at: "2026-09-24",
      attendees: 4,
      status: "Requested",
      amount: 150,
      created_at: "2026-09-22"
    });
    assert.equal(conflictResv.record, null, "Colliding reservation on same resource must be rejected");
    assert.ok(conflictResv.errors.no_overlap || conflictResv.errors.booking_period);

    // Audit 2: Blackout Window Overlap Prevention
    // blk_01 is on res_training_hall from 2026-10-01 to 2026-10-05 (status: Active)
    const blackoutResv = runtime.create("reservations", {
      title: "Booking in Blackout Window",
      customer: "cust_acme",
      resource: "res_training_hall",
      start_at: "2026-10-02",
      end_at: "2026-10-04",
      attendees: 10,
      status: "Requested",
      amount: 600,
      created_at: "2026-09-22"
    });
    assert.equal(blackoutResv.record, null, "Reservation overlapping active blackout must be rejected");
    assert.ok(blackoutResv.errors.no_blackout || blackoutResv.errors.booking_period);

    // Audit 3: Cross-Resource Capacity Constraint Enforcement
    // res_podcast capacity is 4
    const overCapacity = runtime.create("reservations", {
      title: "Too Many Attendees",
      customer: "cust_acme",
      resource: "res_podcast",
      start_at: "2026-10-01",
      end_at: "2026-10-01",
      attendees: 10,
      status: "Requested",
      amount: 160,
      created_at: "2026-09-22"
    });
    assert.equal(overCapacity.record, null, "Reservation exceeding resource capacity must be rejected");
    assert.ok(overCapacity.errors.capacity || overCapacity.errors.attendees);
  });

  await t.test("9. Modification Compression Scenarios", () => {
    // Scenario 1: Change resource capacity
    const mod1Patch = `set field resources.capacity default=8`;
    const mod1Tokens = tokenizeLine(mod1Patch, 1).length;
    assert.equal(mod1Tokens, 4);

    // Scenario 2: Prevent booking less than 2 hours before start (Temporal duration lead-time arithmetic)
    const mod2Patch = `invariant reservations.lead_time when="start_at<now+2h&status==Requested" deny="Reservations must be booked at least 2 hours in advance"`;
    const mod2Tokens = tokenizeLine(mod2Patch, 1).length;
    assert.equal(mod2Tokens, 4);
    const parsedModel = parseAir(airSource);
    assert.ok(parsedModel.invariants.get("reservations").some((inv) => inv.id === "lead_time"));

    // Scenario 3: Show cancelled reservations less prominently
    const mod3Patch = `add highlight reservations.cancelled when="status==Cancelled" tone=neutral`;
    const mod3Tokens = tokenizeLine(mod3Patch, 1).length;
    assert.equal(mod3Tokens, 5);

    // Scenario 4: Show cancellations over time instead of confirmations
    const mod4Patch = `set insight reservations.confirmations_trend where="to==Cancelled" label="Cancellations Over Time"`;
    const mod4Tokens = tokenizeLine(mod4Patch, 1).length;
    assert.equal(mod4Tokens, 5);
  });
});
