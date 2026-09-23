# Resources & Fields

How to declare resources, scalar fields, foreign key references, and constraints in AIR.

---

## 🏛️ Resource Declaration

A resource defines a core business entity:

```air
resource customers label=name
```
- `label`: Specifies the primary identifier field displayed in breadcrumbs, table identities, and relationship selectors.

---

## 🏷️ Supported Field Types

| Type | Syntax | Description | Example |
| :--- | :--- | :--- | :--- |
| `text` | `field r.name text` | Standard single-line or multi-line text string | `field customers.name text required min=2` |
| `email` | `field r.email email` | Validated email address format with regex checking | `field customers.email email required unique` |
| `number` | `field r.age number` | Numeric scalar value (float or integer) | `field resources.capacity number default=4` |
| `integer` | `field r.qty integer` | Exact whole number scalar | `field inventory.quantity integer default=0` |
| `money` | `field r.price money` | Exact minor-unit currency (`USD`, `EUR`, etc.) | `field products.unit_price money currency=USD` |
| `rate` | `field r.cost rate` | Typed money rate (`rate<USD, h>`, `rate<USD, d>`) | `field resources.hourly_rate rate currency=USD unit=h` |
| `enum` | `field r.state enum` | Discrete set of allowed values | `field orders.status enum values=Pending,Shipped,Delivered` |
| `date` | `field r.created date` | ISO-8601 calendar date (`YYYY-MM-DD`) | `field orders.created_at date default=today` |
| `bool` | `field r.active bool` | Boolean truth value (`true` / `false`) | `field users.is_active bool default=true` |
| `interval` | `field r.period interval` | Temporal date interval with start/end bounds | `field bookings.window interval start=start_at end=end_at` |
| `ref` | `field r.target ref=other` | Foreign key reference to another resource | `field orders.customer ref=customers required` |

---

## 🔒 Field Constraints

- `required`: Field cannot be null or empty string.
- `unique`: Value must be unique across all non-archived records in the resource partition.
- `min=N`: Minimum character length for text, or minimum numeric value for numbers.
- `max=N`: Maximum character length or value.
- `default=value`: Default value used when creating a new record (`today`, `true`, `false`, literal, or enum choice).
- `long`: Instructs UI to render a multi-line textarea instead of a single-line input.
- `computed="..."`: Marks field as derived at runtime (not stored in persistent storage).
