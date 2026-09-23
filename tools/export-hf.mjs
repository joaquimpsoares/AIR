/**
 * Hugging Face Space Exporter for AIR Showcase
 *
 * Generates a zero-config, static deployable Hugging Face Space in `dist-hf/`.
 */

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const rootDir = new URL("..", import.meta.url).pathname;
const distDir = join(rootDir, "dist-hf");

async function buildHfSpace() {
  console.log("🚀 Building Hugging Face Space distribution in dist-hf/ ...");

  if (existsSync(distDir)) {
    await rm(distDir, { recursive: true, force: true });
  }
  await mkdir(distDir, { recursive: true });

  // 1. Generate index.html from web/showcase.html with relative base
  const showcaseHtml = await readFile(join(rootDir, "web/showcase.html"), "utf8");
  const hfHtml = showcaseHtml.replace('<base href="/web/">', '<base href="./">');
  await writeFile(join(distDir, "index.html"), hfHtml, "utf8");

  // 2. Copy web assets
  await cp(join(rootDir, "web/showcase.css"), join(distDir, "showcase.css"));
  await cp(join(rootDir, "web/showcase.mjs"), join(distDir, "showcase.mjs"));
  await cp(join(rootDir, "web/runtime"), join(distDir, "runtime"), { recursive: true });

  // 3. Copy canonical data & benchmarks
  await cp(join(rootDir, "showcase"), join(distDir, "showcase"), { recursive: true });
  await cp(join(rootDir, "benchmarks"), join(distDir, "benchmarks"), { recursive: true });
  await cp(join(rootDir, "docs"), join(distDir, "docs"), { recursive: true });

  // 4. Generate official Hugging Face Space README.md with YAML metadata
  const hfReadme = `---
title: AIR Developer Showcase & Playground
emoji: 🚀
colorFrom: indigo
colorTo: purple
sdk: static
pinned: false
license: mit
---

# AIR — AI-Native Application Scaffolding

> **Designed for AI. Readable and writable by humans.**

AIR is a semantic compiler and runtime for the application scaffolding developers and AI coding agents repeatedly rebuild.

### 🎮 Interactive Live Showcase & Demos Included:
- **Customer Manager**: 30-second introduction to AIR resources, validation, search, and responsive cards.
- **Approval Workflow**: Guarded state transitions, role authority, separation of duty, and append-only audit trail.
- **Reservation Hub**: Temporal intervals, zero-overlap conflict prevention, and exact money rates.
- **Inventory Hub**: Multi-warehouse inventory balances, computed order totals, and edge-triggered low-stock notifications.
- **Blank Playground**: Clean-sheet interactive editor with instant live compilation.

### 📊 Measured Token Efficiency:
- **49.2x token compression** against conventional React + TypeScript stacks.
- **10:1 file reduction** with 100% compiler-owned UI rendering and runtime state.
`;

  await writeFile(join(distDir, "README.md"), hfReadme, "utf8");

  console.log("✅ Hugging Face Space bundle generated successfully in dist-hf/");
  console.log("\nTo publish to Hugging Face Spaces:");
  console.log("  1. git clone https://huggingface.co/spaces/<your-username>/<space-name> my-space");
  console.log("  2. cp -r dist-hf/* my-space/");
  console.log("  3. cd my-space && git add . && git commit -m 'Deploy AIR Showcase' && git push");
}

buildHfSpace().catch((err) => {
  console.error("❌ Failed to build Hugging Face distribution:", err);
  process.exit(1);
});
