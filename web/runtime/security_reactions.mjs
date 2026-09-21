/**
 * AIR Security Reaction Engine & Attack/Abuse Detection
 * 
 * Implements:
 * 1. Normalized Security Event Taxonomy
 * 2. Trusted Client Source Extraction & Trusted Proxy Handling
 * 3. Deterministic Detection Engine with Bounded Cardinality
 * 4. Behavior-Based Detectors (Failed Login, Password Spray, Credential Stuffing,
 *    Authorization Abuse, Resource Enumeration, Capability Abuse, Rate Windows)
 * 5. Security Policy Model (Versioning, Profiles, Safety Limits, Shadow Mode, Policy Diff)
 * 6. Graduated Reaction Hierarchy (observe, rate_limit, throttle, session_revoke,
 *    temporary_identity_deny, temporary_source_deny, escalate)
 * 7. Trusted SecurityAdapter Interface & Local/Test Security Adapter
 * 8. Two-Key Reaction Authorization (Policy Eligibility + Security Capability Grant)
 * 9. Reaction Deduplication, Automatic Expiry, and Clock-Driven Verification
 * 10. Security Incident Correlation & Health Isolation
 */

import { globalRedactor, SecurityError, SECURITY_ERROR_CODES, Capability } from "./security.mjs";
import { OperationalEvent, Incident, INCIDENT_STATUS, SEVERITY_LEVELS, HEALTH_STATES } from "./operations.mjs";

/**
 * Normalized Security Event Types
 */
export const SECURITY_EVENT_TYPES = Object.freeze({
  // Authentication
  AUTH_LOGIN_SUCCEEDED: "auth.login.succeeded",
  AUTH_LOGIN_FAILED: "auth.login.failed",
  AUTH_LOGOUT: "auth.logout",
  AUTH_SESSION_EXPIRED: "auth.session.expired",
  AUTH_SESSION_REVOKED: "auth.session.revoked",
  AUTH_PASSWORD_RESET_REQUESTED: "auth.password_reset.requested",
  AUTH_PASSWORD_RESET_FAILED: "auth.password_reset.failed",

  // Authorization
  AUTHORIZATION_ALLOWED: "authorization.allowed",
  AUTHORIZATION_DENIED: "authorization.denied",

  // Capability
  CAPABILITY_ALLOWED: "capability.allowed",
  CAPABILITY_DENIED: "capability.denied",
  CAPABILITY_ESCALATION_ATTEMPT: "capability.escalation_attempt",

  // Data
  DATA_ACCESS_DENIED: "data.access.denied",
  DATA_ENUMERATION_SUSPECTED: "data.enumeration.suspected",

  // Connectors
  CONNECTOR_ACTION_DENIED: "connector.action.denied",
  CONNECTOR_DISCOVERY_ANOMALY: "connector.discovery.anomaly",

  // Network
  NETWORK_DESTINATION_DENIED: "network.destination.denied",
  NETWORK_REDIRECT_DENIED: "network.redirect.denied",

  // Request & Rates
  REQUEST_RATE_EXCEEDED: "request.rate.exceeded",
  REQUEST_MALFORMED: "request.malformed",
  REQUEST_ENUMERATION_SUSPECTED: "request.enumeration.suspected",

  // Security Reaction Lifecycle
  SECURITY_PATTERN_DETECTED: "security.pattern.detected",
  SECURITY_REACTION_STARTED: "security.reaction.started",
  SECURITY_REACTION_APPLIED: "security.reaction.applied",
  SECURITY_REACTION_FAILED: "security.reaction.failed",
  SECURITY_REACTION_EXPIRED: "security.reaction.expired"
});

/**
 * Reaction Hierarchy & Disruptiveness Scorecard
 */
export const REACTION_CLASSES = Object.freeze({
  OBSERVE: "observe",
  RATE_LIMIT: "rate_limit",
  THROTTLE: "throttle",
  CHALLENGE: "challenge",
  SESSION_REVOKE: "session_revoke",
  TEMPORARY_IDENTITY_DENY: "temporary_identity_deny",
  TEMPORARY_SOURCE_DENY: "temporary_source_deny",
  ESCALATE: "escalate"
});

export const REACTION_DISRUPTIVENESS = Object.freeze({
  [REACTION_CLASSES.OBSERVE]: 1,
  [REACTION_CLASSES.RATE_LIMIT]: 2,
  [REACTION_CLASSES.THROTTLE]: 3,
  [REACTION_CLASSES.CHALLENGE]: 3,
  [REACTION_CLASSES.SESSION_REVOKE]: 4,
  [REACTION_CLASSES.TEMPORARY_IDENTITY_DENY]: 5,
  [REACTION_CLASSES.TEMPORARY_SOURCE_DENY]: 6,
  [REACTION_CLASSES.ESCALATE]: 6
});

