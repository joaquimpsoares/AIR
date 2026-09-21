# AIR v2 semantic specification

Status: authoritative for AIR language version 2. Implementations conform to
this document and the `conformance/` corpus, not to another implementation's
private object layout.

## 1. Layers and determinism

AIR has four deliberately separate artifacts:

1. `*.air` is compact application-intent source.
2. AIR Semantic IR is the versioned, canonical compiler contract.
3. `*.airb` is validated runtime bytecode.
4. `*.wasm` may package a runtime plus one AIR bytecode program.

Seed/storage records are data and are never application representation. A host
renderer is implementation, not application intent.

Compilation is the ordered pipeline parse → declaration validation → reference
resolution → type checking → graph validation → inference → canonical IR.
Given the same valid source and compiler semantic version, canonical IR bytes
MUST be identical. Given the same IR, initial data, principal, clock, and input
sequence, execution results MUST be semantically identical.

## 2. Lexical and declaration syntax

Source is UTF-8 and line-oriented. CRLF and LF are equivalent. Blank lines and
text from an unquoted `#` to end of line are ignored. Tokens are separated by
Unicode whitespace outside double quotes. Double-quoted tokens support only
`\n`, `\r`, `\t`, `\"`, and `\\`. Quotes are removed by tokenization.

A declaration is:

```text
kind [id] [positional-field-type] [property | key=value]...
```

Kinds with IDs are `app capability resource actor field manage access insight
rule highlight parameter process transition invariant deadline extension`.
`air theme overview` are singleton kinds without IDs. IDs match
`[a-z][a-z0-9_.-]*`; owned declarations use exactly `owner.local_id`.
Properties match `[a-z][a-z0-9_]*`, may appear once, and must be allowlisted for
the declaration. A bare property has boolean value `true`. Empty property
values are invalid. Declaration order is retained because resource, field, and
tool projection order is observable semantic presentation information.

Unknown syntax fails in phase `parse`. Unknown properties fail in `validate`.
Unsupported versions fail in `validate`. Source locations are one-based lines.

## 3. Scalar types and values

Stored field types are `text`, `email`, `phone`, `enum`, `date`, `ref`,
`number`, `money`, and `bool`.

- `text`, `email`, and `phone` are strings. Email validation uses the v2
  bounded address shape; phone has no locale-specific validation.
- `enum` is a string restricted to its declared, ordered `values`.
- `date` is a valid-shape ISO calendar date `YYYY-MM-DD`, interpreted in UTC.
- `ref` is a string record ID in the named resource. It is single-valued.
- `number` and `money` are finite JSON numbers. Money requires a three-letter
  uppercase currency. AIR v2 performs arithmetic on decimal-looking finite
  host numbers; it does not promise arbitrary-precision accounting arithmetic.
- `bool` is a JSON boolean.

Blank means missing, `null`, or an empty/whitespace-only string at an input
boundary. Required fields reject blank. Inputs are normalized by type before
validation. `default=today` uses the injected clock's UTC date. Other defaults
are parsed as the field type. Computed fields are read-only and not stored.
Unique string comparison is case-insensitive within active and archived rows.

There is no general implicit coercion in conditions or runtime semantics.
Boundary normalization of declared input/default types is not condition
coercion.

## 4. Declarations

Every property below is also its canonical-IR property unless an inference is
described. Omitted values are replaced by the stated defaults before IR is
created. Invalid references fail in phase `resolve`; incompatible types fail in
`type`; other semantic constraints fail in `validate` or `process`.

### 4.1 Application, theme, and capabilities

```air
air version=2
app <id> title=<title-case-id> subtitle="" initial=<first-page>
theme mode=system accent=violet density=comfortable
capability storage.local
```

Exactly one `air` and one `app` are required; `theme` is optional and singleton.
Mode is `light|dark|system`, accent is `violet|blue|emerald|rose|amber`, and
density is `compact|comfortable`. Capabilities are unique host authorities.
AIR v2 defines `storage.local`; `extension.load.<id>` is reserved for the
corresponding declared extension. Undeclared authority is denied.

