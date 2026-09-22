import test from "node:test";
import assert from "node:assert/strict";
import {
  VISUALIZATION_IR_VERSION,
  VISUAL_INTENTS,
  DATA_VISUALIZATION_REPRESENTATIONS,
  SEMANTIC_GRAPH_MODES,
  SEMANTIC_GRAPH_REPRESENTATIONS,
  VISUAL_PALETTE,
  autoSelectVisualRepresentation,
  resolveResponsiveVisualization,
  compileVisualizationIR,
  compileWorkflowGraph,
  compileTimelineGraph,
  compileDagGraph
} from "../web/runtime/visualization_ir.mjs";

test("PART 1: Visualization IR Constants & Intent Vocabulary", () => {
  assert.equal(VISUALIZATION_IR_VERSION, 1);
  assert.equal(VISUAL_INTENTS.TREND, "trend");
  assert.equal(VISUAL_INTENTS.COMPARE, "compare");
  assert.equal(VISUAL_INTENTS.DISTRIBUTION, "distribution");
  assert.equal(VISUAL_INTENTS.RELATIONSHIP, "relationship");
  assert.equal(VISUAL_INTENTS.COMPOSITION, "composition");
  assert.equal(VISUAL_INTENTS.PROGRESS, "progress");

  assert.equal(DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE, "full_line");
  assert.equal(DATA_VISUALIZATION_REPRESENTATIONS.COMPACT_LINE, "compact_line");
  assert.equal(DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR, "vertical_bar");
  assert.equal(DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR, "horizontal_bar");
  assert.equal(DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR, "stacked_bar");
  assert.equal(DATA_VISUALIZATION_REPRESENTATIONS.FULL_SCATTER, "full_scatter");
  assert.equal(DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE, "sparkline");

  assert.equal(SEMANTIC_GRAPH_MODES.WORKFLOW, "workflow");
  assert.equal(SEMANTIC_GRAPH_MODES.TIMELINE, "timeline");
  assert.equal(SEMANTIC_GRAPH_MODES.DAG, "dag");

  assert.ok(VISUAL_PALETTE.length >= 6);
  assert.equal(VISUAL_PALETTE[0].id, "primary");
});

test("PART 2: Intent-Driven Auto-Selection of Representation", () => {
  // Trend with time series -> Full Line
  assert.equal(
    autoSelectVisualRepresentation(VISUAL_INTENTS.TREND, { isTimeSeries: true }),
    DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE
  );

  // Trend with composition -> Full Area
  assert.equal(
    autoSelectVisualRepresentation(VISUAL_INTENTS.TREND, { isTimeSeries: true, isComposition: true }),
    DATA_VISUALIZATION_REPRESENTATIONS.FULL_AREA
  );

  // Compare categorical with small count (<= 6) -> Vertical Bar
  assert.equal(
    autoSelectVisualRepresentation(VISUAL_INTENTS.COMPARE, { dimensionType: "category", categoryCount: 4 }),
    DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR
  );

  // Compare categorical with large count (> 6) -> Horizontal Bar
  assert.equal(
    autoSelectVisualRepresentation(VISUAL_INTENTS.COMPARE, { dimensionType: "category", categoryCount: 9 }),
    DATA_VISUALIZATION_REPRESENTATIONS.HORIZONTAL_BAR
  );

  // Compare with secondary dimension -> Stacked Bar
  assert.equal(
    autoSelectVisualRepresentation(VISUAL_INTENTS.COMPARE, { hasSecondaryDimension: true }),
    DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR
  );

  // Relationship intent -> Full Scatter
  assert.equal(
    autoSelectVisualRepresentation(VISUAL_INTENTS.RELATIONSHIP, { dimensionType: "number", numericMeasureCount: 2 }),
    DATA_VISUALIZATION_REPRESENTATIONS.FULL_SCATTER
  );

  // Progress intent -> Sparkline Summary
  assert.equal(
    autoSelectVisualRepresentation(VISUAL_INTENTS.PROGRESS, {}),
    DATA_VISUALIZATION_REPRESENTATIONS.SPARKLINE_SUMMARY
  );
});

