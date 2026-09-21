export const AIR_VERSION = 2;
export { compilePresentation, serializePresentationIr, EXPERIENCE_REGISTRY, PRESENTATION_IR_VERSION } from "./presentation.mjs";
export { FAILURE_CATEGORIES, AdapterError, SchemaMapping, validateIdentifier, DataAdapter, MemoryDataAdapter, SqliteDataAdapter, PostgresDataAdapter } from "./data.mjs";
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




const DECLARATION_KEYS = Object.freeze({
  air: new Set(["version"]),
  app: new Set(["title", "subtitle", "initial"]),
  theme: new Set(["mode", "accent", "density"]),
  capability: new Set(),
  resource: new Set(["singular", "plural", "icon", "label"]),
  actor: new Set(),
  field: new Set([
    "type", "label", "required", "unique", "values", "ref", "default",
    "min", "placeholder", "long", "currency"
  ]),
  manage: new Set(["create", "edit", "delete", "lifecycle", "page_size"]),
  access: new Set(["view", "create", "edit", "delete", "archive"]),
  overview: new Set(["title"]),
  insight: new Set(["op", "field", "source", "group", "where", "window", "date", "label", "tone"]),
  rule: new Set(["field", "from", "to", "after", "since"]),
  highlight: new Set(["when", "tone"]),
  parameter: new Set(["value", "label"]),
  process: new Set(["state", "initial", "terminal", "history", "touch"]),
  transition: new Set([
    "from", "to", "action", "by", "when", "automatic", "comment",
    "approvals", "distinct", "separate", "event", "within", "since", "unless_event"
  ]),
  invariant: new Set(["when", "require", "immutable"]),
  deadline: new Set(["state", "after", "escalation"]),
  extension: new Set(["module", "slot"]),
  experience: new Set(["actor", "identity", "title", "subtitle", "authority", "registration", "verification", "reset", "switch_user", "profile", "security", "sessions"])
});

const ID_KINDS = new Set([
  "app", "capability", "resource", "actor", "field", "manage", "access",
  "insight", "rule", "highlight", "parameter", "process", "transition",
  "invariant", "deadline", "extension", "experience"
]);
const SINGLETON_KINDS = new Set(["air", "theme", "overview"]);
const FIELD_TYPES = new Set(["text", "email", "phone", "enum", "date", "ref", "number", "money", "bool"]);
const SEARCHABLE_TYPES = new Set(["text", "email", "phone"]);
const FILTERABLE_TYPES = new Set(["enum", "ref", "bool"]);
const NUMERIC_TYPES = new Set(["number", "money"]);
const ACCENTS = new Set(["violet", "blue", "emerald", "rose", "amber"]);
const MODES = new Set(["light", "dark", "system"]);
const DENSITIES = new Set(["compact", "comfortable"]);
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
  if (raw === true || !/^\d+$/.test(raw) || Number(raw) < minimum) fail(`property \`${key}\` expects an integer >= ${minimum}`, declaration);
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

function parseDuration(raw, declaration) {
  const match = /^(\d+)(d|h)$/.exec(raw ?? "");
  if (!match || Number(match[1]) < 1) fail("rule after expects a positive duration such as 30d or 12h", declaration);
  return { source: raw, milliseconds: Number(match[1]) * (match[2] === "d" ? 86_400_000 : 3_600_000) };
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
  return type === "number" || type === "money";
}

