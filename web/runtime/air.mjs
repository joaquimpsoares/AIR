export const AIR_VERSION = 2;
export { compilePresentation, serializePresentationIr, EXPERIENCE_REGISTRY, PRESENTATION_IR_VERSION } from "./presentation.mjs";
export {
  VISUAL_DESIGN_IR_VERSION,
  ARCHETYPES,
  CHARACTERS,
  SHELL_TYPES,
  COMPOSITIONS,
  PRIORITIES,
  VISUAL_WEIGHTS,
  RHYTHMS,
  TYPOGRAPHY_INTENTS,
  CARD_POLICIES,
  MOTION_MODELS,
  ARCHETYPE_PROFILES,
  CHARACTER_PROFILES,
  VISUAL_EXPERIENCES,
  compileVisualDesign,
  applyVisualDesignPatch,
  serializeVisualDesignIr
} from "./visual_design.mjs";
export { FAILURE_CATEGORIES, AdapterError, SchemaMapping, validateIdentifier, AsyncMutex, DataAdapter, MemoryDataAdapter, SqliteDataAdapter, PostgresDataAdapter } from "./data.mjs";
export { EventEnvelope, ConnectorManifest, Connector, RestConnectorAdapter, McpConnectorAdapter, ConnectorRegistry } from "./connector.mjs";
export {
  SECURITY_ERROR_CODES,
  SecurityError,
  FIELD_CLASSIFICATIONS,
  AUTHORITY_CLASSES,
  RedactionEngine,
  globalRedactor,
  SecretHandle,
  SecretProvider,
  DevelopmentSecretProvider,
  Capability,
  CapabilitySet,
  SecurityAuditLogger,
  globalAuditLogger,
  TrustedAdapterDefinition,
  TrustedAdapterRegistry,
  globalTrustedRegistry,
  NetworkDestinationPolicy,
  CapabilityEngine,
  deriveRequestedCapabilities,
  inspectCapabilities,
  inspectSecurity,
  diffCapabilities
} from "./security.mjs";

export {
  OPERATIONAL_ERROR_CODES,
  EVENT_TYPES,
  SEVERITY_LEVELS,
  HEALTH_STATES,
  COMPONENT_TYPES,
  CIRCUIT_STATES,
  USER_IMPACT,
  INCIDENT_STATUS,
  FAILURE_CLASSIFICATIONS,
  OperationalError,
  OperationalEvent,
  Incident,
  CircuitBreaker,
  RESILIENCE_PROFILES,
  DEPLOYMENT_SAFETY_LIMITS,
  ResiliencePolicy,
  RecoveryBudget,
  SingleFlight,
  RecoveryAdapter,
  TestRecoveryAdapter,
  HealthManager,
  OperationalStore,
  FailureInjector,
  OperationalEngine
} from "./operations.mjs";

export {
  SECURITY_EVENT_TYPES,
  REACTION_CLASSES,
  REACTION_DISRUPTIVENESS,
  CONFIDENCE_LEVELS,
  SECURITY_SAFETY_LIMITS,
  extractClientAddress,
  Detection,
  Detector,
  FailedLoginDetector,
  PasswordSprayDetector,
  CredentialStuffingDetector,
  AuthorizationAbuseDetector,
  ResourceEnumerationDetector,
  CapabilityAbuseDetector,
  RateWindowDetector,
  DetectionEngine,
  SECURITY_PROFILES,
  SecurityPolicy,
  diffSecurityPolicies,
  SecurityAdapter,
  LocalSecurityAdapter,
  SecurityReactionEngine
} from "./security_reactions.mjs";

export {
  buildDiagnosticContext,
  DiagnosticAnalyzer,
  DeterministicDiagnosticAnalyzer,
  DiagnosticReportValidator
} from "./diagnostics.mjs";

import { FIELD_CLASSIFICATIONS, globalRedactor } from "./security.mjs";
import { OPERATIONAL_ERROR_CODES, OperationalError, FAILURE_CLASSIFICATIONS } from "./operations.mjs";
import { FAILURE_CATEGORIES, AsyncMutex } from "./data.mjs";

const DECLARATION_KEYS = Object.freeze({
  air: new Set(["version"]),
  app: new Set(["title", "subtitle", "initial", "timezone"]),
  theme: new Set(["mode", "accent", "density"]),
  design: new Set(["archetype", "character", "rhythm", "motion", "density", "contrast", "accent"]),
  capability: new Set(),
  resource: new Set(["singular", "plural", "icon", "label"]),
  actor: new Set(),
  field: new Set([
    "type", "label", "required", "unique", "values", "ref", "default",
    "min", "max", "placeholder", "long", "currency", "start", "end", "policy",
    "computed", "unit", "rate"
  ]),
  manage: new Set(["create", "edit", "delete", "lifecycle", "page_size"]),
  access: new Set(["view", "create", "edit", "delete", "archive"]),
  overview: new Set(["title"]),
  insight: new Set(["op", "field", "source", "group", "where", "window", "date", "label", "tone", "from", "to", "format", "overlaps"]),
  rule: new Set(["field", "from", "to", "after", "since"]),
  highlight: new Set(["when", "tone"]),
  parameter: new Set(["value", "label"]),
  process: new Set(["state", "initial", "terminal", "history", "touch"]),
  transition: new Set([
    "from", "to", "action", "by", "when", "automatic", "comment",
    "approvals", "distinct", "separate", "event", "within", "since", "unless_event"
  ]),
  invariant: new Set(["when", "require", "immutable", "none", "exists", "scope", "overlaps", "deny", "where", "unique", "fields"]),
  unique: new Set(["fields", "where", "deny", "when"]),
  deadline: new Set(["state", "after", "escalation"]),
  extension: new Set(["module", "slot"]),
  notify: new Set(["on", "when", "audience", "tone", "label", "title", "body", "action", "target", "resource"]),
  experience: new Set([
    "actor", "identity", "title", "subtitle", "authority", "registration", "verification", "reset",
    "switch_user", "profile", "security", "sessions", "headline", "tagline", "primary_action",
    "primary_action_url", "secondary_action", "secondary_action_url", "media", "media_alt",
    "features", "testimonials", "tiers", "items", "stats", "columns", "links", "copyright",
    "motion", "style", "density", "emphasis", "mood", "radius"
  ])
});

const ID_KINDS = new Set([
  "app", "capability", "resource", "actor", "field", "manage", "access",
  "insight", "rule", "highlight", "parameter", "process", "transition",
  "invariant", "unique", "deadline", "extension", "experience", "notify"
]);
const SINGLETON_KINDS = new Set(["air", "theme", "design", "overview"]);
const FIELD_TYPES = new Set(["text", "email", "phone", "enum", "date", "datetime", "ref", "number", "integer", "money", "rate", "ratio", "bool", "interval", "duration"]);
const SEARCHABLE_TYPES = new Set(["text", "email", "phone"]);
const FILTERABLE_TYPES = new Set(["enum", "ref", "bool"]);
const NUMERIC_TYPES = new Set(["number", "integer", "money", "rate", "ratio"]);
const RATE_UNITS = new Set(["s", "m", "h", "d"]);
export const ACCENTS = new Set([
  "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple",
  "fuchsia", "pink", "rose"
]);
export const MODES = new Set(["light", "dark", "system"]);
export const DENSITIES = new Set(["compact", "comfortable"]);
const CAPABILITIES = new Set(["storage.local"]);
const MISSING = Symbol("air.missing");

export class AirError extends Error {
  constructor(message, line = null, metadata = {}) {
    const resolved = metadata.code ? metadata : errorMetadata(message, null, metadata);
    super(line == null ? message : `line ${line}: ${message}`);
    this.name = "AirError";
    this.line = line;
    this.code = resolved.code ?? "AIR_VALIDATE_INVALID";
    this.phase = resolved.phase ?? "validate";
    this.location = line == null ? null : { line, column: null };
    this.path = resolved.path ?? null;
  }

  toJSON() {
    return { code: this.code, phase: this.phase, location: this.location, path: this.path, message: this.message };
  }
}

function errorMetadata(message, declaration, metadata = {}) {
  if (metadata.code) return {
    path: declaration ? `${declaration.kind}${declaration.id ? `.${declaration.id}` : ""}` : null,
    ...metadata
  };
  const rules = [
    [/unknown declaration/, "AIR_PARSE_UNKNOWN_DECLARATION", "parse"],
    [/unterminated quoted string|unterminated escape/, "AIR_PARSE_UNTERMINATED_STRING", "parse"],
    [/unknown .* property|invalid property name|duplicate property/, "AIR_VALIDATE_UNKNOWN_PROPERTY", "validate"],
    [/duplicate .* ID|duplicate actor resource|only one/, "AIR_VALIDATE_DUPLICATE_ID", "validate"],
    [/unknown referenced resource|owner .* is not a resource|target .* is not a resource|source .* is not a resource/, "AIR_REF_UNKNOWN_RESOURCE", "resolve"],
    [/unknown field|unknown label field|references unknown stored field/, "AIR_REF_UNKNOWN_FIELD", "resolve"],
    [/reference path|actor path|owner path|must end at an actor resource|self policy requires actor/, "AIR_REF_INVALID_ACTOR_PATH", "resolve"],
    [/unknown parameter/, "AIR_REF_UNKNOWN_PARAMETER", "resolve"],
    [/condition.*type|requires compatible|numeric operand|currency/, "AIR_TYPE_CONDITION_MISMATCH", "type"],
    [/condition|requires a comparison|empty alternative/, "AIR_PARSE_CONDITION", "parse"],
    [/duration|after expects/, "AIR_VALIDATE_DURATION", "validate"],
    [/nonexistent state|deadline references/, "AIR_PROCESS_UNKNOWN_STATE", "process"],
    [/unreachable states/, "AIR_PROCESS_UNREACHABLE_STATE", "process"],
    [/duplicate transition semantics/, "AIR_PROCESS_DUPLICATE_TRANSITION", "process"],
    [/contradictory bounds/, "AIR_PROCESS_CONTRADICTORY_GUARD", "process"],
    [/approval requires|approvals >=|accumulate approvals/, "AIR_PROCESS_APPROVAL_CARDINALITY", "process"],
    [/authority and separation/, "AIR_PROCESS_IMPOSSIBLE_SEPARATION", "process"],
    [/invariant/, "AIR_VALIDATE_INVARIANT", "validate"],
    [/insight|aggregate/, "AIR_VALIDATE_AGGREGATE", "validate"],
    [/ambiguous automatic transitions/, "AIR_EXEC_AUTO_AMBIGUOUS", "execute"],
    [/automatic transition cycle/, "AIR_EXEC_AUTO_CYCLE", "execute"],
    [/automatic transition .* failed validation/, "AIR_EXEC_AUTO_VALIDATION", "execute"],
    [/not permitted|cannot .*: authority|separation of duty/, "AIR_EXEC_DENIED", "execute"],
    [/seed |persisted /, "AIR_DATA_INVALID", "data"]
  ];
  const matched = rules.find(([pattern]) => pattern.test(message));
  return {
    code: matched?.[1] ?? "AIR_VALIDATE_INVALID",
    phase: matched?.[2] ?? "validate",
    path: declaration ? `${declaration.kind}${declaration.id ? `.${declaration.id}` : ""}` : null,
    ...metadata
  };
}

function fail(message, declaration = null, metadata = {}) {
  throw new AirError(message, declaration?.line ?? null, errorMetadata(message, declaration, metadata));
}

function object() {
  return Object.create(null);
}

function stripComment(line) {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) escaped = false;
    else if (character === "\\" && quoted) escaped = true;
    else if (character === '"') quoted = !quoted;
    else if (character === "#" && !quoted) return line.slice(0, index);
  }
  return line;
}

export function tokenizeLine(line, lineNumber = null) {
  const clean = stripComment(line);
  const tokens = [];
  let token = "";
  let quoted = false;
  let escaped = false;
  let tokenStarted = false;
  for (let index = 0; index < clean.length; index += 1) {
    const character = clean[index];
    if (escaped) {
      const escapes = { n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" };
      if (!(character in escapes)) throw new AirError(`unsupported escape \\${character}`, lineNumber, { code: "AIR_PARSE_ESCAPE", phase: "parse" });
      token += escapes[character];
      escaped = false;
    } else if (character === "\\" && quoted) {
      escaped = true;
      tokenStarted = true;
    } else if (character === '"') {
      quoted = !quoted;
      tokenStarted = true;
    } else if (/\s/.test(character) && !quoted) {
      if (tokenStarted) {
        tokens.push(token);
        token = "";
        tokenStarted = false;
      }
    } else {
      token += character;
      tokenStarted = true;
    }
  }
  if (quoted) throw new AirError("unterminated quoted string", lineNumber, { code: "AIR_PARSE_UNTERMINATED_STRING", phase: "parse" });
  if (escaped) throw new AirError("unterminated escape", lineNumber, { code: "AIR_PARSE_UNTERMINATED_STRING", phase: "parse" });
  if (tokenStarted) tokens.push(token);
  return tokens;
}

function parseProperties(tokens, declaration) {
  const properties = object();
  for (const token of tokens) {
    const equal = token.indexOf("=");
    const key = equal === -1 ? token : token.slice(0, equal);
    const value = equal === -1 ? true : token.slice(equal + 1);
    if (!/^[a-z][a-z0-9_]*$/.test(key)) fail(`invalid property name \`${key}\``, declaration);
    if (Object.hasOwn(properties, key)) fail(`duplicate property \`${key}\``, declaration);
    if (value === "") fail(`property \`${key}\` cannot be empty`, declaration);
    properties[key] = value;
  }
  return properties;
}

function declarationProperties(kind, tokens, declaration) {
  const prefix = object();
  if (kind === "field" && tokens[0] && !tokens[0].includes("=")) {
    if (!FIELD_TYPES.has(tokens[0])) fail(`unknown field type \`${tokens[0]}\``, declaration);
    prefix.type = tokens.shift();
  }
  const properties = Object.assign(prefix, parseProperties(tokens, declaration));
  if (kind === "field" && properties.type == null && typeof properties.ref === "string") properties.type = "ref";
  return properties;
}

function validatePropertyNames(declaration, allowAfter = false) {
  const allowed = DECLARATION_KEYS[declaration.kind];
  for (const key of Object.keys(declaration.props)) {
    if (allowAfter && key === "after") continue;
    if (!allowed.has(key)) fail(`unknown ${declaration.kind} property \`${key}\``, declaration);
  }
}

export function parseDeclarations(source) {
  const declarations = [];
  source.split(/\r?\n/).forEach((line, index) => {
    const tokens = tokenizeLine(line, index + 1);
    if (!tokens.length) return;
    const kind = tokens.shift();
    if (!(kind in DECLARATION_KEYS)) {
      const suffix = kind === "record" ? "; data belongs in a .seed.json or storage adapter" : "";
      throw new AirError(`unknown declaration \`${kind}\`${suffix}`, index + 1, {
        code: "AIR_PARSE_UNKNOWN_DECLARATION", phase: "parse", path: kind
      });
    }
    const declaration = { kind, id: null, props: object(), line: index + 1 };
    if (ID_KINDS.has(kind)) {
      if (!tokens.length || tokens[0].includes("=")) fail(`\`${kind}\` requires an ID`, declaration);
      declaration.id = tokens.shift();
      if (!/^[a-z][a-z0-9_.-]*$/.test(declaration.id)) fail(`invalid ID \`${declaration.id}\``, declaration);
    }
    declaration.props = declarationProperties(kind, tokens, declaration);
    validatePropertyNames(declaration);
    declarations.push(declaration);
  });
  return declarations;
}

function requireProperty(declaration, key) {
  const value = declaration.props[key];
  if (value == null || value === true) fail(`\`${declaration.kind}\` requires ${key}=...`, declaration);
  return value;
}

function stringProperty(declaration, key, fallback = null) {
  const value = declaration.props[key];
  if (value == null) return fallback;
  if (value === true) fail(`property \`${key}\` requires a value`, declaration);
  return value;
}

function booleanProperty(declaration, key, fallback = false) {
  const value = declaration.props[key];
  if (value == null) return fallback;
  if (value === true || value === "true") return true;
  if (value === "false") return false;
  fail(`property \`${key}\` expects true or false`, declaration);
}

function permissionProperty(declaration, key, fallback = true) {
  const value = declaration.props[key];
  if (value == null) return fallback;
  if (value === true || value === "true") return true;
  if (value === "false") return false;
  if (!/^[a-z][a-z0-9_-]*$/.test(value)) fail(`property \`${key}\` expects true, false, or a role ID`, declaration);
  return value;
}

function integerProperty(declaration, key, fallback, minimum = 0) {
  const raw = declaration.props[key];
  if (raw == null) return fallback;
  if (raw === true || !/^-?\d+$/.test(raw) || (minimum != null && Number(raw) < minimum)) fail(`property \`${key}\` expects an integer${minimum != null ? ` >= ${minimum}` : ""}`, declaration);
  return Number(raw);
}

function listProperty(declaration, key, fallback = []) {
  const value = declaration.props[key];
  if (value == null) return [...fallback];
  if (value === true) fail(`property \`${key}\` requires a comma-separated value`, declaration);
  const values = value.split(",");
  if (values.some((part) => !part)) fail(`property \`${key}\` contains an empty item`, declaration);
  return values;
}

function splitOwnedId(declaration) {
  const separator = declaration.id.indexOf(".");
  if (separator < 1 || separator === declaration.id.length - 1 || declaration.id.indexOf(".", separator + 1) !== -1) {
    fail(`\`${declaration.kind}\` ID must be owner.local_id`, declaration);
  }
  return [declaration.id.slice(0, separator), declaration.id.slice(separator + 1)];
}

function insertUnique(map, id, value, declaration) {
  if (map.has(id)) fail(`duplicate ${declaration.kind} ID \`${id}\``, declaration);
  map.set(id, value);
}

function titleCase(value) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function singularize(value) {
  if (value.endsWith("ies") && value.length > 3) return `${value.slice(0, -3)}y`;
  if (value.endsWith("sses") || value.endsWith("shes") || value.endsWith("ches") || value.endsWith("xes")) return value.slice(0, -2);
  if (value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
}

function inferColumns(resource) {
  const selected = [resource.labelField];
  const priorities = [
    (field) => field.type === "email" || field.type === "ref",
    (field) => field.type === "enum",
    (field) => NUMERIC_TYPES.has(field.type),
    (field) => field.type === "date",
    (field) => field.type === "phone" || (field.type === "text" && !field.long)
  ];
  for (const matches of priorities) {
    for (const field of resource.fields) {
      if (selected.length >= 6) return selected;
      if (!selected.includes(field.id) && matches(field)) selected.push(field.id);
    }
  }
  return selected;
}

function inferSort(resource) {
  const choices = [resource.labelField];
  for (const field of resource.fields) {
    if (field.type === "date") choices.push(`-${field.id}`);
    else if (field.id !== resource.labelField && (field.type === "enum" || NUMERIC_TYPES.has(field.type))) choices.push(field.id);
  }
  return [...new Set(choices)];
}

function toneAt(index) {
  return ["violet", "blue", "emerald", "amber"][index % 4];
}

function collectionPage(resource, density) {
  return {
    id: resource.id,
    type: "collection",
    title: resource.plural,
    icon: resource.icon,
    source: resource.id,
    columns: inferColumns(resource),
    search: resource.fields.filter((field) => SEARCHABLE_TYPES.has(field.type)).map((field) => field.id),
    filters: resource.fields.filter((field) => FILTERABLE_TYPES.has(field.type)).map((field) => field.id),
    sort: inferSort(resource),
    pageSize: resource.management.pageSize ?? (density === "compact" ? 12 : 8),
    description: `Manage ${resource.plural.toLowerCase()}`,
    body: "",
    hidden: false,
    metrics: [],
    lists: [],
    inferred: true
  };
}

function displayEnum(value) {
  return String(value).replaceAll("_", " ");
}

function overviewPage(declaration, managed) {
  const page = {
    id: "overview",
    type: "dashboard",
    title: stringProperty(declaration, "title", "Overview"),
    icon: "dashboard",
    source: null,
    columns: [], search: [], filters: [], sort: [], pageSize: 8,
    description: "A live view of your workspace",
    body: "", hidden: false, metrics: [], lists: [], inferred: true
  };
  for (const resource of managed.slice(0, 3)) {
    page.metrics.push({
      id: `${resource.id}_total`, address: `inferred.${resource.id}_total`,
      source: resource.id, op: "count", field: null,
      label: `Total ${resource.plural.toLowerCase()}`, where: null,
      tone: toneAt(page.metrics.length), format: "number", inferred: true
    });
  }
  const primary = managed.at(-1);
  const status = primary?.fieldMap.get("status") ?? primary?.fields.find((field) => field.type === "enum");
  if (primary && status) {
    for (const value of status.values) {
      if (page.metrics.length >= 4) break;
      page.metrics.push({
        id: `${primary.id}_${status.id}_${value.toLowerCase()}`,
        address: `inferred.${primary.id}_${status.id}_${value.toLowerCase()}`,
        source: primary.id, op: "count", field: null,
        label: `${displayEnum(value)} ${primary.plural.toLowerCase()}`,
        where: { field: status.id, value }, tone: toneAt(page.metrics.length),
        format: "number", inferred: true
      });
    }
  }
  for (const resource of managed.slice(0, 2)) {
    const dateField = resource.fields.find((field) => field.type === "date");
    page.lists.push({
      id: resource.id, address: `inferred.${resource.id}`, source: resource.id,
      title: resource.plural, columns: inferColumns(resource).slice(0, 5),
      sort: [dateField ? `-${dateField.id}` : resource.labelField],
      limit: 5, where: null, inferred: true
    });
  }
  return page;
}

export function parseMoneyToMinorUnits(value) {
  if (value == null) return null;
  if (typeof value === "bigint") return value;
  const str = String(value).trim();
  if (!str) return null;
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match) return null;
  const sign = match[1] ? -1n : 1n;
  const integerPart = match[2];
  let fractionPart = match[3] || "";
  if (fractionPart.length === 0) {
    fractionPart = "00";
  } else if (fractionPart.length === 1) {
    fractionPart = fractionPart + "0";
  } else if (fractionPart.length === 2) {
    // exact 2 decimals
  } else {
    // 3 or more decimals: round half-away-from-zero on 3rd digit
    const firstTwo = BigInt(fractionPart.slice(0, 2));
    const thirdDigit = Number(fractionPart[2]);
    let roundedTwo = firstTwo;
    if (thirdDigit >= 5) {
      roundedTwo += 1n;
    }
    return (BigInt(integerPart) * 100n + roundedTwo) * sign;
  }
  return (BigInt(integerPart) * 100n + BigInt(fractionPart)) * sign;
}

export class MoneyRate {
  constructor(amount, currency, unit) {
    if (amount instanceof MoneyRate) {
      this.minorUnits = amount.minorUnits;
      this.currency = amount.currency;
      this.unit = amount.unit;
      this.unitMs = amount.unitMs;
      return;
    }

    if (typeof amount === "object" && amount !== null && amount.minorUnits !== undefined) {
      this.minorUnits = BigInt(amount.minorUnits);
      this.currency = String(amount.currency || currency || "").trim().toUpperCase();
      this.unit = String(amount.unit || unit || "").trim();
    } else {
      const parsedMinor = parseMoneyToMinorUnits(amount);
      if (parsedMinor === null) {
        throw new AirError(`invalid monetary rate amount \`${amount}\``);
      }
      this.minorUnits = parsedMinor;
      this.currency = String(currency || "").trim().toUpperCase();
      this.unit = String(unit || "").trim();
    }

    if (!this.currency || !/^[A-Z]{3}$/.test(this.currency)) {
      throw new AirError(`rate requires a valid 3-letter currency code, got \`${this.currency}\``);
    }

    if (!RATE_UNITS.has(this.unit)) {
      throw new AirError(`rate unit must be one of s, m, h, d, got \`${this.unit}\``);
    }

    this.unitMs = this.unit === "s" ? 1000 :
                  this.unit === "m" ? 60000 :
                  this.unit === "h" ? 3600000 :
                  this.unit === "d" ? 86400000 : null;

    if (!this.unitMs) {
      throw new AirError(`unknown rate denominator unit \`${this.unit}\``);
    }
  }

  get amount() {
    return Number(this.minorUnits) / 100;
  }

  get rateUnit() { return this.unit; }
  valueOf() { return this.amount; }
  toJSON() { return this.amount; }
  toString() { return `${this.currency} ${this.formatAmount()}/${this.unit}`; }

  formatAmount() {
    const isNeg = this.minorUnits < 0n;
    const absVal = isNeg ? -this.minorUnits : this.minorUnits;
    const intPart = absVal / 100n;
    const fracPart = absVal % 100n;
    const fracStr = fracPart === 0n ? "" : `.${String(fracPart).padStart(2, "0").replace(/0+$/, "")}`;
    return `${isNeg ? "-" : ""}${intPart}${fracStr}`;
  }
}

export class Duration {
  constructor(milliseconds = 0) {
    this.milliseconds = Math.trunc(Number(milliseconds) || 0);
  }
  get ms() { return this.milliseconds; }
  get seconds() { return Math.trunc(this.milliseconds / 1000); }
  get minutes() { return Math.trunc(this.milliseconds / 60000); }
  get hours() { return this.milliseconds / 3600000; }
  get days() { return this.milliseconds / 86400000; }
  
  plus(other) {
    const otherMs = other instanceof Duration ? other.milliseconds : typeof other === "number" ? other : 0;
    return new Duration(this.milliseconds + otherMs);
  }
  minus(other) {
    const otherMs = other instanceof Duration ? other.milliseconds : typeof other === "number" ? other : 0;
    return new Duration(this.milliseconds - otherMs);
  }
  valueOf() { return this.milliseconds; }
  toJSON() { return this.milliseconds; }
  toISOString() { return `PT${this.milliseconds / 1000}S`; }
  format(unit = "h") {
    if (unit === "ms") return `${this.milliseconds}ms`;
    if (unit === "s") return `${this.seconds}s`;
    if (unit === "m") return `${this.minutes}m`;
    if (unit === "d") return `${this.days}d`;
    return `${this.hours}h`;
  }
  toString() {
    if (this.milliseconds === 0) return "0h";
    if (this.milliseconds % 86400000 === 0) return `${this.milliseconds / 86400000}d`;
    if (this.milliseconds % 3600000 === 0) return `${this.milliseconds / 3600000}h`;
    if (this.milliseconds % 60000 === 0) return `${this.milliseconds / 60000}m`;
    if (this.milliseconds % 1000 === 0) return `${this.milliseconds / 1000}s`;
    return `${this.milliseconds}ms`;
  }
}

export function roundSymmetricRational(numerator, denominator) {
  if (denominator === 0 || !Number.isFinite(denominator)) return 0;
  if (!Number.isFinite(numerator)) return 0;
  const num = BigInt(Math.trunc(numerator));
  const den = BigInt(Math.trunc(denominator));
  if (den === 0n) return 0;
  const isNeg = (num < 0n) !== (den < 0n);
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;
  const rounded = (2n * absNum + absDen) / (2n * absDen);
  return Number(isNeg ? -rounded : rounded);
}

export class Ratio {
  constructor(numerator = 0n, denominator = 1n) {
    if (numerator instanceof Ratio) {
      this.numerator = numerator.numerator;
      this.denominator = numerator.denominator;
      return;
    }
    if (typeof numerator === "object" && numerator !== null && numerator.numerator !== undefined) {
      this.numerator = BigInt(Math.trunc(Number(numerator.numerator) || 0));
      this.denominator = BigInt(Math.trunc(Number(numerator.denominator) || 1));
    } else if (typeof numerator === "string") {
      const parsed = parseRatioOrPercentLiteral(numerator);
      if (parsed) {
        this.numerator = parsed.numerator;
        this.denominator = parsed.denominator;
      } else {
        this.numerator = 0n;
        this.denominator = 1n;
      }
    } else if (typeof numerator === "bigint" && typeof denominator === "bigint") {
      this.numerator = numerator;
      this.denominator = denominator;
    } else {
      this.numerator = BigInt(Math.trunc(Number(numerator) || 0));
      this.denominator = BigInt(Math.trunc(Number(denominator) || 1));
    }
    if (this.denominator === 0n) throw new AirError("Ratio denominator cannot be zero");
    if (this.denominator < 0n) {
      this.numerator = -this.numerator;
      this.denominator = -this.denominator;
    }
    // Canonical GCD simplification
    const gcd = (a, b) => {
      let x = a < 0n ? -a : a;
      let y = b < 0n ? -b : b;
      while (y > 0n) {
        const t = y;
        y = x % y;
        x = t;
      }
      return x;
    };
    if (this.numerator !== 0n) {
      const g = gcd(this.numerator, this.denominator);
      if (g > 1n) {
        this.numerator /= g;
        this.denominator /= g;
      }
    }
  }

  toRatio() {
    return Number(this.numerator) / Number(this.denominator);
  }

  toPercentage(digits = 2) {
    const pct = (Number(this.numerator) / Number(this.denominator)) * 100;
    return Number(pct.toFixed(digits));
  }

  valueOf() {
    return this.toRatio();
  }

  toJSON() {
    return { type: "ratio", numerator: Number(this.numerator), denominator: Number(this.denominator) };
  }

  toString() {
    const pct = this.toPercentage(2);
    const str = String(pct).replace(/\.0+$/, "").replace(/(\.\d+?)0+$/, "$1");
    return `${str}%`;
  }
}

export function parseRatioOrPercentLiteral(raw) {
  if (raw == null) return null;
  if (raw instanceof Ratio) return raw;
  if (typeof raw === "object" && raw && raw.numerator !== undefined && raw.denominator !== undefined) {
    return new Ratio(raw.numerator, raw.denominator);
  }
  if (typeof raw === "number") {
    const str = String(raw);
    if (!str.includes(".")) return new Ratio(BigInt(raw), 1n);
    const [intPart, decPart] = str.split(".");
    const den = 10n ** BigInt(decPart.length);
    const num = BigInt(intPart) * den + (intPart.startsWith("-") ? -BigInt(decPart) : BigInt(decPart));
    return new Ratio(num, den);
  }
  if (typeof raw !== "string") return null;
  const str = raw.trim();
  if (!str) return null;

  // Percentage literal: e.g. "10%", "7.5%", "20 %"
  const pctMatch = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(str);
  if (pctMatch) {
    const numStr = pctMatch[1];
    if (numStr.includes(".")) {
      const [intPart, decPart] = numStr.split(".");
      const den = (10n ** BigInt(decPart.length)) * 100n;
      const num = BigInt(intPart) * (10n ** BigInt(decPart.length)) + (intPart.startsWith("-") ? -BigInt(decPart) : BigInt(decPart));
      return new Ratio(num, den);
    }
    return new Ratio(BigInt(numStr), 100n);
  }

  // Fraction literal: e.g. "1/10"
  const fracMatch = /^(-?\d+)\s*\/\s*(\d+)$/.exec(str);
  if (fracMatch) {
    return new Ratio(BigInt(fracMatch[1]), BigInt(fracMatch[2]));
  }

  // Plain decimal or integer string
  const numMatch = /^(-?\d+)(?:\.(\d+))?$/.exec(str);
  if (numMatch) {
    const intPart = numMatch[1];
    const decPart = numMatch[2];
    if (decPart) {
      const den = 10n ** BigInt(decPart.length);
      const num = BigInt(intPart) * den + (intPart.startsWith("-") ? -BigInt(decPart) : BigInt(decPart));
      return new Ratio(num, den);
    }
    return new Ratio(BigInt(intPart), 1n);
  }

  return null;
}

export class UtilizationRatio {
  constructor(numerator = 0, denominator = 1) {
    if (numerator instanceof UtilizationRatio) {
      this.numerator = numerator.numerator;
      this.denominator = numerator.denominator;
      return;
    }
    if (typeof numerator === "object" && numerator !== null && numerator.numerator !== undefined) {
      this.numerator = Math.trunc(Number(numerator.numerator) || 0);
      this.denominator = Math.trunc(Number(numerator.denominator) || 1);
    } else {
      this.numerator = Math.trunc(Number(numerator) || 0);
      this.denominator = Math.trunc(Number(denominator) || 1);
    }
    if (this.denominator <= 0) {
      this.numerator = 0;
      this.denominator = 1;
    }
  }

  get occupiedMs() { return this.numerator; }
  get windowMs() { return this.denominator; }
  get occupiedDuration() { return new Duration(this.numerator); }
  get windowDuration() { return new Duration(this.denominator); }

  toRatio() {
    return this.denominator > 0 ? this.numerator / this.denominator : 0;
  }

  toPercentage(digits = 0) {
    const pct = this.toRatio() * 100;
    return digits === 0 ? Math.round(pct) : Number(pct.toFixed(digits));
  }

  valueOf() {
    return this.toRatio();
  }

  toJSON() {
    return { type: "ratio", numerator: this.numerator, denominator: this.denominator };
  }

  toString() {
    return `${this.toPercentage()}%`;
  }
}

export function parseDurationLiteral(raw) {
  if (raw == null) return null;
  if (raw instanceof Duration) return raw;
  if (typeof raw === "object" && raw && typeof raw.milliseconds === "number") {
    return new Duration(raw.milliseconds);
  }
  if (typeof raw === "number") return new Duration(raw);
  if (typeof raw !== "string") return null;
  const str = raw.trim();
  if (!str) return null;

  const singleMatch = /^(-?\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(str);
  if (singleMatch) {
    const amount = Number(singleMatch[1]);
    const unit = singleMatch[2];
    let ms = 0;
    if (unit === "ms") ms = amount;
    else if (unit === "s") ms = amount * 1000;
    else if (unit === "m") ms = amount * 60000;
    else if (unit === "h") ms = amount * 3600000;
    else if (unit === "d") ms = amount * 86400000;
    return new Duration(ms);
  }

  const compoundRegex = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g;
  let totalMs = 0;
  let matchCount = 0;
  let m;
  while ((m = compoundRegex.exec(str)) !== null) {
    matchCount++;
    const amt = Number(m[1]);
    const u = m[2];
    if (u === "ms") totalMs += amt;
    else if (u === "s") totalMs += amt * 1000;
    else if (u === "m") totalMs += amt * 60000;
    else if (u === "h") totalMs += amt * 3600000;
    else if (u === "d") totalMs += amt * 86400000;
  }
  if (matchCount > 0 && str.replace(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g, "").trim() === "") {
    return new Duration(totalMs);
  }

  return null;
}

export function addDurationToInstant(instantStr, durationMs) {
  const isDateOnly = typeof instantStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instantStr);
  const d = new Date(isDateOnly ? `${instantStr}T00:00:00.000Z` : instantStr);
  if (Number.isNaN(d.getTime())) return null;
  const newMs = d.getTime() + durationMs;
  const res = new Date(newMs);
  if (isDateOnly && durationMs % 86400000 === 0) {
    return res.toISOString().slice(0, 10);
  }
  return res.toISOString();
}

export function subtractInstants(instantA, instantB) {
  const isDateOnlyA = typeof instantA === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instantA);
  const isDateOnlyB = typeof instantB === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instantB);
  const da = new Date(isDateOnlyA ? `${instantA}T00:00:00.000Z` : instantA);
  const db = new Date(isDateOnlyB ? `${instantB}T00:00:00.000Z` : instantB);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return new Duration(da.getTime() - db.getTime());
}

