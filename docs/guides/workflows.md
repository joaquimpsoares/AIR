# State Machines & Workflows

Declarative processes, state transitions, authority policies, separation of duty, and audit history.

---

## 🔄 Defining a Process

```air
process expenses state=status initial=Draft terminal=Approved,Rejected history touch=updated_at
```
- `state`: The field holding the current state (must be an `enum` on the resource).
- `initial`: The state assigned upon record creation.
- `terminal`: States where no further forward transitions are permitted.
- `history`: Enables append-only `_air_history` tracking with immutable timeline events.
- `touch`: Automatically updates a timestamp field (e.g. `updated_at`) on state changes.

---

## 🚦 Defining Transitions

```air
transition expenses.submit from=Draft to=Submitted action=submit by=owner:submitter event=submitted
transition expenses.approve from=Submitted to=Approved action=approve by=role:manager separate=submitter event=approved
transition expenses.reject from=Submitted to=Rejected action=reject by=role:manager separate=submitter comment=required event=rejected
```

### Transition Attributes:
- `from`: Allowed source state(s) (comma-separated for multi-source transitions).
- `to`: Destination state.
- `action`: Semantic verb used for UI buttons and API triggers.
- `by`: Policy specifying who can trigger the transition:
  - `role:manager` (must have manager role)
  - `owner:submitter` (current user ID must match the `submitter` field)
  - `self` (must be the record actor)
- `separate=submitter`: **Separation of Duty**. Prevents a manager from approving an expense they submitted themselves.
- `comment=required`: Requires a non-empty explanation string to execute the transition.
- `event`: Name of the semantic event recorded in audit logs.
