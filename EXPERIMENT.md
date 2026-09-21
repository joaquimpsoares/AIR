# AIR v2 context-compression experiment

Date: 2026-09-20

## Outcome

The AccountManager extension is expressible in application semantics alone. Customer Manager grew from **13 lines / 480 bytes / ~120 tokens** to **26 lines / 1,299 bytes / ~325 tokens** while gaining a second managed resource, actor identity, a required relationship, record-scoped reads and edits, archive lifecycle, company/VAT, a scheduled rule, and revenue data/aggregation.

Data remains separate: the current seed is **21 lines / 3,947 bytes / ~987 tokens / 15 records** and is not counted as AIR.

## Context model

For each request:

```text
AIR_CONTEXT = complete customer-manager.air + retrieved dependency-closed capability entries
```

The natural-language request is excluded from both sides because both AIR and conventional workflows receive it. Tokens are approximated as `ceil(UTF-8 bytes / 4)`. Runtime, UI, CSS, seed, and tests are not supplied to the hypothetical fresh AI.

No model invocation was available or performed. The artifacts under `experiments/context` are deterministic context packs and expected validated patches, not fabricated evidence of model success.

## Capability catalog

The AIR-like line format was selected over JSON because it reuses AIR tokenization, keeps one retrievable capability per line, and avoids repeated JSON keys/delimiters. The catalog is **6,353 bytes / ~1,589 tokens**. It specifies AIR-version compatibility, syntax, semantic meaning, parameters, constraints, tags, and dependencies.

`air capabilities search <query>` retrieves a scored subset and closes it over dependencies. Across the eight cases, relevant capability context is **294–964 tokens**. Even the whole catalog plus the application is ~1,914 tokens; retrieved contexts are **619–1,289 total tokens**, all below the 2,000-token budget.

## Eight independent modifications

Each patch applies independently to the 26-line application.

| # | Modification | AIR lines touched | Patch lines | Bytes | ~tokens | Relevant catalog | App context | Total AIR context | Runtime source | Runtime changes | Unrelated AIR | Validation | Conventional context | Ratio |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---:|
| 1 | preferred language | 1 | 1 | 44 | 11 | 635 | 325 | 960 | 0 | 0 | no | pass | 2,400 | 2.50× |
| 2 | multiple contacts | 6 | 6 | 374 | 94 | 805 | 325 | 1,130 | 0 | generic owner-path access | no | pass | 4,800 | 4.25× |
| 3 | admin-only archive | 1 | 1 | 85 | 22 | 964 | 325 | 1,289 | 0 | 0 | no | pass | 3,600 | 2.79× |
| 4 | managers see own customers | 0 | 1 assertion | 62 | 16 | 725 | 325 | 1,050 | 0 | 0 | no | pass | 5,200 | 4.95× |
| 5 | active customers per manager | 1 | 1 | 139 | 35 | 877 | 325 | 1,202 | 0 | 0 | no | pass | 4,600 | 3.83× |
| 6 | expiry 30d → 45d | 1 | 1 | 50 | 13 | 679 | 325 | 1,004 | 0 | 0 | no | pass | 3,200 | 3.19× |
| 7 | VAT Number → Tax ID | 1 | 1 | 69 | 18 | 589 | 325 | 914 | 0 | 0 | no | pass | 2,800 | 3.06× |
| 8 | VIP status + highlight | 2 | 2 | 149 | 38 | 294 | 325 | 619 | 0 | 0 | no | pass | 3,900 | 6.30× |

The aggregate ratio over all eight estimates is **30,500 / 8,168 = 3.73×**. The conventional estimates are intentionally conservative: only the application-specific schema/model, authorization/service, UI/form/list, route/controller, and relevant tests normally inspected for the change. They exclude dependencies, generated code, seed data, and implementation output.

Case 4 is already satisfied by the baseline, so its safest response is an `assert` patch: one line of validation and zero AIR change. This distinguishes recognizing existing semantics from redundantly rewriting them.

