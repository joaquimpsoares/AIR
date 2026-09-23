# AIR — AI-Native Application Scaffolding

> **Designed for AI. Readable and writable by humans.**
>
> A semantic compiler and runtime for the application scaffolding developers and AI coding agents repeatedly rebuild.

[![Tests](https://img.shields.io/badge/tests-383%20passing-brightgreen)](https://github.com/joaquimpsoares/AIR)
[![Compression](https://img.shields.io/badge/token%20compression-49.2x-blue)](https://github.com/joaquimpsoares/AIR)
[![Version](https://img.shields.io/badge/spec-v1.0%20frozen-purple)](https://github.com/joaquimpsoares/AIR)
[![License](https://img.shields.io/badge/license-MIT-gray)](https://github.com/joaquimpsoares/AIR/blob/main/LICENSE)

---

### The 30-Second Example

```air
air version=2
app customer_manager title="Customer Manager" subtitle="Instant CRM with search, validation, and status lifecycle" initial=overview
theme mode=dark accent=violet
capability storage.local

resource customers label=name
field customers.name text required min=2
field customers.email email required unique
field customers.company text
field customers.status enum values=Active,Trial,Inactive required default=Trial
field customers.joined date required default=today
field customers.notes text long

manage customers lifecycle=archive
access customers view=role:admin|role:user edit=role:admin|role:user

overview
insight customers.total op=count field=name label="Total Customers"
```

### Live Running Result & Showcase

Open the interactive playground and live running application:

👉 **[Live Developer Showcase & Measured Benchmarks](http://127.0.0.1:4173/examples)**

- **Source ⇄ Live App**: Side-by-side interactive execution.
- **Live Editable**: Modify declarations and watch the interface update instantly without page reloads.
- **Responsive Preview**: Switch between Desktop (100%), Tablet (768px), and Mobile (390px) to see automatic table-to-card and drawer-to-sheet transformations.
- **Zero Runtime LLM**: The application runs 100% client-side with deterministic state transitions.

---

## Core Principle: Built for AI. Usable by Humans.

AIR is **AI-First, but NOT AI-Only**.

```
  🤖 AI Coding Agent Track                       👨‍💻 Human Developer Track
  ─────────────────────────                     ───────────────────────────
  • Emits ~120 tokens vs 6,000+                 • Reads entire intent in 30s
  • Zero UI glue hallucination                  • Standard Git PRs & diffs
  • Precise AST error feedback                  • Hand-writeable syntax
  • Single-line modifications                   • Full deterministic runtime
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Plain Text .air File    │
                        │  (Single Ground Truth)    │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   AIR Compiler & Runtime  │
                        │   (Zero LLM at Runtime)   │
                        └───────────────────────────┘
```

| Layer | What You / AI Declare (AIR) | What AIR Compiler & Runtime Own Automatically |
| :--- | :--- | :--- |
| **Data & Schema** | Pure business entities, fields, enums, unique constraints | Storage normalization, migrations, validation, identity indexing |
| **Workflows** | States, transitions, authority roles, guards | State machines, transition enforcement, separation of duty, audit logs |
| **Temporal & Money** | Intervals, rates (`rate<USD, h>`), computed expressions | Exact BigInt arithmetic, zero-drift minor units, conflict detection |
| **User Interface** | Overview, insights, resource management | Sortable tables, responsive cards, drawers, form validation, context menus |
| **Notifications** | Edge conditions (`when="..."`) or events (`on=...`) | Edge trigger transitions, deduplication, unread counts, bell popover |
| **Accessibility** | Semantic field types & action labels | Keyboard navigation, focus trapping, ARIA roles, high-contrast states |

---

## Quickstart

### 1. Clone & Run Development Server

```bash
git clone https://github.com/joaquimpsoares/AIR.git
cd AIR
npm install
npm run dev
```

Open **`http://localhost:4173/`** or **`http://localhost:4173/examples`** in your browser.

### 2. Verify Your First Application

```bash
# Validate AST syntax and semantic rules
node tools/air-cli.mjs check showcase/customer-manager/app.air

# Inspect semantic entity structures and fields
node tools/air-cli.mjs explain showcase/customer-manager/app.air

# Inspect workflow state machine diagrams and guards
node tools/air-cli.mjs workflow showcase/approval-workflow/app.air
```

### 3. Run Automated Tests & Benchmark Audits

```bash
# Run all 383 unit, integration, and regression tests
npm test

# Run and verify measured cl100k benchmarks against reference implementations
npm run benchmark:check
```

---

## CLI Reference & Tooling

AIR provides a zero-dependency, verified command-line interface via `tools/air-cli.mjs` and npm scripts:

| Command | Purpose |
| :--- | :--- |
| `node tools/air-cli.mjs check <file.air>` | Validates syntax, type signatures, enums, and invariant declarations. |
| `node tools/air-cli.mjs explain <file.air>` | Pretty-prints the semantic schema, entity graphs, and active capabilities. |
| `node tools/air-cli.mjs workflow <file.air>` | Generates ASCII/Mermaid state machine diagrams with transition guards. |
| `node tools/air-cli.mjs diff <old.air> <new.air>` | Semantic structural diff highlighting entity and invariant changes. |
| `node tools/air-cli.mjs status` | Inspects system environment, compiler status, and frozen version tags. |
| `node tools/serve.mjs` (or `npm run dev`) | Starts the zero-dependency static dev server on port 4173. |
| `node tools/benchmark.mjs --check` | Validates benchmark integrity and checks for metric drift. |

---

## Canonical Showcase Applications

All applications live under `showcase/` with reproducible benchmark manifests:

| Example | Domain | Key Capabilities | Token Ratio | Status |
| :--- | :--- | :--- | :--- | :--- |
| **[Customer Manager](docs/getting-started/first-application.md)** | Resource Management | Unique email constraints, enum lifecycle, search, filter, responsive record cards, edit drawers | **49.2x** (123 vs 6,047 tok) | **Verified & Measured** |
| **[Approval Workflow](docs/guides/workflows.md)** | Governance & Workflows | Guarded state transitions, role authority, separation of duty (no self-approval), append-only audit trail | **13.0x** (300 vs 3,907 tok) | **Verified & Measured** |
| **[Reservation Hub](docs/guides/temporal-and-intervals.md)** | Operations & Scheduling | Temporal intervals, zero-overlap conflict prevention, exact money rates (`duration * hourly_rate`), agenda view | 559 cl100k tok | **Verified** |
| **[Inventory Hub](docs/guides/notifications.md)** | Supply Chain & Analytics | Exact integer stock balances, computed order totals, low-stock condition notifications, unread bell | 711 cl100k tok | **Verified (Flagship)** |

---

## Measured Benchmarks & Footprint

Every metric is derived automatically by `tools/benchmark.mjs` against checked-in source files using OpenAI's `cl100k_base` BPE tokenizer.

### 1. Application Source Footprint

| Metric | Customer Manager (AIR) | Customer Manager (Conventional Reference) | Reduction / Ratio |
| :--- | :--- | :--- | :--- |
| **App Source LLM Tokens** | **123 tokens** | **6,047 tokens** | **49.2x compression** |
| **Canonical Language Tokens** | **56 tokens** | — | Language syntax |
| **Application Files** | **1 file** (`app.air`) | **10 files** (React 19 + TS + Tailwind) | **10:1 file reduction** |
| **Lines of Code (LOC)** | **15 LOC** | **732 LOC** | **48.8x less code** |
| **Handwritten JS/TS** | **0 lines** | 5,800+ tokens | 100% compiler-owned |
| **Handwritten CSS** | **0 lines** | 150+ tokens | 100% runtime-owned |

### 2. Modification & Maintenance Cost

| Task | AIR Context | AIR Patch | Conventional Context | Conventional Patch | Patch Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MOD1: Add Suspended status** | 11 tokens | 12 tokens | 38 tokens | 58 tokens | **4.8x compression** |
| **MOD2: Add account_manager field** | 20 tokens | 21 tokens | 21 tokens | 39 tokens | **1.9x compression** |
| **MOD3: Make email optional** | 6 tokens | 5 tokens | 29 tokens | 19 tokens | **3.8x compression** |
| **MOD1 (Approval): Add Rejected state** | 28 tokens | 43 tokens | 26 tokens | 47 tokens | **1.1x compression** |

---

## Documentation Directory Index

Comprehensive documentation is organized under [`docs/`](docs/README.md):

- **[Getting Started](docs/README.md#getting-started)**:
  - [Introduction & Thesis](docs/getting-started/introduction.md)
  - [Installation & Setup](docs/getting-started/installation.md)
  - [First Application (30-Second Tutorial)](docs/getting-started/first-application.md)
  - [Project & Directory Structure](docs/getting-started/project-structure.md)
  - [Run, Edit & Test Guide](docs/getting-started/run-and-edit.md)
- **[Developer Guides](docs/README.md#developer-guides)**:
  - [Writing AIR by Hand](docs/guides/writing-air-by-hand.md)
  - [Working with AI Coding Agents](docs/guides/ai-coding-agents.md)
  - [Resources & Field Types](docs/guides/resources-and-fields.md)
  - [Forms & Management](docs/guides/forms-and-management.md)
  - [Workflows & State Machines](docs/guides/workflows.md)
  - [Permissions & Authority](docs/guides/permissions.md)
  - [Computed Values & Exact Math](docs/guides/computed-values.md)
  - [Relational Collections](docs/guides/relational-collections.md)
  - [Temporal & Intervals](docs/guides/temporal-and-intervals.md)
  - [Schedules & Calendars](docs/guides/schedules.md)
  - [Notifications & Center](docs/guides/notifications.md)
  - [Analytics & Visualizations](docs/guides/analytics-and-visualizations.md)
  - [Development Workflow](docs/guides/development-workflow.md)
  - [Current Architectural Boundaries](docs/guides/current-boundaries.md)
- **[Reference](docs/README.md#reference)**:
  - [CLI Reference](docs/reference/cli.md)
  - [AIR Language Grammar](docs/reference/air-language.md)
  - [Repository Structure](docs/reference/repository-structure.md)
- **[Benchmarks](docs/README.md#benchmarks)**:
  - [Benchmark Methodology & Reproducibility](docs/benchmarks/methodology.md)

---

## Current Architecture & Scope Boundaries

### Architecture
- **Semantic Compiler (`web/runtime/air.mjs` / `airc`)**: Lexes and parses declarations into Semantic IR, Presentation IR, and Artifacts IR.
- **Runtime Engine (`web/runtime/air.mjs`)**: Manages transactions, storage normalization, state machines, and edge notifications.
- **UI Engine (`web/runtime/ui.mjs` & `web/runtime/styles.css`)**: Inactive without hardcoded domain logic; renders 4-level UI hierarchy (Experience $\to$ Section $\to$ Artifact $\to$ Utility).

### Current Explicit Boundaries
- **Multi-record cross-resource transaction bundles**: Currently transactional per-resource boundary; multi-table atomic bundle syntax is planned for a future iteration.
- **Physical unit dimensional analysis**: Units like kg/m/liters use standard numeric semantics; dimensional conversion algebra is not yet embedded.
- **External notification delivery**: In-app Notification Center (bell, badges, popover, sheet) is 100% native; email/SMS/webhook transports use external hooks.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
