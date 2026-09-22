import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAir } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { compileVisualDesign, ARCHETYPES, CHARACTERS } from "../web/runtime/visual_design.mjs";
import {
  compileUiUtilities,
  compileTailwind,
  serializeUiUtilityIr,
  computeOverflowDiagnostic,
  computeReadabilityDiagnostic,
  computeResponsiveTokenMetrics,
  UI_UTILITY_IR_VERSION,
  TAILWIND_TARGET_VERSION,
  FLOWS,
  COLUMNS,
  SPACING,
  ALIGNS,
  JUSTIFIES,
  WIDTHS,
  HEIGHTS,
  PROPORTIONS,
  TYPOGRAPHY_SCALES,
  MEASURES,
  BREAKPOINTS,
  CONTAINER_BREAKPOINTS,
  STATE_VARIANTS,
  MIN_VIABLE_WIDTHS
} from "../web/runtime/ui_utility.mjs";

test("PART 1: AIR UI Utility IR v1 Schema & Deterministic Serialization", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);

  const uiUtilityIr1 = compileUiUtilities(visualIr);
  const uiUtilityIr2 = compileUiUtilities(visualIr);

  assert.equal(uiUtilityIr1.schema, "air.ui-utility-ir");
  assert.equal(uiUtilityIr1.version, UI_UTILITY_IR_VERSION);
  assert.equal(uiUtilityIr1.meta.archetype, ARCHETYPES.PRODUCT_LAUNCH);
  assert.equal(uiUtilityIr1.meta.character, CHARACTERS.TECHNICAL_PREMIUM);

  assert.equal(serializeUiUtilityIr(uiUtilityIr1), serializeUiUtilityIr(uiUtilityIr2), "UI Utility IR serialization must be strictly deterministic");
});

test("PART 2: Platform-Neutral Vocabulary & Mobile-First Invariants", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);
  const uiUtilityIr = compileUiUtilities(visualIr);

  const heroUtility = uiUtilityIr.sections.find((s) => s.semanticType === "hero" || s.id === "hero" || s.id === "hero_section");
  assert.ok(heroUtility, "Hero section utility must exist");

  // Mobile-first check: base flow must be stack; desktop enhancements at lg
  assert.equal(heroUtility.layout.composition.flow.base, FLOWS.STACK, "Base flow must be mobile-first stack");
  assert.equal(heroUtility.layout.composition.flow.lg, FLOWS.SPLIT, "Desktop flow enhances to split");
  assert.equal(heroUtility.layout.composition.columns.base, 1);
  assert.equal(heroUtility.layout.composition.columns.lg, 12);

  // Measure clamp check
  assert.equal(heroUtility.typography.headline.measure, MEASURES.BALANCE);
  assert.equal(heroUtility.typography.tagline.measure, MEASURES.READABLE);
});

test("PART 3: Tailwind CSS Web Backend Class Emission", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);
  const uiUtilityIr = compileUiUtilities(visualIr);
  const tailwindOutput = compileTailwind(uiUtilityIr);

  assert.equal(tailwindOutput.target, "tailwind-css");
  assert.equal(tailwindOutput.targetVersion, TAILWIND_TARGET_VERSION);

  // Check hero classes
  const heroClasses = tailwindOutput.classes.hero;
  assert.ok(heroClasses, "Hero tailwind classes must be generated");
  assert.ok(heroClasses.composition.includes("grid-cols-1"), "Must include grid-cols-1 for mobile");
  assert.ok(heroClasses.composition.includes("lg:grid-cols-12"), "Must include lg:grid-cols-12 for desktop");
  assert.ok(heroClasses.tagline.includes("max-w-reading"), "Must constrain tagline measure");

  // Check bento features classes
  const bentoClasses = tailwindOutput.classes.features_bento;
  assert.ok(bentoClasses, "Bento tailwind classes must be generated");
  assert.ok(bentoClasses.grid.includes("grid-cols-1"));
  assert.ok(bentoClasses.grid.includes("lg:grid-cols-12"));
  assert.ok(bentoClasses.dominantCard.includes("col-span-1"));
  assert.ok(bentoClasses.dominantCard.includes("lg:col-span-7"));

  // Check pricing classes
  const pricingClasses = tailwindOutput.classes.pricing_grid;
  assert.ok(pricingClasses, "Pricing grid tailwind classes must be generated");
  assert.ok(pricingClasses.grid.includes("grid-cols-1"));
  assert.ok(pricingClasses.grid.includes("md:grid-cols-2"));
  assert.ok(pricingClasses.grid.includes("lg:grid-cols-3"));
});

