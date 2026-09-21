import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AppRuntime,
  MemoryStorage,
  applyPatch,
  explainModel,
  parseAir,
  parseSeedData,
  semanticDiff,
  semanticSnapshot,
  serializeDeclarations
} from "../web/runtime/air.mjs";
import { parseCapabilityCatalog, searchCapabilities } from "../tools/capabilities.mjs";

const application = await readFile(new URL("../apps/customer-manager.air", import.meta.url), "utf8");
const seedSource = await readFile(new URL("../data/customer-manager.seed.json", import.meta.url), "utf8");
const catalogSource = await readFile(new URL("../CAPABILITIES.aircat", import.meta.url), "utf8");
const fixedClock = () => new Date("2026-09-20T12:00:00Z");

function runtime(source = application, principal = { roles: ["admin"] }, clock = fixedClock, data = seedSource) {
  const model = parseAir(source);
  return new AppRuntime(model, {
    principal,
    clock,
    seedData: parseSeedData(data, model, { clock }),
    storage: new MemoryStorage(),
    idFactory: (resource) => `${resource}_new`
  });
}

function compiledSnapshot(model) {
  return {
    app: model.app,
    theme: model.theme,
    actors: [...model.actors],
    resources: [...model.entities.values()].map((resource) => ({
      id: resource.id,
      labelField: resource.labelField,
      fields: resource.fields.map((field) => ({
        id: field.id, type: field.type, label: field.label, required: field.required,
        unique: field.unique, values: field.values, ref: field.ref, default: field.default,
        currency: field.currency, computed: field.computed ?? null
      }))
    })),
    management: [...model.management],
    access: [...model.access].map(([id, policies]) => [id, Object.fromEntries(Object.entries(policies).map(([action, policy]) => [action, policy.source]))]),
    rules: model.rules,
    highlights: [...model.highlights],
    pages: model.pages
  };
}

async function contextPatch(name) {
  return readFile(new URL(`../experiments/context/patches/${name}.airpatch`, import.meta.url), "utf8");
}

test("scoped authorization filters reads and enforces writes below the UI", () => {
  const admin = runtime();
  assert.equal(admin.query("customers", { paginate: false }).total, 12);

  const maya = runtime(application, { actor: "account_managers", id: "am_01", roles: [] });
  assert.deepEqual(maya.query("customers", { paginate: false }).records.map((record) => record.id), ["c_01", "c_10", "c_07", "c_03"]);
  assert.deepEqual(maya.query("account_managers", { paginate: false }).records.map((record) => record.id), ["am_01"]);
  assert.equal(maya.update("customers", "c_01", { notes: "Owned" }).record.notes, "Owned");
  assert.throws(() => maya.update("customers", "c_02", { notes: "Blocked" }), /not permitted/);
  assert.throws(() => maya.update("account_managers", "am_02", { name: "Blocked" }), /not permitted/);
});

test("ownership and grouped aggregates are reusable outside Customer Manager", () => {
  const source = `air version=2
app publishing
resource authors
field authors.name text required
actor authors
manage authors
access authors view=self edit=self
resource posts
field posts.title text required
field posts.author ref=authors required
field posts.state enum values=Draft,Published
manage posts
access posts view=owner:author edit=owner:author
insight authors.published_posts op=count source=posts group=author where=state:Published
`;
  const data = JSON.stringify({
    authors: [{ id: "a1", name: "Ada" }, { id: "a2", name: "Lin" }],
    posts: [
      { id: "p1", title: "One", author: "a1", state: "Published" },
      { id: "p2", title: "Two", author: "a1", state: "Draft" },
      { id: "p3", title: "Three", author: "a2", state: "Published" }
    ]
  });
  const author = runtime(source, { actor: "authors", id: "a1", roles: [] }, fixedClock, data);
  assert.deepEqual(author.query("posts", { paginate: false }).records.map((record) => record.id), ["p1", "p2"]);
  assert.equal(author.get("authors", "a1").published_posts, 1);
});

test("semantic add creates relationships and fails closed for invalid targets", async () => {
  const source = applyPatch(application, await contextPatch("02-multiple-contacts"));
  const model = parseAir(source);
  assert.equal(model.entities.get("contacts").fieldMap.get("customer").ref, "customers");
  assert.ok(model.pageMap.has("contacts"));
  const seeded = JSON.parse(seedSource);
  seeded.contacts = [
    { id: "ct_01", name: "Acme contact", email: "one@acme.studio", customer: "c_01" },
    { id: "ct_02", name: "Lumen contact", email: "one@lumenlabs.io", customer: "c_02" }
  ];
  const maya = runtime(source, { actor: "account_managers", id: "am_01", roles: [] }, fixedClock, JSON.stringify(seeded));
  assert.deepEqual(maya.query("contacts", { paginate: false }).records.map((record) => record.id), ["ct_01"]);
  assert.equal(maya.can("contacts", "create"), true);
  assert.equal(maya.create("contacts", { name: "Second Acme contact", customer: "c_01" }).record.customer, "c_01");
  assert.throws(() => maya.create("contacts", { name: "Blocked contact", customer: "c_02" }), /not permitted/);
  assert.throws(() => applyPatch(application, "add field contacts.customer ref=missing required\n"), /owner .* is not a resource|unknown referenced resource/);
  assert.throws(() => applyPatch(application, "add field customers.name text\n"), /cannot insert existing/);
  assert.throws(() => applyPatch(application, "set field customers.missing label=X\n"), /cannot set missing/);
  assert.throws(() => applyPatch(application, "set access customers view=owner:account_manager.name\n"), /not a reference/);
});

