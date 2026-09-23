# Permissions & RBAC

Role-Based and Ownership-Based Access Control in AIR.

---

## 🛡️ The `access` Directive

The `access` declaration controls data visibility and mutation capabilities:

```air
access customers view=role:admin|role:user edit=role:admin|role:user
```

### Policy Expressions:
- `role:<name>`: User must have the specified role in their principal context (e.g. `role:admin`, `role:manager`, `role:operator`).
- `owner:<field>`: User ID must match the value in the specified foreign key field (e.g. `owner:submitter`, `owner:customer`).
- `self`: User ID must match the record's primary ID (used on user/actor resources).
- `|` (OR operator): Allows multiple authorized roles or ownership paths.

---

## 👥 Actor Identity Declaration

Declare which resource defines system actors:

```air
resource users label=name
field users.name text required
field users.email email required unique
field users.role enum values=employee,manager,finance required default=employee
actor users
```

When an actor resource is declared, the AIR runtime binds the authenticated principal ID and roles against records automatically.
