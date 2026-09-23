# Benchmark Methodology & Reproducibility

How AIR measures token footprints, context compression, and functional equivalence.

---

## 📐 Tokenizer & Measurement Rules

All token measurements are strictly computed using the standard **OpenAI `cl100k_base` subword tokenizer** (identical to GPT-4 / ChatGPT tokenization) via `tools/benchmark.mjs`:
1. **Application Source Tokens**: Sum of all non-test, non-mock source files required to implement the business domain, UI, components, validation schemas, and state management.
2. **Boilerplate Exclusions**: Generic library code (e.g. `node_modules`, standard React runtime) is excluded from both sides to ensure fair comparison.
3. **Equivalence Gate**: Automated equivalence tests verify that both AIR and conventional reference implementations provide identical functionality (validation, search, filter, pagination, responsive cards, edit drawers, state machines).

---

## 🔬 Reproducing the Benchmark Locally

Run the benchmark measurement tool:

```bash
npm run benchmark
```

To verify that the checked-in results in `benchmarks/results.json` have not drifted:

```bash
npm run benchmark:check
```

---

## 📂 Source Code Paths

- **Tokenizer Implementation**: [`tools/tokenizer.mjs`](../../tools/tokenizer.mjs)
- **Benchmark Runner**: [`tools/benchmark.mjs`](../../tools/benchmark.mjs)
- **Customer Manager AIR Source**: [`showcase/customer-manager/app.air`](../../showcase/customer-manager/app.air)
- **Customer Manager Conventional Reference**: [`benchmarks/customer-manager/conventional/src/`](../../benchmarks/customer-manager/conventional/src/)
- **Approval Workflow AIR Source**: [`showcase/approval-workflow/app.air`](../../showcase/approval-workflow/app.air)
- **Approval Workflow Conventional Reference**: [`benchmarks/approval-workflow/conventional/src/`](../../benchmarks/approval-workflow/conventional/src/)