### 4.2 Resources, fields, and actors

```air
resource <id> singular=<inferred> plural=<inferred> icon=collection label=<field>
field <resource>.<id> <type> [required] [unique] [values=A,B]
      [ref=<resource>] [default=<scalar|today>] [min=0]
      [placeholder=""] [long] [currency=USD]
actor <resource>
```

A resource needs at least one field. `label` defaults to the first non-long text
field, then first email, then first field. `values` is required and exclusive to
enum; `ref` is required and exclusive to ref; `currency` is required and
exclusive to money; `long` is exclusive to text. `min` is a non-negative text
length constraint. Actor is a marker on an existing resource; it does not
authenticate a principal or add roles.

### 4.3 Management, access, and identity

```air
manage <resource> create=true edit=true delete=true lifecycle=delete [page_size=N]
access <resource> [view=<policy>] [create=<policy>] [edit=<policy>]
       [delete=<policy>] [archive=<policy>]
```

At least one resource must be managed. `manage` requests list, detail, create,
edit, delete/archive, forms, validation, query, search, filters, sorting,
pagination, responsive/accessibility behavior, and loading/error/empty states.
Management action values are `true`, `false`, or a role ID. `lifecycle` is
`delete|archive`; archive is a reversible storage marker excluded from normal
queries. Hard delete fails while an active record references the target.

An access policy is `true`, `false`, or `term(|term)*`. Terms are:

- `role:<id>`: current principal contains the role;
- `self`: target is a record in this actor resource and its ID equals the
  principal ID;
- `owner:<path>`: the scalar reference path resolves to the current principal's
  actor resource and ID.

All terms are OR alternatives; there is no implicit admin bypass. Paths contain
dot-separated ref fields, may traverse any number of scalar refs, and must end
at an actor resource. A blank link, dangling record, actor-resource mismatch, or
missing principal identity does not match. Multiple results cannot occur in v2.
For create, owner policy verifies the final actor type and the normalized new
record value. Invalid paths are compile errors. Read filtering and mutation
authorization use the same policy.

Defaults are view `true`; create/edit/delete from `manage`; archive from
`manage.delete`. Explicit access properties override those defaults.

### 4.4 Inferred management presentation

Inference depends on schema and declaration order, never current data:

1. search fields are text/email/phone;
2. filters are enum/ref/bool;
3. sort choices are label, dates descending, then enums and numeric fields;
4. up to six columns are label, email/ref, enum, numeric, date, then remaining
   short scalar fields;
5. page size is explicit, else 12 compact or 8 comfortable.

An `overview [title=Overview]` precedes collection pages and derives up to four
schema-driven metrics plus recent lists. Explicit insights are then appended.
App `initial` defaults to the first inferred page and must name a page.

### 4.5 Parameters and conditions

```air
parameter <resource>.<id> value=<number|bool|string> [label=<inferred>]
```

Parameter values are typed by lexical form: finite decimal number, exact
`true|false`, otherwise string. Parameters are scoped to one resource and are
referenced as `@id` only from that resource's conditions.

The condition grammar is:

```ebnf
condition   = "true" | "false" | alternative, { "|", alternative } ;
alternative = comparison, { "&", comparison } ;
comparison  = operand, ("=="|"!="|">"|">="|"<"|"<="), operand ;
operand     = term, { "+", term } ;
term        = "@", id | finite-number | "true" | "false" |
              field-path | unquoted-string-on-right ;
```

There is no whitespace inside a condition token, no parentheses, unary
operators, subtraction, calls, or arbitrary code. `+` binds tighter than a
comparison, comparisons bind tighter than `&`, and `&` binds tighter than `|`.
Operators are not associative across their grammar level. Legacy single
`field:value` normalizes to `field==value`.

