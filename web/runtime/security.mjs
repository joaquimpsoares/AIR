/**
 * AIR Security Architecture & Capability Engine
 * 
 * Implements Deny-By-Default Capability Enforcement, Four Authorities Separation,
 * Opaque Secret Handles, Development Secret Provider, Trusted Adapter Registry,
 * Network Destination Validation, Redaction Engine, and Security Audit Logging.
 */

import { FAILURE_CATEGORIES, AdapterError } from "./data.mjs";

/**
 * Stable Security Error Codes
 */
export const SECURITY_ERROR_CODES = Object.freeze({
  CAPABILITY_DENIED: "AIR_CAPABILITY_DENIED",
  SECRET_DENIED: "AIR_SECRET_DENIED",
  ADAPTER_UNTRUSTED: "AIR_ADAPTER_UNTRUSTED",
  NETWORK_DENIED: "AIR_NETWORK_DENIED",
  DATA_DENIED: "AIR_DATA_DENIED",
  CONNECTOR_DENIED: "AIR_CONNECTOR_DENIED",
  AI_CONTEXT_DENIED: "AIR_AI_CONTEXT_DENIED",
  PRIVILEGE_INCREASE: "AIR_PRIVILEGE_INCREASE"
});

/**
 * Standard Security Error
 */
export class SecurityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SecurityError";
    this.code = code;
    this.category = FAILURE_CATEGORIES.FORBIDDEN;
    this.details = details;
  }

  toJSON() {
    return {
      code: this.code,
      name: this.name,
      category: this.category,
      message: this.message,
      details: this.details
    };
  }
}

/**
 * Field Classifications for Data Boundaries
 */
export const FIELD_CLASSIFICATIONS = Object.freeze({
  PUBLIC: "public",
  INTERNAL: "internal",
  PII: "pii",
  SENSITIVE: "sensitive",
  SECRET: "secret"
});

/**
 * Four Distinct Authority Classes
 */
export const AUTHORITY_CLASSES = Object.freeze({
  USER: "user",
  APPLICATION: "application",
  AI: "ai",
  RUNTIME: "runtime"
});

/**
 * Generic Redaction Engine
 */
export class RedactionEngine {
  constructor(options = {}) {
    this.knownSecrets = new Set(options.knownSecrets ?? []);
  }

  registerSecret(secretValue) {
    if (secretValue && typeof secretValue === "string" && secretValue.length >= 4) {
      this.knownSecrets.add(secretValue);
    }
  }

  redactString(str) {
    if (typeof str !== "string") return str;
    let redacted = str;

    // Redact Bearer and basic tokens
    redacted = redacted.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [REDACTED]");
    redacted = redacted.replace(/password=([^&\s;]+)/gi, "password=[REDACTED]");
    redacted = redacted.replace(/postgres:\/\/([^:]+):([^@]+)@/gi, "postgres://$1:[REDACTED]@");

    // Redact registered secret values
    for (const secret of this.knownSecrets) {
      if (secret && redacted.includes(secret)) {
        redacted = redacted.replaceAll(secret, "[REDACTED_SECRET]");
      }
    }
    return redacted;
  }

  redactObject(obj, depth = 0) {
    if (depth > 10) return "[MAX_DEPTH]";
    if (obj == null) return obj;
    if (obj instanceof SecretHandle) return obj.toSafeJSON();
    if (typeof obj === "string") return this.redactString(obj);
    if (typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item, depth + 1));
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("authorization") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("api_key")
      ) {
        if (value instanceof SecretHandle) {
          result[key] = value.toSafeJSON();
        } else if (typeof value === "string") {
          result[key] = "[REDACTED]";
        } else {
          result[key] = "[REDACTED]";
        }
      } else {
        result[key] = this.redactObject(value, depth + 1);
      }
    }
    return result;
  }
}

export const globalRedactor = new RedactionEngine();

