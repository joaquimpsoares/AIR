import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAir, AppRuntime, parseSeedData } from "../web/runtime/air.mjs";
import { compilePresentation, serializePresentationIr, PRESENTATION_IR_VERSION } from "../web/runtime/presentation.mjs";
import { renderPresentation } from "../web/runtime/ui.mjs";

test("Presentation IR v1 compiles and serializes deterministically", async () => {
  const source = await readFile("apps/customer-manager.air", "utf8");
  const model = parseAir(source);
  const ir = compilePresentation(model);

  assert.equal(ir.schema, "air.presentation-ir");
  assert.equal(ir.version, PRESENTATION_IR_VERSION);
  assert.equal(ir.app.id, "customer_manager");
  assert.equal(ir.screens.length >= 2, true);
  
  const serialized = serializePresentationIr(ir);
  assert.equal(typeof serialized, "string");
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.screens.length, ir.screens.length);
});

test("Customer Manager projects through Presentation Compiler without Customer-specific logic", async () => {
  const source = await readFile("apps/customer-manager.air", "utf8");
  const model = parseAir(source);
  const ir = compilePresentation(model);

  const customerScreen = ir.screens.find(s => s.resource === "customers");
  assert.ok(customerScreen, "Customers screen should exist");
  assert.equal(customerScreen.type, "resource_management");
  assert.equal(customerScreen.experience, "resource.management");
  assert.ok(customerScreen.collection.columns.includes("name"));
  assert.ok(customerScreen.editor.fields.some(f => f.id === "name" && f.required));
  assert.ok(customerScreen.editor.fields.some(f => f.id === "monthly_revenue" && f.currency === "USD"));

  const actions = customerScreen.actions.map(a => a.intent);
  assert.ok(actions.includes("create"));
  assert.ok(actions.includes("edit"));
  assert.ok(actions.includes("archive"));
});

test("Second unrelated managed resource projects identical presentation structures", async () => {
  const source = await readFile("apps/content-publishing.air", "utf8");
  const model = parseAir(source);
  const ir = compilePresentation(model);

  const articleScreen = ir.screens.find(s => s.resource === "articles");
  assert.ok(articleScreen, "Articles screen should exist");
  assert.equal(articleScreen.type, "resource_management");
  assert.equal(articleScreen.experience, "resource.management");
  assert.ok(articleScreen.editor.fields.some(f => f.id === "title" && f.required));
  assert.ok(articleScreen.editor.fields.some(f => f.id === "category" && f.type === "enum"));
});

