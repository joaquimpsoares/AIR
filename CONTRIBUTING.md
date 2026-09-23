# Contributing to AIR

Thank you for your interest in contributing to AIR!

AIR is an AI-first application scaffolding compiler, runtime, and interactive playground.

---

## 🛠️ Development Setup

1. **Prerequisites**: Node.js 20+ (Node 22 recommended) and npm.
2. **Clone and Install**:
   ```bash
   git clone https://github.com/joaquimpsoares/AIR.git
   cd AIR
   npm install
   ```
3. **Start the Local Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:4173/` or `http://localhost:4173/examples` in your browser.

---

## 🧪 Testing & Verification

Before submitting changes, ensure all tests and conformance benchmarks pass:

```bash
# Run unit and integration tests
npm test

# Run language conformance verification
npm run conformance

# Check for benchmark metric drift
npm run benchmark:check
```

---

## 📜 Coding Guidelines

- **Zero Handwritten CSS in Showcase Examples**: Showcase applications must rely entirely on AIR runtime layout compilation and CSS custom property tokens.
- **Deterministic Compilation**: The compiler must produce identical Semantic IR, Presentation IR, and Artifacts IR for identical inputs.
- **Preserve Documentation Integrity**: Complete `.air` snippets in documentation must be valid and pass syntax checking.
- **Accents & Themes**: All 17 central accents and theme modes (`light`, `dark`, `system`) must maintain high contrast and full token coverage.

---

## 📄 License

By contributing to AIR, you agree that your contributions will be licensed under the [MIT License](LICENSE).
