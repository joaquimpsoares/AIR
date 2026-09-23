/**
 * Automated Documentation Integrity & Drift Protection Tests
 *
 * Verifies that:
 * 1. All complete .air code snippets in README.md and docs/ compile without errors.
 * 2. All documented CLI commands exist in tools/air-cli.mjs.
 * 3. All internal markdown cross-references resolve to existing files.
 * 4. All showcase modules exist and are well-formed.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseAir } from "../web/runtime/air.mjs";

const ROOT_DIR = path.resolve(".");
const DOCS_DIR = path.join(ROOT_DIR, "docs");

function getAllMarkdownFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

test("Documentation Integrity: All complete .air code snippets in README and docs parse cleanly", () => {
  const mdFiles = [path.join(ROOT_DIR, "README.md"), ...getAllMarkdownFiles(DOCS_DIR)];

  let totalSnippetsChecked = 0;

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, "utf8");
    const airCodeBlocks = content.match(/```air\n([\s\S]*?)```/g) || [];

    for (const block of airCodeBlocks) {
      const code = block.replace(/```air\n/, "").replace(/```$/, "").trim();

      // Only test standalone, complete code examples (skip snippets with ellipsis or partial demonstrations)
      const isCompleteApp = code.includes("air version=2") && code.includes("app ") && code.includes("resource ") && code.includes("manage ") && !code.includes("# ...");

      if (isCompleteApp) {
        try {
          const model = parseAir(code);
          assert.ok(model && model.app, `File ${path.relative(ROOT_DIR, file)} snippet should produce a valid model with app declaration`);
          totalSnippetsChecked++;
        } catch (err) {
          assert.fail(`File ${path.relative(ROOT_DIR, file)} failed to parse .air block: ${err.message}\n\nSnippet:\n${code}`);
        }
      }
    }
  }

  assert.ok(totalSnippetsChecked >= 4, `Expected at least 4 complete .air application snippets, found ${totalSnippetsChecked}`);
});

test("Documentation Integrity: All documented CLI subcommands are supported in tools/air-cli.mjs", () => {
  const cliPath = path.join(ROOT_DIR, "tools/air-cli.mjs");
  assert.ok(fs.existsSync(cliPath), "tools/air-cli.mjs must exist");
  const cliContent = fs.readFileSync(cliPath, "utf8");

  const documentedCommands = ["check", "explain", "workflow", "diff", "status"];

  for (const cmd of documentedCommands) {
    const regex = new RegExp(`case\\s+["']${cmd}["']|command\\s*===?\\s*["']${cmd}["']|cmd\\s*===?\\s*["']${cmd}["']`);
    assert.ok(
      regex.test(cliContent),
      `CLI subcommand '${cmd}' is documented in README/docs/reference/cli.md but not implemented in tools/air-cli.mjs`
    );
  }
});

test("Documentation Integrity: Internal markdown file links resolve to existing files", () => {
  const mdFiles = [path.join(ROOT_DIR, "README.md"), ...getAllMarkdownFiles(DOCS_DIR)];

  for (const file of mdFiles) {
    const content = fs.readFileSync(file, "utf8");
    const fileDir = path.dirname(file);

    // Match links like [Text](relative/path.md)
    const linkMatches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);

    for (const match of linkMatches) {
      const href = match[2].trim();

      // Skip external URLs, anchors, mailto
      if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#") || href.startsWith("mailto:")) {
        continue;
      }

      // Strip anchor hashes from file path
      const filePathWithoutHash = href.split("#")[0];
      if (!filePathWithoutHash) continue;

      const targetPath = path.resolve(fileDir, filePathWithoutHash);
      assert.ok(
        fs.existsSync(targetPath),
        `Broken link in ${path.relative(ROOT_DIR, file)}: '${href}' resolved to '${path.relative(ROOT_DIR, targetPath)}' which does not exist.`
      );
    }
  }
});

test("Documentation Integrity: Showcase modules have valid app.air and manifests", () => {
  const showcaseDir = path.join(ROOT_DIR, "showcase");
  const modules = ["customer-manager", "approval-workflow", "reservation-hub", "inventory-hub"];

  for (const mod of modules) {
    const modDir = path.join(showcaseDir, mod);
    assert.ok(fs.existsSync(modDir), `Showcase directory ${mod} must exist`);

    const appAir = path.join(modDir, "app.air");
    assert.ok(fs.existsSync(appAir), `Showcase ${mod}/app.air must exist`);

    const seedJson = path.join(modDir, "seed.json");
    assert.ok(fs.existsSync(seedJson), `Showcase ${mod}/seed.json must exist`);

    const exampleJson = path.join(modDir, "example.json");
    assert.ok(fs.existsSync(exampleJson), `Showcase ${mod}/example.json must exist`);

    const airCode = fs.readFileSync(appAir, "utf8");
    const model = parseAir(airCode);
    assert.ok(model && model.app, `Showcase ${mod}/app.air must produce valid model`);
  }
});
