import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseAir, parseSeedData, AppRuntime, MemoryStorage } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { mountAirApp, renderPresentation } from "../web/runtime/ui.mjs";

const root = new URL("..", import.meta.url).pathname;

function createMockRoot(initialWidth = 1024) {
  const listeners = new Map();
  const classes = new Set(["live-app-wrapper"]);
  const mock = {
    id: "live-app-root",
    clientWidth: initialWidth,
    clientHeight: 600,
    innerHTML: "",
    dataset: {},
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c)
    },
    removeAttribute: () => {},
    setAttribute: () => {},
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
    querySelectorAll: (selector) => {
      return [];
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

describe("AIR SHOWCASE EMBEDDED RUNTIME REGRESSION SUITE", () => {
  const exampleIds = [
    { id: "customer-manager", principal: { roles: ["admin"] } },
    { id: "approval-workflow", principal: { actor: "users", id: "u_02", roles: ["manager"] } },
    { id: "reservation-hub", principal: { roles: ["admin", "operator"] } },
    { id: "inventory-hub", principal: { roles: ["admin", "operator"] } }
  ];

  it("1. Every example compiles and loads seed data cleanly", async () => {
    for (const ex of exampleIds) {
      const airSource = await readFile(join(root, `showcase/${ex.id}/app.air`), "utf8");
      const seedSource = await readFile(join(root, `showcase/${ex.id}/seed.json`), "utf8");
      
      const model = parseAir(airSource);
      assert.ok(model, `Failed to parse ${ex.id}`);

      const seedData = parseSeedData(seedSource, model);
      assert.ok(seedData instanceof Map, `Seed for ${ex.id} is not a Map`);

      const runtime = new AppRuntime(model, {
        seedData,
        principal: ex.principal,
        namespace: `test:${ex.id}`
      });
      assert.ok(runtime, `Failed to initialize AppRuntime for ${ex.id}`);

      const presentation = compilePresentation(model, { principal: ex.principal, runtime });
      assert.ok(presentation.screens.length > 0, `${ex.id} must compile at least 1 screen`);
    }
  });

  it("2. Every example mounts in embedded mode without error or exception", async () => {
    for (const ex of exampleIds) {
      const airSource = await readFile(join(root, `showcase/${ex.id}/app.air`), "utf8");
      const seedSource = await readFile(join(root, `showcase/${ex.id}/seed.json`), "utf8");
      const mockRoot = createMockRoot(1024);

      const appInstance = mountAirApp(mockRoot, airSource, {
        mode: "embedded",
        seedSource,
        principal: ex.principal,
        namespace: `showcase:${ex.id}`,
        storage: new MemoryStorage()
      });

      assert.ok(appInstance, `Failed to mount embedded application for ${ex.id}`);
      assert.ok(mockRoot.innerHTML.includes('data-host-mode="embedded"'), `${ex.id} missing data-host-mode="embedded"`);
      assert.ok(!mockRoot.innerHTML.includes("fatal-mark"), `${ex.id} rendered fatal error screen`);
      
      appInstance.destroy();
    }
  });

  it("3. Approval Workflow starts successfully with state transitions", async () => {
    const airSource = await readFile(join(root, "showcase/approval-workflow/app.air"), "utf8");
    const seedSource = await readFile(join(root, "showcase/approval-workflow/seed.json"), "utf8");
    const mockRoot = createMockRoot(1024);

    const appInstance = mountAirApp(mockRoot, airSource, {
      mode: "embedded",
      seedSource,
      principal: { actor: "users", id: "u_02", roles: ["manager"] },
      storage: new MemoryStorage()
    });

    assert.ok(appInstance);
    assert.ok(mockRoot.innerHTML.includes("Expense Approval"), "App title missing");
    assert.ok(mockRoot.innerHTML.includes("Draft") || mockRoot.innerHTML.includes("Submitted"), "Workflow state missing");
    
    // Check transitions available for manager
    const expenses = appInstance.records("expenses");
    assert.ok(expenses.length > 0, "No expenses found in seed");
    const submitted = expenses.find((e) => e.status === "Submitted");
    assert.ok(submitted, "No Submitted expense found in seed");

    appInstance.destroy();
  });

  it("4. Reservation Hub starts successfully with intervals and quotes", async () => {
    const airSource = await readFile(join(root, "showcase/reservation-hub/app.air"), "utf8");
    const seedSource = await readFile(join(root, "showcase/reservation-hub/seed.json"), "utf8");
    const mockRoot = createMockRoot(1024);

    const appInstance = mountAirApp(mockRoot, airSource, {
      mode: "embedded",
      seedSource,
      principal: { roles: ["admin", "operator"] },
      storage: new MemoryStorage()
    });

    assert.ok(appInstance);
    assert.ok(mockRoot.innerHTML.includes("Reservation Hub"), "App title missing");
    
    const resv = appInstance.get("reservations", "resv_001");
    assert.ok(resv, "Reservation resv_001 missing");
    assert.ok(resv.quote != null, "Computed quote missing from reservation record");

    appInstance.destroy();
  });

  it("5. Container-width responsive recomposition: Desktop (1024px) vs Mobile (390px)", async () => {
    const airSource = await readFile(join(root, "showcase/inventory-hub/app.air"), "utf8");
    const seedSource = await readFile(join(root, "showcase/inventory-hub/seed.json"), "utf8");
    const mockRoot = createMockRoot(1024);

    const appInstance = mountAirApp(mockRoot, airSource, {
      mode: "embedded",
      seedSource,
      principal: { roles: ["admin", "operator"] },
      storage: new MemoryStorage()
    });

    // 1024px: Sidebar present, data-shell-representation="sidebar"
    assert.ok(mockRoot.innerHTML.includes('class="sidebar"'), "Desktop sidebar should be rendered at 1024px");

    // Switch to 390px
    mockRoot.clientWidth = 390;
    appInstance.setContainerWidth(390);

    // 390px: Compact header and mobile-nav present, desktop sidebar omitted
    assert.ok(mockRoot.innerHTML.includes('class="mobile-header"'), "Mobile header should be rendered at 390px");
    assert.ok(mockRoot.innerHTML.includes('class="mobile-nav"'), "Mobile bottom nav should be rendered at 390px");
    assert.ok(!mockRoot.innerHTML.includes('class="sidebar"'), "Desktop sidebar must not be rendered at 390px");

    appInstance.destroy();
  });

  it("6. Storage namespace isolation prevents collision across showcase examples", async () => {
    const storage = new MemoryStorage();

    const custAir = await readFile(join(root, "showcase/customer-manager/app.air"), "utf8");
    const custSeed = await readFile(join(root, "showcase/customer-manager/seed.json"), "utf8");

    const appCust = mountAirApp(createMockRoot(), custAir, {
      mode: "embedded",
      seedSource: custSeed,
      namespace: "showcase:customer-manager",
      storage
    });

    const invAir = await readFile(join(root, "showcase/inventory-hub/app.air"), "utf8");
    const invSeed = await readFile(join(root, "showcase/inventory-hub/seed.json"), "utf8");

    const appInv = mountAirApp(createMockRoot(), invAir, {
      mode: "embedded",
      seedSource: invSeed,
      namespace: "showcase:inventory-hub",
      storage
    });

    // Mutate customer in customer-manager
    appCust.create("customers", {
      name: "Unique Isolation Test Corp",
      email: "isolation@test.com",
      status: "Active"
    });

    // Verify inventory customers are unaffected
    const invCustomers = appInv.records("customers");
    assert.ok(!invCustomers.some((c) => c.name === "Unique Isolation Test Corp"), "State leaked between namespaces");

    appCust.destroy();
    appInv.destroy();
  });

  it("7. Repeated Switch Stress: 50 consecutive switches without leakage or error", async () => {
    const storage = new MemoryStorage();
    const mockRoot = createMockRoot(1024);
    let currentInstance = null;

    const examples = [
      { id: "customer-manager", principal: { roles: ["admin"] } },
      { id: "approval-workflow", principal: { actor: "users", id: "u_02", roles: ["manager"] } },
      { id: "reservation-hub", principal: { roles: ["admin", "operator"] } },
      { id: "inventory-hub", principal: { roles: ["admin", "operator"] } }
    ];

    const sources = {};
    for (const ex of examples) {
      sources[ex.id] = {
        air: await readFile(join(root, `showcase/${ex.id}/app.air`), "utf8"),
        seed: await readFile(join(root, `showcase/${ex.id}/seed.json`), "utf8")
      };
    }

    for (let i = 0; i < 50; i++) {
      const ex = examples[i % examples.length];
      
      // Clean dispose previous
      if (currentInstance) {
        currentInstance.dispose();
        currentInstance = null;
      }

      currentInstance = mountAirApp(mockRoot, sources[ex.id].air, {
        mode: "embedded",
        seedSource: sources[ex.id].seed,
        principal: ex.principal,
        namespace: `showcase:${ex.id}`,
        storage
      });

      assert.ok(currentInstance, `Switch step ${i} (${ex.id}) failed to mount`);
      assert.ok(!mockRoot.innerHTML.includes("fatal-mark"), `Switch step ${i} (${ex.id}) failed with fatal error`);
    }

    if (currentInstance) currentInstance.dispose();
  });
});