export function multiplyMoneyRate(rateInput, rateCurrency, durationMs, rateUnit = null) {
  if (rateInput == null || durationMs == null) return null;
  let rateMinor = null;
  let currency = rateCurrency;
  let unit = rateUnit;
  let unitMs = null;

  if (rateInput instanceof MoneyRate) {
    rateMinor = rateInput.minorUnits;
    currency = rateInput.currency;
    unit = rateInput.unit;
    unitMs = rateInput.unitMs;
  } else if (typeof rateInput === "object" && rateInput && rateInput.minorUnits !== undefined) {
    rateMinor = BigInt(rateInput.minorUnits);
    currency = rateInput.currency ?? rateCurrency;
    unit = rateInput.unit ?? rateUnit;
    unitMs = rateInput.unitMs;
  } else {
    rateMinor = parseMoneyToMinorUnits(rateInput);
    currency = rateCurrency;
    unit = rateUnit;
  }

  if (rateMinor === null) return null;

  if (!unitMs) {
    if (!unit || !RATE_UNITS.has(unit)) {
      throw new AirError(`invalid rate denominator unit \`${unit}\``);
    }
    unitMs = unit === "s" ? 1000 :
             unit === "m" ? 60000 :
             unit === "h" ? 3600000 :
             unit === "d" ? 86400000 : null;
    if (!unitMs) throw new AirError(`invalid rate denominator unit \`${unit}\``);
  }

  const durBig = BigInt(Math.round(durationMs));
  const numerator = rateMinor * durBig;
  const denominator = BigInt(unitMs);

  const isNegative = numerator < 0n;
  const absNum = isNegative ? -numerator : numerator;
  const div = absNum / denominator;
  const rem = absNum % denominator;
  let roundedMinor = div;
  if (rem * 2n >= denominator) {
    roundedMinor += 1n;
  }
  if (isNegative) roundedMinor = -roundedMinor;

  const finalAmount = Number(roundedMinor) / 100;
  return { amount: finalAmount, currency, minorUnits: roundedMinor };
}

function parseDuration(raw, declaration) {
  const dur = parseDurationLiteral(raw);
  if (!dur || dur.ms < 1) fail("rule after expects a positive duration such as 30d or 12h", declaration);
  return { source: raw, milliseconds: dur.ms };
}

function parsePredicate(raw, declaration, resource, property = "condition") {
  if (!raw || raw === true) fail(`${property} expects field:value`, declaration);
  const separator = raw.indexOf(":");
  if (separator < 1 || separator === raw.length - 1) fail(`${property} expects field:value`, declaration);
  const field = raw.slice(0, separator);
  const value = raw.slice(separator + 1);
  if (!resource.fieldMap.has(field)) fail(`${property} references unknown field \`${resource.id}.${field}\``, declaration);
  return { field, value };
}

function parseReferencePath(raw, declaration, resource, actors, entities, property = "actor path") {
  const segments = String(raw).split(".");
  let current = resource;
  const path = segments.map((fieldId, index) => {
    const field = current?.fieldMap.get(fieldId);
    if (!field || field.type !== "ref") fail(`${property} requires a reference path; \`${current?.id ?? "?"}.${fieldId}\` is not a reference`, declaration);
    const step = { field: fieldId, ref: field.ref };
    if (index < segments.length - 1) current = entities.get(field.ref);
    return step;
  });
  const actor = path.at(-1)?.ref;
  if (!actor || !actors.has(actor)) fail(`${property} \`${resource.id}.${raw}\` must end at an actor resource`, declaration);
  return { source: raw, path, actor };
}

function parseValue(raw) {
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function scalarType(value) {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "bool";
  return "text";
}

function numericSemanticType(type) {
  return type === "number" || type === "integer" || type === "money" || type === "ratio";
}

function splitOperandTerms(raw) {
  const terms = [];
  let current = "";
  let op = "+";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if ((ch === "+" || ch === "-") && current.trim().length > 0) {
      terms.push({ op, raw: current.trim() });
      current = "";
      op = ch;
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    terms.push({ op, raw: current.trim() });
  }
  return terms;
}

function conditionOperandType(terms, declaration, source) {
  if (terms.length === 1) return { type: terms[0].type, currency: terms[0].currency ?? null };
  const hasTemporal = terms.some((t) => t.type === "datetime" || t.type === "date");
  const hasDuration = terms.some((t) => t.type === "duration");
  if (hasTemporal && hasDuration) {
    return { type: "datetime", currency: null };
  }
  if (terms.length === 2 && (terms[0].type === "datetime" || terms[0].type === "date") && (terms[1].type === "datetime" || terms[1].type === "date")) {
    if (terms[1].op === "-") {
      return { type: "duration", currency: null };
    }
    fail(`cannot add two timestamps \`${source}\``, declaration, {
      code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
    });
  }
  if (terms.every((t) => t.type === "duration")) {
    return { type: "duration", currency: null };
  }
  if (terms.some((term) => !numericSemanticType(term.type))) {
    fail(`condition numeric operand \`${source}\` contains non-numeric terms`, declaration, {
      code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
    });
  }
  const currencies = new Set(terms.filter((term) => term.type === "money").map((term) => term.currency).filter(Boolean));
  if (currencies.size > 1) {
    fail(`condition numeric operand \`${source}\` combines different currencies`, declaration, {
      code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
    });
  }
  return { type: terms.some((term) => term.type === "money") ? "money" : "number", currency: [...currencies][0] ?? null };
}

function parseConditionOperand(raw, declaration, resource, model, side) {
  const trimmed = raw.trim();
  const countMatch = /^count\((.+?)(?:\s+where\s+(.+))?\)$/.exec(trimmed);
  if (countMatch) {
    const targetRes = countMatch[1].trim();
    const targetEntity = model.entities.get(targetRes);
    if (!targetEntity) fail(`condition count references unknown resource \`${targetRes}\``, declaration);
    const whereRaw = countMatch[2] ? countMatch[2].trim() : null;
    return {
      source: raw,
      terms: [{
        op: "+",
        kind: "relational_count",
        source: raw,
        target: targetRes,
        whereRaw,
        where: whereRaw ? parseCondition(whereRaw, declaration, targetEntity, model, "count where") : null,
        type: "integer",
        currency: null
      }],
      type: "integer",
      currency: null
    };
  }

  const oneMatch = /^one\((.+?)(?:\s+where\s+(.+))?\)(?:\.([a-z0-9_]+))?$/.exec(trimmed);
  if (oneMatch) {
    const targetRes = oneMatch[1].trim();
    const targetEntity = model.entities.get(targetRes);
    if (!targetEntity) fail(`condition one lookup references unknown resource \`${targetRes}\``, declaration);
    const whereRaw = oneMatch[2] ? oneMatch[2].trim() : null;
    const fieldName = oneMatch[3] ? oneMatch[3].trim() : null;
    const targetField = fieldName ? targetEntity.fieldMap.get(fieldName) : null;
    const opType = targetField?.type ?? (fieldName ? "text" : "ref");
    return {
      source: raw,
      terms: [{
        op: "+",
        kind: "relational_one",
        source: raw,
        target: targetRes,
        whereRaw,
        field: fieldName,
        type: opType,
        currency: targetField?.currency ?? null
      }],
      type: opType,
      currency: targetField?.currency ?? null
    };
  }

  const parts = splitOperandTerms(raw);
  if (!parts.length) fail(`invalid condition operand \`${raw}\``, declaration);
  const terms = parts.map(({ op, raw: part }) => {
    const dur = parseDurationLiteral(part);
    if (dur) {
      return { op, kind: "duration", value: dur.ms, duration: dur, type: "duration", currency: null };
    }
    if (part === "today" || part === "now") {
      return { op, kind: "temporal", value: part, type: part === "today" ? "date" : "datetime", currency: null };
    }
    if (part.startsWith("@")) {
      const parameter = model.parameters.get(resource.id)?.get(part.slice(1));
      if (!parameter) fail(`condition references unknown parameter \`${resource.id}.${part.slice(1)}\``, declaration, {
        code: "AIR_REF_UNKNOWN_PARAMETER", phase: "resolve"
      });
      return { op, kind: "parameter", id: parameter.id, value: parameter.value, type: scalarType(parameter.value), currency: null };
    }
    const scalar = parseValue(part);
    if (typeof scalar !== "string" || scalar !== part) return { op, kind: "literal", value: scalar, type: scalarType(scalar), currency: null };
    
    let lookupPart = part;
    let isIntervalDuration = false;
    if (part.endsWith(".duration")) {
      lookupPart = part.slice(0, -9);
      isIntervalDuration = true;
    }

    const segments = lookupPart.split(".");
    let current = resource;
    const path = [];
    const eventFields = new Set(["to", "from", "event", "action", "at", "timestamp", "comment", "completed", "resource", "record_id", "record"]);
    for (let index = 0; index < segments.length; index += 1) {
      const seg = segments[index];
      const field = current?.fieldMap.get(seg);
      if (!field) {
        if (eventFields.has(seg)) {
          path.push({ field: seg, resource: current?.id ?? resource.id, ref: null, computed: false });
          continue;
        }
        if (side === "right" && parts.length === 1 && index === 0) return { op, kind: "literal", value: part, type: "text", currency: null };
        fail(`condition references unknown field \`${current?.id ?? resource.id}.${seg}\``, declaration, {
          code: "AIR_REF_UNKNOWN_FIELD", phase: "resolve"
        });
      }
      path.push({ field: field.id, resource: current.id, ref: field.ref, computed: Boolean(field.computed) });
      if (index < segments.length - 1) {
        if (field.type !== "ref") fail(`condition path \`${lookupPart}\` crosses non-reference field \`${field.address}\``, declaration);
        current = model.entities.get(field.ref);
      }
    }
    const lastSeg = segments.at(-1);
    const finalField = current?.fieldMap.get(lastSeg);
    if (!finalField && eventFields.has(lastSeg)) {
      return { op, kind: "path", source: part, path, type: lastSeg === "at" || lastSeg === "timestamp" ? "datetime" : lastSeg === "completed" ? "bool" : "text", currency: null, ref: null, values: [] };
    }
    if (isIntervalDuration) {
      return { op, kind: "interval_duration", source: part, path, type: "duration", currency: null, ref: null, values: [] };
    }
    return { op, kind: "path", source: part, path, type: finalField.type, currency: finalField.currency ?? null, ref: finalField.ref ?? null, values: finalField.values ?? [] };
  });
  return { source: raw, terms, ...conditionOperandType(terms, declaration, raw) };
}

function promoteTextLiteral(operand, other, declaration) {
  if (operand.terms.length !== 1) return;
  const term = operand.terms[0];
  if (term.kind === "temporal") {
    term.type = other.type;
    operand.type = other.type;
    return;
  }
  if (other.type === "duration" && term.kind === "duration") {
    operand.type = "duration";
    return;
  }
  if (term.kind !== "literal" || (operand.type !== "text" && operand.type !== "date" && operand.type !== "datetime")) return;
  if (!new Set(["text", "email", "phone", "enum", "date", "datetime", "ref", "duration"]).has(other.type)) return;
  if (other.type === "enum") {
    const otherTerm = other.terms.length === 1 ? other.terms[0] : null;
    if (otherTerm?.values && !otherTerm.values.includes(term.value)) {
      fail(`condition enum literal \`${term.value}\` is outside the declared values`, declaration, {
        code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
      });
    }
  }
  if (other.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(term.value)) {
    fail(`condition date literal \`${term.value}\` must use YYYY-MM-DD`, declaration, {
      code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
    });
  }
  term.type = other.type;
  term.ref = other.terms[0]?.ref ?? null;
  operand.type = other.type;
}

function validateConditionComparison(clause, declaration) {
  if (clause.kind === "quantifier") return;
  promoteTextLiteral(clause.left, clause.right, declaration);
  promoteTextLiteral(clause.right, clause.left, declaration);
  const left = clause.left;
  const right = clause.right;
  if (left.type === "duration" && right.type === "duration") {
    clause.type = "duration";
    return;
  }
  if (left.type === "rate" && right.type === "rate") {
    if (left.currency && right.currency && left.currency !== right.currency) {
      fail("condition comparison uses different rate currencies", declaration, {
        code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
      });
    }
    if (left.unit && right.unit && left.unit !== right.unit) {
      fail("condition comparison uses different rate units", declaration, {
        code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
      });
    }
    clause.type = "rate";
    return;
  }
  const numeric = numericSemanticType(left.type) && numericSemanticType(right.type);
  if (numeric) {
    if (left.type === "money" && right.type === "money" && left.currency && right.currency && left.currency !== right.currency) {
      fail("condition comparison uses different money currencies", declaration, {
        code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
      });
    }
    clause.type = left.type === "money" || right.type === "money" ? "money" : "number";
    return;
  }
  const same = left.type === right.type;
  const isTemporal = (left.type === "date" || left.type === "datetime") && (right.type === "date" || right.type === "datetime");
  const stringCompatible = same && new Set(["text", "email", "phone", "enum", "ref"]).has(left.type);
  const equality = clause.operator === "==" || clause.operator === "!=";
  if ((equality && (same || stringCompatible)) || (same && left.type === "date") || isTemporal) {
    if (left.type === "ref") {
      const leftRef = left.terms[0]?.ref;
      const rightRef = right.terms[0]?.ref;
      if (leftRef && rightRef && leftRef !== rightRef) {
        fail("condition compares references to different resources", declaration, {
          code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
        });
      }
    }
    if (!equality && !isTemporal && left.type !== "date") {
      fail(`condition operator \`${clause.operator}\` requires numeric or date operands`, declaration, {
        code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
      });
    }
    clause.type = isTemporal ? "date" : left.type;
    return;
  }
  fail(`condition requires compatible operands, found ${left.type} and ${right.type}`, declaration, {
    code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
  });
}

function parseCondition(raw, declaration, resource, model, property = "condition") {
  if (raw === true || raw === "true" || raw == null) return { source: "true", alternatives: [] };
  if (raw === "false") return { source: "false", alternatives: [[]] };
  if (typeof raw !== "string") fail(`${property} requires a condition`, declaration);
  const normalized = /^[a-z][a-z0-9_]*:[^:]+$/i.test(raw) ? raw.replace(":", "==") : raw;
  const alternatives = normalized.split("|").map((alternative) => {
    if (!alternative) fail(`${property} has an empty alternative`, declaration);
    return alternative.split("&").map((rawClause) => {
      const trimmedClause = rawClause.trim();
      const qMatch = /^(all|any|none)\((.+?)(?:\s+where\s+(.+))?\)$/.exec(trimmedClause);
      if (qMatch) {
        const targetRes = qMatch[2].trim();
        const targetEntity = model.entities.get(targetRes);
        if (!targetEntity) fail(`quantifier references unknown resource \`${targetRes}\``, declaration);
        const whereRaw = qMatch[3] ? qMatch[3].trim() : null;
        return {
          source: rawClause,
          kind: "quantifier",
          quantifier: qMatch[1],
          target: targetRes,
          whereRaw,
          where: whereRaw ? parseCondition(whereRaw, declaration, targetEntity, model, "quantifier where") : null
        };
      }
      const match = /^(.+?)(>=|<=|==|!=|>|<)(.+)$/.exec(rawClause);
      if (!match) fail(`${property} clause \`${rawClause}\` requires a comparison`, declaration);
      const clause = {
        source: rawClause,
        left: parseConditionOperand(match[1], declaration, resource, model, "left"),
        operator: match[2],
        right: parseConditionOperand(match[3], declaration, resource, model, "right")
      };
      validateConditionComparison(clause, declaration);
      return clause;
    });
  });
  for (const conjunction of alternatives) {
    const numericBounds = new Map();
    for (const clause of conjunction) {
      if (clause.kind === "quantifier") continue;
      if (clause.left.terms.length !== 1 || clause.left.terms[0].kind !== "path" || clause.right.terms.length !== 1) continue;
      const right = clause.right.terms[0];
      const value = right.kind === "parameter" ? right.value : right.kind === "literal" ? right.value : null;
      if (typeof value !== "number") continue;
      const key = clause.left.source;
      const bounds = numericBounds.get(key) ?? { lower: -Infinity, upper: Infinity };
      if (clause.operator === ">") bounds.lower = Math.max(bounds.lower, value + Number.EPSILON);
      if (clause.operator === ">=") bounds.lower = Math.max(bounds.lower, value);
      if (clause.operator === "<") bounds.upper = Math.min(bounds.upper, value - Number.EPSILON);
      if (clause.operator === "<=") bounds.upper = Math.min(bounds.upper, value);
      if (clause.operator === "==") { bounds.lower = Math.max(bounds.lower, value); bounds.upper = Math.min(bounds.upper, value); }
      if (bounds.lower > bounds.upper) fail(`${property} contains contradictory bounds for \`${key}\``, declaration);
      numericBounds.set(key, bounds);
    }
  }
  return { source: raw, alternatives };
}

function parseReviewDuration(raw, declaration, property = "duration") {
  const match = /^(\d+)(h|d|bd)$/.exec(raw ?? "");
  if (!match || Number(match[1]) < 1) fail(`${property} expects a positive duration such as 12h, 14d, or 3bd`, declaration);
  return { source: raw, amount: Number(match[1]), unit: match[2] };
}

function parseAccessPolicy(raw, declaration, resource, actors, entities) {
  if (raw === true || raw === "true") return { source: "true", terms: [{ kind: "any" }] };
  if (raw === "false") return { source: "false", terms: [] };
  if (typeof raw !== "string") fail("access policy expects true, false, role:<id>, or owner:<field>", declaration);
  const terms = raw.split("|").map((term) => {
    if (term === "self") {
      if (!actors.has(resource.id)) fail(`self policy requires actor resource \`${resource.id}\``, declaration);
      return { kind: "self", actor: resource.id };
    }
    const separator = term.indexOf(":");
    if (separator < 1 || separator === term.length - 1) fail(`invalid access term \`${term}\``, declaration);
    const kind = term.slice(0, separator);
    const value = term.slice(separator + 1);
    if (kind === "role") {
      if (!/^[a-z][a-z0-9_-]*$/.test(value)) fail(`invalid role \`${value}\``, declaration);
      return { kind, value };
    }
    if (kind === "owner") {
      const parsed = parseReferencePath(value, declaration, resource, actors, entities, "owner path");
      return { kind, field: value, path: parsed.path, actor: parsed.actor };
    }
    fail(`unknown access term \`${kind}\``, declaration);
  });
  return { source: raw, terms };
}

function policyFromManagement(value) {
  if (value === true) return { source: "true", terms: [{ kind: "any" }] };
  if (value === false) return { source: "false", terms: [] };
  return { source: `role:${value}`, terms: [{ kind: "role", value }] };
}

function parseTransitionPolicy(raw, declaration, resource, model) {
  if (raw === "system") return { source: "system", terms: [{ kind: "system" }] };
  return parseAccessPolicy(raw, declaration, resource, model.actors, model.entities);
}

const COMPUTED_FN_NAMES = new Set(["sum", "count", "min", "max", "avg", "one"]);

export function parseComputedExpression(raw, declaration) {
  if (raw.endsWith(".duration") && !raw.includes("*") && !raw.includes("+") && !raw.includes("-")) {
    const intervalField = raw.replace(/\.duration$/, "").trim();
    return { kind: "interval_duration", intervalField };
  }

  const tokens = [];
  let i = 0;
  const s = raw.trim();

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "(" || ch === ")") {
      tokens.push({ type: "op", val: ch });
      i++;
      continue;
    }
    let buf = "";
    while (i < s.length && !/[\s+*()\- ]/.test(s[i])) {
      buf += s[i];
      i++;
    }
    if (COMPUTED_FN_NAMES.has(buf) && s[i] === "(") {
      i++; // consume (
      let depth = 1;
      let argsBuf = "";
      while (i < s.length && depth > 0) {
        if (s[i] === "(") depth++;
        else if (s[i] === ")") depth--;
        if (depth > 0) argsBuf += s[i];
        i++;
      }
      let fieldAfter = null;
      if (i < s.length && s[i] === ".") {
        i++;
        let fBuf = "";
        while (i < s.length && !/[\s+*()\- ]/.test(s[i])) {
          fBuf += s[i];
          i++;
        }
        fieldAfter = fBuf;
      }
      tokens.push({ type: "fn", fn: buf, args: argsBuf.trim(), field: fieldAfter });
    } else if (buf.endsWith("%") && /^-?\d+(?:\.\d+)?%$/.test(buf)) {
      tokens.push({ type: "percent", val: buf });
    } else if (/^-?\d+(?:\.\d+)?$/.test(buf)) {
      tokens.push({ type: "number", val: buf });
    } else {
      tokens.push({ type: "ident", val: buf });
    }
  }

  let tokenIdx = 0;
  const peek = () => tokens[tokenIdx];
  const consume = () => tokens[tokenIdx++];

  function parsePrimary() {
    const t = consume();
    if (!t) fail(`unexpected end of computed expression \`${raw}\``, declaration);
    if (t.type === "fn") {
      const fn = t.fn;
      const [targetFieldPart, whereRaw] = t.args.split(/\s+where\s+/);
      const trimmedTargetField = (targetFieldPart || "").trim();
      const trimmedWhere = whereRaw ? whereRaw.trim() : null;
      let target = trimmedTargetField;
      let field = null;
      if (trimmedTargetField.includes(".")) {
        const dotIdx = trimmedTargetField.indexOf(".");
        target = trimmedTargetField.slice(0, dotIdx).trim();
        field = trimmedTargetField.slice(dotIdx + 1).trim();
      }
      if (fn === "one") {
        return {
          kind: "lookup_one",
          target,
          whereRaw: trimmedWhere,
          field: t.field || field
        };
      }
      return {
        kind: "collection_aggregate",
        op: fn,
        target,
        field: t.field || field,
        whereRaw: trimmedWhere
      };
    }
    if (t.type === "percent") {
      return { kind: "literal", value: parseRatioOrPercentLiteral(t.val), type: "ratio" };
    }
    if (t.type === "number") {
      const num = Number(t.val);
      const isInt = Number.isSafeInteger(num) && !t.val.includes(".");
      return { kind: "literal", value: isInt ? num : num, type: isInt ? "integer" : "number" };
    }
    if (t.type === "ident") {
      return { kind: "path", path: t.val };
    }
    if (t.type === "op" && t.val === "(") {
      const expr = parseBinary(0);
      const close = consume();
      if (!close || close.val !== ")") fail(`unclosed parenthesis in computed expression \`${raw}\``, declaration);
      return expr;
    }
    fail(`unexpected token \`${t.val}\` in computed expression \`${raw}\``, declaration);
  }

  function getPrecedence(op) {
    if (op === "*") return 20;
    if (op === "+" || op === "-") return 10;
    return 0;
  }

  function parseBinary(minPrec) {
    let left = parsePrimary();
    while (tokenIdx < tokens.length) {
      const t = peek();
      if (t.type !== "op" || t.val === ")") break;
      const prec = getPrecedence(t.val);
      if (prec < minPrec) break;
      consume();
      const right = parseBinary(prec + 1);
      left = { kind: "binary", op: t.val, left, right };
    }
    return left;
  }

  const ast = parseBinary(0);
  if (tokenIdx < tokens.length) {
    fail(`unexpected extra token \`${tokens[tokenIdx].val}\` in computed expression \`${raw}\``, declaration);
  }
  return { kind: "expression", source: raw, ast };
}

