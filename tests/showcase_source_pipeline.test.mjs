import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseAir } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { EXAMPLES, BUILTIN_EXAMPLES, setEditorSource } from "../web/showcase.mjs";

const root = process.cwd();

describe("AIR Showcase Source Pipeline & Single Source of Truth Architecture Suite", () => {
  it("1. Every canonical example in BUILTIN_EXAMPLES contains valid syntax and expected entity declarations", () => {
    const expectations = {
      "customer-manager": {
        entity: "customers",
        tokensPrefix: "air version=2",
        expectedKeywords: ["resource customers", "field customers.name", "field customers.email"]
      },
      "approval-workflow": {
        entity: "expenses",
        tokensPrefix: "air version=2",
        expectedKeywords: ["resource users", "resource expenses", "process expenses", "transition expenses.approve"]
      },
      "reservation-hub": {
        entity: "reservations",
        tokensPrefix: "air version=2",
        expectedKeywords: ["resource locations", "resource resources", "resource reservations", "interval start=start_at"]
      },
      "inventory-hub": {
        entity: "products",
        tokensPrefix: "air version=2",
        expectedKeywords: ["resource products", "resource warehouses", "resource orders", "notify orders.new_order"]
      }
    };

    for (const [exampleId, exp] of Object.entries(expectations)) {
      const builtin = BUILTIN_EXAMPLES[exampleId];
      assert.ok(builtin, `BUILTIN_EXAMPLES[${exampleId}] must be defined`);
      assert.ok(typeof builtin.air === "string" && builtin.air.length > 50, `${exampleId} air source must be non-empty`);
      assert.ok(builtin.air.startsWith(exp.tokensPrefix), `${exampleId} must start with ${exp.tokensPrefix}`);

      for (const kw of exp.expectedKeywords) {
        assert.ok(builtin.air.includes(kw), `${exampleId} source must contain '${kw}'`);
      }

      // Compile and verify model
      const model = parseAir(builtin.air);
      assert.ok(model.entities.has(exp.entity), `${exampleId} must parse entity ${exp.entity}`);
      const presentationIr = compilePresentation(model);
      assert.ok(presentationIr, `${exampleId} must compile presentation IR`);
    }
  });

  it("2. Static HTML contains clean empty textarea without hardcoded example code", async () => {
    const html = await readFile(join(root, "web/showcase.html"), "utf8");
    const m = html.match(/<textarea[^>]*id="air-code-editor"[^>]*>([\s\S]*?)<\/textarea>/);
    assert.ok(m, "#air-code-editor textarea must be present in HTML");
    const initialText = m[1].trim();
    assert.strictEqual(initialText, "", "HTML template textarea must be empty (clean single source of truth)");
  });

  it("3. CSS defines CSS grid for pane-source and full-height layout and visible typography for #air-code-editor", async () => {
    const css = await readFile(join(root, "web/showcase.css"), "utf8");
    assert.match(css, /\.pane-source\s*\{[^}]*display:\s*grid/);
    assert.match(css, /\.pane-source\s*\{[^}]*grid-template-rows:/);
    assert.match(css, /#air-code-editor\s*\{[^}]*color:\s*#f8fafc/);
    assert.match(css, /#air-code-editor\s*\{[^}]*background-color:\s*#0b0f19/);
    assert.match(css, /#air-code-editor\s*\{[^}]*display:\s*block/);
    assert.match(css, /#air-code-editor\s*\{[^}]*height:\s*100%/);
    // Absolute inset positioning should NOT be used
    assert.doesNotMatch(css, /#air-code-editor\s*\{[^}]*position:\s*absolute/);
  });
});