function conditionOperandType(terms, declaration, source) {
  if (terms.length === 1) return { type: terms[0].type, currency: terms[0].currency ?? null };
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
  const parts = raw.split("+");
  if (parts.some((part) => !part)) fail(`invalid condition operand \`${raw}\``, declaration);
  const terms = parts.map((part) => {
    if (part.startsWith("@")) {
      const parameter = model.parameters.get(resource.id)?.get(part.slice(1));
      if (!parameter) fail(`condition references unknown parameter \`${resource.id}.${part.slice(1)}\``, declaration, {
        code: "AIR_REF_UNKNOWN_PARAMETER", phase: "resolve"
      });
      return { kind: "parameter", id: parameter.id, value: parameter.value, type: scalarType(parameter.value), currency: null };
    }
    const scalar = parseValue(part);
    if (typeof scalar !== "string" || scalar !== part) return { kind: "literal", value: scalar, type: scalarType(scalar), currency: null };
    const segments = part.split(".");
    let current = resource;
    const path = [];
    for (let index = 0; index < segments.length; index += 1) {
      const field = current?.fieldMap.get(segments[index]);
      if (!field) {
        if (side === "right" && parts.length === 1 && index === 0) return { kind: "literal", value: part, type: "text", currency: null };
        fail(`condition references unknown field \`${current?.id ?? resource.id}.${segments[index]}\``, declaration, {
          code: "AIR_REF_UNKNOWN_FIELD", phase: "resolve"
        });
      }
      path.push({ field: field.id, resource: current.id, ref: field.ref, computed: Boolean(field.computed) });
      if (index < segments.length - 1) {
        if (field.type !== "ref") fail(`condition path \`${part}\` crosses non-reference field \`${field.address}\``, declaration);
        current = model.entities.get(field.ref);
      }
    }
    const finalField = current.fieldMap.get(segments.at(-1));
    return { kind: "path", source: part, path, type: finalField.type, currency: finalField.currency ?? null, ref: finalField.ref ?? null, values: finalField.values ?? [] };
  });
  return { source: raw, terms, ...conditionOperandType(terms, declaration, raw) };
}

