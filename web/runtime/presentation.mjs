/**
 * AIR Presentation IR v1 Compiler & Runtime
 *
 * Defines the platform-neutral Presentation IR v1 schema, the Presentation Compiler,
 * the Experience Library registry, and canonical serialization.
 */

export const PRESENTATION_IR_VERSION = 1;

/**
 * Standard Experience Registry
 */
export const EXPERIENCE_REGISTRY = Object.freeze({
  "resource.management": {
    id: "resource.management",
    version: 1,
    purpose: "Infers responsive list/detail/form/query/CRUD management for a resource.",
    requires: ["resource", "field"],
    provides: ["collection", "detail", "editor", "search", "filters", "sorting", "pagination", "actions"],
    configuration: ["create", "edit", "delete", "lifecycle", "page_size"]
  },
  "schedule.management": {
    id: "schedule.management",
    version: 1,
    purpose: "Infers responsive time grid and chronological agenda scheduling for temporal resources.",
    requires: ["resource", "interval", "ref"],
    provides: ["schedule_grid", "agenda_list", "date_navigation", "slot_booking", "blackout_display", "filters"],
    configuration: ["start_hour", "end_hour", "view_mode", "timezone"]
  },
  "workflow.inbox": {
    id: "workflow.inbox",
    version: 1,
    purpose: "Infers actor-adaptive review inbox for pending workflow transitions across processes.",
    requires: ["process", "transition", "actor"],
    provides: ["inbox_collection", "pending_actions", "evidence_capture", "escalation_indicators"],
    configuration: ["title", "icon"]
  },
  "auth.standard": {
    id: "auth.standard",
    version: 1,
    purpose: "Composite standard authentication, identity verification, recovery, and account lifecycle experience.",
    composes: [
      "auth.login",
      "auth.logout",
      "auth.registration",
      "auth.verify_identity",
      "auth.forgot_password",
      "auth.reset_password",
      "auth.change_password",
      "auth.session",
      "auth.switch_user",
      "account.profile",
      "account.security",
      "account.sessions"
    ],
    lifecycle: ["application_entry", "session_exit", "authenticated_content"]
  },
  "auth.login": {
    id: "auth.login",
    version: 1,
    purpose: "Standard presentation flow for user identity credential authentication.",
    requires: ["actor"],
    provides: ["identity_input", "credential_input", "submit_action", "error_feedback", "loading_state", "success_outcome"],
    lifecycle: "application_entry",
    configuration: ["identity_field", "actor"]
  },
  "auth.logout": {
    id: "auth.logout",
    version: 1,
    purpose: "Standard session termination and credential state clearance.",
    provides: ["logout_action", "session_clearance", "redirect_to_login"],
    lifecycle: "session_exit"
  },
  "auth.registration": {
    id: "auth.registration",
    version: 1,
    purpose: "Standard self-service account registration creating unverified identities.",
    requires: ["actor"],
    provides: ["name_input", "identity_input", "password_input", "confirm_password_input", "submit_action"],
    lifecycle: "application_entry"
  },
  "auth.verify_identity": {
    id: "auth.verify_identity",
    version: 1,
    purpose: "Identity verification challenge verification flow.",
    provides: ["code_input", "verify_action", "feedback"],
    lifecycle: "application_entry"
  },
  "auth.forgot_password": {
    id: "auth.forgot_password",
    version: 1,
    purpose: "Generic self-service password recovery initiation with anti-enumeration response.",
    provides: ["identity_input", "submit_action", "non_enumerating_feedback"],
    lifecycle: "application_entry"
  },
  "auth.reset_password": {
    id: "auth.reset_password",
    version: 1,
    purpose: "Single-use recovery token password reset presentation flow.",
    provides: ["token_input", "new_password_input", "confirm_password_input", "submit_action"],
    lifecycle: "application_entry"
  },
  "auth.change_password": {
    id: "auth.change_password",
    version: 1,
    purpose: "Authenticated in-session password modification.",
    provides: ["current_password_input", "new_password_input", "confirm_password_input", "submit_action"],
    lifecycle: "authenticated_content"
  },
  "auth.session": {
    id: "auth.session",
    version: 1,
    purpose: "Authenticated active session inspection and revocation.",
    provides: ["session_list", "current_indicator", "revoke_action", "revoke_others_action"],
    lifecycle: "authenticated_content"
  },
  "auth.switch_user": {
    id: "auth.switch_user",
    version: 1,
    purpose: "Development/demo principal switcher for role and policy testing.",
    provides: ["user_selector", "switch_action"],
    lifecycle: "authenticated_content"
  },
  "account.profile": {
    id: "account.profile",
    version: 1,
    purpose: "Authenticated user profile inspection and editing.",
    provides: ["profile_card", "editable_attributes", "save_action"],
    lifecycle: "authenticated_content"
  },
  "account.security": {
    id: "account.security",
    version: 1,
    purpose: "Authenticated user security dashboard composing password change and session management.",
    provides: ["change_password_section", "active_sessions_section"],
    lifecycle: "authenticated_content"
  },
  "account.sessions": {
    id: "account.sessions",
    version: 1,
    purpose: "Authenticated session management sub-experience.",
    provides: ["session_list", "revoke_action"],
    lifecycle: "authenticated_content"
  },
  "user.management": {
    id: "user.management",
    version: 1,
    purpose: "Administrator user lifecycle and role management experience.",
    requires: ["actor"],
    provides: ["user_list", "status_toggle", "role_assignment", "activity_indicators"],
    lifecycle: "authorized_content",
    authority: "role:admin"
  },
  "marketing.landing": {
    id: "marketing.landing",
    version: 1,
    purpose: "Composite public product landing page experience composing hero, features, proof, pricing, FAQ, and CTA.",
    composes: [
      "marketing.hero",
      "marketing.features",
      "marketing.social_proof",
      "marketing.pricing",
      "marketing.faq",
      "marketing.cta",
      "marketing.footer"
    ],
    lifecycle: "public"
  },
  "marketing.hero": {
    id: "marketing.hero",
    version: 1,
    purpose: "High-impact conversion header with headlines, visual asset, actions, and motion intent.",
    provides: ["headline", "tagline", "primary_action", "secondary_action", "media", "motion_intent"],
    lifecycle: "public"
  },
  "marketing.features": {
    id: "marketing.features",
    version: 1,
    purpose: "Feature showcase grid highlighting product capabilities and value propositions.",
    provides: ["feature_grid", "iconography", "feature_descriptions"],
    lifecycle: "public"
  },
  "marketing.social_proof": {
    id: "marketing.social_proof",
    version: 1,
    purpose: "Customer testimonials, quotes, and social proof metrics.",
    provides: ["quote_carousel", "testimonials", "stats_grid"],
    lifecycle: "public"
  },
  "marketing.pricing": {
    id: "marketing.pricing",
    version: 1,
    purpose: "Tiered pricing comparison table with feature breakdown and subscription CTAs.",
    provides: ["pricing_tiers", "tier_features", "checkout_actions", "billing_interval_toggle"],
    lifecycle: "public"
  },
  "marketing.faq": {
    id: "marketing.faq",
    version: 1,
    purpose: "Interactive expandable frequently asked questions accordion.",
    provides: ["faq_accordion", "search_questions"],
    lifecycle: "public"
  },
  "marketing.cta": {
    id: "marketing.cta",
    version: 1,
    purpose: "Closing conversion call-to-action banner.",
    provides: ["headline", "supporting_copy", "action_button"],
    lifecycle: "public"
  },
  "marketing.footer": {
    id: "marketing.footer",
    version: 1,
    purpose: "Standard public footer with navigational links, social badges, and copyright statement.",
    provides: ["footer_links", "brand_statement", "copyright"],
    lifecycle: "public"
  }
});

