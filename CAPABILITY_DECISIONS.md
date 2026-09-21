# Capability decisions before implementation

This design checkpoint precedes runtime changes for the context-compression phase.

## 1. Actor identity and scoped access

### Why AIR v2 is insufficient

AIR v2 can require a role for an action (`edit=admin`) but cannot express a predicate connecting the current actor to a record. Hiding unassigned records in the UI would also be insufficient: query and mutation paths must enforce the same scope.

### Smallest generic semantic

```air
actor account_managers
access customers view=role:admin|owner:account_manager edit=role:admin|owner:account_manager
```

`actor <resource>` declares that records of a resource may identify principals. `owner:<field>` is valid only when the field is a reference to an actor resource. It means:

```text
record.<field> == currentPrincipal.id
AND field.ref == currentPrincipal.actorResource
```

Policies are OR expressions of typed terms. They are evaluated by query and mutation engines, not just rendering.

### Unrelated reuse

- a teacher views/edits students whose `teacher` reference identifies them;
- an author edits posts whose `author` reference identifies them;
- a salesperson sees leads assigned through `salesperson`;
- a project manager sees projects assigned through `manager`.

No resource or field name receives special treatment.

## 2. Grouped relationship aggregate

### Why AIR v2 is insufficient

AIR v2 insights calculate one overview value. “Active customers for each account manager” requires a value grouped by a relationship and attached to every target record. It cannot be inferred from the relationship because count, filter, and display intent are business choices.

### Smallest generic semantic

```air
insight account_managers.active_customers op=count source=customers group=account_manager where=status:Active
```

The insight owner (`account_managers`) is the result resource. `source` is aggregated, `group` must be a source reference back to the owner, and `where` is an optional equality predicate. The compiler exposes the insight as a read-only computed field, so normal list/detail inference can display it without page/table declarations.

### Unrelated reuse

- tasks per project, optionally filtered to open tasks;
- students per teacher, filtered to currently enrolled;
- posts per author, filtered to published;
- unpaid invoices per customer.

## 3. Semantic highlight

### Why AIR v2 is insufficient

Adding `VIP` to an enum changes valid data but does not express that VIP rows deserve emphasis. CSS or a table-row declaration would leak implementation detail into AIR.

### Smallest generic semantic

```air
highlight customers.vip when=status:VIP tone=accent
```

The runtime maps semantic tones to the active design system. The condition is a validated equality predicate on the owning resource. No CSS, selector, component, or layout appears in AIR.

### Unrelated reuse

- emphasize urgent tasks;
- warn on overdue invoices;
- mark high-risk support tickets;
- distinguish blocked projects.

## 4. Patch conflict preconditions

### Why the existing patch model is insufficient

`set rule customers.expire after=45d` is deterministic but can overwrite a concurrent change from `30d` to another duration. Safe modification needs an optional expected prior value.

### Generic operation

```airpatch
set rule customers.expire after=45d was_after=30d
```

`was_<property>` is a patch precondition, never an AIR property. A mismatch fails the entire patch before serialization. New objects use `add`, which fails if the semantic address already exists; `set` and `remove` fail if it does not.

This model applies to every declaration kind. `upsert` remains accepted only for the earlier experiment artifacts; new context tests use strict operations.

## Decision

Implement these four capabilities because each represents missing reusable semantics required for correctness. Do not add pages, nested UI commands, table configuration, CSS hooks, connector/security infrastructure, or application-named behavior.

## 5. Ownership through a relationship path

### Why direct ownership is insufficient

The independent “customers have multiple contacts” test creates `Contact.customer -> Customer`. If Contacts are managed, a direct-only ownership primitive would either expose every contact or require duplicating `account_manager` on every contact and keeping it synchronized with the parent customer. Both are incorrect. Authorization must be able to follow declared references while remaining data-model semantics rather than UI behavior.

### Smallest generic extension

```air
access contacts view=role:admin|owner:customer.account_manager edit=role:admin|owner:customer.account_manager
```