export function typeCheckComputedExpression(node, resource, model, field) {
  if (node.kind === "interval_duration") {
    const intField = resource.fieldMap.get(node.intervalField);
    if (!intField || intField.type !== "interval") {
      fail(`computed interval \`${field.address}\` references unknown interval \`${node.intervalField}\``);
    }
    return { type: "duration", currency: null, unit: null };
  }

  if (node.kind === "collection_aggregate") {
    const targetEntity = model.entities.get(node.target);
    if (!targetEntity) {
      fail(`computed aggregate \`${field.address}\` references unknown resource \`${node.target}\``);
    }
    if (node.whereRaw) {
      node.where = parseCondition(node.whereRaw, null, targetEntity, model, "aggregate where");
    }
    if (node.op === "count") {
      const res = { type: "integer", currency: null, unit: null };
      node.inferredType = res;
      return res;
    }
    if (!node.field) {
      fail(`computed aggregate \`${field.address}\` \`${node.op}\` requires a field on \`${node.target}\``);
    }
    const targetField = targetEntity.fieldMap.get(node.field);
    if (!targetField) {
      fail(`computed aggregate \`${field.address}\` references unknown field \`${node.target}.${node.field}\``);
    }
    const res = { type: targetField.type, currency: targetField.currency, unit: targetField.unit };
    node.inferredType = res;
    return res;
  }

  if (node.kind === "lookup_one") {
    const targetEntity = model.entities.get(node.target);
    if (!targetEntity) {
      fail(`computed lookup \`${field.address}\` references unknown resource \`${node.target}\``);
    }
    if (node.field) {
      const targetField = targetEntity.fieldMap.get(node.field);
      if (!targetField) {
        fail(`computed lookup \`${field.address}\` references unknown field \`${node.target}.${node.field}\``);
      }
      const res = { type: targetField.type, currency: targetField.currency, unit: targetField.unit };
      node.inferredType = res;
      return res;
    }
    const res = { type: "ref", ref: node.target, currency: null, unit: null };
    node.inferredType = res;
    return res;
  }

  if (node.kind === "path") {
    if (node.path.endsWith(".duration")) {
      const intFieldName = node.path.replace(/\.duration$/, "");
      const intField = resource.fieldMap.get(intFieldName);
      if (!intField || intField.type !== "interval") {
        fail(`computed expression \`${field.address}\` references unknown interval \`${intFieldName}\``);
      }
      const res = { type: "duration", currency: null, unit: null };
      node.inferredType = res;
      return res;
    }
    const parts = node.path.split(".");
    let currentRes = resource;
    let targetField = null;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      targetField = currentRes?.fieldMap?.get(seg);
      if (!targetField) fail(`computed expression \`${field.address}\` references unknown field \`${seg}\``);
      if (i < parts.length - 1) {
        if (targetField.type !== "ref") fail(`computed path \`${node.path}\` crosses non-reference \`${targetField.id}\``);
        currentRes = model.entities.get(targetField.ref);
        if (!currentRes) fail(`computed path \`${node.path}\` references unknown resource \`${targetField.ref}\``);
      }
    }
    const res = { type: targetField.type, currency: targetField.currency, unit: targetField.unit };
    node.inferredType = res;
    return res;
  }

  if (node.kind === "literal") {
    const res = { type: node.type, currency: null, unit: null };
    node.inferredType = res;
    return res;
  }

  if (node.kind === "binary") {
    const leftType = typeCheckComputedExpression(node.left, resource, model, field);
    const rightType = typeCheckComputedExpression(node.right, resource, model, field);
    node.left.inferredType = leftType;
    node.right.inferredType = rightType;

    if (node.op === "*") {
      // 1. duration * rate or rate * duration
      if ((leftType.type === "duration" && rightType.type === "rate") || (leftType.type === "rate" && rightType.type === "duration")) {
        const rateInfo = leftType.type === "rate" ? leftType : rightType;
        node.rateUnit = rateInfo.unit;
        node.rateCurrency = rateInfo.currency;
        const res = { type: "money", currency: rateInfo.currency, unit: null, rateUnit: rateInfo.unit };
        node.inferredType = res;
        return res;
      }
      // 2. (integer | number) * money or money * (integer | number)
      if (((leftType.type === "integer" || leftType.type === "number") && rightType.type === "money") ||
          (leftType.type === "money" && (rightType.type === "integer" || rightType.type === "number"))) {
        const moneyInfo = leftType.type === "money" ? leftType : rightType;
        const res = { type: "money", currency: moneyInfo.currency, unit: null };
        node.inferredType = res;
        return res;
      }
      // 3. ratio * money or money * ratio
      if ((leftType.type === "ratio" && rightType.type === "money") || (leftType.type === "money" && rightType.type === "ratio")) {
        const moneyInfo = leftType.type === "money" ? leftType : rightType;
        const res = { type: "money", currency: moneyInfo.currency, unit: null };
        node.inferredType = res;
        return res;
      }
      fail(`computed product \`${field.address}\` requires a duration and a rate, or an integer/ratio and money; cannot multiply \`${leftType.type}\` and \`${rightType.type}\``, null, {
        code: "AIR_TYPE_COMPUTED_MISMATCH", phase: "type"
      });
    }

    if (node.op === "+" || node.op === "-") {
      // 1. money +/- money
      if (leftType.type === "money" && rightType.type === "money") {
        if (leftType.currency && rightType.currency && leftType.currency !== rightType.currency) {
          fail(`computed money field \`${field.address}\` currency mismatch: cannot ${node.op === "+" ? "add" : "subtract"} \`${leftType.currency}\` and \`${rightType.currency}\``, null, {
            code: "AIR_TYPE_COMPUTED_MISMATCH", phase: "type"
          });
        }
        const res = { type: "money", currency: leftType.currency ?? rightType.currency, unit: null };
        node.inferredType = res;
        return res;
      }
      // 2. duration +/- duration
      if (leftType.type === "duration" && rightType.type === "duration") {
        const res = { type: "duration", currency: null, unit: null };
        node.inferredType = res;
        return res;
      }
      // 3. (datetime | date) +/- duration
      if ((leftType.type === "datetime" || leftType.type === "date") && rightType.type === "duration") {
        const res = { type: leftType.type, currency: null, unit: null };
        node.inferredType = res;
        return res;
      }
      // 4. (datetime | date) - (datetime | date) -> duration
      if (node.op === "-" && (leftType.type === "datetime" || leftType.type === "date") && (rightType.type === "datetime" || rightType.type === "date")) {
        const res = { type: "duration", currency: null, unit: null };
        node.inferredType = res;
        return res;
      }
      // 5. integer +/- integer
      if (leftType.type === "integer" && rightType.type === "integer") {
        const res = { type: "integer", currency: null, unit: null };
        node.inferredType = res;
        return res;
      }
      // 6. (integer | number) +/- (integer | number)
      if ((leftType.type === "integer" || leftType.type === "number") && (rightType.type === "integer" || rightType.type === "number")) {
        const res = { type: "number", currency: null, unit: null };
        node.inferredType = res;
        return res;
      }
      // 7. (integer | number | ratio) +/- ratio or ratio +/- (integer | number) -> ratio
      if ((leftType.type === "ratio" && (rightType.type === "ratio" || rightType.type === "integer" || rightType.type === "number")) ||
          ((leftType.type === "integer" || leftType.type === "number") && rightType.type === "ratio")) {
        const res = { type: "ratio", currency: null, unit: null };
        node.inferredType = res;
        return res;
      }
      fail(`computed expression \`${field.address}\` cannot ${node.op === "+" ? "add" : "subtract"} \`${leftType.type}\` and \`${rightType.type}\``, null, {
        code: "AIR_TYPE_COMPUTED_MISMATCH", phase: "type"
      });
    }
  }

  fail(`unrecognized computed node in \`${field.address}\``, null, { code: "AIR_TYPE_COMPUTED_MISMATCH", phase: "type" });
}

