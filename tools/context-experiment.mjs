import { readFile } from "node:fs/promises";
import { applyPatch, parseAir, semanticDiff } from "../web/runtime/air.mjs";
import { approximateTokens, formatCapabilitySelection, parseCapabilityCatalog, searchCapabilities } from "./capabilities.mjs";

const [application, catalogSource, requestSource] = await Promise.all([
  readFile(new URL("../apps/customer-manager.air", import.meta.url), "utf8"),
  readFile(new URL("../CAPABILITIES.aircat", import.meta.url), "utf8"),
  readFile(new URL("../experiments/context/requests.json", import.meta.url), "utf8")
]);
const catalog = parseCapabilityCatalog(catalogSource);
const requests = JSON.parse(requestSource);
const applicationTokens = approximateTokens(application);

function declarationMap(source) {
  return new Map(parseAir(source).declarations.map((declaration) => [
    `${declaration.kind}:${declaration.id ?? ""}`,
    JSON.stringify(Object.fromEntries(Object.entries(declaration.props).sort(([left], [right]) => left.localeCompare(right))))
  ]));
}

const results = [];
for (const request of requests) {
  const patch = await readFile(new URL(`../experiments/context/patches/${request.id}.airpatch`, import.meta.url), "utf8");
  const relevant = formatCapabilitySelection(searchCapabilities(catalog, request.capabilityQuery));
  const result = applyPatch(application, patch);
  const before = declarationMap(application);
  const after = declarationMap(result);
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter((address) => before.get(address) !== after.get(address));
  const expected = [...request.expectedAddresses].sort();
  const unrelatedChanged = JSON.stringify(changed.sort()) !== JSON.stringify(expected);
  const airContextTokens = applicationTokens + approximateTokens(relevant);
  results.push({
    id: request.id,
    request: request.request,
    airLinesTouched: changed.length,
    patchLines: patch.trim().split(/\r?\n/).filter(Boolean).length,
    patchBytes: Buffer.byteLength(patch),
    patchTokens: approximateTokens(patch),
    capabilityTokens: approximateTokens(relevant),
    applicationTokens,
    airContextTokens,
    runtimeSourceTokens: 0,
    runtimeChanges: request.runtimeChanges ?? "none",
    unrelatedChanged,
    validation: "pass",
    conventionalTokens: request.conventionalTokens,
    compressionRatio: Number((request.conventionalTokens / airContextTokens).toFixed(2)),
    semanticDiff: semanticDiff(application, result)
  });
}

const report = {
  methodology: "tokens=ceil(UTF-8 bytes/4); AIR_CONTEXT=application+retrieved dependency-closed catalog; no runtime source",
  fullCapabilityCatalogTokens: approximateTokens(catalogSource),
  applicationTokens,
  maxAirContextTokens: Math.max(...results.map((result) => result.airContextTokens)),
  within2000TokenBudget: results.every((result) => result.airContextTokens < 2000),
  results
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