Field paths begin at the condition's resource. Every non-final segment must be
a ref; final segments may be stored or inferred aggregate fields. Invalid paths
and parameters are compile errors.

Addition accepts only number/money terms. Number may combine with money;
different money currencies may not combine. Its result is money if any term is
money, otherwise number. Relational comparison accepts compatible numeric
operands or dates. Equality accepts identical types, compatible numeric types,
or a string literal checked against a string-like/enum/date/ref operand. Enum
literals must be members; date literals must have date shape. Other mismatches
fail at compile time. There is no string-to-number, boolean-to-string, or empty
string coercion.

A path that is valid statically but missing at execution produces the internal
`missing` value. Every comparison involving missing, including `!=`, is false.
AND and OR short-circuit left-to-right, but condition results cannot depend on
side effects. Simple contradictory numeric bounds within one conjunction are a
compile error. General guard satisfiability is not claimed.

### 4.6 Insights, aggregates, highlights, and elapsed rules

```air
insight <resource>.<id> op=count|sum|average [field=<numeric>]
        [where=<condition>] [group=<enum|ref|bool>] [label=...] [tone=...]
insight <owner>.<id> op=... source=<resource> group=<ref-to-owner>
        [field=<numeric>] [where=<condition>] [window=month date=<date>]
highlight <resource>.<id> when=<field:value> tone=accent
rule <resource>.<id> field=<field> from=<value> to=<value>
     after=<positive h|d> since=<date-field>
```

Count needs no field; sum/average require number or money. A grouped computed
insight's group must be a source ref to its owning resource and becomes a
read-only field on that owner. `window=month` uses the clock's UTC `YYYY-MM` and
requires a date field. Overview grouping supports enum/ref/bool. Aggregates
operate on non-archived, access-visible rows. Empty count/sum is zero; empty
average is zero in v2.

Highlights select the first declared matching field/value predicate and return
a semantic tone (`accent|positive|warning|danger|neutral`). They do not encode
CSS. Elapsed rules reconcile non-archived rows whose field still equals `from`
once the injected clock reaches `since + after`; they set `to` deterministically.
For enum fields `from` must exist and `to` is added to the enum domain during
compilation if absent.

### 4.7 Processes and transitions

```air
process <resource> state=<enum> initial=<value> [terminal=A,B]
        [history] [touch=<date>]
transition <resource>.<id> from=A[,B] to=C
        [action=<id> by=<policy>] [automatic]
        [when=<condition>] [comment=none|optional|required]
        [approvals=N] [distinct] [separate=<actor-path,...>]
        [event=<id>] [within=<h|d|bd> since=event:<id>]
        [unless_event=<id,...>]
```

The state field is enum and defaults to the process initial value. Terminal
states have no outgoing transitions. All states must be reachable from initial;
every non-terminal state needs an outgoing transition. Exact duplicate edge
semantics are invalid.

A requested transition requires action and non-system authority. An automatic
transition defaults to action=id and `by=system`; no other authority is allowed.
`when` defaults true, `comment` none, approvals 1, distinct false, event id.
Separation paths use actor-path resolution and deny when the principal equals
any resolved protected actor. Role possession never bypasses separation.

`approvals=N` counts evidence entries for this exact transition since the most
recent completed entry into the current state. Before N, state is unchanged and
an incomplete history entry is committed. `distinct` requires N≥2 and each
piece of evidence to have a different nonblank `(actor resource, actor id)`.
Order otherwise does not matter. A rejected edge changes state and therefore
ends the prior state epoch; evidence does not survive retry or re-entry.
Requested transitions that require identity fail if it is absent.

`within` requires `since=event:<id>` and checks the most recent matching history
event. `unless_event` denies if any named event exists in semantic history.

#### Atomic run to stability

A completed requested transition and all following automatic transitions are
one transaction:

