/**
 * AIR Structured Observability, Component Health, Incident Model, and Deterministic Resilience
 * 
 * Implements:
 * 1. Normalized Operational Error Taxonomy
 * 2. Versioned Structured Operational Event Model & Redaction Boundary
 * 3. Component Health Registry & Dependency Graph Propagation
 * 4. Deterministic Incident Correlation, Timeline, and Read-Only Diagnostic Context
 * 5. Bounded Resilience: Retry with Backoff, Circuit Breaker, Budgets, Single-Flight
 * 6. Trusted RecoveryAdapter & Two-Key Recovery Authorization (Policy + Capability)
 * 7. Bounded In-Memory Operational Store
 * 8. Development-Only Failure Injector (Disabled in Production)
 * 9. Safe User vs Operator Projections
 */

import { FAILURE_CATEGORIES, AdapterError } from "./data.mjs";
import { SecurityError, SECURITY_ERROR_CODES, globalRedactor } from "./security.mjs";

/**
 * Normalized Operational Error Codes
 */
export const OPERATIONAL_ERROR_CODES = Object.freeze({
  REPRESENTATION_NOT_FOUND: "AIR_REPRESENTATION_NOT_FOUND",
  REPRESENTATION_INVALID: "AIR_REPRESENTATION_INVALID",
  RUNTIME_UNAVAILABLE: "AIR_RUNTIME_UNAVAILABLE",
  DATA_SOURCE_UNAVAILABLE: "AIR_DATA_SOURCE_UNAVAILABLE",
  DATA_SOURCE_TIMEOUT: "AIR_DATA_SOURCE_TIMEOUT",
  CONNECTOR_UNAVAILABLE: "AIR_CONNECTOR_UNAVAILABLE",
  CONNECTOR_TIMEOUT: "AIR_CONNECTOR_TIMEOUT",
  SECRET_UNAVAILABLE: "AIR_SECRET_UNAVAILABLE",
  DEPENDENCY_UNAVAILABLE: "AIR_DEPENDENCY_UNAVAILABLE",
  OPERATION_TIMEOUT: "AIR_OPERATION_TIMEOUT",
  RECOVERY_EXHAUSTED: "AIR_RECOVERY_EXHAUSTED",
  RECOVERY_DENIED: "AIR_RECOVERY_DENIED",
  CIRCUIT_OPEN: "AIR_CIRCUIT_OPEN",
  IDEMPOTENCY_REQUIRED: "AIR_IDEMPOTENCY_REQUIRED"
});

/**
 * Operational Event Types
 */
export const EVENT_TYPES = Object.freeze({
  // Application lifecycle
  APP_LOAD_STARTED: "app.load.started",
  APP_LOAD_SUCCEEDED: "app.load.succeeded",
  APP_LOAD_FAILED: "app.load.failed",
  APP_VALIDATION_FAILED: "app.validation.failed",

  // Request lifecycle
  REQUEST_STARTED: "request.started",
  REQUEST_SUCCEEDED: "request.succeeded",
  REQUEST_FAILED: "request.failed",
  REQUEST_TIMEOUT: "request.timeout",

  // Data layer
  DATA_OPERATION_FAILED: "data.operation.failed",
  DATA_UNAVAILABLE: "data.unavailable",
  DATA_TIMEOUT: "data.timeout",
  DATA_SLOW: "data.slow",

  // Connectors
  CONNECTOR_OPERATION_FAILED: "connector.operation.failed",
  CONNECTOR_UNAVAILABLE: "connector.unavailable",
  CONNECTOR_TIMEOUT: "connector.timeout",

  // Secrets
  SECRET_UNAVAILABLE: "secret.unavailable",

  // Runtime
  RUNTIME_STARTED: "runtime.started",
  RUNTIME_UNHEALTHY: "runtime.unhealthy",
  RUNTIME_RECOVERED: "runtime.recovered",

  // Resilience & Recovery
  RECOVERY_STARTED: "recovery.started",
  RECOVERY_ATTEMPTED: "recovery.attempted",
  RECOVERY_SUCCEEDED: "recovery.succeeded",
  RECOVERY_FAILED: "recovery.failed",
  RECOVERY_EXHAUSTED: "recovery.exhausted",

  // Security audit integration
  SECURITY_AUDIT: "security.audit",
  SECURITY_DENIED: "security.denied"
});

/**
 * Severity Levels
 */
export const SEVERITY_LEVELS = Object.freeze({
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical"
});

/**
 * Health States
 */
export const HEALTH_STATES = Object.freeze({
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  UNHEALTHY: "unhealthy",
  UNKNOWN: "unknown"
});

/**
 * Component Types
 */
export const COMPONENT_TYPES = Object.freeze({
  RUNTIME: "runtime",
  APPLICATION: "application",
  APPLICATION_REPRESENTATION: "application_representation",
  DATA_SOURCE: "data_source",
  CONNECTOR: "connector",
  EXTERNAL_DEPENDENCY: "external_dependency",
  SECRET_PROVIDER: "secret_provider",
  MANAGED_SERVICE: "managed_service"
});

/**
 * Circuit Breaker States
 */
export const CIRCUIT_STATES = Object.freeze({
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half_open"
});

/**
 * User Impact Categories
 */
export const USER_IMPACT = Object.freeze({
  NONE: "none",
  DEGRADED: "degraded",
  PARTIAL_UNAVAILABLE: "partial_unavailable",
  UNAVAILABLE: "unavailable"
});

/**
 * Incident Statuses
 */
export const INCIDENT_STATUS = Object.freeze({
  OPEN: "open",
  RECOVERING: "recovering",
  RESOLVED: "resolved",
  UNRESOLVED: "unresolved"
});

/**
 * Deterministic Failure Classification Table
 */