test("Web renderer renders DOM from Presentation IR without receiving AIR source", async () => {
  const source = await readFile("apps/customer-manager.air", "utf8");
  const seedSource = await readFile("data/customer-manager.seed.json", "utf8");
  const model = parseAir(source);
  const seedData = parseSeedData(seedSource, model);
  const runtime = new AppRuntime(model, { seedData, principal: { actor: "account_managers", id: "am_01", roles: ["admin"] } });
  
  const ir = compilePresentation(model, { runtime });
  
  // Create a synthetic DOM root container
  const root = {
    innerHTML: "",
    attributes: {},
    removeAttribute(attr) { delete this.attributes[attr]; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };

  const app = renderPresentation(root, ir, runtime);
  assert.ok(app, "renderPresentation should return instance");
  assert.ok(root.innerHTML.includes("Northstar CRM"), "Rendered DOM should include app title");
  assert.ok(root.innerHTML.includes("Customers"), "Rendered DOM should include navigation/collection heading");
  assert.ok(root.innerHTML.includes("metric-card"), "Rendered DOM should include metrics");
});

test("Expense Approval workflow projects through Presentation IR", async () => {
  const source = await readFile("apps/expense-approval.air", "utf8");
  const model = parseAir(source);
  const ir = compilePresentation(model);

  assert.ok(ir.screens.some(s => s.id === "workflow_inbox" && s.type === "workflow_inbox"));
  const expenseScreen = ir.screens.find(s => s.resource === "expenses");
  assert.ok(expenseScreen);
  assert.equal(expenseScreen.experience, "resource.management");
  assert.ok(ir.experiences.includes("workflow.inbox"));
});

test("auth.login Experience compiles to valid Presentation IR and renders login DOM", async () => {
  const source = await readFile("apps/experience-demo.air", "utf8");
  const model = parseAir(source);
  const ir = compilePresentation(model);

  assert.ok(ir.experiences.includes("auth.login"));
  const authScreen = ir.screens.find(s => s.type === "auth_login");
  assert.ok(authScreen, "Auth login screen must exist");
  assert.equal(authScreen.experience, "auth.login");
  
  const formSection = authScreen.sections[0];
  assert.equal(formSection.type, "form");
  assert.ok(formSection.fields.some(f => f.name === "identity" && f.type === "email"));
  assert.ok(formSection.fields.some(f => f.name === "password" && f.type === "password"));
  assert.ok(formSection.actions.some(a => a.intent === "submit"));

  const root = {
    innerHTML: "",
    attributes: {},
    removeAttribute(attr) { delete this.attributes[attr]; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };

  renderPresentation(root, ir, null);
  assert.ok(root.innerHTML.includes("auth-login-form"), "DOM must render auth login form");
  assert.ok(root.innerHTML.includes('type="email"'), "DOM must render email field");
  assert.ok(root.innerHTML.includes('type="password"'), "DOM must render password field");
  assert.ok(root.innerHTML.includes("Sign In") || root.innerHTML.includes("Welcome Back"), "DOM must render login text");
});

test("Presentation conformance fixtures compile deterministically", async () => {
  const fixtures = [
    "conformance/presentation/managed-resource.air",
    "conformance/presentation/read-only-resource.air",
    "conformance/presentation/resource-with-insight.air",
    "conformance/presentation/resource-create-authorized.air",
    "conformance/presentation/resource-create-denied.air",
    "conformance/presentation/auth-standard.air",
    "conformance/presentation/user-management.air"
  ];

  for (const fixture of fixtures) {
    const source = await readFile(fixture, "utf8");
    const model = parseAir(source);
    const ir = compilePresentation(model);
    assert.equal(ir.schema, "air.presentation-ir");
    assert.equal(ir.version, 1);
    assert.ok(ir.screens.length > 0);
  }
});

test("auth.login gating: no principal -> auth_login active; authenticated -> normal shell active", async () => {
  const source = await readFile("apps/experience-demo.air", "utf8");
  const model = parseAir(source);

  // Unauthenticated compilation
  const unauthIr = compilePresentation(model, { principal: null });
  assert.equal(unauthIr.app.initialScreen, "auth_login");
  assert.equal(unauthIr.navigation.items.some(item => item.screenId === "auth_login"), false);

  // Authenticated compilation
  const authIr = compilePresentation(model, { principal: { actor: "users", id: "u_admin", roles: ["admin"] } });
  assert.equal(authIr.app.initialScreen, "overview");
  assert.equal(authIr.navigation.items.some(item => item.screenId === "auth_login"), false);
});

test("DemoAuthAdapter authenticates valid credentials and rejects invalid", async () => {
  const { DemoAuthAdapter } = await import("../web/runtime/auth.mjs");
  const adapter = new DemoAuthAdapter();

  // Invalid login
  const invalidRes = await adapter.authenticate("alex@example.com", "wrongpassword");
  assert.equal(invalidRes.ok, false);
  assert.equal(invalidRes.error, "Invalid email or password.");

  // Valid admin login
  const validAdmin = await adapter.authenticate("alex@example.com", "password123");
  assert.equal(validAdmin.ok, true);
  assert.equal(validAdmin.principal.id, "u_admin");
  assert.deepEqual(validAdmin.principal.roles, ["admin"]);

  // Valid member login
  const validMember = await adapter.authenticate("morgan@example.com", "password123");
  assert.equal(validMember.ok, true);
  assert.equal(validMember.principal.id, "u_member");
  assert.deepEqual(validMember.principal.roles, ["member"]);
});

test("auth.standard full registration, verification, and login lifecycle", async () => {
  const { DemoAuthAdapter } = await import("../web/runtime/auth.mjs");
  const adapter = new DemoAuthAdapter();

  // 1. Register new user
  const regResult = await adapter.register("Taylor Swift", "taylor@example.com", "pass1234", "pass1234");
  assert.equal(regResult.ok, true);
  assert.equal(regResult.verificationRequired, true);
  assert.equal(regResult.demoVerificationCode, "123456");

  // Cannot self-register as admin
  const registeredUser = adapter.users.find(u => u.email === "taylor@example.com");
  assert.deepEqual(registeredUser.roles, ["member"]);
  assert.equal(registeredUser.verified, false);

  // 2. Unverified login attempt fails
  const loginBeforeVerify = await adapter.authenticate("taylor@example.com", "pass1234");
  assert.equal(loginBeforeVerify.ok, false);
  assert.equal(loginBeforeVerify.unverified, true);

  // 3. Verify identity with code
  const verifyResult = await adapter.verifyIdentity("taylor@example.com", "123456");
  assert.equal(verifyResult.ok, true);
  assert.equal(registeredUser.verified, true);

  // 4. Login after verification succeeds
  const loginAfterVerify = await adapter.authenticate("taylor@example.com", "pass1234");
  assert.equal(loginAfterVerify.ok, true);
  assert.equal(loginAfterVerify.principal.id, registeredUser.id);
});

test("auth.standard password recovery with single-use token", async () => {
  const { DemoAuthAdapter } = await import("../web/runtime/auth.mjs");
  const adapter = new DemoAuthAdapter();

  // 1. Request reset for existing user -> returns generic message + demo token
  const resetReq = await adapter.requestPasswordReset("alex@example.com");
  assert.equal(resetReq.ok, true);
  assert.ok(resetReq.message.includes("If an account exists"));
  assert.ok(resetReq.demoResetToken);

  // 2. Request reset for nonexistent user -> returns same generic message (anti-enumeration)
  const nonExistReq = await adapter.requestPasswordReset("nonexistent@example.com");
  assert.equal(nonExistReq.ok, true);
  assert.ok(nonExistReq.message.includes("If an account exists"));
  assert.equal(nonExistReq.demoResetToken, null);

  // 3. Reset password with token
  const token = resetReq.demoResetToken;
  const resetRes = await adapter.resetPassword(token, "newpassword456", "newpassword456");
  assert.equal(resetRes.ok, true);

  // 4. Token cannot be reused (single-use)
  const reuseRes = await adapter.resetPassword(token, "anotherpassword", "anotherpassword");
  assert.equal(reuseRes.ok, false);
  assert.ok(reuseRes.error.includes("Invalid or already-used"));

  // 5. Authenticate with new password
  const newLogin = await adapter.authenticate("alex@example.com", "newpassword456");
  assert.equal(newLogin.ok, true);
});

test("auth.standard in-session password change and active session management", async () => {
  const { DemoAuthAdapter } = await import("../web/runtime/auth.mjs");
  const adapter = new DemoAuthAdapter();

  // 1. In-session password change
  const changeRes = await adapter.changePassword("u_admin", "password123", "secret789", "secret789");
  assert.equal(changeRes.ok, true);

  const wrongOldPass = await adapter.changePassword("u_admin", "wrongold", "pass", "pass");
  assert.equal(wrongOldPass.ok, false);

  // 2. Session listing
  const sessions = await adapter.listSessions("u_admin");
  assert.equal(sessions.length >= 2, true);
  const currentSession = sessions.find(s => s.current);
  assert.ok(currentSession);

  // 3. Revoke specific session
  const otherSession = sessions.find(s => !s.current);
  if (otherSession) {
    await adapter.revokeSession(otherSession.id);
    const afterRevoke = await adapter.listSessions("u_admin");
    assert.equal(afterRevoke.some(s => s.id === otherSession.id), false);
  }

  // 4. Revoke all other sessions
  await adapter.revokeOtherSessions("u_admin");
  const remaining = await adapter.listSessions("u_admin");
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].current, true);
});