1. authorize and validate requested-edge guard/evidence requirements;
2. create its history event and tentative destination;
3. validate the tentative record;
4. at the current state, evaluate all automatic outgoing guards;
5. zero matches is stable; one match is applied, recorded, and validated;
   more than one is `AIR_EXEC_AUTO_AMBIGUOUS`;
6. repeat until stable, while rejecting a repeated state/edge configuration as
   `AIR_EXEC_AUTO_CYCLE` and never exceeding `transition-count + 1` automatic
   steps;
7. commit record, history, and returned events only after stability.

Intermediate automatic states are not externally observable. Any authority,
condition, validation, ambiguity, or cycle failure rolls back the entire
completed chain. An incomplete multi-approval entry is its own successful
commit because no state chain has begun. Source declaration order never chooses
between multiple automatic matches.

### 4.8 History, invariants, deadlines, and time

With process `history`, the runtime owns an append-only application field of
entries containing stable entry ID, transition address, event, action, from,
to, actor resource/id/roles, injected-clock timestamp, comment, and completed
flag. Create emits a completed `resource.created` entry. Application input
cannot mutate history. AIR v2 semantic history is application evidence only:
it is not tamper-evident, cryptographically trusted, externally durable, or a
server-authoritative audit log.

```air
invariant <resource>.<id> when=<condition> [require=a,b] [immutable=a,b|*]
deadline <resource>.<id> state=<state> after=<h|d|bd>
         escalation=none|required
```

At least one invariant effect is required. `require` is checked on create,
ordinary edit, requested destination, and every automatic destination.
`immutable` compares an ordinary edit against the existing record when its
existing-state condition is true. `*` means all stored business fields except
the process state/touch fields. Process state may only change through a
transition. Transition machinery may change state and touch despite ordinary
immutability, but it may not bypass required validation.

The clock is a host dependency and MUST be injectable. History timestamps are
UTC ISO timestamps; field defaults/touch use the UTC calendar date. `h` is
elapsed 3,600,000 ms, `d` is elapsed 86,400,000 ms, and `bd` advances one UTC
calendar day at a time counting Monday-Friday, with no holidays or regional
calendar. Deadline start is the last completed entry into the current state,
else touch date, else `created`; missing start yields no due instant. A deadline
projects `OnTime`, `Overdue`, or `EscalationRequired`; it never changes process
state. Equality with the due instant is on time; strictly later is overdue.

### 4.9 Extensions

`extension <id> module=<host-name> [slot=page]` compiles only with the matching
`extension.load.<id>` capability and an explicit host allowlist entry. AIR does
not execute arbitrary source or embed host-language code.

## 5. Canonical AIR Semantic IR

The JSON document has `schema:"air.semantic-ir"` and `version:2`. It contains
fully defaulted app/theme, sorted capabilities, resources in semantic source
order, fields in source/inference order, typed canonical policies and condition
ASTs, management experience inference, parameters, elapsed rules, processes,
overview projection, and extensions. Maps never appear in serialized IR.

Canonical rules:

- JSON is UTF-8, no insignificant whitespace, one trailing newline only in CLI
  text output;
- object keys use the schema order emitted by `canonicalJson`; consumers compare
  parsed structure and MUST NOT attach meaning to JSON key order;
- unordered sets (capabilities, roles/policy alternatives, terminal states,
  required/immutable sets, separation paths, unless-events) are de-duplicated
  and lexically sorted;
- enum values and resource/field order remain declared because they affect
  display/sort inference;
- references are stable string addresses; resolved paths are arrays of typed
  steps; conditions contain typed terms and normalized operators, never raw
  executable source;
- defaults and inferred semantics are explicit; source line numbers, prose
  messages, Map/Set classes, functions, and host objects are absent.

Source declarations and locations may be retained in a separate compiler debug
table for diff/explain tools. They are not runtime semantics and do not affect
canonical equality.

## 6. Errors and failure behavior

Every compiler/runtime error exposes:

```json
{"code":"AIR_REF_UNKNOWN_RESOURCE","phase":"resolve",
 "location":{"line":7,"column":null},"path":"field.orders.customer",
 "message":"safe human-readable text"}
```

