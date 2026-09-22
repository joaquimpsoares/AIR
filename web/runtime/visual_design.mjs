/**
 * AIR Visual Design IR v1 Compiler & Runtime
 *
 * Defines the platform-neutral Visual Design IR v1 schema, the Visual Design Compiler,
 * the Archetype registry, Character definitions, Composition semantics, and canonical serialization.
 *
 * Architectural Split:
 *   Semantic IR:        What does the application mean?
 *   Presentation IR:    What does the user need to perceive/interact with?
 *   Visual Design IR:   How should information be composed, prioritized, paced, and visually expressed?
 *   Web Renderer:       How is this rendered using HTML/CSS/browser APIs?
 */

import {
  compileUiUtilities,
  compileTailwind,
  UI_UTILITY_IR_VERSION,
  FLOWS,
  SPACING,
  WIDTHS,
  HEIGHTS,
  BREAKPOINTS,
  CONTAINER_BREAKPOINTS
} from "./ui_utility.mjs";

export {
  compileUiUtilities,
  compileTailwind,
  UI_UTILITY_IR_VERSION,
  FLOWS,
  SPACING,
  WIDTHS,
  HEIGHTS,
  BREAKPOINTS,
  CONTAINER_BREAKPOINTS
};

export const VISUAL_DESIGN_IR_VERSION = 1;

/**
 * Core Archetype Vocabulary
 */
export const ARCHETYPES = Object.freeze({
  PRODUCT_LAUNCH: "product_launch",
  ENTERPRISE_WORKSPACE: "enterprise_workspace",
  EDITORIAL_STORY: "editorial_story",
  MINIMAL_SAAS: "minimal_saas"
});

/**
 * Visual Character Descriptors
 */
export const CHARACTERS = Object.freeze({
  TECHNICAL_PREMIUM: "technical-premium",
  MINIMAL: "minimal",
  EDITORIAL: "editorial",
  FUTURISTIC: "futuristic"
});

/**
 * Shell Architecture Types
 */
export const SHELL_TYPES = Object.freeze({
  PUBLIC: "public",
  APPLICATION: "application",
  AUTH: "auth",
  MINIMAL_PUBLIC: "minimal_public"
});

/**
 * Surface Models (Container & Bleed Treatment)
 */
export const SURFACE_INTENTS = Object.freeze({
  IMMERSIVE: "immersive",
  OPEN: "open",
  FULL_BLEED: "full_bleed",
  CONTRAST: "contrast",
  EDITORIAL: "editorial",
  CONTAINED: "contained",
  QUIET: "quiet"
});

/**
 * Narrative Rhythm Phases
 */
export const NARRATIVE_PHASES = Object.freeze({
  OPENING: "opening",
  DEMONSTRATION: "demonstration",
  EXPLANATION: "explanation",
  PROOF: "proof",
  TRUST: "trust",
  CONVERSION: "conversion",
  SUPPORTING: "supporting"
});

/**
 * Visual Artifact Roles
 */
export const VISUAL_ROLES = Object.freeze({
  HERO_TRANSFORMATION: "hero_transformation",
  COMPILER_STORY: "compiler_story",
  CAPABILITY_MATRIX: "capability_matrix",
  PROOF_VISUAL: "proof_visual",
  ARCHITECTURE_VISUAL: "architecture_visual",
  AMBIENT_VISUAL: "ambient_visual"
});

/**
 * Semantic Composition Types (Composition Intent)
 */
export const COMPOSITIONS = Object.freeze({
  MONUMENTAL_HERO: "monumental_hero",
  SPLIT_HERO: "split_hero",
  INTERACTIVE_COMPILER_SHOWCASE: "interactive_compiler_showcase",
  ASYMMETRIC_BENTO: "asymmetric_bento",
  FLAT_FEATURE_LIST: "flat_feature_list",
  EDITORIAL_NARRATIVE: "editorial_narrative",
  METRIC_BAND: "metric_band",
  EDITORIAL_QUOTE: "editorial_quote",
  STRUCTURED_PRICING: "structured_pricing",
  FAQ_ACCORDION: "faq_accordion",
  CONVERSION_BANNER: "conversion_banner",
  NARRATIVE_STACK: "narrative_stack",
  STRUCTURED_PANELS: "structured_panels",
  ACTIONABLE_TABLE: "actionable_table",
  WORKFLOW_STREAM: "workflow_stream",
  AUTH_CONTAINER: "auth_container"
});

/**
 * Information Priority
 */
export const PRIORITIES = Object.freeze({
  PRIMARY: "primary",
  SECONDARY: "secondary",
  TERTIARY: "tertiary",
  SUPPORTING: "supporting",
  AMBIENT: "ambient"
});

/**
 * Visual Weight & Emphasis
 */
export const VISUAL_WEIGHTS = Object.freeze({
  MONUMENTAL: "monumental",
  HEAVY: "heavy",
  MEDIUM: "medium",
  LIGHT: "light",
  SUBTLE: "subtle"
});