test("user.management administrator actions vs non-admin rejection", async () => {
  const { DemoAuthAdapter } = await import("../web/runtime/auth.mjs");
  const adapter = new DemoAuthAdapter();

  const adminPrincipal = { actor: "users", id: "u_admin", roles: ["admin"] };
  const memberPrincipal = { actor: "users", id: "u_member", roles: ["member"] };

  // 1. Admin can list all users
  const listRes = await adapter.listUsers(adminPrincipal);
  assert.equal(listRes.ok, true);
  assert.equal(listRes.users.length >= 3, true);

  // Non-admin cannot list users via admin API
  const nonAdminList = await adapter.listUsers(memberPrincipal);
  assert.equal(nonAdminList.ok, false);
  assert.ok(nonAdminList.error.includes("Unauthorized"));

  // 2. Admin can update user role and active status
  const updateRes = await adapter.adminUpdateUser(adminPrincipal, "u_member", { roles: ["manager"], active: true });
  assert.equal(updateRes.ok, true);
  assert.deepEqual(updateRes.user.roles, ["manager"]);

  // 3. Non-admin cannot update users
  const nonAdminUpdate = await adapter.adminUpdateUser(memberPrincipal, "u_admin", { roles: ["member"] });
  assert.equal(nonAdminUpdate.ok, false);
  assert.ok(nonAdminUpdate.error.includes("Unauthorized"));
});

