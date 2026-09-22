# AIR — Autonomous Intent Representation

AIR is a declarative, compact semantic application language, compiler, and resilient runtime. It eliminates boilerplate by expressing pure business intent—data entities, temporal intervals, mathematical rates, workflow state machines, access policies, universal data/connectors, and compiler-native responsive UI—while delegating presentation, validation, authorization, persistence, and deterministic bounded resilience to an authoritative host.

```
AIR Source (.air)
      ↓
Semantic Compiler (Rust / JS)
      ↓
Presentation & Visual Design Compiler (Presentation IR v1 / Visual Design IR v1)
      ↓
Universal Data Layer (Memory / SQLite / PostgreSQL) + Connectors (REST / MCP)
      ↓
Structured Observability + Bounded Deterministic Resilience (Circuit Breakers / Retries)
```

---

## Key Capabilities & Frozen Architectural Layers

1. **UI Interaction Artifacts v1 (Drawers & Context Menus)**
   - **Right-Side Edit / Detail Drawers (`drawer` Artifact)**: Secondary interaction surface supporting `edit`, `create`, `detail`, `filter`, and `workflow` modes. Renders as a sliding right-side drawer on desktop ($\ge 640\text{px}$) and seamlessly transforms into a full-screen sheet on mobile ($< 640\text{px}$).
   - **Contextual Action Menus (`menu` Artifact)**: Context-aware dropdown, popover, or compact sheet menu supporting row actions (`[⋮]`), authority filtering (`runtime.can`), destructive action styling (`tone: "destructive"`), and full keyboard navigation.
   - **Strict Focus & State Preservation**: Modal focus trapping (`Tab`/`Shift+Tab`), focus restoration on dismissal, and **dirty-state discard protection** (`confirm` guard before losing unsaved changes).
   - **0 Application-Specific JS / CSS**: Completely inferred and rendered by the generic AIR compiler.

2. **Duration Analytics v1**
   - **Typed Duration Aggregations**: Type-safe `sum`, `avg`, `min`, `max`, and `count` over canonical `Duration` fields and intervals with exact symmetric half-away-from-zero rounding.
   - **Exact Utilization Metrics**: Ratio analytics preserving exact BigInt numerator and denominator pairs (avoiding binary floating-point drift).
   - **Semantic Event Stream Correlation**: Derives elapsed duration metrics directly from immutable event streams.

3. **Temporal Arithmetic & First-Class Money Rate Semantics v1**
   - **First-Class Rate Type**: Declared as `rate<currency, unit>` (e.g. `rate<USD, h>`), strictly preventing dimensional confusion with plain money.
   - **Exact Rational Money Derivation**: Computes `duration * rate` via exact BigInt minor-units arithmetic with symmetric half-away-from-zero rounding.
   - **Canonical Duration Algebra**: Supports `instant +/- duration`, `instant - instant`, `interval.duration`, and temporal comparisons.

4. **Temporal Interval Semantics v1**
   - **First-Class Intervals**: Declared as `field <resource>.<name> interval start=<start_field> end=<end_field>`.
   - **10-Scenario Overlap Matrix**: Exhaustively validated non-overlap logic (Scenarios A through J).
   - **Cross-Record & Cross-Resource Invariants**: Non-overlap constraints scoped by resource or blackout window, with automatic self-exclusion during updates.

5. **Atomic Mutation & Constraint Enforcement v1**
   - **Multi-Record Transactions**: Atomic execution across Memory, SQLite, and live PostgreSQL daemon backends.
   - **Constraint Rollback**: Immediate transaction rollback on invariant or validation failures, maintaining consistent business state.

6. **Visualization & Semantic Graphs v1**
   - **Intent-Driven Visualizations**: Compiles `line`, `area`, `bar`, `stacked_bar`, `scatter`, and `sparkline` charts directly from semantic analytical intent.
   - **Accessible Exact Data Tables**: Dual-rendered accessible tables for screen readers and exact numeric inspection.
   - **Spatial Workflow & Timeline Graphs**: Automatically compiled state-machine DAGs and immutable audit timelines.

