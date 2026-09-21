# AIR Structured Observability, Component Health, Incident Model, and Deterministic Resilience

## Overview

AIR implements a **deterministic, bounded operational resilience architecture** that detects, classifies, correlates, safely reacts to, and audits system and component failures.

AIR adheres to a strict non-negotiable principle: **AI IS NOT THE RECOVERY ENGINE.**
Automated recovery actions are controlled exclusively by deterministic policy and two-key authorization. AI diagnostic layers receive a read-only, sanitized representation without execution handles.

---

## 1. Normalized Error Taxonomy

Operational failures map into stable, normalized error codes:

| Error Code | HTTP Status | Component Type | Retryable | Restart Eligible | Safe User Title |
|---|---|---|---|---|---|
| `AIR_REPRESENTATION_NOT_FOUND` | 404 | `application_representation` | No | No | Application Unavailable |
| `AIR_REPRESENTATION_INVALID` | 400 | `application_representation` | No | No | Application Error |
| `AIR_RUNTIME_UNAVAILABLE` | 503 | `runtime` | Yes | Yes (Managed) | Service Unavailable |
| `AIR_DATA_SOURCE_UNAVAILABLE` | 503 | `data_source` | Yes | No | Data Temporarily Unavailable |
| `AIR_DATA_SOURCE_TIMEOUT` | 504 | `data_source` | Yes | No | Request Timeout |
| `AIR_CONNECTOR_UNAVAILABLE` | 503 | `connector` | Yes | No | Service Integration Unavailable |
| `AIR_CONNECTOR_TIMEOUT` | 504 | `connector` | Yes | No | Integration Timeout |
| `AIR_SECRET_UNAVAILABLE` | 503 | `secret_provider` | No | No | Configuration Unavailable |
| `AIR_DEPENDENCY_UNAVAILABLE` | 503 | `external_dependency` | Yes | No | Dependency Unavailable |
| `AIR_OPERATION_TIMEOUT` | 504 | `runtime` | Yes (Idempotent) | No | Operation Timeout |
| `AIR_RECOVERY_EXHAUSTED` | 500 | `runtime` | No | No | Recovery Limit Reached |
| `AIR_RECOVERY_DENIED` | 403 | `runtime` | No | No | Action Denied |
| `AIR_CIRCUIT_OPEN` | 503 | `external_dependency` | No | No | Circuit Breaker Open |

---

## 2. Structured Operational Event Model

Operational events use a versioned, safe envelope:
```json
{
  "id": "evt_1726946400000_1",
  "version": 1,
  "timestamp": "2026-09-21T19:20:00.000Z",
  "severity": "error",
  "event_type": "data.unavailable",
  "application": "customer-manager",
  "component": "postgres:crm",
  "operation": "query",
  "request_id": "req_123",
  "incident_id": "inc_456",
  "category": "unavailable",
  "metadata": {
    "errorCode": "AIR_DATA_SOURCE_UNAVAILABLE"
  }
}
```

### Event Families
- **Application:** `app.load.started`, `app.load.succeeded`, `app.load.failed`, `app.validation.failed`
- **Request:** `request.started`, `request.succeeded`, `request.failed`, `request.timeout`
- **Data:** `data.operation.failed`, `data.unavailable`, `data.timeout`, `data.slow`
- **Connector:** `connector.operation.failed`, `connector.unavailable`, `connector.timeout`
- **Secret:** `secret.unavailable`
- **Runtime:** `runtime.started`, `runtime.unhealthy`, `runtime.recovered`
- **Recovery:** `recovery.started`, `recovery.attempted`, `recovery.succeeded`, `recovery.failed`, `recovery.exhausted`
- **Security:** `security.audit`, `security.denied`

All operational metadata passes through the `RedactionEngine` to ensure credentials, tokens, and passwords are never logged.

---

## 3. Component Health Model & Dependency Graph

Component states:
- `healthy`: Normal operation.
- `degraded`: Operating under impaired performance or non-critical dependency failure.
- `unhealthy`: Primary operations failing.
- `unknown`: Not yet evaluated.

### Dependency Propagation
When a dependency fails:
- `postgres:crm` = `unhealthy`
- `customer_manager` = `degraded`
- `air_runtime` = `healthy` (CRITICAL: AIR runtime is never restarted due to database failure).

When the dependency recovers:
- `postgres:crm` = `healthy`
- `customer_manager` = `healthy`
- `air_runtime` remains untouched.

---

## 4. Incident Model & Deterministic Correlation

An `Incident` groups related operational failures:
- Correlation criteria: `(application, primary_component, failure_code)` within a time window (default 60s).
- 50 identical backend timeout errors generate **1 Incident** with 50 correlated event IDs, preventing incident storms.
- `Incident.prototype.getTimeline()` produces a deterministic human-readable log.
- `Incident.prototype.toDiagnosticContext()` produces a **read-only, sanitized context** for future AI diagnostics (zero action handles, zero secret leakage).

---

## 5. Bounded Resilience: Retries & Circuit Breaker

### Retry Policies & Profiles
- **Profiles:** `NONE`, `CONSERVATIVE`, `STANDARD`, `CRITICAL`.
- **Precedence:** Deployment Safety Limits (`maxRetries <= 5`, `maxRestartAttempts <= 3`) enforce a hard ceiling on runtime/application overrides.
- **Backoff:** Deterministic exponential backoff `min(maxDelay, baseDelay * 2^(attempt-1))`.
- **Idempotency:** Read operations are retryable; mutations require an explicit idempotency key. Business validation, authorization denials, and 404 representation errors are non-retryable.

### Circuit Breaker
- States: `closed` (normal) -> `open` (tripped after threshold) -> `half_open` (probe allowed after cooldown) -> `closed` (probe succeeded).
- In the `open` state, calls fail fast with `AIR_CIRCUIT_OPEN` to protect downstream dependencies.

### Single-Flight & Recovery Budget
- **Single-Flight:** Multiple concurrent recovery or probe requests are coalesced into a single execution to avoid thundering herds.
- **Recovery Budget:** Limits automatic restarts within a sliding window. Once exhausted, emits `recovery.exhausted` and escalates.

---

## 6. Two-Key Recovery Authorization

Privileged recovery actions (e.g. `restart`) require **two separate keys**:
1. **Key 1 (Policy Eligibility):** Declared policy allows the action for this failure code and component type (e.g., representation 404 or external database down CANNOT trigger runtime restart).
2. **Key 2 (Infrastructure Capability):** Application/host has explicit capability `recovery:<component_id>:<action>`.

### Mandatory Post-Recovery Health Verification
A restart action is only marked `recovery.succeeded` if a subsequent `healthCheck()` verifies the component is `healthy`. Otherwise, it is recorded as `recovery.failed` and consumes budget.

---

## 7. Operator vs User Projections

- **User View (`toUserError()`):** Safe, generic, reference-keyed (e.g. `"Application Unavailable. Reference: req_123"`). Never exposes internal filesystem paths or stack traces.
- **Operator View (`toOperatorStatus()`):** Complete structured topology, health status, open incidents, and circuit states accessible via CLI:
  ```bash
  air status
  air health
  air incidents
  air incident <id>
  air test-failure <scenario>
  ```

---

## 8. Failure Injection (Development Only)

`FailureInjector` allows deterministic failure simulation in development and testing:
- Disabled and forbidden when `NODE_ENV === "production"`.
- Attempting to inject failures in production throws `SecurityError(AIR_CAPABILITY_DENIED)`.
