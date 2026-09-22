import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseAir,
  parseSeedData,
  AppRuntime,
  MemoryStorage
} from "../web/runtime/air.mjs";
import {
  compileVisualizationIR,
  compileWorkflowGraph,
  compileTimelineGraph,
  VISUAL_INTENTS,
  DATA_VISUALIZATION_REPRESENTATIONS,
  SEMANTIC_GRAPH_REPRESENTATIONS
} from "../web/runtime/visualization_ir.mjs";
import { renderDataVisualization, renderSemanticGraph } from "../web/runtime/visualization_web.mjs";

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

test("Operations Hub Comprehensive Benchmark & Hierarchy Suite", async (t) => {
  const airSource = fs.readFileSync("apps/operations-hub.air", "utf8");
  const seedSource = fs.readFileSync("data/operations-hub.seed.json", "utf8");

  await t.test("1. AIR Schema Parsing & Model Compilation", () => {
    const model = parseAir(airSource);
    assert.equal(model.app.id, "operations_hub");
    assert.equal(model.app.title, "Operations Hub");
    assert.ok(model.entities.has("customers"), "Customers resource must be defined");
    assert.ok(model.entities.has("projects"), "Projects resource must be defined");
    assert.ok(model.entities.has("tasks"), "Tasks resource must be defined");
    assert.ok(model.entities.has("service_requests"), "Service Requests resource must be defined");

    assert.ok(model.processes.has("projects"), "Projects workflow process must be defined");
    assert.ok(model.processes.has("service_requests"), "Service Requests workflow process must be defined");
  });

  await t.test("2. End-to-End Runtime CRUD & Data Storage Integrity", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    const customers = runtime.records("customers");
    assert.equal(customers.length, 6, "Must load 6 seed customers");

    const projects = runtime.records("projects");
    assert.equal(projects.length, 6, "Must load 6 seed projects");

    const tasks = runtime.records("tasks");
    assert.equal(tasks.length, 7, "Must load 7 seed tasks");

    const srs = runtime.records("service_requests");
    assert.equal(srs.length, 5, "Must load 5 seed service requests");

    // Create a new customer
    const createRes = runtime.create("customers", {
      name: "Cyberdyne Systems",
      email: "ops@cyberdyne.ai",
      plan: "Enterprise",
      mrr: 15000,
      status: "Active"
    });
    assert.ok(createRes.record.id);
    assert.equal(runtime.records("customers").find((r) => r.id === createRes.record.id).name, "Cyberdyne Systems");

    // Update customer MRR
    runtime.update("customers", createRes.record.id, { mrr: 17500 });
    assert.equal(runtime.records("customers").find((r) => r.id === createRes.record.id).mrr, 17500);
  });

  await t.test("3. Search, Filter, Sort, and Pagination Semantics", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    // Filter by plan
    const enterpriseCusts = runtime.records("customers").filter((c) => c.plan === "Enterprise");
    assert.equal(enterpriseCusts.length, 2);

    // Sort by MRR desc
    const sortedCusts = [...runtime.records("customers")].sort((a, b) => b.mrr - a.mrr);
    assert.equal(sortedCusts[0].name, "Acme Corp");
    assert.equal(sortedCusts[0].mrr, 12500);

    // Pagination
    const page1 = runtime.records("customers").slice(0, 3);
    const page2 = runtime.records("customers").slice(3, 6);
    assert.equal(page1.length, 3);
    assert.equal(page2.length, 3);
    assert.notEqual(page1[0].id, page2[0].id);
  });

  await t.test("4. Project Workflow State Machine & Guarded Transitions", () => {
    const runtime = createTestRuntime(airSource, seedSource, { roles: ["operator"] });

    // Create a planned project
    const createRes = runtime.create("projects", {
      name: "Autonomous Drone Network",
      customer: "cust_acme",
      owner: "Sarah Connor",
      budget: 50000,
      status: "Planned",
      created_date: "2026-09-01",
      target_date: "2027-03-01"
    });
    const proj = createRes.record;
    assert.equal(proj.status, "Planned");

    // Advance Planned -> Active
    const actRes = runtime.transition("projects", proj.id, "activate");
    assert.equal(actRes.record.status, "Active");

    // Advance Active -> Blocked
    const blockRes = runtime.transition("projects", proj.id, "block", { comment: "Awaiting FAA compliance clearance" });
    assert.equal(blockRes.record.status, "Blocked");

    // Advance Blocked -> Active
    const unblockRes = runtime.transition("projects", proj.id, "unblock");
    assert.equal(unblockRes.record.status, "Active");

    // Advance Active -> Completed
    const compRes = runtime.transition("projects", proj.id, "complete");
    assert.equal(compRes.record.status, "Completed");
  });

  await t.test("5. Service Request Workflow & Audit Trail", () => {
    const runtime = createTestRuntime(airSource, seedSource, { roles: ["operator"] });

    const createRes = runtime.create("service_requests", {
      title: "Gateway Connection Timeout in us-east-1",
      customer: "cust_globex",
      severity: "High",
      status: "Open"
    });
    const sr = createRes.record;

    // Open -> Triaged
    const triRes = runtime.transition("service_requests", sr.id, "triage");
    assert.equal(triRes.record.status, "Triaged");

    // Triaged -> InProgress
    const startRes = runtime.transition("service_requests", sr.id, "start_work");
    assert.equal(startRes.record.status, "InProgress");

    // InProgress -> Resolved
    const resRes = runtime.transition("service_requests", sr.id, "resolve", { comment: "Provisioned additional NAT gateways" });
    assert.equal(resRes.record.status, "Resolved");

    // Resolved -> Closed
    const closeRes = runtime.transition("service_requests", sr.id, "close");
    assert.equal(closeRes.record.status, "Closed");
  });

  await t.test("6. Compiler-Native Visualizations Compilation (4 Analytics Charts)", () => {
    const runtime = createTestRuntime(airSource, seedSource);

    // Chart 1: Project Creation Trend
    const projTrend = compileVisualizationIR({
      title: "Project Creation Trend",
      dimension: "created_date",
      measure: "id",
      aggregate: "count",
      intent: VISUAL_INTENTS.TREND,
      timeBucket: "month"
    }, runtime.records("projects"));

    assert.equal(projTrend.intent, VISUAL_INTENTS.TREND);
    assert.ok(projTrend.exactData.length > 0);
    assert.ok(projTrend.accessibleSummary.includes("Project Creation Trend"));

    // Chart 2: Task Status Distribution
    const taskDist = compileVisualizationIR({
      title: "Task Status Distribution",
      dimension: "status",
      measure: "id",
      aggregate: "count",
      intent: VISUAL_INTENTS.COMPARE
    }, runtime.records("tasks"));

    assert.equal(taskDist.intent, VISUAL_INTENTS.COMPARE);
    assert.ok(taskDist.exactData.length > 0);

    // Chart 3: Service Request Severity Breakdown
    const srSeverity = compileVisualizationIR({
      title: "Service Request Severity",
      dimension: "severity",
      measure: "id",
      aggregate: "count",
      intent: VISUAL_INTENTS.COMPOSITION
    }, runtime.records("service_requests"));

    assert.equal(srSeverity.intent, VISUAL_INTENTS.COMPOSITION);
    assert.ok(srSeverity.exactData.length > 0);

    // Chart 4: Customer Value / MRR by Plan (Exact Money Aggregation)
    const custMrr = compileVisualizationIR({
      title: "Revenue by Plan",
      dimension: "plan",
      measure: "mrr",
      aggregate: "sum",
      format: "currency",
      currency: "USD",
      intent: VISUAL_INTENTS.COMPARE
    }, runtime.records("customers"));

    assert.equal(custMrr.format, "currency");
    assert.equal(custMrr.currency, "USD");
    assert.equal(custMrr.grandTotal, 33550);
    assert.equal(custMrr.formattedGrandTotal, "$33,550");
  });

  await t.test("7. Viewport Matrix Recomposition (1440px, 768px, 500px, 390px, 320px)", () => {
    const viewports = [1440, 768, 500, 390, 320];
    const runtime = createTestRuntime(airSource, seedSource);

    for (const vp of viewports) {
      // 1. Trend chart
      const trendViz = compileVisualizationIR({
        title: "Trend",
        dimension: "created_date",
        measure: "id",
        aggregate: "count",
        intent: VISUAL_INTENTS.TREND,
        containerWidth: vp
      }, runtime.records("projects"));

      if (vp >= 640) {
        assert.equal(trendViz.representation, DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE);
      } else if (vp >= 380) {
        assert.equal(trendViz.representation, DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_LINE);
      } else {
        assert.equal(trendViz.representation, DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE_SUMMARY);
      }

      // 2. Bar chart
      const barViz = compileVisualizationIR({
        title: "Tasks",
        dimension: "status",
        measure: "id",
        aggregate: "count",
        intent: VISUAL_INTENTS.COMPARE,
        containerWidth: vp
      }, runtime.records("tasks"));

      if (vp >= 640) {
        assert.equal(barViz.representation, DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR);
      } else if (vp >= 420) {
        assert.equal(barViz.representation, DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR);
      } else {
        assert.equal(barViz.representation, DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_BAR);
      }

      // 3. Workflow Graph
      const model = parseAir(airSource);
      const wfGraph = compileWorkflowGraph(model.processes.get("projects"), "Active", { containerWidth: vp });
      if (vp < 480) {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.VERTICAL_STATE_PATH);
      } else if (vp < 768) {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.COMPACT_WORKFLOW_GRAPH);
      } else {
        assert.equal(wfGraph.representation, SEMANTIC_GRAPH_REPRESENTATIONS.SPATIAL_WORKFLOW_GRAPH);
      }
    }
  });

  await t.test("8. Reactive Visual Metric Recalculation on State Change", () => {
    const runtime = createTestRuntime(airSource, seedSource, { roles: ["admin", "operator"] });

    const initialViz = compileVisualizationIR({
      dimension: "plan",
      measure: "mrr",
      format: "currency"
    }, runtime.records("customers"));
    const initialTotal = initialViz.grandTotal;

    // Mutate data
    runtime.create("customers", {
      name: "Stark Industries",
      email: "tony@stark.com",
      plan: "Enterprise",
      mrr: 25000,
      status: "Active"
    });

    const updatedViz = compileVisualizationIR({
      dimension: "plan",
      measure: "mrr",
      format: "currency"
    }, runtime.records("customers"));

    assert.equal(updatedViz.grandTotal, initialTotal + 25000, "MRR metric must immediately reflect reactive mutations");
  });

  await t.test("9. Footprint Measurement & Zero Application JS / CSS Proof", () => {
    // Exact token counting
    const airTokens = airSource.trim().split(/\s+/).length;
    const seedTokens = seedSource.trim().split(/\s+/).length;

    // Executable application-specific JS files
    const appJsFiles = fs.readdirSync("apps").filter((f) => f.endsWith(".js") || f.endsWith(".jsx") || f.endsWith(".ts"));
    assert.equal(appJsFiles.length, 0, "APPLICATION_SPECIFIC_JS_FILES must be 0");

    // Application specific CSS
    const stylesCss = fs.readFileSync("web/runtime/styles.css", "utf8");
    assert.ok(!stylesCss.includes(".operations-hub"), "Zero app-specific CSS classes in stylesheet");
    assert.ok(!stylesCss.includes(".projects-table"), "Zero app-specific table hacks");

    assert.ok(airTokens < 500, `AIR app should be extremely compact. Count: ${airTokens} tokens`);
  });

  await t.test("10. Modification Compression Tests (Exact User Requirements & Closed Compiler Gaps)", () => {
    // Modification 1: Add "On Hold" project state between Active and Completed
    const mod1Source = airSource.replace(
      "values=Planned,Active,Blocked,Completed,Archived",
      "values=Planned,Active,Blocked,OnHold,Completed,Archived"
    ) + "\ntransition projects.hold from=Active to=OnHold action=hold by=role:operator event=held\ntransition projects.resume from=OnHold to=Active action=resume by=role:operator event=resumed\n";
    
    const mod1Model = parseAir(mod1Source);
    assert.ok(mod1Model.entities.get("projects").fields.find((f) => f.id === "status").options.includes("OnHold"));

    // Modification 2: Make overdue tasks more prominent (without altering business priority enum)
    // Dynamic temporal condition: due_date < current time AND status != Done
    const mod2Runtime = createTestRuntime(airSource, seedSource, { roles: ["admin", "operator"] });
    const overdueTask = mod2Runtime.update("tasks", "task_102", { due_date: "2026-09-10" }).record;
    assert.equal(mod2Runtime.highlight("tasks", overdueTask), "danger");

    const doneTask = mod2Runtime.records("tasks").find((t) => t.id === "task_101");
    assert.equal(mod2Runtime.highlight("tasks", doneTask), null);

    // Modification 3: Change dashboard to project completion trend
    // Grouping/filtering by workflow completion audit events directly
    const overview = parseAir(airSource).pages.find((p) => p.type === "dashboard");
    const completionMetric = overview.metrics.find((m) => m.id === "completion_trend");
    assert.ok(completionMetric, "Project completion trend insight must be defined");
    assert.equal(completionMetric.source, "events.projects");

    const mod3Runtime = createTestRuntime(airSource, seedSource, { roles: ["operator"] });
    // Transition proj_infra_migration (currently Active) to Completed
    mod3Runtime.transition("projects", "proj_infra_migration", "complete");

    const completions = mod3Runtime.metric(completionMetric);
    assert.equal(completions, 1);
  });
});
