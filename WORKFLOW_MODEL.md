# AIR v2 workflow model

AIR does not use a monolithic workflow object. The smallest model that survived the Expense Approval test is a resource state field plus `process`, `transition`, bounded `condition`, actor policy, `invariant`, and `deadline` declarations. These are application intent. Execution, forms, action controls, history rendering, and graph rendering remain shared runtime capabilities.

## Deterministic execution

For a requested action the runtime consumes the current stored record, principal, immutable transition history, deterministic clock, and compiled AIR model. It returns allowed/denied, the resulting record, validation errors, approval progress, and internal semantic events. No model or generated code runs at application runtime.

```air
process expenses state=status initial=Draft terminal=Paid,Cancelled history touch=updated
transition expenses.submit from=Draft to=Submitted action=submit by=owner:employee event=submitted
transition expenses.auto_approve from=Submitted to=Approved automatic when="amount<@auto_limit" event=approved
```

Requested transitions need an action and authority. Automatic transitions are system-authorized and repeatedly stabilize until no edge applies. More than one eligible automatic edge is a runtime error, and cycles fail closed. A state transition never implies an external side effect: `Approved -> PaymentPending` changes application state; invoking a payment provider remains out of scope.

## Conditions and parameters

Conditions are a bounded data language, not code. They support validated field/reference/computed paths, scalar literals, named parameters, addition, comparisons, conjunction, and alternatives. Conjunction binds within `|` alternatives. There are no calls, loops, arbitrary expressions, or `eval`.

```air
parameter expenses.auto_limit value=500
transition expenses.route automatic when="amount<@auto_limit&employee.monthly_spend+amount>employee.monthly_budget" ...
```

Named parameters exist when a business threshold should be independently patchable. A threshold change then touches one declaration instead of every guard that consumes it.

## Authority and separation of duty

Data visibility, record editing, and transition authority are separate:

- `access` controls data operations;
- `by` controls who may request a transition; and
- `separate` denies a transition when the principal resolves to the protected actor path.

```air
transition expenses.manager_approve ... by=owner:employee.manager separate=employee
```

Both checks execute below the UI. Possessing an additional role does not override `separate`, and the `admin` role has no implicit process bypass.

## Approval evidence, history, and events

`approvals=2 distinct=true` accumulates two pieces of evidence while the record remains in its current state. Reusing the same actor fails. A completed edge changes state only after cardinality is met.

With `process ... history`, the runtime appends actor, action, transition address, from/to states, timestamp, comment, completion flag, and internal event to `_air_history`. Application forms cannot mutate that field. Events are internal semantic facts returned with the transition result and retained as evidence; they are not connectors or an event-delivery system.

`comment=required` makes evidence mandatory for that action. `within=14d since=event:rejected` and `unless_event=manager_approved` constrain an edge using its prior semantic evidence.

## Invariants and deadlines

Conditional invariants supply state/value-dependent validation and field immutability:

```air
invariant expenses.receipt when="amount>@receipt_limit" require=receipt_ref
invariant expenses.paid_locked when="status==Paid" immutable=*
```

The UI uses the same model to hide locked controls, but runtime validation is authoritative.

Deadlines derive `OnTime`, `Overdue`, or `EscalationRequired` without changing process state. `h` is elapsed hours, `d` is elapsed 24-hour days, and `bd` counts Monday-Friday in UTC. `bd` deliberately excludes holiday calendars, locale-specific work weeks, cut-off hours, and time zones; those require an explicit future calendar capability rather than silent approximation.

## Static validation

The compiler rejects unknown states/fields/reference paths, missing action authority, invalid automatic authority, invalid approval cardinality, impossible same-path authority/separation, exact duplicate transitions, contradictory simple numeric bounds, invalid temporal declarations, outgoing edges from terminal states, unreachable states, and non-terminal states with no exits. It does not claim complete guard-overlap or graph verification; data-dependent automatic ambiguity still fails during deterministic stabilization.

## Genericity evidence

The same declarations implement `content-publishing.air`: Author submission, conditional Standard publication or Regulated legal review, editor/legal authority, separation from the author, review/published immutability, history, and semantic events. Purchase approvals, access requests, leave requests, finalized invoices, and signed contracts are the other documented reuse cases behind the capability decisions.

## Current limits

History is append-only within this local semantic runtime, not cryptographically tamper-evident or server-authoritative. There is no durable scheduler, external side-effect delivery, delegation, quorum groups beyond a numeric distinct-actor count, parallel branches, compensation, holiday calendar, migration/concurrency model, or production identity system.
