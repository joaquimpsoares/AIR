# Notification Semantics & Center

Compiler-native edge-triggered notifications, deduplication, unread counters, and popover feeds.

---

## 🔔 Declaring Notification Rules

Notifications are declared at the schema level without custom webhook glue:

```air
notify inventory_balances.low_stock when="quantity_on_hand <= reorder_level" tone=warning title="Low Stock Warning" body="Product {product} is below reorder threshold" to=role:operator
```

### Notification Attributes:
- `when="..."`: Boolean expression defining the trigger condition.
- `tone`: Visual severity badge (`warning`, `danger`, `success`, `neutral`).
- `title`: Notification headline.
- `body`: Notification description with token substitution.
- `to`: Principal audience (`role:operator`, `role:manager`, etc.).

---

## ⚡ Edge-Triggering & Deduplication

AIR enforces **edge-triggered state transitions** ($False \to True$):
- A notification is emitted **only** when a record crosses from non-matching to matching condition.
- Consecutive mutations while remaining below threshold (e.g. `8 -> 7`) do **not** generate duplicate notifications.
- When the condition clears (e.g. `7 -> 15`), the state resets. A subsequent drop (`15 -> 9`) cleanly triggers a new notification.

---

## 🪟 Interactive Notification UI

- **Bell Icon**: Displays an unread badge counter in the application shell.
- **Desktop Popover**: Clicking the bell opens a floating feed of unread alerts with "Mark all read" and "Dismiss" controls.
- **Mobile Sheet**: On narrow viewports, notifications expand into a smooth bottom sheet.
- Clicking any notification automatically opens the corresponding record in the **Detail Drawer**.
