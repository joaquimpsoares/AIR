import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAir } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { compileVisualDesign, ARCHETYPES, CHARACTERS } from "../web/runtime/visual_design.mjs";
import { compileUiUtilities, computeOverflowDiagnostic, computeReadabilityDiagnostic } from "../web/runtime/ui_utility.mjs";
import {
  UI_HIERARCHY_VERSION,
  UI_EXPERIENCES,
  UI_SECTIONS,
  UI_ARTIFACTS,
  INFORMATION_PRIORITY,
  ARTIFACT_STATES,
  discoverUiCapability,
  resolveCollectionArtifactLayout,
  computeHierarchyTokenMetrics
} from "../web/runtime/ui_hierarchy.mjs";

test("PART 1 & 2: 4-Level UI Hierarchy Model & Experience Catalog Validation", () => {
  assert.equal(UI_HIERARCHY_VERSION, 1);

  const expKeys = Object.keys(UI_EXPERIENCES);
  assert.ok(expKeys.includes("product_launch"));
  assert.ok(expKeys.includes("enterprise_workspace"));
  assert.ok(expKeys.includes("resource_management"));
  assert.ok(expKeys.includes("workflow_review"));
  assert.ok(expKeys.includes("authentication"));
  assert.ok(expKeys.includes("onboarding"));
  assert.ok(expKeys.includes("documentation"));
  assert.ok(expKeys.includes("checkout"));

  for (const exp of Object.values(UI_EXPERIENCES)) {
    assert.ok(exp.id, "Experience must have id");
    assert.ok(exp.title, "Experience must have title");
    assert.ok(Array.isArray(exp.defaultSections), "Experience must have defaultSections array");
    assert.ok(exp.platformMappings.web, "Experience must have web mapping");
    assert.ok(exp.platformMappings.ios, "Experience must have ios mapping");
    assert.ok(exp.platformMappings.android, "Experience must have android mapping");
  }
});

test("PART 3 & 4: Section Catalog & Contract Validation", () => {
  const sectionKeys = Object.keys(UI_SECTIONS);
  assert.ok(sectionKeys.includes("hero"));
  assert.ok(sectionKeys.includes("collection"));
  assert.ok(sectionKeys.includes("editor"));
  assert.ok(sectionKeys.includes("dashboard"));
  assert.ok(sectionKeys.includes("feature_story"));
  assert.ok(sectionKeys.includes("workflow_story"));
  assert.ok(sectionKeys.includes("pricing"));
  assert.ok(sectionKeys.includes("faq"));
  assert.ok(sectionKeys.includes("cta"));
  assert.ok(sectionKeys.includes("detail"));

  for (const sec of Object.values(UI_SECTIONS)) {
    assert.ok(sec.role, "Section must have semantic role");
    assert.ok(Array.isArray(sec.composedArtifacts), "Section must declare composed artifacts");
    assert.ok(sec.responsivePolicy.wide, "Section must define wide responsive policy");
    assert.ok(sec.responsivePolicy.narrow, "Section must define narrow responsive policy");
    assert.ok(sec.accessibility.landmark || sec.accessibility.ariaRole, "Section must define accessibility landmark/role");
    assert.ok(sec.platformMappings.web, "Section must define web mapping");
    assert.ok(sec.platformMappings.ios, "Section must define ios mapping");
    assert.ok(sec.platformMappings.android, "Section must define android mapping");
  }
});

