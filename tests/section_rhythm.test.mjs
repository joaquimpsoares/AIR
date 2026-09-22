import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAir, AppRuntime, parseSeedData } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { compileVisualDesign } from "../web/runtime/visual_design.mjs";
import {
  SECTION_RHYTHM,
  SECTION_RELATIONSHIP,
  SECTION_RHYTHM_VALUES,
  UI_EXPERIENCES,
  computeSectionSurfaceCollisionDiagnostic
} from "../web/runtime/ui_hierarchy.mjs";
import { renderPresentation } from "../web/runtime/ui.mjs";

test("PART 1: Section Stack Rhythm Constants & Design Token Values", () => {
  assert.equal(SECTION_RHYTHM.TIGHT, "tight");
  assert.equal(SECTION_RHYTHM.COMPACT, "compact");
  assert.equal(SECTION_RHYTHM.COMFORTABLE, "comfortable");
  assert.equal(SECTION_RHYTHM.SPACIOUS, "spacious");
  assert.equal(SECTION_RHYTHM.DRAMATIC, "dramatic");

  assert.equal(SECTION_RELATIONSHIP.INDEPENDENT, "independent");
  assert.equal(SECTION_RELATIONSHIP.GROUPED, "grouped");
  assert.equal(SECTION_RELATIONSHIP.CONTINUOUS, "continuous");
  assert.equal(SECTION_RELATIONSHIP.ATTACHED, "attached");

  assert.equal(SECTION_RHYTHM_VALUES[SECTION_RHYTHM.TIGHT].px, 8);
  assert.equal(SECTION_RHYTHM_VALUES[SECTION_RHYTHM.COMPACT].px, 16);
  assert.equal(SECTION_RHYTHM_VALUES[SECTION_RHYTHM.COMFORTABLE].px, 28);
  assert.equal(SECTION_RHYTHM_VALUES[SECTION_RHYTHM.SPACIOUS].px, 48);
  assert.equal(SECTION_RHYTHM_VALUES[SECTION_RHYTHM.DRAMATIC].px, 72);
});

test("PART 2: Experience Defaults in UI Hierarchy Catalog", () => {
  assert.equal(UI_EXPERIENCES.enterprise_workspace.defaultSectionRhythm, "comfortable");
  assert.equal(UI_EXPERIENCES.resource_management.defaultSectionRhythm, "comfortable");
  assert.equal(UI_EXPERIENCES.product_launch.defaultSectionRhythm, "spacious");
});

test("PART 3: Task Board Dashboard: Sibling Table Sections (Projects -> Tasks) Inside Section Stack", async () => {
  const source = await readFile("apps/task-board.air", "utf8");
  const model = parseAir(source);
  const runtime = new AppRuntime(model);
  const presentationIr = compilePresentation(model, { runtime });

  const root = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  renderPresentation(root, presentationIr, runtime, { initialScreen: "overview", containerWidth: 1024 });

  const html = root.innerHTML;

  // 1. Must use parent .section-stack container
  assert.ok(html.includes('class="section-stack"'), "Must wrap sections in .section-stack");
  assert.ok(html.includes('data-section-rhythm="comfortable"'), "Must declare comfortable section rhythm");

  // 2. Both recent-panel sections must be marked with independent relationship
  assert.ok(html.includes('data-section-role="collection"'), "Must tag collection sections");
  assert.ok(html.includes('data-section-relationship="independent"'), "Must tag independent sections");

  // 3. Metric section must also be inside the section-stack as an independent sibling
  assert.ok(html.includes('data-section-role="metrics"'), "Metric section must be tagged");
});

test("PART 4: Responsive Recomposition Preserves Sibling Section Rhythm (1440px vs 390px)", async () => {
  const source = await readFile("apps/task-board.air", "utf8");
  const model = parseAir(source);
  const runtime = new AppRuntime(model);
  const presentationIr = compilePresentation(model, { runtime });

  // 1. Desktop (1440px)
  const rootDesktop = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  renderPresentation(rootDesktop, presentationIr, runtime, { initialScreen: "overview", containerWidth: 1440 });
  assert.ok(rootDesktop.innerHTML.includes('class="section-stack"'), "Desktop must use section-stack");
  assert.ok(rootDesktop.innerHTML.includes('data-section-rhythm="comfortable"'), "Desktop must have comfortable rhythm");

  // 2. Mobile (390px)
  const rootMobile = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  renderPresentation(rootMobile, presentationIr, runtime, { initialScreen: "overview", containerWidth: 390 });
  assert.ok(rootMobile.innerHTML.includes('class="section-stack"'), "Mobile must use section-stack");
  assert.ok(rootMobile.innerHTML.includes('data-section-rhythm="comfortable"'), "Mobile must retain comfortable rhythm");
  assert.ok(rootMobile.innerHTML.includes('data-section-representation="dashboard_stack"'), "Mobile must recompose to dashboard_stack");
});