function promoteTextLiteral(operand, other, declaration) {
  if (operand.terms.length !== 1 || operand.terms[0].kind !== "literal" || operand.type !== "text") return;
  const term = operand.terms[0];
  if (!new Set(["text", "email", "phone", "enum", "date", "ref"]).has(other.type)) return;
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
  promoteTextLiteral(clause.left, clause.right, declaration);
  promoteTextLiteral(clause.right, clause.left, declaration);
  const left = clause.left;
  const right = clause.right;
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
  const stringCompatible = same && new Set(["text", "email", "phone", "enum", "ref"]).has(left.type);
  const equality = clause.operator === "==" || clause.operator === "!=";
  if ((equality && (same || stringCompatible)) || (same && left.type === "date")) {
    if (left.type === "ref") {
      const leftRef = left.terms[0]?.ref;
      const rightRef = right.terms[0]?.ref;
      if (leftRef && rightRef && leftRef !== rightRef) {
        fail("condition compares references to different resources", declaration, {
          code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
        });
      }
    }
    if (!equality && left.type !== "date") {
      fail(`condition operator \`${clause.operator}\` requires numeric or date operands`, declaration, {
        code: "AIR_TYPE_CONDITION_MISMATCH", phase: "type"
      });
    }
    clause.type = left.type;
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

export function parseAir(source, options = {}) {
  const declarations = parseDeclarations(source);
  const model = {
    version: null, app: null,
    theme: { mode: "system", accent: "violet", density: "comfortable" },
    capabilities: new Set(), entities: new Map(), resources: null,
    actors: new Set(), management: new Map(), access: new Map(),
    parameters: new Map(), processes: new Map(), transitions: new Map(),
    invariants: new Map(), deadlines: new Map(),
    rules: [], highlights: new Map(), pages: [], pageMap: new Map(),
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
          initial: stringProperty(declaration, "initial", null)
        };
        break;
      case "theme": {
        const mode = stringProperty(declaration, "mode", "system");
        const accent = stringProperty(declaration, "accent", "violet");
        const density = stringProperty(declaration, "density", "comfortable");
        if (!MODES.has(mode)) fail(`unknown theme mode \`${mode}\``, declaration);
        if (!ACCENTS.has(accent)) fail(`unknown accent \`${accent}\``, declaration);
        if (!DENSITIES.has(density)) fail(`unknown density \`${density}\``, declaration);
        model.theme = { mode, accent, density };
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
      case "process": case "transition": case "invariant": case "deadline": case "extension":
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
    const field = {
      id: fieldId, address: declaration.id, type,
      label: stringProperty(declaration, "label", titleCase(fieldId)),
      required: booleanProperty(declaration, "required"),
      unique: booleanProperty(declaration, "unique"),
      values: listProperty(declaration, "values"), options: [],
      ref: stringProperty(declaration, "ref", null),
      default: stringProperty(declaration, "default", null),
      min: integerProperty(declaration, "min", 0, 0),
      placeholder: stringProperty(declaration, "placeholder", ""),
      long: booleanProperty(declaration, "long"),
      currency: stringProperty(declaration, "currency", null)
    };
    field.options = field.values;
    if (type === "enum" && !field.values.length) fail(`enum field \`${declaration.id}\` requires values`, declaration);
    if (type !== "enum" && field.values.length) fail("only enum fields accept values=...", declaration);
    if (type === "ref" && !field.ref) fail(`reference field \`${declaration.id}\` requires ref=resource`, declaration);
    if (type !== "ref" && field.ref) fail("only ref fields accept ref=...", declaration);
    if (field.ref && !model.entities.has(field.ref)) fail(`unknown referenced resource \`${field.ref}\``, declaration);
    if (type === "money" && !field.currency) fail(`money field \`${declaration.id}\` requires currency=...`, declaration);
    if (field.currency && !/^[A-Z]{3}$/.test(field.currency)) fail("currency expects a three-letter uppercase ISO code", declaration);
    if (type !== "money" && field.currency) fail("only money fields accept currency=...", declaration);
    if (field.long && type !== "text") fail("only text fields accept `long`", declaration);
    insertUnique(resource.fieldMap, field.id, field, declaration);
    resource.fields.push(field);
  }

  for (const resource of model.entities.values()) {
    if (!resource.fields.length) fail(`resource \`${resource.id}\` has no fields`);
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
      when: parsePredicate(requireProperty(declaration, "when"), declaration, resource, "highlight when"),
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

  for (const declaration of declarations.filter((item) => item.kind === "insight" && item.props.source != null)) {
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
    if (!new Set(["count", "sum", "average"]).has(op)) fail(`unsupported grouped insight operation \`${op}\``, declaration);
    const aggregateFieldId = stringProperty(declaration, "field", null);
    const aggregateField = aggregateFieldId ? source.fieldMap.get(aggregateFieldId) : null;
    if (op !== "count" && (!aggregateField || !NUMERIC_TYPES.has(aggregateField.type))) {
      fail(`${op} grouped insight requires a numeric field on ${sourceId}`, declaration);
    }
    const whereRaw = stringProperty(declaration, "where", null);
    const where = whereRaw ? parseCondition(whereRaw, declaration, source, model, "insight where") : null;
    const window = stringProperty(declaration, "window", null);
    const dateId = stringProperty(declaration, "date", null);
    if (window && window !== "month") fail("insight window currently supports only month", declaration);
    if (window && (!dateId || source.fieldMap.get(dateId)?.type !== "date")) fail("windowed insight requires date=<date-field>", declaration);
    if (!window && dateId) fail("insight date requires window=month", declaration);
    const field = {
      id: insightId, address: declaration.id,
      type: aggregateField?.type === "money" ? "money" : "number",
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

  for (const declaration of declarations.filter((item) => item.kind === "invariant")) {
    const [resourceId, invariantId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`invariant owner \`${resourceId}\` is not a resource`, declaration);
    const required = listProperty(declaration, "require");
    const immutable = listProperty(declaration, "immutable");
    if (!required.length && !immutable.length) fail("invariant requires require=... or immutable=...", declaration);
    for (const fieldId of [...required, ...immutable.filter((fieldId) => fieldId !== "*")]) {
      const field = resource.fieldMap.get(fieldId);
      if (!field || field.computed) fail(`invariant references unknown stored field \`${resourceId}.${fieldId}\``, declaration);
    }
    const invariant = {
      id: invariantId, address: declaration.id, resource: resourceId,
      when: parseCondition(requireProperty(declaration, "when"), declaration, resource, model, "invariant when"),
      required, immutable
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

  for (const declaration of declarations.filter((item) => item.kind === "insight")) {
    if (declaration.props.source != null) continue;
    if (!overviewDeclaration) fail("insight requires an `overview` declaration", declaration);
    const [resourceId, insightId] = splitOwnedId(declaration);
    const resource = model.entities.get(resourceId);
    if (!resource) fail(`insight owner \`${resourceId}\` is not a resource`, declaration);
    const op = stringProperty(declaration, "op", "sum");
    if (!new Set(["count", "sum", "average"]).has(op)) fail(`unsupported insight operation \`${op}\``, declaration);
    const fieldId = stringProperty(declaration, "field", null);
    const field = fieldId ? resource.fieldMap.get(fieldId) : null;
    if (fieldId && !field) fail(`insight references unknown field \`${resourceId}.${fieldId}\``, declaration);
    if (op !== "count" && (!field || !NUMERIC_TYPES.has(field.type))) fail(`${op} insight requires a number or money field`, declaration);
    const groupId = stringProperty(declaration, "group", null);
    const group = groupId ? resource.fieldMap.get(groupId) : null;
    if (groupId && (!group || !new Set(["enum", "ref", "bool"]).has(group.type))) fail("overview insight group requires an enum, ref, or bool field", declaration);
    const whereRaw = stringProperty(declaration, "where", null);
    const page = model.pageMap.get("overview");
    page.metrics.push({
      id: insightId, address: declaration.id, source: resourceId, op, field: fieldId,
      label: stringProperty(declaration, "label", field ? `${titleCase(op)} ${field.label.toLowerCase()}` : `${titleCase(op)} ${resource.plural.toLowerCase()}`),
      where: whereRaw ? parseCondition(whereRaw, declaration, resource, model, "insight where") : null,
      group: groupId, tone: stringProperty(declaration, "tone", toneAt(page.metrics.length)),
      format: groupId ? "breakdown" : field?.type === "money" ? "money" : "number", inferred: false
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
  return model;
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
  if (NUMERIC_TYPES.has(field.type) && !Number.isFinite(Number(value))) return `${field.label} must be a number`;
  if (field.type === "bool" && typeof value !== "boolean") return `${field.label} must be true or false`;
  if (field.type === "ref" && !model.entities.has(field.ref)) return `${field.label} references an unknown resource`;
  if (field.unique && records?.some((record) => record.id !== currentId && String(record[field.id] ?? "").toLowerCase() === text.toLowerCase())) return `${field.label} must be unique`;
  return null;
}

function normalizeInput(field, value, clock) {
  if (value == null || value === "") {
    if (field.default === "today") return clock().toISOString().slice(0, 10);
    if (field.default != null) {
      if (NUMERIC_TYPES.has(field.type)) return Number(field.default);
      if (field.type === "bool") return field.default === "true";
      return field.default;
    }
    return field.type === "bool" ? false : "";
  }
  if (NUMERIC_TYPES.has(field.type)) return Number(value);
  if (field.type === "bool") return value === true || value === "true";
  return typeof value === "string" ? value.trim() : value;
}

function normalizeRecord(resource, raw, clock, context) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AirError(`${context} must be an object`);
  if (typeof raw.id !== "string" || !raw.id) throw new AirError(`${context} requires a string ID`);
  const storedFields = resource.fields.filter((field) => !field.computed);
  const allowed = new Set(["id", "_archived_at", "_air_history", ...storedFields.map((field) => field.id)]);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) throw new AirError(`${context} has unknown field \`${key}\``);
  const record = { id: raw.id };
  for (const field of storedFields) record[field.id] = normalizeInput(field, raw[field.id], clock);
  if (raw._archived_at) record._archived_at = raw._archived_at;
  if (raw._air_history != null) {
    if (!Array.isArray(raw._air_history) || raw._air_history.some((entry) => !entry || typeof entry !== "object" || typeof entry.event !== "string" || typeof entry.at !== "string")) {
      throw new AirError(`${context} has invalid workflow history`);
    }
    record._air_history = structuredClone(raw._air_history);
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
    this.idFactory = options.idFactory ?? ((resourceId) => `${resourceId.slice(0, 3)}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`);
    this.storage = model.capabilities.has("storage.local") ? (options.storage ?? new MemoryStorage()) : new MemoryStorage();
    this.principal = options.principal ?? { roles: [] };
    this.dataAdapters = options.dataAdapters instanceof Map
      ? options.dataAdapters
      : (options.dataAdapter ? new Map([["*", options.dataAdapter]]) : new Map());
    this.capabilityEngine = options.capabilityEngine ?? null;
    this.seedData = options.seedData instanceof Map ? options.seedData : parseSeedData(options.seedData ?? {}, model, { clock: this.clock });
    this.data = new Map();
    this.load();
  }

  adapter(resourceId) {
    return this.dataAdapters.get(resourceId) ?? this.dataAdapters.get("*") ?? null;
  }

  key(resourceId) { return `air:${this.model.app.id}:${resourceId}:v${this.model.version}`; }

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
    this.reconcile();
  }

  reset() {
    for (const resource of this.model.entities.values()) {
      this.storage.removeItem(this.key(resource.id));
      this.data.set(resource.id, structuredClone(this.seedData.get(resource.id) ?? []));
    }
    this.reconcile();
  }

  records(resourceId) {
    const records = this.data.get(resourceId);
    if (!records) throw new AirError(`unknown resource \`${resourceId}\``);
    return records;
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
      const field = resource.fieldMap.get(step.field);
      const value = field.computed ? this.computedValue(field, current, currentResourceId) : current?.[step.field];
      if (index === path.length - 1) return value;
      if (isBlank(value)) return null;
      currentResourceId = field.ref;
      current = this.records(currentResourceId).find((candidate) => candidate.id === value);
      if (!current) return null;
    }
    return null;
  }

  conditionOperand(resourceId, record, operand) {
    const values = operand.terms.map((term) => {
      if (term.kind === "literal" || term.kind === "parameter") return term.value;
      return this.resolveConditionPath(resourceId, record, term.path);
    });
    if (values.some((value) => isBlank(value))) return MISSING;
    if (values.length === 1) return values[0];
    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return MISSING;
    return values.reduce((total, value) => total + value, 0);
  }

  evaluateCondition(condition, resourceId, record) {
    if (!condition || condition.source === "true") return true;
    if (condition.source === "false") return false;
    return condition.alternatives.some((clauses) => clauses.every((clause) => {
      const left = this.conditionOperand(resourceId, record, clause.left);
      const right = this.conditionOperand(resourceId, record, clause.right);
      if (left === MISSING || right === MISSING) return false;
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
    for (const invariant of this.model.invariants.get(resourceId) ?? []) {
      if (!this.evaluateCondition(invariant.when, resourceId, values)) continue;
      for (const fieldId of invariant.required) {
        if (isBlank(values[fieldId])) errors[fieldId] = `${resource.fieldMap.get(fieldId).label} is required by ${invariant.id}`;
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

  commit(resourceId, records) {
    this.storage.setItem(this.key(resourceId), JSON.stringify(records));
    this.data.set(resourceId, records);
    const adapter = this.adapter(resourceId);
    if (adapter && typeof adapter.syncFromRuntime === "function") {
      adapter.syncFromRuntime(resourceId, records);
    }
  }

  create(resourceId, values) {
    const { record, errors } = this.prepare(resourceId, values);
    if (!record) return { record: null, errors };
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
    this.commit(resourceId, [...this.records(resourceId), stabilized]);
    this.reconcile();
    return { record: structuredClone(this.records(resourceId).find((item) => item.id === record.id)), errors, events };
  }

  update(resourceId, id, values) {
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
    this.commit(resourceId, this.records(resourceId).map((item) => item.id === id ? record : item));
    this.reconcile();
    return { record: structuredClone(this.records(resourceId).find((item) => item.id === id)), errors };
  }

  delete(resourceId, id) {
    const records = this.records(resourceId);
    const target = records.find((record) => record.id === id);
    if (!target) throw new AirError(`unknown record \`${resourceId}.${id}\``);
    const management = this.model.management.get(resourceId);
    this.assertCan(resourceId, management.lifecycle === "archive" ? "archive" : "delete", target);
    if (management.lifecycle === "archive") {
      this.commit(resourceId, records.map((record) => record.id === id ? { ...record, _archived_at: this.clock().toISOString() } : record));
      return { archived: true };
    }
    for (const resource of this.model.entities.values()) {
      for (const field of resource.fields.filter((candidate) => candidate.type === "ref" && candidate.ref === resourceId)) {
        if (this.records(resource.id).some((record) => !record._archived_at && record[field.id] === id)) throw new AirError(`cannot delete: ${resource.plural} still reference this record`);
      }
    }
    this.commit(resourceId, records.filter((record) => record.id !== id));
    return { archived: false };
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
    this.commit(resourceId, this.records(resourceId).map((candidate) => candidate.id === id ? record : candidate));
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

  computedValue(field, ownerRecord, ownerResourceId = null) {
    const definition = field.computed;
    if (definition.kind === "workflow") return this.workflowStatus(ownerResourceId, ownerRecord)?.status ?? "";
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
    const values = records.map((record) => Number(record[definition.field])).filter(Number.isFinite);
    if (definition.op === "sum") return values.reduce((total, value) => total + value, 0);
    if (definition.op === "average") return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
    throw new AirError(`unknown computed operation \`${definition.op}\``);
  }

  enrichRecord(resourceId, record) {
    const resource = this.model.entities.get(resourceId);
    if (!resource) throw new AirError(`unknown resource \`${resourceId}\``);
    const enriched = structuredClone(record);
    for (const field of resource.fields.filter((candidate) => candidate.computed)) enriched[field.id] = this.computedValue(field, record, resourceId);
    return enriched;
  }

  get(resourceId, id, options = {}) {
    const record = this.records(resourceId).find((candidate) => candidate.id === id);
    if (!record || (!options.includeArchived && record._archived_at) || !this.can(resourceId, "view", record)) return null;
    return this.enrichRecord(resourceId, record);
  }

  highlight(resourceId, record) {
    return (this.model.highlights.get(resourceId) ?? [])
      .find((item) => String(record[item.when.field] ?? "") === item.when.value)?.tone ?? null;
  }

  metric(metric) {
    let records = this.query(metric.source, { paginate: false }).records;
    if (metric.where) {
      records = metric.where.alternatives
        ? records.filter((record) => this.evaluateCondition(metric.where, metric.source, record))
        : records.filter((record) => String(record[metric.where.field] ?? "") === metric.where.value);
    }
    const aggregate = (items) => {
      if (metric.op === "count") return items.length;
      const values = items.map((record) => Number(record[metric.field])).filter(Number.isFinite);
      if (metric.op === "sum") return values.reduce((total, value) => total + value, 0);
      if (metric.op === "average") return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
      throw new AirError(`unknown metric operation \`${metric.op}\``);
    };
    if (metric.group) {
      const groups = new Map();
      for (const record of records) {
        const key = this.displayValue(metric.source, metric.group, record[metric.group]);
        const values = groups.get(key) ?? [];
        values.push(record);
        groups.set(key, values);
      }
      return Object.fromEntries([...groups].sort(([left], [right]) => left.localeCompare(right)).map(([key, values]) => [key, aggregate(values)]));
    }
    return aggregate(records);
  }

  formatMetric(metric, value) {
    if (metric.format === "breakdown") return Object.entries(value).map(([key, count]) => `${key} ${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(count)}`).join(" · ") || "—";
    if (metric.format === "money") {
      const field = this.model.entities.get(metric.source).fieldMap.get(metric.field);
      return new Intl.NumberFormat("en", { style: "currency", currency: field.currency, maximumFractionDigits: 0 }).format(value);
    }
    return new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
  }

  displayValue(resourceId, fieldId, value) {
    if (isBlank(value)) return "—";
    const field = this.model.entities.get(resourceId)?.fieldMap.get(fieldId);
    if (!field) return String(value);
    if (field.type === "ref") {
      const target = this.model.entities.get(field.ref);
      const record = this.records(field.ref).find((item) => item.id === value);
      if (!record) return "Missing record";
      if (this.model.management.has(field.ref) && !this.can(field.ref, "view", record)) return "Restricted record";
      return String(record[target.labelField] ?? record.id);
    }
    if (field.type === "bool") return value ? "Yes" : "No";
    if (field.type === "money") return new Intl.NumberFormat("en", { style: "currency", currency: field.currency }).format(value);
    if (field.type === "date") {
      const date = new Date(`${value}T00:00:00Z`);
      if (!Number.isNaN(date.valueOf())) return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
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
        default: field.default ?? null, min: field.min,
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
        id: highlight.id, field: highlight.when.field, value: highlight.when.value, tone: highlight.tone
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
    app: { id: model.app.id, title: model.app.title, subtitle: model.app.subtitle, initial: model.app.initial },
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
    for (const highlight of model.highlights.get(resource.id) ?? []) lines.push(`  Highlight ${highlight.id}: ${highlight.when.field}=${highlight.when.value} as ${highlight.tone}`);
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
      const effects = [invariant.required.length ? `requires ${invariant.required.join(", ")}` : "", invariant.immutable.length ? `locks ${invariant.immutable.join(", ")}` : ""].filter(Boolean).join(" and ");
      lines.push(`  Invariant ${invariant.id}: ${effects} when ${invariant.when.source}`);
    }
    for (const deadline of process.deadlines) lines.push(`  Deadline ${deadline.state}: ${deadline.duration.source}; escalation ${deadline.escalation}`);
  }
  for (const page of model.pages.filter((candidate) => candidate.type === "dashboard")) {
    for (const metric of page.metrics.filter((candidate) => !candidate.inferred)) lines.push(`- Insight ${metric.address}: ${metric.op} ${metric.source}.${metric.field ?? "records"}`);
  }
  return lines.join("\n");
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
