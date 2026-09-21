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
  serializeDeclarations,
  workflowDiagram
} from "../web/runtime/air.mjs";

const expenseSource = await readFile(new URL("../apps/expense-approval.air", import.meta.url), "utf8");
const expenseSeedSource = await readFile(new URL("../data/expense-approval.seed.json", import.meta.url), "utf8");
const contentSource = await readFile(new URL("../apps/content-publishing.air", import.meta.url), "utf8");
const contentSeedSource = await readFile(new URL("../data/content-publishing.seed.json", import.meta.url), "utf8");
const fixedClock = () => new Date("2026-09-20T12:00:00Z");

const alice = { actor: "users", id: "u_01", roles: ["employee"] };
const jordan = { actor: "users", id: "u_02", roles: ["manager"] };
const priya = { actor: "users", id: "u_04", roles: ["finance"] };
const lee = { actor: "users", id: "u_05", roles: ["finance"] };

function expenseRuntime(options = {}) {
  const source = options.source ?? expenseSource;
  const model = parseAir(source);
  const seed = options.seed ?? expenseSeedSource;
  const clock = options.clock ?? fixedClock;
  let next = 1;
  return new AppRuntime(model, {
    seedData: parseSeedData(seed, model, { clock }),
    storage: new MemoryStorage(),
    principal: options.principal ?? alice,
    clock,
    idFactory: () => `x_new_${next++}`
  });
}

function newExpense(overrides = {}) {
  return {
    employee: "u_01", amount: 200, category: "Supplies", description: "Team materials",
    date: "2026-09-20", receipt_ref: "", travel_purpose: "", ...overrides
  };
}

async function workflowPatch(id) {
  return readFile(new URL(`../experiments/workflow/patches/${id}.airpatch`, import.meta.url), "utf8");
}

test("expense actors use one identity resource with manager relationship and finance role authority", () => {
  const model = parseAir(expenseSource);
  assert.deepEqual([...model.entities.keys()], ["users", "expenses"]);
  assert.equal(model.entities.get("users").fieldMap.get("manager").ref, "users");
  assert.equal(model.entities.get("expenses").fieldMap.get("employee").ref, "users");
  assert.equal(model.transitions.get("expenses.finance_approve").by.source, "role:finance");
});

test("guarded transitions stabilize deterministic low and mid-value routes", () => {
  const runtime = expenseRuntime();
  const low = runtime.create("expenses", newExpense()).record;
  const lowResult = runtime.transition("expenses", low.id, "submit");
  assert.equal(lowResult.record.status, "Approved");
  assert.deepEqual(lowResult.events.map((event) => event.event), ["submitted", "approved"]);

  const mid = runtime.create("expenses", newExpense({ amount: 1200, receipt_ref: "receipt:mid" })).record;
  assert.equal(runtime.transition("expenses", mid.id, "submit").record.status, "ManagerReview");
  runtime.principal = jordan;
  assert.equal(runtime.transition("expenses", mid.id, "approve", { comment: "Within policy" }).record.status, "Approved");
});

test("transition authority is state-, actor-, and relationship-dependent", () => {
  const runtime = expenseRuntime();
  assert.deepEqual(runtime.availableActions("expenses", "x_02").map((action) => action.action), []);
  assert.throws(() => runtime.transition("expenses", "x_02", "approve"), /authority/);
  runtime.principal = jordan;
  assert.deepEqual(runtime.availableActions("expenses", "x_02").map((action) => action.action).sort(), ["approve", "reject"]);
  assert.throws(() => runtime.transition("expenses", "x_03", "approve"), /authority/);
  runtime.principal = priya;
  assert.equal(runtime.transition("expenses", "x_03", "approve").record.status, "Approved");
});

test("separation of duty prevents self-approval even when the user also has the approving role", () => {
  const seed = JSON.parse(expenseSeedSource);
  seed.users[0].manager = "u_01";
  const runtime = expenseRuntime({ seed: JSON.stringify(seed), principal: { ...alice, roles: ["employee", "manager", "admin"] } });
  assert.throws(() => runtime.transition("expenses", "x_02", "approve"), /separation of duty/);
});

test("high-value expenses require sequential manager then finance approval", () => {
  const runtime = expenseRuntime();
  const high = runtime.create("expenses", newExpense({ amount: 7000, receipt_ref: "receipt:high" })).record;
  assert.equal(runtime.transition("expenses", high.id, "submit").record.status, "ManagerReview");
  runtime.principal = jordan;
  assert.equal(runtime.transition("expenses", high.id, "approve").record.status, "FinanceReview");
  runtime.principal = priya;
  assert.equal(runtime.transition("expenses", high.id, "approve").record.status, "Approved");
});