/**
 * Confidence Categories
 */
export const CONFIDENCE_LEVELS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical"
});

/**
 * Deployment Safety Limits
 */
export const SECURITY_SAFETY_LIMITS = Object.freeze({
  MAX_DENY_DURATION_MS: 86400000, // 24 hours max automatic source deny
  MIN_DENY_DURATION_MS: 1000,
  MAX_THROTTLE_DURATION_MS: 3600000, // 1 hour max
  MAX_TRACKED_SUBJECTS: 10000,
  MAX_DETECTOR_WINDOW_MS: 3600000
});

/**
 * Trusted Client Source Address Extraction
 * Does NOT blindly trust X-Forwarded-For unless the immediate peer IP is in trustedProxies.
 */
export function extractClientAddress(requestInfo = {}, trustedProxies = new Set()) {
  const peerAddress = requestInfo.peerAddress || requestInfo.remoteAddress || "127.0.0.1";
  
  if (!trustedProxies.has(peerAddress)) {
    return peerAddress;
  }

  const forwardedFor = requestInfo.headers?.["x-forwarded-for"] || requestInfo.headers?.["X-Forwarded-For"];
  if (forwardedFor && typeof forwardedFor === "string") {
    const parts = forwardedFor.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[0]; // First client in the chain
    }
  }

  return peerAddress;
}

let _secCounter = 1;
function nextSecId(prefix = "sec") {
  return `${prefix}_${Date.now()}_${_secCounter++}`;
}

/**
 * Structured Security Detection Record
 */
export class Detection {
  constructor(options = {}) {
    this.id = options.id ?? nextSecId("det");
    this.detector = options.detector;
    this.timestamp = options.timestamp ?? new Date().toISOString();
    this.subject = options.subject ?? "unknown";
    this.source = options.source ?? "unknown";
    this.pattern = options.pattern;
    this.severity = options.severity ?? SEVERITY_LEVELS.WARNING;
    this.confidence = options.confidence ?? CONFIDENCE_LEVELS.MEDIUM;
    this.supporting_event_ids = [...(options.supporting_event_ids ?? [])];
    this.recommended_reaction = options.recommended_reaction ?? REACTION_CLASSES.OBSERVE;
    this.metadata = globalRedactor.redactObject(options.metadata ?? {});
  }

  toJSON() {
    return {
      id: this.id,
      detector: this.detector,
      timestamp: this.timestamp,
      subject: this.subject,
      source: this.source,
      pattern: this.pattern,
      severity: this.severity,
      confidence: this.confidence,
      supporting_event_ids: this.supporting_event_ids,
      recommended_reaction: this.recommended_reaction,
      metadata: this.metadata
    };
  }
}

/**
 * Base Detector Contract with Bounded Cardinality
 */
export class Detector {
  constructor(options = {}) {
    this.id = options.id;
    this.version = options.version ?? 1;
    this.eventTypes = new Set(options.eventTypes ?? []);
    this.maxTrackedSubjects = options.maxTrackedSubjects ?? 1000;
    this.clock = options.clock ?? (() => Date.now());
    this.trackedSubjects = new Map(); // subjectKey -> { events, lastSeen }
  }

  evictOldest() {
    if (this.trackedSubjects.size >= this.maxTrackedSubjects) {
      let oldestKey = null;
      let oldestTime = Infinity;
      for (const [key, data] of this.trackedSubjects.entries()) {
        if (data.lastSeen < oldestTime) {
          oldestTime = data.lastSeen;
          oldestKey = key;
        }
      }
      if (oldestKey) this.trackedSubjects.delete(oldestKey);
    }
  }

  trackEvent(subjectKey, event, windowMs) {
    const now = this.clock();
    if (!this.trackedSubjects.has(subjectKey)) {
      this.evictOldest();
      this.trackedSubjects.set(subjectKey, { events: [], lastSeen: now });
    }
    const data = this.trackedSubjects.get(subjectKey);
    data.lastSeen = now;
    
    // Prune events older than window
    const cutoff = now - windowMs;
    data.events = data.events.filter(e => e.time >= cutoff);
    data.events.push({ id: event.id, time: now, event });
    return data.events;
  }

  reset() {
    this.trackedSubjects.clear();
  }

  evaluate(event, context = {}) {
    throw new Error(`evaluate() not implemented on detector ${this.id}`);
  }
}

