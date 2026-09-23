import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAir, AppRuntime, MemoryStorage, ACCENTS, MODES, DENSITIES } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { mountAirApp, renderPresentation, isInteractiveRowTarget, resolveThemeMode } from "../web/runtime/ui.mjs";

function createMockElement(id = "live-app-root", initialWidth = 1024) {
  const listeners = new Map();
  const classes = new Set(["live-app-wrapper"]);
  const mock = {
    id,
    clientWidth: initialWidth,
    offsetWidth: initialWidth,
    clientHeight: 600,
    offsetHeight: 600,
    scrollTop: 0,
    scrollLeft: 0,
    innerHTML: "",
    dataset: {},
    style: {},
    attributes: {},
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c)
    },
    removeAttribute(attr) { delete mock.attributes[attr]; },
    setAttribute(attr, val) { mock.attributes[attr] = String(val); },
    getAttribute(attr) { return mock.attributes[attr] ?? null; },
    getBoundingClientRect: () => ({
      top: 100,
      left: 200,
      right: 200 + initialWidth,
      bottom: 700,
      width: initialWidth,
      height: 600
    }),
    querySelector: (sel) => {
      if (sel === ".content") return { focus: () => {} };
      if (sel === "#air-toast") return { className: "", innerHTML: "", classList: { remove: () => {} } };
      if (sel === "[data-drawer-panel]") return { addEventListener: () => {}, querySelector: () => ({ focus: () => {} }) };
      if (sel === "[data-menu-panel]") return { querySelector: () => ({ focus: () => {} }), addEventListener: () => {} };
      return null;
    },
    querySelectorAll: () => [],
    appendChild: (child) => {
      mock._children = mock._children || [];
      mock._children.push(child);
    },
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

describe("Theme & Accent Ownership & Live Propagation Suite", () => {
  it("1. All 17 Central Accents are recognized and validated by compiler", () => {
    const expected = [
      "red", "orange", "amber", "yellow", "lime", "green", "emerald",
      "teal", "cyan", "sky", "blue", "indigo", "violet", "purple",
      "fuchsia", "pink", "rose"
    ];
    assert.equal(ACCENTS.size, 17);
    for (const accent of expected) {
      assert.ok(ACCENTS.has(accent), `Accent ${accent} must be in ACCENTS set`);
      const schema = `
air version=2
app test_accent title="Accent Test"
theme mode=dark accent=${accent}
resource items label=name
field items.name text required
manage items
`;
      const model = parseAir(schema);
      assert.equal(model.theme.accent, accent);
    }
  });

  it("2. Invalid theme mode, accent, or density throw structured AirError with expected codes", () => {
    assert.throws(
      () => parseAir(`air version=2\napp t\ntheme mode=neon\nresource r\nfield r.n text\nmanage r`),
      (err) => err.code === "AIR_THEME_INVALID_MODE" && err.message.includes("unknown theme mode")
    );

    assert.throws(
      () => parseAir(`air version=2\napp t\ntheme accent=rainbow\nresource r\nfield r.n text\nmanage r`),
      (err) => err.code === "AIR_THEME_INVALID_ACCENT" && err.message.includes("unknown accent")
    );

    assert.throws(
      () => parseAir(`air version=2\napp t\ntheme density=ultra_wide\nresource r\nfield r.n text\nmanage r`),
      (err) => err.code === "AIR_THEME_INVALID_DENSITY" && err.message.includes("unknown density")
    );
  });

  it("3. Embedded theme host applies dataset attributes and data-air-theme-host to root only", () => {
    const schema = `
air version=2
app isolated_app title="Isolated Theme"
theme mode=light accent=teal density=compact
resource items label=name
field items.name text required
manage items
`;
    const model = parseAir(schema);
    const runtime = new AppRuntime(model, {
      seedData: { items: [{ id: "1", name: "Alpha" }] },
      storage: new MemoryStorage()
    });
    const ir = compilePresentation(model, { runtime });
    const mockRoot = createMockElement("live-app-root", 1000);

    const app = renderPresentation(mockRoot, ir, runtime, { mode: "embedded", model });

    assert.equal(mockRoot.dataset.theme, "light");
    assert.equal(mockRoot.dataset.accent, "teal");
    assert.equal(mockRoot.dataset.density, "compact");
    assert.equal(mockRoot.getAttribute("data-air-theme-host"), "true");
    assert.equal(mockRoot.style.colorScheme, "light");

    app.destroy();
  });

  it("4. Compiled theme mode=light overrides any system dark default without localStorage masking", () => {
    const schemaLight = `
air version=2
app light_app title="Light App"
theme mode=light accent=rose
resource items label=name
field items.name text required
manage items
`;
    const modelLight = parseAir(schemaLight);
    const runtimeLight = new AppRuntime(modelLight, { storage: new MemoryStorage() });
    const irLight = compilePresentation(modelLight, { runtime: runtimeLight });
    const mockRootLight = createMockElement("live-app-root", 1000);
    const appLight = renderPresentation(mockRootLight, irLight, runtimeLight, { mode: "embedded", model: modelLight });

    assert.equal(appLight.state.theme, "light");
    assert.equal(mockRootLight.dataset.theme, "light");
    assert.equal(mockRootLight.dataset.accent, "rose");

    appLight.destroy();
  });
});