/**
 * Rhythms & Pacing
 */
export const RHYTHMS = Object.freeze({
  SPACIOUS: "spacious",
  EDITORIAL: "editorial",
  DENSE: "dense",
  PACED: "paced",
  HEROIC: "heroic"
});

/**
 * Typography Intent
 */
export const TYPOGRAPHY_INTENTS = Object.freeze({
  MONUMENTAL: "monumental",
  EDITORIAL: "editorial",
  TECHNICAL: "technical",
  RESTRAINED: "restrained",
  EXPRESSIVE: "expressive",
  UTILITARIAN: "utilitarian"
});

/**
 * Card Usage Policies (prevents repetitive equal-card syndrome)
 */
export const CARD_POLICIES = Object.freeze({
  FORBIDDEN: "forbidden",
  SELECTIVE_ANCHOR: "selective_anchor",
  STRUCTURED: "structured",
  UNIFORM: "uniform"
});

/**
 * Motion Models
 */
export const MOTION_MODELS = Object.freeze({
  NONE: "none",
  RESTRAINED: "restrained",
  SUBTLE: "subtle",
  EXPRESSIVE: "expressive",
  CINEMATIC: "cinematic"
});

/**
 * Archetype Profiles: Reusable visual intelligence
 */
export const ARCHETYPE_PROFILES = Object.freeze({
  [ARCHETYPES.PRODUCT_LAUNCH]: {
    name: "Product Launch",
    defaultShell: SHELL_TYPES.PUBLIC,
    defaultCharacter: CHARACTERS.TECHNICAL_PREMIUM,
    defaultDensity: "spacious",
    defaultRhythm: RHYTHMS.EDITORIAL,
    defaultMotion: MOTION_MODELS.RESTRAINED,
    typographyIntent: TYPOGRAPHY_INTENTS.MONUMENTAL,
    cardPolicy: CARD_POLICIES.SELECTIVE_ANCHOR,
    navigationPlacement: "top_bar",
    navigationTreatment: "floating_glass",
    showUserToolsInNav: false,
    compositionRules: {
      hero: COMPOSITIONS.MONUMENTAL_HERO,
      product_showcase: COMPOSITIONS.INTERACTIVE_COMPILER_SHOWCASE,
      features: COMPOSITIONS.ASYMMETRIC_BENTO,
      social_proof: COMPOSITIONS.METRIC_BAND,
      testimonials: COMPOSITIONS.EDITORIAL_QUOTE,
      pricing: COMPOSITIONS.STRUCTURED_PRICING,
      faq: COMPOSITIONS.FAQ_ACCORDION,
      cta: COMPOSITIONS.CONVERSION_BANNER
    }
  },
  [ARCHETYPES.ENTERPRISE_WORKSPACE]: {
    name: "Enterprise Workspace",
    defaultShell: SHELL_TYPES.APPLICATION,
    defaultCharacter: CHARACTERS.TECHNICAL_PREMIUM,
    defaultDensity: "compact",
    defaultRhythm: RHYTHMS.DENSE,
    defaultMotion: MOTION_MODELS.SUBTLE,
    typographyIntent: TYPOGRAPHY_INTENTS.UTILITARIAN,
    cardPolicy: CARD_POLICIES.STRUCTURED,
    navigationPlacement: "sidebar",
    navigationTreatment: "solid_sidebar",
    showUserToolsInNav: true,
    compositionRules: {
      dashboard: COMPOSITIONS.STRUCTURED_PANELS,
      collection: COMPOSITIONS.ACTIONABLE_TABLE,
      workflow: COMPOSITIONS.WORKFLOW_STREAM
    }
  },
  [ARCHETYPES.EDITORIAL_STORY]: {
    name: "Editorial Story",
    defaultShell: SHELL_TYPES.PUBLIC,
    defaultCharacter: CHARACTERS.EDITORIAL,
    defaultDensity: "spacious",
    defaultRhythm: RHYTHMS.PACED,
    defaultMotion: MOTION_MODELS.SUBTLE,
    typographyIntent: TYPOGRAPHY_INTENTS.EDITORIAL,
    cardPolicy: CARD_POLICIES.FORBIDDEN,
    navigationPlacement: "top_bar",
    navigationTreatment: "minimal_header",
    showUserToolsInNav: false,
    compositionRules: {
      hero: COMPOSITIONS.SPLIT_HERO,
      features: COMPOSITIONS.EDITORIAL_NARRATIVE,
      social_proof: COMPOSITIONS.EDITORIAL_QUOTE,
      testimonials: COMPOSITIONS.EDITORIAL_QUOTE,
      pricing: COMPOSITIONS.STRUCTURED_PRICING,
      faq: COMPOSITIONS.FAQ_ACCORDION,
      cta: COMPOSITIONS.CONVERSION_BANNER
    }
  },
  [ARCHETYPES.MINIMAL_SAAS]: {
    name: "Minimal SaaS",
    defaultShell: SHELL_TYPES.PUBLIC,
    defaultCharacter: CHARACTERS.MINIMAL,
    defaultDensity: "comfortable",
    defaultRhythm: RHYTHMS.PACED,
    defaultMotion: MOTION_MODELS.NONE,
    typographyIntent: TYPOGRAPHY_INTENTS.RESTRAINED,
    cardPolicy: CARD_POLICIES.FORBIDDEN,
    navigationPlacement: "top_bar",
    navigationTreatment: "minimal_header",
    showUserToolsInNav: false,
    compositionRules: {
      hero: COMPOSITIONS.SPLIT_HERO,
      features: COMPOSITIONS.FLAT_FEATURE_LIST,
      social_proof: COMPOSITIONS.METRIC_BAND,
      testimonials: COMPOSITIONS.EDITORIAL_QUOTE,
      pricing: COMPOSITIONS.STRUCTURED_PRICING,
      faq: COMPOSITIONS.FAQ_ACCORDION,
      cta: COMPOSITIONS.CONVERSION_BANNER
    }
  }
});