export const FAILURE_CLASSIFICATIONS = Object.freeze({
  [OPERATIONAL_ERROR_CODES.REPRESENTATION_NOT_FOUND]: {
    componentType: COMPONENT_TYPES.APPLICATION_REPRESENTATION,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: false,
    retryable: false,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.ERROR,
    userImpact: USER_IMPACT.UNAVAILABLE,
    httpStatus: 404,
    safeUserTitle: "Application Unavailable",
    safeUserMessage: "The application definition could not be loaded."
  },
  [OPERATIONAL_ERROR_CODES.REPRESENTATION_INVALID]: {
    componentType: COMPONENT_TYPES.APPLICATION_REPRESENTATION,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: false,
    retryable: false,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.ERROR,
    userImpact: USER_IMPACT.UNAVAILABLE,
    httpStatus: 400,
    safeUserTitle: "Application Error",
    safeUserMessage: "The application definition is invalid."
  },
  [OPERATIONAL_ERROR_CODES.RUNTIME_UNAVAILABLE]: {
    componentType: COMPONENT_TYPES.RUNTIME,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: true,
    retryable: true,
    restartEligible: true,
    defaultSeverity: SEVERITY_LEVELS.CRITICAL,
    userImpact: USER_IMPACT.UNAVAILABLE,
    httpStatus: 503,
    safeUserTitle: "Service Unavailable",
    safeUserMessage: "The runtime service is temporarily unavailable. Please try again shortly."
  },
  [OPERATIONAL_ERROR_CODES.DATA_SOURCE_UNAVAILABLE]: {
    componentType: COMPONENT_TYPES.DATA_SOURCE,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: false,
    retryable: true,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.ERROR,
    userImpact: USER_IMPACT.DEGRADED,
    httpStatus: 503,
    safeUserTitle: "Data Temporarily Unavailable",
    safeUserMessage: "The data service is temporarily unavailable. Please try again shortly."
  },
  [OPERATIONAL_ERROR_CODES.DATA_SOURCE_TIMEOUT]: {
    componentType: COMPONENT_TYPES.DATA_SOURCE,
    healthEffect: HEALTH_STATES.DEGRADED,
    affectsRuntime: false,
    retryable: true,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.WARNING,
    userImpact: USER_IMPACT.DEGRADED,
    httpStatus: 504,
    safeUserTitle: "Request Timeout",
    safeUserMessage: "The data service took too long to respond."
  },
  [OPERATIONAL_ERROR_CODES.CONNECTOR_UNAVAILABLE]: {
    componentType: COMPONENT_TYPES.CONNECTOR,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: false,
    retryable: true,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.ERROR,
    userImpact: USER_IMPACT.PARTIAL_UNAVAILABLE,
    httpStatus: 503,
    safeUserTitle: "Service Integration Unavailable",
    safeUserMessage: "The external integration is temporarily unavailable."
  },
  [OPERATIONAL_ERROR_CODES.CONNECTOR_TIMEOUT]: {
    componentType: COMPONENT_TYPES.CONNECTOR,
    healthEffect: HEALTH_STATES.DEGRADED,
    affectsRuntime: false,
    retryable: true,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.WARNING,
    userImpact: USER_IMPACT.PARTIAL_UNAVAILABLE,
    httpStatus: 504,
    safeUserTitle: "Integration Timeout",
    safeUserMessage: "The external service took too long to respond."
  },
  [OPERATIONAL_ERROR_CODES.SECRET_UNAVAILABLE]: {
    componentType: COMPONENT_TYPES.SECRET_PROVIDER,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: false,
    retryable: false,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.CRITICAL,
    userImpact: USER_IMPACT.UNAVAILABLE,
    httpStatus: 503,
    safeUserTitle: "Configuration Unavailable",
    safeUserMessage: "A required configuration credential could not be resolved."
  },
  [OPERATIONAL_ERROR_CODES.DEPENDENCY_UNAVAILABLE]: {
    componentType: COMPONENT_TYPES.EXTERNAL_DEPENDENCY,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: false,
    retryable: true,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.ERROR,
    userImpact: USER_IMPACT.DEGRADED,
    httpStatus: 503,
    safeUserTitle: "Dependency Unavailable",
    safeUserMessage: "A required system dependency is temporarily unavailable."
  },
  [OPERATIONAL_ERROR_CODES.OPERATION_TIMEOUT]: {
    componentType: COMPONENT_TYPES.RUNTIME,
    healthEffect: HEALTH_STATES.DEGRADED,
    affectsRuntime: false,
    retryable: true,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.WARNING,
    userImpact: USER_IMPACT.DEGRADED,
    httpStatus: 504,
    safeUserTitle: "Operation Timeout",
    safeUserMessage: "The operation timed out."
  },
  [OPERATIONAL_ERROR_CODES.RECOVERY_EXHAUSTED]: {
    componentType: COMPONENT_TYPES.RUNTIME,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: false,
    retryable: false,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.CRITICAL,
    userImpact: USER_IMPACT.UNAVAILABLE,
    httpStatus: 500,
    safeUserTitle: "Recovery Limit Reached",
    safeUserMessage: "Automatic recovery could not restore the service."
  },
  [OPERATIONAL_ERROR_CODES.RECOVERY_DENIED]: {
    componentType: COMPONENT_TYPES.RUNTIME,
    healthEffect: HEALTH_STATES.HEALTHY,
    affectsRuntime: false,
    retryable: false,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.ERROR,
    userImpact: USER_IMPACT.NONE,
    httpStatus: 403,
    safeUserTitle: "Action Denied",
    safeUserMessage: "The requested recovery action is not authorized."
  },
  [OPERATIONAL_ERROR_CODES.CIRCUIT_OPEN]: {
    componentType: COMPONENT_TYPES.EXTERNAL_DEPENDENCY,
    healthEffect: HEALTH_STATES.UNHEALTHY,
    affectsRuntime: false,
    retryable: false,
    restartEligible: false,
    defaultSeverity: SEVERITY_LEVELS.WARNING,
    userImpact: USER_IMPACT.DEGRADED,
    httpStatus: 503,
    safeUserTitle: "Circuit Breaker Open",
    safeUserMessage: "The downstream service is currently unavailable. Failing fast."
  }
});

