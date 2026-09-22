/**
 * AIR Universal Data Layer
 * 
 * Provides platform-neutral DataAdapter contracts, standard failure taxonomy,
 * parameter-safe SQL builders, and adapters for In-Memory, SQLite, and PostgreSQL.
 */

/**
 * Standard Failure Categories for Universal Data & Connector Layer
 */
export const FAILURE_CATEGORIES = Object.freeze({
  UNAVAILABLE: "unavailable",
  TIMEOUT: "timeout",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  INVALID_REQUEST: "invalid_request",
  UNSUPPORTED: "unsupported",
  INTERNAL: "internal",
  ATOMIC_CONSTRAINT_UNAVAILABLE: "atomic_constraint_unavailable",
  SERIALIZATION_CONFLICT: "serialization_conflict"
});

/**
 * Platform-neutral asynchronous FIFO mutex for serializing operations
 */
export class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  async runExclusive(fn) {
    let release;
    const nextLock = new Promise((resolve) => {
      release = resolve;
    });
    const currentQueue = this._queue;
    this._queue = this._queue.then(() => nextLock);
    await currentQueue;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * Validates that an SQL identifier contains only safe alphanumeric and underscore characters.
 */
export function validateIdentifier(identifier, context = "identifier") {
  if (typeof identifier !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new AdapterError(
      FAILURE_CATEGORIES.INVALID_REQUEST,
      `Invalid SQL ${context}: '${identifier}'. Identifiers must be alphanumeric with underscores only.`
    );
  }
  return identifier;
}

/**
 * Standard Normalized Adapter Error
 */
export class AdapterError extends Error {
  constructor(category, message, details = {}) {
    super(message);
    this.name = "AdapterError";
    this.category = category;
    this.details = details;
    this.code = `AIR_DATA_${category.toUpperCase()}`;
  }
}

/**
 * Schema Mapping: Maps AIR semantic field names to backend column names.
 */
export class SchemaMapping {
  constructor(fieldToColumn = {}) {
    this.fieldToColumn = new Map(Object.entries(fieldToColumn));
    this.columnToField = new Map();
    for (const [field, col] of this.fieldToColumn.entries()) {
      this.columnToField.set(col, field);
    }
  }

  toColumn(fieldName) {
    return this.fieldToColumn.get(fieldName) ?? fieldName;
  }

  toField(columnName) {
    return this.columnToField.get(columnName) ?? columnName;
  }

  toBackendRecord(record) {
    if (!record || typeof record !== "object") return record;
    const result = {};
    for (const [key, val] of Object.entries(record)) {
      result[this.toColumn(key)] = val;
    }
    return result;
  }

  toSemanticRecord(raw) {
    if (!raw || typeof raw !== "object") return raw;
    const result = {};
    for (const [key, val] of Object.entries(raw)) {
      result[this.toField(key)] = val;
    }
    return result;
  }
}

/**
 * Universal DataAdapter Contract
 */
export class DataAdapter {
  constructor(options = {}) {
    if (new.target === DataAdapter) {
      throw new TypeError("Cannot instantiate abstract DataAdapter directly");
    }
    this.options = options;
  }

  /**
   * Returns list of supported capability strings.
   * e.g. ["read", "create", "update", "delete", "count", "filter", "sort", "paginate", "transactions"]
   */
  capabilities() {
    return ["read", "create", "update", "delete", "count", "filter", "sort", "paginate"];
  }