An owner path is one or more reference fields. Every segment is schema-validated and the final reference must target an actor resource. Evaluation follows stored references and compares the final ID and actor type to the current principal. A missing link denies access.

### Unrelated reuse

- a project member sees tasks through `task.project.manager`;
- an account owner sees invoices through `invoice.customer.account_owner`;
- a teacher sees submissions through `submission.assignment.teacher`;
- an author sees comments through `comment.post.author`.

This extension is required to preserve scoped authorization when a related child resource is added. It does not infer policy propagation: the AIR patch must explicitly state the path because visibility of child records is a business decision.

## Workflow experiment: attempt with existing semantics

Before adding declarations, the Expense Approval requirements were mapped onto current AIR:

- resources, typed fields, relationships, actors, management, read/write visibility, archive behavior, and per-owner aggregates are already expressible;
- the existing `rule` can perform one elapsed-time field change, but has no requested action, actor, branching condition, approval evidence, or separation-of-duty check;
- `access` controls CRUD visibility/authority but cannot describe which state transition an actor may request;
- field `required` and ordinary edit policy are unconditional, so they cannot express state/value-dependent validity or immutability;
- insights are readable computed values, but existing equality-only predicates and lack of a time window cannot support monthly aggregate routing; and
- no current declaration preserves transition decisions or evaluates review deadlines without changing application state.

Encoding these facts as extra status fields, UI buttons, names with special meaning, or JavaScript would either lose correctness or leak implementation. The following decisions add only the missing fundamental semantics.

Schema minimization also rejects an unnecessary representation: Employee, Manager, and FinanceUser do not need separate profile resources. One `users` actor, a self-reference `users.manager`, the Expense's `employee` reference, and `role:finance` transition authority preserve the required identities and relationships without duplicated people or application-only joins.

## 6. Process state and transitions

### Requirement exposing the gap

Expense routing has actor-requested and automatic edges with different targets. Current `rule` only represents an elapsed-time transition and cannot distinguish an employee submission from manager approval or deterministic amount routing.

### Proposed semantic concept

```air
process expenses state=status initial=Draft terminal=Paid,Cancelled history touch=updated
transition expenses.submit from=Draft to=Submitted action=submit by=owner:employee
transition expenses.auto_approve from=Submitted to=Approved automatic when="amount<@auto_limit"
```

`process` identifies an existing enum as state, its initial/terminal states, whether transition evidence is retained, and an optional date field touched on mutation. `transition` declares a graph edge. It is not a page, orchestration service, job, or side effect. Automatic edges are deterministically stabilized after a successful requested transition.

### Rejected alternatives

- A nested `workflow` DSL adds syntax and encourages implementation-like blocks without adding semantics.
- Overloading `rule` would conflate elapsed time reconciliation with requested actions and approvals.
- Inferring edges from enum names or UI actions is nondeterministic.
- Storing separate boolean approval fields creates invalid combinations and weakens graph validation.

### Token/complexity impact

One process line plus one line per semantically distinct edge. Branching business complexity is explicit; routes, buttons, handlers, and history UI remain inferred.

### Unrelated reuse

- content: Draft -> EditorialReview -> LegalReview -> Published;
- access request: Requested -> ManagerReview -> SecurityReview -> Granted;
- purchase order: Draft -> Approved -> Ordered -> Delivered.

### Runtime implications

Compile a validated graph; expose available actions; authorize and execute one edge atomically; stabilize unambiguous automatic edges; emit internal semantic events; reject unknown/unreachable/dead-end states and ambiguous runtime routing where detectable.

## 7. Deterministic conditions and named parameters

### Requirement exposing the gap

Amount thresholds, category routing, monthly-budget routing, and tiny threshold patches need safe conditions. Repeating `500` and `5000` across edges makes one business change touch several lines.

### Proposed semantic concept

```air
parameter expenses.auto_limit value=500
transition expenses.auto_approve ... when="amount<@auto_limit"
transition expenses.manager_review ... when="amount>=@auto_limit"
```

