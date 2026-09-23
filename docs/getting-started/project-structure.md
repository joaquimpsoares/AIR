# Project Directory Structure

This document describes how AIR applications should be structured.

---

## 📁 1. Minimal Application Project

The simplest valid AIR project consists of a single `.air` declaration file:

```
my-air-app/
├── app.air             # Canonical declarative application definition
└── seed.json           # (Optional) Initial database fixture
```

In AIR, the single `.air` file defines schema, validation, workflows, permissions, and layout. There is no requirement for separate routers, CSS files, or controller glue code.

---

## 📁 2. Recommended Production Project

For version-controlled team projects, the following structure is recommended:

```
my-air-app/
├── app.air             # Primary AIR application definition
├── seed.json           # Default seed fixtures for local development
├── schema.json         # (Optional) Exported Semantic IR AST
├── tests/
│   └── app.test.mjs    # End-to-end integration or semantic tests
├── .gitignore          # Standard Git ignore file
├── package.json        # Project scripts (validation, testing)
└── README.md           # Application documentation
```

### Typical `package.json` for an AIR Project:
```json
{
  "name": "my-air-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "check": "node path/to/air-cli.mjs check app.air",
    "explain": "node path/to/air-cli.mjs explain app.air",
    "test": "node --test tests/*.test.mjs"
  }
}
```

---

## 📁 3. Internal Repository Structure vs End-User Project

> [!IMPORTANT]
> When building your own AIR application, do **NOT** copy the internal directories of the AIR repository (such as `benchmarks/`, `conformance/`, `tools/`).

| Location | Scope | Description |
| :--- | :--- | :--- |
| `app.air` | **User Project** | The actual application you are building. |
| `seed.json` | **User Project** | Initial database records for the app. |
| `web/runtime/` | **AIR Engine** | Shared compiler and web runtime modules. |
| `showcase/` | **AIR Engine** | Reference applications for demonstration. |
| `benchmarks/` | **AIR Engine** | Token measurement against conventional implementations. |
| `tools/` | **AIR Engine** | CLI, tokenizer, dev server, and benchmark runner. |

---

## 🧩 4. Module & Split File Status

In AIR v2, an application definition is currently contained in **one main `.air` file**. The compiler enforces that all referenced entities, workflows, and insights are declared within that single compilation unit. Multi-file split module includes are planned for a future specification release.

---

## 🚀 Next Step
- **[Run & Edit Loop](run-and-edit.md)**