7. **4-Level UI Hierarchy & Responsive Design IR**
   - **Clean Layered Hierarchy**: `Experience` (L1) -> `Section` (L2) -> `Artifact` (L3) -> `Utility` (L4).
   - **Section Rhythm & Collision Diagnostics**: Enforces readable spacing (`comfortable`, `compact`, `tight`) and prevents sibling surface collisions.

---

## Quick Start: Write & Run in 60 Seconds

### 1. Requirements
- Node.js 22+ (for web runtime & test runner)
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

## Writing an AIR Application

Create a `.air` file (e.g. `reservation-hub.air`):

```air
air version=2
app reservation_hub title="Reservation Hub" subtitle="Resource scheduling & capacity operations" initial=overview timezone="UTC"
theme mode=dark accent=violet
capability storage.local

# 1. Resources with First-Class Rates
resource resources label=name
field resources.name text required min=2
field resources.hourly_rate rate currency=USD unit=h required default=50
manage resources lifecycle=archive

# 2. Scheduling with Temporal Intervals & Computed Money Quotes
resource reservations label=title
field reservations.title text required min=2
field reservations.resource ref=resources required
field reservations.start_at datetime required
field reservations.end_at datetime required
field reservations.booking_period interval start=start_at end=end_at
field reservations.quote money currency=USD computed="booking_period.duration * resource.hourly_rate"
manage reservations lifecycle=archive

# 3. Temporal Constraints & Non-Overlap Invariants
invariant reservations.lead_time when="start_at < now + 2h" deny="Reservations must be booked at least 2 hours in advance"
invariant reservations.no_overlap none=reservations scope=resource overlaps=booking_period deny="Resource is already booked during this time"
```

To check and inspect:
```bash
# Verify syntax and static semantic checks
npm run air -- check reservation-hub.air

# Inspect semantic explanation and structure
npm run air -- explain reservation-hub.air
```

---

## Reference Applications (`apps/`)

| Application | File | Capabilities Demonstrated |
| :--- | :--- | :--- |
| **Reservation Hub** | [`apps/reservation-hub.air`](apps/reservation-hub.air) | Temporal intervals, non-overlap invariants, lead-time guards, blackout protections, first-class money rates, and computed quotes. |
| **Operations Hub** | [`apps/operations-hub.air`](apps/operations-hub.air) | Multi-project management, contextual action menus (`menu`), workflow states, and budget tracking. |
| **Northstar CRM** | [`apps/customer-manager.air`](apps/customer-manager.air) | Right-side sliding edit/detail drawers (`drawer`), scoped role authorization, reference relationships, and lifecycle archival. |
| **Expense Approval** | [`apps/expense-approval.air`](apps/expense-approval.air) | Multi-stage workflow, separation of duty, multi-signature evidence, deadline escalation, and spatial workflow graphs. |
| **Experience Hub** | [`apps/experience-demo.air`](apps/experience-demo.air) | Composite `auth.standard` lifecycle (registration, verification, password recovery, session revocation) and `user.management` admin console. |
| **Lattice Tasks** | [`apps/task-board.air`](apps/task-board.air) | Relational multi-resource task board with assigned owners and status tags. |
| **Content Publishing** | [`apps/content-publishing.air`](apps/content-publishing.air) | Multi-role editorial publishing workflow with rejection commentary and review gates. |

---

## Testing & Verification

AIR maintains an exhaustive test suite covering syntax, temporal math, interval algebra, atomic persistence, security boundaries, and responsive rendering:

```bash
# Run complete test suite (264 tests across 31 test suites)
npm test

# Run Rust compiler & conformance test suite
npm run test:rust

# Run cross-engine dual conformance verification
npm run test:dual
```
