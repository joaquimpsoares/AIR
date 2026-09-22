import test from "node:test";
import assert from "node:assert/strict";
import {
  SEMANTIC_GRAPH_MODES,
  SEMANTIC_GRAPH_REPRESENTATIONS,
  compileWorkflowGraph,
  compileTimelineGraph,
  compileDagGraph
} from "../web/runtime/visualization_ir.mjs";
import {
  renderSemanticGraph
} from "../web/runtime/visualization_web.mjs";

test("PART 1: Semantic Workflow Graph Web Rendering & Node States", () => {
  const workflow = {
    id: "order_flow",
    states: ["Pending", "Processing", "Shipped", "Delivered"],
    transitions: [
      { from: "Pending", to: "Processing", action: "process", by: "warehouse" },
      { from: "Processing", to: "Shipped", action: "ship", by: "courier", when: "items_packed == true" },
      { from: "Shipped", to: "Delivered", action: "deliver", by: "courier" }
    ]
  };

  const currentRecord = { id: "ord_99", status: "Processing" };

  // Desktop layout (Horizontal graph)
  const graphIr = compileWorkflowGraph(workflow, currentRecord, { containerWidth: 1024 });
  const html = renderSemanticGraph(graphIr);

  assert.ok(html.includes('data-artifact="semantic_graph"'));
  assert.ok(html.includes('data-graph-mode="workflow"'));
  assert.ok(html.includes('data-representation="spatial_workflow_graph"'));
  assert.ok(html.includes('class="wf-graph-layout wf-horizontal-graph"'));

  // Pending is passed/completed
  assert.ok(html.includes('data-state-id="Pending"'));
  assert.ok(html.includes('node-completed'));

  // Processing is active
  assert.ok(html.includes('data-state-id="Processing"'));
  assert.ok(html.includes('node-active'));

  // Shipped is available next action
  assert.ok(html.includes('data-state-id="Shipped"'));
  assert.ok(html.includes('node-available'));

  // Check transitions panel
  assert.ok(html.includes('class="wf-transitions-panel"'));
  assert.ok(html.includes('Guard: <code>items_packed == true</code>'));
  assert.ok(html.includes('Actor: <code>warehouse</code>'));

  // Mobile layout (Vertical stepper)
  const mobileGraphIr = compileWorkflowGraph(workflow, currentRecord, { containerWidth: 380 });
  const mobileHtml = renderSemanticGraph(mobileGraphIr);
  assert.ok(mobileHtml.includes('data-representation="vertical_state_path"'));
  assert.ok(mobileHtml.includes('class="wf-graph-layout wf-vertical-stepper"'));
});

test("PART 2: Timeline Graph Web Rendering & Audit Events", () => {
  const history = [
    { id: "e1", event: "created", actor: { id: "usr_1", role: "Submitter" }, at: "2026-09-10T08:00:00Z" },
    { id: "e2", event: "approved", actor: { id: "usr_2", role: "Manager" }, at: "2026-09-10T10:30:00Z", comment: "Verified with finance." }
  ];

  const timelineIr = compileTimelineGraph(history, { containerWidth: 1024 });
  const html = renderSemanticGraph(timelineIr);

  assert.ok(html.includes('data-artifact="semantic_graph"'));
  assert.ok(html.includes('data-graph-mode="timeline"'));
  assert.ok(html.includes('class="timeline-stream"'));
  assert.ok(html.includes('class="timeline-event tone-positive"'));
  assert.ok(html.includes('Verified with finance.'));
  assert.ok(html.includes('Submitter'));
  assert.ok(html.includes('Manager'));
});

test("PART 3: Directed Acyclic Graph (DAG) Web Rendering", () => {
  const nodes = [
    { id: "fetch_data", label: "Fetch Data", description: "Query upstream source" },
    { id: "transform", label: "Transform IR", description: "Compile semantic AST" },
    { id: "render", label: "Render DOM", description: "Generate accessible HTML" }
  ];
  const edges = [
    { from: "fetch_data", to: "transform" },
    { from: "transform", to: "render" }
  ];

  const dagIr = compileDagGraph(nodes, edges, { title: "Compilation Pipeline", containerWidth: 1024 });
  const html = renderSemanticGraph(dagIr);

  assert.ok(html.includes('data-artifact="semantic_graph"'));
  assert.ok(html.includes('data-graph-mode="dag"'));
  assert.ok(html.includes('Compilation Pipeline'));
  assert.ok(html.includes('Fetch Data'));
  assert.ok(html.includes('Transform IR'));
  assert.ok(html.includes('Render DOM'));
});
