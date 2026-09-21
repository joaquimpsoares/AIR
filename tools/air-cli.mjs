#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { explainModel, parseAir, semanticDiff, workflowDiagram } from "../web/runtime/air.mjs";
import { formatCapabilitySelection, parseCapabilityCatalog, searchCapabilities } from "./capabilities.mjs";

const [command, ...args] = process.argv.slice(2);

async function main() {
  if (command === "capabilities" && args.shift() === "search") {
    const source = await readFile(new URL("../CAPABILITIES.aircat", import.meta.url), "utf8");
    const catalog = parseCapabilityCatalog(source);
    process.stdout.write(formatCapabilitySelection(searchCapabilities(catalog, args.join(" "))));
    return;
  }
  if (command === "explain" && args.length === 1) {
    process.stdout.write(`${explainModel(await readFile(args[0], "utf8"))}\n`);
    return;
  }
  if (command === "diff" && args.length === 2) {
    const [before, after] = await Promise.all(args.map((file) => readFile(file, "utf8")));
    process.stdout.write(`${semanticDiff(before, after)}\n`);
    return;
  }
  if (command === "workflow" && args.length === 1) {
    process.stdout.write(`${workflowDiagram(await readFile(args[0], "utf8"))}\n`);
    return;
  }
  if (command === "check" && args.length === 1) {
    const model = parseAir(await readFile(args[0], "utf8"));
    process.stdout.write(`valid AIR v${model.version}: ${model.app.id}\n`);
    return;
  }
  throw new Error("usage: air capabilities search <query> | air explain <app.air> | air workflow <app.air> | air diff <old.air> <new.air> | air check <app.air>");
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