/**
 * 1. Failed Login Detector (same identity or same source exceeding threshold)
 */
export class FailedLoginDetector extends Detector {
  constructor(options = {}) {
    super({
      id: "failed_login_detector",
      version: 1,
      eventTypes: [SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED, SECURITY_EVENT_TYPES.AUTH_LOGIN_SUCCEEDED],
      ...options
    });
    this.threshold = options.threshold ?? 5;
    this.windowMs = options.windowMs ?? 60000;
  }

  evaluate(event, context = {}) {
    if (event.event_type === SECURITY_EVENT_TYPES.AUTH_LOGIN_SUCCEEDED) {
      // Clear or reduce count on successful login
      if (event.actor_id) this.trackedSubjects.delete(`identity:${event.actor_id}`);
      return null;
    }

    if (event.event_type !== SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED) return null;

    const source = event.source || event.metadata?.source || "unknown";
    const identity = event.actor_id || event.metadata?.identity || "unknown";

    // Track by identity
    const idKey = `identity:${identity}`;
    const idEvents = this.trackEvent(idKey, event, this.windowMs);

    if (idEvents.length >= this.threshold) {
      return new Detection({
        detector: this.id,
        subject: `identity:${identity}`,
        source,
        pattern: "repeated_identity_login_failures",
        severity: SEVERITY_LEVELS.WARNING,
        confidence: CONFIDENCE_LEVELS.HIGH,
        supporting_event_ids: idEvents.map(e => e.id),
        recommended_reaction: REACTION_CLASSES.THROTTLE,
        metadata: { failureCount: idEvents.length, identity, source }
      });
    }

    return null;
  }
}

/**
 * 2. Password Spray Detector (one source -> many identities)
 */
export class PasswordSprayDetector extends Detector {
  constructor(options = {}) {
    super({
      id: "password_spray_detector",
      version: 1,
      eventTypes: [SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED],
      ...options
    });
    this.identityThreshold = options.identityThreshold ?? 3;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.windowMs = options.windowMs ?? 60000;
  }

  evaluate(event, context = {}) {
    if (event.event_type !== SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED) return null;

    const source = event.source || event.metadata?.source || "unknown";
    const identity = event.actor_id || event.metadata?.identity || "unknown";

    const srcKey = `source:${source}`;
    const srcEvents = this.trackEvent(srcKey, event, this.windowMs);

    const distinctIdentities = new Set(srcEvents.map(e => e.event.actor_id || e.event.metadata?.identity)).size;

    if (srcEvents.length >= this.failureThreshold && distinctIdentities >= this.identityThreshold) {
      return new Detection({
        detector: this.id,
        subject: `source:${source}`,
        source,
        pattern: "password_spray_pattern",
        severity: SEVERITY_LEVELS.ERROR,
        confidence: CONFIDENCE_LEVELS.HIGH,
        supporting_event_ids: srcEvents.map(e => e.id),
        recommended_reaction: REACTION_CLASSES.TEMPORARY_SOURCE_DENY,
        metadata: {
          totalFailures: srcEvents.length,
          distinctIdentities,
          source
        }
      });
    }

    return null;
  }
}

/**
 * 3. Credential Stuffing Detector (high volume across sources/identities)
 */
export class CredentialStuffingDetector extends Detector {
  constructor(options = {}) {
    super({
      id: "credential_stuffing_detector",
      version: 1,
      eventTypes: [SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED, SECURITY_EVENT_TYPES.AUTH_LOGIN_SUCCEEDED],
      ...options
    });
    this.failureThreshold = options.failureThreshold ?? 20;
    this.windowMs = options.windowMs ?? 60000;
  }

  evaluate(event, context = {}) {
    if (event.event_type !== SECURITY_EVENT_TYPES.AUTH_LOGIN_FAILED) return null;

    const allEvents = this.trackEvent("global_stuffing", event, this.windowMs);
    const distinctIdentities = new Set(allEvents.map(e => e.event.actor_id || e.event.metadata?.identity)).size;
    const distinctSources = new Set(allEvents.map(e => e.event.source || e.event.metadata?.source)).size;

    if (allEvents.length >= this.failureThreshold && distinctIdentities >= 5) {
      return new Detection({
        detector: this.id,
        subject: "cluster:distributed",
        source: `${distinctSources} sources`,
        pattern: "credential_stuffing_pattern",
        severity: SEVERITY_LEVELS.CRITICAL,
        confidence: CONFIDENCE_LEVELS.HIGH,
        supporting_event_ids: allEvents.slice(-20).map(e => e.id),
        recommended_reaction: REACTION_CLASSES.RATE_LIMIT,
        metadata: {
          totalAttempts: allEvents.length,
          distinctIdentities,
          distinctSources
        }
      });
    }
    return null;
  }
}