/**
 * Character Profiles: Expressive aesthetic intent
 */
export const CHARACTER_PROFILES = Object.freeze({
  [CHARACTERS.TECHNICAL_PREMIUM]: {
    name: "Technical Premium",
    contrast: "high",
    surfaceStyle: "glow",
    monumentalHeadlines: true,
    pointerSpotlight: true,
    codeHighlighting: "technical_mono",
    featureCompositionOverride: COMPOSITIONS.ASYMMETRIC_BENTO,
    cardPolicy: CARD_POLICIES.SELECTIVE_ANCHOR
  },
  [CHARACTERS.MINIMAL]: {
    name: "Minimal",
    contrast: "subtle",
    surfaceStyle: "flat",
    monumentalHeadlines: false,
    pointerSpotlight: false,
    codeHighlighting: "clean_mono",
    featureCompositionOverride: COMPOSITIONS.FLAT_FEATURE_LIST,
    cardPolicy: CARD_POLICIES.FORBIDDEN
  },
  [CHARACTERS.EDITORIAL]: {
    name: "Editorial",
    contrast: "balanced",
    surfaceStyle: "recessed",
    monumentalHeadlines: true,
    pointerSpotlight: false,
    codeHighlighting: "editorial_mono",
    featureCompositionOverride: COMPOSITIONS.EDITORIAL_NARRATIVE,
    cardPolicy: CARD_POLICIES.FORBIDDEN
  },
  [CHARACTERS.FUTURISTIC]: {
    name: "Futuristic",
    contrast: "high",
    surfaceStyle: "glass",
    monumentalHeadlines: true,
    pointerSpotlight: true,
    codeHighlighting: "cyber_mono",
    featureCompositionOverride: COMPOSITIONS.ASYMMETRIC_BENTO,
    cardPolicy: CARD_POLICIES.SELECTIVE_ANCHOR
  }
});

/**
 * Visual Experience Library Registry (Reusable Visual Contracts)
 */
export const VISUAL_EXPERIENCES = Object.freeze({
  "visual.hero": {
    id: "visual.hero",
    version: 1,
    purpose: "High-impact conversion hero with monumental typography and spotlight depth.",
    composition: COMPOSITIONS.MONUMENTAL_HERO,
    priority: PRIORITIES.PRIMARY
  },
  "visual.compiler_story": {
    id: "visual.compiler_story",
    version: 1,
    purpose: "Interactive multi-stage compilation flow visualization with live code transforms.",
    composition: COMPOSITIONS.INTERACTIVE_COMPILER_SHOWCASE,
    priority: PRIORITIES.PRIMARY
  },
  "visual.product_story": {
    id: "visual.product_story",
    version: 1,
    purpose: "Asymmetric bento capability showcase with dominant anchor and supporting visual stories.",
    composition: COMPOSITIONS.ASYMMETRIC_BENTO,
    priority: PRIORITIES.SECONDARY
  },
  "visual.data_story": {
    id: "visual.data_story",
    version: 1,
    purpose: "High-impact metric band highlighting quantitative benchmarks and verified outcomes.",
    composition: COMPOSITIONS.METRIC_BAND,
    priority: PRIORITIES.SECONDARY
  },
  "visual.testimonial": {
    id: "visual.testimonial",
    version: 1,
    purpose: "Editorial quote presentation with dramatic quotation marks and authority attribution.",
    composition: COMPOSITIONS.EDITORIAL_QUOTE,
    priority: PRIORITIES.TERTIARY
  },
  "visual.architecture_story": {
    id: "visual.architecture_story",
    version: 1,
    purpose: "Stepwise technical architecture breakdown with interactive deep-dive.",
    composition: COMPOSITIONS.INTERACTIVE_COMPILER_SHOWCASE,
    priority: PRIORITIES.SECONDARY
  }
});

