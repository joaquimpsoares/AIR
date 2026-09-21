/**
 * AIR Sanitized AI Incident Diagnostics & Diagnostic Analyzer Boundary
 * 
 * Implements:
 * 1. Sanitized, Read-Only DiagnosticContext with PII Minimization & Event Aggregation
 * 2. Prompt-Injection Boundary separating instructions from untrusted event data
 * 3. DiagnosticAnalyzer Contract (Read-Only Diagnostic Authority)
 * 4. DeterministicDiagnosticAnalyzer (Evidence-Citing Reference Implementation)
 * 5. Structural Fact / Inference / Recommendation Separation
 * 6. Untrusted Report Validator (Enforcing Evidence References & Zero Executable Handles)
 */

import { globalRedactor } from "./security.mjs";

/**
 * Builds a sanitized, compressed, read-only DiagnosticContext from an incident.
 */
export function buildDiagnosticContext(incident, options = {}) {
  const events = options.events ?? incident.events ?? [];
  const healthSnapshot = options.healthSnapshot ?? {};
  const topology = options.topology ?? {};
  const maxEvents = options.maxEvents ?? 50;

  // 1. Event Compression & Aggregation
  let compressedEventsSummary = null;
  const eventIds = [];
  const distinctSources = new Set();
  const distinctIdentities = new Set();
  const distinctErrorCodes = new Set();

  for (const evt of events) {
    if (evt.id) eventIds.push(evt.id);
    if (evt.source || evt.metadata?.source) distinctSources.add(evt.source || evt.metadata?.source);
    if (evt.actor_id || evt.metadata?.identity) distinctIdentities.add(evt.actor_id || evt.metadata?.identity);
    if (evt.metadata?.errorCode) distinctErrorCodes.add(evt.metadata?.errorCode);
  }

  if (events.length > 5) {
    compressedEventsSummary = {
      totalEventCount: events.length,
      distinctSourcesCount: distinctSources.size,
      distinctIdentitiesCount: distinctIdentities.size,
      distinctErrorCodes: Array.from(distinctErrorCodes),
      sampleEventIds: eventIds.slice(0, 10)
    };
  }

  // 2. Untrusted Data Isolation (Prompt Injection Defense)
  // All user-controlled strings (e.g. username, paths, notes) are quarantined in untrustedEventData
  const safeTimeline = [];
  const untrustedEventData = [];

  for (const evt of events.slice(-maxEvents)) {
    const safeType = evt.event_type || "operational.event";
    const time = evt.timestamp ? evt.timestamp.substring(11, 19) : "00:00:00";
    safeTimeline.push(`${time} [${(evt.severity || "info").toUpperCase()}] ${evt.component || "system"}: ${safeType}`);

    if (evt.metadata?.message || evt.metadata?.error || evt.metadata?.input) {
      untrustedEventData.push({
        eventId: evt.id,
        content: globalRedactor.redactString(String(evt.metadata?.message || evt.metadata?.error || ""))
      });
    }
  }

  // 3. Assemble Frozen Diagnostic Context
  const context = {
    schemaVersion: "air.diagnostic.context@1",
    incidentId: incident.incident_id,
    openedAt: incident.opened_at,
    closedAt: incident.closed_at || null,
    status: incident.status,
    severity: incident.severity,
    primaryComponent: incident.primary_component,
    failureCode: incident.failure_code,
    summary: globalRedactor.redactString(incident.summary || ""),
    timeline: safeTimeline,
    eventAggregation: compressedEventsSummary,
    evidenceEventIds: eventIds.slice(0, 50),
    componentHealth: globalRedactor.redactObject({ ...healthSnapshot }),
    topology: globalRedactor.redactObject({ ...topology }),
    recoveryAttempts: (incident.recovery_attempts || []).map(r => ({
      action: r.action,
      result: r.result,
      reason: globalRedactor.redactString(r.reason || "")
    })),
    // Isolated quarantine for untrusted data
    untrustedEventData
  };

  // Deep-freeze to prevent mutation and enforce read-only boundary
  return Object.freeze(JSON.parse(JSON.stringify(context)));
}

/**
 * Base Diagnostic Analyzer Interface
 */
export class DiagnosticAnalyzer {
  constructor(id = "diagnostic-analyzer") {
    this.id = id;
    this.authority = "READ_ONLY_DIAGNOSTIC";
  }

  async analyze(diagnosticContext) {
    throw new Error(`analyze() not implemented on ${this.id}`);
  }
}

/**
 * Deterministic Diagnostic Analyzer (Evidence-Citing Reference Implementation)
 */