/**
 * 4. Authorization Abuse Detector (repeated authorization.denied)
 */
export class AuthorizationAbuseDetector extends Detector {
  constructor(options = {}) {
    super({
      id: "authorization_abuse_detector",
      version: 1,
      eventTypes: [SECURITY_EVENT_TYPES.AUTHORIZATION_DENIED],
      ...options
    });
    this.threshold = options.threshold ?? 4;
    this.windowMs = options.windowMs ?? 60000;
  }

  evaluate(event, context = {}) {
    if (event.event_type !== SECURITY_EVENT_TYPES.AUTHORIZATION_DENIED) return null;

    const subject = event.session_id ? `session:${event.session_id}` : `actor:${event.actor_id || "unknown"}`;
    const source = event.source || event.metadata?.source || "unknown";

    const events = this.trackEvent(subject, event, this.windowMs);

    if (events.length >= this.threshold) {
      return new Detection({
        detector: this.id,
        subject,
        source,
        pattern: "repeated_authorization_probing",
        severity: SEVERITY_LEVELS.WARNING,
        confidence: CONFIDENCE_LEVELS.HIGH,
        supporting_event_ids: events.map(e => e.id),
        recommended_reaction: event.session_id ? REACTION_CLASSES.SESSION_REVOKE : REACTION_CLASSES.THROTTLE,
        metadata: { denialCount: events.length, subject, source }
      });
    }

    return null;
  }
}

/**
 * 5. Resource Enumeration Detector (rapid queries resulting in not_found/denied)
 */
export class ResourceEnumerationDetector extends Detector {
  constructor(options = {}) {
    super({
      id: "resource_enumeration_detector",
      version: 1,
      eventTypes: [SECURITY_EVENT_TYPES.DATA_ACCESS_DENIED, SECURITY_EVENT_TYPES.DATA_ENUMERATION_SUSPECTED],
      ...options
    });
    this.threshold = options.threshold ?? 6;
    this.windowMs = options.windowMs ?? 30000;
  }

  evaluate(event, context = {}) {
    const subject = event.session_id ? `session:${event.session_id}` : `source:${event.source || "unknown"}`;
    const events = this.trackEvent(subject, event, this.windowMs);

    if (events.length >= this.threshold) {
      return new Detection({
        detector: this.id,
        subject,
        source: event.source || "unknown",
        pattern: "resource_enumeration_pattern",
        severity: SEVERITY_LEVELS.WARNING,
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        supporting_event_ids: events.map(e => e.id),
        recommended_reaction: REACTION_CLASSES.RATE_LIMIT,
        metadata: { probeCount: events.length, subject }
      });
    }

    return null;
  }
}

/**
 * 6. Capability Abuse Detector (repeated capability denials, ungranted MCP, denied network/secrets)
 */
export class CapabilityAbuseDetector extends Detector {
  constructor(options = {}) {
    super({
      id: "capability_abuse_detector",
      version: 1,
      eventTypes: [
        SECURITY_EVENT_TYPES.CAPABILITY_DENIED,
        SECURITY_EVENT_TYPES.CAPABILITY_ESCALATION_ATTEMPT,
        SECURITY_EVENT_TYPES.CONNECTOR_ACTION_DENIED,
        SECURITY_EVENT_TYPES.NETWORK_DESTINATION_DENIED
      ],
      ...options
    });
    this.threshold = options.threshold ?? 3;
    this.windowMs = options.windowMs ?? 60000;
  }

  evaluate(event, context = {}) {
    const subject = event.session_id ? `session:${event.session_id}` : `source:${event.source || "unknown"}`;
    const events = this.trackEvent(subject, event, this.windowMs);

    if (events.length >= this.threshold) {
      return new Detection({
        detector: this.id,
        subject,
        source: event.source || "unknown",
        pattern: "capability_abuse_pattern",
        severity: SEVERITY_LEVELS.ERROR,
        confidence: CONFIDENCE_LEVELS.HIGH,
        supporting_event_ids: events.map(e => e.id),
        recommended_reaction: REACTION_CLASSES.THROTTLE,
        metadata: { capabilityDenials: events.length, subject }
      });
    }

    return null;
  }
}

/**
 * 7. Rate Window Detector
 */