/**
 * Infer the design archetype from Presentation IR and declared intent.
 */
export function inferArchetype(presentationIr, designIntent = {}) {
  const intent = designIntent ?? {};
  if (intent.archetype && ARCHETYPE_PROFILES[intent.archetype]) {
    return intent.archetype;
  }
  const isMarketing = presentationIr.screens.some((s) => s.type === "marketing_landing" || s.experience === "marketing.landing");
  if (isMarketing) {
    return ARCHETYPES.PRODUCT_LAUNCH;
  }
  const isWorkspace = presentationIr.screens.some((s) => ["dashboard", "resource_management", "workflow_inbox", "user_management"].includes(s.type));
  if (isWorkspace) {
    return ARCHETYPES.ENTERPRISE_WORKSPACE;
  }
  return ARCHETYPES.PRODUCT_LAUNCH;
}

/**
 * Infer the visual character descriptor.
 */
export function inferCharacter(archetype, designIntent = {}) {
  const intent = designIntent ?? {};
  if (intent.character && CHARACTER_PROFILES[intent.character]) {
    return intent.character;
  }
  const profile = ARCHETYPE_PROFILES[archetype] ?? ARCHETYPE_PROFILES[ARCHETYPES.PRODUCT_LAUNCH];
  return profile.defaultCharacter;
}

/**
 * Compiles Presentation IR into Visual Design IR v1.
 *
 * @param {object} presentationIr Platform-neutral Presentation IR v1
 * @param {object} designIntent Compact visual design declarations { archetype, character, rhythm, motion, density, contrast }
 * @param {object} environment Runtime environment context { viewport, prefersReducedMotion, colorScheme }
 * @returns {object} Platform-neutral Visual Design IR v1
 */
export function compileVisualDesign(presentationIr, designIntent = {}, environment = {}) {
  if (!presentationIr || !presentationIr.app) {
    throw new Error("compileVisualDesign requires a valid Presentation IR");
  }

  const intent = designIntent ?? {};
  const archetype = inferArchetype(presentationIr, intent);
  const character = inferCharacter(archetype, intent);
  const archetypeProfile = ARCHETYPE_PROFILES[archetype] ?? ARCHETYPE_PROFILES[ARCHETYPES.PRODUCT_LAUNCH];
  const characterProfile = CHARACTER_PROFILES[character] ?? CHARACTER_PROFILES[CHARACTERS.TECHNICAL_PREMIUM];

  const density = intent.density ?? presentationIr.theme?.density ?? archetypeProfile.defaultDensity;
  const rhythm = intent.rhythm ?? archetypeProfile.defaultRhythm;
  const motionCharacter = environment.prefersReducedMotion ? MOTION_MODELS.NONE : (intent.motion ?? archetypeProfile.defaultMotion);
  const isReducedMotion = Boolean(environment.prefersReducedMotion || motionCharacter === MOTION_MODELS.NONE);

  const isMarketingOnly = presentationIr.screens.length > 0 && presentationIr.screens.every((s) => s.type === "marketing_landing" || s.type.startsWith("auth_"));
  const hasMarketingLanding = presentationIr.screens.some((s) => s.type === "marketing_landing");
  
  // Shell resolution
  let shellType = archetypeProfile.defaultShell;
  if (isMarketingOnly || (hasMarketingLanding && presentationIr.app.initialScreen === "marketing_landing")) {
    shellType = SHELL_TYPES.PUBLIC;
  }

  const shell = {
    type: shellType,
    navigationPlacement: shellType === SHELL_TYPES.PUBLIC ? "top_bar" : archetypeProfile.navigationPlacement,
    navigationTreatment: shellType === SHELL_TYPES.PUBLIC ? archetypeProfile.navigationTreatment : "solid_sidebar",
    showUserSwitcher: shellType === SHELL_TYPES.APPLICATION,
    showDemoPicker: shellType === SHELL_TYPES.APPLICATION,
    showThemeToggle: true,
    brand: {
      title: presentationIr.app.title,
      subtitle: presentationIr.app.subtitle,
      accent: presentationIr.theme.accent,
      character
    },
    publicNavItems: [
      { id: "hero", label: "Overview", href: "#hero" },
      { id: "compiler_story", label: "Architecture", href: "#compiler_story" },
      { id: "features", label: "Capabilities", href: "#features" },
      { id: "proof", label: "Proof", href: "#proof" },
      { id: "pricing", label: "Pricing", href: "#pricing" },
      { id: "faq", label: "FAQ", href: "#faq" }
    ],
    primaryCta: {
      label: "Get Started Free",
      href: "#pricing"
    }
  };

  const compiledScreens = presentationIr.screens.map((screen) => {
    return compileScreenVisualDesign(screen, {
      archetype,
      character,
      archetypeProfile,
      characterProfile,
      density,
      rhythm,
      motionCharacter,
      isReducedMotion,
      environment
    });
  });

  const baseIr = {
    schema: "air.visual-design-ir",
    version: VISUAL_DESIGN_IR_VERSION,
    archetype,
    character,
    shell,
    theme: {
      mode: presentationIr.theme.mode ?? "dark",
      accent: presentationIr.theme.accent ?? "violet",
      contrast: characterProfile.contrast,
      density,
      rhythm,
      surfaceStyle: characterProfile.surfaceStyle,
      typography: {
        intent: archetypeProfile.typographyIntent,
        monumentalHeadlines: characterProfile.monumentalHeadlines,
        codeHighlighting: characterProfile.codeHighlighting
      },
      motion: {
        character: motionCharacter,
        spotlightFollow: characterProfile.pointerSpotlight && !isReducedMotion,
        reducedMotion: isReducedMotion
      }
    },
    screens: compiledScreens,
    experiencesUsed: Array.from(new Set([
      ...(presentationIr.experiencesUsed ?? []),
      "visual.hero",
      "visual.compiler_story",
      "visual.product_story",
      "visual.data_story",
      "visual.testimonial"
    ]))
  };

  const utilities = compileUiUtilities(baseIr, environment);
  const tailwind = compileTailwind(utilities);

  const visualDesignIr = {
    ...baseIr,
    utilities,
    tailwind
  };

  return Object.freeze(visualDesignIr);
}

