/**
 * AIR Universal Connector Model
 * 
 * Provides platform-neutral Connector contracts, normalized ConnectorManifest,
 * REST and MCP adapters, event normalization, and AI capability discovery registry.
 */

import { FAILURE_CATEGORIES, AdapterError } from "./data.mjs";
import { globalRedactor, NetworkDestinationPolicy, SECURITY_ERROR_CODES, SecurityError } from "./security.mjs";

/**
 * Standard Event Envelope for Connector & Workflow Events
 */
export class EventEnvelope {
  constructor({ id, source, type, timestamp = new Date().toISOString(), data = {}, version = "1.0.0" }) {
    if (!type || !source) {
      throw new AdapterError(FAILURE_CATEGORIES.INVALID_REQUEST, "EventEnvelope requires source and type");
    }
    this.id = id ?? `evt_${Math.random().toString(36).slice(2, 10)}`;
    this.source = source;
    this.type = type;
    this.timestamp = timestamp;
    this.data = data;
    this.version = version;
  }

  toJSON() {
    return {
      id: this.id,
      source: this.source,
      type: this.type,
      timestamp: this.timestamp,
      data: this.data,
      version: this.version
    };
  }
}

/**
 * Normalized Connector Manifest
 * Declares resources, actions, events, and capabilities for AI and Runtime consumption.
 */
export class ConnectorManifest {
  constructor(manifest) {
    if (!manifest || !manifest.id || !manifest.name) {
      throw new AdapterError(FAILURE_CATEGORIES.INVALID_REQUEST, "ConnectorManifest requires id and name");
    }
    this.id = manifest.id;
    this.name = manifest.name;
    this.version = manifest.version ?? "1.0.0";
    this.protocol = manifest.protocol ?? "custom"; // "rest" | "mcp" | "graphql" | "custom"
    this.description = manifest.description ?? "";
    this.resources = manifest.resources ?? []; // [{ name, description, fields }]
    this.actions = manifest.actions ?? []; // [{ name, description, parameters, returns }]
    this.events = manifest.events ?? []; // [{ name, description, schema }]
    this.capabilities = manifest.capabilities ?? []; // ["read", "write", "events", "search", ...]
  }

  /**
   * Generates a compact semantic summary for LLM context injection
   */
  toAiPromptContext() {
    const actionList = this.actions.map(a => `  - ${a.name}(${Object.keys(a.parameters?.properties ?? {}).join(", ")}): ${a.description}`).join("\n");
    const resourceList = this.resources.map(r => `  - ${r.name}: ${r.description}`).join("\n");
    const eventList = this.events.map(e => `  - ${e.name}: ${e.description}`).join("\n");
    const text = [
      `Connector [${this.id}] (${this.name} v${this.version}, protocol=${this.protocol}):`,
      `Description: ${this.description}`,
      this.capabilities.length ? `Capabilities: ${this.capabilities.join(", ")}` : "",
      resourceList ? `Resources:\n${resourceList}` : "",
      actionList ? `Actions:\n${actionList}` : "",
      eventList ? `Events:\n${eventList}` : ""
    ].filter(Boolean).join("\n");
    return globalRedactor.redactString(text);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      protocol: this.protocol,
      description: this.description,
      resources: this.resources,
      actions: this.actions,
      events: this.events,
      capabilities: this.capabilities
    };
  }
}

/**
 * Abstract Connector Base Class
 */
export class Connector {
  constructor(manifest, options = {}) {
    if (new.target === Connector) {
      throw new TypeError("Cannot instantiate abstract Connector directly");
    }
    this.manifest = manifest instanceof ConnectorManifest ? manifest : new ConnectorManifest(manifest);
    this.options = options;
    this.capabilityEngine = options.capabilityEngine ?? null;
    this.listeners = new Map(); // eventType -> Set<callback>
  }

  get id() {
    return this.manifest.id;
  }

  get protocol() {
    return this.manifest.protocol;
  }

  /**
   * Introspect / return the connector manifest
   */
  async describe() {
    return this.manifest;
  }

  /**
   * Invoke a named action on the connector
   */
  async invoke(actionName, params = {}) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `invoke('${actionName}') not implemented on connector ${this.id}`);
  }

  /**
   * Read or query a resource from the connector
   */
  async queryResource(resourceName, query = {}) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `queryResource('${resourceName}') not implemented on connector ${this.id}`);
  }

  /**
   * Subscribe to connector events
   */
  on(eventType, listener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(listener);
    return () => this.off(eventType, listener);
  }

  off(eventType, listener) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(listener);
    }
  }

  /**
   * Dispatch a normalized event to listeners
   */
  emit(eventType, data) {
    const envelope = data instanceof EventEnvelope ? data : new EventEnvelope({
      source: this.id,
      type: eventType,
      data
    });
    const typeListeners = this.listeners.get(eventType);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(envelope);
        } catch (err) {
          console.error(`Connector listener error:`, err);
        }
      }
    }
    const allListeners = this.listeners.get("*");
    if (allListeners) {
      for (const listener of allListeners) {
        try {
          listener(envelope);
        } catch (err) {
          console.error(`Connector listener error:`, err);
        }
      }
    }
    return envelope;
  }

  /**
   * Close or cleanup connector resources
   */
  async close() {
    this.listeners.clear();
  }
}