let _counter = 1;
function nextId(prefix = "evt") {
  return `${prefix}_${Date.now()}_${_counter++}`;
}

/**
 * Standard Operational Error
 */
export class OperationalError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "OperationalError";
    this.code = code;
    this.component = options.component ?? "unknown";
    this.requestId = options.requestId ?? null;
    this.incidentId = options.incidentId ?? null;
    this.details = globalRedactor.redactObject(options.details ?? {});

    const classification = FAILURE_CLASSIFICATIONS[code] ?? {
      httpStatus: 500,
      retryable: false,
      restartEligible: false,
      userImpact: USER_IMPACT.UNAVAILABLE,
      safeUserTitle: "Operational Error",
      safeUserMessage: "An unexpected operational error occurred."
    };

    this.httpStatus = options.httpStatus ?? classification.httpStatus;
    this.retryable = options.retryable ?? classification.retryable;
    this.restartEligible = options.restartEligible ?? classification.restartEligible;
    this.userImpact = classification.userImpact;
    this.safeUserTitle = classification.safeUserTitle;
    this.safeUserMessage = classification.safeUserMessage;
  }

  toUserError() {
    return {
      title: this.safeUserTitle,
      message: this.safeUserMessage,
      reference: this.requestId || this.incidentId || `ref_${Date.now()}`,
      impact: this.userImpact,
      status: this.httpStatus
    };
  }

  toJSON() {
    return {
      code: this.code,
      name: this.name,
      component: this.component,
      httpStatus: this.httpStatus,
      requestId: this.requestId,
      incidentId: this.incidentId,
      message: globalRedactor.redactString(this.message),
      retryable: this.retryable,
      restartEligible: this.restartEligible,
      details: this.details
    };
  }
}

/**
 * Structured Operational Event
 */
export class OperationalEvent {
  constructor(options = {}) {
    this.id = options.id ?? nextId("evt");
    this.version = 1;
    this.timestamp = options.timestamp ?? new Date().toISOString();
    this.severity = options.severity ?? SEVERITY_LEVELS.INFO;
    this.event_type = options.event_type;
    this.application = options.application ?? "system";
    this.component = options.component ?? "unknown";
    this.operation = options.operation ?? "unknown";
    this.request_id = options.request_id ?? null;
    this.trace_id = options.trace_id ?? null;
    this.incident_id = options.incident_id ?? null;
    this.actor_id = options.actor_id ?? null;
    this.resource = options.resource ?? null;
    this.adapter = options.adapter ?? null;
    this.connector = options.connector ?? null;
    this.category = options.category ?? null;
    this.metadata = globalRedactor.redactObject(options.metadata ?? {});
  }

  toJSON() {
    return {
      id: this.id,
      version: this.version,
      timestamp: this.timestamp,
      severity: this.severity,
      event_type: this.event_type,
      application: this.application,
      component: this.component,
      operation: this.operation,
      request_id: this.request_id,
      trace_id: this.trace_id,
      incident_id: this.incident_id,
      actor_id: this.actor_id,
      resource: this.resource,
      adapter: this.adapter,
      connector: this.connector,
      category: this.category,
      metadata: this.metadata
    };
  }
}

/**
 * Incident Model
 */
export class Incident {
  constructor(options = {}) {
    this.incident_id = options.incident_id ?? nextId("inc");
    this.opened_at = options.opened_at ?? new Date().toISOString();
    this.status = options.status ?? INCIDENT_STATUS.OPEN;
    this.severity = options.severity ?? SEVERITY_LEVELS.ERROR;
    this.application = options.application ?? "system";
    this.primary_component = options.primary_component ?? "unknown";
    this.failure_code = options.failure_code ?? "UNKNOWN_FAILURE";
    this.event_ids = [...(options.event_ids ?? [])];
    this.events = [...(options.events ?? [])];
    this.current_health = options.current_health ?? HEALTH_STATES.UNHEALTHY;
    this.recovery_status = options.recovery_status ?? "none";
    this.summary = globalRedactor.redactString(options.summary ?? "Incident recorded");
    this.closed_at = options.closed_at ?? null;
    this.resolution_reason = options.resolution_reason ?? null;
    this.recovery_attempts = [...(options.recovery_attempts ?? [])];
  }

  addEvent(event) {
    if (!this.event_ids.includes(event.id)) {
      this.event_ids.push(event.id);
      this.events.push(event);
      event.incident_id = this.incident_id;
    }
  }

  recordRecoveryAttempt(attempt) {
    this.recovery_attempts.push({
      timestamp: new Date().toISOString(),
      action: attempt.action,
      attemptNumber: attempt.attemptNumber,
      decision: attempt.decision,
      result: attempt.result,
      reason: globalRedactor.redactString(attempt.reason ?? "")
    });
    this.recovery_status = attempt.result;
  }

  resolve(reason = "Triggering failure condition resolved") {
    this.status = INCIDENT_STATUS.RESOLVED;
    this.closed_at = new Date().toISOString();
    this.resolution_reason = globalRedactor.redactString(reason);
    this.current_health = HEALTH_STATES.HEALTHY;
  }

  getTimeline() {
    const lines = [];
    for (const evt of this.events) {
      const time = evt.timestamp.substring(11, 19);
      lines.push(`${time} [${evt.severity.toUpperCase()}] ${evt.component}: ${evt.event_type} (${evt.operation})`);
    }
    for (const rec of this.recovery_attempts) {
      const time = rec.timestamp.substring(11, 19);
      lines.push(`${time} [RECOVERY] ${rec.action} attempt #${rec.attemptNumber}: ${rec.result} (${rec.reason})`);
    }
    if (this.closed_at) {
      const time = this.closed_at.substring(11, 19);
      lines.push(`${time} [RESOLVED] ${this.resolution_reason}`);
    }
    return lines;
  }

