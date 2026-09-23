import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseAir, AppRuntime } from "../web/runtime/air.mjs";
import { runBenchmarks } from "../tools/benchmark.mjs";
import { CustomerStore } from "../benchmarks/customer-manager/conventional/src/store/customerStore.ts";
import { validateCustomer } from "../benchmarks/customer-manager/conventional/src/validation/customerSchema.ts";
import { WorkflowEngine } from "../benchmarks/approval-workflow/conventional/src/state/workflowEngine.ts";

const root = new URL("..", import.meta.url).pathname;

describe("AIR DEVELOPER SHOWCASE & MEASURED BENCHMARK v1 Test Suite", () => {
  it("1. Canonical Examples: Parse and Compile without errors", async () => {
    const examples = [
      "showcase/customer-manager/app.air",
      "showcase/approval-workflow/app.air",
      "showcase/reservation-hub/app.air",
      "showcase/inventory-hub/app.air"
    ];

    for (const exPath of examples) {
      const source = await readFile(join(root, exPath), "utf8");
      const model = parseAir(source);
      assert.ok(model, `Failed to parse ${exPath}`);
      assert.ok(model.entities.size > 0, `${exPath} should declare at least one resource`);
    }
  });

  it("2. Example Manifests: Integrity and Capability Coverage", async () => {
    const manifestJson = JSON.parse(await readFile(join(root, "showcase/manifest.json"), "utf8"));
    assert.equal(manifestJson.examples.length, 4);

    for (const item of manifestJson.examples) {
      const exampleJson = JSON.parse(await readFile(join(root, item.path, "example.json"), "utf8"));
      assert.equal(exampleJson.id, item.id);
      assert.ok(exampleJson.title, "Missing title");
      assert.ok(exampleJson.description, "Missing description");
      assert.ok(exampleJson.difficulty, "Missing difficulty");
      assert.ok(Array.isArray(exampleJson.capabilitiesDemonstrated), "Missing capabilities array");
      assert.ok(exampleJson.capabilitiesDemonstrated.length >= 3, "Should demonstrate at least 3 capabilities");
    }
  });

  it("3. Conventional Customer Manager Reference: Functional Equivalence & Validation", () => {
    const initial = [
      { id: "c1", name: "Acme Corp", email: "contact@acme.corp", status: "Active", joined: "2026-01-01" },
      { id: "c2", name: "Globex", email: "info@globex.io", status: "Trial", joined: "2026-02-01" }
    ];
    const store = new CustomerStore(initial);

    // Initial count
    assert.equal(store.getAll().length, 2);

    // Email uniqueness validation
    const dupRes = validateCustomer({ name: "Duplicate Acme", email: "contact@acme.corp", status: "Active" }, initial);
    assert.equal(dupRes.valid, false);
    assert.ok(dupRes.errors.some((e) => e.field === "email" && e.message.includes("unique")));

    // Creation
    const createRes = store.create({ name: "Initech", email: "billing@initech.com", status: "Active", joined: "2026-03-01" });
    assert.equal(createRes.success, true);
    assert.equal(store.getAll().length, 3);

    // Filtering & Search
    const filtered = store.filter({ searchQuery: "initech", statusFilter: "Active", sortBy: "name", sortOrder: "asc" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].name, "Initech");

    // Status filter
    const trialOnly = store.filter({ searchQuery: "", statusFilter: "Trial", sortBy: "name", sortOrder: "asc" });
    assert.equal(trialOnly.length, 1);
    assert.equal(trialOnly[0].name, "Globex");

    // Archival
    store.archive("c1");
    assert.equal(store.getAll().length, 2);
  });

  it("4. Conventional Approval Workflow Reference: Transitions, Authority & Separation of Duty", () => {
    const users = [
      { id: "u1", name: "Employee Alice", email: "alice@co.com", role: "employee" },
      { id: "u2", name: "Manager Bob", email: "bob@co.com", role: "manager" },
      { id: "u3", name: "Finance Carol", email: "carol@co.com", role: "finance" }
    ];
    const initialExpenses = [
      {
        id: "exp1",
        description: "Office Monitor",
        amount: 350,
        currency: "USD",
        category: "Equipment",
        submitterId: "u1",
        status: "Draft",
        createdAt: "2026-03-01",
        updatedAt: "2026-03-01",
        history: []
      }
    ];

    const engine = new WorkflowEngine(initialExpenses, users);

    // 1. Submit by owner
    const subRes = engine.submit("exp1", users[0]);
    assert.equal(subRes.success, true);
    assert.equal(engine.getById("exp1").status, "Submitted");

    // 2. Separation of duty: Submitter cannot approve own expense
    const selfApprove = engine.approve("exp1", { id: "u1", name: "Alice as Manager", email: "alice@co.com", role: "manager" });
    assert.equal(selfApprove.success, false);
    assert.ok(selfApprove.error.includes("Separation of duty"));

    // 3. Manager approval succeeds
    const managerApprove = engine.approve("exp1", users[1]);
    assert.equal(managerApprove.success, true);
    assert.equal(engine.getById("exp1").status, "Approved");
    assert.equal(engine.getById("exp1").history.length, 2);
  });

  it("5. Flagship Inventory Hub: Notification Edge Triggering & Deduplication", async () => {
    const airSource = await readFile(join(root, "showcase/inventory-hub/app.air"), "utf8");
    const seedSource = await readFile(join(root, "showcase/inventory-hub/seed.json"), "utf8");
    const model = parseAir(airSource);

    const runtime = new AppRuntime(model, {
      seedData: JSON.parse(seedSource),
      principal: { roles: ["admin", "operator"] }
    });

    // Check initial state: bal_01 has qty 12, reorder level 10 (condition false)
    const initialNotifs = runtime.notifications();
    const lowStockInitial = initialNotifs.filter((n) => n.ruleId.includes("low_stock"));
    assert.equal(lowStockInitial.length, 0, "No initial low-stock notification on boot");

    // Step 1: 12 -> 8 (false -> true)
    runtime.update("inventory_balances", "bal_01", { quantity_on_hand: 8 });

    const notifsAfterStep1 = runtime.notifications();
    const lowStockStep1 = notifsAfterStep1.filter((n) => n.ruleId.includes("low_stock"));
    assert.equal(lowStockStep1.length, 1, "Low stock notification fired on false -> true edge");
    assert.equal(runtime.unreadNotificationCount(), 1);

    // Step 2: 8 -> 7 (true -> true => no duplicate)
    runtime.update("inventory_balances", "bal_01", { quantity_on_hand: 7 });

    const notifsAfterStep2 = runtime.notifications();
    const lowStockStep2 = notifsAfterStep2.filter((n) => n.ruleId.includes("low_stock"));
    assert.equal(lowStockStep2.length, 1, "No duplicate notification while condition remains true");

    // Step 3: 7 -> 15 (true -> false => condition cleared)
    runtime.update("inventory_balances", "bal_01", { quantity_on_hand: 15 });

    // Step 4: 15 -> 9 (false -> true => re-triggers)
    runtime.update("inventory_balances", "bal_01", { quantity_on_hand: 9 });

    const notifsAfterStep4 = runtime.notifications();
    const lowStockStep4 = notifsAfterStep4.filter((n) => n.ruleId.includes("low_stock"));
    assert.equal(lowStockStep4.length, 2, "New notification emitted after condition cleared and re-entered true");
  });

  it("6. Benchmark Runner & Stale Drift Prevention Gate", async () => {
    const results = await runBenchmarks();
    assert.ok(results.examples.length >= 4);

    const cm = results.examples.find((e) => e.id === "customer-manager");
    assert.ok(cm);
    assert.ok(cm.air.canonicalTokens > 0);
    assert.ok(cm.air.llmTokens > 0);
    assert.ok(cm.conventional.llmTokens > 0);
    assert.ok(cm.sourceCompressionRatio > 10, "Customer manager should have significant token compression (>10x)");

    const appv = results.examples.find((e) => e.id === "approval-workflow");
    assert.ok(appv);
    assert.ok(appv.sourceCompressionRatio > 5, "Approval workflow should have significant token compression (>5x)");

    // Verify checked-in results.json matches
    const committedJson = JSON.parse(await readFile(join(root, "benchmarks/results.json"), "utf8"));
    assert.equal(committedJson.examples.length, results.examples.length);
    assert.equal(committedJson.examples[0].air.canonicalTokens, cm.air.canonicalTokens);
  });
});
