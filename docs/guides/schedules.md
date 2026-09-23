# Schedules & Calendars

Interactive calendar grids, daily agenda feeds, and timeline representations.

---

## 🗓️ Schedule View Mode

When a resource declares an `interval` field, AIR automatically enables the Schedule view mode:

```air
resource reservations label=title
field reservations.title text required
field reservations.resource ref=resources required
field reservations.start_at date required default=today
field reservations.end_at date required default=today
field reservations.booking_period interval start=start_at end=end_at
```

---

## 📱 Responsive Schedule Presentation

- **Desktop (Wide Viewport)**: Renders a multi-day timeline matrix grouped by resource. Bookings appear as interactive chips with status tones and computed quote values.
- **Mobile (Narrow Viewport)**: Automatically switches to an **Agenda Day View** with chronological cards and status indicators.

Clicking on any scheduled booking opens the record's **Detail Drawer** with full metadata and action buttons.