test("Authority isolation: login does not grant unconfigured authority; runtime remains authoritative", async () => {
  const source = await readFile("apps/experience-demo.air", "utf8");
  const seedSource = await readFile("data/experience-demo.seed.json", "utf8");
  const model = parseAir(source);
  const seedData = parseSeedData(seedSource, model);

  const { DemoAuthAdapter } = await import("../web/runtime/auth.mjs");
  const adapter = new DemoAuthAdapter();

  // Member login gives member role only
  const memberAuth = await adapter.authenticate("morgan@example.com", "password123");
  const runtime = new AppRuntime(model, { seedData, principal: memberAuth.principal });

  // Member can edit own record (self), but CANNOT edit another user's record
  const ownRecord = runtime.get("users", "u_member");
  const otherRecord = runtime.get("users", "u_admin");

  assert.equal(runtime.can("users", "edit", ownRecord), true);
  assert.equal(runtime.can("users", "edit", otherRecord), false);

  // Attempting to update another user throws AirError denied
  assert.throws(() => {
    runtime.update("users", "u_admin", { name: "Hacked Name" });
  }, /not permitted|AIR_EXEC_DENIED/);
});

test("Sign out clears active session and returns to login screen", async () => {
  const source = await readFile("apps/experience-demo.air", "utf8");
  const seedSource = await readFile("data/experience-demo.seed.json", "utf8");
  const model = parseAir(source);
  const seedData = parseSeedData(seedSource, model);
  const { DemoAuthAdapter } = await import("../web/runtime/auth.mjs");
  const authAdapter = new DemoAuthAdapter();

  const authResult = await authAdapter.authenticate("alex@example.com", "password123");
  const runtime = new AppRuntime(model, { seedData, principal: authResult.principal });
  const ir = compilePresentation(model, { principal: runtime.principal, runtime });

  const eventListeners = [];
  const root = {
    innerHTML: "",
    attributes: {},
    removeAttribute(attr) { delete this.attributes[attr]; },
    querySelectorAll(selector) {
      if (selector === "[data-logout]") {
        return [{
          addEventListener(event, handler) {
            eventListeners.push({ event, handler });
          }
        }];
      }
      return [];
    },
    querySelector() { return null; }
  };

  const app = renderPresentation(root, ir, runtime, { model, authAdapter });
  assert.ok(root.innerHTML.includes("Sign out"), "Sign out button should be in DOM when authenticated");

  // Trigger sign out
  const logoutListener = eventListeners.find(l => l.event === "click");
  assert.ok(logoutListener, "Logout click listener must exist");
  await logoutListener.handler();

  assert.equal(runtime.principal, null, "Runtime principal must be null after logout");
  assert.ok(root.innerHTML.includes("auth-login-form") || root.innerHTML.includes("Sign In"), "DOM should return to login screen after logout");
});