test("PART 3: Responsive Visualization Recomposition (Minimum Viable Visual Width)", () => {
  // Line chart: 1024 -> full_line, 500 -> compact_line, 320 -> sparkline_summary
  assert.equal(resolveResponsiveVisualization(DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE, 1024), "full_line");
  assert.equal(resolveResponsiveVisualization(DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE, 500), "compact_line");
  assert.equal(resolveResponsiveVisualization(DATA_VISUALIZATION_REPRESENTATIONS.FULL_LINE, 320), "sparkline_summary");

  // Vertical Bar: 1024 -> vertical_bar, 500 -> horizontal_bar, 320 -> compact_bar
  assert.equal(resolveResponsiveVisualization(DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR, 1024), "vertical_bar");
  assert.equal(resolveResponsiveVisualization(DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR, 500), "horizontal_bar");
  assert.equal(resolveResponsiveVisualization(DATA_VISUALIZATION_REPRESENTATIONS.VERTICAL_BAR, 320), "compact_bar");

  // Stacked Bar: 1024 -> stacked_bar, 400 -> horizontal_bar
  assert.equal(resolveResponsiveVisualization(DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR, 1024), "stacked_bar");
  assert.equal(resolveResponsiveVisualization(DATA_VISUALIZATION_REPRESENTATIONS.STACKED_BAR, 400), "horizontal_bar");
});

test("PART 4: Compilation of Visualization IR with Aggregations and Exact Data Tables", () => {
  const sampleRecords = [
    { id: "cust_1", status: "active", revenue: 15000, joined: "2026-01-15", segment: "enterprise" },
    { id: "cust_2", status: "active", revenue: 25000, joined: "2026-02-10", segment: "smb" },
    { id: "cust_3", status: "trial", revenue: 5000, joined: "2026-02-14", segment: "enterprise" },
    { id: "cust_4", status: "inactive", revenue: 2000, joined: "2026-03-01", segment: "smb" },
    { id: "cust_5", status: "active", revenue: 30000, joined: "2026-03-12", segment: "enterprise" }
  ];

  // 1. Revenue by Status (Category Comparison)
  const vizIr = compileVisualizationIR({
    id: "revenue_by_status",
    title: "Revenue by Status",
    intent: VISUAL_INTENTS.COMPARE,
    measure: "revenue",
    aggregate: "sum",
    dimension: "status",
    format: "currency",
    currency: "USD",
    containerWidth: 1024
  }, sampleRecords);

  assert.equal(vizIr.id, "revenue_by_status");
  assert.equal(vizIr.intent, "compare");
  assert.equal(vizIr.representation, "vertical_bar");
  assert.equal(vizIr.grandTotal, 77000);
  assert.ok(vizIr.formattedGrandTotal.includes("77,000"));

  // Check Categories and Points
  assert.deepEqual(vizIr.categories, ["Active", "Trial", "Inactive"]);
  assert.equal(vizIr.exactData.length, 3);
  
  // Active: 15k + 25k + 30k = 70k (91% share)
  const activeRow = vizIr.exactData.find((r) => r.dimension === "Active");
  assert.equal(activeRow.value, 70000);
  assert.equal(activeRow.percentage, 91);
  assert.equal(activeRow.count, 3);

  // Check Accessible Summary
  assert.ok(vizIr.accessibleSummary.includes("Revenue by Status"));
  assert.ok(vizIr.accessibleSummary.includes("77,000"));
  assert.ok(vizIr.accessibleSummary.includes("Active"));

  // Check Y-Axis Nice Ticks
  assert.ok(vizIr.yAxis.ticks.length >= 2);
  assert.equal(vizIr.yAxis.ticks[0].value, 0);
});