/**
 * Compile a single screen's Visual Design representation.
 */
function compileScreenVisualDesign(screen, context) {
  const { archetype, character, archetypeProfile, characterProfile, isReducedMotion, environment } = context;

  const isPublicScreen = screen.type === "marketing_landing";
  const isAuthScreen = screen.type.startsWith("auth_");

  let screenShell = isPublicScreen ? SHELL_TYPES.PUBLIC : isAuthScreen ? SHELL_TYPES.AUTH : SHELL_TYPES.APPLICATION;

  const compiledSections = (screen.sections ?? []).map((section, sectionIndex) => {
    return compileSectionVisualDesign(section, sectionIndex, screen, context);
  });

  // Inject interactive compiler story if it is a marketing landing screen and not explicitly present
  if (isPublicScreen) {
    const hasCompilerStory = compiledSections.some((s) => s.semanticType === "compiler_story" || s.composition === COMPOSITIONS.INTERACTIVE_COMPILER_SHOWCASE);
    if (!hasCompilerStory) {
      const heroIdx = compiledSections.findIndex((s) => s.semanticType === "hero");
      const insertAt = heroIdx >= 0 ? heroIdx + 1 : 0;
      
      const compilerStorySection = {
        id: "compiler_story_section",
        semanticType: "compiler_story",
        narrativePhase: NARRATIVE_PHASES.DEMONSTRATION,
        visualRole: VISUAL_ROLES.COMPILER_STORY,
        experience: "visual.compiler_story",
        composition: COMPOSITIONS.INTERACTIVE_COMPILER_SHOWCASE,
        priority: PRIORITIES.PRIMARY,
        visualWeight: VISUAL_WEIGHTS.MONUMENTAL,
        surface: SURFACE_INTENTS.CONTRAST,
        cardPolicy: CARD_POLICIES.FORBIDDEN,
        typographyScale: "section_display",
        spacingPacing: "dramatic_pad",
        title: "Autonomous Intent Compilation",
        subtitle: "How natural intent transforms into deterministic, reactive multi-platform systems without UI boilerplate.",
        motion: {
          type: isReducedMotion ? "none" : "interactive_stage_transition",
          character: context.motionCharacter,
          spotlightGlow: characterProfile.pointerSpotlight && !isReducedMotion,
          reducedMotionFallback: "static"
        },
        pipelineStages: [
          {
            id: "intent",
            step: 1,
            label: "Natural Intent",
            code: "Build a multi-tier approval workflow with manager and finance sign-offs, immutable audit logs, and separation of duty.",
            annotation: "High-level invariant requirement"
          },
          {
            id: "air_source",
            step: 2,
            label: "Compact AIR",
            code: `air version=2\napp approval_flow\nprocess items state=status initial=draft\ntransition items from=draft to=approved by=manager approvals=1\ntransition items from=approved to=paid by=finance distinct=true`,
            annotation: "5 declarations of pure intent"
          },
          {
            id: "semantic_ir",
            step: 3,
            label: "Semantic IR",
            code: `{\n  "schema": "air.canonical-semantic-ir",\n  "process": { "items": { "states": ["draft","approved","paid"], "guards": ["distinct_actor"] } }\n}`,
            annotation: "Guaranteed invariant graph"
          },
          {
            id: "presentation_ir",
            step: 4,
            label: "Presentation IR",
            code: `{\n  "schema": "air.presentation-ir",\n  "version": 1,\n  "screens": [{ "id": "items", "type": "workflow_inbox" }]\n}`,
            annotation: "Platform-neutral UI semantics"
          },
          {
            id: "visual_design_ir",
            step: 5,
            label: "Visual Design IR",
            code: `{\n  "archetype": "${archetype}",\n  "character": "${character}",\n  "composition": "asymmetric_bento",\n  "shell": "public"\n}`,
            annotation: "Editorial rhythm & visual weight"
          },
          {
            id: "platform_delivery",
            step: 6,
            label: "Multi-Platform Delivery",
            code: `Web (DOM & Zero-Boilerplate CSS)  <-->  Native iOS/Android (SwiftUI / Compose)`,
            annotation: "Zero handwritten CSS / state wiring"
          }
        ]
      };
      compiledSections.splice(insertAt, 0, compilerStorySection);
    }
  }

  return {
    id: screen.id,
    type: screen.type,
    title: screen.title,
    subtitle: screen.subtitle,
    shell: screenShell,
    density: context.density,
    rhythm: context.rhythm,
    sections: compiledSections
  };
}

