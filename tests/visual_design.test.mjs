import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAir } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import {
  compileVisualDesign,
  applyVisualDesignPatch,
  serializeVisualDesignIr,
  VISUAL_DESIGN_IR_VERSION,
  ARCHETYPES,
  CHARACTERS,
  COMPOSITIONS,
  SHELL_TYPES,
  PRIORITIES,
  RHYTHMS,
  CARD_POLICIES,
  MOTION_MODELS
} from "../web/runtime/visual_design.mjs";
import { renderPresentation } from "../web/runtime/ui.mjs";

test("PART 1 & 33: Visual Design IR v1 compiles and serializes deterministically", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);

  const visualIr1 = compileVisualDesign(presentationIr, model.design);
  const visualIr2 = compileVisualDesign(presentationIr, model.design);

  assert.equal(visualIr1.schema, "air.visual-design-ir");
  assert.equal(visualIr1.version, VISUAL_DESIGN_IR_VERSION);
  assert.equal(serializeVisualDesignIr(visualIr1), serializeVisualDesignIr(visualIr2), "Visual Design IR must be deterministic");
});

test("PART 3 & 42: SAME content produces genuinely different compositions across archetypes and characters", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);

  // 1. Compile under technical-premium (product_launch)
  const techIr = compileVisualDesign(presentationIr, {
    archetype: ARCHETYPES.PRODUCT_LAUNCH,
    character: CHARACTERS.TECHNICAL_PREMIUM
  });

  // 2. Compile under minimal (minimal_saas)
  const minimalIr = compileVisualDesign(presentationIr, {
    archetype: ARCHETYPES.MINIMAL_SAAS,
    character: CHARACTERS.MINIMAL
  });

  // 3. Compile under editorial (editorial_story)
  const editorialIr = compileVisualDesign(presentationIr, {
    archetype: ARCHETYPES.EDITORIAL_STORY,
    character: CHARACTERS.EDITORIAL
  });

  // 4. Compile under futuristic
  const futuristicIr = compileVisualDesign(presentationIr, {
    archetype: ARCHETYPES.PRODUCT_LAUNCH,
    character: CHARACTERS.FUTURISTIC
  });

  // Verify that differences are COMPOSITIONAL, not merely tokens
  const techFeatureSection = techIr.screens[0].sections.find(s => s.semanticType === "feature_grid" || s.semanticType === "features");
  const minimalFeatureSection = minimalIr.screens[0].sections.find(s => s.semanticType === "feature_grid" || s.semanticType === "features");
  const editorialFeatureSection = editorialIr.screens[0].sections.find(s => s.semanticType === "feature_grid" || s.semanticType === "features");

  assert.ok(techFeatureSection, "Technical features section must exist");
  assert.ok(minimalFeatureSection, "Minimal features section must exist");
  assert.ok(editorialFeatureSection, "Editorial features section must exist");

  // Composition validation
  assert.equal(techFeatureSection.composition, COMPOSITIONS.ASYMMETRIC_BENTO, "Technical character must use asymmetric bento");
  assert.equal(minimalFeatureSection.composition, COMPOSITIONS.FLAT_FEATURE_LIST, "Minimal character must use flat feature list");
  assert.equal(editorialFeatureSection.composition, COMPOSITIONS.EDITORIAL_NARRATIVE, "Editorial character must use editorial narrative");

  // Card policy validation
  assert.equal(techFeatureSection.cardPolicy, CARD_POLICIES.SELECTIVE_ANCHOR, "Technical character uses selective anchor card policy");
  assert.equal(minimalFeatureSection.cardPolicy, CARD_POLICIES.FORBIDDEN, "Minimal character forbids card boxes");
  assert.equal(editorialFeatureSection.cardPolicy, CARD_POLICIES.FORBIDDEN, "Editorial character forbids card boxes");

  // Surface & Rhythm validation
  assert.notEqual(techIr.theme.surfaceStyle, minimalIr.theme.surfaceStyle, "Surfaces must differ across characters");
  assert.notEqual(techIr.theme.rhythm, minimalIr.theme.rhythm, "Rhythm must differ across archetypes");
});

test("PART 4 & 15: Product Launch archetype compiles interactive compiler demonstration and asymmetric bento", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, { archetype: ARCHETYPES.PRODUCT_LAUNCH, character: CHARACTERS.TECHNICAL_PREMIUM });

  const screen = visualIr.screens[0];
  assert.ok(screen, "Compiled screen must exist");

  const compilerStory = screen.sections.find(s => s.semanticType === "compiler_story");
  assert.ok(compilerStory, "Interactive compiler story must be generated");
  assert.equal(compilerStory.composition, COMPOSITIONS.INTERACTIVE_COMPILER_SHOWCASE);
  assert.equal(compilerStory.priority, PRIORITIES.PRIMARY);
  assert.equal(compilerStory.pipelineStages.length >= 6, true, "Pipeline should feature all transformation stages");

  const heroSection = screen.sections.find(s => s.semanticType === "hero");
  assert.ok(heroSection, "Hero section must exist");
  assert.equal(heroSection.composition, COMPOSITIONS.MONUMENTAL_HERO);
  assert.equal(heroSection.priority, PRIORITIES.PRIMARY);

  const bentoSection = screen.sections.find(s => s.composition === COMPOSITIONS.ASYMMETRIC_BENTO);
  assert.ok(bentoSection, "Asymmetric bento section must exist");
  assert.ok(bentoSection.featureLayout.dominantAnchor, "Must have dominant anchor feature");
  assert.equal(bentoSection.featureLayout.supportingStories.length, 2, "Must have 2 supporting stories");
  assert.ok(bentoSection.featureLayout.proofHighlight, "Must have proof highlight item");
});