Run `npm run context` to reproduce every size, diff, isolation check, and validation result.

## Semantic patch and diff examples

```airpatch
set rule customers.expire after=45d was_after=30d
set field customers.vat_number label="Tax ID" was_label="VAT Number"
```

Semantic diff reports:

```text
~ rule customers.expire.after: 30d -> 45d
~ field customers.vat_number.label: VAT Number -> Tax ID
```

The first changes one business threshold. The second changes display metadata without changing address `customers.vat_number` or persisted data key `vat_number`.

Strict `add`/`set` targets, `was_*` preconditions, complete-model validation, and no-result-on-failure provide deterministic conflict safety. Tests cover missing and duplicate targets, bad relationships, stale preconditions, and multi-line atomic failure.

## Scoped authorization result

An administrator sees all 12 customers. Principal `account_managers/am_01` sees exactly its four assigned customers and its own actor record, can update an assigned customer, and is rejected when updating another manager's customer or actor record. Filtering and enforcement occur in the runtime query/mutation layer. An unrelated authors/posts test proves the capability is generic.

## Relationship aggregate result

One declaration adds `active_customers` to each account manager as a computed read-only value. Counts are 3, 2, and 2 for the demo managers. The computation uses only source rows visible to the current principal and is not stored in seeds.

## Explain, discovery, and round trip

- `npm run air -- explain apps/customer-manager.air` describes managed resources, actor identity, access, lifecycle, expiry, and revenue entirely from AIR semantics.
- `npm run air -- diff old.air new.air` reports declaration/property changes rather than textual noise.
- `npm run air -- capabilities search "ownership permission"` returns access, actor, relationship, and their dependency closure without loading the full catalog.
- parse → serialize → parse produces an identical semantic snapshot, and a second serialization is byte-stable.

## Runtime changes

The pre-existing v2 runtime could not express record ownership, per-owner aggregates, or semantic row emphasis. `CAPABILITY_DECISIONS.md` documented the insufficiency and unrelated reuse before implementation.

Generic additions were:

- actor identity plus `role`, `self`, and `owner:<ref-path>` access terms;
- access-filtered query/get and record-aware edit/archive enforcement;
- grouped count/sum/average insights over validated relationships;
- validated field/value highlights mapped to semantic tones;
- strict patch operations, conflict preconditions, semantic snapshots/diffs, and explanations; and
- dependency-closed catalog discovery tooling.

The shared browser runtime is now **1,782 nonblank lines / 113,564 bytes**, versus the previously documented v2 baseline of 1,502 / 96,746: **+280 lines / +16,818 bytes**. Tooling, catalog, tests, and docs are outside that runtime count. The contacts test exposed the need for generic `owner:<ref-path>` access so child resources remain scoped without duplicated ownership fields; that change is reported rather than hidden. Once present, it is catalog-described and application AIs still need zero runtime-source tokens. The other seven modifications require no runtime change.

## Conventional implementation avoided

The runtime still avoids per-application pages, tables/mobile cards, forms, validators, routes, CRUD/query handlers, search/filter/sort/pagination logic, relation selectors, archive mechanics, authorization wiring, aggregate projection, responsive rules, accessibility mechanics, and standard states. A conservative current conventional equivalent is roughly **1,850 LOC / ~15,725 generated tokens** versus 26 AIR lines / ~325 tokens. This is directional, excludes data, and does not subtract the one-time shared runtime cost.

## Limitations and next risk

- A fresh model was not actually invoked, so patch correctness under real model variability remains unmeasured.
- Token counts use bytes/4, not a named model tokenizer.
- Authentication, server enforcement, tenancy, concurrency, migrations, durable scheduling, and automatic rollback generation are absent.
- Capability retrieval is deterministic lexical scoring, not semantic retrieval.
- Equality predicates and OR policies cover this experiment but not nested boolean policy logic.

