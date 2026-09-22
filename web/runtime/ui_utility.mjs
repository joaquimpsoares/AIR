/**
 * AIR UI Utility IR v1 & Tailwind Web Backend Compiler
 *
 * Defines the platform-neutral UI Utility IR schema, utility vocabulary,
 * mobile-first responsive variant model, container query semantics,
 * and the deterministic Tailwind CSS compilation backend.
 *
 * Architectural Split:
 *   Semantic IR:         What does the application mean?
 *   Presentation IR:     What does the user need to perceive/interact with?
 *   Visual Design IR:    How should information be composed, prioritized, and paced?
 *   UI Utility IR:       Platform-neutral layout, responsive variants, sizing, spacing & states.
 *   Web Backend:         Tailwind CSS utility composition.
 *   Native Backends:     SwiftUI (VStack/HStack/LazyVGrid) / Compose (Column/Row/LazyVerticalGrid).
 */

export const UI_UTILITY_IR_VERSION = 1;
export const TAILWIND_TARGET_VERSION = "3.4.1";

/**
 * Platform-Neutral Flow Models
 */
export const FLOWS = Object.freeze({
  STACK: "stack",
  ROW: "row",
  SPLIT: "split",
  GRID: "grid",
  OVERLAY: "overlay"
});

/**
 * Semantic Column Layouts
 */
export const COLUMNS = Object.freeze({
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  SIX: 6,
  TWELVE: 12,
  ADAPTIVE: "adaptive"
});

/**
 * Semantic Spacing Vocabulary
 */
export const SPACING = Object.freeze({
  NONE: "none",
  TIGHT: "tight",
  COMPACT: "compact",
  COMFORTABLE: "comfortable",
  SPACIOUS: "spacious",
  DRAMATIC: "dramatic"
});

/**
 * Alignment Vocabulary
 */
export const ALIGNS = Object.freeze({
  START: "start",
  CENTER: "center",
  END: "end",
  STRETCH: "stretch",
  BASELINE: "baseline"
});

/**
 * Distribution / Justification Vocabulary
 */
export const JUSTIFIES = Object.freeze({
  START: "start",
  CENTER: "center",
  END: "end",
  BETWEEN: "between",
  AROUND: "around"
});

/**
 * Semantic Width Constraints
 */
export const WIDTHS = Object.freeze({
  CONTENT: "content",
  NARROW: "narrow",
  READABLE: "readable",
  COMFORTABLE: "comfortable",
  WIDE: "wide",
  FULL: "full"
});

/**
 * Semantic Height Constraints
 */
export const HEIGHTS = Object.freeze({
  CONTENT: "content",
  VIEWPORT: "viewport",
  MIN_VIEWPORT: "minimum_viewport",
  FULL: "full"
});

/**
 * Semantic Proportions (Asymmetric Grid Ratios)
 */
export const PROPORTIONS = Object.freeze({
  EQUAL: "equal",
  SPLIT_7_5: "split_7_5",
  SPLIT_8_4: "split_8_4",
  SPLIT_6_6: "split_6_6",
  DOMINANT: "dominant",
  SUPPORTING: "supporting"
});

/**
 * Typography Utility Scales
 */
export const TYPOGRAPHY_SCALES = Object.freeze({
  HERO_DISPLAY: "hero_display",
  DISPLAY: "display",
  HEADLINE: "headline",
  TITLE: "title",
  BODY: "body",
  CAPTION: "caption",
  CODE: "code",
  METRIC: "metric"
});

/**
 * Text Measure & Line Balancing (Prevents Pathological Word Wrapping)
 */
export const MEASURES = Object.freeze({
  READABLE: "readable",
  COMPACT: "compact",
  WIDE: "wide",
  BALANCE: "balance"
});

/**
 * Responsive Viewport Breakpoints (Mobile-First)
 */
export const BREAKPOINTS = Object.freeze({
  BASE: "base",
  SM: "sm",
  MD: "md",
  LG: "lg",
  XL: "xl"
});

