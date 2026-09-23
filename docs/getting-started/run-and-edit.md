# Run & Edit Development Loop

This guide walks through the interactive development, validation, and editing workflow in AIR.

---

## 🔄 The Development Loop

```
  1. Edit app.air
        ↓
  2. Validate with CLI
     `node tools/air-cli.mjs check app.air`
        ↓
  3. Live Recompile & Run
     `npm run dev`
        ↓
  4. Test
     `npm test`
        ↓
  5. Version Control Diff
     `git diff app.air`
```

---

## ⚡ 1. Live Interactive Recompilation

When using the AIR Showcase / Explorer (`http://127.0.0.1:4173/examples`):
- Any keystroke inside the **AIR Source Code Editor** triggers a 250ms debounced live compilation.
- If a syntax or validation error occurs, line-accurate diagnostics appear in the compiler status bar immediately.
- When the compilation succeeds, the running application runtime re-renders while preserving state and subscriptions.

---

## 🛠️ 2. Editing Fields & Seeing Immediate UI Changes

### Example: Adding a New Field
Add a new `department` field to a resource:

```diff
  resource employees label=name
  field employees.name text required
+ field employees.department enum values=Engineering,Product,Design,Sales required default=Engineering
```

When saved or typed:
1. The **Table** automatically adds a "Department" column with color-coded enum badges.
2. The **Edit/Create Modal** automatically adds a dropdown selector.
3. The **Filter Drawer** automatically adds a "Department" filter.
4. The **Detail Sheet** displays the field with no manual HTML/CSS changes.

---

## 🔍 3. Semantic Diffing with the CLI

Before committing changes, view the high-level semantic diff:

```bash
node tools/air-cli.mjs diff old-app.air new-app.air
```

Example output:
```diff
+ field employees.department enum values=Engineering,Product,Design,Sales required default=Engineering
```

---

## 🧪 4. Running Verification Gates

Before submitting a pull request, run the full verification pipeline:

```bash
npm test
npm run benchmark:check
```

---

## 🚀 Next Step
- **[Writing AIR by Hand](../guides/writing-air-by-hand.md)**
