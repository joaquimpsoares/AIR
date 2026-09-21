import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { runConformance } from "../tools/conformance.mjs";
import {
  CapabilityEngine,
  CapabilitySet,
  DevelopmentSecretProvider,
  NetworkDestinationPolicy,
  RedactionEngine,
  SecurityError,
  SECURITY_ERROR_CODES,
  diffCapabilities
} from "../web/runtime/air.mjs";

test("JavaScript conforms to the shared AIR v2 corpus", async () => {
  const result = await runConformance();
  assert.equal(result.total, 41);
});

test("Security conformance fixtures pass deterministically", async () => {
  const dir = path.resolve(import.meta.dirname, "../conformance/security");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  assert.equal(files.length, 14, "Must have 14 security conformance fixtures");

  for (const file of files) {
    const content = JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
    const name = content.name;

    if (name === "capability-allow" || name === "capability-deny") {
      const engine = new CapabilityEngine({ grantedCapabilities: content.grants });
      if (content.expected.allowed) {
        assert.doesNotThrow(() => engine.assertCapability(content.check), `${name} should be allowed`);
      } else {
        assert.throws(
          () => engine.assertCapability(content.check),
          (err) => err instanceof SecurityError && err.code === content.expected.errorCode,
          `${name} should fail with ${content.expected.errorCode}`
        );
      }
    } else if (name === "data-read-allow" || name === "data-write-deny") {
      const engine = new CapabilityEngine({ grantedCapabilities: content.grants });
      const cap = `data:*:${content.resource}:${content.operation}`;
      if (content.expected.allowed) {
        assert.doesNotThrow(() => engine.assertCapability(cap), `${name} should allow`);
      } else {
        assert.throws(
          () => engine.assertCapability(cap),
          (err) => err instanceof SecurityError && err.code === content.expected.errorCode,
          `${name} should deny with ${content.expected.errorCode}`
        );
      }
    } else if (name === "connector-action-allow" || name === "connector-action-deny") {
      const engine = new CapabilityEngine({ grantedCapabilities: content.grants });
      if (content.expected.allowed) {
        assert.doesNotThrow(() => engine.assertCapability(content.check), `${name} should allow`);
      } else {
        assert.throws(
          () => engine.assertCapability(content.check),
          (err) => err instanceof SecurityError && err.code === content.expected.errorCode,
          `${name} should deny with ${content.expected.errorCode}`
        );
      }
    } else if (name === "secret-adapter-allow" || name === "secret-app-deny") {
      const secretProvider = new DevelopmentSecretProvider({ CRM_DATABASE: "secret_conn_str_123" });
      const engine = new CapabilityEngine({
        grantedCapabilities: content.grants,
        secretProvider
      });
      if (content.expected.allowed) {
        await assert.doesNotReject(
          async () => engine.resolveSecretForAdapter(content.secretId, content.adapter, "connect"),
          `${name} should allow`
        );
      } else {
        await assert.rejects(
          async () => engine.resolveSecretForAdapter(content.secretId, content.adapter, "connect"),
          (err) => err instanceof SecurityError && err.code === content.expected.errorCode,
          `${name} should deny with ${content.expected.errorCode}`
        );
      }
    } else if (name === "network-allow" || name === "network-deny") {
      const policy = new NetworkDestinationPolicy(content.policy);
      if (content.expected.allowed) {
        assert.doesNotThrow(() => policy.assertAllowed(content.destination), `${name} should allow`);
      } else {
        assert.throws(
          () => policy.assertAllowed(content.destination),
          (err) => err instanceof SecurityError && err.code === content.expected.errorCode,
          `${name} should deny with ${content.expected.errorCode}`
        );
      }
    } else if (name === "mcp-discovered-not-granted") {
      const engine = new CapabilityEngine({ grantedCapabilities: content.grants });
      assert.throws(
        () => engine.assertCapability(`connector:mcp_proj:action:${content.invoke}:invoke`),
        (err) => err instanceof SecurityError && err.code === content.expected.errorCode
      );
    } else if (name === "capability-escalation") {
      const diff = diffCapabilities(content.base, content.target);
      assert.equal(diff.hasEscalation, content.expected.hasEscalation);
      assert.deepEqual(diff.added, content.expected.added);
    } else if (name === "ai-metadata-only") {
      const engine = new CapabilityEngine({ grantedCapabilities: content.grants });
      assert.throws(
        () => engine.assertCapability("ai:data:*:read"),
        (err) => err instanceof SecurityError && err.code === content.expected.errorCode
      );
    } else if (name === "secret-redaction") {
      const redactor = new RedactionEngine();
      const redacted = redactor.redactObject(content.input);
      assert.deepEqual(redacted, content.expected);
    }
  }
});