`parameter owner.id value=...` gives a business threshold stable semantic identity. `when` uses a deliberately bounded expression grammar: field/reference paths, named parameters, literals, comparisons, `+`, conjunction `&`, and disjunction `|`. There is no evaluation of source code or natural language.

Insights gain generic conditional predicates and optional calendar windows so a per-owner monthly aggregate can be referenced by a guard.

### Rejected alternatives

- Repeated literals produce unsafe multi-location threshold patches.
- JavaScript, CEL, or arbitrary expressions expand authority and context far beyond this experiment.
- Natural-language guards cannot execute deterministically.
- Expense-named threshold primitives are domain leakage.

### Token/complexity impact

Parameters add one line per independently changeable business constant, but reduce patch size and duplicated conditions. The condition evaluator is shared runtime complexity.

### Unrelated reuse

- purchase orders route above a configurable spend threshold;
- content requires legal review for a regulated category;
- access requests add security review for privileged access.

### Runtime implications

Parse and validate expressions without `eval`; resolve paths through declared references/computed fields; type comparisons; reject malformed and simply contradictory conjunctions; evaluate with injected data and clock.

## 8. Action authority, separation of duty, approval evidence, and events

### Requirement exposing the gap

CRUD access cannot state who may request a particular edge, prevent self-approval, require two distinct approvers, require rejection reasons, or prove that a decision occurred.

### Proposed semantic concept

Transition properties reuse existing policy vocabulary:

```air
transition expenses.manager_approve ... action=approve by=owner:employee.manager separate=employee comment=optional event=manager_approved
transition expenses.finance_approve ... by=role:finance separate=employee approvals=2 distinct event=finance_approved
```

- `by` authorizes the action independently of data visibility and CRUD editing.
- `separate` requires the acting principal to differ from one or more actor-reference paths.
- `approvals` is evidence cardinality; `distinct` requires different principals before the edge completes.
- `comment=required|optional|none` validates action input.
- `event` names the internal semantic event; otherwise the transition ID is used.
- `within`/`since=event:<name>` and `unless_event` provide bounded history-aware action guards.
- `process ... history` retains append-only runtime-owned evidence: actor, transition, event, from/to, time, comment, and completion.

This does not introduce a domain-specific `approval` object: approval is an action whose transition may require multiple pieces of evidence.

### Rejected alternatives

- UI hiding does not enforce authority.
- Role-only policies cannot enforce relationship scope or self-approval prevention.
- Mutable application fields are not immutable audit evidence.
- A general event bus or connector system is outside scope; internal events remain data returned/stored by the semantic runtime.

### Token/complexity impact

Most edges add two to five compact properties. Multi-person approval changes one transition rather than introducing approver tables, counters, handlers, and branches in AIR.

### Unrelated reuse

- two distinct reviewers approve a deployment, excluding its author;
- manager and security actors approve an access request, excluding the requester;
- editorial/legal decisions preserve comments and publication evidence.

### Runtime implications

Enforce action authority and separation before mutation; accumulate distinct evidence per state entry; append immutable history; return semantic events; keep external side effects absent.

## 9. Conditional invariants

### Requirement exposing the gap

Receipt/travel-purpose requirements and state-dependent immutable fields cannot be represented by unconditional field flags or CRUD policy.

### Proposed semantic concept

```air
invariant expenses.receipt when="amount>500" require=receipt_ref
invariant expenses.final when="status==Approved|status==PaymentPending" immutable=employee,amount,category,receipt_ref,date
```

An `invariant` is a named conditional constraint on one resource. `require` rejects blank fields. `immutable` rejects changes to named stored fields; `*` means every stored business field. Process state itself is always transition-owned and cannot be directly edited.

### Rejected alternatives

- Duplicating conditional rules on fields scatters one invariant across the schema.
- UI-only disabled/required controls are bypassable.
- Separate schemas per state explode representation and migration complexity.

### Token/complexity impact

