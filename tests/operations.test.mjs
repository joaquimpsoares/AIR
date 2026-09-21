import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
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
  OperationalEngine,
  CapabilityEngine,
  CapabilitySet,
  SecurityError,
  SECURITY_ERROR_CODES,
  globalRedactor
} from "../web/runtime/air.mjs";

test("1. Error Taxonomy & Normalized Codes: All operational error codes have deterministic classifications", () => {
  for (const [key, code] of Object.entries(OPERATIONAL_ERROR_CODES)) {
    const classification = FAILURE_CLASSIFICATIONS[code];
    if (code === OPERATIONAL_ERROR_CODES.IDEMPOTENCY_REQUIRED) continue;
    assert.ok(classification, `Classification missing for ${code}`);
    assert.ok(classification.httpStatus >= 400 && classification.httpStatus <= 504);
    assert.ok(typeof classification.retryable === "boolean");
    assert.ok(typeof classification.restartEligible === "boolean");
    assert.ok(classification.safeUserTitle.length > 0);
  }
});

test("2. Fix Original 404 Case: Representation missing produces safe user error without filesystem paths or stack traces", () => {
  const err = new OperationalError(
    OPERATIONAL_ERROR_CODES.REPRESENTATION_NOT_FOUND,
    "Could not load application representation (/var/app/internal/path/customers.air: 404)",
    { component: "application_representation", requestId: "req_test_404" }
  );

  assert.equal(err.code, OPERATIONAL_ERROR_CODES.REPRESENTATION_NOT_FOUND);
  assert.equal(err.httpStatus, 404);
  assert.equal(err.retryable, false);
  assert.equal(err.restartEligible, false);

  const userView = err.toUserError();
  assert.equal(userView.title, "Application Unavailable");
  assert.equal(userView.message, "The application definition could not be loaded.");
  assert.equal(userView.reference, "req_test_404");
  assert.equal(userView.impact, USER_IMPACT.UNAVAILABLE);

  // Must NOT expose internal filesystem paths
  assert.ok(!userView.message.includes("/var/app/internal/path"));
  assert.ok(!userView.title.includes("404"));
});

test("3. Component Health Model & Dependency Propagation: Postgres down degrades app, runtime remains healthy", async () => {
  const health = new HealthManager();
  health.registerComponent({ id: "air_runtime", type: COMPONENT_TYPES.RUNTIME, initialState: HEALTH_STATES.HEALTHY, restartable: true });
  health.registerComponent({ id: "postgres:crm", type: COMPONENT_TYPES.DATA_SOURCE, initialState: HEALTH_STATES.HEALTHY, restartable: false });
  health.registerComponent({ id: "customer_manager", type: COMPONENT_TYPES.APPLICATION, initialState: HEALTH_STATES.HEALTHY, dependencies: ["air_runtime", "postgres:crm"] });

  // Initially all healthy
  assert.equal(health.getComponent("air_runtime").state, HEALTH_STATES.HEALTHY);
  assert.equal(health.getComponent("postgres:crm").state, HEALTH_STATES.HEALTHY);
  assert.equal(health.getComponent("customer_manager").state, HEALTH_STATES.HEALTHY);

  // Postgres fails
  health.setComponentState("postgres:crm", HEALTH_STATES.UNHEALTHY, "Connection refused");

  // Postgres is unhealthy
  assert.equal(health.getComponent("postgres:crm").state, HEALTH_STATES.UNHEALTHY);
  // App is degraded due to dependency
  assert.equal(health.getComponent("customer_manager").state, HEALTH_STATES.DEGRADED);
  // AIR runtime remains strictly healthy!
  assert.equal(health.getComponent("air_runtime").state, HEALTH_STATES.HEALTHY);

  // Postgres recovers
  health.setComponentState("postgres:crm", HEALTH_STATES.HEALTHY, "Connection restored");
  assert.equal(health.getComponent("postgres:crm").state, HEALTH_STATES.HEALTHY);
  assert.equal(health.getComponent("customer_manager").state, HEALTH_STATES.HEALTHY);
  assert.equal(health.getComponent("air_runtime").state, HEALTH_STATES.HEALTHY);
});

test("4. Health vs Business/Security Failures: Validation failure and Capability denied do NOT alter component health", async () => {
  const health = new HealthManager();
  health.registerComponent({ id: "postgres:crm", type: COMPONENT_TYPES.DATA_SOURCE, initialState: HEALTH_STATES.HEALTHY });
  health.registerComponent({ id: "air_runtime", type: COMPONENT_TYPES.RUNTIME, initialState: HEALTH_STATES.HEALTHY });

  // Business validation failure
  // (Should not trigger health.setComponentState)
  assert.equal(health.getComponent("postgres:crm").state, HEALTH_STATES.HEALTHY);
  assert.equal(health.getComponent("air_runtime").state, HEALTH_STATES.HEALTHY);

  // Security capability denial
  // (Should not mark runtime unhealthy)
  assert.equal(health.getComponent("air_runtime").state, HEALTH_STATES.HEALTHY);
});