  toDiagnosticContext(healthSnapshot = {}, dependencyGraph = {}) {
    return Object.freeze({
      incident_id: this.incident_id,
      opened_at: this.opened_at,
      closed_at: this.closed_at,
      status: this.status,
      severity: this.severity,
      application: this.application,
      primary_component: this.primary_component,
      failure_code: this.failure_code,
      summary: this.summary,
      timeline: this.getTimeline(),
      component_health: Object.freeze({ ...healthSnapshot }),
      dependency_graph: Object.freeze({ ...dependencyGraph }),
      recovery_attempts: Object.freeze([...this.recovery_attempts]),
      resolution_reason: this.resolution_reason
    });
  }

  toJSON() {
    return {
      incident_id: this.incident_id,
      opened_at: this.opened_at,
      closed_at: this.closed_at,
      status: this.status,
      severity: this.severity,
      application: this.application,
      primary_component: this.primary_component,
      failure_code: this.failure_code,
      event_ids: this.event_ids,
      current_health: this.current_health,
      recovery_status: this.recovery_status,
      summary: this.summary,
      resolution_reason: this.resolution_reason,
      recovery_attempts: this.recovery_attempts
    };
  }
}

/**
 * Deterministic Circuit Breaker
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.componentId = options.componentId;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 10000;
    this.clock = options.clock ?? (() => Date.now());

    this.state = CIRCUIT_STATES.CLOSED;
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.openedAt = null;
    this.probeInFlight = false;
  }

  canExecute() {
    if (this.state === CIRCUIT_STATES.CLOSED) {
      return true;
    }
    const now = this.clock();
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (this.openedAt && (now - this.openedAt >= this.cooldownMs)) {
        this.state = CIRCUIT_STATES.HALF_OPEN;
        this.probeInFlight = true;
        return true; // Allow one probe execution
      }
      return false; // Circuit is open
    }
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      if (!this.probeInFlight) {
        this.probeInFlight = true;
        return true;
      }
      return false; // Probe already in flight, fail fast
    }
    return true;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.probeInFlight = false;
    this.state = CIRCUIT_STATES.CLOSED;
    this.openedAt = null;
  }

  recordFailure() {
    this.consecutiveFailures++;
    this.lastFailureTime = this.clock();
    this.probeInFlight = false;

    if (this.state === CIRCUIT_STATES.HALF_OPEN || this.consecutiveFailures >= this.failureThreshold) {
      this.state = CIRCUIT_STATES.OPEN;
      this.openedAt = this.clock();
    }
  }

  forceState(state) {
    this.state = state;
    if (state === CIRCUIT_STATES.OPEN) {
      this.openedAt = this.clock();
    } else {
      this.openedAt = null;
      this.consecutiveFailures = 0;
    }
  }

  toJSON() {
    return {
      componentId: this.componentId,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.failureThreshold,
      cooldownMs: this.cooldownMs,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null
    };
  }
}

/**
 * Standard Resilience Profiles
 */
export const RESILIENCE_PROFILES = Object.freeze({
  NONE: Object.freeze({
    maxRetries: 0,
    baseDelayMs: 0,
    maxDelayMs: 0,
    circuitThreshold: 0,
    cooldownMs: 0
  }),
  CONSERVATIVE: Object.freeze({
    maxRetries: 1,
    baseDelayMs: 100,
    maxDelayMs: 500,
    circuitThreshold: 5,
    cooldownMs: 30000
  }),
  STANDARD: Object.freeze({
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 2000,
    circuitThreshold: 3,
    cooldownMs: 10000
  }),
  CRITICAL: Object.freeze({
    maxRetries: 5,
    baseDelayMs: 50,
    maxDelayMs: 1000,
    circuitThreshold: 2,
    cooldownMs: 5000
  })
});

/**
 * Deployment Safety Limits (Upper Bounds)
 */
export const DEPLOYMENT_SAFETY_LIMITS = Object.freeze({
  MAX_RETRIES: 5,
  MAX_RESTART_ATTEMPTS: 3,
  MAX_COOLDOWN_MS: 60000,
  MIN_COOLDOWN_MS: 1000
});

/**
 * Resilience Policy Definition
 */
export class ResiliencePolicy {
  constructor(options = {}) {
    const profile = RESILIENCE_PROFILES[options.profile?.toUpperCase()] ?? RESILIENCE_PROFILES.STANDARD;

    // Apply safety limits to protect against runaway configuration
    this.maxRetries = Math.min(
      options.maxRetries ?? profile.maxRetries,
      DEPLOYMENT_SAFETY_LIMITS.MAX_RETRIES
    );
    this.baseDelayMs = options.baseDelayMs ?? profile.baseDelayMs;
    this.maxDelayMs = options.maxDelayMs ?? profile.maxDelayMs;
    this.circuitThreshold = options.circuitThreshold ?? profile.circuitThreshold;
    this.cooldownMs = Math.min(
      Math.max(options.cooldownMs ?? profile.cooldownMs, DEPLOYMENT_SAFETY_LIMITS.MIN_COOLDOWN_MS),
      DEPLOYMENT_SAFETY_LIMITS.MAX_COOLDOWN_MS
    );
    this.maxRestartAttempts = Math.min(
      options.maxRestartAttempts ?? 3,
      DEPLOYMENT_SAFETY_LIMITS.MAX_RESTART_ATTEMPTS
    );
  }

  calculateDelay(attemptNumber) {
    if (attemptNumber <= 0) return 0;
    const exp = Math.pow(2, attemptNumber - 1);
    return Math.min(this.baseDelayMs * exp, this.maxDelayMs);
  }

  isEligibleForRetry(errorCode, operationType, isIdempotent = false) {
    const classification = FAILURE_CLASSIFICATIONS[errorCode];
    if (!classification || !classification.retryable) {
      return false;
    }
    if (operationType === "read" || operationType === "query" || operationType === "healthcheck") {
      return true;
    }
    // Mutations must be explicit with idempotency
    return Boolean(isIdempotent);
  }

