# AIR v2 semantic inventory

This inventory records the language that existed at the AIR v2 convergence
freeze. It is descriptive input to `AIR-V2.md`; it does not introduce syntax.

## Source and application model

| Construct | Existing semantic role |
|---|---|
| `air` | Selects source-language version 2. |
| `app` | Stable application identity, copy, and initial inferred page. |
| `theme` | Overridable presentation defaults: mode, accent, density. |
| `capability` | Explicit host authority, currently local storage or a named extension load. |
| `resource` | Entity identity, labels, icon, and record label field. |
| `field` | Stored scalar/reference schema or compiler-inferred computed field. |
| `actor` | Marks a resource whose record IDs may identify principals. |
| `manage` | Requests the complete inferred resource-management experience and lifecycle. |
| `access` | Record-aware policies for view/create/edit/delete/archive. |
| `overview` | Requests an inferred dashboard. |
| `insight` | Overview aggregate or relationship-grouped computed aggregate. |
| `rule` | Elapsed-time field transition reconciled from an injected clock. |
| `highlight` | Semantic record emphasis selected by a field/value predicate. |
| `parameter` | Named, independently patchable scalar used by conditions. |
| `process` | Binds a resource enum field to a state graph. |
| `transition` | Requested or automatic graph edge, guard, authority, evidence, and event. |
| `invariant` | Conditional requiredness and edit immutability. |
| `deadline` | State-relative temporal status and escalation projection. |
| `extension` | Capability-gated, host-allowlisted presentation extension. |

## Resolved semantics

- Ownership policies are OR expressions containing `role`, `self`, or a
  single-valued reference path ending at an actor resource. The same policy
  representation is used for transition authority, with `system` additionally
  allowed for automatic edges.
- A relationship path has exactly one result because AIR v2 references are
  scalar. Missing records or blank links resolve to missing, never to a
  wildcard or a collection.
- Management inference supplies navigation, list/detail/forms, type-driven
  validation, search, filters, sort choices, pagination, standard states,
  responsive behavior, and accessibility. Lifecycle is hard delete or archive.
- Aggregates are count/sum/average over a resource, optionally filtered,
  grouped, relationship-projected, or restricted to the injected clock's UTC
  month. Aggregate source rows are access-filtered at execution.
- Conditions contain OR alternatives of AND clauses. Clauses compare operands;
  operands contain one term or numeric addition. Terms are literals,
  parameters, or validated field/reference/computed paths.
- A process contains requested actions and system automatic transitions.
  Authority, separation of duty, comments, approval cardinality, internal
  events, time windows, invariants, deadlines, and semantic history are
  independent concepts.
- Approval evidence is incomplete transition history in the current state
  epoch. `distinct` requires distinct `(actor resource, actor id)` pairs.
- History is record-local application semantic history. It is neither a
  trusted audit log nor an external event-delivery mechanism.
- `h`, `d`, and `bd` durations mean elapsed hours, elapsed 24-hour days, and
  Monday-Friday UTC days without holidays respectively.

## Tooling semantics

- AIR Patch addresses declarations by `(kind, natural ID)`. `add`, `set`,
  `remove`, and `assert` are strict; `was_...` properties are optimistic
  preconditions; the complete patched program is validated atomically.
- Semantic diff reports declaration/property changes. Explain and workflow
  projection are deterministic views of a compiled model, not independent
  sources of meaning.
- Seed JSON and storage contain data and semantic history. They are not part of
  application representation.
- The JavaScript UI is a host renderer. Its DOM, CSS, routing, and widget layout
  are not AIR language semantics.

## Pre-convergence Rust inventory

The existing Rust `Program` is AIR v1: named mutable values, screens, UI nodes,
actions, and an expression VM serialized with `AIR1` magic. Those concepts are
retained for v1 compatibility but are not AIR v2 constructs. AIR v2 receives a
separate compiler, semantic IR, runtime representation, and `AIR2` bytecode.