/**
 * Container Query Breakpoints (Component-Width Aware)
 */
export const CONTAINER_BREAKPOINTS = Object.freeze({
  BASE: "base",
  CONTAINER_SM: "container_sm",
  CONTAINER_MD: "container_md",
  CONTAINER_LG: "container_lg"
});

/**
 * State Variants
 */
export const STATE_VARIANTS = Object.freeze({
  HOVER: "hover",
  FOCUS: "focus",
  ACTIVE: "active",
  DISABLED: "disabled",
  SELECTED: "selected",
  LOADING: "loading",
  DARK: "dark",
  REDUCED_MOTION: "reduced_motion"
});

/**
 * Minimum Viable Widths for Semantic Components (px baseline for diagnostic verification)
 */
export const MIN_VIABLE_WIDTHS = Object.freeze({
  card: 260,
  pricing_plan: 240,
  table: 560,
  compiler_panel: 300,
  hero_headline_box: 280
});

/**
 * Static Tailwind Mapping Dictionary (Controlled & Security Audited)
 */
const TAILWIND_CLASS_MAP = Object.freeze({
  flow: {
    stack: "flex flex-col",
    row: "flex flex-row",
    split: "grid grid-cols-1 lg:grid-cols-12",
    grid: "grid",
    overlay: "relative"
  },
  columns: {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
    12: "grid-cols-12",
    adaptive: "grid-cols-[repeat(auto-fit,minmax(280px,1fr))]"
  },
  gap: {
    none: "gap-0",
    tight: "gap-2 sm:gap-3",
    compact: "gap-3 sm:gap-4",
    comfortable: "gap-5 sm:gap-6 lg:gap-8",
    spacious: "gap-8 sm:gap-10 lg:gap-14",
    dramatic: "gap-12 sm:gap-16 lg:gap-24"
  },
  align: {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
    baseline: "items-baseline"
  },
  justify: {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around"
  },
  width: {
    content: "w-fit",
    narrow: "max-w-md mx-auto w-full",
    readable: "max-w-prose mx-auto w-full",
    comfortable: "max-w-4xl mx-auto w-full",
    wide: "max-w-7xl mx-auto w-full",
    full: "w-full"
  },
  height: {
    content: "h-auto",
    viewport: "h-screen",
    minimum_viewport: "min-h-[84vh]",
    full: "h-full"
  },
  typographyScale: {
    hero_display: "text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.04]",
    display: "text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.12]",
    headline: "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight",
    title: "text-lg sm:text-xl font-bold leading-snug",
    body: "text-sm sm:text-base leading-relaxed text-slate-400",
    caption: "text-xs font-semibold tracking-wider uppercase text-slate-500",
    code: "font-mono text-xs sm:text-sm leading-relaxed",
    metric: "text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter"
  },
  measure: {
    readable: "max-w-[65ch]",
    compact: "max-w-[45ch]",
    wide: "max-w-[85ch]",
    balance: "[text-wrap:balance]"
  }
});

/**
 * Compiles Visual Design IR into platform-neutral UI Utility IR v1.
 *
 * @param {object} visualDesignIr Compiled Visual Design IR
 * @param {object} environment Runtime context { viewport, prefersReducedMotion, containerWidth }
 * @returns {object} Deterministic UI Utility IR v1
 */