test("patch preconditions detect conflicts and patch application is atomic", async () => {
  const patch = await contextPatch("06-expire-45");
  assert.match(semanticDiff(application, applyPatch(application, patch)), /30d -> 45d/);
  assert.throws(() => applyPatch(application, "set rule customers.expire after=60d was_after=29d\n"), /patch conflict/);
  assert.throws(() => applyPatch(application, "set rule customers.expire after=45d was_after=30d\nadd field customers.bad ref=missing\n"), /unknown referenced resource/);
  assert.match(application, /after=30d/);
});

test("semantic patches do not change unrelated declarations", async () => {
  const patch = await contextPatch("01-preferred-language");
  const result = applyPatch(application, patch);
  const before = new Map(semanticSnapshot(application).map((item) => [`${item.kind}:${item.id}`, JSON.stringify(item)]));
  const after = new Map(semanticSnapshot(result).map((item) => [`${item.kind}:${item.id}`, JSON.stringify(item)]));
  for (const [address, value] of before) assert.equal(after.get(address), value, address);
  assert.ok(after.has("field:customers.preferred_language"));
});

test("already-satisfied intent is an assertion with zero semantic changes", async () => {
  const result = applyPatch(application, await contextPatch("04-own-customers"));
  assert.deepEqual(semanticSnapshot(result), semanticSnapshot(application));
  assert.equal(semanticDiff(application, result), "No semantic changes.");
});

test("metadata rename preserves field identity and stored data key", async () => {
  const source = applyPatch(application, await contextPatch("07-tax-id"));
  const field = parseAir(source).entities.get("customers").fieldMap.get("vat_number");
  assert.equal(field.address, "customers.vat_number");
  assert.equal(field.label, "Tax ID");
  assert.equal(runtime(source).records("customers")[0].vat_number, "US-ACME-1042");
});

test("lifecycle duration mutation changes only the declared threshold", async () => {
  const source = applyPatch(application, await contextPatch("06-expire-45"));
  const later = runtime(source, { roles: ["admin"] }, () => new Date("2026-10-20T12:00:00Z"));
  assert.equal(later.records("customers").find((record) => record.id === "c_02").status, "Trial");
  assert.match(semanticDiff(application, source), /30d -> 45d/);
});

test("relationship aggregates compute per owner and respect scoped visibility", async () => {
  const source = applyPatch(application, await contextPatch("05-active-count"));
  const admin = runtime(source);
  assert.equal(admin.get("account_managers", "am_01").active_customers, 3);
  assert.equal(admin.get("account_managers", "am_02").active_customers, 2);
  const maya = runtime(source, { actor: "account_managers", id: "am_01", roles: [] });
  assert.equal(maya.get("account_managers", "am_01").active_customers, 3);
  assert.equal(maya.get("account_managers", "am_02"), null);
});

test("semantic highlights carry intent without application CSS", async () => {
  const source = applyPatch(application, await contextPatch("08-vip-highlight"));
  const app = runtime(source);
  const updated = app.update("customers", "c_01", { status: "VIP" }).record;
  assert.equal(app.highlight("customers", updated), "accent");
});

test("semantic explanation and diff are generated from the AIR model", async () => {
  const explanation = explainModel(application);
  assert.match(explanation, /linked account_managers in account_manager/);
  assert.match(explanation, /Trial -> Expired after 30d/);
  const changed = applyPatch(application, await contextPatch("07-tax-id"));
  assert.equal(semanticDiff(application, changed), "~ field customers.vat_number.label: VAT Number -> Tax ID");
});

test("parse serialize parse has an identical semantic snapshot", () => {
  const first = parseAir(application);
  const serialized = serializeDeclarations(first.declarations);
  const second = parseAir(serialized);
  assert.deepEqual(semanticSnapshot(second), semanticSnapshot(first));
  assert.deepEqual(compiledSnapshot(second), compiledSnapshot(first));
  assert.equal(serializeDeclarations(second.declarations), serialized);
});

test("capability discovery returns a dependency-closed relevant subset", () => {
  const catalog = parseCapabilityCatalog(catalogSource);
  const result = searchCapabilities(catalog, "ownership scoped permission");
  const ids = new Set(result.map((capability) => capability.id));
  for (const id of ["access", "actor", "relationship", "manage", "resource", "field"]) assert.ok(ids.has(id), id);
  assert.ok(result.length < catalog.capabilities.size);
});