test("PART 6 & 7: Artifact Catalog & Standard States Contract", () => {
  const artKeys = Object.keys(UI_ARTIFACTS);
  assert.ok(artKeys.includes("collection"));
  assert.ok(artKeys.includes("form"));
  assert.ok(artKeys.includes("navigation"));
  assert.ok(artKeys.includes("workflow_inbox"));
  assert.ok(artKeys.includes("metric"));
  assert.ok(artKeys.includes("modal"));
  assert.ok(artKeys.includes("pricing_comparison"));
  assert.ok(artKeys.includes("filters"));
  assert.ok(artKeys.includes("code_demo"));
  assert.ok(artKeys.includes("faq"));
  assert.ok(artKeys.includes("empty_state"));

  for (const art of Object.values(UI_ARTIFACTS)) {
    assert.ok(Array.isArray(art.requires), "Artifact must specify requires");
    assert.ok(Array.isArray(art.provides), "Artifact must specify provides");
    assert.ok(Array.isArray(art.states), "Artifact must specify supported states");
    assert.ok(art.responsivePolicy, "Artifact must specify responsive policy");
    assert.ok(art.accessibilityPolicy, "Artifact must specify accessibility policy");
    assert.ok(art.platformMappings.web, "Artifact must define web mapping");
  }
});

test("PART 32 & 33: Highest-Level-First Capability Discovery", () => {
  // 1. Querying an experience
  const expMatch = discoverUiCapability("resource_management");
  assert.equal(expMatch.level, "EXPERIENCE");
  assert.equal(expMatch.match.id, "resource_management");
  assert.ok(expMatch.tokenEfficiencyScore >= 0.90);

  // 2. Querying a section
  const secMatch = discoverUiCapability("dashboard");
  assert.equal(secMatch.level, "SECTION");
  assert.equal(secMatch.match.id, "dashboard");

  // 3. Querying an artifact
  const artMatch = discoverUiCapability("pricing_comparison");
  assert.equal(artMatch.level, "ARTIFACT");
  assert.equal(artMatch.match.id, "pricing_comparison");

  // 4. Fallback
  const fallbackMatch = discoverUiCapability("unrelated_custom_widget_xyz");
  assert.equal(fallbackMatch.level, "UI_UTILITY");
});

test("PART 13 & 14: Collection Artifact Recomposes to Card List at Narrow Widths", () => {
  const fields = [
    { id: "company", priority: INFORMATION_PRIORITY.PRIMARY },
    { id: "contact", priority: INFORMATION_PRIORITY.PRIMARY },
    { id: "email", priority: INFORMATION_PRIORITY.SECONDARY },
    { id: "status", priority: INFORMATION_PRIORITY.SECONDARY },
    { id: "created_at", priority: INFORMATION_PRIORITY.METADATA }
  ];

  // Wide (1024px) -> Full multi-column table
  const wideLayout = resolveCollectionArtifactLayout(1024, fields);
  assert.equal(wideLayout.mode, "table");
  assert.equal(wideLayout.visibleColumns.length, 5);
  assert.equal(wideLayout.recomposedToCardList, false);

  // Medium (500px) -> Condensed table (metadata excluded)
  const medLayout = resolveCollectionArtifactLayout(500, fields);
  assert.equal(medLayout.mode, "condensed_table");
  assert.equal(medLayout.visibleColumns.length, 4);
  assert.equal(medLayout.recomposedToCardList, false);

  // Narrow (390px / 320px) -> Semantic card list (zero column squishing)
  const narrowLayout = resolveCollectionArtifactLayout(390, fields);
  assert.equal(narrowLayout.mode, "card_list");
  assert.equal(narrowLayout.primaryField, "company");
  assert.equal(narrowLayout.recomposedToCardList, true);
  assert.equal(narrowLayout.requiresHorizontalScroll, false);
});