test("multi-approval evidence accumulates and requires different actors", async () => {
  const source = applyPatch(expenseSource, await workflowPatch("04-two-finance-approvals"));
  const runtime = expenseRuntime({ source });
  const high = runtime.create("expenses", newExpense({ amount: 12000, receipt_ref: "receipt:large" })).record;
  runtime.transition("expenses", high.id, "submit");
  runtime.principal = jordan;
  runtime.transition("expenses", high.id, "approve");
  runtime.principal = priya;
  const first = runtime.transition("expenses", high.id, "approve", { comment: "First review" });
  assert.equal(first.completed, false);
  assert.equal(first.record.status, "FinanceReview");
  assert.deepEqual([first.approvals, first.approvalsRequired], [1, 2]);
  assert.throws(() => runtime.transition("expenses", high.id, "approve"), /different actor/);
  runtime.principal = lee;
  const second = runtime.transition("expenses", high.id, "approve", { comment: "Second review" });
  assert.equal(second.completed, true);
  assert.equal(second.record.status, "Approved");
});

test("conditional validation and required rejection comments are runtime-enforced", () => {
  const runtime = expenseRuntime();
  assert.equal(runtime.create("expenses", newExpense({ amount: 600 })).errors.receipt_ref, "Receipt reference is required by receipt");
  assert.equal(runtime.create("expenses", newExpense({ category: "Travel" })).errors.travel_purpose, "Travel Purpose is required by travel");
  runtime.principal = jordan;
  assert.throws(() => runtime.transition("expenses", "x_02", "reject"), /requires a comment/);
  const rejected = runtime.transition("expenses", "x_02", "reject", { comment: "Missing cost centre" });
  assert.equal(rejected.record.status, "Rejected");
  assert.equal(rejected.events[0].comment, "Missing cost centre");
});

test("state-dependent immutability applies below the UI", async () => {
  const runtime = expenseRuntime();
  const approved = runtime.create("expenses", newExpense()).record;
  runtime.transition("expenses", approved.id, "submit");
  assert.match(runtime.update("expenses", approved.id, { amount: 201 }).errors.amount, /immutable/);
  const paid = expenseRuntime();
  assert.match(paid.update("expenses", "x_05", { description: "Changed" }).errors.description, /immutable/);
  assert.deepEqual(paid.editableFields("expenses", paid.get("expenses", "x_05")), []);
});

test("business-day deadlines derive overdue and escalation without changing business state", () => {
  const overdue = expenseRuntime({ clock: () => new Date("2026-09-23T12:00:00Z") });
  const status = overdue.workflowStatus("expenses", overdue.records("expenses").find((record) => record.id === "x_02"));
  assert.equal(status.deadline, "2026-09-22T00:00:00.000Z");
  assert.equal(status.status, "EscalationRequired");
  assert.equal(status.overdue, true);
  assert.equal(overdue.get("expenses", "x_02").status, "ManagerReview");
});

test("monthly aggregate and relationship data influence routing deterministically", () => {
  const seed = JSON.parse(expenseSeedSource);
  seed.users[0].monthly_budget = 300;
  const runtime = expenseRuntime({ seed: JSON.stringify(seed) });
  assert.equal(runtime.get("users", "u_01").monthly_spend, 250);
  const expense = runtime.create("expenses", newExpense({ amount: 100 })).record;
  assert.equal(runtime.transition("expenses", expense.id, "submit").record.status, "FinanceReview");
});

test("transition history is append-only evidence and semantic events are returned", () => {
  const runtime = expenseRuntime();
  const expense = runtime.create("expenses", newExpense()).record;
  runtime.transition("expenses", expense.id, "submit");
  const history = runtime.history("expenses", expense.id);
  assert.deepEqual(history.map((entry) => entry.event), ["created", "submitted", "approved"]);
  assert.deepEqual(history.map((entry) => entry.actor.id), ["u_01", "u_01", "system"]);
  const attempted = runtime.update("expenses", expense.id, { _air_history: [] });
  assert.equal(attempted.record?._air_history.length, 3);
});

