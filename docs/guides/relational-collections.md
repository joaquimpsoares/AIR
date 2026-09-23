# Relational Collections & Invariants

How to declare parent-child collections, aggregate derived values, and enforce multi-resource invariants in AIR.

---

## 🔗 Parent-Child Collections

Declare one-to-many relationships by referencing parent resources:

```air
resource orders label=order_number
field orders.order_number text required unique
field orders.status enum values=Draft,Submitted,Fulfilled required default=Draft

resource line_items label=id
field line_items.order ref=orders required
field line_items.product text required
field line_items.quantity integer required default=1
field line_items.unit_price money currency=USD required default=0
field line_items.subtotal money currency=USD computed="quantity * unit_price"
```

---

## 🛡️ Child Collection Guards & Invariants

Prevent invalid state transitions based on related collections:

```air
invariant orders.require_items when="status==Submitted && count(line_items) == 0" deny="Orders cannot be submitted without at least one line item"
```

---

## 🚫 Cross-Resource Invariants

Enforce business truth across resources:

```air
invariant reservations.capacity when="attendees > resource.capacity" deny="Attendees cannot exceed resource capacity"
```

Invariants are verified by the runtime **before** any transaction is committed to storage. If an invariant fails, an `AirError` with reason description is returned and the mutation is rolled back.
