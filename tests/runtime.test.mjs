import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AirError,
  AppRuntime,
  MemoryStorage,
  applyPatch,
  parseAir,
  parseSeedData,
  primitiveUsage,
  serializeDeclarations
} from "../web/runtime/air.mjs";

const customerSource = await readFile(new URL("../apps/customer-manager.air", import.meta.url), "utf8");
const customerSeedSource = await readFile(new URL("../data/customer-manager.seed.json", import.meta.url), "utf8");
const taskSource = await readFile(new URL("../apps/task-board.air", import.meta.url), "utf8");
const taskSeedSource = await readFile(new URL("../data/task-board.seed.json", import.meta.url), "utf8");
const fixedClock = () => new Date("2026-09-20T12:00:00Z");

function runtimeFor(source = customerSource, seedSource = customerSeedSource, options = {}) {
  const model = parseAir(source);
  const clock = options.clock ?? fixedClock;
  const seedData = parseSeedData(seedSource, model, { clock });
  let next = 1;
  return new AppRuntime(model, {
    seedData,
    storage: options.storage ?? new MemoryStorage(),
    principal: options.principal ?? { roles: ["admin"] },
    clock,
    idFactory: (resource) => `${resource}_${next++}`
  });
}

async function patches() {
  return Promise.all([
    "01-archive-customers",
    "02-add-company-vat",
    "03-admin-edit",
    "04-expire-trials",
    "05-revenue"
  ].map((name) => readFile(new URL(`../experiments/patches/${name}.airpatch`, import.meta.url), "utf8")));
}

test("AIR v2 contains intent only and rejects inline records", () => {
  const model = parseAir(customerSource);
  assert.equal(model.declarations.some((declaration) => declaration.kind === "record"), false);
  assert.throws(
    () => parseAir(`${customerSource}record customers.c_99 name=Bad\n`),
    /data belongs in a \.seed\.json/
  );
  assert.equal(customerSource.trim().split("\n").length, 26);
});

test("seed data is separate, schema validated, and cannot alter application intent", () => {
  const model = parseAir(customerSource);
  const seeds = parseSeedData(customerSeedSource, model, { clock: fixedClock });
  assert.equal(seeds.get("customers").length, 12);
  assert.equal(model.declarations.length, 26);
  assert.throws(() => parseSeedData('{"unknown":[]}', model), /unknown resource/);
  assert.throws(() => parseSeedData('{"customers":[{"id":"x","name":"XX","email":"bad"}]}', model), /valid email/);
});

test("manage deterministically derives the full resource experience", () => {
  const model = parseAir(customerSource);
  assert.deepEqual(model.pages.map((page) => page.id), ["overview", "account_managers", "customers"]);
  const page = model.pageMap.get("customers");
  assert.deepEqual(page.search, ["name", "email", "phone", "company", "vat_number", "notes"]);
  assert.deepEqual(page.filters, ["account_manager", "status"]);
  assert.deepEqual(page.columns, ["name", "email", "account_manager", "status", "monthly_revenue", "joined"]);
  assert.deepEqual(page.sort, ["name", "status", "-joined", "monthly_revenue"]);
  assert.equal(page.pageSize, 8);
  assert.deepEqual(model.management.get("customers"), {
    resource: "customers", create: true, edit: true, delete: true,
    lifecycle: "archive", pageSize: null
  });
});

test("the unrelated task app gets identical inference with relations and two resources", () => {
  const model = parseAir(taskSource);
  assert.deepEqual(model.pages.map((page) => page.id), ["overview", "projects", "tasks"]);
  assert.deepEqual(model.pageMap.get("tasks").filters, ["project", "status", "priority"]);
  assert.deepEqual(model.pageMap.get("tasks").search, ["title", "notes"]);
  assert.equal(model.pageMap.get("tasks").columns.includes("project"), true);
  assert.equal(primitiveUsage(model).derived.includes("query"), true);
});

test("the shared runtime contains no demo-domain rendering branches", async () => {
  const ui = await readFile(new URL("../web/runtime/ui.mjs", import.meta.url), "utf8");
  const engine = await readFile(new URL("../web/runtime/air.mjs", import.meta.url), "utf8");
  for (const forbidden of ["Customer Manager", "Northstar", "customer.status", "Task Board", "Lattice", "tasks.priority"]) {
    assert.equal(ui.includes(forbidden), false, `UI hard-coded ${forbidden}`);
    assert.equal(engine.includes(forbidden), false, `engine hard-coded ${forbidden}`);
  }
});