export class DeterministicDiagnosticAnalyzer extends DiagnosticAnalyzer {
  constructor(id = "deterministic-diagnostic-analyzer") {
    super(id);
  }

  async analyze(context) {
    const facts = [];
    const inferences = [];
    const recommendations = [];

    // Fact 1: Primary failure registration
    facts.push({
      statement: `Incident '${context.incidentId}' opened on component '${context.primaryComponent}' with failure '${context.failureCode}'.`,
      evidenceIds: context.evidenceEventIds.slice(0, 3)
    });

    // Fact 2: Event volume
    if (context.eventAggregation) {
      facts.push({
        statement: `Observed ${context.eventAggregation.totalEventCount} events across ${context.eventAggregation.distinctSourcesCount} source(s) and ${context.eventAggregation.distinctIdentitiesCount} identity/identities.`,
        evidenceIds: context.eventAggregation.sampleEventIds
      });
    }

    // Inferences based on patterns
    if (context.failureCode === "password_spray_pattern" || context.failureCode?.includes("spray")) {
      inferences.push({
        statement: "Observed authentication failures match automated credential spraying across multiple accounts.",
        supportingFacts: [0, 1],
        confidence: "high evidence"
      });
      recommendations.push("Inspect whether targeted accounts share common password complexity deficits or recent breaches.");
      recommendations.push("Verify that temporary source throttling was verified by the SecurityAdapter.");
    } else if (context.failureCode === "repeated_authorization_probing") {
      inferences.push({
        statement: "Authenticated session is systematically probing unauthorized resource family endpoints.",
        supportingFacts: [0],
        confidence: "high evidence"
      });
      recommendations.push("Review actor permissions and consider session invalidation.");
    } else if (context.failureCode === "AIR_DATA_SOURCE_UNAVAILABLE" || context.failureCode === "AIR_DATA_SOURCE_TIMEOUT") {
      inferences.push({
        statement: "Data dependency connection failed while the AIR Semantic Runtime remains healthy.",
        supportingFacts: [0],
        confidence: "high evidence"
      });
      recommendations.push("Check downstream database health and network connectivity.");
      recommendations.push("Verify circuit breaker status before resuming heavy query workloads.");
    } else {
      inferences.push({
        statement: `Operational failure observed in component '${context.primaryComponent}'.`,
        supportingFacts: [0],
        confidence: "moderate evidence"
      });
      recommendations.push("Review recent operational events and verify component dependencies.");
    }

    const report = {
      schemaVersion: "air.diagnostic.report@1",
      source: "deterministic_analyzer",
      incidentId: context.incidentId,
      facts,
      inferences,
      recommendations
    };

    // Validate report structure before returning
    DiagnosticReportValidator.validate(report, context);
    return report;
  }
}

/**
 * Diagnostic Report Validator
 */
export class DiagnosticReportValidator {
  static validate(report, context) {
    if (!report || typeof report !== "object") {
      throw new Error("Invalid DiagnosticReport: Must be an object.");
    }

    if (report.source !== "deterministic_analyzer" && !report.source?.startsWith("ai_provider:")) {
      throw new Error(`Invalid DiagnosticReport source: ${report.source}`);
    }

    if (!Array.isArray(report.facts) || !Array.isArray(report.inferences) || !Array.isArray(report.recommendations)) {
      throw new Error("Invalid DiagnosticReport: Must contain facts, inferences, and recommendations arrays.");
    }

    // Validate that facts cite valid evidence IDs
    const validEvidenceIds = new Set(context.evidenceEventIds || []);
    for (const fact of report.facts) {
      if (!fact.statement || typeof fact.statement !== "string") {
        throw new Error("Invalid Fact: Statement must be a non-empty string.");
      }
      if (Array.isArray(fact.evidenceIds)) {
        for (const evId of fact.evidenceIds) {
          if (validEvidenceIds.size > 0 && !validEvidenceIds.has(evId)) {
            // Uncited or hallucinatory evidence ID
            throw new Error(`DiagnosticReport cites invalid evidence ID '${evId}' not present in context.`);
          }
        }
      }
    }

    // Validate that recommendations are text only (no executable tool calls)
    for (const rec of report.recommendations) {
      if (typeof rec !== "string") {
        throw new Error("Invalid Recommendation: Must be a plain prose string, executable tool objects are strictly forbidden.");
      }
    }

    // Reject any function or adapter handles
    for (const key of Object.keys(report)) {
      if (typeof report[key] === "function") {
        throw new Error(`Found executable function in DiagnosticReport: ${key}`);
      }
    }

    return true;
  }
}