  isEligibleForRestart(errorCode, component) {
    if (!component?.restartable) return false;
    const classification = FAILURE_CLASSIFICATIONS[errorCode];
    return Boolean(classification?.restartEligible);
  }
}

/**
 * Bounded Recovery Budget
 */
export class RecoveryBudget {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.windowMs = options.windowMs ?? 60000;
    this.clock = options.clock ?? (() => Date.now());
    this.consumedAttempts = [];
  }

  canAttempt() {
    const now = this.clock();
    this.consumedAttempts = this.consumedAttempts.filter(t => (now - t) < this.windowMs);
    return this.consumedAttempts.length < this.maxAttempts;
  }

  recordAttempt() {
    const now = this.clock();
    this.consumedAttempts.push(now);
  }

  get remaining() {
    const now = this.clock();
    this.consumedAttempts = this.consumedAttempts.filter(t => (now - t) < this.windowMs);
    return Math.max(0, this.maxAttempts - this.consumedAttempts.length);
  }
}

/**
 * Single Flight / Coalescing for concurrent recovery actions
 */
export class SingleFlight {
  constructor() {
    this.inFlight = new Map();
  }

  async execute(key, fn) {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }
    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }
}

/**
 * Base / Trusted Recovery Adapter Interface
 */
export class RecoveryAdapter {
  constructor(id) {
    this.id = id;
  }

  async restart(componentId) {
    throw new Error(`restart not implemented on RecoveryAdapter ${this.id}`);
  }

  async healthcheck(componentId) {
    return { state: HEALTH_STATES.HEALTHY, reason: "Default health check" };
  }
}

/**
 * Test Recovery Adapter for Deterministic Resiliency Tests
 */
export class TestRecoveryAdapter extends RecoveryAdapter {
  constructor(id = "test-recovery-adapter") {
    super(id);
    this.healthy = true;
    this.restartWillSucceed = true;
    this.restartCallCount = 0;
    this.healthcheckCallCount = 0;
  }

  async restart(componentId) {
    this.restartCallCount++;
    if (this.restartWillSucceed) {
      this.healthy = true;
      return true;
    }
    this.healthy = false;
    return false;
  }

  async healthcheck(componentId) {
    this.healthcheckCallCount++;
    return {
      state: this.healthy ? HEALTH_STATES.HEALTHY : HEALTH_STATES.UNHEALTHY,
      reason: this.healthy ? "Component verified healthy" : "Component restart failed"
    };
  }
}

/**
 * Component Health Registry & Dependency Graph Manager
 */
export class HealthManager {
  constructor(options = {}) {
    this.components = new Map();
    this.dependencies = new Map(); // componentId -> Set of dependency componentIds
    this.dependents = new Map();   // dependencyId -> Set of dependent componentIds
    this.clock = options.clock ?? (() => Date.now());
  }

  registerComponent(config) {
    const id = config.id;
    this.components.set(id, {
      id,
      type: config.type ?? COMPONENT_TYPES.EXTERNAL_DEPENDENCY,
      state: config.initialState ?? HEALTH_STATES.HEALTHY,
      reason: config.reason ?? "Registered",
      code: config.code ?? null,
      since: this.clock(),
      lastCheck: this.clock(),
      restartable: Boolean(config.restartable),
      recoveryAdapter: config.recoveryAdapter ?? null,
      healthCheck: config.healthCheck ?? null,
      policyProfile: config.policyProfile ?? "standard",
      criticality: config.criticality ?? "critical",
      metadata: globalRedactor.redactObject(config.metadata ?? {})
    });

    if (!this.dependencies.has(id)) {
      this.dependencies.set(id, new Set());
    }

    if (Array.isArray(config.dependencies)) {
      for (const depId of config.dependencies) {
        this.addDependency(id, depId);
      }
    }
  }

  addDependency(componentId, dependencyId) {
    if (!this.dependencies.has(componentId)) {
      this.dependencies.set(componentId, new Set());
    }
    this.dependencies.get(componentId).add(dependencyId);

    if (!this.dependents.has(dependencyId)) {
      this.dependents.set(dependencyId, new Set());
    }
    this.dependents.get(dependencyId).add(componentId);
  }

  setComponentState(componentId, state, reason = "", code = null) {
    const comp = this.components.get(componentId);
    if (!comp) return;

    const previousState = comp.state;
    comp.state = state;
    comp.reason = globalRedactor.redactString(reason);
    comp.code = code;
    comp.lastCheck = this.clock();
    if (previousState !== state) {
      comp.since = this.clock();
      this.propagateHealth(componentId);
    }
  }

  propagateHealth(dependencyId) {
    const dependents = this.dependents.get(dependencyId);
    if (!dependents) return;

    for (const depId of dependents) {
      const comp = this.components.get(depId);
      if (!comp) continue;

      // Evaluate dependent state based on its dependencies
      const deps = this.dependencies.get(depId) ?? new Set();
      let hasUnhealthyCritical = false;
      let hasDegraded = false;

      for (const dId of deps) {
        const dComp = this.components.get(dId);
        if (!dComp) continue;
        if (dComp.state === HEALTH_STATES.UNHEALTHY) {
          if (dComp.criticality === "critical") {
            hasUnhealthyCritical = true;
          } else {
            hasDegraded = true;
          }
        } else if (dComp.state === HEALTH_STATES.DEGRADED) {
          hasDegraded = true;
        }
      }

      if (hasUnhealthyCritical) {
        comp.state = HEALTH_STATES.DEGRADED; // App is degraded/partial when dependency down
        comp.reason = `Dependency ${dependencyId} is unhealthy`;
      } else if (hasDegraded) {
        comp.state = HEALTH_STATES.DEGRADED;
        comp.reason = `Dependency ${dependencyId} is degraded`;
      } else {
        // All dependencies healthy
        if (comp.state === HEALTH_STATES.DEGRADED) {
          comp.state = HEALTH_STATES.HEALTHY;
          comp.reason = `All dependencies healthy`;
        }
      }
    }
  }