One line per independent business invariant. Forms may infer required/locked presentation, while runtime validation remains authoritative.

### Unrelated reuse

- published content and signed contracts become immutable;
- finalized invoices lock amounts and counterparties;
- purchase orders require vendor evidence above a threshold.

### Runtime implications

Validate conditions on create/update/transition, report field errors, compare normalized stored values, and block direct process-state edits.

## 10. Review deadlines and escalation semantics

### Requirement exposing the gap

The existing `rule` changes a field after calendar duration. A review target must instead expose overdue/escalation semantics without automatically changing workflow state or running a scheduler.

### Proposed semantic concept

```air
deadline expenses.manager_review state=ManagerReview after=3bd escalation=required
```

A deadline attaches deterministic temporal metadata to a state. `bd` counts Monday-Friday in UTC; holidays and regional calendars are explicitly not modeled. Entry time comes from transition history, falling back to the process touch/created field for seeded records. The runtime derives `OnTime`, `Overdue`, or `EscalationRequired` and a due date.

### Rejected alternatives

- An automatic overdue transition alters business state and loses the distinction between approval state and timeliness.
- A scheduler, notification system, or connector is outside scope.
- Treating `3bd` as 72 hours would silently misrepresent business days.

### Token/complexity impact

One line per state deadline; changing 3 to 2 business days is one property patch.

### Unrelated reuse

- access/security review service targets;
- editorial/legal review deadlines;
- purchase-order and leave-request approval SLAs.

### Runtime implications

Validate state/duration/escalation; calculate weekdays from injected clock; expose derived status through the semantic model/UI; emit no external side effect.

## Workflow capability decision

Implement `parameter`, `process`, `transition`, `invariant`, and `deadline`, plus bounded condition/aggregate extensions. Do not implement a monolithic workflow engine declaration, external side effects, application-named behavior, background scheduling, connectors, or arbitrary code expressions.

---

# AIR v2 semantic convergence decisions

## Specification, not implementation, is authoritative

`spec/AIR-V2.md` and the shared corpus now define AIR v2. The JavaScript engine
was made conformant first, then Rust was implemented from the specification.
Direct canonical comparison is required whenever either compiler changes.

## Typed conditions replace runtime coercion

The former JS evaluator inferred numeric comparison by attempting `Number` on
both runtime values. This made string values such as `"01"` context-dependent
and left missing-value behavior unclear. AIR v2 now type-checks operands and
addition during compilation. Runtime comparison does not coerce. A statically
valid path that is missing at execution makes every comparison false, including
`!=`. Existing reference applications already provide correctly typed values,
so their intended behavior is preserved.

## Run-to-stability is atomic

The prior JS structure already cloned a record, validated each automatic
destination, and committed only after stabilization. The specification freezes
that behavior. Source order does not select an automatic edge. Multiple matches,
validation failures, or data-dependent cycles roll back the requested edge and
all tentative history/events. Unconditional automatic-only cycles are also a
static process error.

## History remains semantic evidence

History is sufficient for current event windows, approval cardinality,
separation checks, deadline start, explanation, and presentation. Calling it a
trusted audit log would be incorrect because storage is local and history is not
cryptographically or server protected. No audit/security capability was added.

## Canonical invariants are process-independent

The first canonical-IR draft nested invariants only below a process, reflecting
an execution convenience in JavaScript. AIR permits invariants on any resource,
so canonical IR stores one top-level invariant list with resource/address.

## AIR2 and AIR1 coexist temporarily

AIR1 screen/state bytecode remains for old samples and tests. AIR2 is a distinct
magic/version containing canonical v2 semantic IR. The CLI auto-detects source
version; AIR1 UI constructs are not reinterpreted as AIR v2.

## Wasm exposes semantics, not a Rust web renderer

The v2 Wasm ABI accepts explicit program/data/principal/clock inputs and executes
semantic transitions/status. Its view buffer carries semantic JSON. DOM/CSS and
the established browser host remain JavaScript, honoring the phase boundary.
