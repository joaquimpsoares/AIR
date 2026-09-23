# Introduction to AIR

> **AIR is an AI-first, declarative application language, semantic compiler, and runtime.**

---

## 💡 The Core Idea

When building database-backed business applications, developers and AI coding agents repeatedly produce thousands of lines of boilerplate:
- HTML form inputs and field validation bindings
- Sortable, filterable, paginated data tables
- Responsive mobile card views and drawer/sheet dialogs
- State machine transition guards and separation of duty
- Exact currency conversion and calculation
- Notification edge triggers and unread counter badges
- Keyboard accessibility, ARIA attributes, and focus traps

**AIR solves this by making application scaffolding a compiler-native responsibility.**

Instead of generating repetitive plumbing, you (or an AI assistant) declare **pure business intent** in a compact, readable `.air` file. The AIR compiler and runtime turn that declaration into a functioning, accessible web application.

---

## 🤖 Built for AI. Usable by Humans.

AIR is **AI-FIRST**, but **NOT AI-ONLY**.

```
  HUMAN AUTHORING                     AI CODING AGENTS
+-------------------+               +-------------------+
|  Write / Edit AIR |               | Generate / Edit   |
|  in plain text    |               | compact AIR diffs |
+---------+---------+               +---------+---------+
          |                                   |
          +-----------------+-----------------+
                            |
                            v
                   +-----------------+
                   |    app.air      |  <-- Compact, version-controlled text
                   +--------+--------+
                            |
                            v
                   +-----------------+
                   |  AIR Compiler   |  <-- Static validation & IR generation
                   +--------+--------+
                            |
                            v
                   +-----------------+
                   |   AIR Runtime   |  <-- Zero LLM required at execution
                   +--------+--------+
                            |
                            v
                   +-----------------+
                   | Live Application|
                   +-----------------+
```

### Why AI-First?
- **Extreme Token Compression**: Typical applications compress from 6,000+ conventional lines/tokens down to 50–150 tokens (**up to 49.2x compression**).
- **Reduced Hallucinations**: AI models declare business rules; the compiler ensures type correctness, valid references, and deterministic layouts.
- **Reviewability**: Changes appear as 5–20 line semantic diffs rather than massive multi-file code reviews.

### Why Usable by Humans?
- **Plain Text**: AIR is clean declarative syntax with zero proprietary lock-in.
- **Git Native**: `.air` files are committed, branched, diffed, and versioned just like any source code.
- **No AI Required at Runtime**: The AIR compiler and runtime are standard JavaScript/TypeScript and Rust modules. No LLM or cloud API is needed to run or use an AIR app.

---

## 🚀 Next Steps
- **[Installation & Requirements](installation.md)**
- **[Your First Application](first-application.md)**