test("PART 5: Cross-Artifact Spacing Verification Across Screen Types", async () => {
  // 1. Customer Manager Detail Screen (Detail Panel -> History Panel)
  const cmSource = await readFile("apps/customer-manager.air", "utf8");
  const seedSource = await readFile("data/customer-manager.seed.json", "utf8");
  const cmModel = parseAir(cmSource);
  const seedData = parseSeedData(seedSource, cmModel);
  const cmRuntime = new AppRuntime(cmModel, { seedData, principal: { actor: "account_managers", id: "am_01", roles: ["admin"] } });
  const cmPresentation = compilePresentation(cmModel, { runtime: cmRuntime });

  const rootDetail = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  const app = renderPresentation(rootDetail, cmPresentation, cmRuntime, { initialScreen: "customers", containerWidth: 1024 });
  
  // Set detail state to trigger renderDetail with valid customer record c_01
  app.state.detail = { entityId: "customers", recordId: "c_01" };
  app.render();

  assert.ok(rootDetail.innerHTML.includes('class="section-stack"'), "Detail screen must use section-stack");
  assert.ok(rootDetail.innerHTML.includes('data-section-role="detail"'), "Must tag detail section");

  // 2. Product Launch Landing Page (Hero -> Compiler -> Feature -> Proof -> Pricing -> FAQ -> CTA -> Footer)
  const landingSource = await readFile("apps/landing-demo.air", "utf8");
  const landingModel = parseAir(landingSource);
  const landingPresentation = compilePresentation(landingModel);

  const rootLanding = { innerHTML: "", removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  renderPresentation(rootLanding, landingPresentation, null, { initialScreen: "landing", containerWidth: 1440 });

  assert.ok(rootLanding.innerHTML.includes('class="marketing-landing section-stack"'), "Landing must use section-stack");
  assert.ok(rootLanding.innerHTML.includes('data-section-rhythm="spacious"'), "Landing must declare spacious rhythm");
});

test("PART 6: Surface Collision Diagnostic Verification", () => {
  // Scenario 1: Clean independent sections with 28px gap -> PASS
  const cleanSections = [
    { id: "metric-grid", top: 100, height: 160, bottom: 260, relationship: "independent" },
    { id: "projects-panel", top: 288, height: 300, bottom: 588, relationship: "independent" },
    { id: "tasks-panel", top: 616, height: 300, bottom: 916, relationship: "independent" }
  ];
  const cleanDiag = computeSectionSurfaceCollisionDiagnostic(cleanSections, SECTION_RHYTHM.COMFORTABLE);
  assert.equal(cleanDiag.hasCollisions, false);
  assert.equal(cleanDiag.status, "PASS_CLEAN_SECTION_RHYTHM");

  // Scenario 2: Touching independent sections (0px gap) -> FAIL SECTION_SURFACE_COLLISION
  const touchingSections = [
    { id: "projects-panel", top: 100, height: 300, bottom: 400, relationship: "independent" },
    { id: "tasks-panel", top: 400, height: 300, bottom: 700, relationship: "independent" }
  ];
  const touchingDiag = computeSectionSurfaceCollisionDiagnostic(touchingSections, SECTION_RHYTHM.COMFORTABLE);
  assert.equal(touchingDiag.hasCollisions, true);
  assert.equal(touchingDiag.collisionCount, 1);
  assert.equal(touchingDiag.status, "FAIL_SECTION_SURFACE_COLLISION");

  // Scenario 3: Attached/Grouped sections (0px gap intentional) -> PASS
  const groupedSections = [
    { id: "tab-bar", top: 100, height: 40, bottom: 140, relationship: "attached" },
    { id: "tab-panel", top: 140, height: 300, bottom: 440, relationship: "attached" }
  ];
  const groupedDiag = computeSectionSurfaceCollisionDiagnostic(groupedSections, SECTION_RHYTHM.COMFORTABLE);
  assert.equal(groupedDiag.hasCollisions, false);
  assert.equal(groupedDiag.status, "PASS_CLEAN_SECTION_RHYTHM");
});

test("PART 7: Source CSS Audit: Zero Application-Specific CSS or Table Margin Hacks", async () => {
  const css = await readFile("web/runtime/styles.css", "utf8");

  // No application or component specific margin bottom hacks
  assert.ok(!css.includes(".projects-table"), "Must NOT contain .projects-table");
  assert.ok(!css.includes(".tasks-table"), "Must NOT contain .tasks-table");
  assert.ok(!css.includes("table + table"), "Must NOT contain adjacent table selector");
  assert.ok(!css.includes(".recent-panel + .recent-panel"), "Must NOT contain adjacent panel selector");

  // Parent .section-stack owns gap
  assert.ok(css.includes(".section-stack {"), "Must contain .section-stack");
  assert.ok(css.includes("gap: var(--section-gap);"), "Must use gap on .section-stack");
});