test("canonical intent serialization is stable", () => {
  const first = serializeDeclarations(parseAir(customerSource).declarations);
  const second = serializeDeclarations(parseAir(first).declarations);
  assert.equal(first, second);
  assert.equal(parseAir(first).app.id, "customer_manager");
});

test("validation fails closed for unknown properties, references, and capabilities", () => {
  assert.throws(() => parseAir("air version=2\napp bad\ntheme colour=red\nresource things\nfield things.name text\nmanage things\n"), /unknown theme property/);
  assert.throws(() => parseAir("air version=2\napp bad\ncapability network\nresource things\nfield things.name text\nmanage things\n"), /unsupported capability/);
  assert.throws(() => parseAir("air version=2\napp bad\nresource things\nfield things.owner ref=missing\nmanage things\n"), /unknown referenced resource/);
  assert.throws(() => parseAir("air version=2\napp bad\nresource things\nfield things.name type=javascript\nmanage things\n"), /unknown field type/);
});

test("query, validation, CRUD, and persistence remain generic runtime capabilities", () => {
  const storage = new MemoryStorage();
  const runtime = runtimeFor(customerSource, customerSeedSource, { storage });
  const filtered = runtime.query("customers", {
    search: "hello@acme.studio", searchFields: runtime.model.pageMap.get("customers").search,
    filters: { status: "Active" }, sort: "-joined", page: 1, pageSize: 2
  });
  assert.deepEqual(filtered.records.map((record) => record.id), ["c_01"]);

  const invalid = runtime.create("customers", { name: "A", email: "wrong", status: "Unknown", account_manager: "am_01" });
  assert.deepEqual(Object.keys(invalid.errors).sort(), ["email", "name", "status"]);
  const created = runtime.create("customers", { name: "Verse Analytics", email: "hello@verse.example", status: "Trial", account_manager: "am_01" });
  assert.equal(created.record.id, "customers_1");
  assert.equal(created.record.joined, "2026-09-20");
  runtime.update("customers", created.record.id, { status: "Active" });

  const reloaded = runtimeFor(customerSource, customerSeedSource, { storage });
  assert.equal(reloaded.records("customers").some((record) => record.email === "hello@verse.example"), true);
});

test("references display labels and protect hard deletes", () => {
  const runtime = runtimeFor(taskSource, taskSeedSource);
  assert.equal(runtime.displayValue("tasks", "project", "p_01"), "Website refresh");
  assert.throws(() => runtime.delete("projects", "p_01"), /still reference/);
  const result = runtime.query("tasks", { filters: { project: "p_02", priority: "High" }, sort: "due", paginate: false });
  assert.deepEqual(result.records.map((record) => record.id), ["t_03", "t_10"]);
});

test("modification 1: archive lifecycle preserves data and removes it from active queries", async () => {
  const [archivePatch] = await patches();
  const source = applyPatch(customerSource, archivePatch);
  const runtime = runtimeFor(source, customerSeedSource);
  const result = runtime.delete("customers", "c_01");
  assert.deepEqual(result, { archived: true });
  assert.equal(runtime.records("customers").length, 12);
  assert.ok(runtime.records("customers").find((record) => record.id === "c_01")._archived_at);
  assert.equal(runtime.query("customers", { paginate: false }).total, 11);

  const genericTaskSource = applyPatch(taskSource, "set manage tasks lifecycle=archive\n");
  const taskRuntime = runtimeFor(genericTaskSource, taskSeedSource);
  assert.deepEqual(taskRuntime.delete("tasks", "t_01"), { archived: true });
});

test("modification 2: company and VAT use existing schema inference", async () => {
  const [, fieldPatch] = await patches();
  const model = parseAir(applyPatch(customerSource, fieldPatch));
  assert.equal(model.entities.get("customers").fieldMap.get("company").type, "text");
  assert.equal(model.entities.get("customers").fieldMap.get("vat_number").label, "VAT number");
  const seeds = parseSeedData(customerSeedSource, model, { clock: fixedClock });
  assert.equal(seeds.get("customers")[0].company, "Acme Studio LLC");
});

