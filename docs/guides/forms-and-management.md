# Forms & Management

How AIR generates interactive CRUD screens, tables, search, filters, and drawer dialogs from a single `manage` declaration.

---

## 🛠️ The `manage` Directive

Adding a `manage` declaration to a resource automatically generates:
1. **Primary Collection Screen**: Tabular data grid on desktop, interactive cards on mobile.
2. **Global Search**: Substring filtering across all text fields.
3. **Filter Drawer**: Dropdown selectors for enum fields.
4. **Sort Controls**: Column headers and sort selector.
5. **Create / Edit Modals**: Form inputs with real-time validation.
6. **Detail Drawer**: Right-anchored sheet displaying complete record details, workflow graphs, and action buttons.

```air
manage customers lifecycle=archive
```

### Lifecycle Options:
- `lifecycle=archive`: Soft-delete model. Deleted records receive `_archived_at` and are excluded from active collections while remaining in audit storage.
- `lifecycle=delete`: Permanent deletion model.

---

## 🎨 Layout Recomposition

AIR automatically selects the best representation for your user's viewport:

| Artifact | Wide Desktop (> 1024px) | Narrow / Mobile (< 768px) |
| :--- | :--- | :--- |
| **Collection** | Multi-column sortable table | Compact feed of structured cards |
| **Detail View** | Standard right-anchored Drawer | Full-width slide-up Sheet |
| **Actions Menu** | Positioned dropdown popover | Bottom slide-up Action Sheet |
| **Filters** | Compact Drawer | Full-screen Sheet |

All layouts require **zero application CSS or media queries**.