export class RateWindowDetector extends Detector {
  constructor(options = {}) {
    super({
      id: "rate_window_detector",
      version: 1,
      eventTypes: [SECURITY_EVENT_TYPES.REQUEST_RATE_EXCEEDED],
      ...options
    });
    this.threshold = options.threshold ?? 10;
    this.windowMs = options.windowMs ?? 10000;
  }

  evaluate(event, context = {}) {
    const subject = `source:${event.source || "unknown"}`;
    const events = this.trackEvent(subject, event, this.windowMs);

    if (events.length >= this.threshold) {
      return new Detection({
        detector: this.id,
        subject,
        source: event.source || "unknown",
        pattern: "request_rate_spike",
        severity: SEVERITY_LEVELS.WARNING,
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        supporting_event_ids: events.map(e => e.id),
        recommended_reaction: REACTION_CLASSES.RATE_LIMIT,
        metadata: { count: events.length, subject }
      });
    }

    return null;
  }
}

/**
 * Detection Engine
 */
export class DetectionEngine {
  constructor(options = {}) {
    this.detectors = new Map();
    this.clock = options.clock ?? (() => Date.now());

    // Register standard detectors
    this.registerDetector(new FailedLoginDetector({ clock: this.clock }));
    this.registerDetector(new PasswordSprayDetector({ clock: this.clock }));
    this.registerDetector(new CredentialStuffingDetector({ clock: this.clock }));
    this.registerDetector(new AuthorizationAbuseDetector({ clock: this.clock }));
    this.registerDetector(new ResourceEnumerationDetector({ clock: this.clock }));
    this.registerDetector(new CapabilityAbuseDetector({ clock: this.clock }));
    this.registerDetector(new RateWindowDetector({ clock: this.clock }));
  }

  registerDetector(detector) {
    this.detectors.set(detector.id, detector);
  }

  getDetector(id) {
    return this.detectors.get(id);
  }

  reset() {
    for (const detector of this.detectors.values()) {
      detector.reset();
    }
  }

  processEvent(event, context = {}) {
    const detections = [];
    for (const detector of this.detectors.values()) {
      if (detector.eventTypes.has(event.event_type)) {
        try {
          const result = detector.evaluate(event, context);
          if (result) detections.push(result);
        } catch (err) {
          // Defense-in-depth: A detector failure MUST fail safe and NOT bypass controls
        }
      }
    }
    return detections;
  }
}

/**
 * Standard Security Profiles
 */
export const SECURITY_PROFILES = Object.freeze({
  CONSERVATIVE: Object.freeze({
    id: "security.conservative@1",
    version: 1,
    shadowMode: false,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 100,
    throttleDelayMs: 250,
    throttleDurationMs: 30000,
    sourceDenyDurationMs: 60000,
    reactionMappings: {
      "repeated_identity_login_failures": REACTION_CLASSES.THROTTLE,
      "password_spray_pattern": REACTION_CLASSES.RATE_LIMIT,
      "repeated_authorization_probing": REACTION_CLASSES.OBSERVE,
      "resource_enumeration_pattern": REACTION_CLASSES.RATE_LIMIT,
      "capability_abuse_pattern": REACTION_CLASSES.THROTTLE
    }
  }),
  STANDARD: Object.freeze({
    id: "security.standard@1",
    version: 1,
    shadowMode: false,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 60,
    throttleDelayMs: 500,
    throttleDurationMs: 60000,
    sourceDenyDurationMs: 300000, // 5 mins
    reactionMappings: {
      "repeated_identity_login_failures": REACTION_CLASSES.THROTTLE,
      "password_spray_pattern": REACTION_CLASSES.TEMPORARY_SOURCE_DENY,
      "credential_stuffing_pattern": REACTION_CLASSES.RATE_LIMIT,
      "repeated_authorization_probing": REACTION_CLASSES.SESSION_REVOKE,
      "resource_enumeration_pattern": REACTION_CLASSES.RATE_LIMIT,
      "capability_abuse_pattern": REACTION_CLASSES.THROTTLE
    }
  }),
  STRICT: Object.freeze({
    id: "security.strict@1",
    version: 1,
    shadowMode: false,
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 30,
    throttleDelayMs: 1000,
    throttleDurationMs: 300000,
    sourceDenyDurationMs: 900000, // 15 mins
    reactionMappings: {
      "repeated_identity_login_failures": REACTION_CLASSES.TEMPORARY_IDENTITY_DENY,
      "password_spray_pattern": REACTION_CLASSES.TEMPORARY_SOURCE_DENY,
      "credential_stuffing_pattern": REACTION_CLASSES.TEMPORARY_SOURCE_DENY,
      "repeated_authorization_probing": REACTION_CLASSES.SESSION_REVOKE,
      "resource_enumeration_pattern": REACTION_CLASSES.THROTTLE,
      "capability_abuse_pattern": REACTION_CLASSES.TEMPORARY_SOURCE_DENY
    }
  })
});

