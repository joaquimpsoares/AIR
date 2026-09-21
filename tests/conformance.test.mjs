import test from "node:test";
import assert from "node:assert/strict";
import { runConformance } from "../tools/conformance.mjs";

test("JavaScript conforms to the shared AIR v2 corpus", async () => {
  const result = await runConformance();
  assert.equal(result.total, 41);
});
