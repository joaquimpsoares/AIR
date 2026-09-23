# AIR Language Specification

Complete grammar and syntax reference for AIR v2.

---

## 📜 Grammar Overview

AIR is a line-oriented declarative domain-specific language (DSL). Each line defines an architectural declaration with key-value properties.

---

## 1. Specification & Application Identity

```air
air version=2
app <id> title="<Title>" subtitle="<Subtitle>" initial=<screen_id> [timezone="<IANA_TZ>"]
```

- `version=2`: Declares the AIR specification version.
- `app`: Configures application identity, title, subtitle, initial screen, and timezone (default: `UTC`).

---

## 2. Visual Theme & Aesthetics

```air
theme mode=light|dark|system accent=<accent_name> [density=comfortable|compact]
```

### Supported Modes:
- `light`: Renders light canvas and high-contrast surfaces.
- `dark`: Renders dark canvas and elevated dark surfaces.
- `system`: Follows the user's OS color scheme preference.

### 17 Central Accents:
AIR includes 17 calibrated accent palettes with full CSS tokens (`--accent`, `--accent-hover`, `--accent-soft`, `--accent-ink` and dark mode contrast overrides):
- `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`
- `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`
- `fuchsia`, `pink`, `rose`

### Density:
- `comfortable`: Standard spacious rhythm for desktop and mobile touch targets.
- `compact`: Dense information density for data-heavy operations.

---

## 3. Capabilities

```air
capability storage.local | storage.postgres | auth.rbac | notification.edge
```

Declares backend capabilities required by the application runtime.

---

## 4. Resources & Field Types

```air
resource <id> label=<field_id> [singular="<Name>"] [plural="<Name>"] [icon=<icon_name>]
field <resource>.<field_id> <type> [required] [unique] [min=N] [max=N] [default=<val>] [long] [currency=<CUR>] [unit=<UNIT>] [computed="<expr>"] [ref=<target_resource>] [values=<enum_list>]
```

### Supported Field Types:
| Type | Description | Example |
| :--- | :--- | :--- |
| `text` | Single-line or multi-line (`long`) string | `field users.bio text long` |
| `email` | Email address with validation and formatting | `field users.email email required unique` |
| `phone` | Phone number with validation | `field customers.phone phone` |
| `enum` | Discrete enumerated values | `field orders.status enum values=Pending,Paid,Shipped` |
| `date` | ISO 8601 calendar date (`YYYY-MM-DD`) | `field bookings.start_date date default=today` |
| `datetime` | Timestamp with timezone awareness | `field events.created_at datetime` |
| `number` | Floating-point numeric quantity | `field items.weight number min=0` |
| `integer` | Exact integer quantity | `field inventory.stock integer default=0 min=0` |
| `money` | Exact minor-unit currency (zero float drift) | `field expenses.amount money currency=USD min=0` |
| `rate` | Currency per time-unit rate | `field rooms.hourly_rate rate currency=USD unit=h` |
| `interval` | Temporal start/end interval | `field bookings.period interval start=start_at end=end_at` |
| `duration` | Time duration quantity | `field tasks.est duration unit=h` |
| `bool` | Boolean toggle | `field settings.active bool default=true` |
| `ref` | Foreign key reference to target resource | `field reservations.customer ref=customers required` |

---

## 5. Management, Access & Lifecycles

```air
manage <resource> lifecycle=archive|delete [page_size=N]
access <resource> view=<policy> create=<policy> edit=<policy> delete=<policy> [archive=<policy>]
```

- `lifecycle=archive`: Soft-delete/archiving preserving referential integrity.
- `lifecycle=delete`: Permanent deletion.
- Policies: `role:admin`, `role:user`, `owner:creator`, or combined `role:admin|role:manager`.

---

## 6. Workflows & State Machines

```air
process <resource> state=<field_id> initial=<State> terminal=<State1,State2> [history] [touch=<field_id>]
transition <resource>.<name> from=<State> to=<State> action=<verb> by=<policy> [when="<guard>"] [separate=<actor_field>] [comment=required|optional] [event=<event_name>] [approvals=N] [distinct=true]
```

- `separate=<field>`: Enforces separation of duty (e.g. `separate=employee` prevents self-approval).
- `approvals=N distinct=true`: Multi-person consensus approval.
- `comment=required`: Prompts and enforces mandatory rejection/audit reason.

---

## 7. Invariants & Conflict Prevention

```air
invariant <resource>.<name> none=<target_resource> scope=<field> overlaps=<interval_field> where="<cond>" deny="<error_message>"
invariant <resource>.<name> when="<condition>" deny="<error_message>"
```

- Temporal non-overlap invariants enforce zero double-booking across resources.
- State-dependent validation invariants prevent invalid data modifications.

---

## 8. Notifications & Alerts

```air
notify <resource>.<name> on=<event> when="<cond>" tone=warning|danger|success|neutral title="<Title>" body="<Body>" to=<policy> [action=<verb>]
```

Triggers in-app Notification Center badges, notifications, and workflow actions on semantic state transitions or threshold conditions.

---

## 9. Insights & Overview

```air
overview [title="<Dashboard Title>"]
insight <resource>.<name> op=count|sum|avg|min|max field=<field> label="<Label>" [format=currency|number] [tone=positive|warning|danger|neutral] [where="<cond>"]
```

Automatically generates analytical dashboards, metrics grids, and data visualization trends.
