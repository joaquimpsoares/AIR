# One-engine migration plan

AIR v2 now has two conforming semantic implementations. That is a verification
checkpoint, not the desired permanent architecture.

## Current duplication

Both `web/runtime/air.mjs` and `air-core::v2` currently implement source
tokenization, declaration validation, reference/path resolution, typed
conditions, policy resolution, schema inference, aggregate definitions, process
graph checks, automatic stabilization, approval/history rules, invariants, and
deadline time semantics. Keeping those in two places indefinitely would recreate
the drift this phase addresses.

The conformance corpus temporarily makes duplication measurable and safe. It is
not a substitute for one authoritative engine.

## Target boundary

```text
AIR source / AIR2
        |
        v
Rust air-core semantic engine
        |
        v
canonical semantic presentation/data/action protocol
        |
        v
JavaScript browser host
```

Rust should ultimately own parsing, validation, canonicalization, reference and
condition evaluation, authorization, data normalization, aggregates, lifecycle,
workflow execution, history, and time. The browser should own DOM rendering,
focus, responsive layout, accessibility integration, locale formatting, user
input collection, local-storage transport, clock/identity injection, and visual
design-system mapping.

## Safe sequence

1. Keep both engines behind the shared fixtures while the Rust ABI and semantic
   data/action protocol are still changing.
2. Use the Wasm `air_load`, `air_v2_start`, `air_v2_transition`, and
   `air_v2_status` path from an opt-in browser adapter. Compare results against
   the JS engine in development builds.
3. Move seed validation, queries/aggregates, CRUD/lifecycle, and semantic
   presentation projection behind the same Wasm boundary. Add corpus cases
   before moving each responsibility.
4. Make Rust/Wasm the default web semantic engine. Retain JS only as renderer,
   storage/identity/clock bridge, and temporary diagnostic fallback.
5. Remove JS parser/compiler/executor after all application and conformance tests
   run solely through Rust/Wasm. Keep JS diff/editor conveniences only if they
   consume canonical IR and contain no independent language rules.

Do not delete `air.mjs` during steps 1–3: the current browser still depends on
its CRUD/query projection and it is the independent oracle that made convergence
testable.