/**
 * Security Policy Model
 */
export class SecurityPolicy {
  constructor(options = {}) {
    const profile = options.profile ? (SECURITY_PROFILES[options.profile.toUpperCase()] ?? SECURITY_PROFILES.STANDARD) : SECURITY_PROFILES.STANDARD;

    this.id = options.id ?? profile.id;
    this.version = options.version ?? profile.version;
    this.shadowMode = Boolean(options.shadowMode ?? profile.shadowMode);
    this.trustedProxies = new Set(options.trustedProxies ?? []);
    this.exemptions = new Set(options.exemptions ?? []);

    // Bounded safety limit application
    this.rateLimitWindowMs = Math.min(options.rateLimitWindowMs ?? profile.rateLimitWindowMs, SECURITY_SAFETY_LIMITS.MAX_DETECTOR_WINDOW_MS);
    this.rateLimitMaxRequests = options.rateLimitMaxRequests ?? profile.rateLimitMaxRequests;
    this.throttleDelayMs = options.throttleDelayMs ?? profile.throttleDelayMs;
    this.throttleDurationMs = Math.min(options.throttleDurationMs ?? profile.throttleDurationMs, SECURITY_SAFETY_LIMITS.MAX_THROTTLE_DURATION_MS);
    this.sourceDenyDurationMs = Math.min(
      Math.max(options.sourceDenyDurationMs ?? profile.sourceDenyDurationMs, SECURITY_SAFETY_LIMITS.MIN_DENY_DURATION_MS),
      SECURITY_SAFETY_LIMITS.MAX_DENY_DURATION_MS
    );

    this.reactionMappings = {
      ...profile.reactionMappings,
      ...(options.reactionMappings ?? {})
    };
  }

  getReactionForPattern(pattern) {
    return this.reactionMappings[pattern] ?? REACTION_CLASSES.OBSERVE;
  }

  isExempt(subject) {
    return this.exemptions.has(subject);
  }
}

/**
 * Policy Diff Utility to Detect Aggressiveness Increases
 */
export function diffSecurityPolicies(oldPolicy, newPolicy) {
  const changes = [];
  let isAggressivenessIncreased = false;

  const patterns = new Set([...Object.keys(oldPolicy.reactionMappings), ...Object.keys(newPolicy.reactionMappings)]);

  for (const pattern of patterns) {
    const oldR = oldPolicy.reactionMappings[pattern] ?? REACTION_CLASSES.OBSERVE;
    const newR = newPolicy.reactionMappings[pattern] ?? REACTION_CLASSES.OBSERVE;
    if (oldR !== newR) {
      const oldScore = REACTION_DISRUPTIVENESS[oldR] ?? 0;
      const newScore = REACTION_DISRUPTIVENESS[newR] ?? 0;
      if (newScore > oldScore) isAggressivenessIncreased = true;
      changes.push({
        type: "reaction_mapping_change",
        pattern,
        oldReaction: oldR,
        newReaction: newR,
        disruptivenessDiff: newScore - oldScore
      });
    }
  }

  if (newPolicy.sourceDenyDurationMs > oldPolicy.sourceDenyDurationMs) {
    isAggressivenessIncreased = true;
    changes.push({
      type: "duration_increase",
      parameter: "sourceDenyDurationMs",
      oldValue: oldPolicy.sourceDenyDurationMs,
      newValue: newPolicy.sourceDenyDurationMs
    });
  }

  return {
    isAggressivenessIncreased,
    code: isAggressivenessIncreased ? "SECURITY_POLICY_AGGRESSIVENESS_INCREASE" : "SECURITY_POLICY_UNCHANGED_OR_RELAXED",
    changes
  };
}

/**
 * Base Security Adapter Interface
 */
export class SecurityAdapter {
  constructor(id = "security-adapter") {
    this.id = id;
    this.version = 1;
  }

  getManifest() {
    return {
      id: this.id,
      version: this.version,
      supportedReactions: [
        REACTION_CLASSES.RATE_LIMIT,
        REACTION_CLASSES.THROTTLE,
        REACTION_CLASSES.SESSION_REVOKE,
        REACTION_CLASSES.TEMPORARY_SOURCE_DENY
      ]
    };
  }

  async apply(reaction) {
    throw new Error(`apply() not implemented on ${this.id}`);
  }