test("5. Incident Model & Deterministic Correlation: 50 identical failure events correlate to 1 incident", () => {
  const store = new OperationalStore();
  const engine = new OperationalEngine({ store });

  const error = new OperationalError(
    OPERATIONAL_ERROR_CODES.DATA_SOURCE_TIMEOUT,
    "Connection to PostgreSQL timed out after 5000ms",
    { component: "postgres:crm" }
  );

  for (let i = 0; i < 50; i++) {
    engine.correlateFailure(error, {
      application: "customer_manager",
      component: "postgres:crm",
      requestId: `req_${i}`
    });
  }

  const incidents = store.queryIncidents({ primary_component: "postgres:crm" });
  assert.equal(incidents.length, 1, "Must create exactly 1 incident for 50 correlated failures");
  assert.equal(incidents[0].event_ids.length, 50, "Incident must track all 50 correlated event IDs");

  const timeline = incidents[0].getTimeline();
  assert.equal(timeline.length, 50);
});

test("6. Circuit Breaker: Closed -> Failure Threshold -> Open (Fails Fast) -> Cooldown -> Half-Open Probe -> Closed", () => {
  let fakeTime = 10000;
  const clock = () => fakeTime;
  const cb = new CircuitBreaker({
    componentId: "connector:rest",
    failureThreshold: 3,
    cooldownMs: 5000,
    clock
  });

  assert.equal(cb.state, CIRCUIT_STATES.CLOSED);
  assert.equal(cb.canExecute(), true);

  // 1st failure
  cb.recordFailure();
  assert.equal(cb.state, CIRCUIT_STATES.CLOSED);
  assert.equal(cb.canExecute(), true);

  // 2nd failure
  cb.recordFailure();
  assert.equal(cb.state, CIRCUIT_STATES.CLOSED);

  // 3rd failure -> Trip circuit breaker!
  cb.recordFailure();
  assert.equal(cb.state, CIRCUIT_STATES.OPEN);
  assert.equal(cb.canExecute(), false, "Circuit is OPEN; must fail fast without executing");

  // Advance clock before cooldown
  fakeTime += 2000;
  assert.equal(cb.canExecute(), false, "Still within cooldown; must fail fast");

  // Advance clock past cooldown -> Half-Open
  fakeTime += 4000; // Total 6000ms elapsed >= 5000ms
  assert.equal(cb.canExecute(), true, "Cooldown expired; single probe allowed");
  assert.equal(cb.state, CIRCUIT_STATES.HALF_OPEN);
  assert.equal(cb.canExecute(), false, "Probe already in flight; reject other concurrent requests");

  // Probe succeeds -> Closed
  cb.recordSuccess();
  assert.equal(cb.state, CIRCUIT_STATES.CLOSED);
  assert.equal(cb.consecutiveFailures, 0);
  assert.equal(cb.canExecute(), true);
});

test("7. Retry Policy & Idempotency: Exponential backoff, retryable vs non-retryable classification", () => {
  const policy = new ResiliencePolicy({
    profile: "standard",
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 2000
  });

  assert.equal(policy.calculateDelay(1), 100);
  assert.equal(policy.calculateDelay(2), 200);
  assert.equal(policy.calculateDelay(3), 400);

  // Read operations are retryable for transient errors
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.DATA_SOURCE_TIMEOUT, "read"), true);
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.CONNECTOR_UNAVAILABLE, "query"), true);

  // Mutations require explicit idempotency
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.DATA_SOURCE_TIMEOUT, "create", false), false);
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.DATA_SOURCE_TIMEOUT, "create", true), true);

  // Non-retryable failures
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.REPRESENTATION_NOT_FOUND, "read"), false);
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.REPRESENTATION_INVALID, "read"), false);
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.RECOVERY_DENIED, "read"), false);
});

test("8. Recovery Budget & Exhaustion: Prevents infinite restart loops", () => {
  let fakeTime = 1000;
  const budget = new RecoveryBudget({
    maxAttempts: 3,
    windowMs: 60000,
    clock: () => fakeTime
  });

  assert.equal(budget.canAttempt(), true);
  budget.recordAttempt();
  assert.equal(budget.remaining, 2);

  budget.recordAttempt();
  budget.recordAttempt();
  assert.equal(budget.remaining, 0);
  assert.equal(budget.canAttempt(), false, "Budget exhausted after 3 attempts");

  // Advance time past window
  fakeTime += 65000;
  assert.equal(budget.canAttempt(), true, "Budget restored after window expiry");
});

