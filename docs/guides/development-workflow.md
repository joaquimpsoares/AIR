# Development Lifecycle & Version Control

How to manage, version-control, test, and deploy AIR applications.

---

## 🌲 Git Version Control

AIR applications are standard plain-text source files.

### Recommended Git Workflow:
```bash
# 1. Create a feature branch
git checkout -b feature/add-inventory-alerts

# 2. Modify app.air
# (Edit declarations with your editor or AI coding agent)

# 3. Validate semantic correctness
node tools/air-cli.mjs check app.air

# 4. Review semantic diff
node tools/air-cli.mjs diff origin/main:app.air app.air

# 5. Run tests
npm test

# 6. Commit and push
git add app.air
git commit -m "feat(inventory): add low stock notification rule"
git push origin feature/add-inventory-alerts
```

---

## 🔍 Semantic Diffing

Because AIR declarations are concise, reviewing pull requests takes seconds. Instead of scanning 10 files across frontend and backend, changes are visible in a single compact diff:

```diff
  resource products label=name
  field products.name text required
+ field products.reorder_level integer required default=10
+ notify products.low_stock when="quantity <= reorder_level" tone=warning title="Low Stock"
```