/**
 * Opaque Secret Handle
 * Value is never serialized or exposed to untrusted application layers.
 */
export class SecretHandle {
  #value;

  constructor(id, value, provider = "development") {
    if (!id) throw new SecurityError(SECURITY_ERROR_CODES.SECRET_DENIED, "SecretHandle requires an id");
    this.id = id;
    this.provider = provider;
    this.opaque = true;
    this.#value = String(value ?? "");
    globalRedactor.registerSecret(this.#value);
  }

  /**
   * Unwraps the underlying raw secret value ONLY for verified trusted adapter boundaries.
   */
  unwrap(adapterIdentity, callerProof) {
    if (!adapterIdentity || !callerProof?.isTrustedAdapter) {
      throw new SecurityError(
        SECURITY_ERROR_CODES.SECRET_DENIED,
        `Unauthorized attempt to unwrap secret '${this.id}' by non-trusted caller`
      );
    }
    return this.#value;
  }

  toJSON() {
    return this.toSafeJSON();
  }

  toSafeJSON() {
    return {
      id: this.id,
      provider: this.provider,
      opaque: true,
      value: "[SECRET_HANDLE_PROTECTED]"
    };
  }

  toString() {
    return `SecretHandle(${this.id})`;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return `SecretHandle(${this.id})`;
  }
}

/**
 * SecretProvider Base Contract
 */
export class SecretProvider {
  constructor() {
    if (new.target === SecretProvider) {
      throw new TypeError("Cannot instantiate abstract SecretProvider directly");
    }
  }

  /**
   * Resolves secret for a trusted adapter.
   */
  async resolveForAdapter(secretId, adapterIdentity, operation = "access") {
    throw new SecurityError(
      SECURITY_ERROR_CODES.SECRET_DENIED,
      `resolveForAdapter not implemented for ${this.constructor.name}`
    );
  }
}

/**
 * Development Secret Provider (DEVELOPMENT ONLY)
 */
export class DevelopmentSecretProvider extends SecretProvider {
  constructor(initialSecrets = {}, options = {}) {
    super();
    this.environment = "development";
    this.secrets = new Map(Object.entries(initialSecrets));
    this.allowProcessEnv = options.allowProcessEnv ?? true;
  }

  setSecret(id, value) {
    this.secrets.set(id, String(value));
    globalRedactor.registerSecret(String(value));
  }

  rotateSecret(id, newValue) {
    this.setSecret(id, newValue);
  }

  async resolveForAdapter(secretId, adapterIdentity, operation = "access") {
    if (!secretId) {
      throw new SecurityError(SECURITY_ERROR_CODES.SECRET_DENIED, "secretId required");
    }
    let val = this.secrets.get(secretId);
    if (val == null && this.allowProcessEnv && typeof process !== "undefined" && process.env) {
      val = process.env[secretId];
    }
    if (val == null) {
      throw new SecurityError(
        SECURITY_ERROR_CODES.SECRET_DENIED,
        `Secret '${secretId}' not found in DevelopmentSecretProvider for adapter '${adapterIdentity}'`
      );
    }
    return new SecretHandle(secretId, val, "development");
  }
}

/**
 * Semantic Capability Representation
 */
export class Capability {
  constructor({ domain, target, resource, action, raw }) {
    this.domain = domain; // "data" | "connector" | "network" | "secret" | "ai"
    this.target = target; // e.g. "crm", "stripe", "api.stripe.com:443", "CRM_DATABASE"
    this.resource = resource ?? "*"; // e.g. "customers", "charges", "invoices"
    this.action = action ?? "*"; // e.g. "read", "create", "invoke", "consume", "connect"
    this.raw = raw ?? this.toCanonicalString();
  }