At that checkpoint, the next highest risk was whether the semantic vocabulary would remain coherent across workflow-heavy applications. The following phase performs that experiment without expanding the frozen infrastructure scope.

---

# Workflow stress test: Expense Approval

## Outcome and capability delta

The baseline capabilities were application/resource/field/relationship modeling, actor and scoped access, `manage` inference, lifecycle, overview, elapsed-time rule, aggregate/grouped aggregate, highlight, local storage, and safe semantic patch/add/set/assert/diff/explain.

The genuinely new capabilities are named parameters; bounded conditions over paths, computed values, and parameters; process/state graphs; requested and automatic transitions; independent transition authority; separation of duty; approval cardinality/distinctness; required/optional evidence comments; runtime-owned history and internal events; conditional required/immutable invariants; deterministic review deadlines; monthly conditional aggregates; and generated workflow explanation/visualization. `CAPABILITY_DECISIONS.md` records the pre-implementation gap, rejected alternatives, token impact, runtime consequences, and at least two unrelated reuse cases for each group.

The result uses no Expense-specific declaration or runtime branch. The same primitives implement the 23-line Content Publishing proof.

## Representation and data measurements

Expense Approval is **57 application lines / 5,004 bytes / ~1,251 tokens**. Its seed is reported separately: **17 nonblank lines / 2,054 bytes / ~514 tokens / 11 records**. Tokens are `ceil(UTF-8 bytes / 4)`.

The minimal schema uses one `users` actor resource. Employee is the user referenced by an Expense, Manager is the user's self-reference, and FinanceUser is transition authority through `role:finance`. Separate Employee/Manager/FinanceUser profile tables duplicated identity and added joins without adding required semantics, so they were removed.

Declaration-level attribution gives the requested incremental growth view. This is not a claim that each bucket is an independently valid application: transition lines necessarily contain guard and authority properties. It is a non-overlapping attribution whose cumulative total equals the exact AIR file.

| Stage | Added lines | Added bytes | Added ~tokens | Cumulative lines | Cumulative bytes | Cumulative ~tokens |
|---|---:|---:|---:|---:|---:|---:|
| Base resources/schema/manage | 23 | 1,135 | 284 | 23 | 1,135 | 284 |
| Workflow (`process` + transitions) | 14 | 2,080 | 520 | 37 | 3,215 | 804 |
| Permissions (`actor` + access) | 3 | 219 | 55 | 40 | 3,434 | 859 |
| Temporal rules | 2 | 166 | 42 | 42 | 3,600 | 900 |
| Business/budget rules, aggregates, invariants | 15 | 1,404 | 351 | 57 | 5,004 | 1,251 |

AIR therefore grew mainly with business facts—13 requested/automatic edges are 13 declarations—but process-heavy applications are visibly less compressed than CRUD-heavy Customer Manager. A directional conventional inventory is **~3,000 application-specific LOC / ~25,500 generated tokens**, versus 57 AIR lines / ~1,251 tokens: ~98.1% fewer application lines and ~95.1% fewer representation tokens. This estimate excludes the one-time shared runtime and is not measured generated output.

## Ten independent patch tests

Fresh context is exactly the complete Expense AIR, dependency-closed relevant catalog subset, and request. Seed, runtime, UI, CSS, tests, other apps, and patches are excluded. Runtime source tokens and runtime changes are zero for every patch. No model was invoked; results measure deterministic expected-patch sufficiency, validation, isolation, and context size—not fresh-model accuracy.

The full catalog is **~2,516 tokens**, up from ~1,589 before workflows. Relevant context is application + selected catalog; total AI context adds the request.

