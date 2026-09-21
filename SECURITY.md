# AIR Security Architecture & Trust Model

## Overview

AIR enforces a strict **Deny-by-Default** security model separating untrusted application code (`.air`), presentation layers, and external integration points from sensitive credentials, data storage, and external network execution.

AIR applications describe **what** data and capabilities they need; the trusted runtime host enforces **who** can access them, **how** they are authorized, and **how** secrets and sensitive fields are protected.

---

## 1. Core Security Principles

1. **Deny by Default:** No data store, connector action, network endpoint, or secret is accessible unless explicitly granted by a capability token.
2. **Zero Plaintext Secret Exposure:** AIR application source, Semantic IR, and Presentation IR never hold plaintext secrets. All secrets are referenced exclusively via opaque identifiers (`SecretHandle`) and resolved only within trusted adapters at the host boundary.
3. **Two-Key Authorization:** Execution of any operation requires:
   - **Semantic Authority:** Declared business policy (e.g., `access customers edit=role:admin|owner:account_manager`).
   - **Infrastructure Capability:** Explicit capability granted to the executing authority class / application (e.g., `data:customers:write`).
4. **Isolated Adapter Boundary:** Dynamic discovery of tools or schemas (e.g., MCP `list_tools`) does NOT grant execution permission. Every invocation is checked against explicit granted capabilities.
5. **Deterministic Sanitization & Redaction:** Automated redaction protects logs, error dumps, audit trails, and AI prompt contexts from leaking credentials, auth tokens, or unmasked sensitive data.

---

## 2. Capability Architecture & Provenance

Capabilities are structured strings with strict namespace boundaries:
- `data:<resource>:<read|write|delete>`
- `connector:<connector_id>:<action_id>`
- `secret:<secret_id>:use`
- `network:<domain_or_ip>:<port>`
- `ai:data:<resource>:read`

### Authority Classes
- `user`: Authenticated human end-user.
- `application`: Executing AIR application logic.
- `ai`: AI assistant context and automated generation.
- `runtime`: Trusted system runtime host.

### Capability Set & Diff
The runtime tracks capability sets with complete provenance (source file, granter, timestamp). CLI tooling provides inspection and privilege escalation detection:
```bash
air inspect capabilities app.air
air inspect security app.air
air inspect capability-diff old.air new.air
```

---

## 3. Secret Management & Adapter Boundary

### `SecretHandle`
- Uses JavaScript private class fields (`#value`) to prevent accidental serialization.
- Overrides `toJSON()` to return `[SECRET_HANDLE_PROTECTED]`.
- Unwrapping requires an explicit trusted caller reference.

### `SecretProvider` & Rotation
- `DevelopmentSecretProvider` resolves secrets from environment variables or secure in-memory stores.
- Supports runtime secret rotation via `rotateSecret(secretId, newValue)` without restarting the application or changing `.air` source code.

---

## 4. Network Destination Policy & SSRF Protection

All outbound HTTP connectors (`RestConnectorAdapter`) enforce strict destination validation:
- Block private IP ranges (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`, `127.0.0.1`, `169.254.169.254`) by default unless explicitly allowed.
- Intercept HTTP redirects (`301`, `302`, `303`, `307`, `308`) and re-validate destination targets against `NetworkDestinationPolicy` before following them.

---

## 5. SQL Identifier Validation & Injection Defense

Dynamic SQL generation within `SqliteDataAdapter` and `PostgresDataAdapter` strictly validates all table, column, and sort identifiers using `/^[a-zA-Z_][a-zA-Z0-9_]*$/`. Parameterized queries (`$1`, `$2`, `?`) handle all values, preventing SQL injection across both data values and schema identifiers.

---

## 6. AI Context Safety

The runtime's `toAiContext()` model extracts metadata-only schemas by default:
- Record instances are omitted unless granted `ai:data:<resource>:read`.
- Sensitive and secret fields are automatically masked or stripped.
- Header values in connector definitions (e.g. `Authorization: Bearer ...`) are redacted before being passed to AI prompt contexts.