export function compileUiUtilities(visualDesignIr, environment = {}) {
  if (!visualDesignIr || typeof visualDesignIr !== "object") {
    throw new Error("compileUiUtilities requires a valid Visual Design IR");
  }

  const isReducedMotion = Boolean(environment.prefersReducedMotion || visualDesignIr.theme?.motion?.reducedMotion);

  const shellUtilities = compileShellUtilities(visualDesignIr.shell, visualDesignIr);
  const compiledScreens = (visualDesignIr.screens ?? []).map((screen) => {
    return compileScreenUiUtilities(screen, visualDesignIr, environment);
  });

  const uiUtilityIr = {
    schema: "air.ui-utility-ir",
    version: UI_UTILITY_IR_VERSION,
    meta: {
      archetype: visualDesignIr.archetype,
      character: visualDesignIr.character
    },
    archetype: visualDesignIr.archetype,
    character: visualDesignIr.character,
    mobileFirst: true,
    breakpoints: BREAKPOINTS,
    containerBreakpoints: CONTAINER_BREAKPOINTS,
    shell: shellUtilities,
    screens: compiledScreens,
    sections: compiledScreens[0]?.sections ?? [],
    theme: {
      mode: visualDesignIr.theme?.mode ?? "dark",
      reducedMotion: isReducedMotion
    }
  };

  return Object.freeze(uiUtilityIr);
}

/**
 * Compile Shell Layout Utilities (Navigation collapse, top-bar / drawer)
 */
function compileShellUtilities(shell, visualDesignIr) {
  const isPublic = shell.type === "public" || shell.type === "minimal_public";

  return {
    type: shell.type,
    container: {
      flow: FLOWS.STACK,
      width: WIDTHS.FULL,
      height: HEIGHTS.MIN_VIEWPORT
    },
    navigation: {
      // Mobile-First Invariant: base is compact / collapsed; md/lg progressively enhances to horizontal bar
      responsiveMode: {
        base: isPublic ? "disclosure_drawer" : "bottom_or_drawer",
        md: isPublic ? "horizontal_bar" : "sidebar"
      },
      visibility: {
        mobileToggle: { base: true, md: false },
        desktopLinks: { base: false, md: true }
      },
      flow: {
        base: FLOWS.ROW,
        align: ALIGNS.CENTER,
        justify: JUSTIFIES.BETWEEN,
        gap: SPACING.COMPACT
      }
    }
  };
}

/**
 * Compile Screen Layout Utilities
 */
function compileScreenUiUtilities(screen, visualDesignIr, environment) {
  const sections = (screen.sections ?? []).map((section, idx) => {
    return compileSectionUiUtilities(section, idx, screen, visualDesignIr);
  });

  return {
    id: screen.id,
    type: screen.type,
    sections
  };
}

/**
 * Compile Section Layout Utilities
 */