| # | Change | AIR touched | Patch lines | Bytes | ~tokens | Catalog | Relevant context | Total AI context | Runtime source/change | Unrelated | Validation | Ratio |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---:|
| 1 | auto-approve below 750 | 1 | 1 | 58 | 15 | 1,162 | 2,413 | 2,427 | 0 / none | no | pass | 2.14× |
| 2 | finance above 4,000 | 1 | 1 | 71 | 18 | 495 | 1,746 | 1,757 | 0 / none | no | pass | 3.19× |
| 3 | revise within 14 days | 1 | 1 | 81 | 21 | 1,301 | 2,552 | 2,567 | 0 / none | no | pass | 2.65× |
| 4 | two distinct finance approvals above 10,000 | 2 | 2 | 290 | 73 | 1,105 | 2,356 | 2,375 | 0 / none | no | pass | 3.58× |
| 5 | above 20,000 routes directly to finance | 2 | 2 | 243 | 61 | 1,197 | 2,448 | 2,485 | 0 / none | no | pass | 3.62× |
| 6 | Regulatory legal review | 5 | 5 | 807 | 202 | 1,246 | 2,497 | 2,513 | 0 / none | no | pass | 3.26× |
| 7 | Paid completely immutable | 0 | 1 assertion | 50 | 13 | 837 | 2,088 | 2,098 | 0 / none | no | pass | 2.24× |
| 8 | rejection reason required | 0 | 2 assertions | 118 | 30 | 1,289 | 2,540 | 2,553 | 0 / none | no | pass | 1.88× |
| 9 | manager deadline 3bd → 2bd | 1 | 1 | 61 | 16 | 843 | 2,094 | 2,109 | 0 / none | no | pass | 2.04× |
| 10 | withdraw before approval | 1 | 1 | 182 | 46 | 1,445 | 2,696 | 2,714 | 0 / none | no | pass | 2.65× |

Cases 7 and 8 are already true: Paid records are fully business-field immutable, and both rejection edges require a reason. Their `assert` patches validate intent with zero semantic changes. Case 4 needs two lines because the existing single-approval edge must be bounded to `<=10000` and a guarded two-distinct-actor edge added above it. Case 6 is the largest honest change: a new state plus four transition changes/additions.

Relevant contexts are **1,746–2,696 tokens** and total contexts **1,757–2,714 tokens**. This misses the previous sub-2,000 ideal in nine of ten cases. The larger application and dependency closure—not runtime source—cause the growth. The measured patch-context compression ratio is **1.88×–3.62×**, materially weaker than the prior CRUD experiment but still positive under the stated conventional-context estimates.

Run `npm run workflow:context` to reproduce all sizes, semantic diffs, graph validation, expected-address isolation checks, and context ratios.

## Runtime and validation results

The shared browser runtime is now **2,434 nonblank lines / 155,251 bytes**, versus the documented pre-workflow baseline of 1,782 / 113,564: **+652 lines / +41,687 bytes**. This is substantial one-time complexity and should not be hidden.

Generic additions are bounded conditions/parameters; process graphs/transitions; authority/separation; approval cardinality/internal events; conditional invariants; temporal status; conditional/windowed aggregates; generic action/history UI; and Mermaid projection. Each is exercised by Expense Approval and an unrelated content, purchase, access, leave, invoice, or contract use case documented before implementation. Two implementation choices are **QUESTIONABLE**: record-local history is not tamper-evident or server-authoritative, and `bd` is a UTC Monday-Friday approximation rather than a regional holiday-aware business calendar. **DOMAIN-SPECIFIC: none.** Automated source scans also reject Expense/status/receipt/publishing names in runtime/UI files.

Static validation passes for the complete Expense and Content models. Negative tests cover unknown states/actors/paths, invalid cardinality, impossible same-path separation, duplicate transition semantics, contradictory simple numeric guards, unreachable states, non-terminal dead ends, and invalid durations. Runtime ambiguity/cycle checks cover data-dependent automatic routing that static validation cannot prove generally.

