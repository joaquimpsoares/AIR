# AIR v2 architecture

AIR tests whether a compact, validated semantic model can be an AI's working model of an application. Compression is an outcome; correctness depends on retaining every business fact the runtime cannot safely infer.

## Four separate artifacts

```text
application.air + relevant CAPABILITIES.aircat entries + requested change
       |                         |
       | intent                  | language semantics, not implementation
       v                         v
validated semantic graph -> shared deterministic runtime -> application
       ^
       |
seed.json / storage (data only)
```

- **Application model:** resources, fields, relationships, actors, access, lifecycle, processes, transitions, invariants, deadlines, insights, and semantic presentation intent.
- **Data:** seed/storage records validated by the model. Data is never AIR application representation.
- **Capability catalog:** machine-oriented descriptions of what AIR can express. It contains syntax, meaning, constraints, search tags, and dependencies.
- **Runtime:** parsing, inference, query/mutation enforcement, persistence, rendering, responsive/accessibility behavior, and standard states. Normal application changes do not put its source in AI context.

## Deterministic inference

`manage <resource>` derives navigation, list/detail, create/edit forms, widgets, validation, search, enum/ref/bool filters, stable sort choices, pagination, responsive behavior, accessibility, confirmation, errors, empty states, and notifications. Schema types and declaration order drive this versioned inference; resource names and current data do not.

Read-only grouped insights participate in the same projection algorithm as fields. Highlights supply a semantic tone, leaving visual implementation to the design system.

Workflow resources use the same inference boundary. A declared process derives eligible action controls, guarded state execution, approval progress, immutable history presentation, deadline status, and a Mermaid graph. The application states business edges and exceptions; it does not state controllers, buttons, audit-table code, schedulers, or routes.

## Stable semantic addressing

Important objects already have natural identity, so no synthetic IDs were added:

| Concept | Address |
|---|---|
| customer resource | `resource:customers` |
| VAT field | `field:customers.vat_number` |
| customer access policy | `access:customers` plus property `edit` |
| expiry rule | `rule:customers.expire` |
| monthly revenue insight | `insight:customers.monthly_revenue` |
| expense process | `process:expenses` |
| finance approval edge | `transition:expenses.finance_approve` |
| manager deadline | `deadline:expenses.manager_review` |

Declaration kind plus natural ID is unique. A field label may change while `customers.vat_number` and persisted key `vat_number` stay stable.

## Patch model and safety

AIR Patch is a small line-oriented command language using the same declaration grammar:

```airpatch
add field customers.preferred_language text
set rule customers.expire after=45d was_after=30d
assert access customers view=role:admin|owner:account_manager
remove highlight customers.vip was_tone=accent
```

- `add` fails if the address exists.
- `set`, `assert`, and `remove` fail if it does not.
- `was_<property>` is an optimistic precondition and detects stale/concurrent intent; `<absent>` safely requires that no explicit override exists.
- the complete result is parsed and validated before it is returned;
- invalid fields, relationships, policies, and references fail closed; and
- untouched declarations remain semantically identical. Stable serialization limits textual noise.

`upsert` remains only for compatibility with the first experiment. New AI-facing patches use strict operations. Patches are auditable text; an inverse can be constructed from the before-model and semantic diff, though automatic rollback generation is not implemented.

## Scoped authorization

```air
actor account_managers
field customers.account_manager ref=account_managers required
access customers view=role:admin|owner:account_manager edit=role:admin|owner:account_manager
```

`actor` identifies a principal resource. `owner:<field>` is accepted only for a reference to an actor resource and means the record's reference equals the current principal ID and actor type. Policies are OR expressions. Query filtering, record lookup, update, archive/delete, reference display, and the UI all use the same runtime policy—not UI hiding alone.

The implementation contains no Customer or AccountManager branch. Tests reuse the same primitives for authors and posts.

## Process authority and evidence

`access`, transition `by`, and transition `separate` are intentionally independent. They answer data visibility/mutation, action authority, and separation of duty respectively. No role—including admin—implicitly bypasses a process edge. Conditions are compiled from an allowlisted expression subset and evaluated against fields, validated reference paths, computed aggregates, and named parameters.

Process history is runtime-owned evidence attached to the record. Requested and automatic transitions append actor/time/from/to/action/event/comment/completion facts. Multi-approvals retain the current state until cardinality is met, and `distinct` prevents the same principal from supplying multiple approvals. Internal events support temporal/prior-evidence guards but do not deliver external side effects.

See `WORKFLOW_MODEL.md` for transition, invariant, deadline, validation, and limitation details.

## Relationship aggregates

```air
insight account_managers.active_customers op=count source=customers group=account_manager where=status:Active
```

The owner is the result resource; `group` must be a source reference back to it. The result is a non-persisted, read-only field. Aggregate source rows are access-filtered. Count, sum, and average are generic and are tested with unrelated authors/posts data.

## Capability discovery and context boundary

`air capabilities search <query>` scores IDs, tags, meanings, and syntax, then includes dependencies. The retrieved subset is deterministic and always smaller than the current complete catalog for tested requests.

For an ordinary application edit:

```text
AI_CONTEXT = complete application.air + retrieved catalog subset + user request
runtime source context = 0
```

The experiment metric excludes the request from both AIR and conventional sides because it is common to both. Runtime source is needed only when changing AIR itself.

## Security and non-goals

Declarations, properties, types, references, access terms, and capabilities are allowlisted; there is no code evaluation. This prototype does not provide identity authentication, server enforcement, tenant isolation, database adapters, migrations, concurrency control, a durable scheduler, holiday calendars, external APIs, connector protocols, secrets, production security, or resilience infrastructure.

The workflow experiment kept application mechanics out of AIR, but exposed material language/runtime growth and relevant contexts up to roughly 3,000 tokens. The next architectural risk is semantic convergence: stabilizing the JavaScript v2 model enough to port one coherent definition to Rust without creating two drifting compilers.

## Converged compiler boundary

AIR v2 is now frozen in [the authoritative specification](spec/AIR-V2.md) and
the shared `conformance/` corpus. JavaScript and Rust emit the same canonical
semantic IR; Rust lowers that IR to versioned AIR2 and packages it with the Wasm
semantic runtime. AIR source, canonical IR, AIR2, and Wasm remain distinct.

The two semantic engines coexist only as a convergence step. See
`MIGRATION.md` for the staged move to one Rust/Wasm engine with JavaScript as the
browser renderer and host adapter.
