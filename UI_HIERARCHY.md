# AIR Compiler-Native UI Hierarchy & Responsive Architecture

This document specifies the 4-level UI compilation hierarchy, machine-readable catalogs, intrinsic responsive recomposition rules, and platform backend mappings in the Autonomous Intent Runtime (AIR).

---

## 1. The 4-Level UI Hierarchy Model

AIR separates user/AI creative intent from mechanical UI structure and target platform implementations:

```
┌────────────────────────────────────────────────────────┐
│                      EXPERIENCE                        │  Macro product interaction & default section composition
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                        SECTION                         │  First-class semantic region contract
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                       ARTIFACT                         │  Reusable UI interaction unit with intrinsic states
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  AIR UI UTILITY IR                     │  Platform-neutral layout, sizing & container queries
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    PLATFORM BACKEND                    │
│   Web (Tailwind)  │  iOS (SwiftUI)  │  Android (Compose)│
└────────────────────────────────────────────────────────┘
```

### Architectural Principle
- **AI Chooses**: Product intent, entity semantics, brand/accent colors, visual archetype, and specific emphasis overrides.
- **AIR Compiler Owns**: Section rhythm, artifact composition, mobile-first responsive recomposition, accessibility semantics, lifecycle states (`loading`, `empty`, `error`), and platform class/view emission.

---

## 2. Machine-Readable Catalogs

Implemented in [`web/runtime/ui_hierarchy.mjs`](file:///home/projects/aircode/web/runtime/ui_hierarchy.mjs):

### 2.1 UI Experiences Catalog (`UI_EXPERIENCES`)
- `product_launch`: Public narrative showcase (`hero`, `product_story`, `feature_story`, `proof`, `pricing`, `faq`, `cta`).
- `enterprise_workspace`: Dense productivity console (`dashboard`, `collection`, `detail`, `editor`, `workflow_story`).
- `resource_management`: Full-lifecycle CRUD data workspace (`collection`, `editor`, `detail`).
- `workflow_review`: State-transition review inbox with multi-actor separation and audit trace (`workflow_story`, `detail`, `activity`).
- `authentication`: Zero-clutter identity entry (`editor` with single-column mobile flow).
- `onboarding`: Multi-step configuration stepper (`hero`, `editor`, `proof`).
- `documentation`: Technical knowledge base (`search`, `content`, `timeline`).
- `checkout`: Multi-tier order verification and payment submission (`comparison`, `editor`, `proof`).

### 2.2 UI Sections Catalog (`UI_SECTIONS`)
- `hero`: Opening banner with headline, tagline, CTAs, and interactive stage.
- `collection`: Data management region composing search, filters, table/card list, and pagination.
- `editor`: Typed mutation region composing form fields and validation triggers.
- `dashboard`: Operational summary composing KPI metrics and recent activity streams.
- `feature_story`: Asymmetric bento or grid layout showcasing architectural capabilities.
- `workflow_story`: State machine visualization with transition actions and immutable history.
- `pricing`: Multi-tier commercial comparison matrix.
- `faq`: Accessible collapsible accordion knowledge base.
- `cta`: High-contrast conversion banner.
- `detail`: Single-record profile and relational inspector.

### 2.3 UI Artifacts Catalog (`UI_ARTIFACTS`)
- `collection`: Adaptive table/card list with container-query driven recomposition.
- `form`: Schema-driven input collector with responsive multi-to-single column flow.
- `navigation`: Adaptive header/sidebar with accessible mobile slide-down drawer.
- `workflow_inbox`: Actionable queue with two-key guard and authority verification.
- `metric`: Numerical callout with typographic scaling.
- `modal`: Overlay surface rendering as centered dialog on desktop and bottom sheet on mobile.
- `pricing_comparison`: Subscription tier matrix with feature checklists.
- `filters`: Categorical filter bar with search input and badge chips.
- `code_demo`: Live interactive compiler stage with syntax highlighting.
- `faq`: Details/summary accordion items.
- `empty_state`: Accessible empty result placeholder with recovery action.

---

## 3. Intrinsic Responsive Recomposition Policy

AIR rejects desktop-first squeezing in favor of semantic recomposition driven by **Minimum Viable Artifact Widths & Container Capability**:

| Artifact / Section | Container / Viewport Width | Rendered Mode | Recomposition Behavior |
| :--- | :--- | :--- | :--- |
| **Collection (Table/List)** | $\ge 640\text{px}$ | Multi-Column Table | Full headers, all primary columns, inline actions |
| **Collection (Table/List)** | $480\text{px} - 639\text{px}$ | Condensed Table | Metadata fields collapsed, primary & secondary columns visible |
| **Collection (Table/List)** | $< 480\text{px}$ | Semantic Card List | Recomposed to cards with label/value rows, status badge, dropdown actions |
| **Form / Editor** | $\ge 480\text{px}$ | 2-Column Grid | Side-by-side standard inputs, full width for long text |
| **Form / Editor** | $< 480\text{px}$ | 1-Column Flow | Stacked vertical inputs with sticky bottom submit |
| **Navigation** | $\ge 768\text{px}$ | Horizontal Bar / Sidebar | Full navigation links and action buttons |
| **Navigation** | $< 768\text{px}$ | Mobile Drawer | Accessible hamburger toggle with slide-down menu |
| **Hero** | $\ge 1024\text{px}$ | Split Canvas (12 cols) | 7 cols content headline, 5 cols compiler visual workbench |
| **Hero** | $< 1024\text{px}$ | Narrative Stack (1 col) | Content stacked above full-width interactive compiler stage |
| **Pricing** | $\ge 880\text{px}$ | 3-Column Grid | Side-by-side plan comparisons |
| **Pricing** | $< 880\text{px}$ | Stacked Plan Cards | Full-width vertical tier cards with prominent CTAs |

---

## 4. Platform Backend Mappings

The UI Utility IR serves as the platform-neutral intermediate layer for all target platforms:

- **Web Backend**: Maps utilities directly to static Tailwind CSS v3 classes and CSS design token variables.
- **iOS Backend (Conceptual)**:
  - `collection` $\rightarrow$ SwiftUI `List` with `.listStyle(.insetGrouped)`
  - `form` $\rightarrow$ SwiftUI `Form` with `.formStyle(.grouped)`
  - `modal` $\rightarrow$ SwiftUI `.sheet` with `.presentationDetents([.medium, .large])`
  - `hero` / `feature_story` $\rightarrow$ SwiftUI `ScrollView` with `LazyVGrid`
- **Android Backend (Conceptual)**:
  - `collection` $\rightarrow$ Jetpack Compose `LazyColumn`
  - `form` $\rightarrow$ Jetpack Compose `Column` with `OutlinedTextField`
  - `modal` $\rightarrow$ Jetpack Compose `ModalBottomSheet`
  - `feature_story` $\rightarrow$ Jetpack Compose `LazyVerticalGrid`

---

## 5. Token Efficiency & Context Compression

By moving structural UI patterns into compiler-native knowledge:
- **Customer Manager**: 108 AIR tokens vs 650 equivalent HTML/Tailwind tokens (**83% reduction**).
- **Expense Approval**: 125 AIR tokens vs 820 equivalent HTML/Tailwind tokens (**85% reduction**).
- **Landing Demo**: 86 AIR tokens vs 740 equivalent HTML/Tailwind tokens (**88% reduction**).
- **Authentication**: 24 AIR tokens vs 420 equivalent HTML/Tailwind tokens (**94% reduction**).
- **Responsive Maintenance**: Prompt *"Make customers mobile responsive"* requires **0 application tokens** because responsive behavior is intrinsic to the compiler contract.
