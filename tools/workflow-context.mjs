import { readFile } from "node:fs/promises";
import { applyPatch, parseAir, semanticDiff, serializeDeclarations, tokenizeLine } from "../web/runtime/air.mjs";
import { approximateTokens, formatCapabilitySelection, parseCapabilityCatalog, searchCapabilities } from "./capabilities.mjs";

const [application, seedSource, catalogSource, requestSource] = await Promise.all([
  readFile(new URL("../apps/expense-approval.air", import.meta.url), "utf8"),
  readFile(new URL("../data/expense-approval.seed.json", import.meta.url), "utf8"),
  readFile(new URL("../CAPABILITIES.aircat", import.meta.url), "utf8"),
  readFile(new URL("../experiments/workflow/requests.json", import.meta.url), "utf8")
]);
const catalog = parseCapabilityCatalog(catalogSource);
const requests = JSON.parse(requestSource);
const applicationTokens = approximateTokens(application);

function declarationMap(source) {
  return new Map(parseAir(source).declarations.map((declaration) => [
    `${declaration.kind}:${declaration.id ?? ""}`,
    serializeDeclarations([declaration]).trimEnd()
  ]));
}

function physicalLines(source) {
  return source.split(/\r?\n/).filter((line, index) => tokenizeLine(line, index + 1).length);
}

const results = [];
for (const request of requests) {
  const patch = await readFile(new URL(`../experiments/workflow/patches/${request.id}.airpatch`, import.meta.url), "utf8");
  const relevantCatalog = formatCapabilitySelection(searchCapabilities(catalog, request.capabilityQuery));
  const result = applyPatch(application, patch);
  parseAir(result);
  const before = declarationMap(application);
  const after = declarationMap(result);
  const changed = [...new Set([...before.keys(), ...after.keys()])]
    .filter((address) => before.get(address) !== after.get(address)).sort();
  const expected = [...request.expectedAddresses].sort();
  const requestTokens = approximateTokens(request.request);
  const capabilityTokens = approximateTokens(relevantCatalog);
  const relevantContextTokens = applicationTokens + capabilityTokens;
  const totalAiContextTokens = relevantContextTokens + requestTokens;
  results.push({
    id: request.id,
    request: request.request,
    airLinesTouched: changed.length,
    changedAddresses: changed,
    patchLines: physicalLines(patch).length,
    patchBytes: Buffer.byteLength(patch),
    patchTokens: approximateTokens(patch),
    relevantCatalogTokens: capabilityTokens,
    applicationTokens,
    requestTokens,
    relevantContextTokens,
    totalAiContextTokens,
    runtimeSourceTokens: 0,
    runtimeChanges: "none",
    unrelatedAirChanged: JSON.stringify(changed) !== JSON.stringify(expected),
    validation: "pass",
    conventionalTokens: request.conventionalTokens,
    contextCompressionRatio: Number((request.conventionalTokens / totalAiContextTokens).toFixed(2)),
    semanticDiff: semanticDiff(application, result)
  });
}

const categoryFor = {
  air: "base", app: "base", theme: "base", capability: "base", resource: "base", field: "base", manage: "base", overview: "base",
  process: "workflow", transition: "workflow",
  actor: "permissions", access: "permissions",
  deadline: "temporal",
  parameter: "business", insight: "business", invariant: "business"
};
const sourceLines = application.split(/\r?\n/);
const model = parseAir(application);
const buckets = new Map(["base", "workflow", "permissions", "temporal", "business"].map((name) => [name, []]));
for (const declaration of model.declarations) buckets.get(categoryFor[declaration.kind]).push(sourceLines[declaration.line - 1]);
const order = ["base", "workflow", "permissions", "temporal", "business"];
const growth = [];
let cumulative = [];
for (const name of order) {
  const lines = buckets.get(name);
  cumulative = [...cumulative, ...lines];
  const source = `${lines.join("\n")}\n`;
  const cumulativeSource = `${cumulative.join("\n")}\n`;
  growth.push({
    stage: name,
    addedLines: lines.length,
    addedBytes: Buffer.byteLength(source),
    addedTokens: approximateTokens(source),
    cumulativeLines: cumulative.length,
    cumulativeBytes: Buffer.byteLength(cumulativeSource),
    cumulativeTokens: approximateTokens(cumulativeSource)
  });
}

function nonblankSourceLines(source) {
  return source.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*");
  }).length;
}

const runtimeFiles = ["web/runtime/air.mjs", "web/runtime/ui.mjs", "web/runtime/styles.css"];
let runtimeLines = 0;
let runtimeBytes = 0;
for (const path of runtimeFiles) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  runtimeLines += nonblankSourceLines(source);
  runtimeBytes += Buffer.byteLength(source);
}
const runtimeBaseline = { lines: 1782, bytes: 113564 };

const report = {
  methodology: "tokens=ceil(UTF-8 bytes/4); fresh context=expense AIR+dependency-closed relevant catalog+request; runtime source excluded; each patch applied independently",
  expenseAir: {
    lines: physicalLines(application).length,
    bytes: Buffer.byteLength(application),
    approximateTokens: applicationTokens
  },
  seedData: {
    lines: seedSource.split(/\r?\n/).filter((line) => line.trim()).length,
    bytes: Buffer.byteLength(seedSource),
    approximateTokens: approximateTokens(seedSource)
  },
  representationGrowth: growth,
  fullCapabilityCatalogTokens: approximateTokens(catalogSource),
  maximumRelevantContextTokens: Math.max(...results.map((result) => result.relevantContextTokens)),
  maximumTotalAiContextTokens: Math.max(...results.map((result) => result.totalAiContextTokens)),
  runtime: {
    baseline: runtimeBaseline,
    current: { lines: runtimeLines, bytes: runtimeBytes },
    added: { lines: runtimeLines - runtimeBaseline.lines, bytes: runtimeBytes - runtimeBaseline.bytes },
    classification: {
      generic: ["bounded conditions and parameters", "process graph and transitions", "actor/action authority and separation of duty", "approval cardinality and internal events", "conditional invariants", "temporal status", "conditional/windowed aggregates", "generic workflow UI and Mermaid projection"],
      questionable: [
        "record-local history is generic but not tamper-evident or server-authoritative",
        "bd is deterministic UTC Monday-Friday, not a regional holiday-aware business calendar"
      ],
      domainSpecific: []
    }
  },
  results
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
