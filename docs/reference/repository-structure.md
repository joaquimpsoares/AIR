# AIR Repository Structure

For contributors and developers inspecting the internal codebase.

---

## 📂 Source Code Map

```
AIR/
├── package.json               # Scripts, dependencies, and project metadata
├── Cargo.toml                 # Rust workspace configuration
├── README.md                  # Public overview and quickstart
│
├── web/
│   ├── showcase.html          # Public Showcase, Playground & Documentation Shell
│   ├── showcase.mjs           # Showcase controller, split-pane resizer, code runner
│   ├── showcase.css           # Showcase modern slate styles
│   └── runtime/
│       ├── air.mjs            # Core parser, semantic validator, and AppRuntime
│       ├── presentation.mjs   # Presentation Compiler (Semantic IR -> Presentation IR)
│       ├── ui.mjs             # Web Renderer (Presentation IR -> DOM)
│       ├── ui_hierarchy.mjs   # 4-Level UI hierarchy layout engine & catalog
│       ├── visual_design.mjs  # Visual Design IR compiler & theme generator
│       ├── visualization_ir.mjs # Analytics, charts & graph compilation
│       └── styles.css         # Compiler-owned UI stylesheet
│
├── showcase/                  # 4 Canonical Showcase Applications
│   ├── customer-manager/      # Customer Manager (CRUD, search, edit drawer)
│   ├── approval-workflow/     # Approval Workflow (Guarded transitions, audit history)
│   ├── reservation-hub/       # Reservation Hub (Intervals, scheduling, rate algebra)
│   └── inventory-hub/         # Inventory Hub (Exact integer stock, notifications)
│
├── benchmarks/                # Ground-Truth Measured Benchmarks
│   ├── results.json           # Checked-in measured results manifest
│   ├── customer-manager/      # Conventional reference (React + TS + Tailwind)
│   └── approval-workflow/     # Conventional reference (React + TS + Workflow engine)
│
├── tools/                     # Development & Verification Tooling
│   ├── air-cli.mjs            # Command-line interface
│   ├── serve.mjs              # Local development HTTP server (Port 4173)
│   ├── benchmark.mjs          # cl100k_base token measurement runner
│   └── tokenizer.mjs          # Subword tokenizer
│
├── tests/                     # 345+ Comprehensive Automated Test Cases
│   ├── showcase_and_benchmarks.test.mjs
│   ├── showcase_embedded_runtime.test.mjs
│   ├── exact_quantity_money_algebra.test.mjs
│   ├── temporal_intervals.test.mjs
│   └── ...
│
└── docs/                      # Developer Documentation Information Architecture
```