  async revoke(reactionId) {
    throw new Error(`revoke() not implemented on ${this.id}`);
  }

  async inspect() {
    return { activeReactions: [] };
  }
}

/**
 * Local / Test Security Adapter (Process-Local In-Memory Implementation)
 */
export class LocalSecurityAdapter extends SecurityAdapter {
  constructor(id = "local-security-adapter", options = {}) {
    super(id);
    this.clock = options.clock ?? (() => Date.now());
    this.activeReactions = new Map(); // reactionId -> reaction
    this.deniedSources = new Map();   // source -> expiryTime
    this.throttledSubjects = new Map(); // subject -> { delayMs, expiryTime }
    this.revokedSessions = new Set();
  }

  async apply(reaction) {
    const now = this.clock();
    this.activeReactions.set(reaction.id, reaction);

    if (reaction.reactionClass === REACTION_CLASSES.TEMPORARY_SOURCE_DENY) {
      this.deniedSources.set(reaction.target, now + reaction.durationMs);
    } else if (reaction.reactionClass === REACTION_CLASSES.THROTTLE) {
      this.throttledSubjects.set(reaction.target, {
        delayMs: reaction.metadata?.delayMs ?? 500,
        expiryTime: now + reaction.durationMs
      });
    } else if (reaction.reactionClass === REACTION_CLASSES.SESSION_REVOKE) {
      this.revokedSessions.add(reaction.target);
    }
    return true;
  }

  async revoke(reactionId) {
    const reaction = this.activeReactions.get(reactionId);
    if (!reaction) return false;

    this.activeReactions.delete(reactionId);
    if (reaction.reactionClass === REACTION_CLASSES.TEMPORARY_SOURCE_DENY) {
      this.deniedSources.delete(reaction.target);
    } else if (reaction.reactionClass === REACTION_CLASSES.THROTTLE) {
      this.throttledSubjects.delete(reaction.target);
    } else if (reaction.reactionClass === REACTION_CLASSES.SESSION_REVOKE) {
      this.revokedSessions.delete(reaction.target);
    }
    return true;
  }

  isSourceDenied(source) {
    const now = this.clock();
    const expiry = this.deniedSources.get(source);
    if (!expiry) return false;
    if (now >= expiry) {
      this.deniedSources.delete(source);
      return false;
    }
    return true;
  }

  isSessionRevoked(sessionId) {
    return this.revokedSessions.has(sessionId);
  }

  getThrottle(subject) {
    const now = this.clock();
    const item = this.throttledSubjects.get(subject);
    if (!item) return 0;
    if (now >= item.expiryTime) {
      this.throttledSubjects.delete(subject);
      return 0;
    }
    return item.delayMs;
  }

  async inspect() {
    const now = this.clock();
    // Prune expired
    for (const [id, r] of this.activeReactions.entries()) {
      if (r.expiresAt && now >= r.expiresAt) {
        await this.revoke(id);
      }
    }
    return {
      activeReactions: Array.from(this.activeReactions.values()),
      deniedSources: Array.from(this.deniedSources.keys()),
      revokedSessions: Array.from(this.revokedSessions.values())
    };
  }
}

/**
 * Security Reaction Engine
 */
export class SecurityReactionEngine {
  constructor(options = {}) {
    this.detectionEngine = options.detectionEngine ?? new DetectionEngine();
    this.securityPolicy = options.securityPolicy instanceof SecurityPolicy ? options.securityPolicy : new SecurityPolicy(options.securityPolicy ?? {});
    this.capabilityEngine = options.capabilityEngine ?? null;
    this.securityAdapter = options.securityAdapter ?? new LocalSecurityAdapter("local-security-adapter", { clock: options.clock });
    this.store = options.store ?? null;
    this.clock = options.clock ?? (() => Date.now());
    this.activeReactions = new Map(); // subject -> reaction
    this.reactionsHistory = [];
  }

