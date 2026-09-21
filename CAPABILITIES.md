# AIR capability catalog

[`CAPABILITIES.aircat`](./CAPABILITIES.aircat) is the authoritative, machine-oriented catalog. Its line-oriented AIR-like form is smaller and more directly retrievable than an equivalent JSON schema: the header declares AIR compatibility, and each capability has syntax, meaning, parameters, constraints, search tags, and dependencies.

Use `npm run air -- capabilities search "ownership permission"` or `npm run air -- capabilities search "multi approval distinct actor"` to retrieve a dependency-closed subset. Application editing requires the `.air` application plus that subset—not runtime, UI, CSS, seed, or test source.

Stable semantic addresses come from declaration kind plus natural ID: `resource:customers`, `field:customers.email`, `transition:expenses.finance_approve`, and `deadline:expenses.manager_review`. Patch operations are `add`, `set`, `assert`, and `remove`; `was_<property>` adds an optimistic conflict precondition, with `<absent>` for an omitted default. Patches validate atomically against the complete AIR model.

The workflow expansion increases the full catalog from ~1,589 to ~2,516 approximate tokens. Expense patch retrieval yields 495–1,445 catalog tokens. This remains smaller than the full catalog, but dependency closure plus the 1,251-token application pushes most total contexts above 2,000 tokens; `EXPERIMENT.md` reports that regression rather than hiding it.