test("static workflow validation rejects invalid states, actors, guards, cardinality, separation, and graphs", () => {
  assert.throws(() => parseAir(`${expenseSource}transition expenses.bad from=Missing to=Paid action=x by=role:finance\n`), /nonexistent state/);
  assert.throws(() => parseAir(expenseSource.replace("by=role:finance separate=employee", "by=owner:employee.missing separate=employee")), /not a reference/);
  assert.throws(() => parseAir(`${expenseSource}transition expenses.bad from=Draft to=Paid action=x by=role:finance approvals=1 distinct=true\n`), /approvals >= 2/);
  assert.throws(() => parseAir(`${expenseSource}transition expenses.cancel_copy from=Draft to=Cancelled action=cancel by=owner:employee event=other_name\n`), /duplicate transition semantics/);
  assert.throws(() => parseAir(expenseSource.replace("separate=employee comment=optional event=manager_approved", "separate=employee.manager comment=optional event=manager_approved")), /no actor can satisfy/);
  assert.throws(() => parseAir(`${expenseSource}transition expenses.bad from=Draft to=Paid action=x by=role:finance when=\"amount>10&amount<5\"\n`), /contradictory bounds/);
  assert.throws(() => parseAir(expenseSource.replace("values=Draft,Submitted,ManagerReview,FinanceReview,Approved,Rejected,PaymentPending,Paid,Cancelled", "values=Draft,Submitted,ManagerReview,FinanceReview,Approved,Rejected,PaymentPending,Paid,Cancelled,Orphan")), /unreachable states: Orphan/);
  assert.throws(() => parseAir(expenseSource.replace("terminal=Paid,Cancelled", "terminal=Paid")), /non-terminal states without exits: Cancelled/);
  assert.throws(() => parseAir(expenseSource.replace("after=3bd", "after=0bd")), /positive duration/);
});

test("workflow patches are atomic, isolated, and produce semantic diffs", async () => {
  const patch = await workflowPatch("01-auto-approve-750");
  const changed = applyPatch(expenseSource, patch);
  assert.match(semanticDiff(expenseSource, changed), /Automatic approval limit.*500 -> 750/);
  assert.throws(() => applyPatch(expenseSource, "set parameter expenses.auto_limit value=750 was_value=499\n"), /patch conflict/);
  assert.equal(parseAir(changed).parameters.get("expenses").get("auto_limit").value, 750);
  const approvalSplit = await workflowPatch("04-two-finance-approvals");
  assert.throws(() => applyPatch(applyPatch(expenseSource, approvalSplit), approvalSplit), /expected `<absent>`/);
});

test("all ten independent workflow modifications have the requested behavior", async () => {
  const auto750 = expenseRuntime({ source: applyPatch(expenseSource, await workflowPatch("01-auto-approve-750")) });
  const sixHundred = auto750.create("expenses", newExpense({ amount: 600, receipt_ref: "receipt:600" })).record;
  assert.equal(auto750.transition("expenses", sixHundred.id, "submit").record.status, "Approved");

  const finance4000 = expenseRuntime({ source: applyPatch(expenseSource, await workflowPatch("02-finance-above-4000")) });
  const fortyFive = finance4000.create("expenses", newExpense({ amount: 4500, receipt_ref: "receipt:4500" })).record;
  finance4000.transition("expenses", fortyFive.id, "submit");
  finance4000.principal = jordan;
  assert.equal(finance4000.transition("expenses", fortyFive.id, "approve").record.status, "FinanceReview");

  let now = new Date("2026-09-20T12:00:00Z");
  const revise14 = expenseRuntime({ source: applyPatch(expenseSource, await workflowPatch("03-revise-within-14d")), clock: () => now });
  revise14.principal = jordan;
  revise14.transition("expenses", "x_02", "reject", { comment: "Revise" });
  revise14.principal = alice;
  now = new Date("2026-10-05T12:00:00Z");
  assert.throws(() => revise14.transition("expenses", "x_02", "revise"), /time window/);

  const directFinance = expenseRuntime({ source: applyPatch(expenseSource, await workflowPatch("05-high-value-direct-finance")) });
  const twentyOne = directFinance.create("expenses", newExpense({ amount: 21000, receipt_ref: "receipt:21000" })).record;
  assert.equal(directFinance.transition("expenses", twentyOne.id, "submit").record.status, "FinanceReview");

  const legal = expenseRuntime({ source: applyPatch(expenseSource, await workflowPatch("06-regulatory-legal-review")) });
  const regulated = legal.create("expenses", newExpense({ amount: 7000, category: "Regulatory", receipt_ref: "receipt:reg" })).record;
  legal.transition("expenses", regulated.id, "submit");
  legal.principal = jordan;
  legal.transition("expenses", regulated.id, "approve");
  legal.principal = priya;
  assert.equal(legal.transition("expenses", regulated.id, "approve").record.status, "LegalReview");
  legal.principal = { actor: "users", id: "u_05", roles: ["legal"] };
  assert.equal(legal.transition("expenses", regulated.id, "approve").record.status, "Approved");

  assert.equal(semanticDiff(expenseSource, applyPatch(expenseSource, await workflowPatch("08-rejection-reason"))), "No semantic changes.");
  assert.equal(semanticDiff(expenseSource, applyPatch(expenseSource, await workflowPatch("07-paid-immutable"))), "No semantic changes.");
  assert.equal(parseAir(applyPatch(expenseSource, await workflowPatch("09-manager-deadline-2bd"))).deadlines.get("expenses")[0].duration.source, "2bd");

  const withdraw = expenseRuntime({ source: applyPatch(expenseSource, await workflowPatch("10-withdraw-before-approval")) });
  assert.equal(withdraw.transition("expenses", "x_02", "withdraw").record.status, "Draft");
  const high = withdraw.create("expenses", newExpense({ amount: 7000, receipt_ref: "receipt:withdraw" })).record;
  withdraw.transition("expenses", high.id, "submit");
  withdraw.principal = jordan;
  withdraw.transition("expenses", high.id, "approve");
  withdraw.principal = alice;
  assert.throws(() => withdraw.transition("expenses", high.id, "withdraw"), /prior event/);
});

