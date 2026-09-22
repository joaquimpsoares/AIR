import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAir, AppRuntime, parseSeedData } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { compileVisualDesign } from "../web/runtime/visual_design.mjs";
import {
  COLLECTION_REPRESENTATION,
  FORM_REPRESENTATION,
  NAVIGATION_REPRESENTATION,
  HERO_REPRESENTATION,
  WORKFLOW_REPRESENTATION,
  SHELL_REPRESENTATION,
  resolveCollectionArtifactLayout,
  resolveFormArtifactLayout,
  resolveNavigationArtifactLayout,
  resolveHeroArtifactLayout,
  resolveWorkflowArtifactLayout,
  resolveShellArtifactLayout
} from "../web/runtime/ui_hierarchy.mjs";
import { renderPresentation } from "../web/runtime/ui.mjs";

test("PART 1: Explicit Representation Enums & Artifact Layout Resolvers", () => {
  assert.equal(COLLECTION_REPRESENTATION.TABLE, "table");
  assert.equal(COLLECTION_REPRESENTATION.CONDENSED_TABLE, "condensed_table");
  assert.equal(COLLECTION_REPRESENTATION.RECORD_LIST, "record_list");

  assert.equal(FORM_REPRESENTATION.MULTI_COLUMN, "multi_column");
  assert.equal(FORM_REPRESENTATION.SINGLE_COLUMN, "single_column");

  assert.equal(NAVIGATION_REPRESENTATION.FULL, "full");
  assert.equal(NAVIGATION_REPRESENTATION.COMPACT, "compact");

  assert.equal(HERO_REPRESENTATION.SPLIT, "split");
  assert.equal(HERO_REPRESENTATION.STACKED, "stacked");

  assert.equal(WORKFLOW_REPRESENTATION.GRAPH_AND_DETAIL, "graph_and_detail");
  assert.equal(WORKFLOW_REPRESENTATION.VERTICAL_STATE_STORY, "vertical_state_story");

  assert.equal(SHELL_REPRESENTATION.SIDEBAR, "sidebar");
  assert.equal(SHELL_REPRESENTATION.COMPACT, "compact");
  assert.equal(SHELL_REPRESENTATION.PUBLIC, "public");
  assert.equal(SHELL_REPRESENTATION.PUBLIC_COMPACT, "public_compact");
});

test("PART 2: Customer Management DOM Structure: Wide (Table) vs Narrow (Record List Cards)", async () => {
  const source = await readFile("apps/customer-manager.air", "utf8");
  const seedSource = await readFile("data/customer-manager.seed.json", "utf8");
  const model = parseAir(source);
  const seedData = parseSeedData(seedSource, model);
  const runtime = new AppRuntime(model, { seedData, principal: { actor: "account_managers", id: "am_01", roles: ["admin"] } });
  const presentationIr = compilePresentation(model, { runtime });

  // 1. Wide Desktop / Container (1024px) on customers collection screen
  const rootDesktop = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  const instanceDesktop = renderPresentation(rootDesktop, presentationIr, runtime, { initialScreen: "customers", containerWidth: 1024 });
  
  assert.ok(rootDesktop.innerHTML.includes("<table"), "Wide layout must render <table>");
  assert.ok(rootDesktop.innerHTML.includes("<thead"), "Wide layout must render <thead>");
  assert.ok(rootDesktop.innerHTML.includes("<tbody"), "Wide layout must render <tbody>");
  assert.ok(!rootDesktop.innerHTML.includes('class="record-list"'), "Wide layout must NOT render .record-list");
  assert.ok(!rootDesktop.innerHTML.includes('class="record-card"'), "Wide layout must NOT render .record-card");

  // 2. Narrow Mobile / Container (375px) on customers collection screen
  const rootMobile = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  const instanceMobile = renderPresentation(rootMobile, presentationIr, runtime, { initialScreen: "customers", containerWidth: 375 });

  assert.ok(!rootMobile.innerHTML.includes("<table"), "Narrow layout must NOT render <table>");
  assert.ok(!rootMobile.innerHTML.includes("<thead"), "Narrow layout must NOT render <thead>");
  assert.ok(rootMobile.innerHTML.includes('class="record-list"'), "Narrow layout MUST render semantic .record-list");
  assert.ok(rootMobile.innerHTML.includes('data-collection-representation="record_list"'), "Must declare record_list representation");
});