export function parseAir(source, options = {}) {
  const declarations = parseDeclarations(source);
  const model = {
    version: null, app: null,
    theme: { mode: "system", accent: "violet", density: "comfortable" },
    design: null,
    capabilities: new Set(), entities: new Map(), resources: null,
    actors: new Set(), management: new Map(), access: new Map(),
    parameters: new Map(), processes: new Map(), transitions: new Map(),
    invariants: new Map(), uniqueConstraints: new Map(), deadlines: new Map(),
    rules: [], highlights: new Map(), pages: [], pageMap: new Map(),
    notifications: [],
    extensions: [], experiences: [], declarations
  };
  model.resources = model.entities;
  const singletonSeen = new Set();

  for (const declaration of declarations) {
    if (SINGLETON_KINDS.has(declaration.kind)) {
      if (singletonSeen.has(declaration.kind)) fail(`only one \`${declaration.kind}\` declaration is allowed`, declaration);
      singletonSeen.add(declaration.kind);
    }
    switch (declaration.kind) {
      case "air": {
        const version = integerProperty(declaration, "version", null, 1);
        if (version !== AIR_VERSION) fail(`unsupported AIR version \`${version}\``, declaration);
        model.version = version;
        break;
      }
      case "app":
        if (model.app) fail("only one `app` declaration is allowed", declaration);
        model.app = {
          id: declaration.id,
          title: stringProperty(declaration, "title", titleCase(declaration.id)),
          subtitle: stringProperty(declaration, "subtitle", ""),
          initial: stringProperty(declaration, "initial", null),
          timezone: stringProperty(declaration, "timezone", "UTC")
        };
        break;
      case "theme": {
        const mode = stringProperty(declaration, "mode", "system");
        const accent = stringProperty(declaration, "accent", "violet");
        const density = stringProperty(declaration, "density", "comfortable");
        if (!MODES.has(mode)) {
          fail(`unknown theme mode \`${mode}\`. Supported modes: light, dark, system. Use mode=light for a light/white interface.`, declaration, { phase: "validate", code: "AIR_THEME_INVALID_MODE" });
        }
        if (!ACCENTS.has(accent)) {
          fail(`unknown accent \`${accent}\`. Supported accents: ${Array.from(ACCENTS).join(", ")}.`, declaration, { phase: "validate", code: "AIR_THEME_INVALID_ACCENT" });
        }
        if (!DENSITIES.has(density)) {
          fail(`unknown density \`${density}\`. Supported densities: compact, comfortable.`, declaration, { phase: "validate", code: "AIR_THEME_INVALID_DENSITY" });
        }
        model.theme = { mode, accent, density };
        break;
      }
      case "design": {
        const archetype = stringProperty(declaration, "archetype", "product_launch");
        const character = stringProperty(declaration, "character", "technical-premium");
        const rhythm = stringProperty(declaration, "rhythm", "editorial");
        const motion = stringProperty(declaration, "motion", "restrained");
        const density = stringProperty(declaration, "density", "comfortable");
        const contrast = stringProperty(declaration, "contrast", "high");
        const accent = stringProperty(declaration, "accent", null);
        model.design = { archetype, character, rhythm, motion, density, contrast, accent };
        break;
      }
      case "capability":
        if (!CAPABILITIES.has(declaration.id) && !declaration.id.startsWith("extension.load.")) fail(`unsupported capability \`${declaration.id}\``, declaration);
        model.capabilities.add(declaration.id);
        break;
      case "resource": {
        const resource = {
          id: declaration.id,
          singular: stringProperty(declaration, "singular", titleCase(singularize(declaration.id))),
          plural: stringProperty(declaration, "plural", titleCase(declaration.id)),
          icon: stringProperty(declaration, "icon", "collection"),
          labelField: stringProperty(declaration, "label", null),
          fields: [], fieldMap: new Map(), management: null
        };
        insertUnique(model.entities, resource.id, resource, declaration);
        break;
      }
      case "experience": {
        model.experiences.push({ id: declaration.id, kind: declaration.id, props: declaration.props });
        break;
      }
      case "actor": case "field": case "manage": case "access": case "overview":
      case "insight": case "rule": case "highlight": case "parameter":
      case "process": case "transition": case "invariant": case "unique": case "deadline": case "extension": case "notify":
        break;
      default: throw new Error("unreachable declaration kind");
    }
  }

  if (model.version == null) fail("missing `air version=2` declaration");
  if (!model.app) fail("missing `app` declaration");

  for (const declaration of declarations.filter((item) => item.kind === "field")) {
    const [resourceId, fieldId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`field owner \`${resourceId}\` is not a resource`, declaration);
    const type = requireProperty(declaration, "type");
    if (!FIELD_TYPES.has(type)) fail(`unknown field type \`${type}\``, declaration);
    const startProp = stringProperty(declaration, "start", null);
    const endProp = stringProperty(declaration, "end", null);
    const policy = stringProperty(declaration, "policy", "[start,end)");
    const computedProp = stringProperty(declaration, "computed", null);
    const unitProp = stringProperty(declaration, "unit", null);
    const rateProp = stringProperty(declaration, "rate", null);
    const field = {
      id: fieldId, address: declaration.id, type,
      label: stringProperty(declaration, "label", titleCase(fieldId)),
      required: booleanProperty(declaration, "required"),
      unique: booleanProperty(declaration, "unique"),
      values: listProperty(declaration, "values"), options: [],
      ref: stringProperty(declaration, "ref", null),
      default: stringProperty(declaration, "default", null),
      min: integerProperty(declaration, "min", null, null),
      max: integerProperty(declaration, "max", null, null),
      placeholder: stringProperty(declaration, "placeholder", ""),
      long: booleanProperty(declaration, "long"),
      currency: stringProperty(declaration, "currency", null),
      start: startProp,
      end: endProp,
      policy,
      unit: unitProp,
      rate: rateProp
    };
    field.options = field.values;
    if (type === "enum" && !field.values.length) fail(`enum field \`${declaration.id}\` requires values`, declaration);
    if (type !== "enum" && field.values.length) fail("only enum fields accept values=...", declaration);
    if (type === "ref" && !field.ref) fail(`reference field \`${declaration.id}\` requires ref=resource`, declaration);
    if (type !== "ref" && field.ref) fail("only ref fields accept ref=...", declaration);
    if (field.ref && !model.entities.has(field.ref)) fail(`unknown referenced resource \`${field.ref}\``, declaration);
    if (type === "money" && !field.currency) fail(`money field \`${declaration.id}\` requires currency=...`, declaration);
    if (type === "rate") {
      if (!field.currency) fail(`rate field \`${declaration.id}\` requires currency=...`, declaration);
      if (!field.unit) fail(`rate field \`${declaration.id}\` requires unit=...`, declaration);
      if (!RATE_UNITS.has(field.unit)) fail(`rate field \`${declaration.id}\` unit must be one of s, m, h, d`, declaration);
    }
    if (field.currency && !/^[A-Z]{3}$/.test(field.currency)) fail("currency expects a three-letter uppercase ISO code", declaration);
    if (type !== "money" && type !== "rate" && field.currency) fail("only money and rate fields accept currency=...", declaration);
    if (type !== "rate" && type !== "duration" && field.unit && !computedProp) fail("only rate fields accept unit=...", declaration);
    if (field.long && type !== "text") fail("only text fields accept `long`", declaration);
    if (type === "interval") {
      if (!startProp || !endProp) fail(`interval field \`${declaration.id}\` requires start=... and end=...`, declaration);
      field.computed = { kind: "interval", start: startProp, end: endProp, policy };
    } else if (computedProp) {
      field.computed = parseComputedExpression(computedProp, declaration);
      if (unitProp && field.computed) {
        field.computed.unit = unitProp;
      }
    }
    insertUnique(resource.fieldMap, field.id, field, declaration);
    resource.fields.push(field);
  }

  for (const resource of model.entities.values()) {
    if (!resource.fields.length) fail(`resource \`${resource.id}\` has no fields`);
    for (const field of resource.fields) {
      if (field.type === "interval") {
        if (!resource.fieldMap.has(field.start)) fail(`interval \`${resource.id}.${field.id}\` references unknown start field \`${field.start}\``);
        if (!resource.fieldMap.has(field.end)) fail(`interval \`${resource.id}.${field.id}\` references unknown end field \`${field.end}\``);
      }
      if (field.computed) {
        if (field.computed.kind === "interval") {
          if (!resource.fieldMap.has(field.start)) fail(`interval \`${resource.id}.${field.id}\` references unknown start field \`${field.start}\``);
          if (!resource.fieldMap.has(field.end)) fail(`interval \`${resource.id}.${field.id}\` references unknown end field \`${field.end}\``);
        } else if (field.computed.kind === "interval_duration") {
          const intField = resource.fieldMap.get(field.computed.intervalField);
          if (!intField || intField.type !== "interval") {
            fail(`computed interval \`${field.address}\` references unknown interval \`${field.computed.intervalField}\``);
          }
        } else if (field.computed.ast) {
          const rootType = typeCheckComputedExpression(field.computed.ast, resource, model, field);
          if (field.type === "money") {
            if (rootType.type !== "money") {
              fail(`computed money field \`${field.address}\` expression evaluated to \`${rootType.type}\`, expected \`money\``, null, {
                code: "AIR_TYPE_COMPUTED_MISMATCH", phase: "type"
              });
            }
            if (field.currency && rootType.currency && field.currency !== rootType.currency) {
              fail(`computed money field \`${field.address}\` currency \`${field.currency}\` does not match ${rootType.rateUnit ? "rate " : "expression "}currency \`${rootType.currency}\``, null, {
                code: "AIR_TYPE_COMPUTED_MISMATCH", phase: "type"
              });
            }
          } else if (field.type !== rootType.type) {
            fail(`computed field \`${field.address}\` of type \`${field.type}\` expression evaluated to \`${rootType.type}\``, null, {
              code: "AIR_TYPE_COMPUTED_MISMATCH", phase: "type"
            });
          }
        }
      }
    }
    resource.labelField ??= resource.fields.find((field) => field.type === "text" && !field.long)?.id
      ?? resource.fields.find((field) => field.type === "email")?.id ?? resource.fields[0].id;
    if (!resource.fieldMap.has(resource.labelField)) fail(`resource \`${resource.id}\` has unknown label field \`${resource.labelField}\``);
  }

  for (const declaration of declarations.filter((item) => item.kind === "actor")) {
    if (!model.entities.has(declaration.id)) fail(`actor target \`${declaration.id}\` is not a resource`, declaration);
    if (model.actors.has(declaration.id)) fail(`duplicate actor resource \`${declaration.id}\``, declaration);
    model.actors.add(declaration.id);
  }

  for (const declaration of declarations.filter((item) => item.kind === "parameter")) {
    const [resourceId, parameterId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`parameter owner \`${resourceId}\` is not a resource`, declaration);
    const raw = requireProperty(declaration, "value");
    const parameter = {
      id: parameterId, address: declaration.id, resource: resourceId,
      value: parseValue(raw), source: raw,
      label: stringProperty(declaration, "label", titleCase(parameterId))
    };
    const parameters = model.parameters.get(resourceId) ?? new Map();
    insertUnique(parameters, parameterId, parameter, declaration);
    model.parameters.set(resourceId, parameters);
  }

  for (const declaration of declarations.filter((item) => item.kind === "manage")) {
    const resource = model.entities.get(declaration.id);
    if (!resource) fail(`manage target \`${declaration.id}\` is not a resource`, declaration);
    const lifecycle = stringProperty(declaration, "lifecycle", "delete");
    if (lifecycle !== "delete" && lifecycle !== "archive") fail("manage lifecycle expects delete or archive", declaration);
    const management = {
      resource: resource.id,
      create: permissionProperty(declaration, "create"),
      edit: permissionProperty(declaration, "edit"),
      delete: permissionProperty(declaration, "delete"),
      lifecycle,
      pageSize: integerProperty(declaration, "page_size", null, 1)
    };
    insertUnique(model.management, resource.id, management, declaration);
    resource.management = management;
  }
  if (!model.management.size) fail("application has no managed resources");

  for (const [resourceId, management] of model.management) {
    model.access.set(resourceId, {
      view: { source: "true", terms: [{ kind: "any" }] },
      create: policyFromManagement(management.create),
      edit: policyFromManagement(management.edit),
      delete: policyFromManagement(management.delete),
      archive: policyFromManagement(management.delete)
    });
  }
  for (const declaration of declarations.filter((item) => item.kind === "access")) {
    const resource = model.entities.get(declaration.id);
    if (!resource || !model.management.has(resource.id)) fail(`access target \`${declaration.id}\` is not a managed resource`, declaration);
    const policies = model.access.get(resource.id);
    for (const [action, raw] of Object.entries(declaration.props)) {
      policies[action] = parseAccessPolicy(raw, declaration, resource, model.actors, model.entities);
    }
  }

  for (const declaration of declarations.filter((item) => item.kind === "highlight")) {
    const [resourceId, highlightId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`highlight owner \`${resourceId}\` is not a resource`, declaration);
    const tone = stringProperty(declaration, "tone", "accent");
    if (!new Set(["accent", "positive", "warning", "danger", "neutral"]).has(tone)) fail(`unknown highlight tone \`${tone}\``, declaration);
    const highlight = {
      id: highlightId,
      address: declaration.id,
      when: parseCondition(requireProperty(declaration, "when"), declaration, resource, model, "highlight when"),
      tone
    };
    const values = model.highlights.get(resourceId) ?? [];
    if (values.some((item) => item.id === highlightId)) fail(`duplicate highlight ID \`${declaration.id}\``, declaration);
    values.push(highlight);
    model.highlights.set(resourceId, values);
  }

  for (const declaration of declarations.filter((item) => item.kind === "rule")) {
    const [resourceId, ruleId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`rule owner \`${resourceId}\` is not a resource`, declaration);
    const fieldId = requireProperty(declaration, "field");
    const sinceId = requireProperty(declaration, "since");
    const field = resource.fieldMap.get(fieldId);
    const since = resource.fieldMap.get(sinceId);
    if (!field) fail(`rule references unknown field \`${resourceId}.${fieldId}\``, declaration);
    if (!since || since.type !== "date") fail(`rule since must reference a date field on \`${resourceId}\``, declaration);
    const from = requireProperty(declaration, "from");
    const to = requireProperty(declaration, "to");
    if (field.type === "enum" && !field.values.includes(from)) fail(`rule from value \`${from}\` is outside ${field.address}`, declaration);
    if (field.type === "enum" && !field.values.includes(to)) field.values.push(to);
    const duration = parseDuration(requireProperty(declaration, "after"), declaration);
    if (model.rules.some((rule) => rule.address === declaration.id)) fail(`duplicate rule ID \`${declaration.id}\``, declaration);
    model.rules.push({ id: ruleId, address: declaration.id, resource: resourceId, field: fieldId, from, to, since: sinceId, duration });
  }

  const isEntityComputedInsight = (decl) => decl.props.source != null && !decl.props.source.startsWith("events.") && decl.props.group != null && splitOwnedId(decl)[0] !== decl.props.source;

  for (const declaration of declarations.filter((item) => item.kind === "insight" && isEntityComputedInsight(item))) {
    const [ownerId, insightId] = splitOwnedId(declaration);
    const owner = model.entities.get(ownerId);
    if (!owner) fail(`insight owner \`${ownerId}\` is not a resource`, declaration);
    if (owner.fieldMap.has(insightId)) fail(`insight conflicts with field \`${declaration.id}\``, declaration);
    const sourceId = requireProperty(declaration, "source");
    const source = model.entities.get(sourceId);
    if (!source) fail(`insight source \`${sourceId}\` is not a resource`, declaration);
    const groupId = requireProperty(declaration, "group");
    const group = source.fieldMap.get(groupId);
    if (!group || group.type !== "ref" || group.ref !== ownerId) {
      fail(`insight group must be a ${sourceId} reference to ${ownerId}`, declaration);
    }
    const op = stringProperty(declaration, "op", "count");
    if (!new Set(["count", "sum", "average", "avg", "min", "max"]).has(op)) fail(`unsupported grouped insight operation \`${op}\``, declaration);
    const aggregateFieldId = stringProperty(declaration, "field", null);
    const aggregateField = aggregateFieldId ? source.fieldMap.get(aggregateFieldId) : null;
    const isDurationField = aggregateField?.type === "duration" || aggregateFieldId?.endsWith(".duration") || aggregateField?.type === "interval";
    if (op !== "count" && (!aggregateField || (!NUMERIC_TYPES.has(aggregateField.type) && !isDurationField))) {
      fail(`${op} grouped insight requires a numeric, duration, or interval field on ${sourceId}`, declaration);
    }
    const whereRaw = stringProperty(declaration, "where", null);
    const where = whereRaw ? parseCondition(whereRaw, declaration, source, model, "insight where") : null;
    const window = stringProperty(declaration, "window", null);
    const dateId = stringProperty(declaration, "date", null);
    if (window && window !== "month") fail("insight window currently supports only month", declaration);
    if (window && (!dateId || source.fieldMap.get(dateId)?.type !== "date")) fail("windowed insight requires date=<date-field>", declaration);
    if (!window && dateId) fail("insight date requires window=month", declaration);
    const fieldType = isDurationField ? "duration" : aggregateField?.type === "money" ? "money" : "number";
    const field = {
      id: insightId, address: declaration.id,
      type: fieldType,
      label: stringProperty(declaration, "label", titleCase(insightId)),
      required: false, unique: false, values: [], options: [], ref: null,
      default: null, min: 0, placeholder: "", long: false,
      currency: aggregateField?.currency ?? null,
      computed: { kind: "aggregate", op, source: sourceId, group: groupId, field: aggregateFieldId, where, window, date: dateId },
      readOnly: true
    };
    owner.fieldMap.set(field.id, field);
    owner.fields.push(field);
  }

  for (const declaration of declarations.filter((item) => item.kind === "process")) {
    const resource = model.entities.get(declaration.id);
    if (!resource) fail(`process target \`${declaration.id}\` is not a resource`, declaration);
    const stateId = requireProperty(declaration, "state");
    const state = resource.fieldMap.get(stateId);
    if (!state || state.type !== "enum") fail(`process state must reference an enum field on \`${resource.id}\``, declaration);
    const initial = requireProperty(declaration, "initial");
    if (!state.values.includes(initial)) fail(`process initial state \`${initial}\` is outside ${state.address}`, declaration);
    const terminal = new Set(listProperty(declaration, "terminal"));
    for (const value of terminal) if (!state.values.includes(value)) fail(`process terminal state \`${value}\` is outside ${state.address}`, declaration);
    const touch = stringProperty(declaration, "touch", null);
    if (touch && resource.fieldMap.get(touch)?.type !== "date") fail("process touch must reference a date field", declaration);
    state.default ??= initial;
    const process = {
      resource: resource.id, state: stateId, initial, states: [...state.values], terminal,
      history: booleanProperty(declaration, "history"), touch,
      transitions: [], transitionMap: new Map(), invariants: [], deadlines: []
    };
    insertUnique(model.processes, resource.id, process, declaration);
  }

  for (const declaration of declarations.filter((item) => item.kind === "transition")) {
    const [resourceId, transitionId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    const process = model.processes.get(resourceId);
    if (!resource || !process) fail(`transition owner \`${resourceId}\` has no process`, declaration);
    const from = listProperty(declaration, "from");
    if (!from.length) fail("transition requires from=state[,state]", declaration);
    const to = requireProperty(declaration, "to");
    for (const state of [...from, to]) if (!process.states.includes(state)) fail(`transition references nonexistent state \`${state}\``, declaration);
    const automatic = booleanProperty(declaration, "automatic");
    const action = stringProperty(declaration, "action", automatic ? transitionId : null);
    if (!automatic && !action) fail("requested transition requires action=...", declaration);
    const byRaw = stringProperty(declaration, "by", automatic ? "system" : null);
    if (!byRaw) fail("requested transition requires by=...", declaration);
    const by = parseTransitionPolicy(byRaw, declaration, resource, model);
    if (automatic && by.source !== "system") fail("automatic transition authority must be system", declaration);
    if (!automatic && by.source === "system") fail("requested transition cannot use system authority", declaration);
    const approvals = integerProperty(declaration, "approvals", 1, 1);
    const distinct = booleanProperty(declaration, "distinct");
    if (distinct && approvals < 2) fail("distinct approval requires approvals >= 2", declaration);
    if (automatic && (approvals !== 1 || distinct)) fail("automatic transition cannot accumulate approvals", declaration);
    const comment = stringProperty(declaration, "comment", "none");
    if (!new Set(["none", "optional", "required"]).has(comment)) fail("transition comment expects none, optional, or required", declaration);
    const separate = listProperty(declaration, "separate").map((path) => parseReferencePath(path, declaration, resource, model.actors, model.entities, "separation path"));
    for (const term of by.terms.filter((candidate) => candidate.kind === "owner")) {
      if (separate.some((path) => path.source === term.field)) fail(`transition authority and separation both require \`${term.field}\`; no actor can satisfy it`, declaration);
    }
    const withinRaw = stringProperty(declaration, "within", null);
    const since = stringProperty(declaration, "since", null);
    if (withinRaw && (!since || !since.startsWith("event:") || since.length === 6)) fail("transition within requires since=event:<name>", declaration);
    if (!withinRaw && since) fail("transition since requires within=...", declaration);
    const transition = {
      id: transitionId, address: declaration.id, resource: resourceId,
      from, to, action, by, automatic,
      when: parseCondition(stringProperty(declaration, "when", "true"), declaration, resource, model, "transition when"),
      comment, approvals, distinct, separate,
      event: stringProperty(declaration, "event", transitionId),
      within: withinRaw ? parseReviewDuration(withinRaw, declaration, "transition within") : null,
      since, unlessEvents: listProperty(declaration, "unless_event")
    };
    insertUnique(process.transitionMap, transitionId, transition, declaration);
    insertUnique(model.transitions, declaration.id, transition, declaration);
    process.transitions.push(transition);
  }

  for (const declaration of declarations.filter((item) => item.kind === "unique")) {
    const [resourceId, constraintId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`unique owner \`${resourceId}\` is not a resource`, declaration);
    const fields = listProperty(declaration, "fields");
    if (!fields.length) fail("unique declaration requires fields=field1,field2,...", declaration);
    for (const f of fields) {
      const field = resource.fieldMap.get(f);
      if (!field || field.computed) fail(`unique declaration references unknown or computed field \`${resourceId}.${f}\``, declaration);
    }
    const whereRaw = stringProperty(declaration, "where", null);
    const whenRaw = stringProperty(declaration, "when", null);
    const denyMessage = stringProperty(declaration, "deny", `Composite uniqueness violation on ${resource.singular || resourceId} (${fields.join(", ")})`);
    const constraint = {
      id: constraintId,
      address: declaration.id,
      resource: resourceId,
      fields,
      where: whereRaw ? parseCondition(whereRaw, declaration, resource, model, "unique where") : null,
      when: whenRaw ? parseCondition(whenRaw, declaration, resource, model, "unique when") : null,
      deny: denyMessage
    };
    const list = model.uniqueConstraints.get(resourceId) ?? [];
    if (list.some((item) => item.id === constraintId)) fail(`duplicate unique constraint ID \`${declaration.id}\``, declaration);
    list.push(constraint);
    model.uniqueConstraints.set(resourceId, list);
  }

  for (const declaration of declarations.filter((item) => item.kind === "invariant")) {
    const [resourceId, invariantId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`invariant owner \`${resourceId}\` is not a resource`, declaration);
    const required = listProperty(declaration, "require");
    const immutable = listProperty(declaration, "immutable");
    const uniqueFields = listProperty(declaration, "unique").concat(listProperty(declaration, "fields"));
    const noneTarget = stringProperty(declaration, "none", null);
    const existsTarget = stringProperty(declaration, "exists", null);
    const scopeField = stringProperty(declaration, "scope", null);
    const overlapsField = stringProperty(declaration, "overlaps", null);
    const denyMessage = stringProperty(declaration, "deny", null);
    const whereRaw = stringProperty(declaration, "where", null);
    const whenRaw = stringProperty(declaration, "when", null);

    if (uniqueFields.length > 0) {
      for (const f of uniqueFields) {
        const field = resource.fieldMap.get(f);
        if (!field || field.computed) fail(`invariant unique references unknown or computed field \`${resourceId}.${f}\``, declaration);
      }
      const constraint = {
        id: invariantId,
        address: declaration.id,
        resource: resourceId,
        fields: uniqueFields,
        where: whereRaw ? parseCondition(whereRaw, declaration, resource, model, "unique where") : null,
        when: whenRaw ? parseCondition(whenRaw, declaration, resource, model, "unique when") : null,
        deny: denyMessage || `Composite uniqueness violation on ${resource.singular || resourceId} (${uniqueFields.join(", ")})`
      };
      const list = model.uniqueConstraints.get(resourceId) ?? [];
      list.push(constraint);
      model.uniqueConstraints.set(resourceId, list);
    }

    if (!required.length && !immutable.length && !noneTarget && !existsTarget && !denyMessage && !uniqueFields.length) {
      fail("invariant requires require=..., immutable=..., unique=..., none=..., exists=..., or deny=...", declaration);
    }
    if (noneTarget && !model.entities.has(noneTarget)) fail(`unknown referenced resource \`${noneTarget}\``, declaration);
    if (existsTarget && !model.entities.has(existsTarget)) fail(`unknown referenced resource \`${existsTarget}\``, declaration);

    const targetResource = noneTarget ? model.entities.get(noneTarget) : resource;

    for (const fieldId of [...required, ...immutable.filter((fieldId) => fieldId !== "*")]) {
      const field = resource.fieldMap.get(fieldId);
      if (!field || field.computed) fail(`invariant references unknown stored field \`${resourceId}.${fieldId}\``, declaration);
    }
    const invariant = {
      id: invariantId, address: declaration.id, resource: resourceId,
      when: whenRaw ? parseCondition(whenRaw, declaration, resource, model, "invariant when") : null,
      required, immutable,
      none: noneTarget,
      exists: existsTarget,
      scope: scopeField,
      overlaps: overlapsField,
      where: whereRaw ? parseCondition(whereRaw, declaration, targetResource, model, "invariant where") : null,
      deny: denyMessage
    };
    const values = model.invariants.get(resourceId) ?? [];
    if (values.some((item) => item.id === invariantId)) fail(`duplicate invariant ID \`${declaration.id}\``, declaration);
    values.push(invariant);
    model.invariants.set(resourceId, values);
    model.processes.get(resourceId)?.invariants.push(invariant);
  }

  for (const declaration of declarations.filter((item) => item.kind === "deadline")) {
    const [resourceId, deadlineId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    const process = model.processes.get(resourceId);
    if (!resource || !process) fail(`deadline owner \`${resourceId}\` has no process`, declaration);
    const state = requireProperty(declaration, "state");
    if (!process.states.includes(state)) fail(`deadline references nonexistent state \`${state}\``, declaration);
    const escalation = stringProperty(declaration, "escalation", "none");
    if (!new Set(["none", "required"]).has(escalation)) fail("deadline escalation expects none or required", declaration);
    const deadline = {
      id: deadlineId, address: declaration.id, resource: resourceId, state,
      duration: parseReviewDuration(requireProperty(declaration, "after"), declaration, "deadline after"), escalation
    };
    const values = model.deadlines.get(resourceId) ?? [];
    if (values.some((item) => item.id === deadlineId)) fail(`duplicate deadline ID \`${declaration.id}\``, declaration);
    values.push(deadline);
    model.deadlines.set(resourceId, values);
    process.deadlines.push(deadline);
  }

  for (const process of model.processes.values()) {
    const transitionSignatures = new Map();
    for (const transition of process.transitions) {
      const signature = JSON.stringify({
        from: [...transition.from].sort(), to: transition.to, action: transition.action,
        by: transition.by.source, automatic: transition.automatic, when: transition.when.source,
        comment: transition.comment, approvals: transition.approvals, distinct: transition.distinct,
        separate: transition.separate.map((item) => item.source).sort(),
        within: transition.within?.source ?? null, since: transition.since,
        unlessEvents: [...transition.unlessEvents].sort()
      });
      const previous = transitionSignatures.get(signature);
      if (previous) fail(`duplicate transition semantics \`${previous.address}\` and \`${transition.address}\``);
      transitionSignatures.set(signature, transition);
    }
    for (const transition of process.transitions) {
      if (transition.from.some((state) => process.terminal.has(state))) fail(`terminal process state cannot have outgoing transition \`${transition.address}\``);
    }
    const reachable = new Set([process.initial]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const transition of process.transitions) {
        if (transition.from.some((state) => reachable.has(state)) && !reachable.has(transition.to)) {
          reachable.add(transition.to);
          changed = true;
        }
      }
    }
    const unreachable = process.states.filter((state) => !reachable.has(state));
    if (unreachable.length) fail(`process \`${process.resource}\` has unreachable states: ${unreachable.join(", ")}`);
    const automaticEdges = new Map(process.states.map((state) => [state, []]));
    for (const transition of process.transitions.filter((item) => item.automatic && item.when.source === "true")) {
      for (const from of transition.from) automaticEdges.get(from).push(transition.to);
    }
    const visiting = new Set();
    const visited = new Set();
    const hasAutomaticCycle = (state) => {
      if (visiting.has(state)) return true;
      if (visited.has(state)) return false;
      visiting.add(state);
      if (automaticEdges.get(state).some(hasAutomaticCycle)) return true;
      visiting.delete(state);
      visited.add(state);
      return false;
    };
    if (process.states.some(hasAutomaticCycle)) {
      fail(`process \`${process.resource}\` has an unconditional automatic transition cycle`, null, {
        code: "AIR_PROCESS_STATIC_AUTO_CYCLE", phase: "process", path: `process.${process.resource}`
      });
    }
    const deadEnds = process.states.filter((state) => !process.terminal.has(state) && !process.transitions.some((transition) => transition.from.includes(state)));
    if (deadEnds.length) fail(`process \`${process.resource}\` has non-terminal states without exits: ${deadEnds.join(", ")}`);
    if (process.deadlines.length) {
      const resource = model.entities.get(process.resource);
      if (resource.fieldMap.has("workflow_status")) fail(`process \`${process.resource}\` cannot infer workflow_status because the field exists`);
      const field = {
        id: "workflow_status", address: `inferred.${process.resource}.workflow_status`, type: "enum",
        label: "Workflow Status", required: false, unique: false,
        values: ["OnTime", "Overdue", "EscalationRequired"], options: ["OnTime", "Overdue", "EscalationRequired"],
        ref: null, default: null, min: 0, placeholder: "", long: false, currency: null,
        computed: { kind: "workflow" }, readOnly: true
      };
      resource.fieldMap.set(field.id, field);
      resource.fields.push(field);
    }
  }

  const managed = [...model.management.keys()].map((id) => model.entities.get(id));
  const overviewDeclaration = declarations.find((item) => item.kind === "overview");
  if (overviewDeclaration) {
    const page = overviewPage(overviewDeclaration, managed);
    model.pages.push(page);
    model.pageMap.set(page.id, page);
  }
  for (const resource of managed) {
    const page = collectionPage(resource, model.theme.density);
    model.pages.push(page);
    model.pageMap.set(page.id, page);
  }

  for (const declaration of declarations.filter((item) => item.kind === "insight" && !isEntityComputedInsight(item))) {
    if (!overviewDeclaration) fail("insight requires an `overview` declaration", declaration);
    const [resourceId, insightId] = splitOwnedId(declaration);
    let resource = model.entities.get(resourceId);
    let source = resource;
    const sourceProp = declaration.props.source;
    if (sourceProp) {
      if (sourceProp.startsWith("events.")) {
        const targetRes = sourceProp.slice(7);
        source = model.entities.get(targetRes);
        if (!source) fail(`insight source \`${sourceProp}\` references unknown resource \`${targetRes}\``, declaration);
      } else {
        source = model.entities.get(sourceProp);
        if (!source) fail(`insight source \`${sourceProp}\` is not a resource`, declaration);
      }
    }
    if (!resource) fail(`insight owner \`${resourceId}\` is not a resource`, declaration);
    const op = stringProperty(declaration, "op", "sum");
    if (!new Set(["count", "sum", "average", "avg", "min", "max", "utilization"]).has(op)) fail(`unsupported insight operation \`${op}\``, declaration);
    const fieldId = stringProperty(declaration, "field", null);
    const field = fieldId ? source.fieldMap.get(fieldId) : null;
    const isPathDuration = fieldId?.endsWith(".duration");
    const baseField = isPathDuration ? source.fieldMap.get(fieldId.slice(0, -9)) : field;
    const isDurationField = field?.type === "duration" || (isPathDuration && (baseField?.type === "interval" || !baseField)) || field?.type === "interval";
    const fromVal = stringProperty(declaration, "from", null);
    const toVal = stringProperty(declaration, "to", null);
    const isEventDurationCorrelation = sourceProp?.startsWith("events.") && fromVal && toVal;

    if (fieldId && !field && !isPathDuration) fail(`insight references unknown field \`${sourceProp ?? resourceId}.${fieldId}\``, declaration);
    if (op !== "count" && op !== "utilization" && !isEventDurationCorrelation) {
      if (!field && !isPathDuration) {
        fail(`${op} insight requires a number, money, duration, or interval field`, declaration);
      }
      if (field && !NUMERIC_TYPES.has(field.type) && !isDurationField) {
        fail(`${op} insight requires a number, money, duration, or interval field`, declaration);
      }
    }
    const groupId = stringProperty(declaration, "group", null);
    const group = groupId ? source.fieldMap.get(groupId) : null;
    if (groupId && (!group || !new Set(["enum", "ref", "bool", "text"]).has(group.type))) fail("overview insight group requires an enum, ref, bool, or text field", declaration);
    const whereRaw = stringProperty(declaration, "where", null);
    const windowVal = stringProperty(declaration, "window", null);
    const overlapsVal = stringProperty(declaration, "overlaps", null);
    const explicitFormat = stringProperty(declaration, "format", null);

    const defaultFormat = groupId ? "breakdown" :
                          op === "utilization" ? "percentage" :
                          isEventDurationCorrelation || isDurationField ? "duration" :
                          field?.type === "money" ? "money" : "number";

    const page = model.pageMap.get("overview");
    page.metrics.push({
      id: insightId, address: declaration.id, source: sourceProp ?? resourceId, op, field: fieldId,
      from: fromVal, to: toVal, window: windowVal, overlaps: overlapsVal,
      label: stringProperty(declaration, "label", field ? `${titleCase(op)} ${field.label.toLowerCase()}` : `${titleCase(op)} ${resource.plural.toLowerCase()}`),
      where: whereRaw ? parseCondition(whereRaw, declaration, source, model, "insight where") : null,
      group: groupId, tone: stringProperty(declaration, "tone", toneAt(page.metrics.length)),
      format: explicitFormat ?? defaultFormat, inferred: false
    });
  }

  model.app.initial ??= model.pages[0]?.id;
  if (!model.app.initial || !model.pageMap.has(model.app.initial)) fail(`app initial page \`${model.app.initial}\` does not exist`);

  const allowExtensions = new Set(options.extensions ?? []);
  for (const declaration of declarations.filter((item) => item.kind === "extension")) {
    const module = requireProperty(declaration, "module");
    const capability = `extension.load.${declaration.id}`;
    if (!model.capabilities.has(capability)) fail(`extension \`${declaration.id}\` requires capability \`${capability}\``, declaration);
    if (!allowExtensions.has(module)) fail(`extension module \`${module}\` is not allowed by this host`, declaration);
    model.extensions.push({ id: declaration.id, module, slot: stringProperty(declaration, "slot", "page") });
  }

  for (const declaration of declarations.filter((item) => item.kind === "notify")) {
    let resourceId, ruleId;
    if (declaration.id.includes(".")) {
      [resourceId, ruleId] = splitOwnedId(declaration);
    } else {
      ruleId = declaration.id;
      resourceId = stringProperty(declaration, "resource", null) ?? stringProperty(declaration, "target", null);
      if (!resourceId) {
        fail(`notify declaration \`${declaration.id}\` requires a target resource (e.g. \`notify resource.rule_id\`)`, declaration);
      }
    }
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`notify target \`${resourceId}\` is not a resource`, declaration);

    const onRaw = stringProperty(declaration, "on", null);
    const whenRaw = stringProperty(declaration, "when", null);
    if (!onRaw && !whenRaw) {
      fail(`notify \`${declaration.id}\` requires \`on=...\` (event) or \`when="..."\` (condition)`, declaration);
    }

    let when = null;
    if (whenRaw) {
      when = parseCondition(whenRaw, declaration, resource, model, "notify when");
    }

    const audienceRaw = stringProperty(declaration, "audience", "any");
    const audience = parseAudienceSpec(audienceRaw, declaration, resource, model);

    const tone = stringProperty(declaration, "tone", "info");
    if (!new Set(["info", "success", "warning", "danger", "neutral"]).has(tone)) {
      fail(`unknown notification tone \`${tone}\``, declaration);
    }

    const label = stringProperty(declaration, "label", titleCase(ruleId));
    const title = stringProperty(declaration, "title", null);
    const body = stringProperty(declaration, "body", null);
    const action = stringProperty(declaration, "action", "detail");

    const rule = {
      id: declaration.id,
      address: declaration.id,
      ruleId,
      resource: resourceId,
      on: onRaw ? normalizeEventPattern(onRaw) : null,
      onRaw,
      when,
      whenRaw,
      audience,
      audienceRaw,
      tone,
      label,
      title,
      body,
      action
    };

    model.notifications.push(rule);
  }

  return model;
}

function normalizeEventPattern(onRaw) {
  if (!onRaw) return null;
  const raw = String(onRaw).trim();
  if (raw.startsWith("events.")) {
    const parts = raw.slice(7).split(".");
    return parts.at(-1);
  }
  if (raw.startsWith("transition.")) {
    return `action:${raw.slice(11)}`;
  }
  if (raw.startsWith("action.")) {
    return `action:${raw.slice(7)}`;
  }
  if (raw.startsWith("state.") || raw.startsWith("to.")) {
    return `to:${raw.split(".").at(-1)}`;
  }
  if (raw === "create" || raw === "resource_created") return "created";
  if (raw === "update" || raw === "mutation" || raw === "edit") return "updated";
  return raw;
}

function parseAudienceSpec(raw, declaration, resource, model) {
  if (!raw || raw === "any" || raw === "all" || raw === "*") {
    return { kind: "any", raw: "any" };
  }
  if (raw === "owner") {
    return { kind: "owner", raw: "owner" };
  }
  if (raw.startsWith("role:")) {
    const roleStr = raw.slice(5);
    const roles = roleStr.split("|").map((s) => s.trim().replace(/^role:/, ""));
    return { kind: "role", role: roles.length === 1 ? roles[0] : roles, roles, raw };
  }
  if (raw.startsWith("path:")) {
    const path = raw.slice(5).trim();
    return { kind: "path", path, raw };
  }
  if (raw.includes("|")) {
    const parts = raw.split("|").map((s) => s.trim());
    return { kind: "multi", parts: parts.map((p) => parseAudienceSpec(p, declaration, resource, model)), raw };
  }
  return { kind: "role", role: raw, roles: [raw], raw };
}

function audienceMatches(audience, principal, record, resourceId, runtime) {
  if (!audience || audience.kind === "any") return true;
  const principalRoles = new Set([
    ...(principal?.roles ?? []),
    ...(principal?.role ? [principal.role] : [])
  ]);

  if (audience.kind === "role") {
    if (Array.isArray(audience.roles)) {
      return audience.roles.some((r) => principalRoles.has(r));
    }
    return principalRoles.has(audience.role);
  }
  if (audience.kind === "owner") {
    if (!record || !principal) return false;
    const actorId = principal.id;
    if (!actorId) return false;
    if (record.id === actorId || record.owner === actorId || record.user === actorId || record.created_by === actorId) return true;
    return false;
  }
  if (audience.kind === "path") {
    if (!record || !principal) return false;
    let target = null;
    if (typeof audience.path === "string") {
      const parts = audience.path.split(".");
      let current = record;
      for (let i = 0; i < parts.length; i++) {
        if (!current) { target = null; break; }
        const field = parts[i];
        if (i === parts.length - 1) {
          target = current[field];
        } else {
          const refVal = current[field];
          if (!refVal) { target = null; break; }
          let found = null;
          for (const ent of runtime.model.entities.values()) {
            const candidate = runtime.records(ent.id).find((c) => c.id === refVal);
            if (candidate) {
              found = candidate;
              break;
            }
          }
          current = found;
        }
      }
    } else if (Array.isArray(audience.path)) {
      target = runtime.resolveReferencePath(record, audience.path);
    }
    return Boolean(principal.id && target === principal.id);
  }
  if (audience.kind === "multi") {
    return audience.parts.some((part) => audienceMatches(part, principal, record, resourceId, runtime));
  }
  return false;
}

function formatNotificationContent(template, defaultFallback, resourceId, record, runtime) {
  if (!template) return defaultFallback;
  return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, fieldPath) => {
    if (fieldPath.includes(".")) {
      const parts = fieldPath.split(".");
      let cur = record;
      let curRes = resourceId;
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        if (!cur) return "";
        const f = runtime.model.entities.get(curRes)?.fieldMap.get(seg);
        if (i === parts.length - 1) {
          const val = cur[seg];
          return val != null ? runtime.displayValue(curRes, seg, val) : "";
        }
        if (f?.type === "ref" && cur[seg]) {
          cur = runtime.records(f.ref).find((c) => c.id === cur[seg]);
          curRes = f.ref;
        } else {
          cur = cur[seg];
        }
      }
      return "";
    }
    const val = record[fieldPath];
    if (val === undefined || val === null) return "";
    return runtime.displayValue(resourceId, fieldPath, val);
  });
}

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function validateScalar(field, value, model, records = null, currentId = null) {
  if (field.required && isBlank(value)) return `${field.label} is required`;
  if (isBlank(value)) return null;
  const text = String(value);
  if (field.type === "text" && text.length < field.min) return `${field.label} must be at least ${field.min} characters`;
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `Enter a valid ${field.label.toLowerCase()}`;
  if (field.type === "enum" && !field.values.includes(text)) return `${field.label} must be one of ${field.values.join(", ")}`;
  if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${field.label} must be a date`;
  if (field.type === "integer") {
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) return `${field.label} must be a valid safe integer`;
    } else if (typeof value === "string") {
      if (!/^-?\d+$/.test(text.trim())) return `${field.label} must be an integer`;
      const num = Number(text.trim());
      if (!Number.isSafeInteger(num)) return `${field.label} is outside safe integer range`;
    } else {
      return `${field.label} must be an integer`;
    }
    const intVal = typeof value === "number" ? value : Number(text.trim());
    if (field.min != null && intVal < field.min) return `${field.label} must be at least ${field.min}`;
    if (field.max != null && intVal > field.max) return `${field.label} cannot be greater than ${field.max}`;
    return null;
  }
  if (field.type === "ratio") {
    const r = parseRatioOrPercentLiteral(value);
    if (!r) return `${field.label} must be a valid ratio or percentage (e.g. 10%)`;
    return null;
  }
  if (NUMERIC_TYPES.has(field.type) && !Number.isFinite(Number(value))) return `${field.label} must be a number`;
  if (field.type === "duration" && !parseDurationLiteral(value) && typeof value !== "number" && !(value instanceof Duration)) return `${field.label} must be a duration`;
  if (field.type === "bool" && typeof value !== "boolean") return `${field.label} must be true or false`;
  if (field.type === "ref" && !model.entities.has(field.ref)) return `${field.label} references an unknown resource`;
  if (field.unique && records?.some((record) => record.id !== currentId && String(record[field.id] ?? "").toLowerCase() === text.toLowerCase())) return `${field.label} must be unique`;
  return null;
}

function normalizeInput(field, value, clock) {
  if (value == null || value === "") {
    if (field.default === "today") return clock().toISOString().slice(0, 10);
    if (field.default != null) {
      if (field.type === "integer") return Number(field.default);
      if (field.type === "ratio") return parseRatioOrPercentLiteral(field.default) ?? field.default;
      if (NUMERIC_TYPES.has(field.type)) return Number(field.default);
      if (field.type === "bool") return field.default === "true";
      if (field.type === "duration") return parseDurationLiteral(field.default) ?? field.default;
      return field.default;
    }
    return field.type === "bool" ? false : "";
  }
  if (field.type === "integer") {
    if (typeof value === "number") return value;
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
    return value;
  }
  if (field.type === "ratio") {
    return parseRatioOrPercentLiteral(value) ?? value;
  }
  if (NUMERIC_TYPES.has(field.type)) return Number(value);
  if (field.type === "bool") return value === true || value === "true";
  if (field.type === "duration") return parseDurationLiteral(value) ?? value;
  return typeof value === "string" ? value.trim() : value;
}

function normalizeRecord(resource, raw, clock, context) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AirError(`${context} must be an object`);
  if (typeof raw.id !== "string" || !raw.id) throw new AirError(`${context} requires a string ID`);
  const storedFields = resource.fields.filter((field) => !field.computed);
  const allowed = new Set(["id", "_archived_at", "_air_history", ...resource.fields.map((field) => field.id)]);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) throw new AirError(`${context} has unknown field \`${key}\``);
  const record = { id: raw.id };
  for (const field of storedFields) record[field.id] = normalizeInput(field, raw[field.id], clock);
  if (raw._archived_at) record._archived_at = raw._archived_at;
  if (raw._air_history != null) {
    if (!Array.isArray(raw._air_history)) {
      throw new AirError(`${context} has invalid workflow history`);
    }
    const normalizedHistory = raw._air_history.map((entry, hIndex) => {
      if (!entry || typeof entry !== "object") {
        throw new AirError(`${context} history[${hIndex}] must be an object`);
      }
      const event = entry.event ?? (entry.action ? (entry.action === "create" ? "created" : entry.action === "submit" ? "submitted" : entry.action === "approve" ? "approved" : entry.action === "reject" ? "rejected" : entry.action) : "transition");
      const at = entry.at ?? entry.timestamp ?? (typeof clock === "function" ? clock().toISOString() : new Date().toISOString());
      if (typeof event !== "string" || typeof at !== "string") {
        throw new AirError(`${context} history[${hIndex}] has invalid event or timestamp`);
      }
      return {
        ...entry,
        event,
        at
      };
    });
    record._air_history = normalizedHistory;
  }
  return record;
}