/**
 * Compile a single section's Visual Design composition.
 */
function compileSectionVisualDesign(section, index, screen, context) {
  const { archetype, character, archetypeProfile, characterProfile, isReducedMotion } = context;

  let semanticType = section.type ?? "content";
  let composition = archetypeProfile.compositionRules[semanticType] ?? COMPOSITIONS.STRUCTURED_PANELS;
  let priority = PRIORITIES.SECONDARY;
  let visualWeight = VISUAL_WEIGHTS.MEDIUM;
  let surface = SURFACE_INTENTS.OPEN;
  let narrativePhase = NARRATIVE_PHASES.SUPPORTING;
  let visualRole = VISUAL_ROLES.AMBIENT_VISUAL;
  let cardPolicy = archetypeProfile.cardPolicy;

  // Character and section specific mappings
  if (semanticType === "hero") {
    composition = COMPOSITIONS.MONUMENTAL_HERO;
    priority = PRIORITIES.PRIMARY;
    visualWeight = VISUAL_WEIGHTS.MONUMENTAL;
    surface = SURFACE_INTENTS.IMMERSIVE;
    narrativePhase = NARRATIVE_PHASES.OPENING;
    visualRole = VISUAL_ROLES.HERO_TRANSFORMATION;
    cardPolicy = CARD_POLICIES.FORBIDDEN;
  } else if (semanticType === "feature_grid" || semanticType === "features") {
    composition = characterProfile.featureCompositionOverride ?? composition;
    cardPolicy = characterProfile.cardPolicy;
    priority = PRIORITIES.SECONDARY;
    visualWeight = VISUAL_WEIGHTS.HEAVY;
    surface = SURFACE_INTENTS.EDITORIAL;
    narrativePhase = NARRATIVE_PHASES.EXPLANATION;
    visualRole = VISUAL_ROLES.CAPABILITY_MATRIX;
  } else if (semanticType === "compiler_story") {
    composition = COMPOSITIONS.INTERACTIVE_COMPILER_SHOWCASE;
    priority = PRIORITIES.PRIMARY;
    visualWeight = VISUAL_WEIGHTS.MONUMENTAL;
    surface = SURFACE_INTENTS.CONTRAST;
    narrativePhase = NARRATIVE_PHASES.DEMONSTRATION;
    visualRole = VISUAL_ROLES.COMPILER_STORY;
    cardPolicy = CARD_POLICIES.FORBIDDEN;
  } else if (semanticType === "social_proof" || semanticType === "stats") {
    composition = COMPOSITIONS.METRIC_BAND;
    priority = PRIORITIES.SECONDARY;
    visualWeight = VISUAL_WEIGHTS.HEAVY;
    surface = SURFACE_INTENTS.OPEN;
    narrativePhase = NARRATIVE_PHASES.PROOF;
    visualRole = VISUAL_ROLES.PROOF_VISUAL;
    cardPolicy = CARD_POLICIES.FORBIDDEN;
  } else if (semanticType === "testimonials") {
    composition = COMPOSITIONS.EDITORIAL_QUOTE;
    priority = PRIORITIES.TERTIARY;
    visualWeight = VISUAL_WEIGHTS.MEDIUM;
    surface = SURFACE_INTENTS.EDITORIAL;
    narrativePhase = NARRATIVE_PHASES.TRUST;
    visualRole = VISUAL_ROLES.AMBIENT_VISUAL;
    cardPolicy = CARD_POLICIES.FORBIDDEN;
  } else if (semanticType === "pricing_grid" || semanticType === "pricing") {
    composition = COMPOSITIONS.STRUCTURED_PRICING;
    priority = PRIORITIES.SECONDARY;
    visualWeight = VISUAL_WEIGHTS.HEAVY;
    surface = SURFACE_INTENTS.CONTAINED;
    narrativePhase = NARRATIVE_PHASES.CONVERSION;
    cardPolicy = CARD_POLICIES.SELECTIVE_ANCHOR;
  } else if (semanticType === "faq_accordion" || semanticType === "faq") {
    composition = COMPOSITIONS.FAQ_ACCORDION;
    priority = PRIORITIES.SUPPORTING;
    visualWeight = VISUAL_WEIGHTS.LIGHT;
    surface = SURFACE_INTENTS.QUIET;
    narrativePhase = NARRATIVE_PHASES.SUPPORTING;
    cardPolicy = CARD_POLICIES.FORBIDDEN;
  } else if (semanticType === "call_to_action" || semanticType === "cta") {
    composition = COMPOSITIONS.CONVERSION_BANNER;
    priority = PRIORITIES.PRIMARY;
    visualWeight = VISUAL_WEIGHTS.MONUMENTAL;
    surface = SURFACE_INTENTS.FULL_BLEED;
    narrativePhase = NARRATIVE_PHASES.CONVERSION;
    visualRole = VISUAL_ROLES.AMBIENT_VISUAL;
    cardPolicy = CARD_POLICIES.FORBIDDEN;
  }

  // Feature differentiation: When using asymmetric bento, structure features into dominant anchor + supporting stories
  let featureLayout = null;
  if (section.items && (semanticType === "feature_grid" || semanticType === "features")) {
    if (composition === COMPOSITIONS.ASYMMETRIC_BENTO) {
      featureLayout = {
        dominantAnchor: section.items[0] ?? null,
        supportingStories: section.items.slice(1, 3),
        proofHighlight: section.items[3] ?? null
      };
    }
  }

  return {
    id: section.id,
    semanticType,
    narrativePhase,
    visualRole,
    experience: section.experience ?? `visual.${semanticType}`,
    composition,
    priority,
    visualWeight,
    surface,
    cardPolicy,
    typographyScale: visualWeight === VISUAL_WEIGHTS.MONUMENTAL ? "hero_display" : "section_heading",
    spacingPacing: index % 2 === 0 ? "dramatic_pad" : "editorial_pad",
    motion: {
      type: isReducedMotion ? "none" : (section.motion?.type ?? "staged_reveal"),
      character: context.motionCharacter,
      spotlightGlow: characterProfile.pointerSpotlight && !isReducedMotion,
      reducedMotionFallback: "static"
    },
    featureLayout,
    rawSection: section
  };
}

