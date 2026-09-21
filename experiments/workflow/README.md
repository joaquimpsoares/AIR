# Workflow fresh-AI experiment

Each case supplies only `apps/expense-approval.air`, a dependency-closed subset of `CAPABILITIES.aircat`, and the natural-language request. Runtime, UI, CSS, seeds, tests, and other applications are excluded.

The checked-in patches are deterministic expected results. No external model was invoked, so this experiment measures context size, semantic sufficiency, validation, and isolation—not model success.

`npm run workflow:context` applies every patch independently, validates the resulting graph, measures context, and verifies that no unrelated declaration changed.

It reports request tokens separately, relevant context (`application + retrieved catalog`), and total AI context (`relevant context + request`). Runtime source tokens are zero for all ten cases. Behavioral tests in `tests/workflow.test.mjs` execute the routing, deadline, legal-review, distinct-approval, immutability, assertion, and withdrawal results rather than treating successful parsing as sufficient.

The patches are intentionally independent. In particular, the two-finance-approver patch preserves one approval at or below 10,000 and adds a separate guarded two-distinct-actor edge above 10,000; the rejection-reason request is represented by assertions because both rejection edges already require comments.
