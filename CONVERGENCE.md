# AIR v2 convergence report

## Outcome

AIR v2 now has an authoritative specification, canonical semantic IR, shared
conformance corpus, independent JavaScript and Rust compilers, deterministic
Rust execution, AIR2 bytecode, upgraded `airc`, and a Rust/Wasm Expense Approval
artifact. AIR1 remains available only for the earlier samples/tests.

## Frozen resolutions

- Conditions are typed at compile time and perform no execution-time coercion.
  Numeric addition is numeric only; money currencies must be compatible; enum
  literals are domain checked. Every comparison involving a valid-but-missing
  path is false, including `!=`.
- Requested transition plus automatic run-to-stability is one atomic chain.
  Zero automatic matches is stable, one applies, multiple matches fail, cycles
  fail, every destination is validated, and intermediate states never commit.
- Semantic history is record-local application evidence, not trusted audit.
- Time is injected; dates and timestamps are UTC. `bd` is Monday–Friday UTC
  without holidays.
- Approval evidence belongs to the current state epoch. Distinct approval needs
  nonblank actor-resource and actor-ID identity and does not survive re-entry.
- Ordinary edits obey conditional immutability; transition machinery may change
  process state/touch but never bypasses required validation.

These choices are specified in `spec/AIR-V2.md` and isolated in fixtures rather
than inferred from Expense Approval.

## Canonical and execution evidence

The shared corpus currently contains:

| Group | Count | Purpose |
|---|---:|---|
| valid | 11 | schema, ownership, conditions, processes, approvals, invariants, deadlines, aggregates |
| invalid | 19 | stable code/phase/location/path failures |
| canonical | 2 pairs | policy-order and condition-sugar equivalence |
| execution | 9 | stability, no-match, ambiguity, cycle, rollback, approvals, deadlines, and real Expense flows |

Both compilers match the same checked-in canonical output for every valid
fixture. A direct dual harness also compares parsed canonical structures for all
11 fixtures plus Customer Manager, Expense Approval, and Content Publishing.
The three complete applications are structurally identical between JavaScript
and Rust canonical IR.

Both runtimes match the same execution results for all nine execution cases.
The real Expense cases verify employee submission plus aggregate-dependent
automatic approval, manager relationship authority, and finance role authority.

## Rust and bytecode

`air-core::v2` is a specification-driven compiler/runtime separate from AIR1.
AIR2 uses `AIR2`, major/minor bytes, a big-endian payload length, and minified
canonical semantic-IR JSON. Decoding checks magic/version, exact length,
UTF-8/JSON, schema/version, resource/field uniqueness, and references before
use. It contains neither AIR source nor JavaScript/host code.

The Rust CLI supports:

```text
airc check APP.air
airc compile APP.air -o APP.airb
airc inspect APP.airb
airc explain APP.air
airc workflow APP.air
airc build-wasm APP.air -o APP.wasm
```

The Expense Wasm contains the Rust runtime plus one embedded `air.program`
AIR2 custom section. Its ABI can load the program, start with explicit seed,
principal, and clock, execute requested/automatic transitions, and project
deadline status. The browser renderer has not been ported.

## Deliberate implementation corrections

The specification review found ambiguous JS behavior and changed it explicitly:

1. condition evaluation formerly selected numeric comparison by calling
   `Number(...)` at runtime; conditions are now statically typed with no such
   coercion;
2. missing operands formerly became strings in some comparisons; all missing
   comparisons now fail closed;
3. unconditional automatic cycles are now rejected statically in addition to
   data-dependent runtime cycle detection;
4. errors now expose stable code, phase, location, path, and safe message; and
5. canonical IR now carries invariants independently of processes, because an
   invariant is valid on a non-workflow resource.

Existing application tests remain unchanged and green. The corrections do not
alter the three reference applications' intended behavior.

## Remaining boundary

The Rust semantic engine is sufficient for compiler, bytecode, workflow,
history, approval, deadline, and Wasm convergence. The current web app still
uses JavaScript for CRUD/query/storage and rendering. `MIGRATION.md` describes
the staged removal of duplicated semantics; deleting the JS engine now would
mix semantic convergence with a renderer/data-host rewrite.

## Measurements at this checkpoint

Application intent did not grow during convergence:

| Application | AIR lines | AIR bytes | Approx. tokens | Seed lines / bytes / approx. tokens |
|---|---:|---:|---:|---:|
| Customer Manager | 26 | 1,299 | 325 | 21 / 3,947 / 987 |
| Expense Approval | 57 | 5,004 | 1,251 | 17 / 2,054 / 514 |
| Content Publishing | 23 | 1,487 | 372 | 10 / 324 / 81 |

AIR2 sizes are 6,551 bytes, 26,611 bytes, and 8,248 bytes respectively. The
Expense Rust/Wasm package is 344,020 bytes and contains the 26,611-byte AIR2
program as its single `air.program` custom section. The Wasm smoke test verifies
magic/version, ABI v2, data/principal/clock initialization, explicit plus
automatic execution, and final state/events. Module inspection confirms that
the payload is AIR2 and does not contain the JS semantic runtime.

The reusable browser runtime is now 2,783 nonblank lines / 173,241 bytes across
`air.mjs`, `ui.mjs`, and CSS, versus the recorded pre-convergence workflow
checkpoint of 2,434 / 155,251: +349 lines / +17,990 bytes for typed errors,
conditions, canonical IR, and conformance-facing behavior. Rust v2 compiler/IR
and semantic runtime are 5,293 nonblank lines / 189,494 bytes; that is shared
language/runtime implementation, not application representation.

The previous conservative conventional inventories remain the appropriate
application-specific comparison: roughly 1,850 LOC for Customer Manager, 3,000
for Expense Approval, and 900 for Content Publishing, versus 26, 57, and 23 AIR
lines. AIR continues to avoid per-application pages/forms/tables, validators,
CRUD/query handlers, authorization wiring, workflow controllers, approval and
history UI, deadline logic, responsive rules, and accessibility mechanics. The
one-time compiler/runtime cost is reported separately rather than hidden in the
compression ratio.