/**
 * REST Connector Adapter
 * Communicates with HTTP REST endpoints, validates network destination policy,
 * and maps HTTP error status codes to standard taxonomy.
 */
export class RestConnectorAdapter extends Connector {
  constructor(manifest, options = {}) {
    super(manifest, options);
    this.baseUrl = options.baseUrl ?? "";
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.headers = options.headers ?? {};
    this.endpointRoutes = options.routes ?? {}; // action/resource -> { path, method }
    this.networkPolicy = options.networkPolicy ?? null;
    this.secretId = options.secretId ?? null;
  }

  _mapHttpStatusToCategory(status) {
    if (status === 400) return FAILURE_CATEGORIES.INVALID_REQUEST;
    if (status === 401) return FAILURE_CATEGORIES.UNAUTHORIZED;
    if (status === 403) return FAILURE_CATEGORIES.FORBIDDEN;
    if (status === 404) return FAILURE_CATEGORIES.NOT_FOUND;
    if (status === 409) return FAILURE_CATEGORIES.CONFLICT;
    if (status === 408 || status === 504) return FAILURE_CATEGORIES.TIMEOUT;
    if (status === 502 || status === 503) return FAILURE_CATEGORIES.UNAVAILABLE;
    return FAILURE_CATEGORIES.INTERNAL;
  }

  async _safeFetch(url, options = {}) {
    // 1. Check network destination policy
    if (this.networkPolicy) {
      this.networkPolicy.assertAllowed(url, `REST Connector (${this.id})`);
    }

    // 2. Fetch with manual redirect handling to enforce destination policy on redirects
    const response = await this.fetcher(url, {
      ...options,
      redirect: "manual"
    });

    // 3. Re-verify destination if redirect encountered (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers?.get?.("location") ?? response.headers?.location;
      if (location) {
        const redirectUrl = new URL(location, url).toString();
        if (this.networkPolicy) {
          this.networkPolicy.assertAllowed(redirectUrl, `REST Connector Redirect (${this.id})`);
        }
        return this._safeFetch(redirectUrl, options);
      }
    }

    return response;
  }

  async invoke(actionName, params = {}) {
    // Check capability if capabilityEngine is configured
    if (this.capabilityEngine) {
      this.capabilityEngine.assertCapability(
        `connector:${this.id}:action:${actionName}:invoke`,
        { operation: `invoke(${actionName})`, adapter: "rest@1" }
      );
    }

    const route = this.endpointRoutes[actionName];
    const path = route?.path ?? `/actions/${actionName}`;
    const method = route?.method ?? "POST";
    const url = `${this.baseUrl}${path}`;

    // Internal secret consumption if secretId is configured
    let authHeaders = {};
    if (this.secretId && this.capabilityEngine) {
      const handle = await this.capabilityEngine.resolveSecretForAdapter(this.secretId, "rest@1", "invoke");
      const rawToken = handle.unwrap("rest@1", { isTrustedAdapter: true });
      authHeaders["Authorization"] = `Bearer ${rawToken}`;
    }

    try {
      const response = await this._safeFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
          ...authHeaders
        },
        body: method !== "GET" ? JSON.stringify(params) : undefined
      });

      if (!response.ok) {
        const errorCategory = this._mapHttpStatusToCategory(response.status);
        let errorBody = {};
        try {
          errorBody = await response.json();
        } catch {
          errorBody = { statusText: response.statusText };
        }
        throw new AdapterError(
          errorCategory,
          `REST action ${actionName} failed with status ${response.status}: ${errorBody.message || response.statusText}`,
          { status: response.status, body: errorBody }
        );
      }

      return await response.json();
    } catch (err) {
      if (err instanceof SecurityError) throw err;
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `REST request to ${url} failed: ${err.message}`, { error: err.message });
    }
  }

  async queryResource(resourceName, query = {}) {
    // Check capability if capabilityEngine is configured
    if (this.capabilityEngine) {
      this.capabilityEngine.assertCapability(
        `connector:${this.id}:resource:${resourceName}:read`,
        { operation: `queryResource(${resourceName})`, adapter: "rest@1" }
      );
    }

    const route = this.endpointRoutes[resourceName];
    const path = route?.path ?? `/resources/${resourceName}`;
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v != null) searchParams.set(k, String(v));
    }
    const queryStr = searchParams.toString();
    const url = `${this.baseUrl}${path}${queryStr ? `?${queryStr}` : ""}`;

    try {
      const response = await this._safeFetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...this.headers
        }
      });

      if (!response.ok) {
        const errorCategory = this._mapHttpStatusToCategory(response.status);
        let errorBody = {};
        try {
          errorBody = await response.json();
        } catch {
          errorBody = { statusText: response.statusText };
        }
        throw new AdapterError(
          errorCategory,
          `REST queryResource ${resourceName} failed with status ${response.status}: ${errorBody.message || response.statusText}`,
          { status: response.status, body: errorBody }
        );
      }

      return await response.json();
    } catch (err) {
      if (err instanceof SecurityError) throw err;
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `REST query to ${url} failed: ${err.message}`, { error: err.message });
    }
  }
}