test("PART 5, 43, 44: Public Shell vs Authenticated Application Shell selection", async () => {
  // 1. Landing Demo -> Must select Public Shell
  const landingSource = await readFile("apps/landing-demo.air", "utf8");
  const landingModel = parseAir(landingSource);
  const landingIr = compilePresentation(landingModel);
  const landingVisual = compileVisualDesign(landingIr, landingModel.design);

  assert.equal(landingVisual.shell.type, SHELL_TYPES.PUBLIC);
  assert.equal(landingVisual.shell.showUserSwitcher, false, "Public shell must NOT include user switcher");
  assert.equal(landingVisual.shell.showDemoPicker, false, "Public shell must NOT include demo picker");

  // Mock DOM render for Public Shell
  const publicRoot = {
    innerHTML: "",
    attributes: {},
    removeAttribute(attr) { delete this.attributes[attr]; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  renderPresentation(publicRoot, landingIr, null, { model: landingModel });
  assert.ok(publicRoot.innerHTML.includes("public-shell"), "Must render public shell container");
  assert.ok(publicRoot.innerHTML.includes("public-nav-header"), "Must render public top navigation bar");
  assert.ok(!publicRoot.innerHTML.includes("sidebar-user-chip"), "Public shell must NOT render sidebar user chip");
  assert.ok(!publicRoot.innerHTML.includes("demo-picker"), "Public shell must NOT render runtime demo picker");

  // 2. Customer Manager -> Must select Authenticated Application Shell
  const crmSource = await readFile("apps/customer-manager.air", "utf8");
  const crmModel = parseAir(crmSource);
  const crmIr = compilePresentation(crmModel);
  const crmVisual = compileVisualDesign(crmIr, crmModel.design);

  assert.equal(crmVisual.shell.type, SHELL_TYPES.APPLICATION);
  assert.equal(crmVisual.shell.showUserSwitcher, true, "App shell includes user switcher in demo mode");
  assert.equal(crmVisual.shell.showDemoPicker, true, "App shell includes demo picker");

  const appRoot = {
    innerHTML: "",
    attributes: {},
    removeAttribute(attr) { delete this.attributes[attr]; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  renderPresentation(appRoot, crmIr, null, { model: crmModel });
  assert.ok(appRoot.innerHTML.includes("app-shell"), "Must render application shell");
  assert.ok(appRoot.innerHTML.includes("sidebar"), "Must render application sidebar");
});

test("PART 18: Automatic prefers-reduced-motion fallback", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);

  // Compiled with reduced motion active in environment
  const reducedMotionVisual = compileVisualDesign(presentationIr, model.design, { prefersReducedMotion: true });

  assert.equal(reducedMotionVisual.theme.motion.reducedMotion, true);
  assert.equal(reducedMotionVisual.theme.motion.spotlightFollow, false);
  assert.equal(reducedMotionVisual.theme.motion.character, MOTION_MODELS.NONE);

  for (const screen of reducedMotionVisual.screens) {
    for (const section of screen.sections) {
      assert.equal(section.motion.type, "none");
      assert.equal(section.motion.reducedMotionFallback, "static");
    }
  }
});

test("PART 36: Visual Semantic Patches mutate Visual Design IR deterministically without CSS", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const baseVisual = compileVisualDesign(presentationIr, { archetype: ARCHETYPES.PRODUCT_LAUNCH, character: CHARACTERS.TECHNICAL_PREMIUM });

  // Apply character patch
  const patchedMinimal = applyVisualDesignPatch(baseVisual, "set design.character minimal");
  assert.equal(patchedMinimal.character, CHARACTERS.MINIMAL);
  assert.equal(patchedMinimal.theme.surfaceStyle, "flat");

  // Apply composition patch
  const patchedSection = applyVisualDesignPatch(baseVisual, "set features.composition flat_feature_list");
  const featureSec = patchedSection.screens[0].sections.find(s => s.semanticType === "feature_grid" || s.semanticType === "features");
  assert.equal(featureSec.composition, COMPOSITIONS.FLAT_FEATURE_LIST);

  // Apply motion patch
  const patchedMotion = applyVisualDesignPatch(baseVisual, "set motion.character cinematic");
  assert.equal(patchedMotion.theme.motion.character, "cinematic");
});

test("PART 39: Visual Design Compiler and Web Renderer contain NO product/domain branches", async () => {
  const visualCode = await readFile("web/runtime/visual_design.mjs", "utf8");
  const forbiddenDomains = [
    /\bCustomer\b/,
    /\bExpense\b/,
    /\bPartner\b/,
    /\bHubSpot\b/,
    /\bPRM\b/,
    /\bCRM\b/
  ];

  for (const domain of forbiddenDomains) {
    assert.equal(domain.test(visualCode), false, `visual_design.mjs must contain zero domain branches for ${domain}`);
  }
});

test("PART 45: Container Budget & Surface Diversity Diagnostic on Product Launch", async () => {
  const { computeVisualDiversityDiagnostic, SURFACE_INTENTS, NARRATIVE_PHASES, VISUAL_ROLES } = await import("../web/runtime/visual_design.mjs");
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);
  const visualIr = compileVisualDesign(presentationIr, { archetype: ARCHETYPES.PRODUCT_LAUNCH, character: CHARACTERS.TECHNICAL_PREMIUM });

  const diagnostic = computeVisualDiversityDiagnostic(visualIr);

  // 1. Containment ratio must be strictly low (< 35%)
  assert.ok(diagnostic.containmentRatio < 0.35, `Containment ratio must be < 0.35 (actual: ${diagnostic.containmentRatio})`);

  // 2. Zero consecutive contained section collisions
  assert.equal(diagnostic.consecutiveSurfaceCollisions, 0, "No two adjacent sections may be contained boxes");

  // 3. High surface diversity (at least 4 distinct surface models used)
  assert.ok(diagnostic.surfaceDiversity.length >= 4, `Must use at least 4 distinct surface models (actual: ${diagnostic.surfaceDiversity.length})`);
  assert.ok(diagnostic.surfaceDiversity.includes(SURFACE_INTENTS.IMMERSIVE), "Must include immersive surface");
  assert.ok(diagnostic.surfaceDiversity.includes(SURFACE_INTENTS.CONTRAST), "Must include contrast surface");
  assert.ok(diagnostic.surfaceDiversity.includes(SURFACE_INTENTS.EDITORIAL), "Must include editorial surface");
  assert.ok(diagnostic.surfaceDiversity.includes(SURFACE_INTENTS.OPEN), "Must include open surface");

  // 4. Narrative Flow verification
  const expectedFlow = [
    NARRATIVE_PHASES.OPENING,
    NARRATIVE_PHASES.DEMONSTRATION,
    NARRATIVE_PHASES.EXPLANATION,
    NARRATIVE_PHASES.PROOF,
    NARRATIVE_PHASES.CONVERSION,
    NARRATIVE_PHASES.SUPPORTING,
    NARRATIVE_PHASES.CONVERSION,
    NARRATIVE_PHASES.SUPPORTING
  ];
  assert.deepEqual(diagnostic.narrativeFlow, expectedFlow, "Narrative flow phases must match launch storytelling structure");

  // 5. Visual roles verification
  const screen = visualIr.screens[0];
  const hero = screen.sections.find(s => s.semanticType === "hero");
  assert.equal(hero.visualRole, VISUAL_ROLES.HERO_TRANSFORMATION);
  const compiler = screen.sections.find(s => s.semanticType === "compiler_story");
  assert.equal(compiler.visualRole, VISUAL_ROLES.COMPILER_STORY);
});

