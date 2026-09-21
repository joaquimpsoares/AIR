# AIR v2 intent model

The model separates facts an AI must state from mechanics a versioned runtime can derive.

## A. Must be explicitly expressed by AI

- application, resource, field, and relationship identity;
- semantic types and constraints that determine valid data;
- authenticated actor resource and record-scoped/role access policy;
- intent to manage a resource or show an overview;
- archive versus hard-delete lifecycle when the default is wrong;
- business transitions, including initial/terminal states, guarded edges, action authority, separation of duty, approval cardinality, and internal evidence names;
- conditional validation/immutability, independently changeable thresholds, and deadline/escalation policy;
- aggregate operation, grouping, predicate, and currency meaning;
- semantic emphasis such as highlighting VIP records; and
- requested runtime authority such as local persistence.

These are business facts. Inferring them from English names or sample data would be compact but unsafe.

## B. Deterministically inferred by runtime

- routes, navigation, lists/cards, detail, forms, and CRUD mechanics;
- inputs and validation from field types;
- search from textual types;
- filters from enums, references, and booleans;
- stable sorting, summary projection, pagination, and result counts;
- relationship selectors and labels;
- access-filtered queries and mutation checks from one policy model;
- read-only grouped aggregate values;
- archive metadata and active-record filtering;
- responsive behavior, accessibility, loading/error/empty/no-result states, confirmations, and notifications;
- eligible workflow actions, automatic stabilization, approval accumulation, immutable history projection, deadline status, and workflow visualization; and
- persistence transactions and referential checks.

## C. Runtime defaults, overridable as exceptions

- app/resource/field labels, singular/plural copy, label field, and icon;
- theme mode, accent, and density;
- page size;
- action availability and access policy;
- lifecycle (`delete` by default);
- overview title and insight label/tone;
- highlight tone; and
- transition event names, optional comments, and no-escalation deadline behavior where defaults are acceptable.

AIR intentionally has no table-column, form-layout, breakpoint, modal, component, route-handler, API-handler, or CSS declarations.

## Current Customer Manager intent

The 26-line application introduces two managed resources, actor identity, a required relationship, scoped access, archive lifecycle, a timed state transition, and revenue semantics:

```air
air version=2
app customer_manager title="Northstar CRM" subtitle="Customer relationships, without the busywork" initial=overview
theme mode=dark accent=violet
capability storage.local
resource account_managers label=name
field account_managers.name text required
field account_managers.email email required unique
actor account_managers
manage account_managers create=admin edit=admin delete=admin
access account_managers view=role:admin|self edit=role:admin|self
resource customers
field customers.name text required min=2
field customers.email email required unique
field customers.phone phone
field customers.company text
field customers.vat_number text label="VAT Number"
field customers.account_manager ref=account_managers required
field customers.status enum values=Active,Trial,Inactive default=Trial
field customers.joined date required default=today
field customers.notes text long
field customers.monthly_revenue money currency=USD default=0
manage customers lifecycle=archive
access customers view=role:admin|owner:account_manager edit=role:admin|owner:account_manager archive=role:admin|owner:account_manager
rule customers.expire field=status from=Trial to=Expired after=30d since=joined
overview
insight customers.monthly_revenue op=sum field=monthly_revenue label="Monthly revenue"
```

It does not state pages, tables, forms, routes, filters, CSS, navigation, or handlers.

## Versioned inference order

For each managed resource, v2 derives:

1. label field: explicit override, else first short text, email, or first field;
2. search: text, email, and phone fields;
3. filters: enum, reference, and boolean fields;
4. sort: label, date descending, enum, then numeric fields;
5. up to six summary columns: label, email/reference, enum, numeric/money, date, then remaining short fields;
6. create/edit form from stored fields and detail from stored plus computed fields;
7. page size: 8 comfortable or 12 compact unless overridden; and
8. action defaults, then explicit `access` overrides.

Given the same AIR, data, principal, clock, locale, runtime version, and event sequence, behavior is reproducible.

## Workflow inference boundary

AIR must express facts the runtime cannot infer safely: which state is initial/terminal, which edges exist, who may request them, guard thresholds, approval count/distinctness, separation-of-duty actor paths, conditional invariants, deadlines, and internal evidence names when referenced later. The runtime safely infers action controls, atomic state mutation, validation timing, history structure/rendering, aggregate evaluation, responsive workflow UI, deadline projection, and Mermaid graph layout.

Named parameters are used only for independently changeable business values. `manage` cannot infer a workflow because CRUD schema and sample data do not establish lawful process edges or authority.

## Information-growth result

The original one-resource application was 13 lines / ~120 tokens. Adding a second managed actor resource, relationship, scoped read/write policy, company/VAT, archive lifecycle, a rule, and revenue required 13 more lines, reaching 26 lines / ~325 tokens. The growth represents new business semantics, not duplicated interaction mechanics.
