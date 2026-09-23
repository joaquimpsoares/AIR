#!/usr/bin/env node
/**
 * AIR Automated Benchmark Runner & Footprint Measurement Engine
 *
 * Deterministically measures and verifies:
 * 1. Canonical AIR token count (via runtime tokenizeLine)
 * 2. Model / Source LLM tokens (via tokenizer.mjs standard cl100k_base tokenizer)
 * 3. Conventional Reference implementation metrics (LOC, bytes, tokens, categorized JS/TS/CSS/Config)
 * 4. Modification task costs (context tokens, patch tokens, files touched, compression ratio)
 * 5. Generates/updates benchmarks/results.json and validates against stale drift.
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import process from "node:process";
import { parseAir, tokenizeLine } from "../web/runtime/air.mjs";
import { countLLMTokens, measureSource } from "./tokenizer.mjs";

const root = new URL("..", import.meta.url).pathname;

async function walkDir(dir) {
  let files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(await walkDir(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist yet
  }
  return files;
}

function computeCanonicalAirTokens(airSource) {
  let tokenCount = 0;
  const lines = airSource.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const tokens = tokenizeLine(lines[i], i + 1);
    tokenCount += tokens.length;
  }
  return tokenCount;
}

export async function runBenchmarks() {
  const examples = [
    {
      id: "customer-manager",
      title: "Customer Manager",
      airPath: "showcase/customer-manager/app.air",
      seedPath: "showcase/customer-manager/seed.json",
      conventionalDir: "benchmarks/customer-manager/conventional",
      conventionalStack: "React 19 + TypeScript + Tailwind CSS + Zod + Zustand",
      modificationsDir: "benchmarks/customer-manager/modifications"
    },
    {
      id: "approval-workflow",
      title: "Approval Workflow",
      airPath: "showcase/approval-workflow/app.air",
      seedPath: "showcase/approval-workflow/seed.json",
      conventionalDir: "benchmarks/approval-workflow/conventional",
      conventionalStack: "React 19 + TypeScript + Tailwind CSS + XState + Express API",
      modificationsDir: "benchmarks/approval-workflow/modifications"
    },
    {
      id: "reservation-hub",
      title: "Reservation Hub",
      airPath: "showcase/reservation-hub/app.air",
      seedPath: "showcase/reservation-hub/seed.json",
      conventionalDir: "benchmarks/reservation-hub/conventional",
      conventionalStack: "NOT_YET_MEASURED",
      modificationsDir: "benchmarks/reservation-hub/modifications"
    },
    {
      id: "inventory-hub",
      title: "Inventory Hub",
      airPath: "showcase/inventory-hub/app.air",
      seedPath: "showcase/inventory-hub/seed.json",
      conventionalDir: "benchmarks/inventory-hub/conventional",
      conventionalStack: "PENDING",
      modificationsDir: "benchmarks/inventory-hub/modifications"
    }
  ];

  const results = {
    benchmarkVersion: "1.0.0",
    tokenizer: "cl100k_base (OpenAI/Anthropic/Llama standard subword BPE)",
    timestamp: new Date().toISOString(),
    examples: []
  };

  for (const ex of examples) {
    const airSource = await readFile(join(root, ex.airPath), "utf8");
    const airCanonicalTokens = computeCanonicalAirTokens(airSource);
    const airMetrics = measureSource(airSource, ex.airPath);

    // Parse AST to verify air validity
    const model = parseAir(airSource);

    // Measure conventional implementation if available
    const convFiles = await walkDir(join(root, ex.conventionalDir));
    let convTotalLOC = 0;
    let convTotalBytes = 0;
    let convTotalLLMTokens = 0;
    let convJSTSTokens = 0;
    let convCSSTokens = 0;
    let convConfigTokens = 0;
    const fileBreakdown = [];

    for (const f of convFiles) {
      const relPath = relative(root, f);
      const content = await readFile(f, "utf8");
      const m = measureSource(content, relPath);
      const ext = extname(f);

      convTotalLOC += m.loc;
      convTotalBytes += m.bytes;
      convTotalLLMTokens += m.llmTokens;

      if (['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
        convJSTSTokens += m.llmTokens;
      } else if (['.css', '.scss'].includes(ext)) {
        convCSSTokens += m.llmTokens;
      } else {
        convConfigTokens += m.llmTokens;
      }

      fileBreakdown.push({
        file: relPath,
        loc: m.loc,
        bytes: m.bytes,
        llmTokens: m.llmTokens
      });
    }

    const hasConventional = convFiles.length > 0;

    // Measure modification tasks
    const modFiles = await walkDir(join(root, ex.modificationsDir));
    const modifications = [];

    for (const mf of modFiles) {
      if (extname(mf) === ".json") {
        const modContent = JSON.parse(await readFile(mf, "utf8"));
        const airContextTokens = countLLMTokens(modContent.air?.contextSnippet || "");
        const airPatchTokens = countLLMTokens(modContent.air?.patch || "");
        const airFilesTouched = modContent.air?.filesTouched || 1;

        const convContextTokens = countLLMTokens(modContent.conventional?.contextSnippet || "");
        const convPatchTokens = countLLMTokens(modContent.conventional?.patch || "");
        const convFilesTouched = modContent.conventional?.filesTouched || 0;

        const contextRatio = convContextTokens > 0 && airContextTokens > 0
          ? Number((convContextTokens / airContextTokens).toFixed(1))
          : null;
        const patchRatio = convPatchTokens > 0 && airPatchTokens > 0
          ? Number((convPatchTokens / airPatchTokens).toFixed(1))
          : null;

        modifications.push({
          task: modContent.task,
          description: modContent.description,
          air: {
            contextLLMTokens: airContextTokens,
            patchLLMTokens: airPatchTokens,
            filesTouched: airFilesTouched
          },
          conventional: modContent.conventional?.status
            ? { status: modContent.conventional.status }
            : {
                contextLLMTokens: convContextTokens,
                patchLLMTokens: convPatchTokens,
                filesTouched: convFilesTouched
              },
          contextCompressionRatio: contextRatio,
          patchCompressionRatio: patchRatio
        });
      }
    }

    const sourceCompressionRatio = hasConventional && airMetrics.llmTokens > 0
      ? Number((convTotalLLMTokens / airMetrics.llmTokens).toFixed(1))
      : null;

    results.examples.push({
      id: ex.id,
      title: ex.title,
      air: {
        file: ex.airPath,
        lines: airMetrics.lines,
        loc: airMetrics.loc,
        bytes: airMetrics.bytes,
        canonicalTokens: airCanonicalTokens,
        llmTokens: airMetrics.llmTokens,
        appJS: 0,
        appCSS: 0,
        files: 1
      },
      conventional: hasConventional
        ? {
            stack: ex.conventionalStack,
            filesCount: convFiles.length,
            loc: convTotalLOC,
            bytes: convTotalBytes,
            llmTokens: convTotalLLMTokens,
            jsTsTokens: convJSTSTokens,
            cssTokens: convCSSTokens,
            configTokens: convConfigTokens,
            files: fileBreakdown
          }
        : {
            status: ex.conventionalStack,
            comparisonAvailable: false
          },
      sourceCompressionRatio,
      modifications
    });
  }

  return results;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const isCheck = process.argv.includes("--check");
  const results = await runBenchmarks();
  const outputPath = join(root, "benchmarks/results.json");

  if (isCheck) {
    try {
      const existing = await readFile(outputPath, "utf8");
      const cleanExisting = JSON.stringify(JSON.parse(existing));
      const cleanNew = JSON.stringify({ ...results, timestamp: JSON.parse(existing).timestamp });
      if (cleanExisting !== cleanNew) {
        console.error("❌ Benchmark results in benchmarks/results.json are stale! Run `node tools/benchmark.mjs` to update.");
        process.exit(1);
      }
      console.log("✅ Benchmark results are up to date.");
    } catch (e) {
      console.error("❌ Failed to verify benchmark results:", e.message);
      process.exit(1);
    }
  } else {
    await writeFile(outputPath, JSON.stringify(results, null, 2), "utf8");
    console.log("✅ Successfully updated benchmarks/results.json");
    console.log("\nSummary of Measured Benchmarks:\n");
    for (const ex of results.examples) {
      console.log(`[${ex.title}]`);
      console.log(`  AIR: ${ex.air.canonicalTokens} canonical tokens | ${ex.air.llmTokens} LLM tokens | ${ex.air.loc} LOC | ${ex.air.files} file`);
      if (ex.conventional.filesCount) {
        console.log(`  Conventional: ${ex.conventional.llmTokens} LLM tokens | ${ex.conventional.loc} LOC | ${ex.conventional.filesCount} files`);
        console.log(`  Source Token Compression: ${ex.sourceCompressionRatio}x`);
      } else {
        console.log(`  Conventional: ${ex.conventional.status}`);
      }
      for (const m of ex.modifications) {
        console.log(`  - ${m.task}`);
        if (m.contextCompressionRatio) {
          console.log(`    Context Compression: ${m.contextCompressionRatio}x (${m.air.contextLLMTokens} vs ${m.conventional.contextLLMTokens} tokens)`);
          console.log(`    Patch Compression: ${m.patchCompressionRatio}x (${m.air.patchLLMTokens} vs ${m.conventional.patchLLMTokens} tokens)`);
        }
      }
      console.log();
    }
  }
}