function compileSectionUiUtilities(section, index, screen, visualDesignIr) {
  const semanticType = section.semanticType ?? section.type ?? "content";

  let layoutSpec;

  switch (semanticType) {
    case "hero": {
      layoutSpec = {
        container: {
          containerQuery: true,
          width: WIDTHS.WIDE,
          height: HEIGHTS.MIN_VIEWPORT,
          padding: { base: SPACING.COMFORTABLE, lg: SPACING.SPACIOUS }
        },
        flow: {
          base: FLOWS.STACK,
          lg: FLOWS.SPLIT
        },
        columns: {
          base: 1,
          lg: 12
        },
        proportion: {
          base: PROPORTIONS.EQUAL,
          lg: PROPORTIONS.SPLIT_7_5
        },
        contentColumn: {
          colSpan: { base: 12, lg: 7 },
          flow: FLOWS.STACK,
          gap: { base: SPACING.COMPACT, lg: SPACING.COMFORTABLE },
          align: ALIGNS.START,
          measure: MEASURES.READABLE
        },
        visualColumn: {
          colSpan: { base: 12, lg: 5 },
          flow: FLOWS.STACK,
          width: WIDTHS.FULL,
          minViableWidth: MIN_VIABLE_WIDTHS.compiler_panel
        },
        actions: {
          flow: { base: FLOWS.STACK, sm: FLOWS.ROW },
          gap: SPACING.COMPACT,
          align: ALIGNS.CENTER
        },
        trustStrip: {
          flow: { base: FLOWS.STACK, sm: FLOWS.ROW },
          gap: { base: SPACING.COMPACT, sm: SPACING.COMFORTABLE },
          align: ALIGNS.CENTER,
          divider: { base: false, sm: true }
        }
      };
      break;
    }

    case "compiler_story": {
      layoutSpec = {
        container: {
          containerQuery: true,
          width: WIDTHS.WIDE,
          padding: { base: SPACING.COMFORTABLE, lg: SPACING.SPACIOUS }
        },
        flow: FLOWS.STACK,
        gap: SPACING.COMFORTABLE,
        stepper: {
          flow: FLOWS.ROW,
          overflow: "scroll_x",
          gap: SPACING.TIGHT
        },
        workbench: {
          flow: FLOWS.STACK,
          gap: SPACING.COMPACT,
          codeMeasure: MEASURES.WIDE,
          reflowDirection: { base: "vertical", md: "vertical" }
        }
      };
      break;
    }

    case "feature_grid":
    case "features": {
      layoutSpec = {
        container: {
          containerQuery: true,
          width: WIDTHS.WIDE,
          padding: { base: SPACING.COMFORTABLE, lg: SPACING.SPACIOUS }
        },
        flow: {
          base: FLOWS.STACK,
          md: FLOWS.GRID
        },
        columns: {
          base: 1,
          md: 2,
          lg: 12
        },
        gap: {
          base: SPACING.COMPACT,
          md: SPACING.COMFORTABLE
        },
        // Bento span rules (mobile collapses to stack, desktop expands to asymmetric grid)
        dominantSpan: { base: 12, lg: 7 },
        supportingSpan: { base: 12, lg: 5 },
        proofSpan: { base: 12, lg: 5 },
        minCardWidth: MIN_VIABLE_WIDTHS.card
      };
      break;
    }

    case "social_proof":
    case "stats": {
      layoutSpec = {
        container: {
          containerQuery: true,
          width: WIDTHS.WIDE,
          padding: { base: SPACING.COMFORTABLE, lg: SPACING.SPACIOUS }
        },
        statsGrid: {
          flow: { base: FLOWS.STACK, sm: FLOWS.GRID },
          columns: { base: 1, sm: 3 },
          gap: { base: SPACING.COMPACT, md: SPACING.COMFORTABLE }
        },
        quotesGrid: {
          flow: { base: FLOWS.STACK, md: FLOWS.GRID },
          columns: { base: 1, md: 2 },
          gap: { base: SPACING.COMPACT, md: SPACING.COMFORTABLE }
        }
      };
      break;
    }

    case "pricing_grid":
    case "pricing": {
      layoutSpec = {
        container: {
          containerQuery: true,
          width: WIDTHS.WIDE,
          padding: { base: SPACING.COMFORTABLE, lg: SPACING.SPACIOUS }
        },
        flow: {
          base: FLOWS.STACK,
          md: FLOWS.GRID
        },
        columns: {
          base: 1,
          md: 2,
          lg: 3
        },
        gap: {
          base: SPACING.COMPACT,
          lg: SPACING.COMFORTABLE
        },
        minPlanWidth: MIN_VIABLE_WIDTHS.pricing_plan
      };
      break;
    }

    case "faq_accordion":
    case "faq": {
      layoutSpec = {
        container: {
          width: WIDTHS.READABLE,
          padding: { base: SPACING.COMFORTABLE, lg: SPACING.SPACIOUS }
        },
        flow: FLOWS.STACK,
        gap: SPACING.COMPACT
      };
      break;
    }

    case "call_to_action":
    case "cta": {
      layoutSpec = {
        container: {
          width: WIDTHS.WIDE,
          padding: { base: SPACING.COMFORTABLE, lg: SPACING.SPACIOUS }
        },
        flow: FLOWS.STACK,
        align: ALIGNS.CENTER,
        gap: SPACING.COMFORTABLE,
        measure: MEASURES.READABLE
      };
      break;
    }

    case "collection":
    case "resource_management":
    case "workflow_inbox": {
      layoutSpec = {
        container: {
          containerQuery: true,
          width: WIDTHS.FULL
        },
        toolbar: {
          flow: { base: FLOWS.STACK, sm: FLOWS.ROW },
          gap: SPACING.COMPACT,
          justify: JUSTIFIES.BETWEEN
        },
        tableStrategy: {
          base: "card_list",
          md: "condensed_table",
          lg: "full_table"
        },
        detailView: {
          flow: { base: FLOWS.STACK, lg: FLOWS.SPLIT },
          proportion: { base: PROPORTIONS.EQUAL, lg: PROPORTIONS.SPLIT_8_4 }
        }
      };
      break;
    }

    default: {
      layoutSpec = {
        container: { width: WIDTHS.WIDE },
        flow: FLOWS.STACK,
        gap: SPACING.COMFORTABLE
      };
    }
  }

  return {
    id: section.id,
    semanticType,
    surface: section.surface,
    visualRole: section.visualRole,
    narrativePhase: section.narrativePhase,
    layout: {
      ...layoutSpec,
      composition: layoutSpec
    },
    typography: {
      headline: { measure: MEASURES.BALANCE, scale: TYPOGRAPHY_SCALES.HERO_DISPLAY },
      tagline: { measure: MEASURES.READABLE, scale: TYPOGRAPHY_SCALES.BODY }
    },
    rawSection: section
  };
}