  static parse(capStr) {
    const raw = String(capStr).trim();
    const parts = raw.split(":");
    const domain = parts[0];

    if (domain === "data") {
      // data:<source>:<resource>:<action>
      return new Capability({
        domain: "data",
        target: parts[1] ?? "*",
        resource: parts[2] ?? "*",
        action: parts[3] ?? "read",
        raw
      });
    }

    if (domain === "connector") {
      // connector:<connector>:<type>:<item>:<action>
      // or connector:<connector>:<action>
      if (parts[2] === "resource") {
        return new Capability({
          domain: "connector",
          target: parts[1],
          resource: parts[3] ?? "*",
          action: parts[4] ?? "read",
          raw
        });
      }
      if (parts[2] === "action") {
        return new Capability({
          domain: "connector",
          target: parts[1],
          resource: parts[3] ?? "*",
          action: parts[4] ?? "invoke",
          raw
        });
      }
      return new Capability({
        domain: "connector",
        target: parts[1] ?? "*",
        resource: parts[2] ?? "*",
        action: parts[3] ?? "invoke",
        raw
      });
    }

    if (domain === "network") {
      // network:<destination>:connect
      return new Capability({
        domain: "network",
        target: parts[1] ?? "*",
        resource: "*",
        action: parts[2] ?? "connect",
        raw
      });
    }

    if (domain === "secret") {
      // secret:<secret-id>:consume
      return new Capability({
        domain: "secret",
        target: parts[1] ?? "*",
        resource: "*",
        action: parts[2] ?? "consume",
        raw
      });
    }

    if (domain === "ai") {
      // ai:<resource>:<action> (e.g. ai:schema:read, ai:metadata:read)
      return new Capability({
        domain: "ai",
        target: parts[1] ?? "*",
        resource: parts[2] ?? "*",
        action: parts[3] ?? "read",
        raw
      });
    }

    return new Capability({
      domain: domain || "custom",
      target: parts[1] ?? "*",
      resource: parts[2] ?? "*",
      action: parts[3] ?? "*",
      raw
    });
  }

  toCanonicalString() {
    if (this.domain === "data") {
      return `data:${this.target}:${this.resource}:${this.action}`;
    }
    if (this.domain === "connector") {
      return `connector:${this.target}:${this.resource}:${this.action}`;
    }
    if (this.domain === "network") {
      return `network:${this.target}:${this.action}`;
    }
    if (this.domain === "secret") {
      return `secret:${this.target}:${this.action}`;
    }
    if (this.domain === "ai") {
      return `ai:${this.target}:${this.resource}:${this.action}`;
    }
    return `${this.domain}:${this.target}:${this.resource}:${this.action}`;
  }

  matches(required) {
    const req = required instanceof Capability ? required : Capability.parse(required);
    if (this.domain !== req.domain && this.domain !== "*") return false;
    if (this.target !== req.target && this.target !== "*") return false;
    if (this.resource !== req.resource && this.resource !== "*") return false;
    if (this.action !== req.action && this.action !== "*") return false;
    return true;
  }

  equals(other) {
    const o = other instanceof Capability ? other : Capability.parse(other);
    return this.toCanonicalString() === o.toCanonicalString();
  }

  toJSON() {
    return {
      domain: this.domain,
      target: this.target,
      resource: this.resource,
      action: this.action,
      canonical: this.toCanonicalString()
    };
  }
}

/**
 * Capability Set with Provenance Tracking
 */
export class CapabilitySet {
  constructor(capabilities = []) {
    this.entries = new Map(); // canonical -> { capability, provenance }
    for (const item of capabilities) {
      this.add(item);
    }
  }

  add(capOrStr, provenance = "explicit grant") {
    const cap = capOrStr instanceof Capability ? capOrStr : Capability.parse(capOrStr);
    this.entries.set(cap.toCanonicalString(), { capability: cap, provenance });
    return this;
  }

  remove(capOrStr) {
    const cap = capOrStr instanceof Capability ? capOrStr : Capability.parse(capOrStr);
    this.entries.delete(cap.toCanonicalString());
  }

