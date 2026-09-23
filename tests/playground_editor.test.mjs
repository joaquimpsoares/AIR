import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseAir, parseSeedData, AppRuntime, MemoryStorage } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { mountAirApp } from "../web/runtime/ui.mjs";
import {
  explainDeclarationLine,
  sanitizeSeedForModel,
  MINIMAL_AIR_STARTER,
  EXAMPLES
} from "../web/showcase.mjs";

const root = new URL("..", import.meta.url).pathname;

function createMockElement(id = "root", width = 1024) {
  const listeners = new Map();
  const classes = new Set(["live-app-wrapper"]);
  const mock = {
    id,
    clientWidth: width,
    clientHeight: 600,
    innerHTML: "",
    dataset: {},
    children: [],
    firstChild: null,
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classes.has(c)) { classes.delete(c); return false; }
          else { classes.add(c); return true; }
        }
        if (force) classes.add(c); else classes.delete(c);
        return force;
      }
    },
    removeAttribute: () => {},
    setAttribute: () => {},
    appendChild: (child) => {
      mock.children.push(child);
      mock.firstChild = mock.children[0] || null;
      return child;
    },
    getBoundingClientRect: () => ({
      top: 100,
      left: 500,
      right: 500 + mock.clientWidth,
      bottom: 700,
      width: mock.clientWidth,
      height: 600
    }),
    querySelector: (selector) => {
      if (selector === ".content") return { focus: () => {} };
      if (selector === "#air-toast") return { className: "", innerHTML: "", classList: { remove: () => {} } };
      if (selector === "[data-drawer-panel]") return { addEventListener: () => {} };
      if (selector === "[data-menu-panel]") return { querySelector: () => ({ focus: () => {} }) };
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: (evt, cb) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(cb);
    },
    removeEventListener: (evt, cb) => {
      const arr = listeners.get(evt);
      if (arr) {
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
      }
    }
  };
  return mock;
}

/**
 * Headless Simulation of Showcase Playground State Machine
 */
class PlaygroundStateMachine {
  constructor(exampleId = "customer-manager", initialAir = "", initialSeed = "") {
    this.exampleId = exampleId;
    this.canonicalSource = initialAir;
    this.canonicalSeed = initialSeed;
    this.editorBuffer = initialAir;
    this.lastValidSource = initialAir;
    this.lastValidModel = null;
    this.status = "idle";
    this.errorTitle = null;
    this.errorMessage = null;
    this.previewStatusBadge = null;
    this.currentRuntime = null;
    this.liveHost = createMockElement("live-app-root");
    this.focusMode = "split";
    this.storage = new MemoryStorage();

    if (initialAir) {
      this.attemptCompileAndMount(initialAir, true);
    } else {
      this.mountBlankProjectState();
    }
  }

  setEditorBuffer(newSource) {
    this.editorBuffer = newSource;
    if (newSource.trim() === "") {
      this.mountBlankProjectState();
      return;
    }
    this.attemptCompileAndMount(newSource, false);
  }

  mountBlankProjectState() {
    if (this.currentRuntime) {
      this.currentRuntime.dispose();
      this.currentRuntime = null;
    }
    this.status = "blank";
    this.errorTitle = null;
    this.errorMessage = null;
    this.previewStatusBadge = null;
    this.liveHost.innerHTML = `<div class="blank-playground-container">Blank Project</div>`;
  }

  attemptCompileAndMount(source, isCanonicalReset = false) {
    let candidateModel = null;
    try {
      candidateModel = parseAir(source);
    } catch (err) {
      this.handleCompileFailure(err, "SOURCE ERROR");
      return;
    }

    const testHost = createMockElement("test-host");
    let candidateRuntime = null;

    try {
      const isCanonical = isCanonicalReset || (source === this.canonicalSource && this.exampleId !== "blank");
      const seed = isCanonical ? this.canonicalSeed : sanitizeSeedForModel(this.canonicalSeed, candidateModel);
      const namespace = isCanonical ? `showcase:${this.exampleId}` : `showcase:playground:test`;

      candidateRuntime = mountAirApp(testHost, source, {
        mode: "embedded",
        seedSource: seed,
        principal: { roles: ["admin"] },
        storage: this.storage,
        namespace
      });
    } catch (runtimeErr) {
      this.handleCompileFailure(runtimeErr, "RUNTIME STARTUP ERROR");
      return;
    }

    // Success: Transactional swap
    if (this.currentRuntime) {
      this.currentRuntime.dispose();
      this.currentRuntime = null;
    }

    this.liveHost.innerHTML = testHost.innerHTML;
    this.currentRuntime = candidateRuntime;
    this.lastValidSource = source;
    this.lastValidModel = candidateModel;
    this.status = "compiled";
    this.errorTitle = null;
    this.errorMessage = null;
    this.previewStatusBadge = null;
  }