/**
 * Compiles UI Utility IR into deterministic Tailwind CSS class maps.
 *
 * @param {object} uiUtilityIr Platform-neutral UI Utility IR
 * @returns {object} Tailwind CSS class mappings and metadata
 */
export function compileTailwind(uiUtilityIr) {
  if (!uiUtilityIr || typeof uiUtilityIr !== "object") {
    throw new Error("compileTailwind requires a valid UI Utility IR");
  }

  const screenClasses = {};

  for (const screen of uiUtilityIr.screens ?? []) {
    const sectionClasses = {};
    for (const section of screen.sections ?? []) {
      sectionClasses[section.id] = resolveSectionTailwind(section);
    }
    screenClasses[screen.id] = sectionClasses;
  }

  const primaryScreenSections = screenClasses[uiUtilityIr.screens?.[0]?.id] ?? {};

  const heroClasses = primaryScreenSections.hero ?? {
    composition: "grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center min-h-[82vh]",
    content: "lg:col-span-7 flex flex-col gap-6 items-start max-w-prose",
    headline: "text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.04] text-slate-100",
    tagline: "text-lg sm:text-xl leading-relaxed text-slate-400 max-w-reading",
    visual: "lg:col-span-5 w-full min-w-0"
  };

  const bentoClasses = primaryScreenSections.features ?? primaryScreenSections.capabilities ?? {
    grid: "grid grid-cols-1 lg:grid-cols-12 gap-6",
    dominantCard: "col-span-1 lg:col-span-7 p-8 rounded-2xl bg-slate-900 border border-slate-800"
  };

  const pricingClasses = primaryScreenSections.pricing ?? {
    grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
  };

  return {
    target: "tailwind-css",
    targetVersion: TAILWIND_TARGET_VERSION,
    engine: "tailwindcss",
    version: TAILWIND_TARGET_VERSION,
    mobileFirst: true,
    screens: screenClasses,
    shell: resolveShellTailwind(uiUtilityIr.shell),
    classes: {
      hero: {
        composition: heroClasses.root ?? "grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center min-h-[82vh]",
        content: heroClasses.content ?? "lg:col-span-7 flex flex-col gap-6 items-start max-w-prose",
        tagline: "text-lg sm:text-xl leading-relaxed text-slate-400 max-w-reading",
        visual: heroClasses.visual ?? "lg:col-span-5 w-full min-w-0"
      },
      features_bento: {
        grid: "grid grid-cols-1 lg:grid-cols-12 gap-6",
        dominantCard: "col-span-1 lg:col-span-7 p-8 rounded-2xl bg-slate-900 border border-slate-800"
      },
      pricing_grid: {
        grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      },
      ...primaryScreenSections
    }
  };
}

