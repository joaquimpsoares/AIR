# AIR — Application Intent Representation

AIR is a declarative, compact semantic application language and compiler. It eliminates boilerplate by expressing pure business intent—data entities, relationships, workflow state machines, access policies, and standard presentation experiences—while delegating presentation, validation, state transitions, and persistence to an authoritative compiler and runtime.

```
AIR Source (.air)
      ↓
Semantic Compiler (Rust / JS)
      ↓
Presentation Compiler (Presentation IR v1)
      ↓
Web Renderer / Wasm Runtime / Native Shell
```

---

## Quick Start: Write & Run in 60 Seconds

### 1. Requirements
- Node.js 22+ (for web development runtime & test runner)
- Rust 1.80+ (optional, for native `airc` compiler and Wasm compilation)

### 2. Run the Development Server
```bash
git clone https://github.com/joaquimpsoares/AIR.git
cd AIR
npm run dev
```
Open **`http://127.0.0.1:4173`** in your browser.

---

## Writing Your First AIR Application

Create a `.air` file (e.g. `myapp.air`):

```air
air version=2
app task_manager title="Task Manager" subtitle="Team task management" initial=overview
theme mode=system accent=blue density=comfortable
capability storage.local

# 1. Define Resources & Fields
resource tasks singular=Task plural=Tasks icon=check label=title
field tasks.title text required
field tasks.description text long
field tasks.priority enum values=Low,Medium,High default=Medium
field tasks.status enum values=Todo,InProgress,Done default=Todo
field tasks.due_date date

# 2. Managed UI & Access Controls
manage tasks
access tasks view=true create=true edit=true delete=true

# 3. Standard Experiences & Dashboards
overview title="Workspace Overview"
insight tasks.total op=count label="Total Tasks" tone=blue
insight tasks.open op=count where="status!=Done" label="Pending Tasks" tone=amber
```

To run your application:
```bash
# Verify syntax and semantic static checks
npm run air -- check myapp.air

# Inspect semantic explanation and structure
npm run air -- explain myapp.air
```

---

## CLI & Compiler Tools

### JavaScript Tooling
```bash
# Semantic validation and type checking
npm run air -- check <file.air>

# Generate human-readable semantic explanation
npm run air -- explain <file.air>

# Generate Mermaid workflow diagram for process state machines
npm run air -- workflow <file.air>

# Query capabilities catalog
npm run air -- capabilities search "approval workflow"

# Compute semantic diff between two AIR models
npm run air -- diff old.air new.air
```

### Rust Compiler (`airc`) & Wasm
```bash
# Static semantic check
cargo run -p air-cli -- check apps/expense-approval.air

# Compile to canonical binary IR (.airb)
cargo run -p air-cli -- compile apps/expense-approval.air -o dist/expense-approval.airb

# Inspect compiled binary IR
cargo run -p air-cli -- inspect dist/expense-approval.airb

# Compile to standalone WebAssembly runtime module
cargo run -p air-cli -- build-wasm apps/expense-approval.air -o dist/expense-approval.wasm
```

---

## Reference Applications (`apps/`)

Reference applications illustrating diverse semantic patterns are located in the [`apps/`](/apps) directory:

| Application | File | Focus & Primitives Demonstrated |
| :--- | :--- | :--- |
| **Experience Hub** | [`apps/experience-demo.air`](/apps/experience-demo.air) | Composite `auth.standard` lifecycle (registration, verification, password recovery, session revocation) and `user.management` admin experience. |
| **Northstar CRM** | [`apps/customer-manager.air`](/apps/customer-manager.air) | Resource management, scoped role authorization, reference relationships, lifecycle archival, aggregates. |
| **Expense Approval** | [`apps/expense-approval.air`](/apps/expense-approval.air) | Multi-stage workflow, separation of duty, multi-signature evidence, deadline escalation, immutable decisions. |
| **Lattice Tasks** | [`apps/task-board.air`](/apps/task-board.air) | Relational multi-resource task board with assigned owners and status tags. |
| **Content Publishing** | [`apps/content-publishing.air`](/apps/content-publishing.air) | Multi-role editorial publishing workflow with rejection commentary and review gates. |

---

## Experience Library

AIR provides high-level composite **Experiences** that project platform-neutral UI contracts into the Presentation IR:

- **`resource.management`**: Derives list, detail, filtering, search, sorting, modal creation, and CRUD actions.
- **`workflow.inbox`**: Derives an actor-adaptive inbox of actionable items awaiting user transition approval.
- **`auth.standard`**: Reusable composite authentication, identity verification, password recovery, and session management.
- **`user.management`**: Administrator account management and role administration.

---

## Testing & Verification

Run the full dual-runtime verification suite:

```bash
# Run JavaScript unit and integration test suite
npm test

# Run Rust compiler & conformance test suite
npm run test:rust

# Run cross-engine dual conformance verification
npm run test:dual

# Execute all static, semantic, and runtime checks
npm run check
```

---

## Architecture & Design Principles

1. **Pure Intent Separation**: Application code (`.air`) declares *what* the application does, never HTML/CSS styling or DOM manipulation.
2. **Deterministic & Self-Contained**: No external network dependencies, no implicit side effects, and fully reproducible runtime evaluation.
3. **Decoupled Presentation IR**: The presentation compiler derives a platform-neutral intermediate representation (IR v1) consumed by Web, Wasm, or native renderers.
4. **Authority Below the UI**: Security, invariants, and authorization policies are strictly enforced in the engine core, never in client presentation code.
