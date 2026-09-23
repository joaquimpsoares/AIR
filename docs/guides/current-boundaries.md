# Current Boundaries & Platform Limitations

An honest overview of what AIR v2 currently supports and what remains on the active roadmap.

---

## ✅ What AIR v2 Fully Supports (Frozen & Stable)

- **Exact Quantity & Minor-Unit Money Algebra**: BigInt rational minor units arithmetic, typed rates (`rate<USD, h>`), zero binary float drift.
- **Relational Collection Semantics**: Parent-child collections, child collection guards, cross-resource invariants, relational aggregation.
- **Temporal Intervals & Overlap Prevention**: Interval algebra, non-overlap invariants, scope isolation, self-exclusion on update.
- **Deterministic State Machines**: Process workflows, guarded transitions, separation of duty, role authority, immutable append-only audit history.
- **Compiler-Owned Responsive UI**: Automatic desktop tables to mobile cards, edit/detail drawers, action sheets, keyboard navigation, dark/light themes.
- **Edge-Triggered Notifications**: Low stock alerts, deduplication, unread badge counters, popovers, mobile sheets.
- **Local & PostgreSQL Storage Adapters**: Pluggable storage with transactional integrity.

---

## 🚧 Active Boundaries & Roadmap Gaps

1. **Multi-Resource Transaction Bundles**: In AIR v2, atomic mutations occur per-resource transaction. Multi-resource atomic batch operations across disparate tables are planned for a future release.
2. **Physical Quantity Units**: Scalar units (mass, volume, length with automatic metric/imperial conversion) are in design; v2 currently supports typed monetary rates (`rate<Currency, Unit>`) and durations (`duration<Unit>`).
3. **External Webhook / Email Delivery**: Notifications currently operate natively inside the application shell (unread badge + popover feed). External push/email delivery integrations are on the roadmap.
4. **Multi-File Split Modules**: An AIR v2 application is compiled from a single primary `.air` file. Modular imports across multiple `.air` files will be introduced in a future specification.