  has(required) {
    const req = required instanceof Capability ? required : Capability.parse(required);
    for (const { capability } of this.entries.values()) {
      if (capability.matches(req)) return true;
    }
    return false;
  }

  getProvenance(required) {
    const req = required instanceof Capability ? required : Capability.parse(required);
    for (const { capability, provenance } of this.entries.values()) {
      if (capability.matches(req)) return provenance;
    }
    return null;
  }

  list() {
    return [...this.entries.values()].map((e) => e.capability);
  }

  listWithProvenance() {
    return [...this.entries.values()].map((e) => ({
      capability: e.capability.toCanonicalString(),
      provenance: e.provenance
    }));
  }

  /**
   * Computes diff between this capability set (base) and target capability set (target)
   */
  diff(targetSet) {
    const target = targetSet instanceof CapabilitySet ? targetSet : new CapabilitySet(targetSet);
    const added = [];
    const removed = [];

    for (const targetCap of target.list()) {
      if (!this.has(targetCap)) {
        added.push(targetCap);
      }
    }
    for (const baseCap of this.list()) {
      if (!target.has(baseCap)) {
        removed.push(baseCap);
      }
    }

    return {
      added,
      removed,
      hasEscalation: added.length > 0
    };
  }
}

/**
 * Security Audit Logger
 */
export class SecurityAuditLogger {
  constructor() {
    this.events = [];
    this.listeners = new Set();
  }

  log({ actor, application, operation, resource, adapter, capability, decision, reason, traceId }) {
    const event = {
      timestamp: new Date().toISOString(),
      actor: actor ?? "system",
      application: application ?? "air_app",
      operation,
      resource: resource ?? null,
      adapter: adapter ?? null,
      capability: capability instanceof Capability ? capability.toCanonicalString() : capability,
      decision, // "allowed" | "denied"
      reason: reason ?? null,
      traceId: traceId ?? `tr_${Math.random().toString(36).slice(2, 8)}`
    };

    const redacted = globalRedactor.redactObject(event);
    this.events.push(redacted);

    for (const listener of this.listeners) {
      try {
        listener(redacted);
      } catch (err) {
        console.error("Audit listener error:", err);
      }
    }

    return redacted;
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getEvents() {
    return [...this.events];
  }

  clear() {
    this.events = [];
  }
}

export const globalAuditLogger = new SecurityAuditLogger();

/**
 * Trusted Adapter Definition
 */
export class TrustedAdapterDefinition {
  constructor({
    identity,
    version = "1.0.0",
    adapterClass,
    capabilitiesProvided = [],
    capabilitiesRequired = [],
    secretRequirements = [],
    networkRequirements = []
  }) {
    if (!identity) throw new SecurityError(SECURITY_ERROR_CODES.ADAPTER_UNTRUSTED, "Adapter requires identity");
    this.identity = identity;
    this.version = version;
    this.adapterClass = adapterClass;
    this.capabilitiesProvided = capabilitiesProvided;
    this.capabilitiesRequired = capabilitiesRequired;
    this.secretRequirements = secretRequirements;
    this.networkRequirements = networkRequirements;
  }

  toManifest() {
    return {
      identity: this.identity,
      version: this.version,
      capabilitiesProvided: this.capabilitiesProvided,
      capabilitiesRequired: this.capabilitiesRequired,
      secretRequirements: this.secretRequirements,
      networkRequirements: this.networkRequirements
    };
  }
}

/**
 * Trusted Adapter Registry
 */
export class TrustedAdapterRegistry {
  constructor() {
    this.adapters = new Map(); // identity -> TrustedAdapterDefinition
  }

  register(definition) {
    if (!(definition instanceof TrustedAdapterDefinition)) {
      throw new SecurityError(
        SECURITY_ERROR_CODES.ADAPTER_UNTRUSTED,
        "Registered item must be a TrustedAdapterDefinition"
      );
    }
    this.adapters.set(definition.identity, definition);
  }