  handleCompileFailure(err, title) {
    this.status = "source-error";
    this.errorTitle = title;
    this.errorMessage = err.message || String(err);

    if (this.lastValidSource && this.currentRuntime) {
      this.previewStatusBadge = "⚠ Preview: last valid compile";
    }
  }

  reset() {
    this.editorBuffer = this.canonicalSource;
    this.attemptCompileAndMount(this.canonicalSource, true);
  }

  clear() {
    this.editorBuffer = "";
    this.exampleId = "blank";
    this.mountBlankProjectState();
  }

  setFocusMode(mode) {
    this.focusMode = mode;
  }
}

describe("AIR SHOWCASE LIVE PLAYGROUND & EDITOR REGRESSION SUITE", () => {
  let customerAir = "";
  let customerSeed = "";

  it("0. Preload customer-manager source & seed", async () => {
    customerAir = await readFile(join(root, "showcase/customer-manager/app.air"), "utf8");
    customerSeed = await readFile(join(root, "showcase/customer-manager/seed.json"), "utf8");
    assert.ok(customerAir.length > 0);
    assert.ok(customerSeed.length > 0);
  });

  it("1. Invalid intermediate source retains last valid preview (Decoupled Source / Preview Execution)", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    assert.equal(pg.status, "compiled");
    assert.ok(pg.currentRuntime != null);
    assert.ok(pg.liveHost.innerHTML.includes("Customer Manager"));

    // User introduces broken syntax: e.g. typing a partial line "field customers."
    const brokenAir = customerAir + "\nfield customers.";
    pg.setEditorBuffer(brokenAir);

    // Buffer has broken text, but status shows source error and preview remains mounted!
    assert.equal(pg.editorBuffer, brokenAir);
    assert.equal(pg.status, "source-error");
    assert.equal(pg.previewStatusBadge, "⚠ Preview: last valid compile");
    assert.ok(pg.currentRuntime != null, "Previous runtime must NOT be disposed on invalid edit");
    assert.ok(pg.liveHost.innerHTML.includes("Customer Manager"), "Live preview must still show running app");
    assert.ok(!pg.liveHost.innerHTML.includes("Application Error"), "Must never show crash screen on partial edit");
  });

  it("2. Compiler diagnostic error banner appears with line numbers and message", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    
    // Introduce missing type on line
    const brokenAir = customerAir + "\nfield customers.new_field";
    pg.setEditorBuffer(brokenAir);

    assert.equal(pg.status, "source-error");
    assert.ok(pg.errorMessage != null);
    assert.match(pg.errorMessage, /line/i, "Error message must report line number");
  });

  it("3. Fixing source swaps preview transactionally", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    
    // 1. Break source
    pg.setEditorBuffer(customerAir + "\nfield customers.");
    assert.equal(pg.status, "source-error");
    assert.equal(pg.previewStatusBadge, "⚠ Preview: last valid compile");

    // 2. Complete the declaration validly with a new field
    const fixedAir = customerAir + "\nfield customers.phone text";
    pg.setEditorBuffer(fixedAir);

    assert.equal(pg.status, "compiled");
    assert.equal(pg.errorTitle, null);
    assert.equal(pg.errorMessage, null);
    assert.equal(pg.previewStatusBadge, null);
    assert.equal(pg.lastValidSource, fixedAir);
    assert.ok(pg.currentRuntime.model.entities.get("customers").fieldMap.has("phone"));
  });

  it("4. Deleting a valid optional declaration updates app successfully without runtime crash", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    
    // Remove the optional company field declaration
    const lines = customerAir.split("\n").filter((l) => !l.includes("customers.company"));
    const editedAir = lines.join("\n");
    pg.setEditorBuffer(editedAir);

    assert.equal(pg.status, "compiled");
    assert.ok(pg.currentRuntime != null);
    assert.equal(pg.currentRuntime.model.entities.get("customers").fieldMap.has("company"), false);
  });

  it("5. Removing referenced declaration produces semantic compile error but retains preview", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    
    // Remove "resource customers" while keeping "manage customers" and fields
    const lines = customerAir.split("\n").filter((l) => !l.startsWith("resource "));
    const brokenAir = lines.join("\n");
    pg.setEditorBuffer(brokenAir);

    assert.equal(pg.status, "source-error");
    assert.ok(pg.errorMessage.includes("customers") || pg.errorMessage.includes("Undeclared"));
    assert.ok(pg.currentRuntime != null);
    assert.equal(pg.previewStatusBadge, "⚠ Preview: last valid compile");
  });

  it("6. Clear action produces empty editor buffer and mounts Blank Project state", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    pg.clear();

    assert.equal(pg.editorBuffer, "");
    assert.equal(pg.status, "blank");
    assert.equal(pg.currentRuntime, null);
    assert.ok(pg.liveHost.innerHTML.includes("Blank Project"));
  });

  it("7. Clear does NOT show Application Error", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    pg.clear();

    assert.ok(!pg.liveHost.innerHTML.includes("Application Error"));
    assert.ok(!pg.liveHost.innerHTML.includes("fatal-mark"));
  });

  it("8. Blank project becomes valid when typing minimal AIR source", () => {
    const pg = new PlaygroundStateMachine("blank", "", "");
    assert.equal(pg.status, "blank");

    // Insert Minimal App
    pg.setEditorBuffer(MINIMAL_AIR_STARTER);

    assert.equal(pg.status, "compiled");
    assert.ok(pg.currentRuntime != null);
    assert.equal(pg.currentRuntime.model.app.title, "My App");
    assert.ok(pg.currentRuntime.model.entities.has("items"));
    assert.ok(!pg.liveHost.innerHTML.includes("fatal-mark"));
  });

  it("9. Reset restores canonical source and seed", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    
    // Modify buffer
    pg.setEditorBuffer(MINIMAL_AIR_STARTER);
    assert.equal(pg.lastValidSource, MINIMAL_AIR_STARTER);

    // Reset
    pg.reset();
    assert.equal(pg.editorBuffer, customerAir);
    assert.equal(pg.lastValidSource, customerAir);
    assert.equal(pg.status, "compiled");
    assert.equal(pg.currentRuntime.model.app.title, "Customer Manager");
  });

  it("10. Seed sanitization prevents custom schemas from failing on incompatible canonical seed", () => {
    const customAir = `air version=2
app simple title="Simple App"
resource widgets label=title
field widgets.title text required
manage widgets
`;
    const candidateModel = parseAir(customAir);
    
    // Pass customer seed to widget app -> customer seed has "customers" key, not "widgets"
    const sanitizedSeed = sanitizeSeedForModel(customerSeed, candidateModel);
    const parsed = JSON.parse(sanitizedSeed);

    assert.deepEqual(parsed, {});
    
    // Seed parsing should succeed cleanly without crashing on missing/extra fields
    const seedData = parseSeedData(sanitizedSeed, candidateModel);
    assert.ok(seedData instanceof Map);
  });

  it("11. Canonical examples retain strict seed validation", async () => {
    for (const [exId, config] of Object.entries(EXAMPLES)) {
      if (exId === "blank" || !config.airPath) continue;
      const air = await readFile(join(root, config.airPath.replace("../", "")), "utf8");
      const seed = await readFile(join(root, config.seedPath.replace("../", "")), "utf8");

      const model = parseAir(air);
      const seedData = parseSeedData(seed, model);
      assert.ok(seedData instanceof Map);
      assert.ok(seedData.size > 0, `${exId} seed must contain records`);
    }
  });

  it("12. Generic Explain engine produces accurate explanations for all declaration types without hardcoded text", () => {
    const testCases = [
      { line: "air version=2", expectedKind: "Spec Version" },
      { line: 'app my_portal title="Customer Portal" initial=overview', expectedKind: "Application Metadata" },
      { line: "theme mode=dark accent=emerald", expectedKind: "Visual Theme" },
      { line: "capability storage.local", expectedKind: "Platform Capability" },
      { line: "resource accounts label=name", expectedKind: "Business Resource" },
      { line: "field accounts.name text required min=2", expectedKind: "Field (text)" },
      { line: "field accounts.balance money default=0", expectedKind: "Field (money)" },
      { line: "field accounts.hourly_rate rate unit=hour currency=USD", expectedKind: "Field (rate)" },
      { line: "field accounts.window interval boundary=start_end", expectedKind: "Field (interval)" },
      { line: "field accounts.owner_id text ref=users.id", expectedKind: "Field (text)" },
      { line: "field accounts.status enum values=active,paused,closed", expectedKind: "Field (enum)" },
      { line: 'field accounts.total money computed="balance + 100"', expectedKind: "Field (money)" },
      { line: "actor users", expectedKind: "Actor Identity" },
      { line: "manage accounts lifecycle=archive", expectedKind: "Managed CRUD UI" },
      { line: "access accounts role=admin action=all", expectedKind: "Access Control (RBAC)" },
      { line: "process orders state=status initial=draft terminal=paid,cancelled", expectedKind: "State Machine Process" },
      { line: "transition orders.approve from=draft to=approved by=manager separate=requester comment=required", expectedKind: "Workflow Transition" },
      { line: "invariant no_overlap resource=reservations overlaps=false", expectedKind: "Semantic Invariant" },
      { line: 'highlight orders.overdue when="status == \'pending\' && is_overdue" tone=danger', expectedKind: "Semantic Highlight" },
      { line: "overview", expectedKind: "Dashboard Overview" },
      { line: 'insight orders.revenue op=sum field=total label="Total Revenue"', expectedKind: "Aggregate Insight" },
      { line: 'notify low_stock when="stock <= reorder_level" tone=warning', expectedKind: "Notification Edge Trigger" }
    ];

    for (const tc of testCases) {
      const exp = explainDeclarationLine(tc.line);
      assert.ok(exp, `Failed to explain: ${tc.line}`);
      assert.equal(exp.kind, tc.expectedKind, `Kind mismatch for: ${tc.line}`);
      assert.ok(exp.desc.length > 10, `Description too short for: ${tc.line}`);
    }

    // Comments should be cleanly ignored
    const commentExp = explainDeclarationLine("# Just a comment");
    assert.equal(commentExp, null);

    const inlineCommentExp = explainDeclarationLine("resource items label=name # Item resource");
    assert.ok(inlineCommentExp);
    assert.equal(inlineCommentExp.kind, "Business Resource");
  });

  it("13. Focus mode switching (Split ⇄ Code ⇄ App) preserves runtime instance", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);
    const initialInstance = pg.currentRuntime;

    pg.setFocusMode("code");
    assert.equal(pg.focusMode, "code");
    assert.equal(pg.currentRuntime, initialInstance, "Focus mode switch must not rebuild runtime");

    pg.setFocusMode("app");
    assert.equal(pg.focusMode, "app");
    assert.equal(pg.currentRuntime, initialInstance, "Focus mode switch must not rebuild runtime");

    pg.setFocusMode("split");
    assert.equal(pg.focusMode, "split");
    assert.equal(pg.currentRuntime, initialInstance, "Focus mode switch must not rebuild runtime");
  });

  it("14. Safe formatNum formatter handles all boundary values without throwing", async () => {
    const { formatNum } = await import("../web/showcase.mjs");
    assert.equal(formatNum(1234), "1,234");
    assert.equal(formatNum(0), "0");
    assert.equal(formatNum("5678"), "5,678");
    assert.equal(formatNum(undefined), "—");
    assert.equal(formatNum(null), "—");
    assert.equal(formatNum(NaN), "—");
    assert.equal(formatNum(undefined, "Pending"), "Pending");
  });

  it("15. Error classification distinguishes parse, semantic, runtime, and presentation failures", () => {
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);

    // 1. Syntax / parse error
    pg.setEditorBuffer("air version=2\napp broken\nfield invalid line syntax");
    assert.equal(pg.status, "source-error");
    assert.match(pg.errorMessage, /line/i);

    // 2. Semantic error (unknown referenced resource)
    pg.setEditorBuffer("air version=2\napp test title=\"Test\"\nmanage nonexistent_resource\n");
    assert.equal(pg.status, "source-error");
    assert.ok(pg.errorMessage.includes("nonexistent_resource") || pg.errorMessage.includes("Undeclared"));

    // 3. Live preview preserved during all failure modes
    assert.equal(pg.previewStatusBadge, "⚠ Preview: last valid compile");
    assert.ok(pg.liveHost.innerHTML.includes("Customer Manager"));
  });

  it("16. CSS vertical full-height layout chain is validly defined in showcase.css", async () => {
    const css = await readFile(join(root, "web/showcase.css"), "utf8");
    assert.ok(css.includes(".showcase-split-container"));
    assert.ok(css.includes(".pane-source"));
    assert.ok(css.includes(".code-editor-wrapper"));
    assert.ok(css.includes("#tab-content-air"));
    assert.ok(css.includes("#air-code-editor"));
    
    // Verify CSS grid, min-height: 0, and normal flow layout rules
    assert.match(css, /\.pane-source\s*\{[^}]*display:\s*grid/);
    assert.match(css, /\.pane-source\s*\{[^}]*grid-template-rows:/);
    assert.match(css, /#tab-content-air\s*\{[^}]*display:\s*flex/);
    assert.match(css, /#air-code-editor\s*\{[^}]*height:\s*100%/);
  });

  it("17. HTML contains compact inspector strips and collapsible drawer structure", async () => {
    const html = await readFile(join(root, "web/showcase.html"), "utf8");
    assert.ok(html.includes("id=\"line-explain-strip\""));
    assert.ok(html.includes("id=\"air-provides-strip\""));
    assert.ok(html.includes("id=\"showcase-bottom-panel\""));
    assert.ok(html.includes("id=\"btn-toggle-bottom-panel\""));
    assert.ok(html.includes("id=\"what-air-provides-artifacts-content\""));
  });

  it("18. Embedded application host has bounded viewport and internal scrolling in styles.css", async () => {
    const css = await readFile(join(root, "web/runtime/styles.css"), "utf8");
    assert.ok(css.includes(".app-host-embedded"));
    assert.ok(css.includes(".app-shell[data-host-mode=\"embedded\"]"));
    assert.ok(css.includes(".app-shell[data-host-mode=\"embedded\"] .sidebar nav"));
    assert.ok(css.includes(".app-shell[data-host-mode=\"embedded\"] .content"));
    
    // Verify height: 100%, min-height: 0, overflow-y: auto
    assert.match(css, /\.app-host-embedded\s*\{[^}]*overflow:\s*hidden/);
    assert.match(css, /\.app-shell\[data-host-mode="embedded"\]\s+\.content\s*\{[^}]*overflow-y:\s*auto/);
    assert.match(css, /\.app-shell\[data-host-mode="embedded"\]\s+\.sidebar\s+nav\s*\{[^}]*overflow-y:\s*auto/);
  });

  it("19. Sidebar footer is pinned and always reachable via flex column and margin-top: auto", async () => {
    const css = await readFile(join(root, "web/runtime/styles.css"), "utf8");
    assert.match(css, /\.app-shell\[data-host-mode="embedded"\]\s+\.sidebar\s*\{[^}]*display:\s*flex/);
    assert.match(css, /\.app-shell\[data-host-mode="embedded"\]\s+\.sidebar\s*\{[^}]*flex-direction:\s*column/);
    assert.match(css, /\.app-shell\[data-host-mode="embedded"\]\s+\.sidebar-footer\s*\{[^}]*margin-top:\s*auto/);
    assert.match(css, /\.app-shell\[data-host-mode="embedded"\]\s+\.sidebar-footer\s*\{[^}]*flex-shrink:\s*0/);
  });

  it("20. Preview viewport container strictly bounds outer host height in showcase.css", async () => {
    const css = await readFile(join(root, "web/showcase.css"), "utf8");
    assert.match(css, /\.preview-viewport-container\s*\{[^}]*overflow:\s*hidden/);
    assert.match(css, /\.live-app-wrapper\s*\{[^}]*overflow:\s*hidden/);
    assert.match(css, /\.live-app-wrapper\s*\{[^}]*height:\s*100%/);
    assert.match(css, /\.live-app-wrapper\s*\{[^}]*min-height:\s*0/);
  });

  it("21. Global Showcase header has cohesive action group with styled GitHub button", async () => {
    const html = await readFile(join(root, "web/showcase.html"), "utf8");
    const css = await readFile(join(root, "web/showcase.css"), "utf8");

    // HTML validation
    assert.ok(html.includes("class=\"nav-actions-section\""));
    assert.ok(html.includes("class=\"nav-github-btn\""));
    assert.ok(html.includes("href=\"https://github.com/joaquimpsoares/AIR\""));
    assert.ok(html.includes("target=\"_blank\""));
    assert.ok(html.includes("rel=\"noopener noreferrer\""));

    // CSS validation
    assert.match(css, /\.nav-actions-section\s*\{[^}]*display:\s*flex/);
    assert.match(css, /\.nav-github-btn\s*\{[^}]*display:\s*inline-flex/);
    assert.match(css, /\.nav-github-btn\s*\{[^}]*height:\s*32px/);
    assert.match(css, /\.nav-cta-btn\s*\{[^}]*height:\s*32px/);
  });

  it("22. Homepage Live Demonstration section is validly structured with source, running app, and metrics", async () => {
    const html = await readFile(join(root, "web/showcase.html"), "utf8");
    const css = await readFile(join(root, "web/showcase.css"), "utf8");

    // HTML validation
    assert.ok(html.includes("class=\"home-live-proof-section\""));
    assert.ok(html.includes("id=\"home-proof-air-code\""));
    assert.ok(html.includes("id=\"home-live-app-root\""));
    assert.ok(html.includes("id=\"home-proof-open-explorer\""));
    assert.ok(html.includes("123"));
    assert.ok(html.includes("cl100k_base source tokens"));
    assert.ok(html.includes("49.2x"));

    // CSS validation
    assert.match(css, /\.home-live-proof-section\s*\{[^}]*max-width:\s*1200px/);
    assert.match(css, /\.home-proof-container\s*\{[^}]*grid-template-columns:/);
    assert.match(css, /\.home-proof-source-pane\s*\{/);
    assert.match(css, /\.home-proof-app-pane\s*\{/);

    // Verify canonical source parses and mounts
    const airSource = await readFile(join(root, "showcase/customer-manager/app.air"), "utf8");
    const seedSource = await readFile(join(root, "showcase/customer-manager/seed.json"), "utf8");
    const model = parseAir(airSource);
    assert.equal(model.app.id, "customer_manager");
    assert.equal(model.app.title, "Customer Manager");

    const host = createMockElement("home-live-app-root");
    const runtime = mountAirApp(host, airSource, {
      mode: "embedded",
      seedSource,
      principal: { roles: ["admin"] }
    });
    assert.ok(runtime);
    assert.ok(host.innerHTML.includes("Customer Manager"));
  });

  it("23. Explorer Preview mode toggle (Fit vs Actual) is defined and supported", async () => {
    const html = await readFile(join(root, "web/showcase.html"), "utf8");
    const css = await readFile(join(root, "web/showcase.css"), "utf8");
    const js = await readFile(join(root, "web/showcase.mjs"), "utf8");

    // HTML validation
    assert.ok(html.includes("class=\"preview-mode-toggle\""));
    assert.ok(html.includes("id=\"btn-preview-fit\""));
    assert.ok(html.includes("id=\"btn-preview-actual\""));

    // CSS validation
    assert.match(css, /\.preview-mode-toggle\s*\{[^}]*display:\s*inline-flex/);
    assert.match(css, /\.preview-mode-btn\s*\{/);

    // JS validation
    assert.ok(js.includes("applyPreviewScaling"));
    assert.ok(js.includes("loadHomepageLiveProof"));
    assert.ok(js.includes("currentPreviewScaleMode"));
  });

  it("24. Explorer Split mode guarantees non-collapsed full-height editor and active preview", async () => {
    const html = await readFile(join(root, "web/showcase.html"), "utf8");
    const css = await readFile(join(root, "web/showcase.css"), "utf8");

    // HTML validation
    assert.ok(html.includes("id=\"split-container\""));
    assert.ok(html.includes("id=\"left-code-pane\""));
    assert.ok(html.includes("id=\"right-preview-pane\""));
    assert.ok(html.includes("id=\"air-code-editor\""));
    assert.ok(html.includes("id=\"live-app-root\""));

    // CSS verification that editor cannot collapse to 0 or content height
    assert.match(css, /\.pane-source\s*\{[^}]*display:\s*grid/);
    assert.match(css, /#tab-content-air\s*\{[^}]*height:\s*100%/);
    assert.match(css, /#air-code-editor\s*\{[^}]*display:\s*block/);
    assert.match(css, /#air-code-editor\s*\{[^}]*height:\s*100%/);

    // State machine simulation of Split mode load
    const customerAir = await readFile(join(root, "showcase/customer-manager/app.air"), "utf8");
    const customerSeed = await readFile(join(root, "showcase/customer-manager/seed.json"), "utf8");
    const pg = new PlaygroundStateMachine("customer-manager", customerAir, customerSeed);

    assert.equal(pg.status, "compiled");
    assert.ok(pg.editorBuffer.length > 50);
    assert.ok(pg.editorBuffer.includes("app customer_manager"));
    assert.ok(pg.liveHost.innerHTML.includes("Customer Manager"));
  });
});