/**
 * Model Context Protocol (MCP) Connector Adapter
 * Communicates with MCP Servers via JSON-RPC, exposing MCP Tools as actions and Resources as queryable resources.
 */
export class McpConnectorAdapter extends Connector {
  constructor(manifest, options = {}) {
    super(manifest, options);
    this.rpcHandler = options.rpcHandler; // async (request: { jsonrpc, id, method, params }) => response
    this._requestId = 1;
  }

  async _callRpc(method, params = {}) {
    if (!this.rpcHandler) {
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `No RPC handler configured for MCP connector ${this.id}`);
    }
    const req = {
      jsonrpc: "2.0",
      id: this._requestId++,
      method,
      params
    };

    try {
      const response = await this.rpcHandler(req);
      if (!response) {
        throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `Empty response from MCP server for ${method}`);
      }
      if (response.error) {
        const code = response.error.code;
        let category = FAILURE_CATEGORIES.INTERNAL;
        if (code === -32600 || code === -32602) category = FAILURE_CATEGORIES.INVALID_REQUEST;
        if (code === -32601) category = FAILURE_CATEGORIES.UNSUPPORTED;
        if (code === -32000) category = FAILURE_CATEGORIES.NOT_FOUND;
        throw new AdapterError(category, `MCP error ${code}: ${response.error.message}`, response.error);
      }
      return response.result;
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `MCP RPC invocation failed: ${err.message}`, { error: err.message });
    }
  }

  async invoke(actionName, params = {}) {
    if (this.capabilityEngine) {
      this.capabilityEngine.assertCapability(
        `connector:${this.id}:action:${actionName}:invoke`,
        { operation: `invoke(${actionName})`, adapter: "mcp@1" }
      );
    }
    // MCP tool call format: tools/call { name, arguments }
    const result = await this._callRpc("tools/call", {
      name: actionName,
      arguments: params
    });
    return result;
  }

  async queryResource(resourceUri, query = {}) {
    if (this.capabilityEngine) {
      this.capabilityEngine.assertCapability(
        `connector:${this.id}:resource:${resourceUri}:read`,
        { operation: `queryResource(${resourceUri})`, adapter: "mcp@1" }
      );
    }
    // MCP resource read format: resources/read { uri }
    const uri = query.uri ?? resourceUri;
    const result = await this._callRpc("resources/read", { uri });
    return result;
  }

  /**
   * Introspect tools & resources dynamically from MCP server and update manifest
   */
  async discoverFromMcpServer() {
    const toolsRes = await this._callRpc("tools/list", {});
    const resourcesRes = await this._callRpc("resources/list", {});

    const actions = (toolsRes.tools ?? []).map(t => ({
      name: t.name,
      description: t.description ?? "",
      parameters: t.inputSchema ?? {}
    }));

    const resources = (resourcesRes.resources ?? []).map(r => ({
      name: r.name ?? r.uri,
      description: r.description ?? "",
      uri: r.uri,
      mimeType: r.mimeType
    }));

    this.manifest.actions = actions;
    this.manifest.resources = resources;
    return this.manifest;
  }
}

/**
 * Universal Connector Registry
 * Provides self-describing registration and semantic AI capability discovery.
 */
export class ConnectorRegistry {
  constructor() {
    this.connectors = new Map(); // id -> Connector
  }

  register(connector) {
    if (!(connector instanceof Connector)) {
      throw new AdapterError(FAILURE_CATEGORIES.INVALID_REQUEST, "Registered item must be an instance of Connector");
    }
    this.connectors.set(connector.id, connector);
  }

  get(id) {
    return this.connectors.get(id);
  }

  has(id) {
    return this.connectors.has(id);
  }

  list() {
    return [...this.connectors.values()].map(c => c.manifest);
  }

  /**
   * Discovers connectors matching semantic keywords or prompt requirements
   */
  discover(promptOrQuery) {
    const q = String(promptOrQuery).toLowerCase();
    const matches = [];

    for (const connector of this.connectors.values()) {
      const m = connector.manifest;
      const haystack = [
        m.id,
        m.name,
        m.description,
        ...m.capabilities,
        ...m.actions.map(a => `${a.name} ${a.description}`),
        ...m.resources.map(r => `${r.name} ${r.description}`)
      ].join(" ").toLowerCase();

      if (haystack.includes(q)) {
        matches.push(connector);
      }
    }

    return matches;
  }

  /**
   * Produces unified AI prompt context describing available connectors without transport code
   */
  toAiPromptContext() {
    const manifests = this.list();
    if (manifests.length === 0) return "No external connectors registered.";
    return manifests.map(m => m.toAiPromptContext()).join("\n\n---\n\n");
  }
}