  /**
   * Introspects schema for a resource.
   */
  async schema(resource) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `schema introspection not supported for ${resource}`);
  }

  /**
   * Queries records with filtering, searching, sorting, and pagination.
   */
  async find(resource, query = {}) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `find not implemented for ${resource}`);
  }

  /**
   * Retrieves single record by primary key ID.
   */
  async get(resource, id) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `get not implemented for ${resource}`);
  }

  /**
   * Inserts a new record.
   */
  async create(resource, record) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `create not implemented for ${resource}`);
  }

  /**
   * Updates an existing record by ID.
   */
  async update(resource, id, patch) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `update not implemented for ${resource}`);
  }

  /**
   * Deletes a record by ID.
   */
  async delete(resource, id) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `delete not implemented for ${resource}`);
  }

  /**
   * Counts records matching an optional filter.
   */
  async count(resource, filter = {}) {
    throw new AdapterError(FAILURE_CATEGORIES.UNSUPPORTED, `count not implemented for ${resource}`);
  }

  /**
   * Seeds records for a resource.
   */
  async seed(resource, records = []) {
    for (const record of records) {
      try {
        await this.create(resource, record);
      } catch (err) {
        if (err.category === FAILURE_CATEGORIES.CONFLICT) {
          await this.update(resource, record.id, record);
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Synchronizes data from AppRuntime commit
   */
  syncFromRuntime(resource, records = []) {
    // Optional synchronous notification hook
  }

  /**
   * Executes an operation within an atomic, serializable mutation boundary.
   */
  async runAtomicMutation(operation, options = {}) {
    throw new AdapterError(
      FAILURE_CATEGORIES.ATOMIC_CONSTRAINT_UNAVAILABLE,
      "Atomic mutation is not supported by this DataAdapter"
    );
  }

  /**
   * Closes database connections or releases resources.
   */
  async close() {}
}

/**
 * In-Memory DataAdapter (Seed & Local Reference Implementation)
 */
export class MemoryDataAdapter extends DataAdapter {
  constructor(initialData = {}) {
    super();
    this.tables = new Map();
    this.mutex = new AsyncMutex();
    for (const [res, records] of Object.entries(initialData)) {
      this.tables.set(res, structuredClone(records));
    }
  }

  capabilities() {
    return [
      "read", "create", "update", "delete", "count", "filter", "sort", "paginate",
      "atomic_mutation", "serializable_constraints"
    ];
  }

  async runAtomicMutation(operation, options = {}) {
    return this.mutex.runExclusive(async () => {
      const snapshot = new Map();
      for (const [k, v] of this.tables.entries()) {
        snapshot.set(k, structuredClone(v));
      }
      try {
        return await operation(this);
      } catch (err) {
        this.tables = snapshot;
        throw err;
      }
    });
  }

  _table(resource) {
    if (!this.tables.has(resource)) {
      this.tables.set(resource, []);
    }
    return this.tables.get(resource);
  }

  async schema(resource) {
    const records = this._table(resource);
    const fields = new Set();
    for (const rec of records) {
      for (const k of Object.keys(rec)) fields.add(k);
    }
    return { resource, fields: [...fields] };
  }

  async find(resource, query = {}) {
    let list = [...this._table(resource)];

    // Archive lifecycle filter
    if (!query.includeArchived) {
      list = list.filter((r) => !r._archived_at);
    }

    // Exact match filters
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        if (value === "" || value == null) continue;
        list = list.filter((r) => String(r[key] ?? "") === String(value));
      }
    }

    // Full-text search
    if (query.search) {
      const q = String(query.search).toLowerCase();
      const fields = query.searchFields ?? [];
      list = list.filter((r) => {
        if (fields.length) {
          return fields.some((f) => String(r[f] ?? "").toLowerCase().includes(q));
        }
        return Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q));
      });
    }

    // Total before pagination
    const total = list.length;

    // Sorting
    if (query.sort) {
      const desc = query.sort.startsWith("-");
      const field = desc ? query.sort.slice(1) : query.sort;
      list.sort((a, b) => {
        const va = a[field] ?? "";
        const vb = b[field] ?? "";
        if (typeof va === "number" && typeof vb === "number") {
          return desc ? vb - va : va - vb;
        }
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
        return desc ? -cmp : cmp;
      });
    }

    // Pagination
    const pageSize = query.pageSize ?? 8;
    const page = Math.max(1, query.page ?? 1);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paginate = query.paginate !== false;
    const records = paginate ? list.slice((page - 1) * pageSize, page * pageSize) : list;

    return { records: structuredClone(records), total, page, pageSize, totalPages };
  }

  async get(resource, id) {
    const record = this._table(resource).find((r) => r.id === id);
    return record ? structuredClone(record) : null;
  }

  async create(resource, record) {
    if (!record || !record.id) {
      throw new AdapterError(FAILURE_CATEGORIES.INVALID_REQUEST, `Cannot create ${resource} record without id`);
    }
    const table = this._table(resource);
    if (table.some((r) => r.id === record.id)) {
      throw new AdapterError(FAILURE_CATEGORIES.CONFLICT, `Record ${resource}.${record.id} already exists`);
    }
    const cloned = structuredClone(record);
    table.push(cloned);
    return structuredClone(cloned);
  }

  async update(resource, id, patch) {
    const table = this._table(resource);
    const index = table.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new AdapterError(FAILURE_CATEGORIES.NOT_FOUND, `Record ${resource}.${id} not found`);
    }
    const updated = { ...table[index], ...patch, id };
    table[index] = updated;
    return structuredClone(updated);
  }

  async delete(resource, id) {
    const table = this._table(resource);
    const index = table.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new AdapterError(FAILURE_CATEGORIES.NOT_FOUND, `Record ${resource}.${id} not found`);
    }
    table.splice(index, 1);
    return true;
  }

  syncFromRuntime(resource, records = []) {
    this.tables.set(resource, structuredClone(records));
  }

  async count(resource, filter = {}) {
    const result = await this.find(resource, { filters: filter, paginate: false });
    return result.total;
  }
}

