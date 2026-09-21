#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../web/runtime/air.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const native = path.join(repository, "target/debug/airc");
const musl = path.join(repository, "target/x86_64-unknown-linux-musl/debug/airc");
const airc = process.env.AIRC ?? (await readFile(native).then(() => native).catch(() => musl));
const temporary = await mkdtemp(path.join(tmpdir(), "air-dual-"));

try {
  const validDirectory = path.join(repository, "conformance/valid");
  const fixtures = (await readdir(validDirectory)).filter((name) => name.endsWith(".air")).sort().map((name) => path.join(validDirectory, name));
  const applications = ["customer-manager", "expense-approval", "content-publishing"].map((name) => path.join(repository, `apps/${name}.air`));
  for (const [index, source] of [...fixtures, ...applications].entries()) {
    const output = path.join(temporary, `${index}.airb`);
    execFileSync(airc, ["compile", source, "-o", output], { stdio: "ignore" });
    const rust = JSON.parse(execFileSync(airc, ["inspect", output], { encoding: "utf8" }));
    const javascript = JSON.parse(canonicalJson(await readFile(source, "utf8")));
    assert.deepEqual(rust, javascript, source);
  }
  process.stdout.write(`Dual canonical conformance passed: ${fixtures.length} fixtures + ${applications.length} applications\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
