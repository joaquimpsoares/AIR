#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const wasm = await readFile(new URL("../dist/expense-approval.wasm", import.meta.url));
const module = new WebAssembly.Module(wasm);
const sections = WebAssembly.Module.customSections(module, "air.program");
assert.equal(sections.length, 1, "Wasm must contain one air.program section");
const program = new Uint8Array(sections[0]);
assert.equal(new TextDecoder().decode(program.slice(0, 4)), "AIR2");

const { exports } = await WebAssembly.instantiate(module, {});
assert.equal(exports.air_abi_version(), 2);

function write(bytes) {
  const pointer = exports.air_buffer(bytes.length);
  new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes);
  return bytes.length;
}

function writeJson(value) {
  return write(new TextEncoder().encode(JSON.stringify(value)));
}

function view() {
  const bytes = new Uint8Array(exports.memory.buffer, exports.air_view_ptr(), exports.air_view_len());
  return JSON.parse(new TextDecoder().decode(bytes));
}

assert.equal(exports.air_load(write(program)), 0, "AIR2 load");
const seed = JSON.parse(await readFile(new URL("../data/expense-approval.seed.json", import.meta.url), "utf8"));
assert.equal(exports.air_v2_start(writeJson({
  seed,
  principal: { actor: "users", id: "u_01", roles: ["employee"] },
  clock: "2026-09-20T12:00:00.000Z"
})), 0, "AIR v2 start");
assert.equal(exports.air_v2_transition(writeJson({
  resource: "expenses", id: "x_01", action: "submit"
})), 0, "AIR v2 transition");
const result = view();
assert.equal(result.record.status, "Approved");
assert.deepEqual(result.events.map((event) => event.event), ["submitted", "approved"]);
process.stdout.write(`Wasm AIR2 smoke passed: ${wasm.length} bytes, embedded program ${program.length} bytes, final state ${result.record.status}\n`);