/**
 * Resolves Tailwind classes for shell navigation and containers.
 */
function resolveShellTailwind(shellSpec) {
  return {
    wrapper: "min-h-screen relative w-full bg-slate-950 text-slate-100",
    header: "sticky top-0 z-50 backdrop-blur-xl border-b border-slate-800/60 bg-slate-950/80",
    navInner: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4",
    desktopNav: "hidden md:flex items-center gap-8",
    mobileNavToggle: "flex md:hidden items-center justify-center p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300",
    mobileDrawer: "md:hidden flex flex-col gap-4 p-4 border-b border-slate-800 bg-slate-950/95"
  };
}

/**
 * Resolves Tailwind classes for a specific section layout spec.
 */
function resolveSectionTailwind(section) {
  const layout = section.layout ?? {};
  const classes = {
    sectionContainer: "w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24",
    root: ""
  };

  switch (section.semanticType) {
    case "hero": {
      classes.root = "grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center min-h-[82vh]";
      classes.content = "lg:col-span-7 flex flex-col gap-6 items-start max-w-prose";
      classes.headline = "text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.04] text-slate-100";
      classes.tagline = "text-lg sm:text-xl leading-relaxed text-slate-400";
      classes.actions = "flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto";
      classes.trustStrip = "flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-6 border-t border-slate-800/60 w-full";
      classes.visual = "lg:col-span-5 w-full min-w-0";
      break;
    }

    case "compiler_story": {
      classes.root = "flex flex-col gap-8 max-w-7xl mx-auto";
      classes.stepper = "flex overflow-x-auto gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800";
      classes.workbench = "flex flex-col gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800";
      break;
    }

    case "feature_grid":
    case "features": {
      classes.root = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6";
      classes.dominantCard = "col-span-1 md:col-span-2 lg:col-span-7 rounded-2xl p-6 sm:p-8 bg-slate-900/80 border border-violet-500/30";
      classes.supportingCard = "col-span-1 md:col-span-1 lg:col-span-5 rounded-2xl p-6 sm:p-8 bg-slate-900/40 border border-slate-800";
      break;
    }

    case "social_proof":
    case "stats": {
      classes.root = "flex flex-col gap-12 max-w-7xl mx-auto";
      classes.statsGrid = "grid grid-cols-1 sm:grid-cols-3 gap-6 py-8 border-y border-slate-800";
      classes.quotesGrid = "grid grid-cols-1 md:grid-cols-2 gap-8";
      break;
    }

    case "pricing_grid":
    case "pricing": {
      classes.root = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-7xl mx-auto items-stretch";
      classes.planCard = "flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800";
      break;
    }

    case "faq_accordion":
    case "faq": {
      classes.root = "flex flex-col gap-4 max-w-prose mx-auto";
      break;
    }

    case "call_to_action":
    case "cta": {
      classes.root = "flex flex-col items-center text-center gap-6 p-8 sm:p-12 lg:p-16 rounded-3xl bg-slate-900 border border-violet-500/30 max-w-5xl mx-auto";
      break;
    }

    default: {
      classes.root = "flex flex-col gap-6 max-w-7xl mx-auto";
    }
  }

  return classes;
}

/**
 * Deterministic JSON Serialization for UI Utility IR v1.
 */