test("PART 5: Time Series Trend Compilation & Multi-Series Stack", () => {
  const monthlyData = [
    { date: "2026-01-01", category: "software", amount: 1200 },
    { date: "2026-01-01", category: "travel", amount: 800 },
    { date: "2026-02-01", category: "software", amount: 1500 },
    { date: "2026-02-01", category: "travel", amount: 600 },
    { date: "2026-03-01", category: "software", amount: 2000 },
    { date: "2026-03-01", category: "travel", amount: 1100 }
  ];

  const trendIr = compileVisualizationIR({
    id: "spend_trend",
    title: "Monthly Spend",
    intent: VISUAL_INTENTS.TREND,
    measure: "amount",
    aggregate: "sum",
    dimension: "date",
    secondaryDimension: "category",
    format: "currency",
    currency: "USD",
    containerWidth: 1024
  }, monthlyData);

  assert.equal(trendIr.intent, "trend");
  assert.equal(trendIr.categories.length, 3);
  assert.equal(trendIr.series.length, 2); // software & travel series
  assert.ok(trendIr.series.some((s) => s.id === "software"));
  assert.ok(trendIr.series.some((s) => s.id === "travel"));
});

test("PART 6: Workflow Graph IR Compilation", () => {
  const expenseWorkflow = {
    id: "expenses",
    states: ["Draft", "Submitted", "Approved", "Paid"],
    transitions: [
      { from: "Draft", to: "Submitted", action: "submit", by: "creator" },
      { from: "Submitted", to: "Approved", action: "approve", by: "manager", when: "amount <= 5000", separate: "distinct_actor" },
      { from: "Approved", to: "Paid", action: "pay", by: "finance" }
    ]
  };

  const currentRecord = { id: "exp_101", status: "Submitted", amount: 1200 };

  const graphIr = compileWorkflowGraph(expenseWorkflow, currentRecord, { containerWidth: 1024 });

  assert.equal(graphIr.mode, "workflow");
  assert.equal(graphIr.representation, "spatial_workflow_graph");
  assert.equal(graphIr.currentState, "Submitted");
  assert.equal(graphIr.nodes.length, 4);
  assert.equal(graphIr.edges.length, 3);

  // Check node statuses
  const draftNode = graphIr.nodes.find((n) => n.id === "Draft");
  const submittedNode = graphIr.nodes.find((n) => n.id === "Submitted");
  const approvedNode = graphIr.nodes.find((n) => n.id === "Approved");

  assert.equal(draftNode.status, "completed");
  assert.equal(submittedNode.status, "active");
  assert.equal(approvedNode.status, "available");

  // Narrow viewport recomposition
  const mobileGraphIr = compileWorkflowGraph(expenseWorkflow, currentRecord, { containerWidth: 390 });
  assert.equal(mobileGraphIr.representation, "vertical_state_path");
});

test("PART 7: Timeline Graph IR Compilation", () => {
  const history = [
    { id: "h1", event: "created", actor: { id: "alice", role: "Creator" }, at: "2026-09-01T10:00:00Z" },
    { id: "h2", event: "submitted", actor: { id: "alice", role: "Creator" }, at: "2026-09-01T11:30:00Z" },
    { id: "h3", event: "approved", actor: { id: "bob", role: "Manager" }, at: "2026-09-02T09:15:00Z", comment: "Looks good" }
  ];

  const timelineIr = compileTimelineGraph(history, { containerWidth: 1024 });

  assert.equal(timelineIr.mode, "timeline");
  assert.equal(timelineIr.representation, "horizontal_timeline");
  assert.equal(timelineIr.events.length, 3);
  assert.equal(timelineIr.events[2].label, "Approved");
  assert.equal(timelineIr.events[2].statusTone, "positive");
  assert.equal(timelineIr.events[2].comment, "Looks good");

  // Mobile viewport -> Vertical Timeline
  const mobileTimeline = compileTimelineGraph(history, { containerWidth: 390 });
  assert.equal(mobileTimeline.representation, "vertical_timeline");
});