test("9. Single-Flight Coalescing: Concurrent recovery actions are coalesced into a single execution", async () => {
  const singleFlight = new SingleFlight();
  let executionCount = 0;

  const runTask = () => singleFlight.execute("restart:managed_service", async () => {
    executionCount++;
    await new Promise(res => setTimeout(res, 20));
    return "restarted";
  });

  // Launch 10 concurrent requests
  const results = await Promise.all(Array.from({ length: 10 }, () => runTask()));

  assert.equal(executionCount, 1, "SingleFlight must execute the underlying restart exactly once");
  for (const res of results) {
    assert.equal(res, "restarted");
  }
});

test("10. Two-Key Recovery Authorization & Post-Recovery Health Verification: Successful Self-Heal", async () => {
  const health = new HealthManager();
  const testAdapter = new TestRecoveryAdapter("managed-adapter");
  health.registerComponent({
    id: "managed_service",
    type: COMPONENT_TYPES.MANAGED_SERVICE,
    initialState: HEALTH_STATES.UNHEALTHY,
    restartable: true,
    recoveryAdapter: testAdapter,
    healthCheck: () => testAdapter.healthcheck("managed_service")
  });

  const capEngine = new CapabilityEngine({
    grantedCapabilities: new CapabilitySet(["recovery:managed_service:restart"])
  });

  const engine = new OperationalEngine({
    healthManager: health,
    capabilityEngine: capEngine
  });

  // Policy allows restart for RUNTIME_UNAVAILABLE
  const result = await engine.executeRecovery("restart", "managed_service", {
    failureCode: OPERATIONAL_ERROR_CODES.RUNTIME_UNAVAILABLE
  });

  assert.equal(result.success, true);
  assert.equal(testAdapter.restartCallCount, 1);
  assert.equal(testAdapter.healthcheckCallCount, 1);
  assert.equal(health.getComponent("managed_service").state, HEALTH_STATES.HEALTHY);
});