  async checkHealth(componentId) {
    const comp = this.components.get(componentId);
    if (!comp) {
      return { state: HEALTH_STATES.UNKNOWN, reason: `Component ${componentId} not registered` };
    }

    if (typeof comp.healthCheck === "function") {
      try {
        const result = await comp.healthCheck();
        this.setComponentState(componentId, result.state ?? HEALTH_STATES.HEALTHY, result.reason ?? "OK");
        return result;
      } catch (err) {
        const reason = globalRedactor.redactString(err.message);
        this.setComponentState(componentId, HEALTH_STATES.UNHEALTHY, reason, "HEALTH_CHECK_FAILED");
        return { state: HEALTH_STATES.UNHEALTHY, reason };
      }
    }

    return { state: comp.state, reason: comp.reason };
  }

  getComponent(componentId) {
    return this.components.get(componentId);
  }

  getSnapshot() {
    const snapshot = {};
    for (const [id, comp] of this.components.entries()) {
      snapshot[id] = {
        id: comp.id,
        type: comp.type,
        state: comp.state,
        reason: comp.reason,
        code: comp.code,
        since: new Date(comp.since).toISOString(),
        lastCheck: new Date(comp.lastCheck).toISOString(),
        restartable: comp.restartable,
        dependencies: Array.from(this.dependencies.get(id) ?? [])
      };
    }
    return snapshot;
  }

  getDependencyGraph() {
    const graph = {};
    for (const [id, deps] of this.dependencies.entries()) {
      graph[id] = Array.from(deps);
    }
    return graph;
  }
}

/**
 * Bounded In-Memory Operational Store
 */
export class OperationalStore {
  constructor(options = {}) {
    this.maxEvents = options.maxEvents ?? 1000;
    this.maxIncidents = options.maxIncidents ?? 100;
    this.events = [];
    this.incidents = new Map();
    this.metrics = {
      requestsTotal: 0,
      requestsFailed: 0,
      retriesAttempted: 0,
      retriesSucceeded: 0,
      circuitsOpened: 0,
      recoveryAttempts: 0,
      recoverySucceeded: 0
    };
  }

  addEvent(event) {
    if (this.events.length >= this.maxEvents) {
      this.events.shift(); // Evict oldest
    }
    this.events.push(event);

    if (event.event_type === EVENT_TYPES.REQUEST_STARTED) this.metrics.requestsTotal++;
    if (event.event_type === EVENT_TYPES.REQUEST_FAILED) this.metrics.requestsFailed++;
    if (event.event_type === EVENT_TYPES.RECOVERY_ATTEMPTED) this.metrics.recoveryAttempts++;
    if (event.event_type === EVENT_TYPES.RECOVERY_SUCCEEDED) this.metrics.recoverySucceeded++;
  }

  addIncident(incident) {
    if (this.incidents.size >= this.maxIncidents) {
      const oldestKey = this.incidents.keys().next().value;
      this.incidents.delete(oldestKey);
    }
    this.incidents.set(incident.incident_id, incident);
  }

  getIncident(incidentId) {
    return this.incidents.get(incidentId);
  }

  queryEvents(filter = {}) {
    let result = this.events;
    if (filter.component) {
      result = result.filter(e => e.component === filter.component);
    }
    if (filter.incident_id) {
      result = result.filter(e => e.incident_id === filter.incident_id);
    }
    if (filter.event_type) {
      result = result.filter(e => e.event_type === filter.event_type);
    }
    if (filter.severity) {
      result = result.filter(e => e.severity === filter.severity);
    }
    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime();
      result = result.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }
    if (filter.limit) {
      result = result.slice(-filter.limit);
    }
    return result;
  }

  queryIncidents(filter = {}) {
    let result = Array.from(this.incidents.values());
    if (filter.status) {
      result = result.filter(inc => inc.status === filter.status);
    }
    if (filter.primary_component) {
      result = result.filter(inc => inc.primary_component === filter.primary_component);
    }
    if (filter.severity) {
      result = result.filter(inc => inc.severity === filter.severity);
    }
    return result;
  }

  getMetricsSnapshot() {
    return { ...this.metrics };
  }
}

/**
 * Development-Only Failure Injector
 */
export class FailureInjector {
  constructor(options = {}) {
    this.isProduction = options.isProduction ?? (process.env.NODE_ENV === "production");
    this.injectedFailures = new Map();
  }

  inject(scenario, details = {}) {
    if (this.isProduction) {
      throw new SecurityError(
        SECURITY_ERROR_CODES.CAPABILITY_DENIED,
        "Failure injection is strictly prohibited in production mode."
      );
    }
    this.injectedFailures.set(scenario, {
      scenario,
      remaining: details.count ?? 1,
      error: details.error ?? null,
      delayMs: details.delayMs ?? 0
    });
  }

  shouldFail(scenario) {
    if (this.isProduction) return false;
    const rule = this.injectedFailures.get(scenario);
    if (!rule || rule.remaining <= 0) return false;
    rule.remaining--;
    if (rule.remaining <= 0) {
      this.injectedFailures.delete(scenario);
    }
    return true;
  }

  clear() {
    this.injectedFailures.clear();
  }
}

/**
 * Supervisor / Operational Engine
 */
export class OperationalEngine {
  constructor(options = {}) {
    this.healthManager = options.healthManager ?? new HealthManager();
    this.store = options.store ?? new OperationalStore();
    this.capabilityEngine = options.capabilityEngine ?? null;
    this.failureInjector = options.failureInjector ?? new FailureInjector();
    this.singleFlight = new SingleFlight();
    this.circuitBreakers = new Map();
    this.recoveryBudgets = new Map();
    this.policies = new Map();
    this.correlationWindowMs = options.correlationWindowMs ?? 60000;
    this.clock = options.clock ?? (() => Date.now());
  }

