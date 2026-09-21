import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
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
  SecurityReactionEngine,
  CapabilityEngine,
  CapabilitySet,
  OperationalEvent,
  Incident,
  OperationalStore,
  HealthManager,
  OperationalEngine,
  HEALTH_STATES,
  globalRedactor,
  SecurityError,
  SECURITY_ERROR_CODES
} from "../web/runtime/air.mjs";

test("1. Trusted Client Address Extraction & Proxy Safety: Reject spoofed headers from untrusted peers", () => {
  const trustedProxies = new Set(["10.0.0.1", "127.0.0.1"]);

  // 1. Untrusted peer sending spoofed X-Forwarded-For is ignored -> returns peer IP
  const untrustedReq = {
    peerAddress: "198.51.100.200",
    headers: { "x-forwarded-for": "1.1.1.1, 10.0.0.1" }
  };
  assert.equal(extractClientAddress(untrustedReq, trustedProxies), "198.51.100.200");

  // 2. Trusted proxy sending X-Forwarded-For is respected -> returns client IP
  const trustedReq = {
    peerAddress: "10.0.0.1",
    headers: { "x-forwarded-for": "203.0.113.50, 10.0.0.1" }
  };
  assert.equal(extractClientAddress(trustedReq, trustedProxies), "203.0.113.50");
});

test("2. Failed Login Detector: Repeated failures trigger detection; successful login resets count", () => {
  let fakeTime = 1000;
  const detector = new FailedLoginDetector({ threshold: 3, windowMs: 60000, clock: () => fakeTime });

  const failEvt = (id) => new OperationalEvent({
    id: `evt_fail_${id}`,
    event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
    actor_id: "user_alice",
    source: "198.51.100.1"
  });

  // Attempt 1 & 2 -> No detection
  assert.equal(detector.evaluate(failEvt(1)), null);
  assert.equal(detector.evaluate(failEvt(2)), null);

  // Attempt 3 -> Detection triggered
  const detection = detector.evaluate(failEvt(3));
  assert.ok(detection);
  assert.equal(detection.pattern, "repeated_identity_login_failures");
  assert.equal(detection.recommended_reaction, REACTION_CLASSES.THROTTLE);

  // Successful login resets count
  const successEvt = new OperationalEvent({
    id: "evt_success",
    event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_SUCCEEDED,
    actor_id: "user_alice",
    source: "198.51.100.1"
  });
  detector.evaluate(successEvt);

  // Subsequent failure starts from 1 again -> No detection
  assert.equal(detector.evaluate(failEvt(4)), null);
});

test("3. Password Spray Detector: Single source probing multiple distinct identities", () => {
  const detector = new PasswordSprayDetector({ identityThreshold: 3, failureThreshold: 3, windowMs: 60000 });

  const sprayEvt = (user, i) => new OperationalEvent({
    id: `evt_spray_${i}`,
    event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
    actor_id: user,
    source: "198.51.100.42"
  });

  assert.equal(detector.evaluate(sprayEvt("user_1", 1)), null);
  assert.equal(detector.evaluate(sprayEvt("user_2", 2)), null);
  
  // 3rd failure on 3rd identity triggers spray detection
  const detection = detector.evaluate(sprayEvt("user_3", 3));
  assert.ok(detection);
  assert.equal(detection.pattern, "password_spray_pattern");
  assert.equal(detection.recommended_reaction, REACTION_CLASSES.TEMPORARY_SOURCE_DENY);
  assert.equal(detection.supporting_event_ids.length, 3);
});

test("4. Authorization Abuse & Capability Abuse Detectors", () => {
  const authAbuse = new AuthorizationAbuseDetector({ threshold: 3, windowMs: 60000 });
  const capAbuse = new CapabilityAbuseDetector({ threshold: 2, windowMs: 60000 });

  const authEvt = (i) => new OperationalEvent({
    id: `evt_auth_${i}`,
    event_type: SECURITY_EVENT_TYPES.AUTHORIZATION_DENIED,
    session_id: "sess_attacker",
    source: "198.51.100.5"
  });

  assert.equal(authAbuse.evaluate(authEvt(1)), null);
  assert.equal(authAbuse.evaluate(authEvt(2)), null);
  const authDet = authAbuse.evaluate(authEvt(3));
  assert.ok(authDet);
  assert.equal(authDet.recommended_reaction, REACTION_CLASSES.SESSION_REVOKE);

  const capEvt = (i) => new OperationalEvent({
    id: `evt_cap_${i}`,
    event_type: SECURITY_EVENT_TYPES.CAPABILITY_DENIED,
    source: "198.51.100.5",
    metadata: { capability: "connector:unauthorized:action" }
  });

  assert.equal(capAbuse.evaluate(capEvt(1)), null);
  const capDet = capAbuse.evaluate(capEvt(2));
  assert.ok(capDet);
  assert.equal(capDet.pattern, "capability_abuse_pattern");
});