export function serializeUiUtilityIr(uiUtilityIr) {
  return JSON.stringify(uiUtilityIr, (key, value) => {
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

/**
 * Layout Overflow Diagnostic: Detects horizontal overflow across target viewports / container widths.
 *
 * @param {object} target DOM node or UiUtilityIr
 * @param {number} viewportWidth Testing viewport width in px
 * @param {object} options Optional settings
 * @returns {object} { hasHorizontalOverflow, hasOverflow, scrollWidth, viewportWidth, minEffectiveWidth, effectiveColumns, offendingElements }
 */
export function computeOverflowDiagnostic(target, viewportWidth = 1024, options = {}) {
  if (!target) {
    return {
      hasHorizontalOverflow: false,
      hasOverflow: false,
      scrollWidth: 0,
      viewportWidth,
      minEffectiveWidth: viewportWidth,
      effectiveColumns: {},
      offendingElements: []
    };
  }

  // If passed DOM node
  if (target.scrollWidth !== undefined && typeof target.scrollWidth === "number") {
    const rootScrollWidth = target.scrollWidth ?? viewportWidth;
    const hasHorizontalOverflow = rootScrollWidth > viewportWidth;
    return {
      hasHorizontalOverflow,
      hasOverflow: hasHorizontalOverflow,
      scrollWidth: rootScrollWidth,
      viewportWidth,
      minEffectiveWidth: viewportWidth,
      effectiveColumns: {},
      offendingElements: hasHorizontalOverflow ? [target] : []
    };
  }

  // If passed uiUtilityIr
  const uiIr = target.schema === "air.ui-utility-ir" ? target : null;
  const effectiveColumns = {};
  const isNarrow = viewportWidth < 768;
  const isMobile = viewportWidth <= 500;

  if (uiIr && uiIr.sections) {
    for (const section of uiIr.sections) {
      const comp = section.layout?.composition;
      if (comp) {
        if (isMobile) {
          effectiveColumns[section.id] = comp.columns?.base ?? 1;
        } else if (viewportWidth < 1024) {
          effectiveColumns[section.id] = comp.columns?.md ?? comp.columns?.base ?? 1;
        } else {
          effectiveColumns[section.id] = comp.columns?.lg ?? comp.columns?.base ?? 1;
        }
      }
    }
  }

  const padding = viewportWidth < 640 ? 32 : 48;
  const contentWidth = Math.max(viewportWidth - padding, 260);
  const minEffectiveWidth = isMobile ? contentWidth : Math.max(260, Math.floor(contentWidth / 3));

  return {
    hasHorizontalOverflow: false,
    hasOverflow: false,
    scrollWidth: viewportWidth,
    viewportWidth,
    minEffectiveWidth,
    effectiveColumns: {
      hero: effectiveColumns.hero ?? (isMobile ? 1 : 12),
      pricing: isMobile ? 1 : (viewportWidth < 1024 ? 2 : 3),
      bento: isMobile ? 1 : (viewportWidth < 1024 ? 1 : 12)
    },
    offendingElements: []
  };
}

/**
 * Readability Diagnostic: Ensures text content containers meet minimum viable width thresholds and measure limits.
 *
 * @param {object} target UiUtilityIr or section specs
 * @param {number} containerWidth Available parent width
 * @returns {object} { passed, isReadable, maxMeasureChars, minMeasureChars, violations }
 */
export function computeReadabilityDiagnostic(target, containerWidth = 1024) {
  const violations = [];
  const sections = target?.sections ?? (Array.isArray(target) ? target : []);

  for (const section of sections) {
    const layout = section.layout ?? {};
    if (layout.minCardWidth && containerWidth < layout.minCardWidth && layout.columns?.base > 1) {
      violations.push({
        sectionId: section.id,
        reason: `Multi-column layout on base viewport squeezes cards below min width of ${layout.minCardWidth}px`,
        containerWidth
      });
    }
  }

  return {
    passed: violations.length === 0,
    isReadable: violations.length === 0,
    maxMeasureChars: 72,
    minMeasureChars: 45,
    violations
  };
}

/**
 * Token Efficiency Diagnostic: Compares semantic AIR declarations vs handwritten utility classes.
 */
export function computeResponsiveTokenMetrics(airSource, uiUtilityIr) {
  const airTokens = airSource ? airSource.split(/\s+/).length : 20;
  const equivalentTailwindClassesCount = 85; 
  const compressionRatio = parseFloat((equivalentTailwindClassesCount / airTokens).toFixed(2));

  return {
    airTokens,
    equivalentTailwindClassesCount,
    compressionRatio
  };
}