test("PART 4: Viewport Matrix Testing (320px to 1440px) & Zero Overflow Verification", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);
  const uiUtilityIr = compileUiUtilities(visualIr);

  const testViewports = [320, 375, 390, 430, 500, 768, 1024, 1280, 1440];

  for (const vp of testViewports) {
    const diagnostic = computeOverflowDiagnostic(uiUtilityIr, vp);
    assert.equal(diagnostic.hasHorizontalOverflow, false, `Viewport ${vp}px must not have horizontal overflow`);
    assert.ok(diagnostic.minEffectiveWidth >= 260, `Viewport ${vp}px cards must maintain readable width`);

    if (vp <= 500) {
      assert.equal(diagnostic.effectiveColumns.hero, 1, `Hero at ${vp}px must collapse to single column`);
      assert.equal(diagnostic.effectiveColumns.pricing, 1, `Pricing at ${vp}px must collapse to single column`);
      assert.equal(diagnostic.effectiveColumns.bento, 1, `Bento at ${vp}px must collapse to single column`);
    }
  }
});

test("PART 5: Container Query Adaptations (280px to 900px)", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);
  const uiUtilityIr = compileUiUtilities(visualIr);

  const testContainers = [280, 320, 480, 640, 900];

  for (const cw of testContainers) {
    const diagnostic = computeOverflowDiagnostic(uiUtilityIr, cw, { isContainer: true });
    assert.equal(diagnostic.hasHorizontalOverflow, false, `Container width ${cw}px must not overflow`);

    if (cw < 480) {
      assert.equal(diagnostic.effectiveColumns.pricing, 1, `Container width ${cw}px must stack pricing cards`);
    }
  }
});

test("PART 6: Typographic Measure & Readability Diagnostics", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, model.design);
  const uiUtilityIr = compileUiUtilities(visualIr);

  const readability = computeReadabilityDiagnostic(uiUtilityIr);
  assert.equal(readability.passed, true, "All text elements must pass readability diagnostics");
  assert.ok(readability.maxMeasureChars <= 80, "Max measure must not exceed 80 chars per line");
  assert.ok(readability.minMeasureChars >= 35, "Min measure must maintain at least 35 chars per line");
});

test("PART 7: Conformance Fixture Suite (11 Responsive & Utility Test Cases)", async () => {
  const fixtureNames = [
    "stack-to-split.air",
    "grid-to-stack.air",
    "nav-collapse.air",
    "pricing-stack.air",
    "bento-collapse.air",
    "table-to-list.air",
    "container-query.air",
    "dark-variant.air",
    "reduced-motion.air",
    "state-variant.air",
    "readable-measure.air"
  ];

  for (const name of fixtureNames) {
    const fixtureSource = await readFile(`conformance/ui_utilities/${name}`, "utf8");
    const model = parseAir(fixtureSource);
    assert.ok(model, `Conformance model ${name} parsed`);
    const presentationIr = compilePresentation(model);
    const visualIr = compileVisualDesign(presentationIr, model.design);
    const uiUtilityIr = compileUiUtilities(visualIr);
    assert.equal(uiUtilityIr.schema, "air.ui-utility-ir");

    const tailwindOutput = compileTailwind(uiUtilityIr);
    assert.ok(tailwindOutput.classes, `Tailwind classes compiled for ${name}`);

    // Verify zero overflow across narrowest mobile (320px) and wide desktop (1440px)
    const mobileDiag = computeOverflowDiagnostic(uiUtilityIr, 320);
    const desktopDiag = computeOverflowDiagnostic(uiUtilityIr, 1440);
    assert.equal(mobileDiag.hasHorizontalOverflow, false, `Mobile 320px zero overflow for ${name}`);
    assert.equal(desktopDiag.hasHorizontalOverflow, false, `Desktop 1440px zero overflow for ${name}`);
  }
});