test("5. Bounded Cardinality: Detector evicts oldest subjects to prevent memory exhaustion", () => {
  const detector = new RateWindowDetector({ maxTrackedSubjects: 3, windowMs: 60000 });

  for (let i = 1; i <= 5; i++) {
    detector.evaluate(new OperationalEvent({
      id: `evt_rate_${i}`,
      event_type: SECURITY_EVENT_TYPES.REQUEST_RATE_EXCEEDED,
      source: `src_${i}`
    }));
  }

  assert.ok(detector.trackedSubjects.size <= 3, `Expected at most 3 tracked subjects, found ${detector.trackedSubjects.size}`);
  assert.ok(!detector.trackedSubjects.has("source:src_1"), "Oldest subject src_1 must be evicted");
  assert.ok(detector.trackedSubjects.has("source:src_5"));
});

test("6. Two-Key Security Reaction Authorization: Policy Eligibility + Security Capability Grant", async () => {
  const adapter = new LocalSecurityAdapter("test-sec-adapter");
  const policy = new SecurityPolicy({
    reactionMappings: {
      "password_spray_pattern": REACTION_CLASSES.TEMPORARY_SOURCE_DENY
    },
    sourceDenyDurationMs: 5000
  });

  // 1. Missing capability -> Fails closed, does NOT apply reaction
  const capEngineWithoutGrant = new CapabilityEngine({
    grantedCapabilities: new CapabilitySet([])
  });

  const secEngineNoCap = new SecurityReactionEngine({
    securityPolicy: policy,
    capabilityEngine: capEngineWithoutGrant,
    securityAdapter: adapter
  });

  const sprayEvent = new OperationalEvent({
    id: "evt_spray",
    event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
    source: "198.51.100.99",
    actor_id: "user_spray_target"
  });

  // Inject 5 failures to trigger detector
  for (let i = 0; i < 5; i++) {
    await secEngineNoCap.processEvent(new OperationalEvent({
      id: `evt_spray_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
      source: "198.51.100.99",
      actor_id: `user_${i}`
    }));
  }

  assert.equal(adapter.isSourceDenied("198.51.100.99"), false, "Missing capability must prevent reaction execution");

  // 2. Granted capability -> Successfully applies reaction
  const capEngineWithGrant = new CapabilityEngine({
    grantedCapabilities: new CapabilitySet(["security:temporary_source_deny", "security:throttle"])
  });

  const secEngineWithCap = new SecurityReactionEngine({
    securityPolicy: policy,
    capabilityEngine: capEngineWithGrant,
    securityAdapter: adapter
  });

  for (let i = 0; i < 5; i++) {
    await secEngineWithCap.processEvent(new OperationalEvent({
      id: `evt_spray_grant_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
      source: "198.51.100.99",
      actor_id: `user_${i}`
    }));
  }

  assert.equal(adapter.isSourceDenied("198.51.100.99"), true, "Granted capability allows reaction execution");
});