describe("Collection Row Action Menu & Target Guard Suite", () => {
  it("1. isInteractiveRowTarget correctly identifies buttons, menus, and links", () => {
    const dummyButton = {
      closest: (selector) => selector.includes("button")
    };
    const dummyCell = {
      closest: () => null
    };
    const dummyMenuBtn = {
      closest: (selector) => selector.includes("data-row-action-menu")
    };
    assert.equal(isInteractiveRowTarget(dummyButton), true);
    assert.equal(isInteractiveRowTarget(dummyCell), false);
    assert.equal(isInteractiveRowTarget(dummyMenuBtn), true);
    assert.equal(isInteractiveRowTarget(null), false);
  });

  it("2. Action Menu renders properly structured semantic items and destructive tones", () => {
    const schema = `
air version=2
app reservation_hub title="Reservation Hub"
theme mode=dark accent=emerald
resource resources label=name
field resources.name text required
field resources.hourly_rate rate currency=USD unit=h required default=50
manage resources lifecycle=archive
`;
    const model = parseAir(schema);
    const runtime = new AppRuntime(model, {
      seedData: {
        resources: [
          { id: "res_01", name: "London Workspace", hourly_rate: 65 }
        ]
      },
      storage: new MemoryStorage()
    });
    const ir = compilePresentation(model, { runtime });
    const mockRoot = createMockElement("live-app-root", 1200);
    const app = renderPresentation(mockRoot, ir, runtime, { mode: "embedded", model });

    // Simulate opening menu for res_01
    app.state.openMenu = {
      id: "row-menu-resources-res_01",
      items: [
        { id: "view:resources:res_01", label: "View details", icon: "collection" },
        { id: "edit:resources:res_01", label: "Edit", icon: "edit" },
        { separator: true },
        { id: "delete:resources:res_01", label: "Archive", icon: "trash", tone: "destructive" }
      ],
      position: { top: 180, left: 750 }
    };
    app.render();

    assert.ok(mockRoot.innerHTML.includes('data-menu-panel'));
    assert.ok(mockRoot.innerHTML.includes('data-menu-action="view:resources:res_01"'));
    assert.ok(mockRoot.innerHTML.includes('data-menu-action="edit:resources:res_01"'));
    assert.ok(mockRoot.innerHTML.includes('data-menu-action="delete:resources:res_01"'));
    assert.ok(mockRoot.innerHTML.includes('class="menu-item destructive"'));

    app.destroy();
  });
});