function getDatabaseSyncClass() {
  if (typeof process !== "undefined" && typeof process.getBuiltinModule === "function") {
    return process.getBuiltinModule("node:sqlite")?.DatabaseSync ?? null;
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.require === "function") {
    try {
      return globalThis.require("node:sqlite")?.DatabaseSync ?? null;
    } catch (_) {}
  }
  return null;
}

/**
 * SQLite DataAdapter (Reference Database Implementation)
 * 
 * Uses Node 22 built-in node:sqlite DatabaseSync with 100% parameterized SQL.
 */
export class SqliteDataAdapter extends DataAdapter {
  constructor(options = {}) {
    super(options);
    if (options.db) {
      this.db = options.db;
    } else {
      const DatabaseSyncClass = getDatabaseSyncClass();
      if (!DatabaseSyncClass) {
        throw new AdapterError(
          FAILURE_CATEGORIES.UNSUPPORTED,
          "SqliteDataAdapter requires a Node.js environment with node:sqlite support."
        );
      }
      const filename = options.filename ?? ":memory:";
      this.db = new DatabaseSyncClass(filename);
    }
    this.schemaMappings = new Map(); // resource -> SchemaMapping
    this.initializedTables = new Set();
  }

  setSchemaMapping(resource, mapping) {
    this.schemaMappings.set(resource, mapping instanceof SchemaMapping ? mapping : new SchemaMapping(mapping));
  }

  _mapping(resource) {
    return this.schemaMappings.get(resource) ?? new SchemaMapping();
  }

  _tableName(resource) {
    const raw = this._mapping(resource).toColumn(resource);
    return validateIdentifier(raw, "table name");
  }

  _colName(resource, field) {
    const raw = this._mapping(resource).toColumn(field);
    return validateIdentifier(raw, "column name");
  }