export function parseSeedData(source, model, options = {}) {
  let input;
  try { input = typeof source === "string" ? JSON.parse(source) : structuredClone(source ?? {}); }
  catch { throw new AirError("seed data is not valid JSON"); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AirError("seed data must be an object keyed by resource ID");
  const clock = options.clock ?? (() => new Date());
  for (const resourceId of Object.keys(input)) if (!model.entities.has(resourceId)) throw new AirError(`seed data references unknown resource \`${resourceId}\``);
  const result = new Map();
  for (const resource of model.entities.values()) {
    const rawRecords = input[resource.id] ?? [];
    if (!Array.isArray(rawRecords)) throw new AirError(`seed ${resource.id} must be an array`);
    const records = rawRecords.map((raw, index) => normalizeRecord(resource, raw, clock, `seed ${resource.id}[${index}]`));
    const ids = new Set();
    for (const record of records) {
      if (ids.has(record.id)) throw new AirError(`seed ${resource.id} has duplicate ID \`${record.id}\``);
      ids.add(record.id);
      for (const field of resource.fields.filter((candidate) => !candidate.computed)) {
        const error = validateScalar(field, record[field.id], model, records, record.id);
        if (error) throw new AirError(`seed ${resource.id}.${record.id}: ${error}`);
      }
    }
    result.set(resource.id, records);
  }
  for (const resource of model.entities.values()) {
    for (const record of result.get(resource.id)) {
      for (const field of resource.fields.filter((candidate) => candidate.type === "ref")) {
        if (record[field.id] && !result.get(field.ref).some((target) => target.id === record[field.id])) throw new AirError(`seed ${resource.id}.${record.id} has dangling reference ${field.ref}.${record[field.id]}`);
      }
    }
  }
  return result;
}

export class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

export class AppRuntime {
  constructor(model, options = {}) {
    this.model = model;
    this.clock = options.clock ?? (() => new Date());
    this.timezone = options.timezone ?? model.app?.timezone ?? "UTC";
    this.idFactory = options.idFactory ?? ((resourceId) => `${resourceId.slice(0, 3)}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`);
    this.storage = options.storage ?? new MemoryStorage();
    this.namespace = options.namespace ?? null;
    this.principal = options.principal ?? { roles: [] };
    this.dataAdapters = options.dataAdapters instanceof Map
      ? options.dataAdapters
      : (options.dataAdapter ? new Map([["*", options.dataAdapter]]) : new Map());
    this.capabilityEngine = options.capabilityEngine ?? null;
    this.seedData = options.seedData instanceof Map ? options.seedData : parseSeedData(options.seedData ?? {}, model, { clock: this.clock });
    this.data = new Map();
    this.subscribers = new Set();
    this.mutex = new AsyncMutex();
    this.notificationsData = [];
    this.conditionStates = new Map();
    this.load();
  }

  hasCrossRecordInvariants(resourceId) {
    const invariants = this.model.invariants.get(resourceId) ?? [];
    return invariants.some((inv) => inv.none || inv.exists || inv.overlaps || inv.scope);
  }

  assertAdapterAtomicCapability(resourceId) {
    if (this.hasCrossRecordInvariants(resourceId)) {
      const adapter = this.adapter(resourceId);
      if (adapter && typeof adapter.capabilities === "function") {
        const caps = adapter.capabilities();
        if (!caps.includes("atomic_mutation") && !caps.includes("serializable_constraints")) {
          throw new AirError(`Atomic constraint enforcement unavailable for resource \`${resourceId}\` with cross-record invariants`, null, {
            code: "AIR_ATOMIC_CONSTRAINT_UNAVAILABLE",
            phase: "execute",
            category: FAILURE_CATEGORIES.ATOMIC_CONSTRAINT_UNAVAILABLE
          });
        }
      }
    }
  }

  currentDate(tz = this.timezone) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(this.clock());
  }

  currentInstant() {
    return this.clock().toISOString();
  }

  subscribe(listener) {
    if (typeof listener === "function") {
      this.subscribers.add(listener);
      return () => this.subscribers.delete(listener);
    }
    return () => {};
  }

  emitChange(event = {}) {
    for (const listener of [...this.subscribers]) {
      try {
        listener({ runtime: this, timestamp: this.clock().toISOString(), ...event });
      } catch (err) {
        console.error("Error in runtime change listener:", err);
      }
    }
  }

  adapter(resourceId) {
    return this.dataAdapters.get(resourceId) ?? this.dataAdapters.get("*") ?? null;
  }

  key(resourceId) {
    const prefix = this.namespace ? `${this.namespace}:` : "";
    return `${prefix}air:${this.model.app?.id ?? "app"}:${resourceId}:v${this.model.version}`;
  }
  notificationKey() {
    const prefix = this.namespace ? `${this.namespace}:` : "";
    return `${prefix}air:${this.model.app?.id ?? "app"}:notifications:v${this.model.version}`;
  }
  conditionStatesKey() {
    const prefix = this.namespace ? `${this.namespace}:` : "";
    return `${prefix}air:${this.model.app?.id ?? "app"}:notification_conditions:v${this.model.version}`;
  }
  userNotificationStateKey(principalKey) {
    const prefix = this.namespace ? `${this.namespace}:` : "";
    return `${prefix}air:${this.model.app?.id ?? "app"}:notification_state:${principalKey}:v${this.model.version}`;
  }

  load() {
    for (const resource of this.model.entities.values()) {
      const raw = this.storage.getItem(this.key(resource.id));
      let records;
      if (raw == null) records = structuredClone(this.seedData.get(resource.id) ?? []);
      else {
        try { records = JSON.parse(raw); } catch { throw new AirError(`persisted ${resource.id} data is not valid JSON`); }
        if (!Array.isArray(records)) throw new AirError(`persisted ${resource.id} data must be an array`);
        records = records.map((record, index) => normalizeRecord(resource, record, this.clock, `persisted ${resource.id}[${index}]`));
      }
      const ids = new Set();
      for (const record of records) {
        if (ids.has(record.id)) throw new AirError(`persisted ${resource.id} data contains duplicate ID \`${record.id}\``);
        ids.add(record.id);
      }
      this.data.set(resource.id, records);
    }
    for (const resource of this.model.entities.values()) {
      const records = this.records(resource.id);
      for (const record of records) {
        const errors = this.validate(resource.id, record, record.id, records);
        if (Object.keys(errors).length) throw new AirError(`persisted ${resource.id}.${record.id} failed validation: ${Object.values(errors)[0]}`);
      }
    }

    // Load notifications
    const rawNotifs = this.storage.getItem(this.notificationKey());
    if (rawNotifs) {
      try { this.notificationsData = JSON.parse(rawNotifs); } catch { this.notificationsData = []; }
    } else {
      this.notificationsData = [];
    }

    // Load condition states
    const rawConds = this.storage.getItem(this.conditionStatesKey());
    if (rawConds) {
      try {
        const parsed = JSON.parse(rawConds);
        this.conditionStates = new Map(Object.entries(parsed));
      } catch {
        this.conditionStates = new Map();
      }
    } else {
      this.conditionStates = new Map();
      // Part 5: Baseline condition evaluation on cold start without emitting
      if (this.model.notifications) {
        for (const rule of this.model.notifications) {
          if (rule.when && this.model.entities.has(rule.resource)) {
            for (const rec of this.records(rule.resource)) {
              if (!rec._archived_at) {
                const key = `${rule.id}:${rec.id}`;
                const isActive = Boolean(this.evaluateCondition(rule.when, rule.resource, rec));
                this.conditionStates.set(key, isActive);
              }
            }
          }
        }
      }
    }

    this.reconcile();
  }

  reset() {
    for (const resource of this.model.entities.values()) {
      this.storage.removeItem(this.key(resource.id));
      this.data.set(resource.id, structuredClone(this.seedData.get(resource.id) ?? []));
    }
    this.storage.removeItem(this.notificationKey());
    this.storage.removeItem(this.conditionStatesKey());
    this.notificationsData = [];
    this.conditionStates = new Map();
    this.reconcile();
    this.emitChange({ type: "reset" });
  }

  records(resourceId) {
    const records = this.data.get(resourceId);
    if (!records) throw new AirError(`unknown resource \`${resourceId}\``);
    return records;
  }

  events(resourceId) {
    const records = this.records(resourceId);
    const list = [];
    for (const record of records) {
      const history = record._air_history ?? [];
      for (const entry of history) {
        list.push({
          id: entry.id,
          resource: resourceId,
          record_id: record.id,
          event: entry.event,
          action: entry.action,
          from: entry.from,
          to: entry.to,
          at: entry.at,
          actor: entry.actor,
          comment: entry.comment,
          completed: entry.completed
        });
      }
    }
    return Object.freeze(list);
  }

  resolveReferencePath(record, path) {
    let current = record;
    for (let index = 0; index < path.length; index += 1) {
      const step = path[index];
      const targetId = current?.[step.field];
      if (!targetId) return null;
      if (index === path.length - 1) return targetId;
      current = this.records(step.ref).find((candidate) => candidate.id === targetId);
      if (!current) return null;
    }
    return null;
  }

  resolveConditionPath(resourceId, record, path) {
    let currentResourceId = resourceId;
    let current = record;
    for (let index = 0; index < path.length; index += 1) {
      const step = path[index];
      const resource = this.model.entities.get(currentResourceId);
      const field = resource?.fieldMap?.get(step.field);
      const value = field?.computed ? this.computedValue(field, current, currentResourceId) : current?.[step.field];
      if (index === path.length - 1) return value;
      if (isBlank(value)) return null;
      currentResourceId = field?.ref ?? step.ref;
      current = this.records(currentResourceId).find((candidate) => candidate.id === value);
      if (!current) return null;
    }
    return null;
  }

  conditionOperand(resourceId, record, operand) {
    const evaluatedTerms = operand.terms.map((term) => {
      let val;
      if (term.kind === "relational_count") {
        const targetEntity = this.model.entities.get(term.target);
        if (!targetEntity) return { ...term, evaluated: 0 };
        const refField = targetEntity.fields.find((f) => f.type === "ref" && f.ref === resourceId);
        let records = this.records(term.target).filter((r) => !r._archived_at);
        if (refField && record?.id) {
          records = records.filter((r) => r[refField.id] === record.id);
        }
        if (term.where) {
          records = records.filter((r) => this.evaluateCondition(term.where, term.target, r));
        }
        val = records.length;
      } else if (term.kind === "relational_one") {
        let records = this.records(term.target).filter((r) => !r._archived_at);
        if (term.whereRaw) {
          const clauses = term.whereRaw.split("&");
          records = records.filter((candidate) => {
            return clauses.every((clauseStr) => {
              const m = /^(.+?)(==|!=|>=|<=|>|<)(.+)$/.exec(clauseStr.trim());
              if (!m) return true;
              const targetField = m[1].trim();
              const op = m[2];
              const sourceFieldOrLit = m[3].trim();
              const leftVal = candidate[targetField];
              let rightVal;
              if (record && Object.hasOwn(record, sourceFieldOrLit)) {
                rightVal = record[sourceFieldOrLit];
              } else if (sourceFieldOrLit.startsWith("@")) {
                rightVal = this.model.parameters.get(resourceId)?.get(sourceFieldOrLit.slice(1))?.value;
              } else {
                rightVal = parseValue(sourceFieldOrLit);
              }
              if (op === "==") return String(leftVal ?? "").toLowerCase() === String(rightVal ?? "").toLowerCase();
              if (op === "!=") return String(leftVal ?? "").toLowerCase() !== String(rightVal ?? "").toLowerCase();
              if (op === ">") return leftVal > rightVal;
              if (op === ">=") return leftVal >= rightVal;
              if (op === "<") return leftVal < rightVal;
              if (op === "<=") return leftVal <= rightVal;
              return false;
            });
          });
        }
        if (records.length === 0) {
          val = null;
        } else if (records.length === 1) {
          val = term.field ? (records[0][term.field] ?? null) : records[0];
        } else {
          throw new AirError(`AIR_CARDINALITY_ERROR: lookup \`one(${term.target})\` expected at most 1 matching record, but found ${records.length}`, null, {
            code: "AIR_CARDINALITY_ERROR",
            phase: "execute",
            category: FAILURE_CATEGORIES.CARDINALITY_ERROR
          });
        }
      } else if (term.kind === "literal" || term.kind === "parameter") val = term.value;
      else if (term.kind === "duration") val = term.duration;
      else if (term.kind === "temporal") {
        if (term.value === "today") val = this.currentDate();
        else if (term.value === "now") val = this.currentInstant();
        else val = term.value;
      } else if (term.kind === "interval_duration") {
        const intervalVal = this.resolveConditionPath(resourceId, record, term.path);
        val = getIntervalDuration(intervalVal);
      } else {
        val = this.resolveConditionPath(resourceId, record, term.path);
      }
      return { ...term, evaluated: val };
    });

    if (evaluatedTerms.some((t) => isBlank(t.evaluated))) return MISSING;
    if (evaluatedTerms.length === 1) return evaluatedTerms[0].evaluated;

    if ((evaluatedTerms[0].type === "datetime" || evaluatedTerms[0].type === "date") && evaluatedTerms[1].type === "duration") {
      const instant = evaluatedTerms[0].evaluated;
      const dur = evaluatedTerms[1].evaluated instanceof Duration ? evaluatedTerms[1].evaluated.ms : Number(evaluatedTerms[1].evaluated);
      const ms = evaluatedTerms[1].op === "-" ? -dur : dur;
      return addDurationToInstant(instant, ms);
    }

    if ((evaluatedTerms[0].type === "datetime" || evaluatedTerms[0].type === "date") &&
        (evaluatedTerms[1].type === "datetime" || evaluatedTerms[1].type === "date") &&
        evaluatedTerms[1].op === "-") {
      return subtractInstants(evaluatedTerms[0].evaluated, evaluatedTerms[1].evaluated);
    }

    if (evaluatedTerms[0].type === "duration" && evaluatedTerms[1].type === "duration") {
      const d1 = evaluatedTerms[0].evaluated instanceof Duration ? evaluatedTerms[0].evaluated.ms : Number(evaluatedTerms[0].evaluated);
      const d2 = evaluatedTerms[1].evaluated instanceof Duration ? evaluatedTerms[1].evaluated.ms : Number(evaluatedTerms[1].evaluated);
      const resMs = evaluatedTerms[1].op === "-" ? d1 - d2 : d1 + d2;
      return new Duration(resMs);
    }

    let total = 0;
    for (const t of evaluatedTerms) {
      const num = Number(t.evaluated);
      if (!Number.isFinite(num)) return MISSING;
      total = (t.op === "-") ? total - num : total + num;
    }
    return total;
  }

  evaluateCondition(condition, resourceId, record) {
    if (!condition || condition.source === "true") return true;
    if (condition.source === "false") return false;
    return condition.alternatives.some((clauses) => clauses.every((clause) => {
      if (clause.kind === "quantifier") {
        const targetEntity = this.model.entities.get(clause.target);
        if (!targetEntity) return false;
        const refField = targetEntity.fields.find((f) => f.type === "ref" && f.ref === resourceId);
        let records = this.records(clause.target).filter((r) => !r._archived_at);
        if (refField && record?.id) {
          records = records.filter((r) => r[refField.id] === record.id);
        }
        if (records.length === 0) {
          if (clause.quantifier === "all") return true;
          if (clause.quantifier === "none") return true;
          if (clause.quantifier === "any") return false;
        }
        if (clause.quantifier === "all") {
          return records.every((c) => !clause.where || this.evaluateCondition(clause.where, clause.target, c));
        }
        if (clause.quantifier === "any") {
          return records.some((c) => !clause.where || this.evaluateCondition(clause.where, clause.target, c));
        }
        if (clause.quantifier === "none") {
          return !records.some((c) => !clause.where || this.evaluateCondition(clause.where, clause.target, c));
        }
        return false;
      }

      const left = this.conditionOperand(resourceId, record, clause.left);
      const right = this.conditionOperand(resourceId, record, clause.right);
      if (left === MISSING || right === MISSING) return false;
      
      if (clause.type === "duration") {
        const valA = left instanceof Duration ? left.ms : typeof left === "string" ? (parseDurationLiteral(left)?.ms ?? Number(left)) : Number(left);
        const valB = right instanceof Duration ? right.ms : typeof right === "string" ? (parseDurationLiteral(right)?.ms ?? Number(right)) : Number(right);
        if (clause.operator === "==") return valA === valB;
        if (clause.operator === "!=") return valA !== valB;
        if (clause.operator === ">") return valA > valB;
        if (clause.operator === ">=") return valA >= valB;
        if (clause.operator === "<") return valA < valB;
        if (clause.operator === "<=") return valA <= valB;
        return false;
      }

      if (clause.type === "datetime" || clause.type === "date") {
        const toMs = (val) => {
          if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return new Date(`${val}T00:00:00.000Z`).getTime();
          return new Date(val).getTime();
        };
        const tA = toMs(left);
        const tB = toMs(right);
        if (clause.operator === "==") return tA === tB;
        if (clause.operator === "!=") return tA !== tB;
        if (clause.operator === ">") return tA > tB;
        if (clause.operator === ">=") return tA >= tB;
        if (clause.operator === "<") return tA < tB;
        if (clause.operator === "<=") return tA <= tB;
        return false;
      }

      const numeric = numericSemanticType(clause.type);
      if (numeric && (typeof left !== "number" || typeof right !== "number" || !Number.isFinite(left) || !Number.isFinite(right))) return false;
      const a = left;
      const b = right;
      if (clause.operator === "==") return a === b;
      if (clause.operator === "!=") return a !== b;
      if (clause.operator === ">") return a > b;
      if (clause.operator === ">=") return a >= b;
      if (clause.operator === "<") return a < b;
      if (clause.operator === "<=") return a <= b;
      return false;
    }));
  }

  policyMatches(policy, resourceId, record, action, system = false) {
    if (!policy) return false;
    const principal = this.principal ?? { actor: null, id: null, roles: [] };
    const roles = new Set([...(principal.roles ?? []), ...(principal.role ? [principal.role] : [])]);
    return policy.terms.some((term) => {
      if (term.kind === "system") return system;
      if (system) return false;
      if (term.kind === "any") return true;
      if (term.kind === "role") return roles.has(term.value);
      if (term.kind === "self") return Boolean(record && principal.actor === term.actor && principal.id === record.id);
      if (term.kind === "owner") {
        if (!record) return action === "create" && principal.actor === term.actor;
        return principal.actor === term.actor && principal.id === this.resolveReferencePath(record, term.path);
      }
      return false;
    });
  }

  can(resourceId, action, record = null) {
    const policy = this.model.access.get(resourceId)?.[action];
    return this.policyMatches(policy, resourceId, record, action);
  }

  assertCan(resourceId, action, record = null) {
    if (!this.can(resourceId, action, record)) throw new AirError(`current principal is not permitted to ${action} ${resourceId}`);
    if (this.capabilityEngine) {
      const actionMap = { view: "read", create: "create", edit: "update", delete: "delete", archive: "delete" };
      const capAction = actionMap[action] ?? action;
      this.capabilityEngine.assertCapability(`data:*:${resourceId}:${capAction}`, {
        actor: this.principal.actor ?? "user",
        operation: `${resourceId}.${action}`
      });
    }
  }

  toAiContext(options = {}) {
    const summary = {
      app: this.model.app?.title ?? this.model.app?.id,
      version: this.model.version,
      entities: [...this.model.entities.values()].map((e) => ({
        id: e.id,
        label: e.label,
        fields: e.fields.map((f) => ({
          id: f.id,
          type: f.type,
          label: f.label,
          classification: f.classification ?? FIELD_CLASSIFICATIONS.INTERNAL
        }))
      }))
    };

    if (options.includeRecords) {
      if (this.capabilityEngine) {
        this.capabilityEngine.assertCapability("ai:data:*:read", { actor: "ai", operation: "read_records" });
      }
      summary.records = {};
      for (const [resId, list] of this.data.entries()) {
        summary.records[resId] = list.map((rec) => {
          const sanitized = {};
          const entity = this.model.entities.get(resId);
          for (const [k, v] of Object.entries(rec)) {
            const field = entity?.fieldMap.get(k);
            if (field?.classification === FIELD_CLASSIFICATIONS.SECRET) {
              sanitized[k] = "[REDACTED_SECRET]";
            } else if (field?.classification === FIELD_CLASSIFICATIONS.SENSITIVE && !options.allowSensitive) {
              sanitized[k] = "[REDACTED_SENSITIVE]";
            } else {
              sanitized[k] = v;
            }
          }
          return sanitized;
        });
      }
    }

    return globalRedactor.redactObject(summary);
  }

  validate(resourceId, values, currentId = null, records = null) {
    const resource = this.model.entities.get(resourceId);
    if (!resource) throw new AirError(`unknown resource \`${resourceId}\``);
    const errors = object();
    const peers = records ?? this.records(resourceId);
    for (const field of resource.fields.filter((candidate) => !candidate.computed)) {
      const normalized = normalizeInput(field, values[field.id], this.clock);
      const error = validateScalar(field, normalized, this.model, peers, currentId);
      if (error) errors[field.id] = error;
      if (!error && field.type === "ref" && normalized && !this.records(field.ref).some((record) => record.id === normalized)) errors[field.id] = `${field.label} references a missing record`;
    }

    // Interval boundary validation: start must be before end (or same day for date-only)
    for (const field of resource.fields) {
      if (field.type === "interval") {
        const startVal = values[field.start];
        const endVal = values[field.end];
        if (startVal && endVal) {
          const isDateOnly = typeof startVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startVal) &&
                             typeof endVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endVal);
          const invalid = isDateOnly ? startVal > endVal : startVal >= endVal;
          if (invalid) {
            const msg = `${field.label || field.id} start must be before end`;
            errors[field.id] = msg;
            errors[field.start] = `${resource.fieldMap.get(field.start)?.label || field.start} must be before ${resource.fieldMap.get(field.end)?.label || field.end}`;
          }
        }
      }
    }

    for (const invariant of this.model.invariants.get(resourceId) ?? []) {
      const isConditionActive = !invariant.when || this.evaluateCondition(invariant.when, resourceId, values);
      if (!isConditionActive) continue;

      for (const fieldId of invariant.required) {
        if (isBlank(values[fieldId])) errors[fieldId] = `${resource.fieldMap.get(fieldId)?.label || fieldId} is required by ${invariant.id}`;
      }

      if (invariant.deny && !invariant.none && !invariant.exists && !invariant.overlaps) {
        errors[invariant.id] = invariant.deny;
        const leftTerm = invariant.when?.alternatives?.[0]?.[0]?.left?.terms?.[0];
        if (leftTerm?.kind === "path" && leftTerm.path?.length === 1) {
          errors[leftTerm.path[0].field] = invariant.deny;
        }
      }

      if (invariant.none) {
        const targetResourceId = invariant.none;
        const targetRecords = this.records(targetResourceId);
        const scopeVal = invariant.scope ? values[invariant.scope] : null;

        let candidateInterval = null;
        if (invariant.overlaps) {
          const intervalField = resource.fieldMap.get(invariant.overlaps);
          if (intervalField && intervalField.type === "interval") {
            candidateInterval = {
              start: values[intervalField.start],
              end: values[intervalField.end]
            };
          } else if (values[invariant.overlaps] && typeof values[invariant.overlaps] === "object") {
            candidateInterval = values[invariant.overlaps];
          }
        }
        if (!candidateInterval) {
          const startKey = ["start_at", "start", "from"].find((k) => values[k] != null);
          const endKey = ["end_at", "end", "to"].find((k) => values[k] != null);
          if (startKey && endKey) {
            candidateInterval = { start: values[startKey], end: values[endKey] };
          }
        }

        if (candidateInterval && candidateInterval.start && candidateInterval.end) {
          const targetEntity = this.model.entities.get(targetResourceId);
          for (const targetRec of targetRecords) {
            if (targetResourceId === resourceId && currentId != null && targetRec.id === currentId) continue;
            if (targetRec._archived_at) continue;
            if (invariant.scope && targetRec[invariant.scope] !== scopeVal) continue;
            if (invariant.where && !this.evaluateCondition(invariant.where, targetResourceId, targetRec)) continue;

            let targetInterval = null;
            if (invariant.overlaps) {
              const targetField = targetEntity?.fieldMap.get(invariant.overlaps);
              if (targetField && targetField.type === "interval") {
                targetInterval = {
                  start: targetRec[targetField.start],
                  end: targetRec[targetField.end]
                };
              }
            }
            if (!targetInterval) {
              const targetIntervalField = targetEntity?.fields.find((f) => f.type === "interval");
              if (targetIntervalField) {
                targetInterval = {
                  start: targetRec[targetIntervalField.start],
                  end: targetRec[targetIntervalField.end]
                };
              } else {
                const sKey = ["start_at", "start", "from"].find((k) => targetRec[k] != null);
                const eKey = ["end_at", "end", "to"].find((k) => targetRec[k] != null);
                if (sKey && eKey) {
                  targetInterval = { start: targetRec[sKey], end: targetRec[eKey] };
                }
              }
            }

            if (targetInterval && targetInterval.start && targetInterval.end) {
              if (intervalsOverlap(candidateInterval, targetInterval)) {
                const message = invariant.deny || `Conflicting ${targetEntity?.singular || targetResourceId} overlap detected for ${resource.singular || resourceId}`;
                errors[invariant.overlaps || invariant.id] = message;
                errors[invariant.id] = message;
                break;
              }
            }
          }
        }
      }
    }

    const uniqueConstraints = this.model.uniqueConstraints?.get(resourceId) ?? [];
    for (const constraint of uniqueConstraints) {
      if (constraint.when && !this.evaluateCondition(constraint.when, resourceId, values)) continue;
      let hasBlank = false;
      for (const f of constraint.fields) {
        if (isBlank(values[f])) {
          errors[f] = `${resource.fieldMap.get(f)?.label || f} is required for composite uniqueness`;
          hasBlank = true;
        }
      }
      if (hasBlank) continue;

      for (const peer of peers) {
        if (currentId != null && peer.id === currentId) continue;
        if (peer._archived_at) continue;
        if (constraint.where && !this.evaluateCondition(constraint.where, resourceId, peer)) continue;
        const matchesAll = constraint.fields.every((f) => {
          const valA = values[f];
          const valB = peer[f];
          return String(valA ?? "").toLowerCase() === String(valB ?? "").toLowerCase();
        });
        if (matchesAll) {
          const msg = constraint.deny || `Composite uniqueness violation on ${resource.singular || resourceId} (${constraint.fields.join(", ")})`;
          errors[constraint.fields[0]] = msg;
          errors[constraint.id] = msg;
          break;
        }
      }
    }

    return errors;
  }

  prepare(resourceId, values, currentId = null) {
    const resource = this.model.entities.get(resourceId);
    if (!resource) throw new AirError(`unknown resource \`${resourceId}\``);
    const record = { id: currentId ?? "" };
    for (const field of resource.fields.filter((candidate) => !candidate.computed)) record[field.id] = normalizeInput(field, values[field.id], this.clock);
    const errors = this.validate(resourceId, record, currentId);
    if (Object.keys(errors).length) return { record: null, errors };
    record.id = currentId ?? this.idFactory(resourceId);
    return { record, errors };
  }

  persistNotifications() {
    this.storage.setItem(this.notificationKey(), JSON.stringify(this.notificationsData));
  }

  persistConditionStates() {
    const obj = Object.fromEntries(this.conditionStates.entries());
    this.storage.setItem(this.conditionStatesKey(), JSON.stringify(obj));
  }

  createNotificationInstance(rule, resourceId, record, eventMeta = null) {
    const notifId = `notif_${rule.id}_${record.id}_${eventMeta?.eventId ?? eventMeta?.type ?? this.clock().valueOf()}_${Math.random().toString(36).slice(2, 6)}`;

    // Deduplicate event notification if identical event/rule/record already exists
    if (eventMeta?.eventId) {
      const existing = this.notificationsData.find(
        (n) => n.ruleId === rule.id && n.eventId === eventMeta.eventId
      );
      if (existing) return existing;
    }

    const resource = this.model.entities.get(resourceId);
    const formattedTitle = formatNotificationContent(rule.title, null, resourceId, record, this)
      ?? this.displayValue(resourceId, resource?.labelField ?? "id", record[resource?.labelField ?? "id"]);

    const formattedBody = formatNotificationContent(rule.body, null, resourceId, record, this)
      ?? (rule.label ? `${rule.label} for ${resource?.singular || resourceId}` : "");

    const instance = {
      id: notifId,
      ruleId: rule.id,
      resource: resourceId,
      recordId: record.id,
      eventId: eventMeta?.eventId ?? null,
      createdAt: this.clock().toISOString(),
      tone: rule.tone ?? "info",
      label: rule.label ?? titleCase(rule.ruleId || rule.id),
      title: formattedTitle,
      body: formattedBody,
      audience: rule.audience,
      action: {
        resource: resourceId,
        recordId: record.id,
        purpose: rule.action ?? "detail"
      }
    };

    this.notificationsData.unshift(instance);
    this.persistNotifications();
    this.emitChange({ type: "notification_created", notification: instance });
    return instance;
  }

  evaluateNotificationRules(resourceId, eventMeta = null) {
    if (!this.model.notifications || !this.model.notifications.length) return;
    const rules = this.model.notifications.filter((r) => r.resource === resourceId);
    if (!rules.length) return;

    const records = this.records(resourceId).filter((r) => !r._archived_at);

    for (const rule of rules) {
      if (rule.on) {
        // Event-based rule
        if (eventMeta) {
          let isMatch = false;
          if (rule.on === "created" && eventMeta.type === "resource_created") isMatch = true;
          else if (rule.on === "updated" && eventMeta.type === "mutation") isMatch = true;
          else if (rule.on === "transition" && eventMeta.type === "workflow_transitioned") isMatch = true;
          else if (rule.on.startsWith("action:") && eventMeta.type === "workflow_transitioned" && eventMeta.action === rule.on.slice(7)) isMatch = true;
          else if (rule.on.startsWith("to:") && eventMeta.type === "workflow_transitioned" && eventMeta.toState === rule.on.slice(3)) isMatch = true;
          else if (rule.on === eventMeta.action) isMatch = true;
          else if (rule.on === eventMeta.toState) isMatch = true;

          if (isMatch) {
            const rec = eventMeta.record ?? records.find((r) => r.id === (eventMeta.recordId ?? eventMeta.record?.id));
            if (rec) {
              this.createNotificationInstance(rule, resourceId, rec, eventMeta);
            }
          }
        }
      }

      if (rule.when) {
        // Condition-transition-based rule (edge-triggered: false -> true)
        for (const rec of records) {
          const key = `${rule.id}:${rec.id}`;
          const previousState = this.conditionStates.get(key) ?? false;
          const currentState = Boolean(this.evaluateCondition(rule.when, resourceId, rec));

          if (!previousState && currentState) {
            // Edge triggered: false -> true
            this.conditionStates.set(key, true);
            this.persistConditionStates();
            this.createNotificationInstance(rule, resourceId, rec, eventMeta);
          } else if (previousState && !currentState) {
            // Condition cleared: true -> false
            this.conditionStates.set(key, false);
            this.persistConditionStates();
          }
          // If true -> true: stays true, NO duplicate notification emitted!
        }
      }
    }
  }

  principalKey(principal = this.principal) {
    return `${principal?.actor ?? "user"}:${principal?.id ?? (principal?.roles && principal.roles.length > 0 ? principal.roles.join("_") : "anon")}`;
  }

  getUserNotificationStateMap(principal = this.principal) {
    const key = this.userNotificationStateKey(this.principalKey(principal));
    const raw = this.storage.getItem(key);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  setUserNotificationStateMap(map, principal = this.principal) {
    const key = this.userNotificationStateKey(this.principalKey(principal));
    this.storage.setItem(key, JSON.stringify(map));
  }

  getUserNotificationState(notificationId, principal = this.principal) {
    const map = this.getUserNotificationStateMap(principal);
    return map[notificationId] ?? { read: false, readAt: null, dismissed: false, dismissedAt: null };
  }

  notifications(options = {}) {
    const principal = options.principal ?? this.principal;
    const userMap = this.getUserNotificationStateMap(principal);
    const results = [];

    for (const notif of this.notificationsData) {
      const entity = this.model.entities.get(notif.resource);
      if (!entity) continue;
      const rec = this.records(notif.resource).find((r) => r.id === notif.recordId);
      if (!rec || rec._archived_at) continue;

      // 1. Authority Check: Principal must be permitted to view the source record
      if (!this.can(notif.resource, "view", rec)) continue;

      // 2. Audience Check: Principal must match notification audience
      if (!audienceMatches(notif.audience, principal, rec, notif.resource, this)) continue;

      const uState = userMap[notif.id] ?? { read: false, readAt: null, dismissed: false, dismissedAt: null };
      if (uState.dismissed && !options.includeDismissed) continue;
      if (options.unreadOnly && uState.read) continue;

      // Re-evaluate title and body to reflect live formatted values / ensure zero stale leaks
      const rule = this.model.notifications?.find((r) => r.id === notif.ruleId);
      const liveTitle = formatNotificationContent(rule?.title, notif.title, notif.resource, rec, this);
      const liveBody = formatNotificationContent(rule?.body, notif.body, notif.resource, rec, this);

      results.push({
        ...notif,
        title: liveTitle,
        body: liveBody,
        read: Boolean(uState.read),
        readAt: uState.readAt,
        dismissed: Boolean(uState.dismissed),
        dismissedAt: uState.dismissedAt
      });
    }

    return results.sort((a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf());
  }

  unreadNotificationCount(principal = this.principal) {
    return this.notifications({ unreadOnly: true, principal }).length;
  }

  markNotificationAsRead(notificationId, principal = this.principal) {
    const map = this.getUserNotificationStateMap(principal);
    map[notificationId] = {
      ...(map[notificationId] ?? {}),
      read: true,
      readAt: this.clock().toISOString()
    };
    this.setUserNotificationStateMap(map, principal);
    this.emitChange({ type: "notification_state_changed", notificationId, read: true });
  }

  markAllNotificationsAsRead(principal = this.principal) {
    const visible = this.notifications({ principal, unreadOnly: true });
    const map = this.getUserNotificationStateMap(principal);
    const now = this.clock().toISOString();
    for (const notif of visible) {
      map[notif.id] = {
        ...(map[notif.id] ?? {}),
        read: true,
        readAt: now
      };
    }
    this.setUserNotificationStateMap(map, principal);
    this.emitChange({ type: "notification_state_changed", all: true, read: true });
  }

  dismissNotification(notificationId, principal = this.principal) {
    const map = this.getUserNotificationStateMap(principal);
    map[notificationId] = {
      ...(map[notificationId] ?? {}),
      dismissed: true,
      dismissedAt: this.clock().toISOString()
    };
    this.setUserNotificationStateMap(map, principal);
    this.emitChange({ type: "notification_state_changed", notificationId, dismissed: true });
  }

  commit(resourceId, records, eventMeta = null) {
    this.storage.setItem(this.key(resourceId), JSON.stringify(records));
    this.data.set(resourceId, records);
    const adapter = this.adapter(resourceId);
    if (adapter && typeof adapter.syncFromRuntime === "function") {
      adapter.syncFromRuntime(resourceId, records);
    }
    const resolvedEvent = eventMeta ?? { type: "mutation", resource: resourceId };
    this.evaluateNotificationRules(resourceId, resolvedEvent);
    this.emitChange(resolvedEvent);
  }

  create(resourceId, values) {
    this.assertAdapterAtomicCapability(resourceId);
    const { record, errors } = this.prepare(resourceId, values);
    if (!record) return { record: null, errors, events: [] };
    this.assertCan(resourceId, "create", record);
    const events = [];
    const process = this.model.processes.get(resourceId);
    if (process?.history) {
      const entry = this.makeHistoryEntry(record, {
        address: `${resourceId}.created`, event: "created", action: "create",
        from: null, to: record[process.state]
      }, true, "");
      record._air_history = [entry];
      events.push(structuredClone(entry));
    }
    const stabilized = this.stabilizeRecord(resourceId, record, events);
    this.commit(resourceId, [...this.records(resourceId), stabilized], {
      type: "resource_created",
      resource: resourceId,
      record: stabilized
    });
    this.reconcile();
    return { record: this.get(resourceId, record.id), errors, events };
  }

  update(resourceId, id, values) {
    this.assertAdapterAtomicCapability(resourceId);
    const existing = this.records(resourceId).find((record) => record.id === id);
    if (!existing) throw new AirError(`unknown record \`${resourceId}.${id}\``);
    this.assertCan(resourceId, "edit", existing);
    const resource = this.model.entities.get(resourceId);
    const process = this.model.processes.get(resourceId);
    const candidate = { ...existing, ...values };
    const mutationErrors = object();
    if (process && Object.hasOwn(values, process.state) && normalizeInput(resource.fieldMap.get(process.state), values[process.state], this.clock) !== existing[process.state]) {
      mutationErrors[process.state] = `${resource.fieldMap.get(process.state).label} can only change through a declared transition`;
    }
    for (const invariant of this.model.invariants.get(resourceId) ?? []) {
      if (!invariant.immutable.length || !this.evaluateCondition(invariant.when, resourceId, existing)) continue;
      const fields = invariant.immutable.includes("*")
        ? resource.fields.filter((field) => !field.computed && field.id !== process?.state && field.id !== process?.touch).map((field) => field.id)
        : invariant.immutable;
      for (const fieldId of fields) {
        if (!Object.hasOwn(values, fieldId)) continue;
        const normalized = normalizeInput(resource.fieldMap.get(fieldId), values[fieldId], this.clock);
        if (normalized !== existing[fieldId]) mutationErrors[fieldId] = `${resource.fieldMap.get(fieldId).label} is immutable in the current state`;
      }
    }
    if (Object.keys(mutationErrors).length) return { record: null, errors: mutationErrors };
    if (process?.touch) candidate[process.touch] = this.clock().toISOString().slice(0, 10);
    const { record, errors } = this.prepare(resourceId, candidate, id);
    if (!record) return { record: null, errors };
    if (existing._archived_at) record._archived_at = existing._archived_at;
    if (existing._air_history) record._air_history = structuredClone(existing._air_history);
    this.commit(resourceId, this.records(resourceId).map((item) => item.id === id ? record : item), {
      type: "resource_updated",
      resource: resourceId,
      recordId: id,
      record
    });
    this.reconcile();
    return { record: this.get(resourceId, id), errors };
  }

  delete(resourceId, id) {
    this.assertAdapterAtomicCapability(resourceId);
    const records = this.records(resourceId);
    const target = records.find((record) => record.id === id);
    if (!target) throw new AirError(`unknown record \`${resourceId}.${id}\``);
    const management = this.model.management.get(resourceId);
    this.assertCan(resourceId, management.lifecycle === "archive" ? "archive" : "delete", target);
    if (management.lifecycle === "archive") {
      this.commit(resourceId, records.map((record) => record.id === id ? { ...record, _archived_at: this.clock().toISOString() } : record), {
        type: "resource_archived",
        resource: resourceId,
        recordId: id
      });
      return { archived: true };
    }
    for (const resource of this.model.entities.values()) {
      for (const field of resource.fields.filter((candidate) => candidate.type === "ref" && candidate.ref === resourceId)) {
        if (this.records(resource.id).some((record) => !record._archived_at && record[field.id] === id)) throw new AirError(`cannot delete: ${resource.plural} still reference this record`);
      }
    }
    this.commit(resourceId, records.filter((record) => record.id !== id), {
      type: "resource_deleted",
      resource: resourceId,
      recordId: id
    });
    return { archived: false };
  }

  async runAtomicMutation(operation, options = {}) {
    const adapter = options.adapter ?? this.adapter("*") ?? (this.dataAdapters.size ? [...this.dataAdapters.values()][0] : null);
    if (adapter && typeof adapter.runAtomicMutation === "function") {
      return adapter.runAtomicMutation(async (txAdapter) => {
        return this.mutex.runExclusive(async () => {
          return operation(this, txAdapter);
        });
      }, options);
    }
    return this.mutex.runExclusive(async () => {
      return operation(this, null);
    });
  }

  async mutateAtomic(resourceId, mutatorFn, options = {}) {
    this.assertAdapterAtomicCapability(resourceId);
    return this.mutex.runExclusive(async () => {
      return mutatorFn();
    });
  }

  async createAsync(resourceId, values) {
    this.assertAdapterAtomicCapability(resourceId);
    const adapter = this.adapter(resourceId);
    if (adapter && typeof adapter.runAtomicMutation === "function") {
      const res = await adapter.runAtomicMutation(async (txAdapter) => {
        return this.mutex.runExclusive(async () => {
          return this.create(resourceId, values);
        });
      });
      return res?.result ?? res;
    }
    return this.mutex.runExclusive(async () => {
      return this.create(resourceId, values);
    });
  }

  async updateAsync(resourceId, id, values) {
    this.assertAdapterAtomicCapability(resourceId);
    const adapter = this.adapter(resourceId);
    if (adapter && typeof adapter.runAtomicMutation === "function") {
      const res = await adapter.runAtomicMutation(async (txAdapter) => {
        return this.mutex.runExclusive(async () => {
          return this.update(resourceId, id, values);
        });
      });
      return res?.result ?? res;
    }
    return this.mutex.runExclusive(async () => {
      return this.update(resourceId, id, values);
    });
  }

  async deleteAsync(resourceId, id) {
    this.assertAdapterAtomicCapability(resourceId);
    const adapter = this.adapter(resourceId);
    if (adapter && typeof adapter.runAtomicMutation === "function") {
      const res = await adapter.runAtomicMutation(async (txAdapter) => {
        return this.mutex.runExclusive(async () => {
          return this.delete(resourceId, id);
        });
      });
      return res?.result ?? res;
    }
    return this.mutex.runExclusive(async () => {
      return this.delete(resourceId, id);
    });
  }

  async transitionAsync(resourceId, id, action, options = {}) {
    this.assertAdapterAtomicCapability(resourceId);
    const adapter = this.adapter(resourceId);
    if (adapter && typeof adapter.runAtomicMutation === "function") {
      const res = await adapter.runAtomicMutation(async (txAdapter) => {
        return this.mutex.runExclusive(async () => {
          return this.transition(resourceId, id, action, options);
        });
      });
      return res?.result ?? res;
    }
    return this.mutex.runExclusive(async () => {
      return this.transition(resourceId, id, action, options);
    });
  }

  durationEnd(startInput, duration) {
    const start = new Date(startInput);
    if (Number.isNaN(start.valueOf())) return null;
    if (duration.unit === "h") return new Date(start.valueOf() + duration.amount * 3_600_000);
    if (duration.unit === "d") return new Date(start.valueOf() + duration.amount * 86_400_000);
    const result = new Date(start);
    let remaining = duration.amount;
    while (remaining > 0) {
      result.setUTCDate(result.getUTCDate() + 1);
      const day = result.getUTCDay();
      if (day !== 0 && day !== 6) remaining -= 1;
    }
    return result;
  }

  history(resourceId, id) {
    const record = this.records(resourceId).find((candidate) => candidate.id === id);
    if (!record) throw new AirError(`unknown record \`${resourceId}.${id}\``);
    return structuredClone(record._air_history ?? []);
  }

  makeHistoryEntry(record, transition, completed, comment = "", options = {}) {
    const history = record._air_history ?? [];
    return {
      id: `${record.id}:h${history.length + 1}`,
      transition: transition.address,
      event: transition.event,
      action: transition.action,
      from: options.from ?? transition.from ?? null,
      to: options.to ?? transition.to ?? null,
      actor: options.system
        ? { actor: "system", id: "system", roles: [] }
        : { actor: this.principal.actor ?? null, id: this.principal.id ?? null, roles: [...(this.principal.roles ?? []), ...(this.principal.role ? [this.principal.role] : [])] },
      at: this.clock().toISOString(),
      comment: comment || "",
      completed
    };
  }

  transitionChecks(transition, record, options = {}) {
    if (!this.evaluateCondition(transition.when, transition.resource, record)) return { allowed: false, reason: "condition" };
    if (!this.policyMatches(transition.by, transition.resource, record, transition.action, options.system)) return { allowed: false, reason: "authority" };
    if (!options.system) {
      for (const separation of transition.separate) {
        if (this.principal.actor === separation.actor && this.principal.id === this.resolveReferencePath(record, separation.path)) {
          return { allowed: false, reason: "separation of duty" };
        }
      }
    }
    const history = record._air_history ?? [];
    if (transition.unlessEvents.some((event) => history.some((entry) => entry.event === event))) return { allowed: false, reason: "prior event" };
    if (transition.within) {
      const event = transition.since.slice(6);
      const since = [...history].reverse().find((entry) => entry.event === event);
      if (!since) return { allowed: false, reason: `missing ${event} event` };
      const end = this.durationEnd(since.at, transition.within);
      if (!end || this.clock().valueOf() > end.valueOf()) return { allowed: false, reason: "time window" };
    }
    return { allowed: true, reason: null };
  }

  availableActions(resourceId, id) {
    const process = this.model.processes.get(resourceId);
    const record = this.records(resourceId).find((candidate) => candidate.id === id);
    if (!process || !record) return [];
    const actions = new Map();
    for (const transition of process.transitions) {
      if (transition.automatic || !transition.from.includes(record[process.state])) continue;
      if (!this.transitionChecks(transition, record).allowed) continue;
      const existing = actions.get(transition.action);
      const requiredComment = transition.comment === "required";
      actions.set(transition.action, {
        action: transition.action,
        label: titleCase(transition.action),
        comment: requiredComment || existing?.comment === true ? "required" : transition.comment,
        transitions: [...(existing?.transitions ?? []), transition.address]
      });
    }
    return [...actions.values()];
  }

  editableFields(resourceId, record) {
    const resource = this.model.entities.get(resourceId);
    const process = this.model.processes.get(resourceId);
    if (!resource) return [];
    const locked = new Set();
    for (const invariant of this.model.invariants.get(resourceId) ?? []) {
      if (!invariant.immutable.length || !this.evaluateCondition(invariant.when, resourceId, record)) continue;
      if (invariant.immutable.includes("*")) {
        for (const field of resource.fields.filter((candidate) => !candidate.computed)) locked.add(field.id);
      } else for (const fieldId of invariant.immutable) locked.add(fieldId);
    }
    return resource.fields.filter((field) => !field.computed && field.id !== process?.state && field.id !== process?.touch && !locked.has(field.id));
  }

  stabilizeRecord(resourceId, input, events = []) {
    const process = this.model.processes.get(resourceId);
    if (!process) return input;
    let record = input;
    const maximum = Math.max(process.transitions.length + 1, 2);
    for (let step = 0; step < maximum; step += 1) {
      const candidates = process.transitions.filter((transition) => transition.automatic
        && transition.from.includes(record[process.state])
        && this.transitionChecks(transition, record, { system: true }).allowed);
      if (!candidates.length) return record;
      if (candidates.length > 1) throw new AirError(`ambiguous automatic transitions from ${resourceId}.${record[process.state]}: ${candidates.map((item) => item.id).join(", ")}`);
      const transition = candidates[0];
      const previous = record[process.state];
      record = structuredClone(record);
      record[process.state] = transition.to;
      if (process.touch) record[process.touch] = this.clock().toISOString().slice(0, 10);
      if (process.history) {
        const entry = this.makeHistoryEntry(record, transition, true, "", { system: true, from: previous, to: transition.to });
        record._air_history = [...(record._air_history ?? []), entry];
        events.push(structuredClone(entry));
      }
      const errors = this.validate(resourceId, record, record.id);
      if (Object.keys(errors).length) throw new AirError(`automatic transition ${transition.address} failed validation: ${Object.values(errors)[0]}`);
    }
    throw new AirError(`automatic transition cycle detected for ${resourceId}.${record.id}`);
  }

  transition(resourceId, id, action, input = {}) {
    this.assertAdapterAtomicCapability(resourceId);
    const process = this.model.processes.get(resourceId);
    if (!process) throw new AirError(`resource \`${resourceId}\` has no process`);
    const existing = this.records(resourceId).find((candidate) => candidate.id === id);
    if (!existing) throw new AirError(`unknown record \`${resourceId}.${id}\``);
    const stateCandidates = process.transitions.filter((candidate) => !candidate.automatic
      && candidate.action === action && candidate.from.includes(existing[process.state]));
    if (!stateCandidates.length) throw new AirError(`action \`${action}\` is not available from ${existing[process.state]}`);
    const checked = stateCandidates.map((candidate) => ({ candidate, check: this.transitionChecks(candidate, existing) }));
    const candidates = checked.filter((item) => item.check.allowed).map((item) => item.candidate);
    if (!candidates.length) {
      const reason = checked.find((item) => item.check.reason)?.check.reason ?? "condition";
      throw new AirError(`current principal cannot ${action} ${resourceId}.${id}: ${reason}`);
    }
    if (candidates.length > 1) throw new AirError(`ambiguous action \`${action}\` from ${existing[process.state]}: ${candidates.map((item) => item.id).join(", ")}`);
    const selected = candidates[0];
    const comment = String(input.comment ?? "").trim();
    if (selected.comment === "required" && !comment) throw new AirError(`${titleCase(action)} requires a comment`);

    const history = existing._air_history ?? [];
    const enteredAt = history.findLastIndex((entry) => entry.completed && entry.to === existing[process.state] && entry.from !== entry.to);
    const evidence = history.slice(enteredAt + 1).filter((entry) => entry.transition === selected.address);
    if (selected.distinct && (!this.principal.actor || !this.principal.id)) {
      throw new AirError(`${titleCase(action)} requires an identified actor`, null, {
        code: "AIR_EXEC_IDENTITY_REQUIRED", phase: "execute", path: `transition.${selected.address}`
      });
    }
    const actorKey = `${this.principal.actor ?? ""}:${this.principal.id ?? ""}`;
    if (selected.distinct && evidence.some((entry) => `${entry.actor?.actor ?? ""}:${entry.actor?.id ?? ""}` === actorKey)) {
      throw new AirError(`${titleCase(action)} requires a different actor`);
    }
    const completed = evidence.length + 1 >= selected.approvals;
    let record = structuredClone(existing);
    const previous = record[process.state];
    if (completed) record[process.state] = selected.to;
    if (process.touch) record[process.touch] = this.clock().toISOString().slice(0, 10);
    const events = [];
    if (process.history) {
      const entry = this.makeHistoryEntry(record, selected, completed, comment, {
        from: previous,
        to: completed ? selected.to : previous
      });
      record._air_history = [...history, entry];
      events.push(structuredClone(entry));
    }
    const errors = this.validate(resourceId, record, id);
    if (Object.keys(errors).length) throw new AirError(`${titleCase(action)} failed validation: ${Object.values(errors)[0]}`);
    if (completed) record = this.stabilizeRecord(resourceId, record, events);
    this.commit(resourceId, this.records(resourceId).map((candidate) => candidate.id === id ? record : candidate), {
      type: "workflow_transitioned",
      resource: resourceId,
      recordId: id,
      action,
      fromState: previous,
      toState: record[process.state],
      completed,
      events
    });
    return { record: this.enrichRecord(resourceId, record), events, completed, approvals: Math.min(evidence.length + 1, selected.approvals), approvalsRequired: selected.approvals };
  }

  workflowStatus(resourceId, record) {
    const process = this.model.processes.get(resourceId);
    if (!process) return null;
    const deadline = process.deadlines.find((candidate) => candidate.state === record[process.state]);
    if (!deadline) return { status: null, deadline: null, overdue: false, escalationRequired: false };
    const history = record._air_history ?? [];
    const entered = [...history].reverse().find((entry) => entry.completed && entry.to === record[process.state] && entry.from !== entry.to);
    const fallback = process.touch ? record[process.touch] : record.created;
    const start = entered?.at ?? (fallback ? `${fallback}T00:00:00Z` : null);
    const due = start ? this.durationEnd(start, deadline.duration) : null;
    const overdue = Boolean(due && this.clock().valueOf() > due.valueOf());
    const escalationRequired = overdue && deadline.escalation === "required";
    return {
      status: escalationRequired ? "EscalationRequired" : overdue ? "Overdue" : "OnTime",
      deadline: due?.toISOString() ?? null,
      overdue,
      escalationRequired,
      rule: deadline.address
    };
  }

  reconcile() {
    const now = this.clock().valueOf();
    for (const rule of this.model.rules) {
      let changed = false;
      const records = this.records(rule.resource).map((record) => {
        if (record._archived_at || String(record[rule.field]) !== rule.from) return record;
        const since = Date.parse(`${record[rule.since]}T00:00:00Z`);
        if (!Number.isFinite(since) || now < since + rule.duration.milliseconds) return record;
        changed = true;
        return { ...record, [rule.field]: rule.to };
      });
      if (changed) this.commit(rule.resource, records);
    }
  }

  query(resourceId, options = {}) {
    this.reconcile();
    const resource = this.model.entities.get(resourceId);
    if (!resource) throw new AirError(`unknown resource \`${resourceId}\``);
    let records = this.records(resourceId)
      .filter((record) => options.includeArchived || !record._archived_at)
      .filter((record) => this.can(resourceId, "view", record))
      .map((record) => this.enrichRecord(resourceId, record));
    if (options.where) records = records.filter((record) => String(record[options.where.field] ?? "") === options.where.value);
    for (const [field, value] of Object.entries(options.filters ?? {})) if (!isBlank(value)) records = records.filter((record) => String(record[field] ?? "") === String(value));
    const term = String(options.search ?? "").trim().toLowerCase();
    const searchFields = options.searchFields ?? resource.fields.filter((field) => SEARCHABLE_TYPES.has(field.type)).map((field) => field.id);
    if (term) records = records.filter((record) => searchFields.some((field) => this.displayValue(resourceId, field, record[field]).toLowerCase().includes(term)));
    const sort = options.sort ?? resource.labelField;
    const descending = sort.startsWith("-");
    const sortField = descending ? sort.slice(1) : sort;
    const sortDefinition = resource.fieldMap.get(sortField);
    records.sort((left, right) => {
      let a = left[sortField] ?? "";
      let b = right[sortField] ?? "";
      if (sortDefinition?.type === "enum") {
        a = sortDefinition.values.indexOf(a);
        b = sortDefinition.values.indexOf(b);
      } else if (sortDefinition?.type === "ref") {
        a = this.displayValue(resourceId, sortField, a);
        b = this.displayValue(resourceId, sortField, b);
      }
      const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
      if (order !== 0) return descending ? -order : order;
      return left.id.localeCompare(right.id);
    });
    const total = records.length;
    const limit = options.limit ?? null;
    if (limit != null) records = records.slice(0, limit);
    const pageSize = options.pageSize ?? (limit ?? Math.max(total, 1));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(options.page ?? 1, 1), totalPages);
    if (limit == null && options.paginate !== false) records = records.slice((page - 1) * pageSize, page * pageSize);
    return { records, total, page, pageSize, totalPages };
  }

  resolvePathValue(resourceId, record, pathStr) {
    if (!pathStr || !record) return null;
    if (pathStr.endsWith(".duration")) {
      const intervalField = pathStr.replace(/\.duration$/, "");
      const intervalVal = this.resolvePathValue(resourceId, record, intervalField);
      return getIntervalDuration(intervalVal);
    }
    const parts = pathStr.split(".");
    let currentResourceId = resourceId;
    let current = record;
    for (let index = 0; index < parts.length; index += 1) {
      const seg = parts[index];
      const resource = currentResourceId ? this.model.entities.get(currentResourceId) : null;
      const field = resource?.fieldMap?.get(seg);
      let value = current?.[seg];
      if (value === undefined && field?.computed) {
        value = this.computedValue(field, current, currentResourceId);
      }
      if (index === parts.length - 1) {
        if (field?.type === "rate") {
          return new MoneyRate(value, field.currency, field.unit);
        }
        if (field?.type === "ratio") {
          return value instanceof Ratio ? value : (value ? parseRatioOrPercentLiteral(value) : null);
        }
        if (field?.type === "integer") {
          return value != null ? Math.trunc(Number(value)) : null;
        }
        return value;
      }
      if (isBlank(value)) return null;
      currentResourceId = field?.ref ?? null;
      if (!currentResourceId) return null;
      current = this.records(currentResourceId).find((candidate) => candidate.id === value);
      if (!current) return null;
    }
    return null;
  }

  evaluateComputedNode(node, ownerRecord, ownerResourceId) {
    if (!node) return null;
    if (node.kind === "collection_aggregate") {
      const targetEntity = this.model.entities.get(node.target);
      if (!targetEntity) return null;
      const refField = targetEntity.fields.find((f) => f.type === "ref" && f.ref === ownerResourceId);
      let records = this.records(node.target).filter((r) => !r._archived_at);
      if (refField && ownerRecord?.id) {
        records = records.filter((r) => r[refField.id] === ownerRecord.id);
      }
      if (node.where) {
        records = records.filter((r) => this.evaluateCondition(node.where, node.target, r));
      }
      if (node.op === "count") {
        return records.length;
      }
      if (node.op === "sum") {
        if (!records.length) return 0;
        const isMoney = node.inferredType?.type === "money" || targetEntity.fieldMap.get(node.field)?.type === "money";
        if (isMoney) {
          let totalMinor = 0n;
          for (const r of records) {
            const v = this.resolvePathValue(node.target, r, node.field);
            const m = parseMoneyToMinorUnits(v);
            if (m !== null) totalMinor += m;
          }
          return Number(totalMinor) / 100;
        }
        let total = 0;
        for (const r of records) {
          const v = this.resolvePathValue(node.target, r, node.field);
          if (v instanceof Duration) total += v.ms;
          else if (typeof v === "number") total += v;
        }
        return node.inferredType?.type === "duration" ? new Duration(total) : total;
      }
      if (node.op === "min") {
        if (!records.length) return null;
        let minVal = null;
        for (const r of records) {
          const v = this.resolvePathValue(node.target, r, node.field);
          if (v != null) {
            if (minVal === null || v < minVal) minVal = v;
          }
        }
        return minVal;
      }
      if (node.op === "max") {
        if (!records.length) return null;
        let maxVal = null;
        for (const r of records) {
          const v = this.resolvePathValue(node.target, r, node.field);
          if (v != null) {
            if (maxVal === null || v > maxVal) maxVal = v;
          }
        }
        return maxVal;
      }
      if (node.op === "avg") {
        if (!records.length) return null;
        const isMoney = node.inferredType?.type === "money" || targetEntity.fieldMap.get(node.field)?.type === "money";
        if (isMoney) {
          let totalMinor = 0n;
          let count = 0n;
          for (const r of records) {
            const v = this.resolvePathValue(node.target, r, node.field);
            const m = parseMoneyToMinorUnits(v);
            if (m !== null) {
              totalMinor += m;
              count += 1n;
            }
          }
          if (count === 0n) return null;
          const isNeg = totalMinor < 0n;
          const absTot = isNeg ? -totalMinor : totalMinor;
          const roundedMinor = (2n * absTot + count) / (2n * count);
          return Number(isNeg ? -roundedMinor : roundedMinor) / 100;
        }
        let total = 0;
        let count = 0;
        for (const r of records) {
          const v = this.resolvePathValue(node.target, r, node.field);
          if (typeof v === "number") {
            total += v;
            count++;
          } else if (v instanceof Duration) {
            total += v.ms;
            count++;
          }
        }
        if (count === 0) return null;
        return node.inferredType?.type === "duration" ? new Duration(Math.round(total / count)) : total / count;
      }
      return null;
    }
    if (node.kind === "lookup_one") {
      let records = this.records(node.target).filter((r) => !r._archived_at);
      if (node.whereRaw) {
        const clauses = node.whereRaw.split("&");
        records = records.filter((candidate) => {
          return clauses.every((clauseStr) => {
            const m = /^(.+?)(==|!=|>=|<=|>|<)(.+)$/.exec(clauseStr.trim());
            if (!m) return true;
            const targetField = m[1].trim();
            const op = m[2];
            const sourceFieldOrLit = m[3].trim();
            const leftVal = candidate[targetField];
            let rightVal;
            if (ownerRecord && Object.hasOwn(ownerRecord, sourceFieldOrLit)) {
              rightVal = ownerRecord[sourceFieldOrLit];
            } else if (sourceFieldOrLit.startsWith("@")) {
              rightVal = this.model.parameters.get(ownerResourceId)?.get(sourceFieldOrLit.slice(1))?.value;
            } else {
              rightVal = parseValue(sourceFieldOrLit);
            }
            if (op === "==") return String(leftVal ?? "").toLowerCase() === String(rightVal ?? "").toLowerCase();
            if (op === "!=") return String(leftVal ?? "").toLowerCase() !== String(rightVal ?? "").toLowerCase();
            if (op === ">") return leftVal > rightVal;
            if (op === ">=") return leftVal >= rightVal;
            if (op === "<") return leftVal < rightVal;
            if (op === "<=") return leftVal <= rightVal;
            return false;
          });
        });
      }
      if (records.length === 0) return null;
      if (records.length > 1) {
        throw new AirError(`AIR_CARDINALITY_ERROR: lookup \`one(${node.target})\` expected at most 1 matching record, but found ${records.length}`, null, {
          code: "AIR_CARDINALITY_ERROR",
          phase: "execute",
          category: FAILURE_CATEGORIES.CARDINALITY_ERROR
        });
      }
      const matched = records[0];
      return node.field ? (matched[node.field] ?? null) : matched;
    }
    if (node.kind === "interval_duration") {
      const intervalVal = this.resolvePathValue(ownerResourceId, ownerRecord, node.intervalField);
      return getIntervalDuration(intervalVal);
    }
    if (node.kind === "path") {
      if (node.path.endsWith(".duration")) {
        const intFieldName = node.path.replace(/\.duration$/, "");
        const intVal = this.resolvePathValue(ownerResourceId, ownerRecord, intFieldName);
        return getIntervalDuration(intVal);
      }
      return this.resolvePathValue(ownerResourceId, ownerRecord, node.path);
    }
    if (node.kind === "literal") {
      return node.value;
    }
    if (node.kind === "binary") {
      const leftVal = this.evaluateComputedNode(node.left, ownerRecord, ownerResourceId);
      const rightVal = this.evaluateComputedNode(node.right, ownerRecord, ownerResourceId);
      if (leftVal === null || leftVal === undefined || rightVal === null || rightVal === undefined) return null;

      if (node.op === "*") {
        // 1. duration * rate or rate * duration
        let durationMs = null;
        let rateObj = null;
        if (leftVal instanceof Duration) durationMs = leftVal.ms;
        else if (typeof leftVal === "object" && leftVal && leftVal.start && leftVal.end) durationMs = getIntervalDuration(leftVal)?.ms ?? null;
        if (rightVal instanceof Duration) durationMs = rightVal.ms;
        else if (typeof rightVal === "object" && rightVal && rightVal.start && rightVal.end) durationMs = getIntervalDuration(rightVal)?.ms ?? null;
        if (leftVal instanceof MoneyRate) rateObj = leftVal;
        if (rightVal instanceof MoneyRate) rateObj = rightVal;

        if (durationMs != null && rateObj != null) {
          const res = multiplyMoneyRate(rateObj.amount, rateObj.currency, durationMs, rateObj.unit);
          return res ? res.amount : 0;
        }

        // 2. ratio * money or money * ratio
        const isRatio = leftVal instanceof Ratio || rightVal instanceof Ratio || (typeof leftVal === "object" && leftVal?.type === "ratio") || (typeof rightVal === "object" && rightVal?.type === "ratio");
        if (isRatio) {
          const ratioVal = leftVal instanceof Ratio ? leftVal : (rightVal instanceof Ratio ? rightVal : (leftVal && typeof leftVal === "object" && leftVal.type === "ratio" ? new Ratio(leftVal) : new Ratio(rightVal)));
          const moneyVal = (leftVal instanceof Ratio || (typeof leftVal === "object" && leftVal?.type === "ratio")) ? rightVal : leftVal;
          const moneyMinor = parseMoneyToMinorUnits(moneyVal);
          if (moneyMinor === null || !ratioVal) return null;
          const num = moneyMinor * ratioVal.numerator;
          const den = ratioVal.denominator;
          if (den === 0n) return 0;
          const isNeg = (num < 0n) !== (den < 0n);
          const absNum = num < 0n ? -num : num;
          const absDen = den < 0n ? -den : den;
          const roundedMinor = (2n * absNum + absDen) / (2n * absDen);
          const finalMinor = isNeg ? -roundedMinor : roundedMinor;
          return Number(finalMinor) / 100;
        }

        // 3. (integer | number) * money or money * (integer | number)
        let moneyVal, countVal;
        if (node.left?.inferredType?.type === "money") {
          moneyVal = leftVal;
          countVal = rightVal;
        } else if (node.right?.inferredType?.type === "money") {
          moneyVal = rightVal;
          countVal = leftVal;
        } else if (Number.isSafeInteger(Number(leftVal)) && !Number.isSafeInteger(Number(rightVal))) {
          countVal = leftVal;
          moneyVal = rightVal;
        } else if (Number.isSafeInteger(Number(rightVal)) && !Number.isSafeInteger(Number(leftVal))) {
          countVal = rightVal;
          moneyVal = leftVal;
        } else {
          moneyVal = rightVal;
          countVal = leftVal;
        }
        const moneyMinor = parseMoneyToMinorUnits(moneyVal);
        if (moneyMinor === null || countVal === null) return null;
        const countBig = BigInt(Math.trunc(Number(countVal)));
        const resMinor = moneyMinor * countBig;
        return Number(resMinor) / 100;
      }

      if (node.op === "+") {
        const isRatio = leftVal instanceof Ratio || rightVal instanceof Ratio || (typeof leftVal === "object" && leftVal?.type === "ratio") || (typeof rightVal === "object" && rightVal?.type === "ratio");
        if (isRatio) {
          const ratioA = leftVal instanceof Ratio ? leftVal : (typeof leftVal === "object" && leftVal?.type === "ratio" ? new Ratio(leftVal) : new Ratio(Number(leftVal), 1));
          const ratioB = rightVal instanceof Ratio ? rightVal : (typeof rightVal === "object" && rightVal?.type === "ratio" ? new Ratio(rightVal) : new Ratio(Number(rightVal), 1));
          const num = ratioA.numerator * ratioB.denominator + ratioB.numerator * ratioA.denominator;
          const den = ratioA.denominator * ratioB.denominator;
          return new Ratio(num, den);
        }
        if (leftVal instanceof Duration && rightVal instanceof Duration) {
          return new Duration(leftVal.ms + rightVal.ms);
        }
        const minorA = parseMoneyToMinorUnits(leftVal);
        const minorB = parseMoneyToMinorUnits(rightVal);
        if (minorA !== null && minorB !== null) {
          return Number(minorA + minorB) / 100;
        }
        if (typeof leftVal === "number" && typeof rightVal === "number") {
          return leftVal + rightVal;
        }
      }

      if (node.op === "-") {
        const isRatio = leftVal instanceof Ratio || rightVal instanceof Ratio || (typeof leftVal === "object" && leftVal?.type === "ratio") || (typeof rightVal === "object" && rightVal?.type === "ratio");
        if (isRatio) {
          const ratioA = leftVal instanceof Ratio ? leftVal : (typeof leftVal === "object" && leftVal?.type === "ratio" ? new Ratio(leftVal) : new Ratio(Number(leftVal), 1));
          const ratioB = rightVal instanceof Ratio ? rightVal : (typeof rightVal === "object" && rightVal?.type === "ratio" ? new Ratio(rightVal) : new Ratio(Number(rightVal), 1));
          const num = ratioA.numerator * ratioB.denominator - ratioB.numerator * ratioA.denominator;
          const den = ratioA.denominator * ratioB.denominator;
          return new Ratio(num, den);
        }
        if (leftVal instanceof Duration && rightVal instanceof Duration) {
          return new Duration(leftVal.ms - rightVal.ms);
        }
        const minorA = parseMoneyToMinorUnits(leftVal);
        const minorB = parseMoneyToMinorUnits(rightVal);
        if (minorA !== null && minorB !== null) {
          return Number(minorA - minorB) / 100;
        }
        if (typeof leftVal === "number" && typeof rightVal === "number") {
          return leftVal - rightVal;
        }
      }
    }
    return null;
  }

  computedValue(field, ownerRecord, ownerResourceId = null) {
    const definition = field.computed;
    if (!definition) return null;
    this._computationStack = this._computationStack || new Set();
    const stackKey = `${ownerResourceId || ""}:${ownerRecord?.id || "new"}:${field.id}`;
    if (this._computationStack.has(stackKey)) {
      throw new AirError(`AIR_CYCLE_DETECTED: Dependency cycle detected in computed value \`${field.address}\``, null, {
        code: "AIR_CYCLE_DETECTED",
        phase: "execute",
        category: FAILURE_CATEGORIES.COMPUTED_CYCLE
      });
    }
    this._computationStack.add(stackKey);
    try {
      if (definition.kind === "workflow") return this.workflowStatus(ownerResourceId, ownerRecord)?.status ?? "";
      if (definition.kind === "interval") {
        return {
          start: ownerRecord[definition.start],
          end: ownerRecord[definition.end],
          policy: definition.policy ?? "[start,end)"
        };
      }
      if (definition.kind === "interval_duration") {
        const intervalVal = this.resolvePathValue(ownerResourceId, ownerRecord, definition.intervalField);
        return getIntervalDuration(intervalVal);
      }
      if (definition.ast) {
        return this.evaluateComputedNode(definition.ast, ownerRecord, ownerResourceId);
      }
      if (definition.kind === "product") {
        const leftVal = this.resolvePathValue(ownerResourceId, ownerRecord, definition.left);
        const rightVal = this.resolvePathValue(ownerResourceId, ownerRecord, definition.right);
        let durationMs = null;
        let rateObj = null;

        if (leftVal instanceof Duration) durationMs = leftVal.ms;
        else if (typeof leftVal === "object" && leftVal && leftVal.start && leftVal.end) durationMs = getIntervalDuration(leftVal)?.ms ?? null;
        
        if (rightVal instanceof Duration) durationMs = rightVal.ms;
        else if (typeof rightVal === "object" && rightVal && rightVal.start && rightVal.end) durationMs = getIntervalDuration(rightVal)?.ms ?? null;

        if (leftVal instanceof MoneyRate) rateObj = leftVal;
        if (rightVal instanceof MoneyRate) rateObj = rightVal;

        if (durationMs != null && rateObj != null) {
          const res = multiplyMoneyRate(rateObj.amount, rateObj.currency, durationMs, rateObj.unit);
          return res ? res.amount : 0;
        }
        return null;
      }
      if (definition.kind === "expression") {
        return this.resolvePathValue(ownerResourceId, ownerRecord, definition.source);
      }
      let records = this.records(definition.source)
        .filter((record) => !record._archived_at)
        .filter((record) => this.can(definition.source, "view", record))
        .filter((record) => record[definition.group] === ownerRecord.id);
      if (definition.where) records = records.filter((record) => this.evaluateCondition(definition.where, definition.source, record));
      if (definition.window === "month") {
        const month = this.clock().toISOString().slice(0, 7);
        records = records.filter((record) => String(record[definition.date] ?? "").slice(0, 7) === month);
      }
      if (definition.op === "count") return records.length;
      const isDurationField = definition.field?.endsWith(".duration") || this.model.entities.get(definition.source)?.fieldMap?.get(definition.field)?.type === "duration";
      if (isDurationField) {
        const durValues = records.map((record) => {
          const val = this.resolvePathValue(definition.source, record, definition.field);
          if (val instanceof Duration) return val.ms;
          if (typeof val === "object" && val && val.start && val.end) return getIntervalDuration(val)?.ms ?? null;
          if (typeof val === "number") return val;
          const parsed = parseDurationLiteral(val);
          return parsed ? parsed.ms : null;
        }).filter((v) => v !== null && Number.isFinite(v));
        if (!durValues.length) return new Duration(0);
        if (definition.op === "sum") return new Duration(durValues.reduce((t, v) => t + v, 0));
        if (definition.op === "average" || definition.op === "avg") {
          const sumMs = durValues.reduce((t, v) => t + v, 0);
          return new Duration(roundSymmetricRational(sumMs, durValues.length));
        }
        if (definition.op === "min") return new Duration(Math.min(...durValues));
        if (definition.op === "max") return new Duration(Math.max(...durValues));
      }
      const values = records.map((record) => Number(record[definition.field])).filter(Number.isFinite);
      if (definition.op === "sum") return values.reduce((total, value) => total + value, 0);
      if (definition.op === "average" || definition.op === "avg") return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
      if (definition.op === "min") return values.length ? Math.min(...values) : 0;
      if (definition.op === "max") return values.length ? Math.max(...values) : 0;
      throw new AirError(`unknown computed operation \`${definition.op}\``);
    } finally {
      this._computationStack.delete(stackKey);
    }
  }

  enrichRecord(resourceId, record) {
    const resource = this.model.entities.get(resourceId);
    if (!resource) throw new AirError(`unknown resource \`${resourceId}\``);
    const enriched = structuredClone(record);
    for (const field of resource.fields) {
      if (field.computed) {
        enriched[field.id] = this.computedValue(field, record, resourceId);
      } else if (field.type === "ratio" && enriched[field.id] != null) {
        enriched[field.id] = parseRatioOrPercentLiteral(enriched[field.id]);
      }
    }
    return enriched;
  }

  get(resourceId, id, options = {}) {
    const record = this.records(resourceId).find((candidate) => candidate.id === id);
    if (!record || (!options.includeArchived && record._archived_at) || !this.can(resourceId, "view", record)) return null;
    return this.enrichRecord(resourceId, record);
  }

  highlight(resourceId, record) {
    return (this.model.highlights.get(resourceId) ?? [])
      .find((item) => item.when.alternatives
        ? this.evaluateCondition(item.when, resourceId, record)
        : String(record[item.when.field] ?? "") === item.when.value)?.tone ?? null;
  }

  metric(metric) {
    let records;
    let sourceResourceId = metric.source;
    const isEventSource = metric.source.startsWith("events.");
    if (isEventSource) {
      sourceResourceId = metric.source.slice(7);
      records = this.events(sourceResourceId);
    } else {
      records = this.query(metric.source, { paginate: false }).records;
    }

    // 1. Event duration correlation (e.g. Open -> Resolved, Submitted -> Approved)
    if (isEventSource && metric.from && metric.to) {
      const parentRecords = this.records(sourceResourceId).filter((rec) => !rec._archived_at);
      let correlated = parentRecords.map((rec) => {
        const dur = correlateEventDurations(rec._air_history ?? [], metric.from, metric.to);
        return { record: rec, duration: dur };
      }).filter((item) => item.duration !== null);

      if (metric.where) {
        correlated = metric.where.alternatives
          ? correlated.filter((item) => this.evaluateCondition(metric.where, sourceResourceId, item.record))
          : correlated.filter((item) => String(item.record[metric.where.field] ?? "") === metric.where.value);
      }

      const aggregateDurations = (items) => {
        if (metric.op === "count") return items.length;
        const durMsList = items.map((i) => i.duration.ms).filter(Number.isFinite);
        if (!durMsList.length) return (metric.op === "avg" || metric.op === "average" || metric.op === "sum" || metric.op === "min" || metric.op === "max") ? new Duration(0) : 0;
        if (metric.op === "sum") return new Duration(durMsList.reduce((a, b) => a + b, 0));
        if (metric.op === "avg" || metric.op === "average") {
          const sumMs = durMsList.reduce((a, b) => a + b, 0);
          return new Duration(roundSymmetricRational(sumMs, durMsList.length));
        }
        if (metric.op === "min") return new Duration(Math.min(...durMsList));
        if (metric.op === "max") return new Duration(Math.max(...durMsList));
        throw new AirError(`unknown event duration metric operation \`${metric.op}\``);
      };

      if (metric.group) {
        const groups = new Map();
        for (const item of correlated) {
          const key = this.displayValue(sourceResourceId, metric.group, item.record[metric.group]);
          const list = groups.get(key) ?? [];
          list.push(item);
          groups.set(key, list);
        }
        return Object.fromEntries([...groups].sort(([l], [r]) => l.localeCompare(r)).map(([k, v]) => [k, aggregateDurations(v)]));
      }
      return aggregateDurations(correlated);
    }

    // 2. Generic Resource Utilization
    if (metric.op === "utilization") {
      let activeRecords = records;
      if (metric.where) {
        activeRecords = metric.where.alternatives
          ? activeRecords.filter((record) => this.evaluateCondition(metric.where, sourceResourceId, record))
          : activeRecords.filter((record) => String(record[metric.where.field] ?? "") === metric.where.value);
      }
      const intervalField = metric.overlaps || metric.field || "booking_period";
      
      let windowStart = null;
      let windowEnd = null;
      if (metric.window) {
        if (metric.window.includes("..")) {
          const [wS, wE] = metric.window.split("..");
          windowStart = wS.trim();
          windowEnd = wE.trim();
        } else if (metric.window === "month") {
          const nowStr = this.clock().toISOString();
          const yearMonth = nowStr.slice(0, 7);
          windowStart = `${yearMonth}-01T00:00:00.000Z`;
          const d = new Date(windowStart);
          d.setUTCMonth(d.getUTCMonth() + 1);
          windowEnd = d.toISOString();
        } else {
          const dur = parseDurationLiteral(metric.window);
          if (dur) {
            windowEnd = this.clock().toISOString();
            windowStart = new Date(this.clock().getTime() - dur.ms).toISOString();
          }
        }
      }
      if (!windowStart || !windowEnd) {
        const todayStr = this.currentDate();
        windowStart = `${todayStr}T00:00:00.000Z`;
        const d = new Date(windowStart);
        d.setUTCDate(d.getUTCDate() + 1);
        windowEnd = d.toISOString();
      }

      if (metric.group) {
        const groups = new Map();
        for (const record of activeRecords) {
          const key = this.displayValue(sourceResourceId, metric.group, record[metric.group]);
          const list = groups.get(key) ?? [];
          list.push(record);
          groups.set(key, list);
        }
        return Object.fromEntries(
          [...groups].sort(([l], [r]) => l.localeCompare(r)).map(([k, groupRecs]) => [
            k,
            computeUtilization(groupRecs, intervalField, windowStart, windowEnd)
          ])
        );
      }
      return computeUtilization(activeRecords, intervalField, windowStart, windowEnd);
    }

    // 3. Standard records or events aggregation
    if (metric.where) {
      records = metric.where.alternatives
        ? records.filter((record) => this.evaluateCondition(metric.where, sourceResourceId, record))
        : records.filter((record) => String(record[metric.where.field] ?? "") === metric.where.value);
    }

    const sourceEntity = this.model.entities.get(sourceResourceId);
    const fieldDef = metric.field ? (sourceEntity?.fieldMap?.get(metric.field) ?? null) : null;
    const isDurationField = fieldDef?.type === "duration" || metric.field?.endsWith(".duration") || fieldDef?.type === "interval";

    const aggregate = (items) => {
      if (metric.op === "count") return items.length;
      if (isDurationField) {
        const durValues = items.map((record) => {
          const val = this.resolvePathValue(sourceResourceId, record, metric.field);
          if (val instanceof Duration) return val.ms;
          if (typeof val === "object" && val && val.start && val.end) return getIntervalDuration(val)?.ms ?? null;
          if (typeof val === "number") return val;
          const parsed = parseDurationLiteral(val);
          return parsed ? parsed.ms : null;
        }).filter((v) => v !== null && Number.isFinite(v));

        if (!durValues.length) return new Duration(0);
        if (metric.op === "sum") return new Duration(durValues.reduce((a, b) => a + b, 0));
        if (metric.op === "average" || metric.op === "avg") {
          const sumMs = durValues.reduce((a, b) => a + b, 0);
          return new Duration(roundSymmetricRational(sumMs, durValues.length));
        }
        if (metric.op === "min") return new Duration(Math.min(...durValues));
        if (metric.op === "max") return new Duration(Math.max(...durValues));
        throw new AirError(`unknown metric operation \`${metric.op}\``);
      }

      const values = items.map((record) => Number(record[metric.field])).filter(Number.isFinite);
      if (metric.op === "sum") return values.reduce((total, value) => total + value, 0);
      if (metric.op === "average" || metric.op === "avg") return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
      if (metric.op === "min") return values.length ? Math.min(...values) : 0;
      if (metric.op === "max") return values.length ? Math.max(...values) : 0;
      throw new AirError(`unknown metric operation \`${metric.op}\``);
    };

    if (metric.group) {
      const groups = new Map();
      for (const record of records) {
        let key;
        if (metric.source.startsWith("events.")) {
          key = String(record[metric.group] ?? "—");
        } else {
          key = this.displayValue(metric.source, metric.group, record[metric.group]);
        }
        const values = groups.get(key) ?? [];
        values.push(record);
        groups.set(key, values);
      }
      return Object.fromEntries([...groups].sort(([left], [right]) => left.localeCompare(right)).map(([key, values]) => [key, aggregate(values)]));
    }
    return aggregate(records);
  }

  formatMetric(metric, value) {
    if (metric.format === "breakdown") {
      return Object.entries(value).map(([key, count]) => {
        let formattedVal;
        if (count instanceof Duration) formattedVal = count.toString();
        else if (count instanceof UtilizationRatio) formattedVal = count.toString();
        else if (metric.op === "utilization" || metric.format === "percentage" || metric.format === "percent") {
          formattedVal = `${Math.round(typeof count === "number" && count <= 1 && count > 0 ? count * 100 : Number(count))}%`;
        } else {
          formattedVal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(count);
        }
        return `${key} ${formattedVal}`;
      }).join(" · ") || "—";
    }
    if (value instanceof Duration) {
      return value.toString();
    }
    if (value instanceof UtilizationRatio) {
      return value.toString();
    }
    if (metric.op === "utilization" || metric.format === "percentage" || metric.format === "percent") {
      const pct = typeof value === "number" && value <= 1 && value > 0 ? value * 100 : Number(value);
      return `${Math.round(pct)}%`;
    }
    if (metric.format === "money") {
      const field = this.model.entities.get(metric.source)?.fieldMap?.get(metric.field);
      return new Intl.NumberFormat("en", { style: "currency", currency: field?.currency ?? "USD", maximumFractionDigits: 0 }).format(value);
    }
    if (metric.format === "duration") {
      const dur = parseDurationLiteral(value);
      if (dur) return dur.toString();
    }
    return new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
  }

  displayValue(resourceId, fieldId, value) {
    if (isBlank(value)) return "—";
    const field = this.model.entities.get(resourceId)?.fieldMap.get(fieldId);
    if (value instanceof MoneyRate) {
      const formatted = new Intl.NumberFormat("en", { style: "currency", currency: value.currency }).format(value.amount);
      return `${formatted}/${value.unit}`;
    }
    if (value instanceof Ratio || field?.type === "ratio") {
      const r = parseRatioOrPercentLiteral(value);
      return r ? r.toString() : String(value);
    }
    if (field?.type === "integer") {
      const num = Number(value);
      return Number.isSafeInteger(num) ? new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(num) : String(value);
    }
    if (value instanceof Duration) {
      return value.toString();
    }
    if (field?.type === "ref") {
      const target = this.model.entities.get(field.ref);
      const record = this.records(field.ref).find((item) => item.id === value);
      if (!record) return "Missing record";
      if (this.model.management.has(field.ref) && !this.can(field.ref, "view", record)) return "Restricted record";
      return String(record[target.labelField] ?? record.id);
    }
    if (field?.type === "bool") return value ? "Yes" : "No";
    if (field?.type === "money" || (typeof value === "object" && value !== null && value.currency && value.amount !== undefined)) {
      const cur = field?.currency ?? value?.currency ?? "USD";
      const amt = typeof value === "object" && value !== null ? value.amount : value;
      return new Intl.NumberFormat("en", { style: "currency", currency: cur }).format(amt);
    }
    if (field?.type === "rate") {
      const formatted = new Intl.NumberFormat("en", { style: "currency", currency: field.currency }).format(value);
      return `${formatted}/${field.unit}`;
    }
    if (field?.type === "duration") {
      const dur = parseDurationLiteral(value);
      if (dur) return dur.toString();
      return String(value);
    }
    if (field?.type === "interval" || (typeof value === "object" && value !== null && value.start && value.end)) {
      const s = String(value.start ?? "");
      const e = String(value.end ?? "");
      const sDate = s ? new Date(s.includes("T") ? s : `${s}T00:00:00Z`) : null;
      const eDate = e ? new Date(e.includes("T") ? e : `${e}T00:00:00Z`) : null;
      if (sDate && !Number.isNaN(sDate.valueOf()) && eDate && !Number.isNaN(eDate.valueOf())) {
        const isSameDay = s.slice(0, 10) === e.slice(0, 10);
        const df = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
        const tf = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "numeric", timeZone: "UTC", hour12: false });
        if (s.includes("T") && e.includes("T")) {
          if (isSameDay) {
            return `${df.format(sDate)} · ${tf.format(sDate)}–${tf.format(eDate)}`;
          }
          return `${df.format(sDate)} ${tf.format(sDate)} → ${df.format(eDate)} ${tf.format(eDate)}`;
        }
        if (isSameDay) {
          return df.format(sDate);
        }
        return `${df.format(sDate)} → ${df.format(eDate)}`;
      }
      return `${s} → ${e}`;
    }
    if (field?.type === "date") {
      const date = new Date(`${value}T00:00:00Z`);
      if (!Number.isNaN(date.valueOf())) return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
    }
    if (field?.type === "datetime") {
      const date = new Date(value);
      if (!Number.isNaN(date.valueOf())) return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", timeZone: "UTC" }).format(date);
    }
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
      return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(", ");
    }
    return String(value);
  }
}