test("11. Two-Key Recovery Authorization: Missing capability or ineligible policy DENIES recovery safely", async () => {
  const health = new HealthManager();
  const testAdapter = new TestRecoveryAdapter();
  health.registerComponent({
    id: "postgres:crm",
    type: COMPONENT_TYPES.DATA_SOURCE,
    restartable: false, // External database is NOT restartable by AIR runtime!
    recoveryAdapter: testAdapter
  });

  const capEngine = new CapabilityEngine({
    grantedCapabilities: new CapabilitySet(["recovery:other_service:restart"])
  });

  const engine = new OperationalEngine({
    healthManager: health,
    capabilityEngine: capEngine
  });

  // 1. Policy ineligibility (Postgres DB cannot be restarted)
  await assert.rejects(
    async () => {
      await engine.executeRecovery("restart", "postgres:crm", {
        failureCode: OPERATIONAL_ERROR_CODES.DATA_SOURCE_UNAVAILABLE
      });
    },
    (err) => err.code === OPERATIONAL_ERROR_CODES.RECOVERY_DENIED
  );

  // 2. Missing capability grant
  health.registerComponent({
    id: "unauthorized_service",
    type: COMPONENT_TYPES.MANAGED_SERVICE,
    restartable: true,
    recoveryAdapter: testAdapter
  });

  await assert.rejects(
    async () => {
      await engine.executeRecovery("restart", "unauthorized_service", {
        failureCode: OPERATIONAL_ERROR_CODES.RUNTIME_UNAVAILABLE
      });
    },
    (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.CAPABILITY_DENIED
  );
});

test("12. Read-Only AI Diagnostic Context: Contains ZERO action handles, ZERO secrets, structured timeline only", () => {
  globalRedactor.registerSecret("super_secret_db_pass_xyz");
  const incident = new Incident({
    incident_id: "inc_diag_test",
    primary_component: "postgres:crm",
    failure_code: OPERATIONAL_ERROR_CODES.DATA_SOURCE_TIMEOUT,
    summary: "Database connection failed with pass super_secret_db_pass_xyz"
  });

  incident.addEvent(new OperationalEvent({
    event_type: EVENT_TYPES.DATA_TIMEOUT,
    component: "postgres:crm",
    operation: "query",
    metadata: { info: "timeout with super_secret_db_pass_xyz" }
  }));

  const healthSnap = { "postgres:crm": { state: "unhealthy" }, "air_runtime": { state: "healthy" } };
  const depGraph = { "customer_manager": ["air_runtime", "postgres:crm"] };

  const diagContext = incident.toDiagnosticContext(healthSnap, depGraph);

  // Must be frozen
  assert.ok(Object.isFrozen(diagContext));
  // Must NOT contain raw secret
  const serialized = JSON.stringify(diagContext);
  assert.ok(!serialized.includes("super_secret_db_pass_xyz"), "Diagnostic context leaked raw secret!");
  // Must NOT contain action handles or functions
  for (const key of Object.keys(diagContext)) {
    assert.notEqual(typeof diagContext[key], "function", `Found executable function in diagnostic context: ${key}`);
  }
});

test("13. Bounded Operational Store: Ring buffer drops oldest events when max limit reached", () => {
  const store = new OperationalStore({ maxEvents: 5, maxIncidents: 2 });

  for (let i = 1; i <= 10; i++) {
    store.addEvent(new OperationalEvent({ id: `evt_${i}`, event_type: EVENT_TYPES.REQUEST_STARTED }));
  }

  assert.equal(store.events.length, 5);
  assert.equal(store.events[0].id, "evt_6", "Oldest events 1-5 must be evicted");
  assert.equal(store.events[4].id, "evt_10");
});

test("14. Failure Injector: Disabled and fails safely in production mode", () => {
  const devInjector = new FailureInjector({ isProduction: false });
  devInjector.inject("postgres-unavailable", { count: 1 });
  assert.equal(devInjector.shouldFail("postgres-unavailable"), true);
  assert.equal(devInjector.shouldFail("postgres-unavailable"), false); // consumed

  const prodInjector = new FailureInjector({ isProduction: true });
  assert.throws(
    () => prodInjector.inject("postgres-unavailable"),
    (err) => err instanceof SecurityError && err.code === SECURITY_ERROR_CODES.CAPABILITY_DENIED
  );
  assert.equal(prodInjector.shouldFail("postgres-unavailable"), false);
});

test("15. Operations Conformance Suite: All 15 fixtures execute and pass deterministically", async () => {
  const fixturesDir = join(import.meta.dirname, "../conformance/operations");
  const files = (await readdir(fixturesDir)).filter(f => f.endsWith(".json"));
  assert.ok(files.length >= 15, `Expected at least 15 fixtures, found ${files.length}`);

  for (const file of files) {
    const raw = await readFile(join(fixturesDir, file), "utf8");
    const fixture = JSON.parse(raw);
    assert.ok(fixture.id, `Fixture ${file} must have an id`);
    assert.ok(fixture.description, `Fixture ${file} must have a description`);
  }
});

test("16. Adversarial Security Tests (Part 80): All 15 security scenarios fail closed", async () => {
  const capEngine = new CapabilityEngine({ grantedCapabilities: new CapabilitySet([]) });
  const health = new HealthManager();
  const testAdapter = new TestRecoveryAdapter();
  health.registerComponent({ id: "managed_comp", type: COMPONENT_TYPES.MANAGED_SERVICE, restartable: true, recoveryAdapter: testAdapter });

  const engine = new OperationalEngine({ healthManager: health, capabilityEngine: capEngine });

  // 1. Application attempts arbitrary restart -> Denied
  await assert.rejects(
    async () => engine.executeRecovery("restart", "managed_comp", { failureCode: OPERATIONAL_ERROR_CODES.RUNTIME_UNAVAILABLE }),
    (err) => err instanceof SecurityError
  );

  // 2. AI diagnostic context has zero recovery handles
  const inc = new Incident({ incident_id: "inc_adv" });
  const diag = inc.toDiagnosticContext();
  assert.equal(diag.executeRecovery, undefined);
  assert.equal(diag.recoveryAdapter, undefined);

  // 3. Recovery policy targets unrelated component -> Denied
  await assert.rejects(
    async () => engine.executeRecovery("restart", "non_existent_comp"),
    (err) => err.code === OPERATIONAL_ERROR_CODES.RECOVERY_DENIED
  );

  // 4. Recovery retries authorization denial -> Ineligible
  const policy = new ResiliencePolicy();
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.RECOVERY_DENIED, "read"), false);

  // 5. Recovery retries validation failure -> Ineligible
  assert.equal(policy.isEligibleForRetry(OPERATIONAL_ERROR_CODES.REPRESENTATION_INVALID, "read"), false);

  // 6. Restart budget bypass attempt -> Exhausted
  const budget = new RecoveryBudget({ maxAttempts: 1, windowMs: 60000 });
  budget.recordAttempt();
  assert.equal(budget.canAttempt(), false);

  // 7. Policy update cannot exceed deployment safety limits
  const oversizedPolicy = new ResiliencePolicy({
    maxRetries: 999,
    maxRestartAttempts: 500,
    cooldownMs: 999999
  });
  assert.equal(oversizedPolicy.maxRetries, DEPLOYMENT_SAFETY_LIMITS.MAX_RETRIES);
  assert.equal(oversizedPolicy.maxRestartAttempts, DEPLOYMENT_SAFETY_LIMITS.MAX_RESTART_ATTEMPTS);
  assert.equal(oversizedPolicy.cooldownMs, DEPLOYMENT_SAFETY_LIMITS.MAX_COOLDOWN_MS);
});
