#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AirError, AppRuntime, canonicalJson, parseAir, parseSeedData, semanticIr } from "../web/runtime/air.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../conformance");

async function files(directory, suffix) {
  return (await readdir(path.join(root, directory))).filter((name) => name.endsWith(suffix)).sort();
}

async function runValid(update) {
  let count = 0;
  for (const name of await files("valid", ".air")) {
    const base = path.join(root, "valid", name);
    const actual = `${canonicalJson(await readFile(base, "utf8"))}\n`;
    const expected = base.replace(/\.air$/, ".expected.json");
    if (update) await writeFile(expected, actual);
    else assert.deepEqual(JSON.parse(actual), JSON.parse(await readFile(expected, "utf8")), name);
    count += 1;
  }
  return count;
}

async function runInvalid() {
  let count = 0;
  for (const name of await files("invalid", ".air")) {
    const base = path.join(root, "invalid", name);
    const expected = JSON.parse(await readFile(base.replace(/\.air$/, ".error.json"), "utf8"));
    let error = null;
    try { parseAir(await readFile(base, "utf8")); } catch (caught) { error = caught; }
    assert(error instanceof AirError, `${name} did not fail with AirError`);
    assert.equal(error.code, expected.code, `${name} code`);
    assert.equal(error.phase, expected.phase, `${name} phase`);
    assert.equal(error.line, expected.line, `${name} line`);
    assert.equal(error.path, expected.path, `${name} path`);
    count += 1;
  }
  return count;
}

async function runCanonical() {
  let count = 0;
  for (const name of await files("canonical", ".pair.json")) {
    const manifest = JSON.parse(await readFile(path.join(root, "canonical", name), "utf8"));
    const values = await Promise.all(manifest.sources.map(async (source) => semanticIr(await readFile(path.join(root, "canonical", source), "utf8"))));
    for (const value of values.slice(1)) assert.deepEqual(value, values[0], name);
    count += 1;
  }
  return count;
}

function eventResult(event) {
  return {
    transition: event.transition, event: event.event, from: event.from, to: event.to,
    actor: event.actor, at: event.at, comment: event.comment, completed: event.completed
  };
}

async function executeCase(file) {
  const directory = path.join(root, "execution");
  const testCase = JSON.parse(await readFile(path.join(directory, file), "utf8"));
  const model = parseAir(await readFile(path.join(directory, testCase.program), "utf8"));
  const clock = () => new Date(testCase.clock);
  const seed = testCase.seedFile
    ? JSON.parse(await readFile(path.join(directory, testCase.seedFile), "utf8"))
    : testCase.seed;
  const runtime = new AppRuntime(model, {
    clock, principal: testCase.principal,
    seedData: parseSeedData(seed, model, { clock })
  });
  const results = [];
  for (const step of testCase.steps) {
    if (step.principal) runtime.principal = step.principal;
    if (step.op === "transition") {
      const process = model.processes.get(step.resource);
      try {
        const result = runtime.transition(step.resource, step.id, step.action, step.input ?? {});
        results.push({
          op: step.op, allowed: true, completed: result.completed,
          state: result.record[process.state], approvals: result.approvals,
          approvalsRequired: result.approvalsRequired,
          events: result.events.map(eventResult)
        });
      } catch (error) {
        const record = runtime.get(step.resource, step.id, { includeArchived: true });
        results.push({
          op: step.op, allowed: false, code: error.code, phase: error.phase,
          state: record?.[process.state] ?? null,
          historyLength: runtime.history(step.resource, step.id).length
        });
      }
    } else if (step.op === "status") {
      const record = runtime.get(step.resource, step.id, { includeArchived: true });
      results.push({ op: step.op, ...runtime.workflowStatus(step.resource, record) });
    } else throw new Error(`unknown execution operation ${step.op}`);
  }
  return results;
}

async function runExecution(update) {
  let count = 0;
  for (const name of await files("execution", ".case.json")) {
    const actual = await executeCase(name);
    const expected = path.join(root, "execution", name.replace(/\.case\.json$/, ".expected.json"));
    if (update) await writeFile(expected, `${JSON.stringify(actual, null, 2)}\n`);
    else assert.deepEqual(actual, JSON.parse(await readFile(expected, "utf8")), name);
    count += 1;
  }
  return count;
}

export async function runConformance({ update = false } = {}) {
  const valid = await runValid(update);
  const invalid = await runInvalid();
  const canonical = await runCanonical();
  const execution = await runExecution(update);
  return { valid, invalid, canonical, execution, total: valid + invalid + canonical + execution };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runConformance({ update: process.argv.includes("--update") })
    .then((result) => process.stdout.write(`AIR v2 conformance: ${result.total} passed (${result.valid} valid, ${result.invalid} invalid, ${result.canonical} canonical, ${result.execution} execution)\n`))
    .catch((error) => { process.stderr.write(`${error.stack ?? error.message}\n`); process.exitCode = 1; });
}
