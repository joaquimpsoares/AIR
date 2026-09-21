# Fresh-AI context experiment

Each case approximates a new AI session with exactly three inputs:

1. `apps/customer-manager.air`
2. the dependency-closed catalog subset returned for `capabilityQuery`
3. the natural-language `request`

Runtime, UI, CSS, seeds, tests, and unrelated source are excluded. The checked-in `.airpatch` is the expected semantic answer and is applied and validated by `npm run context`.

No model was invoked in this environment. These are reproducible context packs and deterministic sufficiency/size checks, not claims about model success. `conventionalTokens` is a conservative per-change estimate of the application-specific schema/model, authorization/service, UI/form/list, route/controller, and relevant tests a conventional implementation would normally need to inspect. It excludes dependencies, generated code, seed data, and the code needed to implement the change, so it should not be read as a maximal repository comparison.

Approximate tokens use UTF-8 bytes divided by four and rounded up. `AIR_CONTEXT` is the full application AIR plus the retrieved catalog subset; it intentionally excludes the request itself in both sides of the ratio.
