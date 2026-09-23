# Temporal Intervals & Scheduling

Conflict detection, non-overlap invariants, and temporal intervals.

---

## 📅 Defining an Interval Field

Declare a bounded time window between two date fields:

```air
resource reservations label=title
field reservations.title text required
field reservations.resource ref=resources required
field reservations.start_at date required default=today
field reservations.end_at date required default=today
field reservations.booking_period interval start=start_at end=end_at
field reservations.status enum values=Requested,Confirmed,Cancelled required default=Requested
```

---

## 🚫 Non-Overlap Invariant

Prevent double-booking on physical or virtual resources:

```air
invariant reservations.no_overlap none=reservations scope=resource overlaps=booking_period where="status!=Cancelled" deny="Resource is already booked during this period"
```

### Invariant Breakdown:
- `none=reservations`: Ensures zero conflicting records exist.
- `scope=resource`: Scopes conflict checking to records with the same `resource` ID.
- `overlaps=booking_period`: Uses interval overlap algebra `[StartA, EndA] ∩ [StartB, EndB]`.
- `where="status!=Cancelled"`: Excludes cancelled reservations from blocking availability.
- Self-exclusion: When updating an existing reservation, the record itself is automatically excluded from conflict checking.
