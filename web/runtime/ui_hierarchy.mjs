/**
 * AIR 4-Level UI Architecture & Catalogs
 *
 * Formalizes the compiler-native hierarchy:
 *   1. EXPERIENCE:   Broad product interaction & default section composition
 *   2. SECTION:      Meaningful experience region with semantic role and artifact composition
 *   3. ARTIFACT:     Reusable UI / interaction unit with intrinsic responsive & state behaviors
 *   4. UI UTILITY:   Platform-neutral layout, sizing, flow, and container query semantics
 *   -> PLATFORM BACKEND: Web (Tailwind CSS) | iOS (SwiftUI) | Android (Compose)
 *
 * Highest-Level-First Rule:
 *   AI queries/declares: Experience -> Section -> Artifact -> UI Utility.
 *   Compiler owns structure, responsive recomposition, accessibility, and standard states.
 */

export const UI_HIERARCHY_VERSION = 1;

/**
 * Standard Information Priority for fields and content elements
 */
export const INFORMATION_PRIORITY = Object.freeze({
  PRIMARY: "primary",       // Always visible at all widths
  SECONDARY: "secondary",   // Visible on tablet/desktop; moved to detail/disclosure at narrow mobile
  SUPPORTING: "supporting", // Visible on wide desktop; collapsed on smaller viewports
  METADATA: "metadata"      // Subdued / hidden on narrow mobile unless requested
});

/**
 * Standard Artifact Lifecycle States
 */
export const ARTIFACT_STATES = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  EMPTY: "empty",
  FILTERED_EMPTY: "filtered_empty",
  ERROR: "error",
  DENIED: "denied",
  UNAVAILABLE: "unavailable"
});

/**
 * Platform Mapping Targets
 */
export const PLATFORM_TARGETS = Object.freeze({
  WEB: "web_tailwind",
  IOS: "ios_swiftui",
  ANDROID: "android_compose"
});

/**
 * Representation Modes selected by the Compiler / Runtime Layout Resolution.
 * CSS Media Queries MUST NOT make behavioral representation decisions.
 */
export const COLLECTION_REPRESENTATION = Object.freeze({
  TABLE: "table",
  CONDENSED_TABLE: "condensed_table",
  RECORD_LIST: "record_list"
});

export const FORM_REPRESENTATION = Object.freeze({
  MULTI_COLUMN: "multi_column",
  SINGLE_COLUMN: "single_column"
});

export const NAVIGATION_REPRESENTATION = Object.freeze({
  FULL: "full",
  COMPACT: "compact"
});

export const HERO_REPRESENTATION = Object.freeze({
  SPLIT: "split",
  STACKED: "stacked"
});

export const WORKFLOW_REPRESENTATION = Object.freeze({
  GRAPH_AND_DETAIL: "graph_and_detail",
  VERTICAL_STATE_STORY: "vertical_state_story"
});

export const SHELL_REPRESENTATION = Object.freeze({
  SIDEBAR: "sidebar",
  COMPACT: "compact",
  PUBLIC: "public",
  PUBLIC_COMPACT: "public_compact"
});

export const FEATURE_STORY_REPRESENTATION = Object.freeze({
  ASYMMETRIC_BENTO: "asymmetric_bento",
  BALANCED_GRID: "balanced_grid",
  NARRATIVE_STACK: "narrative_stack"
});

export const DASHBOARD_REPRESENTATION = Object.freeze({
  DASHBOARD_GRID: "dashboard_grid",
  DASHBOARD_CONDENSED: "dashboard_condensed",
  DASHBOARD_STACK: "dashboard_stack"
});

export const PROOF_REPRESENTATION = Object.freeze({
  PROOF_BAND: "proof_band",
  PROOF_STACK: "proof_stack"
});

export const PRICING_REPRESENTATION = Object.freeze({
  COMPARISON_GRID: "comparison_grid",
  SEQUENTIAL_PLANS: "sequential_plans"
});

export const PRODUCT_STORY_REPRESENTATION = Object.freeze({
  SPLIT_STORY: "split_story",
  NARRATIVE_STACK: "narrative_stack"
});

export const DRAWER_REPRESENTATION = Object.freeze({
  RIGHT_DRAWER: "right_drawer",
  WIDE_SHEET: "wide_sheet",
  FULL_SCREEN_SHEET: "full_screen_sheet"
});

export const DRAWER_SIZE = Object.freeze({
  COMPACT: "compact",     // 380px max-width on desktop
  STANDARD: "standard",   // 480px max-width on desktop
  WIDE: "wide"            // 640px max-width on desktop
});

export const DRAWER_STACK_POLICY = "single_primary_replace";

export const MENU_REPRESENTATION = Object.freeze({
  TOP_POPOVER: "top_popover",
  DROPDOWN: "dropdown",
  OVERFLOW_MENU: "overflow_menu",
  COMPACT_SHEET: "compact_sheet"
});

/**
 * Section Rhythm & Inter-Section Spacing Constants
 */
export const SECTION_RHYTHM = Object.freeze({
  TIGHT: "tight",
  COMPACT: "compact",
  COMFORTABLE: "comfortable",
  SPACIOUS: "spacious",
  DRAMATIC: "dramatic"
});

export const SECTION_RELATIONSHIP = Object.freeze({
  INDEPENDENT: "independent",
  GROUPED: "grouped",
  CONTINUOUS: "continuous",
  ATTACHED: "attached"
});

export const SECTION_RHYTHM_VALUES = Object.freeze({
  [SECTION_RHYTHM.TIGHT]: { rem: 0.5, px: 8 },
  [SECTION_RHYTHM.COMPACT]: { rem: 1.0, px: 16 },
  [SECTION_RHYTHM.COMFORTABLE]: { rem: 1.75, px: 28 },
  [SECTION_RHYTHM.SPACIOUS]: { rem: 3.0, px: 48 },
  [SECTION_RHYTHM.DRAMATIC]: { rem: 4.5, px: 72 }
});

/**
 * 1. UI EXPERIENCES CATALOG
 */
