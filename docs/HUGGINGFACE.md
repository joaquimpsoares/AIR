# Hugging Face Space: AIR Developer Showcase & Playground

This document provides the publishable content, metadata, and deployment instructions for hosting the **AIR Developer Showcase & Measured Benchmarks** on Hugging Face Spaces (using Static HTML / Node.js runtime).

---

## Space Configuration (`README.md` frontmatter)

```yaml
---
title: AIR Developer Showcase & Playground
emoji: 🚀
colorFrom: indigo
colorTo: purple
sdk: static
pinned: false
license: mit
---
```

---

## Primary Space Description

# AIR — AI-Native Application Scaffolding

AIR is a semantic compiler and runtime for the application scaffolding developers and AI agents repeatedly rebuild.

### Explore Interactive Demos:
- **Customer Manager**: 30-second introduction to AIR resources, validation, search, and responsive cards.
- **Approval Workflow**: Guarded state machine transitions, authority roles, separation of duty, and audit timelines.
- **Reservation Hub**: Temporal interval scheduling, zero-overlap conflict prevention, and exact money rates.
- **Inventory Hub**: Flagship multi-warehouse inventory balances, computed order totals, and edge-triggered low-stock notifications.

### Measured Compression:
- **49.2x source token compression** compared to conventional React 19 + TypeScript + Tailwind CSS reference stack.
- **10:1 application file reduction** with 100% compiler-owned UI and runtime state.

---

## Deployment / Publish Instructions

### Method A: Using `npm run export:hf` (Recommended)

1. Build the Hugging Face Space distribution:
   ```bash
   npm run export:hf
   ```
   This compiles and outputs the entire static showcase, documentation, benchmarks, and assets into `dist-hf/`.

2. Push directly to your Hugging Face Space:
   ```bash
   # Option 1: Copy into your cloned space repo
   git clone https://huggingface.co/spaces/<your-username>/air-showcase my-space
   cp -r dist-hf/* my-space/
   cd my-space
   git add .
   git commit -m "Deploy AIR Developer Showcase v1.0"
   git push

   # Option 2: Push dist-hf directly using git
   cd dist-hf
   git init
   git remote add origin https://huggingface.co/spaces/<your-username>/air-showcase
   git add .
   git commit -m "Deploy AIR Developer Showcase v1.0"
   git push -f origin main
   ```

---

### Method B: Git Subtree / Remote Push

Add your Hugging Face Space as a secondary git remote:
```bash
git remote add space https://huggingface.co/spaces/<your-username>/air-showcase
```