- **Separation of duty:** a principal who is both employee and manager/admin is denied self-approval below the UI.
- **Multi-approval:** the first finance approval retains `FinanceReview`; the same actor cannot approve twice; a second finance actor completes it.
- **Temporal:** seeded manager review derives a UTC-weekday due date and `EscalationRequired` after it, without changing `ManagerReview`.
- **Immutability:** Approved/PaymentPending/Paid records expose no editable business fields to their owner; the patch assertion confirms Paid is already complete.
- **Events/history:** created, submitted, automatic approval, reviewer decisions, comments, actor identity, timestamps, and incomplete/completed approval evidence are retained and returned.
- **Aggregate routing:** current-month approved/payment/paid spend grouped through `employee` participates in budget routing.
- **Round trip:** parse → serialize → parse preserves the semantic snapshot; subsequent serialization is byte-stable.

## Explain, diff, visualization, and reuse

`air explain apps/expense-approval.air` derives process states, guards, transition authority, separation, evidence cardinality, invariants, parameters, and deadlines from AIR. `air diff` reports threshold properties such as `Automatic approval limit: 500 -> 750`, not textual churn. `air workflow apps/expense-approval.air` emits deterministic Mermaid directly from compiled processes.

Content Publishing reuses `process`, guarded transitions, role/owner authority, separation of duty, history/events, and invariants for Draft → Editorial Review → conditional Legal Review → Published. Its behavioral test takes a Regulated article through author, editor, and legal actors. No new runtime behavior was added for this proof.

## Explicit answers

1. **Can AIR represent realistic multi-stage workflows compactly?** Yes for this bounded sequential workflow, at 57 lines/~1,251 tokens; less dramatically than CRUD.
2. **Did representation grow with business rather than implementation complexity?** Mostly. Each new edge/invariant/deadline is visible, while handlers, audit UI, forms, and graph code stay shared. Long transition lines show semantic density pressure.
3. **Which primitives were necessary?** State process, transition/action, bounded condition/parameter, transition authority/separation, approval evidence/history/event, invariant, and deadline. A monolithic `workflow` or Expense primitive was unnecessary.
4. **Are they reusable?** Yes; Content Publishing executes the same primitives, with further pre-implementation purchase/access/leave/invoice/contract examples.
5. **Can actor/state/relationship-dependent edges be enforced deterministically?** Yes, from compiled paths, current record/state, principal, history, aggregates, parameters, and clock.
6. **Can AIR express separation of duty generically?** Yes, with `separate=<actor-path>` enforced below the UI.
7. **Can multi-person approval stay small?** Yes for numeric distinct-actor cardinality: one guarded transition property set. Named groups, delegation, or parallel quorums remain untested.
8. **Are workflow changes still tiny patches?** Usually 1–2 lines; adding an entire Legal stage honestly costs five.
9. **Can a fresh AI reason without runtime source?** The context packs are sufficient for deterministic expected patches and use zero runtime tokens, but no fresh model was run, so actual model success is unknown.
10. **Did Expense behavior leak into runtime?** No domain-specific branches or vocabulary were found; tests enforce this.
11. **Is v2 ready for Rust convergence?** Close enough to design a shared conformance corpus, but not yet to blindly port. Conditions, history trust, approval semantics, deadline calendars, and error/snapshot formats should be frozen first.

## Known limitations and next risk

`bd` means Monday-Friday in UTC only; holidays, regional work weeks, cut-off hours, and user time zones are not modeled. History is append-only inside local runtime operations, not cryptographically tamper-evident or server-authoritative. There is no scheduler, external event delivery, side-effect retry, delegation, parallel/compensating process, durable concurrency, migration, or production identity layer. Condition parsing intentionally has no parentheses or arbitrary code, and static guard-overlap analysis is incomplete.

The next highest risk is **cross-implementation semantic drift**. Before adding infrastructure or more syntax, create one language/conformance specification and fixtures shared by JavaScript and Rust, then decide whether AIR v2 semantics are stable enough to port. Fresh-model patch trials should also replace the current expected-patch-only context experiment.