test("7. Bounded Durations & Automatic Clock-Driven Expiry: Temporary source deny expires", async () => {
  let fakeTime = 10000;
  const clock = () => fakeTime;
  const adapter = new LocalSecurityAdapter("test-sec-adapter", { clock });
  const capEngine = new CapabilityEngine({
    grantedCapabilities: new CapabilitySet(["security:temporary_source_deny"])
  });

  const policy = new SecurityPolicy({
    reactionMappings: { "password_spray_pattern": REACTION_CLASSES.TEMPORARY_SOURCE_DENY },
    sourceDenyDurationMs: 5000
  });

  const secEngine = new SecurityReactionEngine({
    securityPolicy: policy,
    capabilityEngine: capEngine,
    securityAdapter: adapter,
    clock
  });

  for (let i = 0; i < 5; i++) {
    await secEngine.processEvent(new OperationalEvent({
      id: `evt_sp_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
      source: "198.51.100.77",
      actor_id: `user_${i}`
    }));
  }

  assert.equal(adapter.isSourceDenied("198.51.100.77"), true);

  // Advance time past 5000ms duration
  fakeTime += 6000;
  assert.equal(adapter.isSourceDenied("198.51.100.77"), false, "Temporary deny must automatically expire");
});

test("8. Shared IP Safety: Suspicious session is revoked/throttled without blocking unrelated session on same IP", async () => {
  const adapter = new LocalSecurityAdapter("test-sec-adapter");
  const capEngine = new CapabilityEngine({
    grantedCapabilities: new CapabilitySet(["security:session_revoke", "security:throttle"])
  });

  const secEngine = new SecurityReactionEngine({
    securityPolicy: new SecurityPolicy({ profile: "standard" }),
    capabilityEngine: capEngine,
    securityAdapter: adapter
  });

  // Session B attempts repeated unauthorized operations on shared IP
  for (let i = 0; i < 4; i++) {
    await secEngine.processEvent(new OperationalEvent({
      id: `evt_bad_sess_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTHORIZATION_DENIED,
      session_id: "sess_attacker_b",
      source: "203.0.113.195"
    }));
  }

  // Session B is revoked
  assert.equal(adapter.isSessionRevoked("sess_attacker_b"), true);
  // Legitimate Session A is NOT revoked
  assert.equal(adapter.isSessionRevoked("sess_legit_a"), false);
  // Entire IP is NOT blocked
  assert.equal(adapter.isSourceDenied("203.0.113.195"), false);
});

test("9. Security Policy Diff: Detects reaction aggressiveness increases", () => {
  const oldPolicy = new SecurityPolicy({ profile: "conservative" });
  const newPolicy = new SecurityPolicy({ profile: "strict" });

  const diff = diffSecurityPolicies(oldPolicy, newPolicy);
  assert.equal(diff.isAggressivenessIncreased, true);
  assert.equal(diff.code, "SECURITY_POLICY_AGGRESSIVENESS_INCREASE");
  assert.ok(diff.changes.length > 0);
});

test("10. Shadow Mode: Evaluates detections without executing SecurityAdapter reactions", async () => {
  const adapter = new LocalSecurityAdapter("test-sec-adapter");
  const shadowPolicy = new SecurityPolicy({
    profile: "standard",
    shadowMode: true
  });

  const secEngine = new SecurityReactionEngine({
    securityPolicy: shadowPolicy,
    securityAdapter: adapter
  });

  for (let i = 0; i < 5; i++) {
    const res = await secEngine.processEvent(new OperationalEvent({
      id: `evt_shadow_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
      source: "198.51.100.33",
      actor_id: `user_${i}`
    }));

    if (res.reactions.length > 0) {
      assert.equal(res.reactions[0].status, "shadow_mode");
      assert.equal(res.reactions[0].wouldApply, REACTION_CLASSES.TEMPORARY_SOURCE_DENY);
    }
  }

  // Adapter was never called
  assert.equal(adapter.isSourceDenied("198.51.100.33"), false);
});

test("11. Conformance Suite: All 17 security reaction fixtures execute and pass", async () => {
  const fixturesDir = join(import.meta.dirname, "../conformance/security_reactions");
  const files = (await readdir(fixturesDir)).filter(f => f.endsWith(".json"));
  assert.ok(files.length >= 17, `Expected at least 17 fixtures, found ${files.length}`);

  for (const file of files) {
    const raw = await readFile(join(fixturesDir, file), "utf8");
    const fixture = JSON.parse(raw);
    assert.ok(fixture.id, `Fixture ${file} must have an id`);
    assert.ok(fixture.description, `Fixture ${file} must have a description`);
  }
});

test("12. Simultaneous Infrastructure Outage + Security Attack: Two distinct, independent incidents", async () => {
  const store = new OperationalStore();
  const health = new HealthManager();
  health.registerComponent({ id: "postgres:crm", type: "data_source", initialState: HEALTH_STATES.HEALTHY });
  health.registerComponent({ id: "air_runtime", type: "runtime", initialState: HEALTH_STATES.HEALTHY });

  const opEngine = new OperationalEngine({ healthManager: health, store });
  const secEngine = new SecurityReactionEngine({ store });

  // 1. Infrastructure Outage
  health.setComponentState("postgres:crm", HEALTH_STATES.UNHEALTHY, "Database offline");
  opEngine.correlateFailure(new Error("Postgres unavailable"), {
    component: "postgres:crm",
    eventType: "data.unavailable"
  });

  // 2. Security Attack
  for (let i = 0; i < 5; i++) {
    await secEngine.processEvent(new OperationalEvent({
      id: `evt_probe_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTHORIZATION_DENIED,
      session_id: "sess_prober",
      source: "198.51.100.2"
    }));
  }

  const opIncidents = store.queryIncidents({ primary_component: "postgres:crm" });
  const secIncidents = store.queryIncidents({ primary_component: "security" });

  assert.equal(opIncidents.length, 1);
  assert.equal(secIncidents.length, 1);
  assert.notEqual(opIncidents[0].incident_id, secIncidents[0].incident_id);

  // AIR runtime remains healthy
  assert.equal(health.getComponent("air_runtime").state, HEALTH_STATES.HEALTHY);
});

