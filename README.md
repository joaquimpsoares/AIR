# AIR — Application Intent Representation

AIR is a declarative, compact semantic application language, compiler, and resilient runtime. It eliminates boilerplate by expressing pure business intent—data entities, relationships, workflow state machines, access policies, universal data/connectors, and standard presentation experiences—while delegating presentation, validation, authorization, secrets, health, and deterministic bounded resilience to an authoritative host.

```
AIR Source (.air)
      ↓
Semantic Compiler (Rust / JS)
      ↓
Presentation Compiler (Presentation IR v1) + Capability / Security Engine
      ↓
Universal Data Layer (SQLite / Postgres) + Connectors (REST / MCP)
      ↓
Structured Observability + Bounded Deterministic Resilience (Circuit Breaker / Retries)
```

---

## Quick Start: Write & Run in 60 Seconds

### 1. Requirements
- Node.js 22+ (for web development runtime & test runner)
- Rust 1.80+ (optional, for native `airc` compiler and Wasm compilation)
- Docker (optional, for live PostgreSQL integration tests)

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

## CLI & Operator Tooling

### Semantic & Capability Inspection
```bash
# Static semantic check & validation
npm run air -- check <file.air>

# Generate human-readable semantic explanation
npm run air -- explain <file.air>

# Generate Mermaid workflow diagram for process state machines
npm run air -- workflow <file.air>

# Inspect requested infrastructure capabilities & classifications
npm run air -- inspect capabilities <file.air>

# Inspect application security posture & secret references
npm run air -- inspect security <file.air>

# Compare capability diffs between versions (detect privilege escalation)
npm run air -- inspect capability-diff old.air new.air
```

### Operational Observability & Health
```bash
# Snapshot runtime health, component topology, and open incidents
npm run air -- status

# Inspect individual component health states & dependency propagation
npm run air -- health

# Query open and resolved operational incidents
npm run air -- incidents

# Inspect detailed incident timeline and recovery status
npm run air -- incident <incident_id>

# Run development failure simulation (test mode only)
npm run air -- test-failure rest-timeout
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

## Architectural Layers & Documentation

AIR is structured into distinct, decoupled architectural layers:

1. **Authoritative Specification & Semantic Core:** [AIR-V2.md](spec/AIR-V2.md) & [ARCHITECTURE.md](ARCHITECTURE.md)
2. **Security & Capabilities (Deny-by-Default):** [SECURITY.md](SECURITY.md)
   - Opaque `SecretHandle` preventing credential leakage into AIR source or logs.
   - Two-Key Authorization (Semantic Authority + Infrastructure Capabilities).
   - Network Destination Policies with SSRF & redirect re-authorization.
   - Dynamic MCP Tool discovery decoupled from execution grants.
3. **Structured Observability & Bounded Resilience:** [OPERATIONS.md](OPERATIONS.md)
   - Component Health Registry & Dependency Graph propagation (DB down degrades app, runtime stays healthy).
   - Deterministic Event & Incident Correlation (50 errors -> 1 incident).
   - Bounded Exponential Backoff Retries & Clock-Driven Circuit Breakers.
   - Two-Key Recovery Authorization & Mandatory Post-Recovery Health Verification.
   - Read-Only AI Diagnostic Context (`incident.toDiagnosticContext()`).
4. **Universal Data Layer & Connectors:**
   - In-Memory, SQLite, and live PostgreSQL DataAdapters with SQL injection protection.
   - REST and Model Context Protocol (MCP) Connector integrations.
5. **Presentation IR & Experience Library:**
   - Platform-neutral intermediate representation for web, mobile, and native shells.
   - High-level composite experiences: `resource.management`, `workflow.inbox`, `auth.standard`, `user.management`.

---

## Reference Applications (`apps/`)

| Application | File | Focus & Primitives Demonstrated |
| :--- | :--- | :--- |
| **Experience Hub** | [`apps/experience-demo.air`](/apps/experience-demo.air) | Composite `auth.standard` lifecycle (registration, verification, password recovery, session revocation) and `user.management` admin experience. |
| **Northstar CRM** | [`apps/customer-manager.air`](/apps/customer-manager.air) | Resource management, scoped role authorization, reference relationships, lifecycle archival, aggregates, SQLite & PostgreSQL persistence. |
| **Expense Approval** | [`apps/expense-approval.air`](/apps/expense-approval.air) | Multi-stage workflow, separation of duty, multi-signature evidence, deadline escalation, immutable decisions. |
| **Lattice Tasks** | [`apps/task-board.air`](/apps/task-board.air) | Relational multi-resource task board with assigned owners and status tags. |
| **Content Publishing** | [`apps/content-publishing.air`](/apps/content-publishing.air) | Multi-role editorial publishing workflow with rejection commentary and review gates. |

---

## Testing & Verification

AIR maintains a strict test suite verifying semantic parity, security boundaries, and operational resilience:

```bash
# Run complete Node.js test suite (104 tests)
npm test

# Run Rust compiler & conformance test suite (31 tests)
npm run test:rust

# Run cross-engine dual conformance verification
npm run test:dual

# Execute all static, semantic, and runtime checks
npm run check
```