export const UI_EXPERIENCES = Object.freeze({
  product_launch: {
    id: "product_launch",
    title: "Product Launch Experience",
    description: "Public editorial narrative designed for product reveals, conversion, and architecture trust.",
    defaultShell: "public",
    defaultRhythm: "editorial",
    defaultSectionRhythm: "spacious",
    density: "comfortable",
    defaultSections: [
      { role: "hero", priority: "primary" },
      { role: "product_story", priority: "primary" },
      { role: "feature_story", priority: "secondary" },
      { role: "proof", priority: "secondary" },
      { role: "pricing", priority: "secondary" },
      { role: "faq", priority: "supporting" },
      { role: "cta", priority: "primary" },
      { role: "content", priority: "metadata" }
    ],
    responsiveStrategy: "narrative_reflow",
    platformMappings: {
      web: { shell: "PublicShell", container: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
      ios: { shell: "ScrollViewWithStickyHeader", container: "NavigationView" },
      android: { shell: "ScaffoldWithCollapsingToolbar", container: "LazyColumn" }
    }
  },

  enterprise_workspace: {
    id: "enterprise_workspace",
    title: "Enterprise Workspace Experience",
    description: "High-density productivity application with dashboard metrics, resource collections, and workflow queues.",
    defaultShell: "authenticated_sidebar",
    defaultRhythm: "structured_grid",
    defaultSectionRhythm: "comfortable",
    density: "compact",
    defaultSections: [
      { role: "dashboard", priority: "primary" },
      { role: "collection", priority: "primary" },
      { role: "detail", priority: "secondary" },
      { role: "editor", priority: "secondary" },
      { role: "workflow_story", priority: "secondary" }
    ],
    responsiveStrategy: "sidebar_to_drawer_and_card_reflow",
    platformMappings: {
      web: { shell: "AppShell", container: "flex min-h-screen bg-slate-950" },
      ios: { shell: "NavigationSplitView", container: "SidebarWithDetail" },
      android: { shell: "NavigationSuiteScaffold", container: "PermanentDrawerWithContent" }
    }
  },

  resource_management: {
    id: "resource_management",
    title: "Resource Management Experience",
    description: "Full-lifecycle CRUD data management with search, multi-filter, pagination, and detail drawers.",
    defaultShell: "authenticated_sidebar",
    defaultRhythm: "structured_panel",
    defaultSectionRhythm: "comfortable",
    density: "comfortable",
    defaultSections: [
      { role: "collection", priority: "primary" },
      { role: "editor", priority: "secondary" },
      { role: "detail", priority: "secondary" }
    ],
    responsiveStrategy: "table_to_card_list",
    platformMappings: {
      web: { shell: "AppShell", container: "w-full max-w-7xl mx-auto p-6" },
      ios: { shell: "NavigationStack", container: "ListWithSearchable" },
      android: { shell: "Scaffold", container: "LazyColumnWithSearchBar" }
    }
  },

  workflow_review: {
    id: "workflow_review",
    title: "Workflow Review & Approval Experience",
    description: "Immutable state-transition review inbox with multi-actor separation, deadlines, and decision history.",
    defaultShell: "authenticated_sidebar",
    defaultRhythm: "focus_inbox",
    density: "comfortable",
    defaultSections: [
      { role: "workflow_story", priority: "primary" },
      { role: "detail", priority: "primary" },
      { role: "activity", priority: "secondary" }
    ],
    responsiveStrategy: "graph_to_vertical_timeline_and_action_sheet",
    platformMappings: {
      web: { shell: "AppShell", container: "grid grid-cols-1 lg:grid-cols-12 gap-6" },
      ios: { shell: "NavigationStack", container: "ListWithDetailSheet" },
      android: { shell: "Scaffold", container: "TwoPaneWithBottomSheet" }
    }
  },

  authentication: {
    id: "authentication",
    title: "Authentication & Identity Experience",
    description: "Zero-clutter centered auth flows for sign in, multi-tenant registration, identity verification, and password recovery.",
    defaultShell: "centered_card",
    defaultRhythm: "quiet",
    density: "comfortable",
    defaultSections: [
      { role: "editor", priority: "primary" }
    ],
    responsiveStrategy: "centered_card_to_full_viewport_mobile",
    platformMappings: {
      web: { shell: "AuthShell", container: "min-h-screen flex items-center justify-center p-4" },
      ios: { shell: "FullScreenCover", container: "VStackCentered" },
      android: { shell: "Surface", container: "BoxCentered" }
    }
  },

  onboarding: {
    id: "onboarding",
    title: "Guided Onboarding Experience",
    description: "Step-by-step interactive workflow guiding users through initial configuration.",
    defaultShell: "minimal_public",
    defaultRhythm: "stepped",
    density: "comfortable",
    defaultSections: [
      { role: "hero", priority: "primary" },
      { role: "editor", priority: "primary" },
      { role: "proof", priority: "secondary" }
    ],
    responsiveStrategy: "horizontal_steps_to_vertical_stepper",
    platformMappings: {
      web: { shell: "MinimalShell", container: "max-w-2xl mx-auto py-12 px-4" },
      ios: { shell: "TabViewPaged", container: "CarouselView" },
      android: { shell: "HorizontalPager", container: "PagerWithIndicators" }
    }
  },

  documentation: {
    id: "documentation",
    title: "Technical Documentation Experience",
    description: "Content-focused knowledge base with navigation tree, search, readable prose, and code demos.",
    defaultShell: "docs_sidebar",
    defaultRhythm: "editorial_prose",
    density: "comfortable",
    defaultSections: [
      { role: "search", priority: "primary" },
      { role: "content", priority: "primary" },
      { role: "timeline", priority: "secondary" }
    ],
    responsiveStrategy: "side_nav_to_slideout_and_prose_flow",
    platformMappings: {
      web: { shell: "DocsShell", container: "grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8" },
      ios: { shell: "NavigationSplitView", container: "SidebarWithScrollView" },
      android: { shell: "ModalNavigationDrawer", container: "LazyColumn" }
    }
  },

  checkout: {
    id: "checkout",
    title: "Checkout & Subscription Experience",
    description: "Payment and tier activation flow with order summary, plan verification, and secure payment entry.",
    defaultShell: "centered_split",
    defaultRhythm: "contrast",
    density: "comfortable",
    defaultSections: [
      { role: "comparison", priority: "primary" },
      { role: "editor", priority: "primary" },
      { role: "proof", priority: "secondary" }
    ],
    responsiveStrategy: "split_columns_to_stacked_accordion",
    platformMappings: {
      web: { shell: "CheckoutShell", container: "max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8" },
      ios: { shell: "NavigationStack", container: "FormWithSummaryHeader" },
      android: { shell: "Scaffold", container: "ColumnWithStickyBottomButton" }
    }
  }
});

/**
 * 2. UI SECTIONS CATALOG
 */
export const UI_SECTIONS = Object.freeze({
  hero: {
    id: "hero",
    title: "Hero Section",
    role: "hero",
    description: "Opening impression with primary headline, tagline, call-to-actions, and interactive stage artifact.",
    requiredArtifacts: ["navigation"],
    composedArtifacts: ["code_demo", "metric", "navigation"],
    allowedCompositions: ["split", "stack", "full_bleed", "open_canvas"],
    responsivePolicy: {
      wide: "split (12 columns: 7 content, 5 visual workbench)",
      medium: "split (12 columns: 7 content, 5 visual workbench)",
      narrow: "stack (1 column, full-width narrative flow, code demo under CTA)",
      containerQuery: true,
      minViableWidth: 320
    },
    accessibility: {
      landmark: "banner",
      headingLevel: "h1",
      keyboardNav: "tabbable CTA buttons and code demo controls"
    },
    platformMappings: {
      web: { tag: "header", baseClasses: "w-full py-12 sm:py-16 lg:py-24" },
      ios: { view: "VStack", alignment: "leading" },
      android: { composable: "Column", modifier: "fillMaxWidth" }
    }
  },

  collection: {
    id: "collection",
    title: "Collection Management Section",
    role: "collection",
    description: "Primary data view composing search, filter bar, table/list view, pagination, and bulk actions.",
    requiredArtifacts: ["collection"],
    composedArtifacts: ["search", "filters", "sort", "table", "list", "pagination", "empty_state", "loading_state"],
    allowedCompositions: ["table_view", "card_grid", "stacked_list"],
    responsivePolicy: {
      wide: "multi-column data table with inline action column and expanded filters",
      medium: "condensed data table with secondary columns moved to popover",
      narrow: "semantic card list with primary field badge, status chip, and dropdown menu",
      containerQuery: true,
      containerBreakpoint: 520
    },
    accessibility: {
      landmark: "region",
      ariaRole: "region",
      headingLevel: "h2",
      keyboardNav: "row arrow key navigation, enter to view detail, escape to dismiss filter"
    },
    platformMappings: {
      web: { tag: "section", baseClasses: "w-full flex flex-col gap-4" },
      ios: { view: "List", style: "insetGrouped" },
      android: { composable: "LazyColumn", modifier: "fillMaxWidth" }
    }
  },

  editor: {
    id: "editor",
    title: "Editor / Form Section",
    role: "editor",
    description: "Interactive data mutation section composing typed inputs, validations, and action buttons.",
    requiredArtifacts: ["form"],
    composedArtifacts: ["form", "modal", "sheet"],
    allowedCompositions: ["modal_dialog", "embedded_panel", "bottom_sheet", "full_page"],
    responsivePolicy: {
      wide: "2-column grid for standard fields, full width for long text and relations",
      medium: "2-column grid",
      narrow: "1-column vertical stack with sticky bottom submission bar",
      containerQuery: true,
      containerBreakpoint: 440
    },
    accessibility: {
      landmark: "form",
      ariaRole: "form",
      keyboardNav: "tab index sequence, inline error focus on submit, aria-invalid"
    },
    platformMappings: {
      web: { tag: "form", baseClasses: "grid grid-cols-1 sm:grid-cols-2 gap-4" },
      ios: { view: "Form", style: "grouped" },
      android: { composable: "Column", modifier: "fillMaxWidth" }
    }
  },

  dashboard: {
    id: "dashboard",
    title: "Dashboard Overview Section",
    role: "dashboard",
    description: "Executive and operational summary composing metric cards, quick actions, and recent activity streams.",
    requiredArtifacts: ["metric"],
    composedArtifacts: ["metric", "chart", "table", "list", "activity"],
    allowedCompositions: ["metric_grid", "kpi_band", "bento_summary"],
    responsivePolicy: {
      wide: "4-column metric grid above 2-column recent activity tables",
      medium: "2-column metric grid above stacked activity panels",
      narrow: "1-column metric carousel or vertical stack with swipeable cards",
      containerQuery: true
    },
    accessibility: {
      landmark: "region",
      ariaRole: "region",
      headingLevel: "h2",
      liveRegion: "polite"
    },
    platformMappings: {
      web: { tag: "section", baseClasses: "flex flex-col gap-6" },
      ios: { view: "ScrollView", subviews: ["LazyVGrid", "Section"] },
      android: { composable: "LazyColumn", subviews: ["LazyVerticalGrid", "Card"] }
    }
  },

  feature_story: {
    id: "feature_story",
    title: "Feature Story Section",
    role: "feature_story",
    description: "Asymmetric or structured capability showcase highlighting key architectural pillars.",
    requiredArtifacts: ["card"],
    composedArtifacts: ["card", "bento", "metric", "code_demo"],
    allowedCompositions: ["asymmetric_bento", "grid_cards", "typographic_list"],
    responsivePolicy: {
      wide: "asymmetric bento (dominant 7 cols, supporting 5 cols)",
      medium: "2-column grid",
      narrow: "1-column vertical card stack with prominent icons and metrics",
      containerQuery: true
    },
    accessibility: {
      landmark: "region",
      headingLevel: "h2",
      keyboardNav: "tab navigable feature cards"
    },
    platformMappings: {
      web: { tag: "section", baseClasses: "w-full py-12" },
      ios: { view: "LazyVGrid", columns: "adaptive" },
      android: { composable: "LazyVerticalGrid", columns: "Adaptive" }
    }
  },

  workflow_story: {
    id: "workflow_story",
    title: "Workflow Review & Graph Section",
    role: "workflow_story",
    description: "State machine visualization and pending transition inbox with two-key approval controls.",
    requiredArtifacts: ["workflow_graph"],
    composedArtifacts: ["workflow_graph", "workflow_inbox", "history", "detail"],
    allowedCompositions: ["split_graph_inbox", "vertical_stepper", "focused_inbox"],
    responsivePolicy: {
      wide: "split view (6 cols graph visualization, 6 cols approval inbox & history)",
      medium: "stacked view (graph on top, inbox below)",
      narrow: "sequential state breadcrumb + action sheet cards with swipe actions",
      containerQuery: true,
      containerBreakpoint: 600
    },
    accessibility: {
      landmark: "region",
      headingLevel: "h2",
      ariaLive: "polite"
    },
    platformMappings: {
      web: { tag: "section", baseClasses: "grid grid-cols-1 lg:grid-cols-12 gap-6" },
      ios: { view: "VStack", style: "workflowContainer" },
      android: { composable: "Column", style: "workflowScaffold" }
    }
  },

  pricing: {
    id: "pricing",
    title: "Pricing Comparison Section",
    role: "pricing",
    description: "Subscription tier comparison with feature matrices, billing cycle toggles, and CTA triggers.",
    requiredArtifacts: ["pricing_comparison"],
    composedArtifacts: ["pricing_comparison", "faq", "cta"],
    allowedCompositions: ["side_by_side", "stacked_tiers", "tier_carousel"],
    responsivePolicy: {
      wide: "3-column side-by-side tier comparison with highlighted popular tier",
      medium: "2-column grid with popular tier spanning full width",
      narrow: "1-column stacked cards with prominent price callout and feature checklist",
      containerQuery: true,
      minViableWidth: 260
    },
    accessibility: {
      landmark: "region",
      headingLevel: "h2",
      ariaRole: "region"
    },
    platformMappings: {
      web: { tag: "section", baseClasses: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
      ios: { view: "HStack", adaptive: "VStack" },
      android: { composable: "Row", adaptive: "Column" }
    }
  },

  faq: {
    id: "faq",
    title: "Frequently Asked Questions Section",
    role: "faq",
    description: "Accessible collapsible accordion questions addressing technical and operational inquiries.",
    requiredArtifacts: ["faq"],
    composedArtifacts: ["faq"],
    allowedCompositions: ["accordion", "two_column_list"],
    responsivePolicy: {
      wide: "single column centered with max readable measure or 2-column grid",
      medium: "single column centered",
      narrow: "single column accordion with touch-friendly 48px hit targets"
    },
    accessibility: {
      landmark: "region",
      headingLevel: "h2",
      ariaExpanded: true,
      keyboardNav: "enter/space to toggle details"
    },
    platformMappings: {
      web: { tag: "section", baseClasses: "max-w-4xl mx-auto flex flex-col gap-3" },
      ios: { view: "DisclosureGroup", style: "plain" },
      android: { composable: "AnimatedVisibility", style: "cardAccordion" }
    }
  },

  cta: {
    id: "cta",
    title: "Call to Action Section",
    role: "cta",
    description: "High-contrast conversion banner with primary action and secondary reassurance links.",
    requiredArtifacts: ["navigation"],
    composedArtifacts: ["navigation", "proof"],
    allowedCompositions: ["centered_banner", "split_banner", "card_banner"],
    responsivePolicy: {
      wide: "centered banner with horizontal action buttons",
      medium: "centered banner with horizontal action buttons",
      narrow: "full-width banner with vertically stacked action buttons"
    },
    accessibility: {
      landmark: "complementary",
      headingLevel: "h2",
      keyboardNav: "direct focusable buttons"
    },
    platformMappings: {
      web: { tag: "section", baseClasses: "w-full py-16 text-center" },
      ios: { view: "VStack", background: "accent" },
      android: { composable: "Surface", tone: "primaryContainer" }
    }
  },

  detail: {
    id: "detail",
    title: "Record Detail Section",
    role: "detail",
    description: "Full-fidelity view of an individual record, its relations, immutable audit log, and available actions.",
    requiredArtifacts: ["detail"],
    composedArtifacts: ["detail", "history", "editor", "modal"],
    allowedCompositions: ["two_column_panel", "drawer_sheet", "full_page"],
    responsivePolicy: {
      wide: "2-column grid (6 cols info definitions, 6 cols history & actions)",
      medium: "stacked sections (hero, fields, actions, history)",
      narrow: "single column stack with sticky action footer and back button",
      containerQuery: true
    },
    accessibility: {
      landmark: "main",
      headingLevel: "h1",
      keyboardNav: "standard tab flow with back shortcut"
    },
    platformMappings: {
      web: { tag: "article", baseClasses: "flex flex-col gap-6" },
      ios: { view: "ScrollView", subviews: ["Form", "Section"] },
      android: { composable: "Column", modifier: "verticalScroll" }
    }
  },

  data_story: {
    id: "data_story",
    title: "Visual Data Story & Insights Section",
    role: "data_story",
    description: "Analytical insights and metric trends composing line, bar, area, stacked, and scatter visualizations with exact accessible data tables.",
    requiredArtifacts: ["data_visualization"],
    composedArtifacts: ["data_visualization", "metric", "filters"],
    allowedCompositions: ["grid", "stack", "split"],
    responsivePolicy: {
      wide: "2-column visualization grid with full multi-series charts",
      medium: "2-column condensed grid",
      narrow: "1-column stack with compact representations and horizontal bars",
      containerQuery: true,
      minViableWidth: 320
    },
    accessibility: {
      landmark: "region",
      ariaRole: "region",
      headingLevel: "h2",
      liveRegion: "polite"
    },
    platformMappings: {
      web: { tag: "section", baseClasses: "grid grid-cols-1 lg:grid-cols-2 gap-6" },
      ios: { view: "LazyVGrid", columns: "adaptive" },
      android: { composable: "LazyVerticalGrid", columns: "Adaptive" }
    }
  }
});

/**
 * 3. UI ARTIFACTS CATALOG
 */
export const UI_ARTIFACTS = Object.freeze({
  collection: {
    id: "collection",
    title: "Data Collection (Table / List)",
    description: "Universal responsive data presenter that seamlessly shifts between full table, condensed table, and card list.",
    requires: ["records", "fields"],
    provides: ["selection", "pagination", "sort", "row_click"],
    states: [ARTIFACT_STATES.IDLE, ARTIFACT_STATES.LOADING, ARTIFACT_STATES.EMPTY, ARTIFACT_STATES.FILTERED_EMPTY, ARTIFACT_STATES.ERROR],
    responsivePolicy: {
      wide: { mode: "table", columns: "all", actions: "inline" },
      medium: { mode: "condensed_table", columns: "primary_secondary", actions: "inline" },
      narrow: { mode: "card_list", columns: "primary_with_disclosure", actions: "compact_menu" },
      containerBreakpoints: {
        table: 640,
        card_list: 0
      }
    },
    accessibilityPolicy: {
      role: "table",
      mobileRole: "feed",
      keyboard: ["ArrowDown", "ArrowUp", "Enter", "Space"],
      labelFieldRole: "rowheader",
      announceCountOnFilter: true
    },
    platformMappings: {
      web: { component: "ResponsiveTableOrList", tailwind: "w-full border-collapse" },
      ios: { component: "List", modifiers: [".listStyle(.insetGrouped)"] },
      android: { component: "LazyColumn", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  form: {
    id: "form",
    title: "Typed Form Editor",
    description: "Schema-driven input collector supporting email, text, money, enums, dates, relations, and booleans.",
    requires: ["fields", "values", "onSubmit"],
    provides: ["validation_state", "field_changes", "submission"],
    states: [ARTIFACT_STATES.IDLE, ARTIFACT_STATES.LOADING, ARTIFACT_STATES.ERROR],
    responsivePolicy: {
      wide: { flow: "grid", columns: 2, gap: "1rem" },
      medium: { flow: "grid", columns: 2, gap: "1rem" },
      narrow: { flow: "stack", columns: 1, gap: "0.75rem" },
      containerBreakpoints: {
        two_column: 480,
        single_column: 0
      }
    },
    accessibilityPolicy: {
      role: "form",
      inputAria: { required: "aria-required", error: "aria-invalid", description: "aria-describedby" },
      focusFirstErrorOnSubmit: true
    },
    platformMappings: {
      web: { component: "FormGrid", tailwind: "grid grid-cols-1 sm:grid-cols-2 gap-4" },
      ios: { component: "Form", modifiers: [".formStyle(.grouped)"] },
      android: { component: "Column", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  navigation: {
    id: "navigation",
    title: "Adaptive Navigation",
    description: "Universal navigation artifact adapting between desktop horizontal links/sidebar and mobile hamburger drawer/bottom bar.",
    requires: ["navItems", "activeItem", "onNavigate"],
    provides: ["screen_change", "theme_toggle", "auth_actions"],
    states: [ARTIFACT_STATES.IDLE],
    responsivePolicy: {
      wide: { mode: "horizontal_bar_or_sidebar", toggle: false },
      medium: { mode: "horizontal_bar_or_sidebar", toggle: false },
      narrow: { mode: "hamburger_drawer_or_bottom_bar", toggle: true },
      containerBreakpoints: {
        expanded: 768,
        collapsed: 0
      }
    },
    accessibilityPolicy: {
      role: "navigation",
      ariaCurrent: "page",
      drawerAria: { modal: true, expanded: "aria-expanded" }
    },
    platformMappings: {
      web: { component: "PublicNavOrAppSidebar", tailwind: "sticky top-0 z-50 flex items-center" },
      ios: { component: "TabView", modifiers: [".tabViewStyle(.automatic)"] },
      android: { component: "NavigationBar", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  workflow_inbox: {
    id: "workflow_inbox",
    title: "Workflow Review & Approval Inbox",
    description: "Actionable queue of pending transitions with guard checks, actor separation, and required comments.",
    requires: ["pendingRecords", "availableActions", "onTransition"],
    provides: ["transition_execution", "comment_collection"],
    states: [ARTIFACT_STATES.IDLE, ARTIFACT_STATES.LOADING, ARTIFACT_STATES.EMPTY],
    responsivePolicy: {
      wide: { mode: "split_table_and_action_panel" },
      medium: { mode: "stacked_panel" },
      narrow: { mode: "actionable_card_stream_with_sheet" },
      containerBreakpoints: { split: 720, stack: 0 }
    },
    accessibilityPolicy: {
      role: "region",
      announceTransitions: true,
      confirmDestructiveActions: true
    },
    platformMappings: {
      web: { component: "WorkflowInboxPanel", tailwind: "flex flex-col gap-4" },
      ios: { component: "ListWithSwipeActions", modifiers: [".swipeActions()"] },
      android: { component: "SwipeToDismissBox", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  metric: {
    id: "metric",
    title: "KPI Metric Display",
    description: "High-impact numerical callout with label, trend indicator, and source attribution.",
    requires: ["value", "label"],
    provides: ["drill_down_click"],
    states: [ARTIFACT_STATES.IDLE, ARTIFACT_STATES.LOADING],
    responsivePolicy: {
      wide: { typography: "text-4xl lg:text-5xl", padding: "1.5rem" },
      medium: { typography: "text-3xl", padding: "1.25rem" },
      narrow: { typography: "text-2xl", padding: "1rem" },
      containerBreakpoints: { large: 280, compact: 0 }
    },
    accessibilityPolicy: {
      role: "status",
      ariaLabel: "metric description and current value"
    },
    platformMappings: {
      web: { component: "MetricCard", tailwind: "p-6 rounded-2xl bg-slate-900 border border-slate-800" },
      ios: { component: "GroupBox", modifiers: [".groupBoxStyle(.metric)"] },
      android: { component: "Card", modifiers: ["Modifier.padding(16.dp)"] }
    }
  },

  modal: {
    id: "modal",
    title: "Modal Dialog & Sheet",
    description: "Adaptive overlay surface rendering as centered dialog on desktop and bottom sheet on mobile.",
    requires: ["title", "content", "onClose"],
    provides: ["dismiss", "action_trigger"],
    states: [ARTIFACT_STATES.IDLE],
    responsivePolicy: {
      wide: { presentation: "centered_dialog", maxWidth: "36rem", borderRadius: "1rem" },
      medium: { presentation: "centered_dialog", maxWidth: "32rem", borderRadius: "1rem" },
      narrow: { presentation: "bottom_sheet_full", maxWidth: "100%", borderRadius: "1rem 1rem 0 0" },
      containerBreakpoints: { dialog: 600, sheet: 0 }
    },
    accessibilityPolicy: {
      role: "dialog",
      ariaModal: true,
      focusTrap: true,
      closeOnEscape: true
    },
    platformMappings: {
      web: { component: "ModalDialog", tailwind: "fixed inset-0 z-50 flex items-center justify-center" },
      ios: { component: "sheet", modifiers: [".presentationDetents([.medium, .large])"] },
      android: { component: "ModalBottomSheet", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  pricing_comparison: {
    id: "pricing_comparison",
    title: "Pricing Comparison Grid",
    description: "Multi-tier commercial plan matrix with pricing details, feature allowances, and checkout CTA triggers.",
    requires: ["tiers", "onSelectPlan"],
    provides: ["plan_selection"],
    states: [ARTIFACT_STATES.IDLE],
    responsivePolicy: {
      wide: { layout: "grid", columns: 3 },
      medium: { layout: "grid", columns: 2 },
      narrow: { layout: "stack", columns: 1 },
      containerBreakpoints: { three_col: 880, two_col: 560, single_col: 0 }
    },
    accessibilityPolicy: {
      role: "region",
      headingStructure: "h3 per plan with distinct price announcement"
    },
    platformMappings: {
      web: { component: "PricingGrid", tailwind: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
      ios: { component: "ScrollView(.horizontal)", modifiers: [".scrollTargetBehavior(.paging)"] },
      android: { component: "LazyRow", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  filters: {
    id: "filters",
    title: "Multi-Field Filter Bar",
    description: "Search and categorical filter controls with active chip indicators and clear triggers.",
    requires: ["filterFields", "activeFilters", "onFilterChange"],
    provides: ["filter_query_update"],
    states: [ARTIFACT_STATES.IDLE],
    responsivePolicy: {
      wide: { flow: "row", searchWidth: "auto", wrap: false },
      medium: { flow: "row", searchWidth: "100%", wrap: true },
      narrow: { flow: "stack", searchWidth: "100%", wrap: true },
      containerBreakpoints: { row: 640, stack: 0 }
    },
    accessibilityPolicy: {
      role: "search",
      ariaLabels: "Filter by categorical value"
    },
    platformMappings: {
      web: { component: "FilterBar", tailwind: "flex flex-wrap items-center gap-3" },
      ios: { component: "SearchableWithScopes", modifiers: [".searchScopes()"] },
      android: { component: "SearchBarWithChips", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  code_demo: {
    id: "code_demo",
    title: "Interactive Code & Compiler Demo",
    description: "Live interactive compiler stage with syntax highlighting, step switcher, and invariant checks.",
    requires: ["steps", "activeStep", "onStepChange"],
    provides: ["step_selection", "code_copy"],
    states: [ARTIFACT_STATES.IDLE],
    responsivePolicy: {
      wide: { layout: "stepper_with_workbench", codeMeasure: "wide" },
      medium: { layout: "stepper_with_workbench", codeMeasure: "comfortable" },
      narrow: { layout: "stacked_stepper", codeMeasure: "compact_scrollable" },
      containerBreakpoints: { wide_stage: 560, compact_stage: 0 }
    },
    accessibilityPolicy: {
      role: "region",
      tablistRole: "tablist",
      tabpanelRole: "tabpanel"
    },
    platformMappings: {
      web: { component: "HeroTransformationWorkbench", tailwind: "rounded-2xl bg-slate-900 border border-slate-800 p-6" },
      ios: { component: "VStack", style: "codeTerminal" },
      android: { component: "Card", style: "codeTerminal" }
    }
  },

  faq: {
    id: "faq",
    title: "Collapsible FAQ Accordion",
    description: "Semantic accordion question/answer list with animated disclosure markers.",
    requires: ["items"],
    provides: ["toggle_item"],
    states: [ARTIFACT_STATES.IDLE],
    responsivePolicy: {
      wide: { padding: "1.25rem", measure: "max-w-4xl mx-auto" },
      medium: { padding: "1rem", measure: "max-w-3xl mx-auto" },
      narrow: { padding: "0.875rem", measure: "w-full" }
    },
    accessibilityPolicy: {
      role: "region",
      detailsAria: true,
      keyboardToggle: true
    },
    platformMappings: {
      web: { component: "FaqAccordion", tailwind: "flex flex-col gap-3" },
      ios: { component: "ListWithDisclosureGroups", modifiers: [] },
      android: { component: "LazyColumnWithExpandableItems", modifiers: [] }
    }
  },

  empty_state: {
    id: "empty_state",
    title: "Generic Empty State",
    description: "Accessible placeholder displayed when a collection or filter query returns 0 records.",
    requires: ["title", "message", "action"],
    provides: ["create_click", "clear_filter_click"],
    states: [ARTIFACT_STATES.EMPTY, ARTIFACT_STATES.FILTERED_EMPTY],
    responsivePolicy: {
      wide: { padding: "4rem 2rem", iconSize: 48 },
      medium: { padding: "3rem 1.5rem", iconSize: 40 },
      narrow: { padding: "2rem 1rem", iconSize: 32 }
    },
    accessibilityPolicy: {
      role: "status",
      ariaLive: "polite"
    },
    platformMappings: {
      web: { component: "EmptyState", tailwind: "flex flex-col items-center justify-center text-center p-12" },
      ios: { component: "ContentUnavailableView", modifiers: [] },
      android: { component: "EmptyContentPlaceholder", modifiers: ["Modifier.fillMaxSize()"] }
    }
  },

  data_visualization: {
    id: "data_visualization",
    title: "Compiler-Native Data Visualization",
    description: "Visual data chart (line, area, bar, stacked, scatter, sparkline) compiled directly from analytical intent with exact accessible data tables.",
    requires: ["intent", "measure", "dimension"],
    provides: ["exact_table_toggle", "data_point_focus", "trend_inspection"],
    states: [ARTIFACT_STATES.IDLE, ARTIFACT_STATES.LOADING, ARTIFACT_STATES.EMPTY, ARTIFACT_STATES.FILTERED_EMPTY, ARTIFACT_STATES.ERROR],
    responsivePolicy: {
      wide: { mode: "full_chart", legend: "inline", points: "all" },
      medium: { mode: "compact_chart", legend: "inline", points: "all" },
      narrow: { mode: "horizontal_or_sparkline", legend: "subdued", points: "decimated" },
      containerBreakpoints: {
        full: 640,
        compact: 380,
        sparkline: 0
      }
    },
    accessibilityPolicy: {
      role: "region",
      keyboardAccessible: true,
      hasDataTableAlternative: true,
      liveRegion: "polite"
    },
    platformMappings: {
      web: { component: "DataVisualizationPanel", tailwind: "p-6 rounded-2xl bg-slate-900 border border-slate-800" },
      ios: { component: "Charts.Chart", modifiers: [".chartLegend(.visible)"] },
      android: { component: "DataVisualizationCanvas", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  semantic_graph: {
    id: "semantic_graph",
    title: "Semantic Graph & Workflow Artifact",
    description: "Structural relationship diagram for state machines, dependency DAGs, and event timelines.",
    requires: ["mode", "nodes", "edges"],
    provides: ["node_inspection", "state_transition", "linear_list_toggle"],
    states: [ARTIFACT_STATES.IDLE, ARTIFACT_STATES.LOADING, ARTIFACT_STATES.EMPTY],
    responsivePolicy: {
      wide: { mode: "spatial_graph", edgeLabels: true },
      medium: { mode: "compact_graph", edgeLabels: true },
      narrow: { mode: "vertical_stepper_or_linear_flow", edgeLabels: false },
      containerBreakpoints: {
        spatial: 768,
        compact: 480,
        linear: 0
      }
    },
    accessibilityPolicy: {
      role: "region",
      linearAlternative: true,
      announceTransitions: true
    },
    platformMappings: {
      web: { component: "SemanticGraphPanel", tailwind: "p-6 rounded-2xl bg-slate-900 border border-slate-800" },
      ios: { component: "WorkflowGraphView", modifiers: [] },
      android: { component: "WorkflowDiagram", modifiers: ["Modifier.fillMaxWidth()"] }
    }
  },

  drawer: {
    id: "drawer",
    title: "Secondary Interaction Surface (Drawer / Sheet)",
    category: "interaction_surface",
    semanticLevel: "secondary_surface",
    purposes: ["edit", "create", "detail", "filter", "workflow"],
    stackPolicy: DRAWER_STACK_POLICY,
    description: "Generic right-side sliding editor, detail inspector, or filter drawer on desktop; seamlessly transforms into full-screen sheet on mobile viewports.",
    requires: ["purpose", "content", "onClose"],
    provides: ["dismiss", "action_trigger", "form_submit", "detail_transition"],
    states: [ARTIFACT_STATES.IDLE, ARTIFACT_STATES.LOADING, ARTIFACT_STATES.ERROR],
    responsivePolicy: {
      wide: { representation: DRAWER_REPRESENTATION.RIGHT_DRAWER, animation: "slide_right" },
      medium: { representation: DRAWER_REPRESENTATION.RIGHT_DRAWER, animation: "slide_right" },
      narrow: { representation: DRAWER_REPRESENTATION.FULL_SCREEN_SHEET, animation: "slide_up" },
      containerBreakpoints: {
        desktop_drawer: 640,
        mobile_sheet: 0
      }
    },
    accessibilityPolicy: {
      role: "dialog",
      ariaModal: true,
      focusTrap: true,
      closeOnEscape: true,
      restoreFocus: true
    },
    platformMappings: {
      web: { component: "RightDrawerOrSheet", tailwind: "fixed inset-y-0 right-0 z-50 flex flex-col bg-slate-900 border-l border-slate-800" },
      ios: { component: "NavigationStackWithSheet", modifiers: [".sheet(isPresented:)"] },
      android: { component: "ModalNavigationDrawerOrSheet", modifiers: ["Modifier.fillMaxHeight()"] }
    }
  },

  menu: {
    id: "menu",
    title: "Contextual & Navigation Menu",
    category: "contextual_navigation",
    semanticLevel: "overlay",
    description: "Adaptive popover, dropdown, or action sheet supporting top navigation, row actions, user switching, and overflow triggers.",
    requires: ["items", "onSelect"],
    provides: ["item_selection", "dismiss"],
    states: [ARTIFACT_STATES.IDLE],
    responsivePolicy: {
      wide: { representation: MENU_REPRESENTATION.DROPDOWN, collisionCheck: true },
      medium: { representation: MENU_REPRESENTATION.DROPDOWN, collisionCheck: true },
      narrow: { representation: MENU_REPRESENTATION.COMPACT_SHEET, collisionCheck: false },
      containerBreakpoints: {
        dropdown: 640,
        compact_sheet: 0
      }
    },
    accessibilityPolicy: {
      role: "menu",
      itemRole: "menuitem",
      keyboardNavigation: ["ArrowDown", "ArrowUp", "Home", "End", "Escape", "Enter", "Space"],
      restoreFocus: true
    },
    platformMappings: {
      web: { component: "DropdownOrPopoverMenu", tailwind: "absolute z-50 rounded-xl bg-slate-900 border border-slate-800 shadow-xl" },
      ios: { component: "Menu", modifiers: [".menuStyle(.automatic)"] },
      android: { component: "DropdownMenu", modifiers: ["Modifier.wrapContentSize()"] }
    }
  }
});

/**
 * 4. HIGHEST-LEVEL-FIRST CAPABILITY DISCOVERY
 *
 * Implements the search strategy:
 *   1. Search Experience
 *   2. If none, search Section
 *   3. If none, search Artifact
 *   4. Only then compose raw UI Utilities
 */
export function discoverUiCapability(query, context = {}) {
  const normalized = String(query ?? "").toLowerCase().trim();

  // 1. Exact ID check first
  if (UI_EXPERIENCES[normalized]) {
    const exp = UI_EXPERIENCES[normalized];
    return {
      level: "EXPERIENCE",
      match: exp,
      inferredSections: exp.defaultSections,
      tokenEfficiencyScore: 0.95
    };
  }

  if (UI_SECTIONS[normalized]) {
    const sec = UI_SECTIONS[normalized];
    return {
      level: "SECTION",
      match: sec,
      inferredArtifacts: sec.composedArtifacts,
      tokenEfficiencyScore: 0.85
    };
  }

  if (UI_ARTIFACTS[normalized]) {
    const art = UI_ARTIFACTS[normalized];
    return {
      level: "ARTIFACT",
      match: art,
      tokenEfficiencyScore: 0.75
    };
  }

  // 2. Check Experience Level by title/id substring
  for (const exp of Object.values(UI_EXPERIENCES)) {
    if (exp.id.includes(normalized) || exp.title.toLowerCase().includes(normalized)) {
      return {
        level: "EXPERIENCE",
        match: exp,
        inferredSections: exp.defaultSections,
        tokenEfficiencyScore: 0.95
      };
    }
  }

  // 3. Check Section Level by title/id/role substring
  for (const sec of Object.values(UI_SECTIONS)) {
    if (sec.id.includes(normalized) || sec.title.toLowerCase().includes(normalized) || sec.role.includes(normalized)) {
      return {
        level: "SECTION",
        match: sec,
        inferredArtifacts: sec.composedArtifacts,
        tokenEfficiencyScore: 0.85
      };
    }
  }

  // 4. Check Artifact Level by title/id substring
  for (const art of Object.values(UI_ARTIFACTS)) {
    if (art.id.includes(normalized) || art.title.toLowerCase().includes(normalized)) {
      return {
        level: "ARTIFACT",
        match: art,
        tokenEfficiencyScore: 0.75
      };
    }
  }

  // 5. Fallback to UI Utility Composition
  return {
    level: "UI_UTILITY",
    match: null,
    reason: "No high-level construct matched query; composing platform-neutral layout utilities.",
    tokenEfficiencyScore: 0.40
  };
}

/**
 * Resolves responsive layout strategy for a collection Artifact at a given container / viewport width.
 *
 * Wide (>= 640px): Full Table (COLLECTION_REPRESENTATION.TABLE)
 * Medium (480px - 639px): Condensed Table (COLLECTION_REPRESENTATION.CONDENSED_TABLE)
 * Narrow (< 480px): Semantic Record List (COLLECTION_REPRESENTATION.RECORD_LIST)
 */
export function resolveCollectionArtifactLayout(containerWidth = 1024, fields = []) {
  if (containerWidth >= 640) {
    return {
      mode: COLLECTION_REPRESENTATION.TABLE,
      representation: COLLECTION_REPRESENTATION.TABLE,
      visibleColumns: fields.map((f) => f.id),
      actionsLayout: "inline",
      requiresHorizontalScroll: false,
      recomposedToCardList: false
    };
  }

  if (containerWidth >= 480) {
    const primaryAndSecondary = fields.filter((f) => f.priority !== INFORMATION_PRIORITY.METADATA);
    return {
      mode: COLLECTION_REPRESENTATION.CONDENSED_TABLE,
      representation: COLLECTION_REPRESENTATION.CONDENSED_TABLE,
      visibleColumns: primaryAndSecondary.map((f) => f.id),
      actionsLayout: "inline",
      requiresHorizontalScroll: false,
      recomposedToCardList: false
    };
  }

  // Narrow mobile / small container: Recompose to semantic card list
  const primaryField = fields.find((f) => f.priority === INFORMATION_PRIORITY.PRIMARY) ?? fields[0];
  const secondaryFields = fields.filter((f) => f.id !== primaryField?.id);

  return {
    mode: "card_list",
    representation: COLLECTION_REPRESENTATION.RECORD_LIST,
    primaryField: primaryField?.id,
    secondaryFields: secondaryFields.map((f) => f.id),
    actionsLayout: "compact_dropdown",
    requiresHorizontalScroll: false,
    recomposedToCardList: true
  };
}

export function resolveFormArtifactLayout(containerWidth = 1024) {
  return {
    representation: containerWidth < 640 ? FORM_REPRESENTATION.SINGLE_COLUMN : FORM_REPRESENTATION.MULTI_COLUMN,
    columns: containerWidth < 640 ? 1 : 2
  };
}

export function resolveNavigationArtifactLayout(containerWidth = 1024) {
  return {
    representation: containerWidth < 768 ? NAVIGATION_REPRESENTATION.COMPACT : NAVIGATION_REPRESENTATION.FULL
  };
}

export function resolveHeroArtifactLayout(containerWidth = 1024) {
  return {
    representation: containerWidth < 768 ? HERO_REPRESENTATION.STACKED : HERO_REPRESENTATION.SPLIT
  };
}

export function resolveWorkflowArtifactLayout(containerWidth = 1024) {
  return {
    representation: containerWidth < 768 ? WORKFLOW_REPRESENTATION.VERTICAL_STATE_STORY : WORKFLOW_REPRESENTATION.GRAPH_AND_DETAIL
  };
}

export function resolveShellArtifactLayout(containerWidth = 1024, isPublic = false) {
  if (isPublic) {
    return {
      representation: containerWidth < 768 ? SHELL_REPRESENTATION.PUBLIC_COMPACT : SHELL_REPRESENTATION.PUBLIC
    };
  }
  return {
    representation: containerWidth < 720 ? SHELL_REPRESENTATION.COMPACT : SHELL_REPRESENTATION.SIDEBAR
  };
}

export function resolveFeatureStorySectionLayout(containerWidth = 1024) {
  if (containerWidth >= 1024) {
    return {
      representation: FEATURE_STORY_REPRESENTATION.ASYMMETRIC_BENTO,
      dominantSpan: 7,
      supportingSpan: 5,
      columns: 12
    };
  }
  if (containerWidth >= 640) {
    return {
      representation: FEATURE_STORY_REPRESENTATION.BALANCED_GRID,
      dominantSpan: 6,
      supportingSpan: 6,
      columns: 2
    };
  }
  return {
    representation: FEATURE_STORY_REPRESENTATION.NARRATIVE_STACK,
    dominantSpan: 1,
    supportingSpan: 1,
    columns: 1
  };
}

export function resolveSocialProofSectionLayout(containerWidth = 1024) {
  if (containerWidth >= 768) {
    return {
      representation: PROOF_REPRESENTATION.PROOF_BAND,
      statsColumns: 3,
      quotesColumns: 2
    };
  }
  return {
    representation: PROOF_REPRESENTATION.PROOF_STACK,
    statsColumns: 1,
    quotesColumns: 1
  };
}

export function resolvePricingSectionLayout(containerWidth = 1024) {
  if (containerWidth >= 768) {
    return {
      representation: PRICING_REPRESENTATION.COMPARISON_GRID,
      columns: 3
    };
  }
  return {
    representation: PRICING_REPRESENTATION.SEQUENTIAL_PLANS,
    columns: 1
  };
}

export function resolveDashboardSectionLayout(containerWidth = 1024) {
  if (containerWidth >= 1024) {
    return {
      representation: DASHBOARD_REPRESENTATION.DASHBOARD_GRID,
      metricsColumns: 4,
      splitLayout: true
    };
  }
  if (containerWidth >= 640) {
    return {
      representation: DASHBOARD_REPRESENTATION.DASHBOARD_CONDENSED,
      metricsColumns: 2,
      splitLayout: false
    };
  }
  return {
    representation: DASHBOARD_REPRESENTATION.DASHBOARD_STACK,
    metricsColumns: 1,
    splitLayout: false
  };
}

export function resolveProductStorySectionLayout(containerWidth = 1024) {
  if (containerWidth >= 768) {
    return {
      representation: PRODUCT_STORY_REPRESENTATION.SPLIT_STORY,
      columns: 2
    };
  }
  return {
    representation: PRODUCT_STORY_REPRESENTATION.NARRATIVE_STACK,
    columns: 1
  };
}

export function resolveDataStorySectionLayout(containerWidth = 1024) {
  if (containerWidth >= 1024) {
    return {
      representation: "grid_2col",
      columns: 2,
      dense: false
    };
  }
  if (containerWidth >= 640) {
    return {
      representation: "grid_2col_condensed",
      columns: 2,
      dense: true
    };
  }
  return {
    representation: "stack_1col",
    columns: 1,
    dense: true
  };
}

export function resolveDataVisualizationLayout(intent, containerWidth = 1024, meta = {}) {
  const isTimeSeries = meta.isTimeSeries || meta.dimension?.includes("date") || meta.dimension?.includes("month");
  if (containerWidth < 380) {
    return {
      representation: isTimeSeries ? "sparkline_summary" : "compact_bar",
      isCompact: true,
      showLegend: false
    };
  }
  if (containerWidth < 640) {
    return {
      representation: isTimeSeries ? "compact_line" : "horizontal_bar",
      isCompact: true,
      showLegend: true
    };
  }
  return {
    representation: isTimeSeries ? "full_line" : "vertical_bar",
    isCompact: false,
    showLegend: true
  };
}

export function resolveSemanticGraphLayout(mode, containerWidth = 1024) {
  if (containerWidth < 480) {
    return {
      representation: mode === "timeline" ? "vertical_timeline" : "vertical_state_path",
      isLinear: true
    };
  }
  if (containerWidth < 768) {
    return {
      representation: mode === "timeline" ? "vertical_timeline" : "compact_workflow_graph",
      isLinear: false
    };
  }
  return {
    representation: mode === "timeline" ? "horizontal_timeline" : "spatial_workflow_graph",
    isLinear: false
  };
}

export function resolveDrawerArtifactLayout(containerWidth = 1024, size = DRAWER_SIZE.STANDARD) {
  const isMobile = containerWidth < 640;
  const isMedium = containerWidth >= 640 && containerWidth < 1024;
  let representation = DRAWER_REPRESENTATION.RIGHT_DRAWER;
  if (isMobile) {
    representation = DRAWER_REPRESENTATION.FULL_SCREEN_SHEET;
  } else if (isMedium && size === DRAWER_SIZE.WIDE) {
    representation = DRAWER_REPRESENTATION.WIDE_SHEET;
  }

  const maxWidth = isMobile
    ? "100%"
    : (size === DRAWER_SIZE.COMPACT ? "380px" : (size === DRAWER_SIZE.WIDE ? "640px" : "480px"));
  const widthPx = isMobile
    ? containerWidth
    : (size === DRAWER_SIZE.COMPACT ? 380 : (size === DRAWER_SIZE.WIDE ? 640 : 480));

  return {
    representation,
    isMobile,
    size,
    maxWidth,
    widthPx
  };
}

export function resolveMenuArtifactLayout(containerWidth = 1024, context = "dropdown") {
  const isMobile = containerWidth < 640;
  let representation = MENU_REPRESENTATION.DROPDOWN;
  if (isMobile) {
    representation = MENU_REPRESENTATION.COMPACT_SHEET;
  } else if (context === "top_nav" || context === "top_navigation") {
    representation = MENU_REPRESENTATION.TOP_POPOVER;
  } else if (context === "overflow") {
    representation = MENU_REPRESENTATION.OVERFLOW_MENU;
  }

  return {
    representation,
    isMobile,
    context
  };
}

/**
 * Structural Diagnostic for Independent Contained Section Surface Collisions.
 *
 * If two independent sibling sections have top/bottom bounding boxes closer than the
 * minimum readable separation (< 12px), it flags SECTION_SURFACE_COLLISION unless explicitly
 * declared grouped/continuous/attached.
 */
export function computeSectionSurfaceCollisionDiagnostic(sections = [], rhythm = SECTION_RHYTHM.COMFORTABLE) {
  const collisions = [];
  const expectedMinGap = SECTION_RHYTHM_VALUES[rhythm]?.px ?? 28;

  for (let i = 0; i < sections.length - 1; i++) {
    const curr = sections[i];
    const next = sections[i + 1];

    const isGrouped = curr.relationship === SECTION_RELATIONSHIP.GROUPED ||
                      curr.relationship === SECTION_RELATIONSHIP.CONTINUOUS ||
                      curr.relationship === SECTION_RELATIONSHIP.ATTACHED ||
                      next.relationship === SECTION_RELATIONSHIP.GROUPED ||
                      next.relationship === SECTION_RELATIONSHIP.CONTINUOUS ||
                      next.relationship === SECTION_RELATIONSHIP.ATTACHED;

    const currBottom = curr.bottom ?? (curr.top + (curr.height ?? 100));
    const nextTop = next.top ?? 0;
    const measuredGap = nextTop - currBottom;

    if (!isGrouped && measuredGap < 12) {
      collisions.push({
        pair: [curr.id ?? `section-${i}`, next.id ?? `section-${i+1}`],
        measuredGap,
        expectedMinGap,
        status: "SECTION_SURFACE_COLLISION",
        reason: "Independent contained sibling sections are touching or below minimum readable separation."
      });
    }
  }

  return {
    hasCollisions: collisions.length > 0,
    collisionCount: collisions.length,
    collisions,
    rhythm,
    status: collisions.length === 0 ? "PASS_CLEAN_SECTION_RHYTHM" : "FAIL_SECTION_SURFACE_COLLISION"
  };
}

/**
 * Computes Token Compression Metrics across application types
 */
export function computeHierarchyTokenMetrics(appSource, experienceTree) {
  const airTokens = appSource ? appSource.split(/\s+/).filter(Boolean).length : 30;
  
  // Traditional handwritten HTML + Tailwind tokens required for responsive UI, states, & access
  const equivalentHandwrittenTokens = 650;
  const tokenSavingsPercent = Math.round(((equivalentHandwrittenTokens - airTokens) / equivalentHandwrittenTokens) * 100);

  return {
    airSourceTokens: airTokens,
    equivalentHandwrittenTokens,
    tokenSavingsPercent,
    compressionRatio: parseFloat((equivalentHandwrittenTokens / airTokens).toFixed(2))
  };
}