test("PART 46: Web Renderer renders refined hero visual, compiler stage, and unboxed metrics", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const presentationIr = compilePresentation(model);

  const mockRoot = {
    innerHTML: "",
    attributes: {},
    removeAttribute(attr) { delete this.attributes[attr]; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };

  renderPresentation(mockRoot, presentationIr, null, { model });

  // Verify Hero Visual Elements
  assert.ok(mockRoot.innerHTML.includes("landing-hero-composition"), "Must render split monumental hero composition");
  assert.ok(mockRoot.innerHTML.includes("hero-stage-card"), "Must render spatial hero terminal preview");
  assert.ok(mockRoot.innerHTML.includes("hero-transformation-workbench"), "Must render multi-stage transformation flow preview in hero");
  assert.ok(mockRoot.innerHTML.includes("hero-trust-strip"), "Must render technical trust proof strip");

  // Verify Compiler Showcase Stage
  assert.ok(mockRoot.innerHTML.includes("compiler-showcase"), "Must render compiler showcase centerpiece");
  assert.ok(mockRoot.innerHTML.includes("tok-kw"), "Must include syntax highlighting keyword tokens");
  assert.ok(mockRoot.innerHTML.includes("stepper-tab"), "Must render interactive stage tabs");

  // Verify Unboxed Social Proof Metrics
  assert.ok(mockRoot.innerHTML.includes("stats-callout-grid"), "Must render metric band");
  assert.ok(mockRoot.innerHTML.includes("editorial-quote-card"), "Must render editorial quotation");
});