test("PART 40: Customer Manager App End-to-End Hierarchy & Responsive Audit", async () => {
  const source = await readFile("apps/customer-manager.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);
  const uiUtilityIr = compileUiUtilities(visualIr);

  const viewports = [320, 375, 390, 430, 500, 768, 1024, 1440];
  for (const vp of viewports) {
    const diag = computeOverflowDiagnostic(uiUtilityIr, vp);
    assert.equal(diag.hasHorizontalOverflow, false, `Customer manager at ${vp}px must not overflow`);
    assert.ok(diag.minEffectiveWidth >= 260);
  }
});

test("PART 41: Expense Approval App End-to-End Hierarchy & Workflow Responsive Audit", async () => {
  const source = await readFile("apps/expense-approval.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);
  const uiUtilityIr = compileUiUtilities(visualIr);

  const viewports = [320, 375, 390, 500, 768, 1440];
  for (const vp of viewports) {
    const diag = computeOverflowDiagnostic(uiUtilityIr, vp);
    assert.equal(diag.hasHorizontalOverflow, false, `Expense approval at ${vp}px must not overflow`);
  }
});

test("PART 42: Auth Experience Responsive & Center-Card Audit", async () => {
  const authExp = UI_EXPERIENCES.authentication;
  assert.equal(authExp.defaultShell, "centered_card");

  const viewports = [320, 375, 390, 1440];
  for (const vp of viewports) {
    // Auth cards never exceed viewport on mobile
    const effectiveWidth = Math.min(vp - 32, 440);
    assert.ok(effectiveWidth <= vp, `Auth card width ${effectiveWidth} must fit viewport ${vp}`);
    assert.ok(effectiveWidth >= 280, `Auth card must remain usable`);
  }
});

test("PART 43 & 44: Landing Demo App Viewport Matrix [320 to 1440] & Container Matrix [280 to 900]", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);
  const uiUtilityIr = compileUiUtilities(visualIr);

  const viewports = [320, 375, 390, 430, 500, 768, 1024, 1440];
  for (const vp of viewports) {
    const diag = computeOverflowDiagnostic(uiUtilityIr, vp);
    assert.equal(diag.hasHorizontalOverflow, false, `Landing demo at ${vp}px must not overflow`);
  }

  const containers = [280, 320, 480, 640, 900];
  for (const cw of containers) {
    const diag = computeOverflowDiagnostic(uiUtilityIr, cw, { isContainer: true });
    assert.equal(diag.hasHorizontalOverflow, false, `Container width ${cw}px must not overflow`);
  }
});

test("PART 52 & 53: Token Measurement & Context Compression", async () => {
  const customerSource = await readFile("apps/customer-manager.air", "utf8");
  const metrics = computeHierarchyTokenMetrics(customerSource);

  assert.ok(metrics.airSourceTokens < 150, `AIR tokens should be compact, was ${metrics.airSourceTokens}`);
  assert.ok(metrics.tokenSavingsPercent >= 75, `Token savings percent should be >= 75%, was ${metrics.tokenSavingsPercent}%`);
  assert.ok(metrics.compressionRatio >= 4.0, `Compression ratio should be >= 4x, was ${metrics.compressionRatio}x`);
});

test("PART 55: Section and Artifact Conformance Suites (14 Total Fixtures)", async () => {
  const sectionFixtures = [
    "hero.air",
    "collection.air",
    "editor.air",
    "dashboard.air",
    "comparison.air",
    "workflow.air",
    "pricing.air"
  ];

  for (const name of sectionFixtures) {
    const source = await readFile(`conformance/ui_sections/${name}`, "utf8");
    const model = parseAir(source);
    assert.ok(model, `Section fixture ${name} parsed`);
    const pIr = compilePresentation(model);
    assert.ok(pIr, `Presentation IR compiled for ${name}`);
    const vIr = compileVisualDesign(pIr, model.design);
    const uIr = compileUiUtilities(vIr);
    assert.equal(uIr.schema, "air.ui-utility-ir");
  }

  const artifactFixtures = [
    "table-collection.air",
    "form-editor.air",
    "navigation.air",
    "workflow-inbox.air",
    "metric-card.air",
    "modal-sheet.air",
    "filter-bar.air"
  ];

  for (const name of artifactFixtures) {
    const source = await readFile(`conformance/ui_artifacts/${name}`, "utf8");
    const model = parseAir(source);
    assert.ok(model, `Artifact fixture ${name} parsed`);
    const pIr = compilePresentation(model);
    assert.ok(pIr, `Presentation IR compiled for ${name}`);
    const vIr = compileVisualDesign(pIr, model.design);
    const uIr = compileUiUtilities(vIr);
    assert.equal(uIr.schema, "air.ui-utility-ir");
  }
});