/**
 * Computes an incremental Presentation Patch from a semantic runtime event.
 * 
 * @param {object} previousIr Previous Presentation IR
 * @param {object} event Semantic mutation/lifecycle event from AppRuntime
 * @param {object} runtime Authoritative AppRuntime instance
 * @returns {object} Platform-neutral Presentation Patch
 */
export function computePresentationPatch(previousIr, event, runtime) {
  const patch = {
    schema: "air.presentation-patch",
    version: 1,
    timestamp: event?.timestamp ?? new Date().toISOString(),
    type: event?.type ?? "semantic_update",
    operations: []
  };

  if (!event || !runtime) return patch;

  switch (event.type) {
    case "resource_created": {
      patch.operations.push({
        op: "add_collection_item",
        resource: event.resource,
        recordId: event.record?.id,
        record: event.record
      });
      patch.operations.push({
        op: "invalidate_metrics",
        source: event.resource
      });
      break;
    }
    case "resource_updated": {
      patch.operations.push({
        op: "update_collection_item",
        resource: event.resource,
        recordId: event.recordId,
        record: event.record
      });
      patch.operations.push({
        op: "update_detail",
        resource: event.resource,
        recordId: event.recordId,
        record: event.record
      });
      patch.operations.push({
        op: "invalidate_metrics",
        source: event.resource
      });
      break;
    }
    case "resource_deleted":
    case "resource_archived": {
      patch.operations.push({
        op: "remove_collection_item",
        resource: event.resource,
        recordId: event.recordId
      });
      patch.operations.push({
        op: "invalidate_metrics",
        source: event.resource
      });
      break;
    }
    case "workflow_transitioned": {
      patch.operations.push({
        op: "update_collection_item",
        resource: event.resource,
        recordId: event.recordId
      });
      patch.operations.push({
        op: "update_workflow_state",
        resource: event.resource,
        recordId: event.recordId,
        fromState: event.fromState,
        toState: event.toState,
        action: event.action
      });
      patch.operations.push({
        op: "refresh_workflow_inbox",
        resource: event.resource
      });
      patch.operations.push({
        op: "invalidate_metrics",
        source: event.resource
      });
      break;
    }
    case "reset": {
      patch.operations.push({
        op: "refresh_all"
      });
      break;
    }
    default: {
      patch.operations.push({
        op: "refresh_all"
      });
    }
  }

  return patch;
}