  getCircuitBreaker(componentId, options = {}) {
    if (!this.circuitBreakers.has(componentId)) {
      this.circuitBreakers.set(
        componentId,
        new CircuitBreaker({
          componentId,
          failureThreshold: options.failureThreshold ?? 3,
          cooldownMs: options.cooldownMs ?? 10000,
          clock: this.clock
        })
      );
    }
    return this.circuitBreakers.get(componentId);
  }

  getRecoveryBudget(componentId, options = {}) {
    if (!this.recoveryBudgets.has(componentId)) {
      this.recoveryBudgets.set(
        componentId,
        new RecoveryBudget({
          maxAttempts: options.maxAttempts ?? 3,
          windowMs: options.windowMs ?? 60000,
          clock: this.clock
        })
      );
    }
    return this.recoveryBudgets.get(componentId);
  }

  getPolicy(componentId) {
    return this.policies.get(componentId) ?? new ResiliencePolicy();
  }

  setPolicy(componentId, policy) {
    this.policies.set(componentId, policy instanceof ResiliencePolicy ? policy : new ResiliencePolicy(policy));
  }

  emitEvent(event) {
    const opEvent = event instanceof OperationalEvent ? event : new OperationalEvent(event);
    this.store.addEvent(opEvent);
    return opEvent;
  }

  /**
   * Deterministic Event & Incident Correlation
   */
  correlateFailure(error, context = {}) {
    const code = error.code ?? OPERATIONAL_ERROR_CODES.RUNTIME_UNAVAILABLE;
    const component = context.component ?? error.component ?? "unknown";
    const app = context.application ?? "system";
    const classification = FAILURE_CLASSIFICATIONS[code];

    // Check existing open/recovering incidents for same (app, component, code)
    const openIncidents = this.store.queryIncidents({ primary_component: component });
    let incident = openIncidents.find(
      inc => inc.application === app &&
             inc.failure_code === code &&
             (inc.status === INCIDENT_STATUS.OPEN || inc.status === INCIDENT_STATUS.RECOVERING)
    );

    if (!incident) {
      incident = new Incident({
        application: app,
        primary_component: component,
        failure_code: code,
        severity: classification?.defaultSeverity ?? SEVERITY_LEVELS.ERROR,
        current_health: classification?.healthEffect ?? HEALTH_STATES.UNHEALTHY,
        summary: `${classification?.safeUserTitle ?? "Failure"}: ${globalRedactor.redactString(error.message)}`
      });
      this.store.addIncident(incident);
    }

    const event = this.emitEvent({
      event_type: context.eventType ?? EVENT_TYPES.DATA_OPERATION_FAILED,
      severity: incident.severity,
      application: app,
      component,
      operation: context.operation ?? "execute",
      request_id: context.requestId ?? null,
      incident_id: incident.incident_id,
      category: error.category ?? "failure",
      metadata: { errorCode: code, message: globalRedactor.redactString(error.message) }
    });

    incident.addEvent(event);
    return { incident, event };
  }

  /**
   * Two-Key Recovery Execution
   */
  async executeRecovery(action, componentId, context = {}) {
    const component = this.healthManager.getComponent(componentId);
    if (!component) {
      throw new OperationalError(
        OPERATIONAL_ERROR_CODES.RECOVERY_DENIED,
        `Component ${componentId} is not registered for recovery.`
      );
    }

    const policy = this.getPolicy(componentId);
    const failureCode = context.failureCode ?? OPERATIONAL_ERROR_CODES.RUNTIME_UNAVAILABLE;

    // KEY 1: Policy Eligibility Check
    let isEligible = false;
    if (action === "restart") {
      isEligible = policy.isEligibleForRestart(failureCode, component);
    } else if (action === "retry" || action === "healthcheck") {
      isEligible = true;
    }

    if (!isEligible) {
      this.emitEvent({
        event_type: EVENT_TYPES.RECOVERY_FAILED,
        severity: SEVERITY_LEVELS.WARNING,
        component: componentId,
        operation: action,
        metadata: { reason: `Action ${action} is not eligible under policy for ${failureCode}` }
      });
      throw new OperationalError(
        OPERATIONAL_ERROR_CODES.RECOVERY_DENIED,
        `Recovery action '${action}' is not policy-eligible for component '${componentId}' with failure '${failureCode}'.`
      );
    }

    // KEY 2: Infrastructure Operational Capability Check
    if (this.capabilityEngine) {
      const requiredCapability = `recovery:${componentId}:${action}`;
      this.capabilityEngine.assertCapability(requiredCapability, {
        authorityClass: "operational"
      });
    }

    // Recovery Budget Check
    const budget = this.getRecoveryBudget(componentId, { maxAttempts: policy.maxRestartAttempts });
    if (!budget.canAttempt()) {
      this.emitEvent({
        event_type: EVENT_TYPES.RECOVERY_EXHAUSTED,
        severity: SEVERITY_LEVELS.CRITICAL,
        component: componentId,
        operation: action,
        metadata: { reason: "Recovery budget exhausted" }
      });
      if (context.incident) {
        context.incident.recordRecoveryAttempt({
          action,
          attemptNumber: policy.maxRestartAttempts + 1,
          decision: "denied",
          result: "exhausted",
          reason: "Recovery budget exhausted"
        });
      }
      throw new OperationalError(
        OPERATIONAL_ERROR_CODES.RECOVERY_EXHAUSTED,
        `Recovery budget exhausted for component '${componentId}'.`
      );
    }

    // Single-Flight Coalescing: Ensure only 1 recovery action runs at a time for this component
    return this.singleFlight.execute(`recovery:${componentId}:${action}`, async () => {
      budget.recordAttempt();
      const attemptNumber = policy.maxRestartAttempts - budget.remaining;

      this.emitEvent({
        event_type: EVENT_TYPES.RECOVERY_ATTEMPTED,
        severity: SEVERITY_LEVELS.INFO,
        component: componentId,
        operation: action,
        metadata: { attemptNumber }
      });

      const recoveryAdapter = component.recoveryAdapter;
      if (!recoveryAdapter) {
        throw new OperationalError(
          OPERATIONAL_ERROR_CODES.RECOVERY_DENIED,
          `No RecoveryAdapter configured for component '${componentId}'.`
        );
      }

      let actionResult = false;
      try {
        if (action === "restart") {
          actionResult = await recoveryAdapter.restart(componentId);
        } else if (action === "healthcheck") {
          const hc = await recoveryAdapter.healthcheck(componentId);
          actionResult = hc.state === HEALTH_STATES.HEALTHY;
        }
      } catch (err) {
        actionResult = false;
      }

      // Mandatory Post-Recovery Verification
      const postHealth = await this.healthManager.checkHealth(componentId);
      const isHealthy = actionResult && postHealth.state === HEALTH_STATES.HEALTHY;

      if (isHealthy) {
        this.emitEvent({
          event_type: EVENT_TYPES.RECOVERY_SUCCEEDED,
          severity: SEVERITY_LEVELS.INFO,
          component: componentId,
          operation: action,
          metadata: { attemptNumber }
        });

        // Reset circuit breaker
        const cb = this.circuitBreakers.get(componentId);
        if (cb) cb.recordSuccess();

        if (context.incident) {
          context.incident.recordRecoveryAttempt({
            action,
            attemptNumber,
            decision: "executed",
            result: "succeeded",
            reason: "Post-recovery health check verified healthy"
          });
          context.incident.resolve("Component recovered and verified healthy");
        }
        return { success: true, health: postHealth };
      } else {
        this.emitEvent({
          event_type: EVENT_TYPES.RECOVERY_FAILED,
          severity: SEVERITY_LEVELS.ERROR,
          component: componentId,
          operation: action,
          metadata: { attemptNumber, reason: postHealth.reason }
        });

        if (context.incident) {
          context.incident.recordRecoveryAttempt({
            action,
            attemptNumber,
            decision: "executed",
            result: "failed",
            reason: postHealth.reason
          });
        }
        return { success: false, health: postHealth };
      }
    });
  }

