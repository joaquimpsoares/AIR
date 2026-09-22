import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AppRuntime, parseAir, parseSeedData } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import {
  UI_EXPERIENCES,
  UI_SECTIONS,
  UI_ARTIFACTS,
  discoverUiCapability,
  resolveDataStorySectionLayout,
  resolveDataVisualizationLayout,
  resolveSemanticGraphLayout
} from "../web/runtime/ui_hierarchy.mjs";
import {
  compileVisualizationIR,
  compileWorkflowGraph,
  compileTimelineGraph,
  VISUAL_INTENTS
} from "../web/runtime/visualization_ir.mjs";
import {
  renderDataVisualization,
  renderSemanticGraph
} from "../web/runtime/visualization_web.mjs";

test("PART 1: UI Hierarchy Catalog Extension for Visual Data & Graphs", () => {
  // 1. Data Visualization Artifact Registered
  assert.ok(UI_ARTIFACTS.data_visualization);
  assert.equal(UI_ARTIFACTS.data_visualization.id, "data_visualization");
  assert.deepEqual(UI_ARTIFACTS.data_visualization.requires, ["intent", "measure", "dimension"]);
  assert.ok(UI_ARTIFACTS.data_visualization.provides.includes("exact_table_toggle"));

  // 2. Semantic Graph Artifact Registered
  assert.ok(UI_ARTIFACTS.semantic_graph);
  assert.equal(UI_ARTIFACTS.semantic_graph.id, "semantic_graph");
  assert.deepEqual(UI_ARTIFACTS.semantic_graph.requires, ["mode", "nodes", "edges"]);

  // 3. Data Story Section Registered
  assert.ok(UI_SECTIONS.data_story);
  assert.equal(UI_SECTIONS.data_story.role, "data_story");
  assert.ok(UI_SECTIONS.data_story.composedArtifacts.includes("data_visualization"));

  // 4. Capability Discovery finds data visualization and graph
  const disc1 = discoverUiCapability("data_visualization");
  assert.equal(disc1.level, "ARTIFACT");
  assert.equal(disc1.match.id, "data_visualization");

  const disc2 = discoverUiCapability("semantic_graph");
  assert.equal(disc2.level, "ARTIFACT");
  assert.equal(disc2.match.id, "semantic_graph");

  const disc3 = discoverUiCapability("data_story");
  assert.equal(disc3.level, "SECTION");
  assert.equal(disc3.match.role, "data_story");
});

test("PART 2: Multi-App Proof: Customer Management Visual Data Compilation", () => {
  const source = fs.readFileSync("apps/customer-manager.air", "utf8");
  const seedSource = fs.readFileSync("data/customer-manager.seed.json", "utf8");
  const customerModel = parseAir(source);
  const seedData = parseSeedData(seedSource, customerModel);
  const runtime = new AppRuntime(customerModel, { seedData });

  // 1. Revenue Comparison by Status (Compare Intent)
  const statusVizIr = compileVisualizationIR({
    id: "cust_by_status",
    title: "Revenue by Customer Status",
    intent: VISUAL_INTENTS.COMPARE,
    measure: "monthly_revenue",
    aggregate: "sum",
    dimension: "status",
    format: "currency",
    currency: "USD",
    containerWidth: 1024
  }, runtime.records("customers"));

  assert.equal(statusVizIr.intent, "compare");
  assert.ok(statusVizIr.grandTotal > 0);
  assert.ok(statusVizIr.exactData.length >= 2);

  // 2. Revenue Trend over Time (Trend Intent)
  const trendVizIr = compileVisualizationIR({
    id: "cust_rev_trend",
    title: "Customer Revenue Over Time",
    intent: VISUAL_INTENTS.TREND,
    measure: "monthly_revenue",
    aggregate: "sum",
    dimension: "joined",
    format: "currency",
    currency: "USD",
    containerWidth: 1024
  }, runtime.records("customers"));

  assert.equal(trendVizIr.intent, "trend");
  assert.equal(trendVizIr.representation, "full_line");
  assert.ok(trendVizIr.categories.length >= 1);

  // 3. Render HTML
  const html = renderDataVisualization(trendVizIr);
  assert.ok(html.includes("Customer Revenue Over Time"));
  assert.ok(html.includes('class="viz-line-path"'));
  assert.ok(html.includes('class="data-table viz-data-table"'));
});

test("PART 3: Multi-App Proof: Expense Approval Workflow Graph & Spend Visualization", () => {
  const source = fs.readFileSync("apps/expense-approval.air", "utf8");
  const seedSource = fs.readFileSync("data/expense-approval.seed.json", "utf8");
  const expenseModel = parseAir(source);
  const seedData = parseSeedData(seedSource, expenseModel);
  const runtime = new AppRuntime(expenseModel, { seedData });

  // 1. Workflow State Graph for first expense
  const firstRecord = runtime.records("expenses")[0];
  const proc = expenseModel.processes.get ? expenseModel.processes.get("expenses") : expenseModel.processes[0];
  const workflowIr = compileWorkflowGraph(proc, firstRecord, { containerWidth: 1024 });
  assert.equal(workflowIr.currentState, firstRecord.status);
  assert.ok(workflowIr.nodes.length >= 3);
  assert.ok(workflowIr.edges.length >= 2);

  const wfHtml = renderSemanticGraph(workflowIr);
  assert.ok(wfHtml.includes("Workflow State Graph"));

  // 2. Spend by Category Visualization
  const spendVizIr = compileVisualizationIR({
    id: "spend_by_cat",
    title: "Spend by Category",
    intent: VISUAL_INTENTS.COMPARE,
    measure: "amount",
    aggregate: "sum",
    dimension: "category",
    format: "currency",
    containerWidth: 1024
  }, runtime.records("expenses"));

  assert.ok(spendVizIr.grandTotal > 0);
  assert.ok(spendVizIr.exactData.length >= 2);
});

test("PART 4: Viewport Matrix Testing (1440, 768, 500, 390, 320) Across Visual & Graph IR", () => {
  const sampleData = [
    { date: "2026-01-01", val: 10 },
    { date: "2026-02-01", val: 25 },
    { date: "2026-03-01", val: 18 }
  ];

  const viewports = [1440, 768, 500, 390, 320];

  for (const width of viewports) {
    const vizIr = compileVisualizationIR({
      id: `viz_vp_${width}`,
      title: "Trend",
      intent: VISUAL_INTENTS.TREND,
      measure: "val",
      dimension: "date",
      containerWidth: width
    }, sampleData, { containerWidth: width });

    assert.ok(vizIr.representation);
    if (width >= 640) {
      assert.equal(vizIr.representation, "full_line");
    } else if (width >= 380) {
      assert.equal(vizIr.representation, "compact_line");
    } else {
      assert.equal(vizIr.representation, "sparkline_summary");
    }

    const html = renderDataVisualization(vizIr);
    assert.ok(html.length > 50);
  }
});

test("PART 5: Zero Application-Specific CSS Verification", () => {
  const css = fs.readFileSync(path.resolve("web/runtime/styles.css"), "utf8");

  // Invariant: No customer, project, task, expense, or domain-specific names in CSS selectors
  const forbiddenSelectors = [
    /\.customer-table/i,
    /\.project-table/i,
    /\.task-table/i,
    /\.expense-chart/i,
    /\.customer-chart/i,
    /\.revenue-bar/i,
    /\.user-graph/i
  ];

  for (const pattern of forbiddenSelectors) {
    assert.ok(!pattern.test(css), `Forbidden domain-specific selector found matching: ${pattern}`);
  }
});