/**
 * Applies a deterministic Visual Design Semantic Patch to an existing Visual Design IR.
 *
 * Supported Patch Formats:
 *   - "set design.character <character>"
 *   - "set design.archetype <archetype>"
 *   - "set design.rhythm <rhythm>"
 *   - "set design.motion <motion>"
 *   - "set <sectionId>.composition <composition>"
 *   - "set <sectionId>.emphasis <emphasis>"
 *
 * @param {object} visualDesignIr Base Visual Design IR
 * @param {string|object} patch Patch instruction or object
 * @returns {object} Next deterministic Visual Design IR
 */
export function applyVisualDesignPatch(visualDesignIr, patch) {
  if (!visualDesignIr || typeof visualDesignIr !== "object") {
    throw new Error("applyVisualDesignPatch requires a valid visualDesignIr");
  }

  const next = JSON.parse(JSON.stringify(visualDesignIr));

  if (typeof patch === "string") {
    const trimmed = patch.trim();
    const match = /^set\s+([a-zA-Z0-9_.-]+)\s+(.+)$/.exec(trimmed);
    if (!match) {
      throw new Error(`Invalid visual design patch instruction: ${patch}`);
    }
    const [, path, rawValue] = match;
    const value = rawValue.trim();

    if (path === "design.character") {
      if (!CHARACTER_PROFILES[value]) throw new Error(`Unknown character: ${value}`);
      next.character = value;
      next.theme.contrast = CHARACTER_PROFILES[value].contrast;
      next.theme.surfaceStyle = CHARACTER_PROFILES[value].surfaceStyle;
      next.theme.typography.monumentalHeadlines = CHARACTER_PROFILES[value].monumentalHeadlines;
      next.theme.typography.codeHighlighting = CHARACTER_PROFILES[value].codeHighlighting;
      next.theme.motion.spotlightFollow = CHARACTER_PROFILES[value].pointerSpotlight && !next.theme.motion.reducedMotion;
      // Re-evaluate section compositions based on new character
      for (const screen of next.screens) {
        for (const section of screen.sections) {
          if (section.semanticType === "feature_grid" || section.semanticType === "features") {
            section.composition = CHARACTER_PROFILES[value].featureCompositionOverride ?? section.composition;
            section.cardPolicy = CHARACTER_PROFILES[value].cardPolicy;
          }
        }
      }
    } else if (path === "design.archetype") {
      if (!ARCHETYPE_PROFILES[value]) throw new Error(`Unknown archetype: ${value}`);
      next.archetype = value;
      next.shell.type = ARCHETYPE_PROFILES[value].defaultShell;
      next.theme.typography.intent = ARCHETYPE_PROFILES[value].typographyIntent;
    } else if (path === "design.rhythm") {
      next.theme.rhythm = value;
    } else if (path === "design.motion" || path === "motion.character") {
      next.theme.motion.character = value;
    } else if (path.endsWith(".composition")) {
      const sectionId = path.split(".")[0];
      for (const screen of next.screens) {
        const target = screen.sections.find((s) => s.id === sectionId || s.semanticType === sectionId || (sectionId === "features" && s.semanticType === "feature_grid") || (sectionId === "features" && s.semanticType === "features"));
        if (target) {
          target.composition = value;
          if (value === COMPOSITIONS.FLAT_FEATURE_LIST || value === COMPOSITIONS.EDITORIAL_NARRATIVE) {
            target.cardPolicy = CARD_POLICIES.FORBIDDEN;
          }
        }
      }
    } else if (path.endsWith(".emphasis")) {
      const sectionId = path.split(".")[0];
      for (const screen of next.screens) {
        const target = screen.sections.find((s) => s.id === sectionId || s.semanticType === sectionId || (sectionId === "features" && s.semanticType === "feature_grid"));
        if (target) {
          target.visualWeight = value;
        }
      }
    } else {
      throw new Error(`Unsupported visual design patch target path: ${path}`);
    }
  } else if (typeof patch === "object" && patch !== null) {
    if (patch.character) applyVisualDesignPatch(next, `set design.character ${patch.character}`);
    if (patch.archetype) applyVisualDesignPatch(next, `set design.archetype ${patch.archetype}`);
    if (patch.rhythm) applyVisualDesignPatch(next, `set design.rhythm ${patch.rhythm}`);
    if (patch.motion) applyVisualDesignPatch(next, `set design.motion ${patch.motion}`);
  }

  return Object.freeze(next);
}