function quote(value) {
  const text = String(value);
  if (text && !/[\s#"=]/.test(text)) return text;
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export function serializeDeclarations(declarations) {
  return declarations.map((declaration) => {
    const tokens = [declaration.kind];
    if (declaration.id) tokens.push(declaration.id);
    if (declaration.kind === "field" && declaration.props.type && declaration.props.type !== "ref") tokens.push(declaration.props.type);
    for (const [key, value] of Object.entries(declaration.props)) {
      if (declaration.kind === "field" && key === "type") continue;
      tokens.push(value === true ? key : `${key}=${quote(value)}`);
    }
    return tokens.join(" ");
  }).join("\n") + "\n";
}

export function applyPatch(source, patchSource, options = {}) {
  const declarations = parseDeclarations(source).map((declaration) => ({ ...declaration, props: Object.assign(object(), declaration.props) }));
  const keyOf = (kind, id) => `${kind}:${id ?? ""}`;
  const findIndex = (kind, id) => declarations.findIndex((item) => keyOf(item.kind, item.id) === keyOf(kind, id));
  patchSource.split(/\r?\n/).forEach((line, lineIndex) => {
    const tokens = tokenizeLine(line, lineIndex + 1);
    if (!tokens.length) return;
    const operation = tokens.shift();
    if (!new Set(["add", "set", "assert", "upsert", "insert", "remove"]).has(operation)) throw new AirError(`unknown patch operation \`${operation}\``, lineIndex + 1);
    const kind = tokens.shift();
    if (!(kind in DECLARATION_KEYS) || kind === "air") throw new AirError(`invalid patch declaration \`${kind}\``, lineIndex + 1);
    const needsId = ID_KINDS.has(kind);
    const id = needsId ? tokens.shift() : null;
    if (needsId && (!id || id.includes("="))) throw new AirError(`patch ${kind} requires an ID`, lineIndex + 1);
    const shell = { kind, id, line: lineIndex + 1, props: declarationProperties(kind, tokens, { kind, id, line: lineIndex + 1 }) };
    const expected = object();
    for (const key of Object.keys(shell.props)) {
      if (!key.startsWith("was_")) continue;
      expected[key.slice(4)] = shell.props[key];
      delete shell.props[key];
    }
    validatePropertyNames(shell, true);
    // `after` is business semantics for a scheduled rule. For every other
    // declaration it may address an insertion anchor in AIR Patch.
    const after = operation === "insert" && kind !== "rule" ? shell.props.after : null;
    if (operation === "insert" && kind !== "rule") delete shell.props.after;
    const index = findIndex(kind, id);
    const checkExpected = () => {
      for (const [property, value] of Object.entries(expected)) {
        if (!DECLARATION_KEYS[kind].has(property)) fail(`unknown ${kind} precondition property \`${property}\``, shell);
        const actual = declarations[index].props[property];
        const matches = value === "<absent>" ? actual == null : actual === value;
        if (!matches) {
          fail(`patch conflict at ${keyOf(kind, id)}.${property}: expected \`${value}\`, found \`${actual ?? "<absent>"}\``, shell);
        }
      }
    };
    if (operation === "remove") {
      if (index === -1) fail(`cannot remove missing ${keyOf(kind, id)}`, shell);
      checkExpected();
      declarations.splice(index, 1);
    } else if (operation === "set") {
      if (index === -1) fail(`cannot set missing ${keyOf(kind, id)}`, shell);
      checkExpected();
      Object.assign(declarations[index].props, shell.props);
    } else if (operation === "assert") {
      if (index === -1) fail(`cannot assert missing ${keyOf(kind, id)}`, shell);
      for (const [property, value] of Object.entries(shell.props)) {
        const actual = declarations[index].props[property];
        if (actual !== value) fail(`assertion failed at ${keyOf(kind, id)}.${property}: expected \`${value}\`, found \`${actual ?? "<absent>"}\``, shell);
      }
      checkExpected();
    } else if (operation === "upsert") {
      if (index === -1) declarations.push({ kind, id, props: shell.props, line: 0 });
      else Object.assign(declarations[index].props, shell.props);
    } else {
      if (index !== -1) fail(`cannot insert existing ${keyOf(kind, id)}`, shell);
      let insertAt = declarations.length;
      if (after) {
        const afterIndex = findIndex(kind, after);
        if (afterIndex === -1) fail(`insert anchor ${keyOf(kind, after)} does not exist`, shell);
        insertAt = afterIndex + 1;
      }
      declarations.splice(insertAt, 0, { kind, id, props: shell.props, line: 0 });
    }
  });
  const result = serializeDeclarations(declarations);
  parseAir(result, options);
  return result;
}

export function primitiveUsage(model) {
  const source = new Set(model.declarations.map((declaration) => declaration.kind));
  const derived = new Set(["route", "query", "mutation", "validation", "action", "notification"]);
  if (model.capabilities.has("storage.local")) derived.add("persistence");
  if (model.rules.length) derived.add("scheduled-transition");
  if ([...model.management.values()].some((management) => management.lifecycle === "archive")) derived.add("archive-lifecycle");
  if ([...model.access.values()].some((policies) => Object.values(policies).some((policy) => policy.source !== "true"))) derived.add("access-policy");
  if (model.pages.some((page) => page.metrics.some((metric) => metric.op !== "count")) || [...model.entities.values()].some((resource) => resource.fields.some((field) => field.computed))) derived.add("aggregate");
  if (model.highlights.size) derived.add("conditional-presentation");
  if (model.processes.size) {
    derived.add("process-execution");
    derived.add("workflow-action");
  }
  if ([...model.processes.values()].some((process) => process.history)) derived.add("transition-history");
  if (model.deadlines.size) derived.add("deadline-status");
  return { source: [...source].sort(), derived: [...derived].sort(), total: source.size + derived.size };
}

export function semanticSnapshot(input) {
  const model = typeof input === "string" ? parseAir(input) : input;
  return model.declarations.map((declaration) => ({
    kind: declaration.kind,
    id: declaration.id,
    props: Object.fromEntries(Object.entries(declaration.props).sort(([left], [right]) => left.localeCompare(right)))
  }));
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right)));
}