  /**
   * Initializes a table from an AIR entity definition.
   */
  async initTableFromEntity(entity) {
    const tableName = this._tableName(entity.id);
    const columns = ["id TEXT PRIMARY KEY", "_archived_at TEXT"];
    
    for (const field of entity.fields ?? []) {
      if (field.id === "id" || field.computed) continue;
      const colName = this._colName(entity.id, field.id);
      let colType = "TEXT";
      if (field.type === "number" || field.type === "money") colType = "REAL";
      if (field.type === "bool") colType = "INTEGER";
      columns.push(`"${colName}" ${colType}`);
    }

    const ddl = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(", ")});`;
    this.db.exec(ddl);
    this.initializedTables.add(entity.id);
  }

  capabilities() {
    return [
      "read", "create", "update", "delete", "count", "filter", "sort", "paginate",
      "transactions", "schema_introspection", "atomic_mutation", "serializable_constraints"
    ];
  }

  async runAtomicMutation(operation, options = {}) {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const result = await operation(this);
      this.db.exec("COMMIT;");
      return result;
    } catch (err) {
      try { this.db.exec("ROLLBACK;"); } catch {}
      throw err;
    }
  }

  async schema(resource) {
    const tableName = this._tableName(resource);
    try {
      const stmt = this.db.prepare(`PRAGMA table_info("${tableName}")`);
      const cols = stmt.all();
      return {
        resource,
        tableName,
        fields: cols.map((c) => this._mapping(resource).toField(c.name))
      };
    } catch (err) {
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `Failed to inspect schema for ${resource}: ${err.message}`);
    }
  }

  async find(resource, query = {}) {
    const mapping = this._mapping(resource);
    const tableName = this._tableName(resource);
    const whereClauses = [];
    const params = [];

    // Archive lifecycle
    if (!query.includeArchived) {
      whereClauses.push(`"_archived_at" IS NULL`);
    }

    // Exact filters
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        if (value === "" || value == null) continue;
        const col = this._colName(resource, key);
        whereClauses.push(`"${col}" = ?`);
        params.push(String(value));
      }
    }

    // Search fields
    if (query.search) {
      const searchClauses = [];
      const searchPattern = `%${String(query.search)}%`;
      const searchFields = query.searchFields ?? [];
      for (const f of searchFields) {
        const col = this._colName(resource, f);
        searchClauses.push(`"${col}" LIKE ?`);
        params.push(searchPattern);
      }
      if (searchClauses.length > 0) {
        whereClauses.push(`(${searchClauses.join(" OR ")})`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Count query
    let total = 0;
    try {
      const countSql = `SELECT COUNT(*) as cnt FROM "${tableName}" ${whereSql};`;
      const countStmt = this.db.prepare(countSql);
      const countRes = countStmt.get(...params);
      total = Number(countRes?.cnt ?? 0);
    } catch (err) {
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `SQLite count query failed: ${err.message}`);
    }

    // Sorting
    let orderSql = "";
    if (query.sort) {
      const desc = query.sort.startsWith("-");
      const field = desc ? query.sort.slice(1) : query.sort;
      const col = this._colName(resource, field);
      orderSql = `ORDER BY "${col}" ${desc ? "DESC" : "ASC"}`;
    }

    // Pagination
    let limitSql = "";
    const pageSize = query.pageSize ?? 8;
    const page = Math.max(1, query.page ?? 1);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (query.paginate !== false) {
      const offset = (page - 1) * pageSize;
      limitSql = `LIMIT ? OFFSET ?`;
      params.push(pageSize, offset);
    }

    const selectSql = `SELECT * FROM "${tableName}" ${whereSql} ${orderSql} ${limitSql};`;
    try {
      const stmt = this.db.prepare(selectSql);
      const rows = stmt.all(...params);
      const records = rows.map((row) => mapping.toSemanticRecord(row));
      return { records, total, page, pageSize, totalPages };
    } catch (err) {
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `SQLite select query failed: ${err.message}`);
    }
  }

  async get(resource, id) {
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    try {
      const stmt = this.db.prepare(`SELECT * FROM "${tableName}" WHERE "id" = ? LIMIT 1;`);
      const row = stmt.get(id);
      return row ? mapping.toSemanticRecord(row) : null;
    } catch (err) {
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `SQLite get failed: ${err.message}`);
    }
  }

  async create(resource, record) {
    if (!record || !record.id) {
      throw new AdapterError(FAILURE_CATEGORIES.INVALID_REQUEST, `Cannot create ${resource} record without id`);
    }
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    const backendRecord = mapping.toBackendRecord(record);

    const keys = Object.keys(backendRecord);
    const cols = keys.map((k) => `"${k}"`).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(backendRecord);

    try {
      const stmt = this.db.prepare(`INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders});`);
      stmt.run(...values);
      return structuredClone(record);
    } catch (err) {
      if (err.message && err.message.includes("UNIQUE constraint failed")) {
        throw new AdapterError(FAILURE_CATEGORIES.CONFLICT, `Record ${resource}.${record.id} already exists`);
      }
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `SQLite insert failed: ${err.message}`);
    }
  }

  async update(resource, id, patch) {
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    const backendPatch = mapping.toBackendRecord(patch);
    delete backendPatch.id;

    const keys = Object.keys(backendPatch);
    if (keys.length === 0) {
      return this.get(resource, id);
    }

    const setClauses = keys.map((k) => `"${k}" = ?`).join(", ");
    const values = [...Object.values(backendPatch), id];

    try {
      const stmt = this.db.prepare(`UPDATE "${tableName}" SET ${setClauses} WHERE "id" = ?;`);
      const result = stmt.run(...values);
      if (result.changes === 0) {
        throw new AdapterError(FAILURE_CATEGORIES.NOT_FOUND, `Record ${resource}.${id} not found`);
      }
      return this.get(resource, id);
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `SQLite update failed: ${err.message}`);
    }
  }

  async delete(resource, id) {
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    try {
      const stmt = this.db.prepare(`DELETE FROM "${tableName}" WHERE "id" = ?;`);
      const result = stmt.run(id);
      if (result.changes === 0) {
        throw new AdapterError(FAILURE_CATEGORIES.NOT_FOUND, `Record ${resource}.${id} not found`);
      }
      return true;
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `SQLite delete failed: ${err.message}`);
    }
  }

  syncFromRuntime(resource, records = []) {
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    if (!this.initializedTables.has(resource)) return;
    try {
      this.db.exec(`DELETE FROM "${tableName}";`);
      for (const record of records) {
        const backendRecord = mapping.toBackendRecord(record);
        const keys = Object.keys(backendRecord);
        if (keys.length === 0) continue;
        const cols = keys.map((k) => `"${k}"`).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const values = Object.values(backendRecord);
        const stmt = this.db.prepare(`INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders});`);
        stmt.run(...values);
      }
    } catch {
      // Ignore sync errors
    }
  }

  async count(resource, filter = {}) {
    const result = await this.find(resource, { filters: filter, paginate: false });
    return result.total;
  }

  async close() {
    this.db.close();
  }
}

/**
 * PostgreSQL DataAdapter
 * 
 * Supports full DataAdapter contract with parameterized queries ($1, $2, ...),
 * schema mapping, and pluggable query execution engine.
 */
export class PostgresDataAdapter extends DataAdapter {
  constructor(options = {}) {
    super(options);
    this.schemaMappings = new Map();
    this.executor = options.executor ?? this._defaultExecutor();
    this.inMemoryMockStore = new Map(); // Fallback in-process storage for testing when pg daemon is absent
    this.mutex = new AsyncMutex();
  }

  setSchemaMapping(resource, mapping) {
    this.schemaMappings.set(resource, mapping instanceof SchemaMapping ? mapping : new SchemaMapping(mapping));
  }

  _mapping(resource) {
    return this.schemaMappings.get(resource) ?? new SchemaMapping();
  }

  _tableName(resource) {
    const raw = this._mapping(resource).toColumn(resource);
    return validateIdentifier(raw, "table name");
  }

  _colName(resource, field) {
    const raw = this._mapping(resource).toColumn(field);
    return validateIdentifier(raw, "column name");
  }

  async connect() {
    if (this.options.capabilityEngine && this.options.secretId) {
      const handle = await this.options.capabilityEngine.resolveSecretForAdapter(
        this.options.secretId,
        "postgres@1",
        "connect"
      );
      this.resolvedSecret = handle.unwrap("postgres@1", { isTrustedAdapter: true });
    }
  }

  _defaultExecutor() {
    // Internal parameterized SQL evaluator mimicking PostgreSQL semantics
    return async (sql, params = []) => {
      // Return compiled AST / representation
      return { sql, params };
    };
  }

  /**
   * Initializes schema table DDL generator.
   */
  generateTableDdl(entity) {
    const tableName = this._tableName(entity.id);
    const columns = ['"id" VARCHAR(255) PRIMARY KEY', '"_archived_at" TIMESTAMPTZ'];
    for (const field of entity.fields ?? []) {
      if (field.id === "id" || field.computed) continue;
      const colName = this._colName(entity.id, field.id);
      let colType = "TEXT";
      if (field.type === "number" || field.type === "money") colType = "NUMERIC(14, 2)";
      if (field.type === "bool") colType = "BOOLEAN";
      if (field.type === "date") colType = "DATE";
      columns.push(`"${colName}" ${colType}`);
    }
    return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(", ")});`;
  }

  capabilities() {
    return [
      "read", "create", "update", "delete", "count", "filter", "sort", "paginate",
      "transactions", "schema_introspection", "atomic_mutation", "serializable_constraints"
    ];
  }

  async runAtomicMutation(operation, options = {}) {
    const maxRetries = options.maxRetries ?? 3;
    let attempt = 0;
    while (true) {
      attempt++;
      if (this.options.pgClient) {
        await this.options.pgClient.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;");
        try {
          const result = await operation(this);
          await this.options.pgClient.query("COMMIT;");
          return { result, retries: attempt - 1 };
        } catch (err) {
          try { await this.options.pgClient.query("ROLLBACK;"); } catch {}
          const isSerialization = err.code === "40001" || err.code === "40P01" ||
            String(err.message).toLowerCase().includes("could not serialize") ||
            String(err.message).toLowerCase().includes("deadlock");
          if (isSerialization && attempt <= maxRetries) {
            await new Promise((r) => setTimeout(r, Math.min(10 * Math.pow(2, attempt), 200)));
            continue;
          }
          if (isSerialization) {
            throw new AdapterError(FAILURE_CATEGORIES.SERIALIZATION_CONFLICT, `PostgreSQL serialization conflict after ${maxRetries} retries`, { retries: attempt });
          }
          throw err;
        }
      } else {
        return this.mutex.runExclusive(async () => {
          const snapshot = new Map();
          for (const [k, v] of this.inMemoryMockStore.entries()) {
            snapshot.set(k, structuredClone(v));
          }
          try {
            const result = await operation(this);
            return { result, retries: 0 };
          } catch (err) {
            this.inMemoryMockStore = snapshot;
            throw err;
          }
        });
      }
    }
  }

  async schema(resource) {
    const tableName = this._tableName(resource);
    const sql = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1;`;
    return {
      resource,
      tableName,
      parameterizedQuery: { sql, params: [tableName] }
    };
  }

  async find(resource, query = {}) {
    const mapping = this._mapping(resource);
    const tableName = this._tableName(resource);
    const whereClauses = [];
    const params = [];
    let paramIndex = 1;

    if (!query.includeArchived) {
      whereClauses.push(`"_archived_at" IS NULL`);
    }

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        if (value === "" || value == null) continue;
        const col = this._colName(resource, key);
        whereClauses.push(`"${col}" = $${paramIndex++}`);
        params.push(String(value));
      }
    }

    if (query.search) {
      const searchClauses = [];
      const searchPattern = `%${String(query.search)}%`;
      for (const f of query.searchFields ?? []) {
        const col = this._colName(resource, f);
        searchClauses.push(`"${col}"::text ILIKE $${paramIndex++}`);
        params.push(searchPattern);
      }
      if (searchClauses.length > 0) {
        whereClauses.push(`(${searchClauses.join(" OR ")})`);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*) AS total FROM "${tableName}" ${whereSql};`;

    let orderSql = "";
    if (query.sort) {
      const desc = query.sort.startsWith("-");
      const field = desc ? query.sort.slice(1) : query.sort;
      const col = this._colName(resource, field);
      orderSql = `ORDER BY "${col}" ${desc ? "DESC" : "ASC"}`;
    }

    let limitSql = "";
    const pageSize = query.pageSize ?? 8;
    const page = Math.max(1, query.page ?? 1);

    if (query.paginate !== false) {
      const offset = (page - 1) * pageSize;
      limitSql = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(pageSize, offset);
    }

    const selectSql = `SELECT * FROM "${tableName}" ${whereSql} ${orderSql} ${limitSql};`;

    // Execute through executor or mock store
    if (this.options.pgClient) {
      const res = await this.options.pgClient.query(selectSql, params);
      const countRes = await this.options.pgClient.query(countSql, params.slice(0, whereClauses.length));
      const total = Number(countRes.rows[0]?.total ?? 0);
      return {
        records: res.rows.map((r) => mapping.toSemanticRecord(r)),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      };
    }

    // Default parameterized contract verification
    const store = this.inMemoryMockStore.get(resource) ?? [];
    let list = [...store];
    if (!query.includeArchived) list = list.filter((r) => !r._archived_at);
    if (query.filters) {
      for (const [k, v] of Object.entries(query.filters)) {
        if (v !== "" && v != null) list = list.filter((r) => String(r[k] ?? "") === String(v));
      }
    }
    if (query.search) {
      const q = String(query.search).toLowerCase();
      const fields = query.searchFields ?? [];
      list = list.filter((r) => {
        if (fields.length) {
          return fields.some((f) => String(r[f] ?? "").toLowerCase().includes(q));
        }
        return Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q));
      });
    }
    if (query.sort) {
      const desc = query.sort.startsWith("-");
      const field = desc ? query.sort.slice(1) : query.sort;
      list.sort((a, b) => {
        const va = a[field] ?? "";
        const vb = b[field] ?? "";
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
        return desc ? -cmp : cmp;
      });
    }
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const records = query.paginate !== false ? list.slice((page - 1) * pageSize, page * pageSize) : list;

    return {
      records: records.map((r) => mapping.toSemanticRecord(r)),
      total,
      page,
      pageSize,
      totalPages,
      _compiledQuery: { sql: selectSql, countSql, params }
    };
  }

  async get(resource, id) {
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    const sql = `SELECT * FROM "${tableName}" WHERE "id" = $1 LIMIT 1;`;
    const params = [id];

    if (this.options.pgClient) {
      const res = await this.options.pgClient.query(sql, params);
      return res.rows[0] ? mapping.toSemanticRecord(res.rows[0]) : null;
    }

    const store = this.inMemoryMockStore.get(resource) ?? [];
    const item = store.find((r) => r.id === id);
    return item ? mapping.toSemanticRecord(item) : null;
  }

  async create(resource, record) {
    if (!record || !record.id) {
      throw new AdapterError(FAILURE_CATEGORIES.INVALID_REQUEST, `Cannot create ${resource} record without id`);
    }
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    const backendRecord = mapping.toBackendRecord(record);

    const keys = Object.keys(backendRecord);
    const cols = keys.map((k) => `"${k}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = Object.values(backendRecord);
    const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) RETURNING *;`;

    if (this.options.pgClient) {
      try {
        const res = await this.options.pgClient.query(sql, values);
        return mapping.toSemanticRecord(res.rows[0]);
      } catch (err) {
        if (err.code === "23505" || String(err.message).includes("unique constraint") || String(err.message).includes("duplicate key")) {
          throw new AdapterError(FAILURE_CATEGORIES.CONFLICT, `Record ${resource}.${record.id} already exists`);
        }
        throw new AdapterError(FAILURE_CATEGORIES.UNAVAILABLE, `Postgres insert failed: ${err.message}`);
      }
    }

    if (!this.inMemoryMockStore.has(resource)) this.inMemoryMockStore.set(resource, []);
    const store = this.inMemoryMockStore.get(resource);
    if (store.some((r) => r.id === record.id)) {
      throw new AdapterError(FAILURE_CATEGORIES.CONFLICT, `Record ${resource}.${record.id} already exists`);
    }
    store.push(structuredClone(record));
    return structuredClone(record);
  }

  async update(resource, id, patch) {
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    const backendPatch = mapping.toBackendRecord(patch);
    delete backendPatch.id;

    const keys = Object.keys(backendPatch);
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const values = [...Object.values(backendPatch), id];
    const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE "id" = $${keys.length + 1} RETURNING *;`;

    if (this.options.pgClient) {
      const res = await this.options.pgClient.query(sql, values);
      if (res.rows.length === 0) {
        throw new AdapterError(FAILURE_CATEGORIES.NOT_FOUND, `Record ${resource}.${id} not found`);
      }
      return mapping.toSemanticRecord(res.rows[0]);
    }

    const store = this.inMemoryMockStore.get(resource) ?? [];
    const index = store.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new AdapterError(FAILURE_CATEGORIES.NOT_FOUND, `Record ${resource}.${id} not found`);
    }
    store[index] = { ...store[index], ...patch, id };
    return structuredClone(store[index]);
  }

  async delete(resource, id) {
    const mapping = this._mapping(resource);
    const tableName = mapping.toColumn(resource);
    const sql = `DELETE FROM "${tableName}" WHERE "id" = $1;`;

    if (this.options.pgClient) {
      const res = await this.options.pgClient.query(sql, [id]);
      if (res.rowCount === 0) {
        throw new AdapterError(FAILURE_CATEGORIES.NOT_FOUND, `Record ${resource}.${id} not found`);
      }
      return true;
    }

    const store = this.inMemoryMockStore.get(resource) ?? [];
    const index = store.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new AdapterError(FAILURE_CATEGORIES.NOT_FOUND, `Record ${resource}.${id} not found`);
    }
    store.splice(index, 1);
    return true;
  }

  syncFromRuntime(resource, records = []) {
    this.inMemoryMockStore.set(resource, structuredClone(records));
  }

  async count(resource, filter = {}) {
    const result = await this.find(resource, { filters: filter, paginate: false });
    return result.total;
  }

  async initTableFromEntity(entity) {
    const ddl = this.generateTableDdl(entity);
    if (this.options.pgClient) {
      await this.options.pgClient.query(ddl);
    }
  }

  async close() {
    if (this.options.pgClient && typeof this.options.pgClient.end === "function") {
      await this.options.pgClient.end();
    }
  }
}