test("explain, diff, and Mermaid workflow views are generated from semantics", async () => {
  const explanation = explainModel(expenseSource);
  assert.match(explanation, /Submitted -> Approved: automatic when amount<@auto_limit/);
  assert.match(explanation, /actor must differ from employee/);
  assert.match(explanation, /Deadline ManagerReview: 3bd; escalation required/);
  const changed = applyPatch(expenseSource, await workflowPatch("09-manager-deadline-2bd"));
  assert.equal(semanticDiff(expenseSource, changed), "~ deadline expenses.manager_review.after: 3bd -> 2bd");
  const diagram = workflowDiagram(expenseSource);
  assert.match(diagram, /^flowchart TD/m);
  assert.match(diagram, /expenses_ManagerReview -->\|"approve/);
  assert.match(diagram, /expenses_Paid:::terminal/);
});

test("workflow parse-serialize-parse round trip is semantically and byte stable", () => {
  const original = parseAir(expenseSource);
  const serialized = serializeDeclarations(original.declarations);
  const reparsed = parseAir(serialized);
  assert.deepEqual(semanticSnapshot(reparsed), semanticSnapshot(expenseSource));
  assert.equal(explainModel(reparsed), explainModel(original));
  assert.equal(workflowDiagram(reparsed), workflowDiagram(original));
  assert.equal(serializeDeclarations(reparsed.declarations), serialized);
});

test("the same primitives implement conditional content publishing", () => {
  const model = parseAir(contentSource);
  const runtime = new AppRuntime(model, {
    seedData: parseSeedData(contentSeedSource, model, { clock: fixedClock }),
    storage: new MemoryStorage(), principal: { actor: "users", id: "author_1", roles: ["author"] }, clock: fixedClock
  });
  assert.equal(runtime.transition("articles", "article_1", "submit").record.state, "EditorialReview");
  runtime.principal = { actor: "users", id: "editor_1", roles: ["editor"] };
  assert.equal(runtime.transition("articles", "article_1", "approve").record.state, "LegalReview");
  runtime.principal = { actor: "users", id: "legal_1", roles: ["legal"] };
  assert.equal(runtime.transition("articles", "article_1", "approve").record.state, "Published");
});

test("shared runtime and UI contain no Expense Approval or publishing branches", async () => {
  const [engine, ui] = await Promise.all([
    readFile(new URL("../web/runtime/air.mjs", import.meta.url), "utf8"),
    readFile(new URL("../web/runtime/ui.mjs", import.meta.url), "utf8")
  ]);
  for (const forbidden of ["Expense Approval", "FinanceReview", "receipt_ref", "Content Publishing", "EditorialReview"]) {
    assert.equal(engine.includes(forbidden), false, `engine hard-coded ${forbidden}`);
    assert.equal(ui.includes(forbidden), false, `UI hard-coded ${forbidden}`);
  }
});