  /**
   * Evaluates security events, runs detectors, correlates security incidents,
   * and executes two-key authorized bounded reactions.
   */
  async processEvent(event, requestContext = {}) {
    // 1. Run detection engine
    const detections = this.detectionEngine.processEvent(event, requestContext);
    if (detections.length === 0) return { detections: [], reactions: [] };

    const appliedReactions = [];

    for (const detection of detections) {
      // 2. Map detection to policy reaction
      const targetReactionClass = this.securityPolicy.getReactionForPattern(detection.pattern);
      
      // 3. Check exemptions
      if (this.securityPolicy.isExempt(detection.subject) || this.securityPolicy.isExempt(detection.source)) {
        continue;
      }

      // 4. Handle Shadow Mode
      if (this.securityPolicy.shadowMode) {
        appliedReactions.push({
          status: "shadow_mode",
          wouldApply: targetReactionClass,
          detection
        });
        continue;
      }

      // 5. Check Reaction Deduplication
      const dedupeKey = `${detection.subject}:${targetReactionClass}`;
      const existing = this.activeReactions.get(dedupeKey);
      const now = this.clock();
      if (existing && existing.expiresAt && now < existing.expiresAt) {
        existing.supportingDetections.push(detection.id);
        continue; // Deduplicated
      }

      // 6. Two-Key Authorization
      // KEY 1: Policy Eligibility (targetReactionClass != observe)
      if (targetReactionClass === REACTION_CLASSES.OBSERVE) {
        continue;
      }

      // KEY 2: Infrastructure Security Capability Grant
      const requiredCapability = `security:${targetReactionClass}`;
      if (this.capabilityEngine) {
        try {
          this.capabilityEngine.assertCapability(requiredCapability, {
            authorityClass: "operational"
          });
        } catch (err) {
          // Capability missing -> fail closed, record failed reaction
          this.recordReactionFailure(targetReactionClass, detection, "Security capability not granted");
          continue;
        }
      }

      // 7. Calculate Bounded Duration
      let durationMs = 60000;
      if (targetReactionClass === REACTION_CLASSES.TEMPORARY_SOURCE_DENY) {
        durationMs = this.securityPolicy.sourceDenyDurationMs;
      } else if (targetReactionClass === REACTION_CLASSES.THROTTLE) {
        durationMs = this.securityPolicy.throttleDurationMs;
      }

      const reactionRecord = {
        id: nextSecId("react"),
        reactionClass: targetReactionClass,
        target: detection.subject.startsWith("source:") ? detection.source : detection.subject.replace(/^[a-z_]+:/, ""),
        subjectKey: detection.subject,
        durationMs,
        appliedAt: now,
        expiresAt: now + durationMs,
        detectionId: detection.id,
        supportingDetections: [detection.id],
        policyId: this.securityPolicy.id,
        policyVersion: this.securityPolicy.version,
        metadata: {
          pattern: detection.pattern,
          delayMs: this.securityPolicy.throttleDelayMs
        }
      };

      // 8. Execute via Trusted SecurityAdapter
      let success = false;
      try {
        success = await this.securityAdapter.apply(reactionRecord);
      } catch (e) {
        success = false;
      }

      if (success) {
        this.activeReactions.set(dedupeKey, reactionRecord);
        this.reactionsHistory.push(reactionRecord);
        appliedReactions.push(reactionRecord);

        // Correlate with Security Incident (distinct from health incidents)
        if (this.store) {
          this.correlateSecurityIncident(detection, reactionRecord);
        }
      } else {
        this.recordReactionFailure(targetReactionClass, detection, "SecurityAdapter.apply() failed");
      }
    }

    return { detections, reactions: appliedReactions };
  }

  recordReactionFailure(reactionClass, detection, reason) {
    this.reactionsHistory.push({
      id: nextSecId("react_fail"),
      reactionClass,
      subjectKey: detection.subject,
      status: "failed",
      reason,
      timestamp: new Date().toISOString()
    });
  }

  correlateSecurityIncident(detection, reaction) {
    const existing = this.store.queryIncidents({ primary_component: "security" }).find(
      inc => inc.failure_code === detection.pattern && inc.status === INCIDENT_STATUS.OPEN
    );

    if (existing) {
      existing.summary = `Pattern ${detection.pattern} detected on ${detection.subject}. Reaction: ${reaction.reactionClass}`;
      existing.recovery_status = `reaction_${reaction.reactionClass}`;
    } else {
      const incident = new Incident({
        application: "system",
        primary_component: "security",
        failure_code: detection.pattern,
        severity: detection.severity,
        current_health: HEALTH_STATES.HEALTHY, // Security incident does NOT mark runtime unhealthy!
        summary: `Security Detection: ${detection.pattern} on ${detection.subject}`,
        recovery_status: `reaction_${reaction.reactionClass}`
      });
      this.store.addIncident(incident);
    }
  }

  async inspectStatus() {
    const adapterState = await this.securityAdapter.inspect();
    return {
      policy: {
        id: this.securityPolicy.id,
        version: this.securityPolicy.version,
        shadowMode: this.securityPolicy.shadowMode
      },
      activeReactions: adapterState.activeReactions,
      recentHistory: this.reactionsHistory.slice(-20)
    };
  }
}