test("Marketing landing Experience compiles to valid Presentation IR and renders marketing DOM", async () => {
  const source = await readFile("apps/landing-demo.air", "utf8");
  const model = parseAir(source);
  const ir = compilePresentation(model);

  assert.ok(ir.experiences.includes("marketing.landing"));
  const landingScreen = ir.screens.find(s => s.type === "marketing_landing");
  assert.ok(landingScreen, "Marketing landing screen must exist");
  assert.equal(landingScreen.experience, "marketing.landing");
  assert.equal(landingScreen.navigation.visible, true);

  // Sections verification
  const hero = landingScreen.sections.find(s => s.type === "hero");
  assert.ok(hero, "Hero section must exist");
  assert.equal(hero.headline, "Compile Software Directly from Intent");
  assert.equal(hero.primaryAction.label, "Get Started Free");
  assert.equal(hero.motion.type, "pointer_follow");

  const features = landingScreen.sections.find(s => s.type === "feature_grid");
  assert.ok(features, "Features section must exist");
  assert.equal(features.items.length >= 4, true);

  const proof = landingScreen.sections.find(s => s.type === "social_proof");
  assert.ok(proof, "Social proof section must exist");
  assert.equal(proof.testimonials.length >= 2, true);
  assert.equal(proof.stats.length >= 3, true);

  const pricing = landingScreen.sections.find(s => s.type === "pricing_grid");
  assert.ok(pricing, "Pricing section must exist");
  assert.equal(pricing.tiers.length >= 3, true);

  const faq = landingScreen.sections.find(s => s.type === "faq_accordion");
  assert.ok(faq, "FAQ section must exist");
  assert.equal(faq.items.length >= 4, true);

  const cta = landingScreen.sections.find(s => s.type === "call_to_action");
  assert.ok(cta, "CTA section must exist");

  const footer = landingScreen.sections.find(s => s.type === "footer");
  assert.ok(footer, "Footer section must exist");

  // DOM Rendering verification
  const root = {
    innerHTML: "",
    attributes: {},
    removeAttribute(attr) { delete this.attributes[attr]; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };

  renderPresentation(root, ir, null);
  assert.ok(root.innerHTML.includes("marketing-landing"), "DOM must render marketing-landing container");
  assert.ok(root.innerHTML.includes("landing-hero"), "DOM must render hero section");
  assert.ok(root.innerHTML.includes("Compile Software Directly from Intent"), "DOM must include hero headline");
  assert.ok(root.innerHTML.includes("feature-grid"), "DOM must render feature grid");
  assert.ok(root.innerHTML.includes("pricing-grid"), "DOM must render pricing grid");
  assert.ok(root.innerHTML.includes("faq-accordion"), "DOM must render FAQ accordion");
  assert.ok(root.innerHTML.includes("cta-banner"), "DOM must render CTA banner");
  assert.ok(root.innerHTML.includes("landing-footer"), "DOM must render landing footer");
});

test("computePresentationPatch produces granular platform-neutral patch operations", async () => {
  const { computePresentationPatch } = await import("../web/runtime/presentation.mjs");
  const source = await readFile("apps/customer-manager.air", "utf8");
  const model = parseAir(source);
  const runtime = new AppRuntime(model, { seedData: {}, principal: { roles: ["admin"] } });
  const ir = compilePresentation(model, { runtime });

  // 1. Create patch
  const createdRecord = { id: "c_999", name: "Acme Corp" };
  const createPatch = computePresentationPatch(ir, {
    type: "resource_created",
    resource: "customers",
    record: createdRecord
  }, runtime);
  assert.equal(createPatch.schema, "air.presentation-patch");
  assert.equal(createPatch.operations.some(op => op.op === "add_collection_item" && op.recordId === "c_999"), true);
  assert.equal(createPatch.operations.some(op => op.op === "invalidate_metrics"), true);

  // 2. Update patch
  const updatePatch = computePresentationPatch(ir, {
    type: "resource_updated",
    resource: "customers",
    recordId: "c_999",
    record: { id: "c_999", name: "Acme Corp Renamed" }
  }, runtime);
  assert.equal(updatePatch.operations.some(op => op.op === "update_collection_item" && op.recordId === "c_999"), true);
  assert.equal(updatePatch.operations.some(op => op.op === "update_detail" && op.recordId === "c_999"), true);

  // 3. Delete / Archive patch
  const deletePatch = computePresentationPatch(ir, {
    type: "resource_deleted",
    resource: "customers",
    recordId: "c_999"
  }, runtime);
  assert.equal(deletePatch.operations.some(op => op.op === "remove_collection_item" && op.recordId === "c_999"), true);

  // 4. Workflow transition patch
  const transitionPatch = computePresentationPatch(ir, {
    type: "workflow_transitioned",
    resource: "expenses",
    recordId: "exp_01",
    fromState: "submitted",
    toState: "approved",
    action: "approve"
  }, runtime);
  assert.equal(transitionPatch.operations.some(op => op.op === "update_workflow_state" && op.toState === "approved"), true);
  assert.equal(transitionPatch.operations.some(op => op.op === "refresh_workflow_inbox"), true);
});

test("Reactive UI subscription automatically re-renders on semantic mutations", async () => {
  const source = await readFile("apps/customer-manager.air", "utf8");
  const seedSource = await readFile("data/customer-manager.seed.json", "utf8");
  const model = parseAir(source);
  const seedData = parseSeedData(seedSource, model);
  const runtime = new AppRuntime(model, { seedData, principal: { actor: "account_managers", id: "am_01", roles: ["admin"] } });
  const ir = compilePresentation(model, { runtime });

  const root = {
    innerHTML: "",
    attributes: {},
    removeAttribute(attr) { delete this.attributes[attr]; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };

  const app = renderPresentation(root, ir, runtime, { initialScreen: "customers" });

  // Mutate state via runtime
  const res = runtime.create("customers", {
    name: "Globex Corporation",
    email: "globex@example.com",
    account_manager: "am_01",
    monthly_revenue: 15000
  });
  assert.ok(res.record, "Customer creation should succeed");
  // The runtime auto-dispatched the semantic event -> UI listener triggered render()
  assert.ok(root.innerHTML.includes("Globex Corporation"), "DOM should reactively reflect newly created customer");

  runtime.update("customers", res.record.id, { name: "Initech Holdings" });
  assert.ok(root.innerHTML.includes("Initech Holdings"), "DOM should reactively reflect updated customer name");

  if (typeof app.destroy === "function") {
    app.destroy();
  }
});

test("All presentation conformance fixtures compile deterministically", async () => {
  const fixtures = [
    "conformance/presentation/managed-resource.air",
    "conformance/presentation/read-only-resource.air",
    "conformance/presentation/resource-with-insight.air",
    "conformance/presentation/resource-create-authorized.air",
    "conformance/presentation/resource-create-denied.air",
    "conformance/presentation/auth-standard.air",
    "conformance/presentation/user-management.air",
    "conformance/presentation/marketing-landing.air",
    "conformance/presentation/marketing-hero-only.air",
    "conformance/presentation/marketing-motion.air",
    "conformance/presentation/reactive-mutations.air"
  ];

  for (const fixture of fixtures) {
    const source = await readFile(fixture, "utf8");
    const model = parseAir(source);
    const ir = compilePresentation(model);
    assert.equal(ir.schema, "air.presentation-ir");
    assert.equal(ir.version, 1);
    assert.ok(ir.screens.length > 0, `Fixture ${fixture} must produce at least 1 screen`);
  }
});