function canonicalPath(path) {
  return path.map((step) => ({ field: step.field, ref: step.ref ?? null }));
}

function canonicalPolicy(policy) {
  const terms = policy.terms.map((term) => {
    if (term.kind === "role") return { kind: "role", role: term.value };
    if (term.kind === "owner") return { kind: "owner", actor: term.actor, path: canonicalPath(term.path) };
    if (term.kind === "self") return { kind: "self", actor: term.actor };
    return { kind: term.kind };
  });
  terms.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return { anyOf: terms };
}

function canonicalConditionTerm(term) {
  if (term.kind === "literal") return {
    kind: "literal", type: term.type, value: term.value,
    currency: term.currency ?? null, ref: term.ref ?? null
  };
  if (term.kind === "parameter") return {
    kind: "parameter", id: term.id, type: term.type,
    value: term.value, currency: term.currency ?? null
  };
  return {
    kind: "path", type: term.type, currency: term.currency ?? null,
    ref: term.ref ?? null,
    path: term.path.map((step) => ({ resource: step.resource, field: step.field, ref: step.ref ?? null, computed: step.computed }))
  };
}

function canonicalConditionOperand(operand) {
  return {
    type: operand.type,
    currency: operand.currency ?? null,
    terms: operand.terms.map(canonicalConditionTerm)
  };
}

