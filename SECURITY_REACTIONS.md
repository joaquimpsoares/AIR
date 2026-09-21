# AIR Security Reaction Engine & Abuse Detection

## Overview

AIR's **Security Reaction Engine** provides generic behavioral attack and abuse detection layered on top of the Semantic Runtime, CapabilityEngine, and structured operational telemetry.

### Core Architectural Principle
**AI IS NOT THE ENFORCEMENT ENGINE.**
Detection, correlation, and reaction selection are strictly controlled by **deterministic policy** and **two-key security authorization**.

---

## 1. Normalized Security Event Families

Security events use a safe, versioned structured envelope:
- **Authentication:** `auth.login.succeeded`, `auth.login.failed`, `auth.logout`, `auth.session.expired`, `auth.session.revoked`, `auth.password_reset.requested`, `auth.password_reset.failed`
- **Authorization:** `authorization.allowed`, `authorization.denied`
- **Capability:** `capability.allowed`, `capability.denied`, `capability.escalation_attempt`
- **Data:** `data.access.denied`, `data.enumeration.suspected`
- **Connector:** `connector.action.denied`, `connector.discovery.anomaly`
- **Network:** `network.destination.denied`, `network.redirect.denied`
- **Request & Rates:** `request.rate.exceeded`, `request.malformed`, `request.enumeration.suspected`
- **Reaction Lifecycle:** `security.pattern.detected`, `security.reaction.started`, `security.reaction.applied`, `security.reaction.failed`, `security.reaction.expired`

---

## 2. Generic Behavior-Based Detectors

Detectors evaluate sliding time windows and enforce **bounded cardinality** (`maxTrackedSubjects` with oldest eviction) to prevent memory exhaustion:

| Detector | Triggering Pattern | Threshold Example | Default Reaction |
|---|---|---|---|
| **Failed Login Detector** | `repeated_identity_login_failures` | 5 failures / 60s per identity | `throttle` |
| **Password Spray Detector** | `password_spray_pattern` | 5 failures across >= 3 identities from 1 source / 60s | `temporary_source_deny` |
| **Credential Stuffing Detector** | `credential_stuffing_pattern` | 20 failures across >= 5 identities | `rate_limit` |
| **Authorization Abuse Detector** | `repeated_authorization_probing` | 4 denials / 60s per session/actor | `session_revoke` |
| **Resource Enumeration Detector** | `resource_enumeration_pattern` | 6 denials/404s / 30s | `rate_limit` |
| **Capability Abuse Detector** | `capability_abuse_pattern` | 3 ungranted action/secret/network attempts / 60s | `throttle` |
| **Rate Window Detector** | `request_rate_spike` | 10 excessive rate events / 10s | `rate_limit` |

---

## 3. Trusted Client Address & Proxy Safety

- Client IP is extracted safely using `extractClientAddress()`.
- `X-Forwarded-For` and `Forwarded` headers are **ignored** unless the immediate network peer address is explicitly in `trustedProxies`.
- **IP is not an Identity:** Reactions prioritize the narrowest effective scope (`session` -> `identity` -> `source`). On a shared corporate NAT IP, an attacker's session is revoked without denying innocent users on the same IP.

---

## 4. Graduated Reaction Hierarchy & Safety Limits

Reactions are ordered by disruptiveness:
1. `observe` (Minimal, shadow logging)
2. `rate_limit` (Low, windowed token limit)
3. `throttle` (Low, added delay e.g. 500ms)
4. `session_revoke` (Medium, invalidates compromised session)
5. `temporary_identity_deny` (High, temporary account lock)
6. `temporary_source_deny` (High, host-layer source IP rejection)
7. `escalate` (Operator alert)

### Safety Limits
- `MAX_DENY_DURATION_MS = 86400000` (24 hours max)
- `MAX_THROTTLE_DURATION_MS = 3600000` (1 hour max)
- `MAX_TRACKED_SUBJECTS = 10000`

---

## 5. Two-Key Reaction Authorization

Privileged reaction execution requires **both**:
1. **Key 1 (Policy Eligibility):** Defined in `SecurityPolicy` reaction mappings.
2. **Key 2 (Security Capability Grant):** `security:<reaction_class>` granted to the operational host.

### Automatic Clock-Driven Expiry & Deduplication
- Temporary reactions automatically expire (`security.reaction.expired`).
- Duplicate active reactions on the same subject are coalesced to prevent reaction storms.

---

## 6. Trusted SecurityAdapter

The host boundary interacts via `SecurityAdapter` (`apply`, `revoke`, `inspect`):
- **`LocalSecurityAdapter`:** Process-local in-memory enforcement for rate limiting, throttling, session revocation, and source rejection.
- **Future Adapters:** Cloudflare, AWS WAF, reverse proxies, and identity providers map semantic reactions without giving AIR direct infrastructure authority.