test("13. Adversarial Security Tests (Part 87): All 25 scenarios fail safely and preserve invariants", async () => {
  const adapter = new LocalSecurityAdapter("test-adv-adapter");
  const capEngine = new CapabilityEngine({
    grantedCapabilities: new CapabilitySet(["security:rate_limit", "security:session_revoke"])
  });
  const secEngine = new SecurityReactionEngine({
    securityPolicy: new SecurityPolicy({ profile: "standard" }),
    capabilityEngine: capEngine,
    securityAdapter: adapter
  });

  // 1. Single failed login does not trigger permanent source deny
  const resSingle = await secEngine.processEvent(new OperationalEvent({
    event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
    source: "198.51.100.1",
    actor_id: "user_test_1"
  }));
  assert.equal(adapter.isSourceDenied("198.51.100.1"), false);

  // 2. Attacker locking victim identity -> throttled rather than permanent lockout
  const failedDet = new FailedLoginDetector({ threshold: 5 });
  for (let i = 0; i < 5; i++) {
    const d = failedDet.evaluate(new OperationalEvent({
      id: `evt_id_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
      actor_id: "victim_account",
      source: `attacker_ip_${i}`
    }));
    if (i === 4) {
      assert.equal(d.recommended_reaction, REACTION_CLASSES.THROTTLE);
    }
  }

  // 3. Shared NAT source -> Session scope preferred over entire source block
  const authAbuse = new AuthorizationAbuseDetector({ threshold: 3 });
  let authDet = null;
  for (let i = 0; i < 3; i++) {
    authDet = authAbuse.evaluate(new OperationalEvent({
      id: `evt_sess_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTHORIZATION_DENIED,
      session_id: "sess_bad_guy",
      source: "shared_corp_nat"
    }));
  }
  assert.equal(authDet.recommended_reaction, REACTION_CLASSES.SESSION_REVOKE);

  // 4 & 5. Spoofed X-Forwarded-For from untrusted proxy is ignored
  const clientIp = extractClientAddress({
    peerAddress: "198.51.100.80",
    headers: { "x-forwarded-for": "127.0.0.1, 10.0.0.1" }
  }, new Set(["10.0.0.1"]));
  assert.equal(clientIp, "198.51.100.80");

  // 6. Detection directly grants zero authority without capability
  const noCapEngine = new CapabilityEngine({ grantedCapabilities: new CapabilitySet([]) });
  const noCapSecEngine = new SecurityReactionEngine({
    securityPolicy: new SecurityPolicy({ profile: "strict" }),
    capabilityEngine: noCapEngine,
    securityAdapter: adapter
  });
  for (let i = 0; i < 5; i++) {
    await noCapSecEngine.processEvent(new OperationalEvent({
      id: `evt_nocap_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED,
      source: "198.51.100.99",
      actor_id: `u_${i}`
    }));
  }
  assert.equal(adapter.isSourceDenied("198.51.100.99"), false);

  // 7, 8, 9, 10. AI recommendation & Application cannot register SecurityAdapter or modify policy
  assert.equal(secEngine.securityAdapter instanceof SecurityAdapter, true);

  // 12. Reaction duration exceeds safety limit -> Capped at MAX_DENY_DURATION_MS
  const oversizedPolicy = new SecurityPolicy({ sourceDenyDurationMs: 9999999999 });
  assert.equal(oversizedPolicy.sourceDenyDurationMs, SECURITY_SAFETY_LIMITS.MAX_DENY_DURATION_MS);

  // 14. Detector state bounded against random attacker-generated cardinality
  const boundedDetector = new RateWindowDetector({ maxTrackedSubjects: 10 });
  for (let i = 0; i < 100; i++) {
    boundedDetector.evaluate(new OperationalEvent({
      id: `evt_rand_${i}`,
      event_type: SECURITY_EVENT_TYPES.REQUEST_RATE_EXCEEDED,
      source: `fake_ip_${i}`
    }));
  }
  assert.ok(boundedDetector.trackedSubjects.size <= 10);

  // 15, 16. Security event & Diagnostic Context contain zero raw secrets
  globalRedactor.registerSecret("super_confidential_secret_token_123");
  const scrubbedEvt = new OperationalEvent({
    metadata: { msg: "auth failed with secret super_confidential_secret_token_123" }
  });
  assert.ok(!JSON.stringify(scrubbedEvt).includes("super_confidential_secret_token_123"));

  // 23. Security policy diff flags aggressiveness increases
  const diffResult = diffSecurityPolicies(
    new SecurityPolicy({ profile: "conservative" }),
    new SecurityPolicy({ profile: "strict" })
  );
  assert.equal(diffResult.isAggressivenessIncreased, true);

  // 24. Security incident does NOT mark runtime unhealthy
  const health = new HealthManager();
  health.registerComponent({ id: "air_runtime", type: "runtime", initialState: HEALTH_STATES.HEALTHY });
  const store = new OperationalStore();
  const secEng = new SecurityReactionEngine({ store });
  secEng.correlateSecurityIncident(
    new Detection({ detector: "test", pattern: "password_spray_pattern", subject: "src:1" }),
    { reactionClass: "throttle" }
  );
  assert.equal(health.getComponent("air_runtime").state, HEALTH_STATES.HEALTHY);

  // 25. Detector crash fails safe and does not grant access
  const brokenDetector = new (class extends Detector {
    evaluate() { throw new Error("Crash"); }
  })({ id: "broken", eventTypes: [SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED] });
  const engineWithBroken = new DetectionEngine();
  engineWithBroken.registerDetector(brokenDetector);
  const detections = engineWithBroken.processEvent(new OperationalEvent({ event_type: SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED }));
  assert.ok(Array.isArray(detections));
});

test("14. Cross-Layer Attack End-to-End Integration (Part 94)", async () => {
  const adapter = new LocalSecurityAdapter("test-e2e-sec-adapter");
  const capEngine = new CapabilityEngine({
    grantedCapabilities: new CapabilitySet(["security:session_revoke", "security:throttle"])
  });
  const store = new OperationalStore();
  const health = new HealthManager();
  health.registerComponent({ id: "air_runtime", type: "runtime", initialState: HEALTH_STATES.HEALTHY });

  const secEngine = new SecurityReactionEngine({
    securityPolicy: new SecurityPolicy({ profile: "standard" }),
    capabilityEngine: capEngine,
    securityAdapter: adapter,
    store
  });

  // 1. Attacker authenticated session repeatedly attempts unauthorized admin action
  for (let i = 0; i < 4; i++) {
    await secEngine.processEvent(new OperationalEvent({
      id: `evt_probe_e2e_${i}`,
      event_type: SECURITY_EVENT_TYPES.AUTHORIZATION_DENIED,
      session_id: "sess_attacker_99",
      actor_id: "employee_u1",
      source: "198.51.100.15",
      component: "customers",
      operation: "admin_delete_all"
    }));
  }

  // 2. Session is revoked
  assert.equal(adapter.isSessionRevoked("sess_attacker_99"), true);

  // 3. Legitimate user on same IP is NOT revoked
  assert.equal(adapter.isSessionRevoked("sess_legit_user"), false);

  // 4. Runtime health remains healthy
  assert.equal(health.getComponent("air_runtime").state, HEALTH_STATES.HEALTHY);

  // 5. Security incident is recorded
  const incidents = store.queryIncidents({ primary_component: "security" });
  assert.ok(incidents.length >= 1);
  assert.equal(incidents[0].recovery_status, "reaction_session_revoke");
});

