# Computed Values & Exact Algebra

Declarative computed expressions, BigInt rational minor-unit money arithmetic, and typed rates.

---

## 💰 Exact Minor-Unit Money

AIR guarantees **zero binary float drift** (e.g. `0.1 + 0.2 != 0.30000000000000004`). All currency values are parsed into exact minor units (`$14.50` $\to$ `1450` cents) and computed using BigInt integer arithmetic and symmetric half-away-from-zero rounding.

```air
resource orders label=order_number
field orders.order_number text required unique
field orders.subtotal money currency=USD required default=0
field orders.discount money currency=USD required default=0
field orders.tax money currency=USD required default=0
field orders.total money currency=USD computed="subtotal - discount + tax"
```

---

## ⏱️ Rates & Temporal Arithmetic

AIR supports typed rates (`rate<Currency, Unit>`):

```air
resource resources label=name
field resources.name text required
field resources.hourly_rate rate currency=USD unit=h required default=50

resource reservations label=title
field reservations.title text required
field reservations.resource ref=resources required
field reservations.start_at date required default=today
field reservations.end_at date required default=today
field reservations.booking_period interval start=start_at end=end_at
field reservations.quote money currency=USD computed="booking_period.duration * resource.hourly_rate"
```

The runtime computes the exact duration between `start_at` and `end_at`, multiplies by the resource's `hourly_rate`, and outputs the exact minor-unit money quote.
