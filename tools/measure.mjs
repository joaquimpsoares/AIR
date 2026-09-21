import { readFile, readdir } from "node:fs/promises";
import { basename, extname } from "node:path";
import { applyPatch, parseAir, primitiveUsage, serializeDeclarations, tokenizeLine } from "../web/runtime/air.mjs";

const demos = [
  { name: "Customer Manager", path: "apps/customer-manager.air", seed: "data/customer-manager.seed.json", conventionalLoc: 1850 },
  { name: "Project / Task Board", path: "apps/task-board.air", seed: "data/task-board.seed.json", conventionalLoc: 1800 },
  { name: "Expense Approval", path: "apps/expense-approval.air", seed: "data/expense-approval.seed.json", conventionalLoc: 3000 },
  { name: "Content Publishing", path: "apps/content-publishing.air", seed: "data/content-publishing.seed.json", conventionalLoc: 900 }
];

function physicalRepresentationLines(source) {
  return source.split(/\r?\n/).filter((line, index) => tokenizeLine(line, index + 1).length > 0).length;
}

function sourceLines(source) {
  return source.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*");
  }).length;
}

function approximateTokens(bytes) {
  return Math.ceil(bytes / 4);
}

const results = [];
for (const demo of demos) {
  const source = await readFile(demo.path, "utf8");
  const bytes = Buffer.byteLength(source);
  const model = parseAir(source);
  const seedSource = await readFile(demo.seed, "utf8");
  const seedBytes = Buffer.byteLength(seedSource);
  const approximateConventionalTokens = Math.round(demo.conventionalLoc * 8.5);
  const tokens = approximateTokens(bytes);
  results.push({
    ...demo,
    lines: physicalRepresentationLines(source),
    bytes,
    approximateTokens: tokens,
    seedLines: seedSource.split(/\r?\n/).filter((line) => line.trim()).length,
    seedBytes,
    approximateSeedTokens: approximateTokens(seedBytes),
    primitives: primitiveUsage(model),
    handwrittenAppCodeLoc: 0,
    approximateConventionalTokens,
    tokenReductionPercent: Number(((1 - tokens / approximateConventionalTokens) * 100).toFixed(1)),
    lineReductionPercent: Number(((1 - physicalRepresentationLines(source) / demo.conventionalLoc) * 100).toFixed(1))
  });
}

const patchResults = [];
let evolvingSource = await readFile("experiments/baseline/customer-manager.air", "utf8");
for (const file of (await readdir("experiments/patches")).filter((file) => extname(file) === ".airpatch").sort()) {
  const source = await readFile(`experiments/patches/${file}`, "utf8");
  const bytes = Buffer.byteLength(source);
  const before = parseAir(evolvingSource).declarations;
  const nextSource = applyPatch(evolvingSource, source);
  const after = parseAir(nextSource).declarations;
  const lineMap = (declarations) => new Map(declarations.map((declaration) => [
    `${declaration.kind}:${declaration.id ?? ""}`,
    serializeDeclarations([declaration]).trimEnd()
  ]));
  const beforeLines = lineMap(before);
  const afterLines = lineMap(after);
  const changedAirLines = new Set([...beforeLines.keys(), ...afterLines.keys()])
    .size && [...new Set([...beforeLines.keys(), ...afterLines.keys()])]
      .filter((key) => beforeLines.get(key) !== afterLines.get(key)).length;
  patchResults.push({
    modification: basename(file, ".airpatch").replace(/^\d+-/, "").replaceAll("-", " "),
    file,
    lines: physicalRepresentationLines(source),
    bytes,
    approximateTokens: approximateTokens(bytes),
    changedAirLines,
    netAirBytes: Buffer.byteLength(nextSource) - Buffer.byteLength(evolvingSource)
  });
  evolvingSource = nextSource;
}

const runtimeFiles = ["web/runtime/air.mjs", "web/runtime/ui.mjs", "web/runtime/styles.css"];
let runtimeLoc = 0;
let runtimeBytes = 0;
for (const file of runtimeFiles) {
  const source = await readFile(file, "utf8");
  runtimeLoc += sourceLines(source);
  runtimeBytes += Buffer.byteLength(source);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ demos: results, patches: patchResults, sharedRuntime: { files: runtimeFiles.length, loc: runtimeLoc, bytes: runtimeBytes } }, null, 2));
} else {
  console.log("AIR prototype measurements\n");
  console.log("Application intent only (seed/storage data excluded)\n");
  console.log("Demo                 Lines  Bytes  ~Tokens  Primitives  App code  Conventional  Reduction");
  console.log("-------------------  -----  -----  -------  ----------  --------  ------------  ---------");
  for (const result of results) {
    console.log(`${result.name.padEnd(19)}  ${String(result.lines).padStart(5)}  ${String(result.bytes).padStart(5)}  ${String(result.approximateTokens).padStart(7)}  ${String(result.primitives.total).padStart(10)}  ${String(result.handwrittenAppCodeLoc).padStart(8)}  ${`${result.conventionalLoc} LOC`.padStart(12)}  ${`${result.tokenReductionPercent}% tok`.padStart(9)}`);
  }
  console.log("\nSeed/data layer (reported separately, never counted as AIR)\n");
  console.log("Demo                 Lines  Bytes  ~Tokens");
  console.log("-------------------  -----  -----  -------");
  for (const result of results) console.log(`${result.name.padEnd(19)}  ${String(result.seedLines).padStart(5)}  ${String(result.seedBytes).padStart(5)}  ${String(result.approximateSeedTokens).padStart(7)}`);
  console.log("\nSemantic modifications\n");
  console.log("Modification          Patch lines  Patch bytes  ~Tokens  AIR lines  Net AIR bytes");
  console.log("--------------------  -----------  -----------  -------  ---------  -------------");
  for (const patch of patchResults) {
    console.log(`${patch.modification.padEnd(20)}  ${String(patch.lines).padStart(11)}  ${String(patch.bytes).padStart(11)}  ${String(patch.approximateTokens).padStart(7)}  ${String(patch.changedAirLines).padStart(9)}  ${String(patch.netAirBytes).padStart(13)}`);
  }
  console.log(`\nShared reusable browser runtime: ${runtimeLoc} nonblank source lines, ${runtimeBytes} bytes across ${runtimeFiles.length} files.`);
  console.log("Token approximation: ceil(UTF-8 bytes / 4). Conventional estimate: inventory LOC × 8.5 tokens/LOC.");
}