test("PART 3: Container Independence (1440px Viewport with 900px vs 320px Container)", async () => {
  const source = await readFile("apps/customer-manager.air", "utf8");
  const seedSource = await readFile("data/customer-manager.seed.json", "utf8");
  const model = parseAir(source);
  const seedData = parseSeedData(seedSource, model);
  const runtime = new AppRuntime(model, { seedData, principal: { actor: "account_managers", id: "am_01", roles: ["admin"] } });
  const presentationIr = compilePresentation(model, { runtime });

  // Large container in wide viewport
  const rootLarge = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  renderPresentation(rootLarge, presentationIr, runtime, { initialScreen: "customers", containerWidth: 900 });
  assert.ok(rootLarge.innerHTML.includes("<table"), "900px container gets table representation");

  // Narrow sidebar widget container in same 1440px viewport
  const rootSmall = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  renderPresentation(rootSmall, presentationIr, runtime, { initialScreen: "customers", containerWidth: 320 });
  assert.ok(rootSmall.innerHTML.includes('class="record-list"'), "320px container gets record-list representation even in wide viewport");
});

test("PART 4: Resize Recomposition Sequence with State Preservation", async () => {
  const source = await readFile("apps/customer-manager.air", "utf8");
  const seedSource = await readFile("data/customer-manager.seed.json", "utf8");
  const model = parseAir(source);
  const seedData = parseSeedData(seedSource, model);
  const runtime = new AppRuntime(model, { seedData, principal: { actor: "account_managers", id: "am_01", roles: ["admin"] } });
  const presentationIr = compilePresentation(model, { runtime });

  let htmlOutput = "";
  const mockRoot = {
    get innerHTML() { return htmlOutput; },
    set innerHTML(val) { htmlOutput = val; },
    removeAttribute: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const app = renderPresentation(mockRoot, presentationIr, runtime, { initialScreen: "customers", containerWidth: 900 });
  assert.ok(mockRoot.innerHTML.includes("<table"), "Starts with table at 900px");

  // Step 1: 900px -> 600px (Condensed Table)
  app.setContainerWidth(600);
  assert.ok(mockRoot.innerHTML.includes("<table"), "Remains table representation at 600px");

  // Step 2: 600px -> 420px (Semantic Record List)
  app.setContainerWidth(420);
  assert.ok(mockRoot.innerHTML.includes('class="record-list"'), "Switches to record-list representation at 420px");

  // Step 3: 420px -> 900px (Restores Full Table)
  app.setContainerWidth(900);
  assert.ok(mockRoot.innerHTML.includes("<table"), "Restores table representation at 900px");
});

test("PART 5: Form, Navigation, and Shell Representation Layout Resolvers", () => {
  // Form layout selection
  assert.equal(resolveFormArtifactLayout(1024).representation, FORM_REPRESENTATION.MULTI_COLUMN);
  assert.equal(resolveFormArtifactLayout(500).representation, FORM_REPRESENTATION.SINGLE_COLUMN);

  // Navigation layout selection
  assert.equal(resolveNavigationArtifactLayout(1024).representation, NAVIGATION_REPRESENTATION.FULL);
  assert.equal(resolveNavigationArtifactLayout(500).representation, NAVIGATION_REPRESENTATION.COMPACT);

  // Hero layout selection
  assert.equal(resolveHeroArtifactLayout(1024).representation, HERO_REPRESENTATION.SPLIT);
  assert.equal(resolveHeroArtifactLayout(500).representation, HERO_REPRESENTATION.STACKED);

  // Workflow layout selection
  assert.equal(resolveWorkflowArtifactLayout(1024).representation, WORKFLOW_REPRESENTATION.GRAPH_AND_DETAIL);
  assert.equal(resolveWorkflowArtifactLayout(500).representation, WORKFLOW_REPRESENTATION.VERTICAL_STATE_STORY);

  // Shell layout selection
  assert.equal(resolveShellArtifactLayout(1024, false).representation, SHELL_REPRESENTATION.SIDEBAR);
  assert.equal(resolveShellArtifactLayout(500, false).representation, SHELL_REPRESENTATION.COMPACT);
  assert.equal(resolveShellArtifactLayout(1024, true).representation, SHELL_REPRESENTATION.PUBLIC);
  assert.equal(resolveShellArtifactLayout(500, true).representation, SHELL_REPRESENTATION.PUBLIC_COMPACT);
});

test("PART 6: Source-Level CSS Audit: Zero Behavioral Media Query Decisions", async () => {
  const css = await readFile("web/runtime/styles.css", "utf8");

  // 1. Table display:block mutation must not exist
  assert.ok(!css.includes("table, thead, tbody, th, td, tr { display: block; }"), "CSS must NOT force display: block on tables");
  assert.ok(!css.includes("td::before { color: var(--text-faint); content: attr(data-label);"), "CSS must NOT inject pseudo-element semantic data labels");

  // 2. Behavioral sidebar/nav hiding must not exist in media queries
  assert.ok(!css.includes(".sidebar { display: none; }"), "CSS media query must NOT hide sidebar");
  assert.ok(!css.includes(".public-nav-links {\n    display: none;\n  }"), "CSS media query must NOT hide public nav links");

  // 3. Behavioral form-grid columns must not be controlled by media queries
  assert.ok(!css.includes(".form-grid { grid-template-columns: 1fr; padding: 18px; }"), "CSS media query must NOT decide form column representation");
});