  /**
   * Resilient Execution Wrapper: Circuit Breaker + Retry
   */
  async executeWithResilience(componentId, operationType, fn, options = {}) {
    const cb = this.getCircuitBreaker(componentId, options);
    const policy = this.getPolicy(componentId);
    const maxRetries = options.maxRetries ?? policy.maxRetries;
    const isIdempotent = options.isIdempotent ?? (operationType === "read" || operationType === "query");

    if (!cb.canExecute()) {
      const err = new OperationalError(
        OPERATIONAL_ERROR_CODES.CIRCUIT_OPEN,
        `Circuit breaker is OPEN for component '${componentId}'. Failing fast.`,
        { component: componentId }
      );
      this.correlateFailure(err, { component: componentId, operation: operationType });
      throw err;
    }

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        const result = await fn();
        cb.recordSuccess();
        return result;
      } catch (rawError) {
        // Map error to normalized OperationalError if not already
        const err = rawError instanceof OperationalError ? rawError : this.mapError(rawError, componentId);
        cb.recordFailure();

        const { incident } = this.correlateFailure(err, {
          component: componentId,
          operation: operationType,
          requestId: options.requestId
        });

        const isRetryable = policy.isEligibleForRetry(err.code, operationType, isIdempotent);

        if (isRetryable && attempt <= maxRetries) {
          const delay = policy.calculateDelay(attempt);
          this.emitEvent({
            event_type: EVENT_TYPES.RECOVERY_ATTEMPTED,
            severity: SEVERITY_LEVELS.WARNING,
            component: componentId,
            operation: "retry",
            metadata: { attempt, delay, errorCode: err.code }
          });

          if (delay > 0) {
            await new Promise(res => setTimeout(res, delay));
          }
          continue; // Retry
        }

        // Retries exhausted or non-retryable
        throw err;
      }
    }
  }

  mapError(err, componentId) {
    if (err instanceof OperationalError) return err;

    const message = globalRedactor.redactString(err.message || "Unknown error");
    let code = OPERATIONAL_ERROR_CODES.RUNTIME_UNAVAILABLE;

    if (err.category === FAILURE_CATEGORIES.TIMEOUT || message.includes("timeout") || message.includes("timed out")) {
      code = componentId.startsWith("connector")
        ? OPERATIONAL_ERROR_CODES.CONNECTOR_TIMEOUT
        : OPERATIONAL_ERROR_CODES.DATA_SOURCE_TIMEOUT;
    } else if (err.category === FAILURE_CATEGORIES.UNAVAILABLE || message.includes("ECONNREFUSED") || message.includes("503")) {
      code = componentId.startsWith("connector")
        ? OPERATIONAL_ERROR_CODES.CONNECTOR_UNAVAILABLE
        : OPERATIONAL_ERROR_CODES.DATA_SOURCE_UNAVAILABLE;
    } else if (err.code === "404" || message.includes("404") || message.includes("not found")) {
      code = OPERATIONAL_ERROR_CODES.REPRESENTATION_NOT_FOUND;
    }

    return new OperationalError(code, message, { component: componentId });
  }

  getOperatorSnapshot() {
    return {
      runtimeHealth: this.healthManager.getSnapshot(),
      dependencyGraph: this.healthManager.getDependencyGraph(),
      openIncidents: this.store.queryIncidents({ status: INCIDENT_STATUS.OPEN }).map(i => i.toJSON()),
      circuitBreakers: Array.from(this.circuitBreakers.values()).map(cb => cb.toJSON()),
      metrics: this.store.getMetricsSnapshot()
    };
  }
}
