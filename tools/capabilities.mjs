import { tokenizeLine } from "../web/runtime/air.mjs";

const STOP_WORDS = new Set(["a", "an", "and", "are", "be", "can", "for", "have", "instead", "of", "only", "should", "the", "their", "to", "with"]);

function terms(value) {
  return String(value).toLowerCase().split(/[^a-z0-9_]+/).filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function parseProperties(tokens) {
  return Object.fromEntries(tokens.map((token) => {
    const at = token.indexOf("=");
    return at === -1 ? [token, true] : [token.slice(0, at), token.slice(at + 1)];
  }));
}

export function parseCapabilityCatalog(source) {
  const capabilities = new Map();
  let version = null;
  let airVersion = null;
  source.split(/\r?\n/).forEach((line, index) => {
    const tokens = tokenizeLine(line, index + 1);
    if (!tokens.length) return;
    const kind = tokens.shift();
    if (kind === "catalog") {
      const properties = parseProperties(tokens);
      version = Number(properties.version);
      airVersion = Number(properties.air);
      return;
    }
    if (kind !== "cap") throw new Error(`line ${index + 1}: expected cap`);
    const id = tokens.shift();
    if (!id || capabilities.has(id)) throw new Error(`line ${index + 1}: invalid duplicate capability ID`);
    const properties = parseProperties(tokens);
    const requires = properties.requires && properties.requires !== "-" ? properties.requires.split(",") : [];
    capabilities.set(id, { id, ...properties, requires, raw: line });
  });
  if (version !== 1 || airVersion !== 2) throw new Error("unsupported capability catalog or AIR version");
  for (const capability of capabilities.values()) {
    for (const dependency of capability.requires) if (!capabilities.has(dependency)) throw new Error(`unknown capability dependency ${dependency}`);
  }
  return { version, airVersion, capabilities };
}

export function searchCapabilities(catalog, query, options = {}) {
  const queryTerms = terms(query);
  const scored = [...catalog.capabilities.values()].map((capability) => {
    const searchable = `${capability.id} ${capability.tags ?? ""} ${capability.means ?? ""} ${capability.syntax ?? ""}`.toLowerCase();
    const score = queryTerms.reduce((total, term) => total
      + (capability.id.includes(term) ? 8 : 0)
      + terms(capability.tags ?? "").filter((tag) => tag === term || (Math.min(tag.length, term.length) >= 4 && (tag.startsWith(term) || term.startsWith(tag)))).length * 5
      + (searchable.includes(term) ? 1 : 0), 0);
    return { capability, score };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.capability.id.localeCompare(right.capability.id));
  const selected = new Map();
  const include = (capability) => {
    for (const dependency of capability.requires) include(catalog.capabilities.get(dependency));
    selected.set(capability.id, capability);
  };
  for (const item of scored.slice(0, options.limit ?? 4)) include(item.capability);
  return [...selected.values()];
}

export function formatCapabilitySelection(capabilities) {
  return ["catalog version=1 air=2", ...capabilities.map((capability) => capability.raw)].join("\n") + "\n";
}

export function approximateTokens(value) {
  return Math.ceil(Buffer.byteLength(value) / 4);
}
