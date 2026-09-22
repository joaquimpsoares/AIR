import test from "node:test";
import assert from "node:assert/strict";
import {
  VISUAL_INTENTS,
  DATA_VISUALIZATION_REPRESENTATIONS,
  compileVisualizationIR
} from "../web/runtime/visualization_ir.mjs";
import {
  renderDataVisualization
} from "../web/runtime/visualization_web.mjs";

test("PART 1: Data Visualization Line Chart Rendering & Semantic Structure", () => {
  const records = [
    { date: "2026-01-01", value: 100 },
    { date: "2026-02-01", value: 250 },
    { date: "2026-03-01", value: 180 },
    { date: "2026-04-01", value: 400 }
  ];

  const vizIr = compileVisualizationIR({
    id: "active_users_trend",
    title: "Monthly Active Users",
    intent: VISUAL_INTENTS.TREND,
    measure: "value",
    dimension: "date",
    containerWidth: 1024
  }, records);

  const html = renderDataVisualization(vizIr);

  // 1. Check Container & Attributes
  assert.ok(html.includes('data-artifact="data_visualization"'));
  assert.ok(html.includes('data-representation="full_line"'));
  assert.ok(html.includes('data-intent="trend"'));
  assert.ok(html.includes('id="viz-container-active_users_trend"'));

  // 2. Check SVG Chart elements
  assert.ok(html.includes('<svg viewBox="0 0 700 260"'));
  assert.ok(html.includes('class="viz-line-path"'));
  assert.ok(html.includes('class="viz-data-dot"'));
  assert.ok(html.includes('role="graphics-symbol"'));

  // 3. Check Screen Reader Live Region
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('Monthly Active Users: full_line visualization'));

  // 4. Check Accessible Exact Data Table
  assert.ok(html.includes('class="data-table viz-data-table"'));
  assert.ok(html.includes('aria-label="Monthly Active Users accessible data"'));
  assert.ok(html.includes('<th scope="row" class="viz-th-dim">Jan 2026</th>'));
  assert.ok(html.includes('class="viz-table-meter-bar"'));

  // 5. Check View Toggle Button
  assert.ok(html.includes('data-viz-toggle="active_users_trend"'));
  assert.ok(html.includes('aria-controls="viz-table-active_users_trend"'));
});

test("PART 2: Bar Chart, Compact Horizontal Bar, and Stacked Bar Rendering", () => {
  const records = [
    { category: "Hardware", revenue: 54000 },
    { category: "Software", revenue: 92000 },
    { category: "Services", revenue: 31000 }
  ];

  // 1. Vertical Bar (Wide Viewport)
  const vBarIr = compileVisualizationIR({
    id: "rev_by_cat_wide",
    title: "Revenue by Category",
    intent: VISUAL_INTENTS.COMPARE,
    measure: "revenue",
    dimension: "category",
    format: "currency",
    containerWidth: 1024
  }, records);

  const vHtml = renderDataVisualization(vBarIr);
  assert.ok(vHtml.includes('class="viz-bar-rect"'));
  assert.ok(vHtml.includes('class="viz-bar-group"'));
  assert.ok(vHtml.includes('$177,000'));

  // 2. Compact Horizontal Bar (Mobile Viewport)
  const hBarIr = compileVisualizationIR({
    id: "rev_by_cat_mobile",
    title: "Revenue by Category",
    intent: VISUAL_INTENTS.COMPARE,
    measure: "revenue",
    dimension: "category",
    format: "currency",
    containerWidth: 360
  }, records);

  const hHtml = renderDataVisualization(hBarIr);
  assert.ok(hHtml.includes('data-representation="compact_bar"'));
  assert.ok(hHtml.includes('class="viz-h-bar-fill"'));
  assert.ok(hHtml.includes('class="viz-h-bar-bg"'));

  // 3. Stacked Bar
  const stackRecords = [
    { category: "Q1", segment: "SMB", val: 30 },
    { category: "Q1", segment: "Enterprise", val: 70 },
    { category: "Q2", segment: "SMB", val: 40 },
    { category: "Q2", segment: "Enterprise", val: 80 }
  ];
  const stackIr = compileVisualizationIR({
    id: "quarterly_breakdown",
    title: "Quarterly Breakdown",
    intent: VISUAL_INTENTS.COMPOSITION,
    measure: "val",
    dimension: "category",
    secondaryDimension: "segment",
    containerWidth: 1024
  }, stackRecords);

  const stackHtml = renderDataVisualization(stackIr);
  assert.ok(stackHtml.includes('data-representation="stacked_bar"'));
  assert.ok(stackHtml.includes('class="viz-stacked-seg"'));
  assert.ok(stackHtml.includes('class="viz-legend"'));
  assert.ok(stackHtml.includes('SMB'));
  assert.ok(stackHtml.includes('Enterprise'));
});

test("PART 3: Data Visualization Lifecycle States (Loading, Empty, Error)", () => {
  const baseIr = {
    id: "test_states",
    title: "Test State Chart",
    subtitle: "Testing standard states",
    intent: "trend",
    representation: "full_line",
    exactData: []
  };

  // 1. Loading state
  const loadingHtml = renderDataVisualization(baseIr, { state: "loading" });
  assert.ok(loadingHtml.includes('aria-busy="true"'));
  assert.ok(loadingHtml.includes('class="viz-stage-skeleton"'));
  assert.ok(loadingHtml.includes('skeleton-chart-bar'));

  // 2. Empty state
  const emptyHtml = renderDataVisualization(baseIr, { state: "empty" });
  assert.ok(emptyHtml.includes('data-state="empty"'));
  assert.ok(emptyHtml.includes('No data available'));

  // 3. Error state
  const errorHtml = renderDataVisualization(baseIr, { state: "error" });
  assert.ok(errorHtml.includes('data-state="error"'));
  assert.ok(errorHtml.includes('role="alert"'));
  assert.ok(errorHtml.includes('Unable to compute visualization'));
});