Conformance asserts `code`, `phase`, and semantic `path`/location, not message
prose. Phases are `parse`, `validate`, `resolve`, `type`, `process`, `data`,
`execute`, and `bytecode`. Unknown input fails closed. Compilation and patching
are atomic. Runtime mutations use prepare/validate/authorize/stabilize/commit;
errors do not partially mutate data or history.

The stable code registry used by v2 fixtures includes:

| Code | Meaning |
|---|---|
| `AIR_PARSE_UNKNOWN_DECLARATION` | Unknown source declaration. |
| `AIR_PARSE_UNTERMINATED_STRING` | Unterminated quoted token. |
| `AIR_VALIDATE_UNKNOWN_PROPERTY` | Property not allowed for construct. |
| `AIR_VALIDATE_DUPLICATE_ID` | Duplicate natural semantic address. |
| `AIR_REF_UNKNOWN_RESOURCE` | Required resource reference is absent. |
| `AIR_REF_UNKNOWN_FIELD` | Field/path reference is absent. |
| `AIR_REF_INVALID_ACTOR_PATH` | Ownership/separation path is invalid. |
| `AIR_REF_UNKNOWN_PARAMETER` | Parameter reference is absent. |
| `AIR_TYPE_CONDITION_MISMATCH` | Condition operands are incompatible. |
| `AIR_PARSE_CONDITION` | Condition does not match its bounded grammar. |
| `AIR_VALIDATE_DURATION` | Duration syntax/value is invalid. |
| `AIR_PROCESS_UNKNOWN_STATE` | Edge/deadline references no process state. |
| `AIR_PROCESS_UNREACHABLE_STATE` | Process state is unreachable. |
| `AIR_PROCESS_DUPLICATE_TRANSITION` | Two edges have identical semantics. |
| `AIR_PROCESS_CONTRADICTORY_GUARD` | Simple conjunction cannot be true. |
| `AIR_PROCESS_APPROVAL_CARDINALITY` | Approval configuration is invalid. |
| `AIR_PROCESS_IMPOSSIBLE_SEPARATION` | Authority and separation cannot coexist. |
| `AIR_PROCESS_STATIC_AUTO_CYCLE` | Unconditional automatic-only cycle is static. |
| `AIR_VALIDATE_INVARIANT` | Invariant has no valid effect/field. |
| `AIR_VALIDATE_AGGREGATE` | Aggregate source/group/field is invalid. |
| `AIR_EXEC_DENIED` | Principal is not authorized. |
| `AIR_EXEC_AUTO_AMBIGUOUS` | Multiple automatic edges match. |
| `AIR_EXEC_AUTO_CYCLE` | Automatic stabilization cannot terminate. |
| `AIR_BYTECODE_VERSION` | Magic/version is unsupported. |

Implementations may expose additional stable codes. A generic fallback is not
acceptable for a checked conformance case.

## 7. AIR bytecode v2

AIRB v2 is deterministic and contains no code. Its byte layout is:

```text
0..3   ASCII "AIR2"
4      format major = 2
5      format minor = 0
6..9   big-endian u32 payload byte length
10..   UTF-8 canonical AIR Semantic IR JSON (without trailing newline)
```

Decoders verify magic/version, exact length, UTF-8/JSON, IR schema/version, all
references/types/graphs, limits, and absence of trailing bytes before runtime
use. An AIR1 decoder may coexist for experimental compatibility, but AIR1 and
AIR2 programs are not interchangeable.

## 8. Non-semantics and current limits

AIR v2 does not define authentication, a trusted audit service, tenants,
database transactions, migrations, durable schedulers, regional calendars,
external side effects, connectors, secrets, resilience/security infrastructure,
parallel/compensating workflows, delegation, or a production web renderer.
Explain text and Mermaid layout are deterministic tools over IR, not extra
language meaning.