function slug(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function displayStatus(value) {
  return String(value ?? "").replaceAll("_", " ");
}

function titleCase(value) {
  return displayStatus(value).replace(/\b\w/g, (character) => character.toUpperCase());
}

function toneAt(index) {
  return ["violet", "blue", "emerald", "amber"][index % 4];
}

/**
 * Compiles an AIR Semantic Model (or Canonical Semantic IR) into Presentation IR v1.
 * 
 * @param {object} model Parsed/compiled AIR Semantic Model
 * @param {object} options Optional context { principal, runtime }
 * @returns {object} Platform-neutral Presentation IR v1
 */
export function compilePresentation(model, options = {}) {
  if (!model || !model.app) {
    throw new Error("compilePresentation requires a valid AIR model");
  }

  const principal = options.principal ?? { actor: null, id: null, roles: [] };
  const runtime = options.runtime ?? null;
  const isAuthenticated = Boolean(principal && (principal.id || (principal.roles && principal.roles.length > 0)));

  const screens = [];
  const navigationItems = [];
  const experiencesUsed = new Set();

  // 1. Check for declared auth experiences (e.g., auth.login, auth.standard)
  const authStandardExp = (model.experiences ?? []).find((exp) => exp.id === "auth.standard" || exp.kind === "auth.standard");
  const authLoginExp = (model.experiences ?? []).find((exp) => exp.id === "auth.login" || exp.kind === "auth.login");
  const authExp = authStandardExp ?? authLoginExp;

  if (authExp) {
    if (authStandardExp) {
      experiencesUsed.add("auth.standard");
      for (const comp of EXPERIENCE_REGISTRY["auth.standard"].composes) {
        experiencesUsed.add(comp);
      }
    } else {
      experiencesUsed.add("auth.login");
    }

    const actorResource = authExp.props?.actor ?? [...(model.actors ?? [])][0] ?? "users";
    const identityField = authExp.props?.identity ?? "email";
    
    // 1a. Login screen
    screens.push({
      id: "auth_login",
      type: "auth_login",
      title: authExp.props?.title ?? "Sign In",
      subtitle: authExp.props?.subtitle ?? `Sign in to ${model.app.title}`,
      experience: "auth.login",
      navigation: { visible: false },
      sections: [
        {
          id: "login_form_section",
          type: "form",
          title: "Credentials",
          fields: [
            {
              id: "identity",
              name: "identity",
              type: identityField === "email" ? "email" : "text",
              label: titleCase(identityField),
              placeholder: `Enter your ${identityField}`,
              required: true,
              autoComplete: "username"
            },
            {
              id: "password",
              name: "password",
              type: "password",
              label: "Password",
              placeholder: "••••••••",
              required: true,
              autoComplete: "current-password"
            }
          ],
          actions: [
            {
              id: "login_submit",
              intent: "submit",
              label: "Sign in",
              classification: "primary",
              destructive: false,
              confirmation: false,
              available: true
            }
          ],
          feedback: {
            submittingLabel: "Signing in…",
            errorTone: "danger",
            successTone: "positive"
          }
        }
      ]
    });

    // 1b. If auth.standard is active, project sub-experience screens
    if (authStandardExp) {
      // Registration screen
      screens.push({
        id: "auth_register",
        type: "auth_register",
        title: "Create an Account",
        subtitle: `Register for ${model.app.title}`,
        experience: "auth.registration",
        navigation: { visible: false },
        sections: [
          {
            id: "register_form_section",
            type: "form",
            title: "Registration Details",
            fields: [
              { id: "name", name: "name", type: "text", label: "Full Name", placeholder: "e.g. Jane Doe", required: true, autoComplete: "name" },
              { id: "identity", name: "identity", type: identityField === "email" ? "email" : "text", label: titleCase(identityField), placeholder: `Enter your ${identityField}`, required: true, autoComplete: "username" },
              { id: "password", name: "password", type: "password", label: "Password", placeholder: "••••••••", required: true, autoComplete: "new-password" },
              { id: "confirm_password", name: "confirm_password", type: "password", label: "Confirm Password", placeholder: "••••••••", required: true, autoComplete: "new-password" }
            ],
            actions: [
              { id: "register_submit", intent: "submit", label: "Create Account", classification: "primary", destructive: false, confirmation: false, available: true }
            ]
          }
        ]
      });

      // Identity verification screen
      screens.push({
        id: "auth_verify",
        type: "auth_verify",
        title: "Verify Identity",
        subtitle: "Enter the verification code sent to your email",
        experience: "auth.verify_identity",
        navigation: { visible: false },
        sections: [
          {
            id: "verify_form_section",
            type: "form",
            title: "Verification Challenge",
            fields: [
              { id: "identity", name: "identity", type: identityField === "email" ? "email" : "text", label: titleCase(identityField), placeholder: `Enter your ${identityField}`, required: true },
              { id: "code", name: "code", type: "text", label: "Verification Code", placeholder: "123456", required: true }
            ],
            actions: [
              { id: "verify_submit", intent: "submit", label: "Verify Account", classification: "primary", destructive: false, confirmation: false, available: true }
            ]
          }
        ]
      });

      // Forgot password screen
      screens.push({
        id: "auth_forgot_password",
        type: "auth_forgot_password",
        title: "Reset Password",
        subtitle: "Enter your email to receive recovery instructions",
        experience: "auth.forgot_password",
        navigation: { visible: false },
        sections: [
          {
            id: "forgot_form_section",
            type: "form",
            title: "Account Recovery",
            fields: [
              { id: "identity", name: "identity", type: identityField === "email" ? "email" : "text", label: titleCase(identityField), placeholder: `Enter your ${identityField}`, required: true, autoComplete: "username" }
            ],
            actions: [
              { id: "forgot_submit", intent: "submit", label: "Send Reset Link", classification: "primary", destructive: false, confirmation: false, available: true }
            ]
          }
        ]
      });

      // Reset password screen
      screens.push({
        id: "auth_reset_password",
        type: "auth_reset_password",
        title: "Set New Password",
        subtitle: "Enter your single-use reset token and choose a new password",
        experience: "auth.reset_password",
        navigation: { visible: false },
        sections: [
          {
            id: "reset_form_section",
            type: "form",
            title: "Set Password",
            fields: [
              { id: "token", name: "token", type: "text", label: "Reset Token", placeholder: "rst_...", required: true },
              { id: "password", name: "password", type: "password", label: "New Password", placeholder: "••••••••", required: true, autoComplete: "new-password" },
              { id: "confirm_password", name: "confirm_password", type: "password", label: "Confirm New Password", placeholder: "••••••••", required: true, autoComplete: "new-password" }
            ],
            actions: [
              { id: "reset_submit", intent: "submit", label: "Reset Password", classification: "primary", destructive: false, confirmation: false, available: true }
            ]
          }
        ]
      });

      // Account Profile screen
      screens.push({
        id: "account_profile",
        type: "account_profile",
        title: "Account Profile",
        subtitle: "View and update your personal details",
        icon: "users",
        experience: "account.profile",
        navigation: {
          visible: isAuthenticated,
          order: 90,
          label: "Account Profile"
        }
      });
      if (isAuthenticated) {
        navigationItems.push({
          id: "account_profile",
          screenId: "account_profile",
          title: "Account Profile",
          icon: "users",
          visible: true
        });
      }

      // Security & Sessions screen
      screens.push({
        id: "account_security",
        type: "account_security",
        title: "Security & Sessions",
        subtitle: "Manage your password and active sessions",
        icon: "lock",
        experience: "account.security",
        navigation: {
          visible: isAuthenticated,
          order: 91,
          label: "Security & Sessions"
        }
      });
      if (isAuthenticated) {
        navigationItems.push({
          id: "account_security",
          screenId: "account_security",
          title: "Security & Sessions",
          icon: "lock",
          visible: true
        });
      }
    }
  }

  // 1c. User Management experience (administrator only)
  const userMgmtExp = (model.experiences ?? []).find((exp) => exp.id === "user.management" || exp.kind === "user.management");
  if (userMgmtExp) {
    experiencesUsed.add("user.management");
    const isAdmin = Boolean(principal?.roles?.includes("admin"));
    screens.push({
      id: "user_management",
      type: "user_management",
      title: userMgmtExp.props?.title ?? "User Management",
      subtitle: userMgmtExp.props?.subtitle ?? "Manage system accounts, roles, and status",
      icon: "users",
      experience: "user.management",
      authority: "role:admin",
      navigation: {
        visible: isAuthenticated && isAdmin,
        order: 92,
        label: "User Management"
      }
    });
    if (isAuthenticated && isAdmin) {
      navigationItems.push({
        id: "user_management",
        screenId: "user_management",
        title: "User Management",
        icon: "users",
        visible: true
      });
    }
  }

  // 1d. Marketing / Landing Experiences
  const marketingLandingExp = (model.experiences ?? []).find((exp) => exp.id === "marketing.landing" || exp.kind === "marketing.landing");
  const marketingHeroExp = (model.experiences ?? []).find((exp) => exp.id === "marketing.hero" || exp.kind === "marketing.hero");
  const marketingFeaturesExp = (model.experiences ?? []).find((exp) => exp.id === "marketing.features" || exp.kind === "marketing.features");
  const marketingSocialProofExp = (model.experiences ?? []).find((exp) => exp.id === "marketing.social_proof" || exp.kind === "marketing.social_proof" || exp.id === "marketing.testimonials");
  const marketingPricingExp = (model.experiences ?? []).find((exp) => exp.id === "marketing.pricing" || exp.kind === "marketing.pricing");
  const marketingFaqExp = (model.experiences ?? []).find((exp) => exp.id === "marketing.faq" || exp.kind === "marketing.faq");
  const marketingCtaExp = (model.experiences ?? []).find((exp) => exp.id === "marketing.cta" || exp.kind === "marketing.cta");
  const marketingFooterExp = (model.experiences ?? []).find((exp) => exp.id === "marketing.footer" || exp.kind === "marketing.footer");

  const hasMarketing = Boolean(
    marketingLandingExp || marketingHeroExp || marketingFeaturesExp ||
    marketingSocialProofExp || marketingPricingExp || marketingFaqExp ||
    marketingCtaExp || marketingFooterExp
  );

  if (hasMarketing) {
    if (marketingLandingExp) {
      experiencesUsed.add("marketing.landing");
      for (const comp of EXPERIENCE_REGISTRY["marketing.landing"].composes) {
        experiencesUsed.add(comp);
      }
    }
    if (marketingHeroExp) experiencesUsed.add("marketing.hero");
    if (marketingFeaturesExp) experiencesUsed.add("marketing.features");
    if (marketingSocialProofExp) experiencesUsed.add("marketing.social_proof");
    if (marketingPricingExp) experiencesUsed.add("marketing.pricing");
    if (marketingFaqExp) experiencesUsed.add("marketing.faq");
    if (marketingCtaExp) experiencesUsed.add("marketing.cta");
    if (marketingFooterExp) experiencesUsed.add("marketing.footer");

    const landingSections = [];

    // Hero Section
    const heroProps = marketingHeroExp?.props ?? marketingLandingExp?.props ?? {};
    landingSections.push({
      id: "hero_section",
      type: "hero",
      experience: "marketing.hero",
      headline: heroProps.headline ?? heroProps.title ?? model.app.title,
      tagline: heroProps.tagline ?? heroProps.subtitle ?? model.app.subtitle,
      primaryAction: {
        label: heroProps.primary_action ?? "Get Started",
        url: heroProps.primary_action_url ?? "#pricing",
        intent: "primary_cta"
      },
      secondaryAction: heroProps.secondary_action ? {
        label: heroProps.secondary_action,
        url: heroProps.secondary_action_url ?? "#features",
        intent: "secondary_cta"
      } : null,
      media: heroProps.media ? {
        src: heroProps.media,
        alt: heroProps.media_alt ?? "Product preview",
        type: "image"
      } : null,
      motion: {
        type: heroProps.motion ?? "pointer_follow",
        intensity: "subtle",
        reducedMotionFallback: "static"
      }
    });

    // Features Section
    const featuresProps = marketingFeaturesExp?.props ?? marketingLandingExp?.props ?? {};
    let featureItems = [
      { id: "feat_1", title: "Intent-First Architecture", description: "Describe application behavior and invariants without boilerplate HTML, CSS, or routing plumbing.", icon: "spark" },
      { id: "feat_2", title: "Deterministic State & Workflows", description: "Full multi-step state machines with actor authorization, separation of duty, and immutable audit logs.", icon: "check" },
      { id: "feat_3", title: "Universal Data & Adapters", description: "Seamless persistence across In-Memory, SQLite, and PostgreSQL with zero business code rewrites.", icon: "collection" },
      { id: "feat_4", title: "Autonomous Incident Diagnostics", description: "Built-in read-only incident correlation, sanitized evidence trees, and automated self-healing.", icon: "lock" }
    ];
    if (featuresProps.features && typeof featuresProps.features === "string") {
      try {
        const parsed = JSON.parse(featuresProps.features);
        if (Array.isArray(parsed)) featureItems = parsed;
      } catch (_) {}
    }
    landingSections.push({
      id: "features_section",
      type: "feature_grid",
      experience: "marketing.features",
      title: featuresProps.title ?? "Built for Autonomous Engineering",
      subtitle: featuresProps.subtitle ?? "Everything you need to build robust, verifiable software systems.",
      items: featureItems,
      motion: {
        type: featuresProps.motion ?? "reveal_on_scroll",
        reducedMotionFallback: "static"
      }
    });

    // Social Proof / Testimonials Section
    const proofProps = marketingSocialProofExp?.props ?? marketingLandingExp?.props ?? {};
    let testimonialItems = [
      { id: "t_1", author: "Dr. Elena Rostova", role: "VP of Engineering, Sovereign Cloud", quote: "AIR reduced our AI token footprint by 94% while giving us formal deterministic guarantees we never had with React." },
      { id: "t_2", author: "Marcus Vance", role: "Chief Security Architect, Fintech Dynamics", quote: "The separation of semantic intent from platform rendering completely eliminated UI vulnerability injection vectors." }
    ];
    if (proofProps.testimonials && typeof proofProps.testimonials === "string") {
      try {
        const parsed = JSON.parse(proofProps.testimonials);
        if (Array.isArray(parsed)) testimonialItems = parsed;
      } catch (_) {}
    }
    landingSections.push({
      id: "social_proof_section",
      type: "social_proof",
      experience: "marketing.social_proof",
      title: proofProps.title ?? "Trusted by Mission-Critical Teams",
      subtitle: proofProps.subtitle ?? "See how engineering leaders build software at scale.",
      testimonials: testimonialItems,
      stats: [
        { label: "Token Compression", value: "94%" },
        { label: "Execution Latency", value: "< 2ms" },
        { label: "Security Vulnerabilities", value: "0" }
      ]
    });

    // Pricing Section
    const pricingProps = marketingPricingExp?.props ?? marketingLandingExp?.props ?? {};
    let pricingTiers = [
      { id: "tier_free", name: "Developer", price: "$0", period: "forever", description: "Local development and deterministic testing.", features: ["Single workspace", "Local SQLite adapter", "Presentation Compiler", "CLI tooling"], cta: "Get Started Free", popular: false },
      { id: "tier_pro", name: "Production", price: "$49", period: "per month", description: "Mission-critical applications with enterprise resilience.", features: ["Unlimited workspaces", "PostgreSQL & REST connectors", "Incident Reaction Engine", "Audit & Diagnostics"], cta: "Start Free Trial", popular: true },
      { id: "tier_ent", name: "Enterprise", price: "Custom", period: "billed annually", description: "Dedicated isolation, custom adapters, and compliance SLA.", features: ["Air-gapped deployment", "Custom MCP connectors", "SLA & 24/7 support", "SOC2 verification kit"], cta: "Contact Sales", popular: false }
    ];
    if (pricingProps.tiers && typeof pricingProps.tiers === "string") {
      try {
        const parsed = JSON.parse(pricingProps.tiers);
        if (Array.isArray(parsed)) pricingTiers = parsed;
      } catch (_) {}
    }
    landingSections.push({
      id: "pricing_section",
      type: "pricing_grid",
      experience: "marketing.pricing",
      title: pricingProps.title ?? "Predictable, Transparent Pricing",
      subtitle: pricingProps.subtitle ?? "Scale seamlessly from local prototype to distributed enterprise cluster.",
      tiers: pricingTiers
    });

    // FAQ Section
    const faqProps = marketingFaqExp?.props ?? marketingLandingExp?.props ?? {};
    let faqItems = [
      { id: "faq_1", question: "How does AIR eliminate UI boilerplate?", answer: "AIR compiles platform-neutral presentation semantics into responsive DOM or native views directly. AI agents never need to generate HTML, CSS, React hooks, or responsive media queries." },
      { id: "faq_2", question: "Can AIR render on native mobile platforms?", answer: "Yes. Presentation IR is strictly platform-neutral. The same Presentation IR that powers this web experience maps directly to SwiftUI and Jetpack Compose without touching domain logic." },
      { id: "faq_3", question: "Does AIR require a page reload for state updates?", answer: "No. The AIR reactive presentation runtime dispatches granular semantic diffs and patches, updating affected metrics, tables, and workflow states instantaneously." },
      { id: "faq_4", question: "How does AIR ensure motion accessibility?", answer: "All motion primitives automatically degrade to static states when the user enables prefers-reduced-motion in their operating system." }
    ];
    if (faqProps.items && typeof faqProps.items === "string") {
      try {
        const parsed = JSON.parse(faqProps.items);
        if (Array.isArray(parsed)) faqItems = parsed;
      } catch (_) {}
    }
    landingSections.push({
      id: "faq_section",
      type: "faq_accordion",
      experience: "marketing.faq",
      title: faqProps.title ?? "Frequently Asked Questions",
      subtitle: faqProps.subtitle ?? "Everything you need to know about AIR architecture.",
      items: faqItems
    });

    // Closing CTA Section
    const ctaProps = marketingCtaExp?.props ?? marketingLandingExp?.props ?? {};
    landingSections.push({
      id: "cta_section",
      type: "call_to_action",
      experience: "marketing.cta",
      headline: ctaProps.headline ?? "Start Building Software from Intent Today",
      tagline: ctaProps.tagline ?? "Experience the speed and safety of autonomous software compilation.",
      action: {
        label: ctaProps.action_label ?? "Deploy Your First App",
        url: ctaProps.action_url ?? "#pricing"
      }
    });

    // Footer Section
    const footerProps = marketingFooterExp?.props ?? marketingLandingExp?.props ?? {};
    landingSections.push({
      id: "footer_section",
      type: "footer",
      experience: "marketing.footer",
      brand: model.app.title,
      copyright: footerProps.copyright ?? `© ${new Date().getFullYear()} AIR Platform. All rights reserved.`,
      links: [
        { label: "Documentation", url: "#" },
        { label: "GitHub", url: "https://github.com/joaquimpsoares/AIR" },
        { label: "Privacy Policy", url: "#" },
        { label: "Security Architecture", url: "#" }
      ]
    });

    screens.push({
      id: "marketing_landing",
      type: "marketing_landing",
      title: model.app.title,
      subtitle: model.app.subtitle ?? "Product Experience",
      icon: "spark",
      experience: "marketing.landing",
      navigation: {
        visible: true,
        order: 0,
        label: "Product"
      },
      sections: landingSections
    });

    navigationItems.push({
      id: "marketing_landing",
      screenId: "marketing_landing",
      title: model.app.title,
      icon: "spark",
      visible: true
    });
  }

  // 2. Overview / Dashboard Screen if declared
  const hasOverview = Boolean(model.overview || model.pages?.some((p) => p.id === "overview"));
  if (hasOverview) {
    const overviewPage = model.pages?.find((p) => p.id === "overview");
    const title = overviewPage?.title ?? model.overview?.title ?? "Overview";
    
    // Inferred metrics
    const metrics = [];
    if (overviewPage?.metrics) {
      for (const m of overviewPage.metrics) {
        metrics.push({
          id: m.id,
          label: m.label,
          source: m.source,
          op: m.op,
          operation: m.op,
          field: m.field,
          tone: m.tone ?? "neutral",
          format: m.format ?? (m.field ? "number" : "count"),
          semanticType: m.group ? "categorical" : "metric",
          where: m.where ?? null
        });
      }
    }

    // Recent lists
    const recentLists = (overviewPage?.lists ?? []).map((list) => ({
      id: list.id,
      title: list.title,
      source: list.source,
      columns: list.columns,
      limit: list.limit ?? 5
    }));

    screens.push({
      id: "overview",
      type: "dashboard",
      title,
      subtitle: model.app.subtitle ?? "Workspace overview",
      icon: "dashboard",
      navigation: {
        visible: true,
        order: 0,
        label: title
      },
      sections: [
        {
          id: "overview_metrics",
          type: "metrics_grid",
          title: "Key Metrics",
          metrics
        },
        {
          id: "overview_recent",
          type: "recent_activity",
          lists: recentLists
        }
      ]
    });

    navigationItems.push({
      id: "overview",
      screenId: "overview",
      title,
      icon: "dashboard",
      visible: true
    });
  }

  // 3. Managed Resource Screens (resource.management Experience)
  const managedEntities = [];
  if (model.management) {
    for (const [resourceId, mgmt] of model.management.entries()) {
      const resource = model.entities?.get(resourceId) ?? (model.resources?.find ? model.resources.find(r => r.id === resourceId) : null);
      if (resource) managedEntities.push({ resource, management: mgmt });
    }
  } else if (model.resources) {
    for (const resource of model.resources) {
      if (resource.management) {
        managedEntities.push({ resource, management: resource.management });
      }
    }
  }

  for (const { resource, management } of managedEntities) {
    experiencesUsed.add("resource.management");
    
    // Determine user authority for resource-level actions
    const canCreate = runtime ? runtime.can(resource.id, "create") : true;
    const canView = runtime ? runtime.can(resource.id, "view") : true;
    
    if (!canView) {
      continue; // Actor-adaptive: do not project navigation/screens actor cannot view
    }

    const fields = (resource.fields ?? []).map((f) => ({
      id: f.id,
      name: f.id,
      type: f.type,
      label: f.label ?? titleCase(f.id),
      required: Boolean(f.required),
      unique: Boolean(f.unique),
      readOnly: Boolean(f.readOnly || f.computed),
      options: f.values ?? f.options ?? [],
      ref: f.ref ?? null,
      currency: f.currency ?? null,
      placeholder: f.placeholder ?? "",
      long: Boolean(f.long),
      defaultValue: f.default ?? null,
      min: f.min ?? 0
    }));

    const collectionColumns = resource.experience?.columns
      ?? (model.pages?.find(p => p.source === resource.id)?.columns)
      ?? fields.slice(0, 6).map(f => f.id);

    const searchableFields = fields.filter(f => ["text", "email", "phone"].includes(f.type)).map(f => f.id);
    const filterableFields = fields.filter(f => ["enum", "ref", "bool"].includes(f.type)).map(f => f.id);
    const sortChoices = [resource.labelField ?? fields[0]?.id];

    // Check if resource has temporal interval fields & group relations to attach schedule capability
    const intervalField = (resource.fields ?? []).find(f => f.type === "interval");
    const startField = intervalField?.start ?? (resource.fields ?? []).find(f => f.id === "start_at" || f.id === "start" || f.type === "date" || f.type === "datetime")?.id;
    const endField = intervalField?.end ?? (resource.fields ?? []).find(f => f.id === "end_at" || f.id === "end")?.id;
    const groupRefField = (resource.fields ?? []).find(f => f.type === "ref");

    let scheduleSpec = null;
    if (startField && endField && groupRefField) {
      const allResources = model.entities ? [...model.entities.values()] : (model.resources ?? []);
      const blackoutRes = allResources.find(r => r.id === "blackouts" || r.id.includes("blackout") || r.id.includes("maintenance"))?.id;
      scheduleSpec = {
        resource: resource.id,
        intervalField: intervalField?.id ?? null,
        startField,
        endField,
        groupResource: groupRefField.ref,
        groupField: groupRefField.id,
        groupLabelField: allResources.find(r => r.id === groupRefField.ref)?.labelField ?? "name",
        titleField: resource.labelField ?? "title",
        statusField: (resource.fields ?? []).find(f => f.id === "status" || f.id === "state")?.id ?? "status",
        blackoutResource: blackoutRes ?? null,
        timezone: model.app?.timezone ?? "UTC"
      };
    }

    // Standard resource screen with collection + editor + detail contracts
    screens.push({
      id: resource.id,
      type: "resource_management",
      resource: resource.id,
      experience: "resource.management",
      schedule: scheduleSpec,
      title: resource.plural ?? titleCase(resource.id),
      singular: resource.singular ?? titleCase(resource.id),
      icon: resource.icon ?? "collection",
      labelField: resource.labelField ?? fields[0]?.id,
      navigation: {
        visible: true,
        order: navigationItems.length,
        label: resource.plural ?? titleCase(resource.id)
      },
      collection: {
        columns: collectionColumns,
        searchableFields,
        filterableFields,
        sortChoices,
        pageSize: management.pageSize ?? 8,
        lifecycle: management.lifecycle ?? "delete"
      },
      editor: {
        fields,
        createAllowed: canCreate
      },
      actions: [
        {
          id: `${resource.id}.create`,
          intent: "create",
          label: `Add ${resource.singular ?? titleCase(resource.id)}`,
          classification: "primary",
          available: canCreate,
          destructive: false,
          confirmation: false
        },
        {
          id: `${resource.id}.edit`,
          intent: "edit",
          label: "Edit",
          classification: "secondary",
          available: true,
          destructive: false,
          confirmation: false
        },
        {
          id: `${resource.id}.delete`,
          intent: management.lifecycle === "archive" ? "archive" : "delete",
          label: management.lifecycle === "archive" ? "Archive" : "Delete",
          classification: "destructive",
          available: true,
          destructive: true,
          confirmation: true
        }
      ],
      states: {
        loading: { type: "skeleton", message: "Loading records…" },
        empty: {
          type: "empty_state",
          title: `No ${resource.plural?.toLowerCase() ?? resource.id} yet`,
          message: `Create your first ${resource.singular?.toLowerCase() ?? resource.id} to get started.`
        },
        filteredEmpty: {
          type: "empty_state",
          title: "No matching results",
          message: "Try a different search query or clear active filters."
        },
        denied: {
          type: "permission_denied",
          title: "Access Denied",
          message: "You do not have permission to view or manage these records."
        }
      }
    });

    navigationItems.push({
      id: resource.id,
      screenId: resource.id,
      title: resource.plural ?? titleCase(resource.id),
      icon: resource.icon ?? "collection",
      visible: true
    });
  }

  // 4. Workflow Inbox Experience inference if processes exist and actor has pending transitions
  const processes = model.processes instanceof Map
    ? [...model.processes.values()]
    : (Array.isArray(model.processes) ? model.processes : []);

  if (processes.length > 0) {
    experiencesUsed.add("workflow.inbox");
    // If runtime is supplied, we can project actor-specific pending tasks
    const hasActionableItems = runtime
      ? processes.some(proc => {
          const records = runtime.records ? runtime.records(proc.resource) : [];
          return records.some(r => runtime.availableActions(proc.resource, r.id).length > 0);
        })
      : true;

    if (hasActionableItems) {
      screens.push({
        id: "workflow_inbox",
        type: "workflow_inbox",
        title: "Review Inbox",
        subtitle: "Items requiring your attention or approval",
        icon: "check",
        experience: "workflow.inbox",
        navigation: {
          visible: true,
          order: 1,
          label: "Review Inbox"
        },
        processes: processes.map(p => ({
          resource: p.resource,
          stateField: p.state,
          initialState: p.initial,
          terminalStates: Array.isArray(p.terminal) ? p.terminal : [...(p.terminal ?? [])],
          historyEnabled: Boolean(p.history)
        }))
      });
    }
  }

  const hasAuthExperience = screens.some(s => s.type === "auth_login");
  const hasMarketingLanding = screens.some(s => s.type === "marketing_landing");
  
  const initialScreenId = (hasAuthExperience && !isAuthenticated)
    ? "auth_login"
    : (hasMarketingLanding
      ? "marketing_landing"
      : ((screens.find(s => s.id === model.app.initial && s.type !== "auth_login")?.id)
        ?? screens.find(s => s.type !== "auth_login")?.id
        ?? "overview"));

  return {
    schema: "air.presentation-ir",
    version: PRESENTATION_IR_VERSION,
    app: {
      id: model.app.id,
      title: model.app.title,
      subtitle: model.app.subtitle ?? "",
      initialScreen: initialScreenId
    },
    theme: {
      mode: model.theme?.mode ?? "system",
      accent: model.theme?.accent ?? "violet",
      density: model.theme?.density ?? "comfortable"
    },
    navigation: {
      items: navigationItems
    },
    screens,
    experiences: [...experiencesUsed]
  };
}

/**
 * Serializes Presentation IR into deterministic canonical JSON.
 */
export function serializePresentationIr(ir) {
  return JSON.stringify(ir, Object.keys(ir).sort(), 2);
}