test("modification 3: edit policy is enforced below the UI", async () => {
  const [, , policyPatch] = await patches();
  const source = applyPatch(customerSource, policyPatch);
  const member = runtimeFor(source, customerSeedSource, { principal: { roles: ["member"] } });
  assert.equal(member.can("customers", "edit"), false);
  assert.throws(() => member.update("customers", "c_01", { name: "Blocked" }), /not permitted/);
  const admin = runtimeFor(source, customerSeedSource, { principal: { roles: ["admin"] } });
  assert.equal(admin.can("customers", "edit"), true);
  assert.equal(admin.update("customers", "c_01", { name: "Allowed" }).record.name, "Allowed");
});

test("modification 4: scheduled transitions use explicit state, duration, and clock field", async () => {
  const [, , , rulePatch] = await patches();
  const source = applyPatch(customerSource, rulePatch);
  const runtime = runtimeFor(source, customerSeedSource, { clock: () => new Date("2026-10-20T12:00:00Z") });
  assert.equal(runtime.records("customers").find((record) => record.id === "c_02").status, "Expired");
  assert.equal(runtime.records("customers").find((record) => record.id === "c_01").status, "Active");
  assert.equal(runtime.model.entities.get("customers").fieldMap.get("status").values.includes("Expired"), true);

  const genericRule = "upsert rule tasks.stale field=status from=Backlog to=Stale after=30d since=due\n";
  const taskRuntime = runtimeFor(applyPatch(taskSource, genericRule), taskSeedSource, { clock: () => new Date("2026-11-20T12:00:00Z") });
  assert.equal(taskRuntime.records("tasks").find((record) => record.id === "t_03").status, "Stale");
});

test("modification 5: money fields and aggregate insights are reusable and correctly formatted", async () => {
  const [, , , , revenuePatch] = await patches();
  const source = applyPatch(customerSource, revenuePatch);
  const runtime = runtimeFor(source, customerSeedSource);
  runtime.update("customers", "c_01", { monthly_revenue: 2500 });
  runtime.update("customers", "c_02", { monthly_revenue: 1500 });
  const metric = runtime.model.pageMap.get("overview").metrics.find((item) => item.address === "customers.monthly_revenue");
  assert.equal(runtime.metric(metric), 26750);
  assert.match(runtime.formatMetric(metric, 26750), /26,750/);
  assert.equal(runtime.model.pageMap.get("customers").columns.includes("monthly_revenue"), true);

  const genericSource = applyPatch(taskSource, "upsert field projects.budget money currency=USD default=0\nupsert insight projects.budget op=sum field=budget\n");
  assert.equal(parseAir(genericSource).pageMap.get("overview").metrics.some((item) => item.address === "projects.budget"), true);
});

test("all five semantic patches compose and preserve seed compatibility", async () => {
  let source = customerSource;
  for (const patch of await patches()) source = applyPatch(source, patch);
  const model = parseAir(source);
  const seeds = parseSeedData(customerSeedSource, model, { clock: fixedClock });
  const runtime = new AppRuntime(model, { seedData: seeds, storage: new MemoryStorage(), principal: { roles: ["admin"] }, clock: fixedClock });
  assert.equal(model.management.get("customers").lifecycle, "archive");
  assert.equal(model.management.get("customers").edit, "admin");
  assert.equal(model.rules.length, 1);
  assert.equal(model.pageMap.get("overview").metrics.some((metric) => metric.op === "sum"), true);
  assert.equal(runtime.records("customers")[0].company, "Acme Studio LLC");
});

test("extensions still require declared authority and host allowlisting", () => {
  const base = "air version=2\napp x\nresource things\nfield things.name text\nmanage things\n";
  assert.throws(() => parseAir(`${base}extension chart module=charts\n`), /requires capability/);
  const authorized = `${base}capability extension.load.chart\nextension chart module=charts\n`;
  assert.throws(() => parseAir(authorized), /not allowed/);
  assert.equal(parseAir(authorized, { extensions: ["charts"] }).extensions[0].module, "charts");
});

test("invalid persisted state fails closed", () => {
  const model = parseAir(customerSource);
  const seeds = parseSeedData(customerSeedSource, model, { clock: fixedClock });
  const storage = new MemoryStorage({ [`air:${model.app.id}:customers:v2`]: "not-json" });
  assert.throws(() => new AppRuntime(model, { storage, seedData: seeds }), AirError);
});