/**
 * Computes a structural diversity and containment diagnostic for a Visual Design IR.
 *
 * Ensures no generic equal-card repetitions and enforces healthy surface variety.
 *
 * @param {object} visualDesignIr Compiled Visual Design IR
 * @returns {object} Diagnostic metrics { containmentRatio, surfaceDiversity, consecutiveSurfaceCollisions, compositionVariety, narrativeFlow }
 */
export function computeVisualDiversityDiagnostic(visualDesignIr) {
  if (!visualDesignIr || !Array.isArray(visualDesignIr.screens)) {
    return {
      totalSections: 0,
      containedSections: 0,
      containmentRatio: 0,
      surfaceDiversity: [],
      consecutiveSurfaceCollisions: 0,
      compositionVariety: 0,
      narrativeFlow: []
    };
  }

  const allSections = visualDesignIr.screens.flatMap(s => s.sections || []);
  if (allSections.length === 0) {
    return {
      totalSections: 0,
      containedSections: 0,
      containmentRatio: 0,
      surfaceDiversity: [],
      consecutiveSurfaceCollisions: 0,
      compositionVariety: 0,
      narrativeFlow: []
    };
  }

  const containedCount = allSections.filter(s => s.surface === SURFACE_INTENTS.CONTAINED || s.cardPolicy === CARD_POLICIES.STRUCTURED || s.cardPolicy === CARD_POLICIES.UNIFORM).length;
  const containmentRatio = parseFloat((containedCount / allSections.length).toFixed(2));

  const surfaces = allSections.map(s => s.surface || "open");
  const uniqueSurfaces = Array.from(new Set(surfaces));

  let consecutiveCollisions = 0;
  for (let i = 1; i < surfaces.length; i++) {
    if (surfaces[i] === surfaces[i - 1] && surfaces[i] === SURFACE_INTENTS.CONTAINED) {
      consecutiveCollisions++;
    }
  }

  const uniqueCompositions = new Set(allSections.map(s => s.composition)).size;
  const narrativeFlow = allSections.map(s => s.narrativePhase || "supporting");

  return {
    totalSections: allSections.length,
    containedSections: containedCount,
    containmentRatio,
    surfaceDiversity: uniqueSurfaces,
    consecutiveSurfaceCollisions: consecutiveCollisions,
    compositionVariety: uniqueCompositions,
    narrativeFlow
  };
}

/**
 * Deterministic JSON Serialization for Visual Design IR v1.
 */
export function serializeVisualDesignIr(visualDesignIr) {
  return JSON.stringify(visualDesignIr, (key, value) => {
    if (value instanceof Set) return Array.from(value);
    if (value instanceof Map) return Object.fromEntries(value);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sorted = {};
      for (const k of Object.keys(value).sort()) {
        sorted[k] = value[k];
      }
      return sorted;
    }
    return value;
  }, 2);
}