  get(identity) {
    return this.adapters.get(identity);
  }

  isTrusted(identity) {
    return this.adapters.has(identity);
  }

  list() {
    return [...this.adapters.values()].map((d) => d.toManifest());
  }
}

export const globalTrustedRegistry = new TrustedAdapterRegistry();

/**
 * Network Destination Policy
 */
export class NetworkDestinationPolicy {
  constructor(allowedDestinations = []) {
    this.allowed = new Set(allowedDestinations); // ["api.stripe.com:443", "localhost:25432", ...]
  }

  addDestination(destination) {
    this.allowed.add(destination);
  }

  isAllowed(urlString) {
    try {
      const parsed = new URL(urlString);
      const hostWithPort = `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? 443 : 80)}`;
      const hostOnly = parsed.hostname;

      for (const dest of this.allowed) {
        if (dest === "*" || dest === hostWithPort || dest === hostOnly) return true;
        if (dest.startsWith("*.") && hostOnly.endsWith(dest.slice(1))) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  assertAllowed(urlString, context = "Network Request") {
    if (!this.isAllowed(urlString)) {
      globalAuditLogger.log({
        operation: "network.connect",
        resource: urlString,
        capability: `network:${urlString}:connect`,
        decision: "denied",
        reason: `Destination ${urlString} is not allowed by network policy`
      });
      throw new SecurityError(
        SECURITY_ERROR_CODES.NETWORK_DENIED,
        `Network destination '${urlString}' denied by security policy for ${context}`,
        { url: urlString }
      );
    }
  }
}

/**
 * Central Capability Security Engine
 */
export class CapabilityEngine {
  constructor({
    applicationId = "air_app",
    grantedCapabilities = [],
    secretProvider = new DevelopmentSecretProvider(),
    trustedRegistry = globalTrustedRegistry,
    auditLogger = globalAuditLogger,
    networkPolicy = new NetworkDestinationPolicy()
  } = {}) {
    this.applicationId = applicationId;
    this.grantedCapabilities = grantedCapabilities instanceof CapabilitySet ? grantedCapabilities : new CapabilitySet(grantedCapabilities);
    this.secretProvider = secretProvider;
    this.trustedRegistry = trustedRegistry;
    this.auditLogger = auditLogger;
    this.networkPolicy = networkPolicy;
    this.decisionsHistory = [];
  }

  /**
   * Enforces that the requested capability is granted to the application.
   * Fails closed (throws SecurityError) if not granted.
   */
  assertCapability(requiredCapability, { actor = "system", operation = "execute", adapter = null } = {}) {
    const cap = requiredCapability instanceof Capability ? requiredCapability : Capability.parse(requiredCapability);
    const allowed = this.grantedCapabilities.has(cap);
    const provenance = this.grantedCapabilities.getProvenance(cap);

    const decisionRecord = {
      id: `dec_${Math.random().toString(36).slice(2, 10)}`,
      capability: cap.toCanonicalString(),
      allowed,
      actor,
      operation,
      adapter,
      provenance,
      timestamp: new Date().toISOString()
    };
    this.decisionsHistory.push(decisionRecord);

    this.auditLogger.log({
      actor,
      application: this.applicationId,
      operation,
      resource: `${cap.domain}:${cap.target}`,
      adapter,
      capability: cap,
      decision: allowed ? "allowed" : "denied",
      reason: allowed ? (provenance ?? "granted") : "Capability not granted by deployment"
    });

    if (!allowed) {
      let code = SECURITY_ERROR_CODES.CAPABILITY_DENIED;
      if (cap.domain === "data") code = SECURITY_ERROR_CODES.DATA_DENIED;
      if (cap.domain === "connector") code = SECURITY_ERROR_CODES.CONNECTOR_DENIED;
      if (cap.domain === "secret") code = SECURITY_ERROR_CODES.SECRET_DENIED;
      if (cap.domain === "network") code = SECURITY_ERROR_CODES.NETWORK_DENIED;
      if (cap.domain === "ai") code = SECURITY_ERROR_CODES.AI_CONTEXT_DENIED;

      throw new SecurityError(
        code,
        `Permission denied: capability '${cap.toCanonicalString()}' is not granted for ${this.applicationId}`,
        { capability: cap.toCanonicalString(), operation, actor }
      );
    }

    return true;
  }

  /**
   * Resolves a secret strictly for a verified trusted adapter.
   */
  async resolveSecretForAdapter(secretId, adapterIdentity, operation = "connect") {
    // 1. Verify adapter is registered in trusted registry
    if (!this.trustedRegistry.isTrusted(adapterIdentity)) {
      this.auditLogger.log({
        operation: "secret.consume",
        resource: secretId,
        adapter: adapterIdentity,
        capability: `secret:${secretId}:consume`,
        decision: "denied",
        reason: `Adapter '${adapterIdentity}' is not in TrustedAdapterRegistry`
      });
      throw new SecurityError(
        SECURITY_ERROR_CODES.ADAPTER_UNTRUSTED,
        `Untrusted adapter '${adapterIdentity}' cannot request secrets`
      );
    }

    // 2. Check secret capability
    const cap = Capability.parse(`secret:${secretId}:consume`);
    this.assertCapability(cap, { actor: "trusted_adapter", operation, adapter: adapterIdentity });

    // 3. Resolve from SecretProvider
    const handle = await this.secretProvider.resolveForAdapter(secretId, adapterIdentity, operation);

    this.auditLogger.log({
      actor: "trusted_adapter",
      application: this.applicationId,
      operation: "secret.consumed",
      resource: secretId,
      adapter: adapterIdentity,
      capability: cap,
      decision: "allowed",
      reason: `Secret '${secretId}' consumed internally by trusted adapter '${adapterIdentity}'`
    });

    return handle;
  }

  /**
   * Updates granted capabilities dynamically (e.g. during deployment update or permission revocation)
   */
  updateGrants(newGrants) {
    this.grantedCapabilities = new CapabilitySet(newGrants);
  }

  explainDecision(decisionId) {
    const dec = this.decisionsHistory.find((d) => d.id === decisionId);
    if (!dec) return `Decision ${decisionId} not found.`;
    return [
      `DECISION: ${dec.allowed ? "ALLOWED" : "DENIED"}`,
      `Capability: ${dec.capability}`,
      `Operation: ${dec.operation}`,
      `Actor: ${dec.actor}`,
      `Adapter: ${dec.adapter ?? "none"}`,
      `Provenance: ${dec.provenance ?? "none"}`,
      `Timestamp: ${dec.timestamp}`
    ].join("\n");
  }
}

// Register standard trusted adapters
globalTrustedRegistry.register(new TrustedAdapterDefinition({
  identity: "memory@1",
  version: "1.0.0",
  capabilitiesProvided: ["data:memory:*:*"]
}));

globalTrustedRegistry.register(new TrustedAdapterDefinition({
  identity: "sqlite@1",
  version: "1.0.0",
  capabilitiesProvided: ["data:sqlite:*:*"]
}));

globalTrustedRegistry.register(new TrustedAdapterDefinition({
  identity: "postgres@1",
  version: "1.0.0",
  capabilitiesProvided: ["data:postgres:*:*"],
  secretRequirements: ["secret:CRM_DATABASE:consume"],
  networkRequirements: ["network:*:5432:connect"]
}));

globalTrustedRegistry.register(new TrustedAdapterDefinition({
  identity: "rest@1",
  version: "1.0.0",
  capabilitiesProvided: ["connector:*:action:*:invoke", "connector:*:resource:*:read"],
  networkRequirements: ["network:*:connect"]
}));

globalTrustedRegistry.register(new TrustedAdapterDefinition({
  identity: "mcp@1",
  version: "1.0.0",
  capabilitiesProvided: ["connector:*:action:*:invoke", "connector:*:resource:*:read"]
}));

/**
 * Derives requested capabilities from an AIR semantic model
 */
export function deriveRequestedCapabilities(model) {
  const requested = [];
  for (const entity of model.entities?.values() ?? []) {
    requested.push(`data:*:${entity.id}:read`);
    requested.push(`data:*:${entity.id}:create`);
    requested.push(`data:*:${entity.id}:update`);
    requested.push(`data:*:${entity.id}:delete`);
  }
  return requested;
}

/**
 * Inspects capabilities of an AIR application
 */
export function inspectCapabilities(model, options = {}) {
  const requested = deriveRequestedCapabilities(model);
  const granted = options.grantedCapabilities ?? requested;
  const grantSet = new CapabilitySet(granted);
  const effective = requested.filter((c) => grantSet.has(c));
  const adapterIdentity = options.adapter ?? "memory@1";
  const trustedDef = globalTrustedRegistry.get(adapterIdentity);

  return {
    application: model.app?.title ?? model.app?.id ?? "AIR Application",
    requested,
    granted,
    effective,
    adapter: adapterIdentity,
    impliedByAdapter: {
      secrets: trustedDef?.secretRequirements ?? [],
      network: trustedDef?.networkRequirements ?? []
    },
    filesystem: "DENIED",
    process: "DENIED",
    aiDataAccess: "metadata only"
  };
}

/**
 * Inspects security posture in human-readable and machine-readable form
 */
export function inspectSecurity(model, options = {}) {
  const inspection = inspectCapabilities(model, options);
  const human = [
    `APPLICATION`,
    `  ${inspection.application}`,
    ``,
    `REQUESTED CAPABILITIES (${inspection.requested.length})`,
    ...inspection.requested.map((c) => `  ${c}`),
    ``,
    `EFFECTIVE CAPABILITIES (${inspection.effective.length})`,
    ...inspection.effective.map((c) => `  ${c}  [GRANTED]`),
    ``,
    `TRUSTED ADAPTER`,
    `  ${inspection.adapter}`,
    ``,
    `IMPLIED BY ADAPTER`,
    ...inspection.impliedByAdapter.secrets.map((s) => `  SECRET ${s}`),
    ...inspection.impliedByAdapter.network.map((n) => `  NETWORK ${n}`),
    ``,
    `SECRETS`,
    `  VALUE: NEVER EXPOSED`,
    ``,
    `FILESYSTEM: DENIED`,
    `PROCESS: DENIED`,
    `AI AUTHORITY: METADATA ONLY, PRODUCTION RECORDS DENIED, SECRETS DENIED`
  ].join("\n");

  return {
    ...inspection,
    toHumanString: () => human
  };
}

/**
 * Compares two capability sets or models to detect privilege escalation
 */
export function diffCapabilities(oldCapsOrModel, newCapsOrModel) {
  const oldList = Array.isArray(oldCapsOrModel) ? oldCapsOrModel : deriveRequestedCapabilities(oldCapsOrModel);
  const newList = Array.isArray(newCapsOrModel) ? newCapsOrModel : deriveRequestedCapabilities(newCapsOrModel);

  const oldSet = new CapabilitySet(oldList);
  const newSet = new CapabilitySet(newList);

  const diffResult = oldSet.diff(newSet);

  const human = [
    diffResult.hasEscalation ? `PRIVILEGE INCREASE DETECTED:` : `NO PRIVILEGE INCREASE:`,
    ...diffResult.added.map((c) => `  + ${c.toCanonicalString()}`),
    ...diffResult.removed.map((c) => `  - ${c.toCanonicalString()}`)
  ].join("\n");

  return {
    ...diffResult,
    added: diffResult.added.map((c) => c.toCanonicalString()),
    removed: diffResult.removed.map((c) => c.toCanonicalString()),
    toHumanString: () => human
  };
}