function canonicalCondition(condition) {
  if (!condition || condition.source === "true") return { kind: "constant", value: true };
  if (condition.source === "false") return { kind: "constant", value: false };
  const alternatives = condition.alternatives.map((clauses) => clauses.map((clause) => ({
    left: canonicalConditionOperand(clause.left),
    operator: clause.operator,
    right: canonicalConditionOperand(clause.right),
    type: clause.type
  })));
  for (const clauses of alternatives) clauses.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  alternatives.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return { kind: "or", alternatives };
}

function canonicalComputed(computed) {
  if (!computed) return null;
  if (computed.kind === "workflow") return { kind: "workflow" };
  return {
    kind: "aggregate", operation: computed.op, source: computed.source,
    group: computed.group, field: computed.field ?? null,
    where: computed.where ? canonicalCondition(computed.where) : null,
    window: computed.window ?? null, date: computed.date ?? null
  };
}

function canonicalMetric(metric) {
  const where = metric.where?.alternatives
    ? canonicalCondition(metric.where)
    : metric.where ? { kind: "field-equals", field: metric.where.field, value: metric.where.value } : null;
  return {
    id: metric.id, address: metric.address, source: metric.source,
    operation: metric.op, field: metric.field ?? null, group: metric.group ?? null,
    where, label: metric.label, tone: metric.tone, format: metric.format,
    inferred: Boolean(metric.inferred)
  };
}

/** Returns the implementation-independent, fully defaulted AIR Semantic IR. */
export function semanticIr(input) {
  const model = typeof input === "string" ? parseAir(input) : input;
  const resources = [...model.entities.values()].map((resource) => {
    const access = model.access.get(resource.id);
    const page = model.pageMap.get(resource.id);
    return {
      id: resource.id,
      singular: resource.singular,
      plural: resource.plural,
      icon: resource.icon,
      labelField: resource.labelField,
      actor: model.actors.has(resource.id),
      fields: resource.fields.map((field) => ({
        id: field.id, type: field.type, label: field.label,
        required: field.required, unique: field.unique,
        values: [...field.values], ref: field.ref ?? null,
        default: field.default ?? null, min: field.min ?? 0,
        placeholder: field.placeholder, long: field.long,
        currency: field.currency ?? null,
        computed: canonicalComputed(field.computed),
        readOnly: Boolean(field.readOnly)
      })),
      management: resource.management ? {
        create: resource.management.create, edit: resource.management.edit,
        delete: resource.management.delete, lifecycle: resource.management.lifecycle,
        pageSize: resource.management.pageSize ?? (model.theme.density === "compact" ? 12 : 8)
      } : null,
      access: access ? {
        view: canonicalPolicy(access.view), create: canonicalPolicy(access.create),
        edit: canonicalPolicy(access.edit), delete: canonicalPolicy(access.delete),
        archive: canonicalPolicy(access.archive)
      } : null,
      experience: page ? {
        columns: [...page.columns], search: [...page.search], filters: [...page.filters],
        sort: [...page.sort], pageSize: page.pageSize
      } : null,
      highlights: (model.highlights.get(resource.id) ?? []).map((highlight) => ({
        id: highlight.id,
        condition: highlight.when?.alternatives ? canonicalCondition(highlight.when) : null,
        field: highlight.when?.field ?? null,
        value: highlight.when?.value ?? null,
        tone: highlight.tone
      }))
    };
  });
  const parameters = [];
  for (const [resource, entries] of model.parameters) {
    for (const parameter of entries.values()) parameters.push({
      address: `${resource}.${parameter.id}`, resource, id: parameter.id,
      type: scalarType(parameter.value), value: parameter.value, label: parameter.label
    });
  }
  const processes = [...model.processes.values()].map((process) => ({
    resource: process.resource, state: process.state, initial: process.initial,
    states: [...process.states], terminal: sortedUnique([...process.terminal]),
    history: process.history, touch: process.touch ?? null,
    transitions: process.transitions.map((transition) => ({
      id: transition.id, address: transition.address,
      from: sortedUnique(transition.from), to: transition.to,
      action: transition.action, authority: canonicalPolicy(transition.by),
      automatic: transition.automatic, condition: canonicalCondition(transition.when),
      comment: transition.comment, approvals: transition.approvals,
      distinct: transition.distinct,
      separate: transition.separate.map((item) => ({ actor: item.actor, path: canonicalPath(item.path) }))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
      event: transition.event,
      within: transition.within ? { amount: transition.within.amount, unit: transition.within.unit } : null,
      since: transition.since ?? null,
      unlessEvents: sortedUnique(transition.unlessEvents)
    })),
    deadlines: process.deadlines.map((deadline) => ({
      id: deadline.id, state: deadline.state,
      after: { amount: deadline.duration.amount, unit: deadline.duration.unit },
      escalation: deadline.escalation
    }))
  }));
  const dashboard = model.pages.find((page) => page.type === "dashboard");
  return {
    schema: "air.semantic-ir",
    version: 2,
    app: {
      id: model.app.id,
      title: model.app.title,
      subtitle: model.app.subtitle,
      initial: model.app.initial,
      ...(model.app.timezone && model.app.timezone !== "UTC" ? { timezone: model.app.timezone } : {})
    },
    theme: { mode: model.theme.mode, accent: model.theme.accent, density: model.theme.density },
    capabilities: sortedUnique([...model.capabilities]),
    resources,
    parameters,
    rules: model.rules.map((rule) => ({
      id: rule.id, address: rule.address, resource: rule.resource,
      field: rule.field, from: rule.from, to: rule.to, since: rule.since,
      after: { amount: Number.parseInt(rule.duration.source, 10), unit: rule.duration.source.endsWith("d") ? "d" : "h" }
    })),
    invariants: [...model.invariants.entries()].flatMap(([resource, invariants]) => invariants.map((invariant) => ({
      address: invariant.address, resource, id: invariant.id,
      condition: canonicalCondition(invariant.when),
      required: sortedUnique(invariant.required), immutable: sortedUnique(invariant.immutable)
    }))),
    processes,
    overview: dashboard ? {
      title: dashboard.title,
      metrics: dashboard.metrics.map(canonicalMetric),
      lists: dashboard.lists.map((list) => ({
        id: list.id, address: list.address, source: list.source, title: list.title,
        columns: [...list.columns], sort: [...list.sort], limit: list.limit,
        where: list.where
      }))
    } : null,
    extensions: model.extensions.map((extension) => ({ id: extension.id, module: extension.module, slot: extension.slot }))
  };
}

export function canonicalJson(input) {
  return JSON.stringify(semanticIr(input));
}

export function semanticDiff(beforeInput, afterInput) {
  const before = typeof beforeInput === "string" ? parseDeclarations(beforeInput) : beforeInput.declarations;
  const after = typeof afterInput === "string" ? parseDeclarations(afterInput) : afterInput.declarations;
  const key = (declaration) => `${declaration.kind}:${declaration.id ?? ""}`;
  const beforeMap = new Map(before.map((declaration) => [key(declaration), declaration]));
  const afterMap = new Map(after.map((declaration) => [key(declaration), declaration]));
  const changes = [];
  for (const declaration of before) {
    if (!afterMap.has(key(declaration))) changes.push(`- ${serializeDeclarations([declaration]).trim()}`);
  }
  for (const declaration of after) {
    const previous = beforeMap.get(key(declaration));
    if (!previous) {
      changes.push(`+ ${serializeDeclarations([declaration]).trim()}`);
      continue;
    }
    const properties = new Set([...Object.keys(previous.props), ...Object.keys(declaration.props)]);
    for (const property of [...properties].sort()) {
      const oldValue = previous.props[property];
      const newValue = declaration.props[property];
      if (oldValue !== newValue) {
        if (declaration.kind === "parameter" && property === "value") {
          const label = declaration.props.label ?? previous.props.label ?? declaration.id;
          changes.push(`~ parameter ${declaration.id} (${label}): ${oldValue ?? "<absent>"} -> ${newValue ?? "<absent>"}`);
        } else changes.push(`~ ${declaration.kind} ${declaration.id ?? ""}.${property}: ${oldValue ?? "<absent>"} -> ${newValue ?? "<absent>"}`);
      }
    }
  }
  return changes.join("\n") || "No semantic changes.";
}

function describePolicy(policy) {
  if (!policy.terms.length) return "nobody";
  return policy.terms.map((term) => {
    if (term.kind === "system") return "the deterministic runtime";
    if (term.kind === "any") return "any user";
    if (term.kind === "role") return `${term.value} role`;
    if (term.kind === "self") return "the actor's own record";
    return `the linked ${term.actor} in ${term.field}`;
  }).join(" or ");
}

export function explainModel(input) {
  const model = typeof input === "string" ? parseAir(input) : input;
  const lines = [`${model.app.title} (${model.app.id})`];
  for (const resource of model.entities.values()) {
    lines.push(`- ${resource.plural}: ${resource.fields.map((field) => `${field.id}:${field.type}${field.required ? " required" : ""}`).join(", ")}`);
    if (model.actors.has(resource.id)) lines.push(`  Actor identity: ${resource.id}`);
    if (resource.management) lines.push(`  Managed experience: list, detail, create, edit, ${resource.management.lifecycle}, validation, search, filter, sort, pagination, responsive and accessible states`);
    const access = model.access.get(resource.id);
    if (access) lines.push(`  Access: ${Object.entries(access).map(([action, policy]) => `${action} by ${describePolicy(policy)}`).join("; ")}`);
    for (const field of resource.fields.filter((candidate) => candidate.computed)) {
      if (field.computed.kind === "workflow") lines.push(`  Computed ${field.label}: derived from the active process deadline`);
      else lines.push(`  Computed ${field.label}: ${field.computed.op} ${field.computed.source} grouped by ${field.computed.group}${field.computed.where ? ` where ${field.computed.where.source}` : ""}${field.computed.window ? ` in the current ${field.computed.window}` : ""}`);
    }
    for (const highlight of model.highlights.get(resource.id) ?? []) lines.push(`  Highlight ${highlight.id}: ${highlight.when.field ? `${highlight.when.field}=${highlight.when.value}` : highlight.when.source} as ${highlight.tone}`);
  }
  for (const rule of model.rules) lines.push(`- Rule ${rule.address}: ${rule.field} changes ${rule.from} -> ${rule.to} after ${rule.duration.source} from ${rule.since}`);
  for (const [resourceId, parameters] of model.parameters) {
    for (const parameter of parameters.values()) lines.push(`- Parameter ${parameter.label} (${resourceId}.${parameter.id}): ${parameter.source}`);
  }
  for (const process of model.processes.values()) {
    lines.push(`- Process ${process.resource}: ${process.state} begins ${process.initial}; terminal ${[...process.terminal].join(", ")}; ${process.history ? "immutable transition history enabled" : "history disabled"}`);
    for (const transition of process.transitions) {
      const authority = describePolicy(transition.by);
      const condition = transition.when.source === "true" ? "" : ` when ${transition.when.source}`;
      const approval = transition.approvals > 1 ? ` after ${transition.approvals} ${transition.distinct ? "distinct " : ""}actors` : "";
      const separation = transition.separate.length ? `; actor must differ from ${transition.separate.map((item) => item.source).join(", ")}` : "";
      lines.push(`  ${transition.from.join(" or ")} -> ${transition.to}: ${transition.automatic ? "automatic" : `action ${transition.action} by ${authority}`}${condition}${approval}${separation}; emits ${transition.event}`);
    }
    for (const invariant of process.invariants) {
      const effects = [
        invariant.required?.length ? `requires ${invariant.required.join(", ")}` : "",
        invariant.immutable?.length ? `locks ${invariant.immutable.join(", ")}` : "",
        invariant.none ? `forbids overlap with ${invariant.none}` : "",
        invariant.deny ? `denies: ${invariant.deny}` : ""
      ].filter(Boolean).join(" and ");
      lines.push(`  Invariant ${invariant.id}: ${effects}${invariant.when ? ` when ${invariant.when.source}` : ""}`);
    }
    for (const deadline of process.deadlines) lines.push(`  Deadline ${deadline.state}: ${deadline.duration.source}; escalation ${deadline.escalation}`);
  }
  for (const page of model.pages.filter((candidate) => candidate.type === "dashboard")) {
    for (const metric of page.metrics.filter((candidate) => !candidate.inferred)) lines.push(`- Insight ${metric.address}: ${metric.op} ${metric.source}.${metric.field ?? "records"}`);
  }
  return lines.join("\n");
}

function toIntervalBounds(input) {
  if (!input) return null;
  let start = null;
  let end = null;
  if (Array.isArray(input)) {
    start = input[0];
    end = input[1];
  } else if (typeof input === "object") {
    start = input.start ?? input.start_at ?? input.from;
    end = input.end ?? input.end_at ?? input.to;
  }
  if (start == null || end == null) return null;
  if (typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) &&
      typeof end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    if (start === end) {
      const d = new Date(`${start}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      const nextDay = d.toISOString().slice(0, 10);
      return { start, end: nextDay };
    }
  }
  return { start, end };
}

function normalizeInstantToIso(val) {
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return `${val}T00:00:00.000Z`;
  }
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export function clipInterval(interval, window) {
  const bI = toIntervalBounds(interval);
  const bW = toIntervalBounds(window);
  if (!bI || !bW) return null;
  const iStart = normalizeInstantToIso(bI.start);
  const iEnd = normalizeInstantToIso(bI.end);
  const wStart = normalizeInstantToIso(bW.start);
  const wEnd = normalizeInstantToIso(bW.end);

  const start = iStart > wStart ? iStart : wStart;
  const end = iEnd < wEnd ? iEnd : wEnd;
  if (start >= end) return null;
  return { start, end };
}

export function intervalUnion(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];
  const validBounds = intervals
    .map((iv) => {
      const b = toIntervalBounds(iv);
      if (!b || !b.start || !b.end) return null;
      const start = normalizeInstantToIso(b.start);
      const end = normalizeInstantToIso(b.end);
      if (start >= end) return null;
      return { start, end };
    })
    .filter(Boolean);

  if (validBounds.length === 0) return [];

  validBounds.sort((a, b) => {
    const sCmp = a.start.localeCompare(b.start);
    if (sCmp !== 0) return sCmp;
    return a.end.localeCompare(b.end);
  });

  const merged = [validBounds[0]];
  for (let i = 1; i < validBounds.length; i++) {
    const curr = validBounds[i];
    const prev = merged[merged.length - 1];
    if (curr.start <= prev.end) {
      if (curr.end > prev.end) {
        prev.end = curr.end;
      }
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

export function computeUtilization(records, intervalFieldOrPath, windowStart, windowEnd) {
  const windowDur = subtractInstants(windowEnd, windowStart);
  if (!windowDur || windowDur.ms <= 0) return new UtilizationRatio(0, 1);

  const window = { start: windowStart, end: windowEnd };
  const clippedIntervals = [];

  for (const record of records) {
    if (record._archived_at) continue;
    let rawInterval = null;
    if (typeof intervalFieldOrPath === "function") {
      rawInterval = intervalFieldOrPath(record);
    } else if (typeof intervalFieldOrPath === "string") {
      if (intervalFieldOrPath.endsWith(".duration")) {
        const fieldName = intervalFieldOrPath.replace(/\.duration$/, "");
        rawInterval = record[fieldName];
      } else {
        rawInterval = record[intervalFieldOrPath];
      }
    }
    if (!rawInterval) {
      if (record.start_at && record.end_at) {
        rawInterval = { start: record.start_at, end: record.end_at };
      }
    }
    if (rawInterval) {
      const clipped = clipInterval(rawInterval, window);
      if (clipped) clippedIntervals.push(clipped);
    }
  }

  const union = intervalUnion(clippedIntervals);
  let occupiedMs = 0;
  for (const iv of union) {
    const dur = subtractInstants(iv.end, iv.start);
    if (dur && dur.ms > 0) {
      occupiedMs += dur.ms;
    }
  }

  return new UtilizationRatio(occupiedMs, windowDur.ms);
}

export function correlateEventDurations(historyOrEvents, fromEventOrState, toEventOrState) {
  if (!Array.isArray(historyOrEvents) || historyOrEvents.length === 0) return null;
  const history = [...historyOrEvents].sort((a, b) => (a.at || "").localeCompare(b.at || ""));

  const fromEntry = history.find((entry) => 
    entry.event === fromEventOrState || 
    entry.to === fromEventOrState || 
    entry.action === fromEventOrState ||
    (fromEventOrState === "created" && (entry.event === "created" || entry.action === "create"))
  );
  if (!fromEntry || !fromEntry.at) return null;

  const fromIdx = history.indexOf(fromEntry);
  const toEntry = history.slice(fromIdx + 1).find((entry) =>
    entry.event === toEventOrState ||
    entry.to === toEventOrState ||
    entry.action === toEventOrState
  );
  if (!toEntry || !toEntry.at) return null;

  return subtractInstants(toEntry.at, fromEntry.at);
}

export function getIntervalDuration(interval) {
  if (!interval) return null;
  if (interval instanceof Duration) return interval;
  const b = toIntervalBounds(interval);
  if (b && b.start && b.end) {
    return subtractInstants(b.end, b.start);
  }
  return null;
}

export function intervalsOverlap(a, b) {
  const bA = toIntervalBounds(a);
  const bB = toIntervalBounds(b);
  if (!bA || !bB) return false;
  return bA.start < bB.end && bA.end > bB.start;
}

export function intervalContains(a, b) {
  const bA = toIntervalBounds(a);
  const bB = toIntervalBounds(b);
  if (!bA || !bB) return false;
  return bA.start <= bB.start && bA.end >= bB.end;
}

export function intervalContainedBy(a, b) {
  return intervalContains(b, a);
}

export function intervalBefore(a, b) {
  const bA = toIntervalBounds(a);
  const bB = toIntervalBounds(b);
  if (!bA || !bB) return false;
  return bA.end <= bB.start;
}

export function intervalAfter(a, b) {
  const bA = toIntervalBounds(a);
  const bB = toIntervalBounds(b);
  if (!bA || !bB) return false;
  return bA.start >= bB.end;
}

export function intervalTouches(a, b) {
  const bA = toIntervalBounds(a);
  const bB = toIntervalBounds(b);
  if (!bA || !bB) return false;
  return bA.end === bB.start || bB.end === bA.start;
}

export function duration(startOrInterval, end = null, unit = "h") {
  let s = startOrInterval;
  let e = end;
  let u = unit;
  if (typeof startOrInterval === "object" && startOrInterval !== null && end === null) {
    s = startOrInterval.start ?? startOrInterval.start_at ?? startOrInterval.from;
    e = startOrInterval.end ?? startOrInterval.end_at ?? startOrInterval.to;
  } else if (typeof end === "string" && ["h", "d", "m", "s", "hours", "days", "minutes", "seconds"].includes(end)) {
    u = end;
    if (typeof startOrInterval === "object" && startOrInterval !== null) {
      s = startOrInterval.start ?? startOrInterval.start_at ?? startOrInterval.from;
      e = startOrInterval.end ?? startOrInterval.end_at ?? startOrInterval.to;
    }
  }
  if (s == null || e == null) return 0;
  const t1 = typeof s === "number" ? s : Date.parse(String(s).includes("T") ? s : `${s}T00:00:00Z`);
  const t2 = typeof e === "number" ? e : Date.parse(String(e).includes("T") ? e : `${e}T00:00:00Z`);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0;
  const ms = t2 - t1;
  if (u === "d" || u === "days") return ms / 86_400_000;
  if (u === "h" || u === "hours") return ms / 3_600_000;
  if (u === "m" || u === "minutes") return ms / 60_000;
  if (u === "s" || u === "seconds") return ms / 1_000;
  return ms;
}

export function workflowDiagram(input) {
  const model = typeof input === "string" ? parseAir(input) : input;
  const lines = ["flowchart TD"];
  const node = (resource, state) => `${resource}_${state}`.replace(/[^A-Za-z0-9_]/g, "_");
  for (const process of model.processes.values()) {
    for (const state of process.states) lines.push(`  ${node(process.resource, state)}["${state}"]`);
    for (const transition of process.transitions) {
      const label = [transition.automatic ? "automatic" : transition.action, transition.when.source === "true" ? "" : transition.when.source, transition.approvals > 1 ? `${transition.approvals}${transition.distinct ? " distinct" : ""}` : ""].filter(Boolean).join(" · ").replaceAll('"', "'");
      for (const from of transition.from) lines.push(`  ${node(process.resource, from)} -->|"${label}"| ${node(process.resource, transition.to)}`);
    }
    for (const terminal of process.terminal) lines.push(`  ${node(process.resource, terminal)}:::terminal`);
  }
  if (!model.processes.size) lines.push("  none[\"No declared processes\"]");
  lines.push("  classDef terminal stroke-width:3px");
  return lines.join("\n");
}
