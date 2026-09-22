import { mountAirApp, renderFatalError } from "./runtime/ui.mjs";
import { OperationalError, OPERATIONAL_ERROR_CODES } from "./runtime/operations.mjs";

const demos = Object.freeze({
  customers: { label: "Northstar CRM", source: "../apps/customer-manager.air", seed: "../data/customer-manager.seed.json", principal: { roles: ["admin"] } },
  tasks: { label: "Lattice Tasks", source: "../apps/task-board.air", seed: "../data/task-board.seed.json", principal: { roles: ["admin"] } },
  expenses: { label: "Expense Approval", source: "../apps/expense-approval.air", seed: "../data/expense-approval.seed.json", principal: { actor: "users", id: "u_01", roles: ["employee"] } },
  experience_demo: { label: "Experience Hub", source: "../apps/experience-demo.air", seed: "../data/experience-demo.seed.json", principal: null },
  landing: { label: "AIR Platform (Landing)", source: "../apps/landing-demo.air", seed: "../data/landing-demo.seed.json", principal: null }
});

const parameters = new URLSearchParams(location.search);
const selected = Object.hasOwn(demos, parameters.get("demo")) ? parameters.get("demo") : "customers";
const root = document.querySelector("#app");

try {
  const [appResponse, seedResponse] = await Promise.all([
    fetch(demos[selected].source),
    fetch(demos[selected].seed)
  ]);
  if (!appResponse.ok) {
    throw new OperationalError(
      OPERATIONAL_ERROR_CODES.REPRESENTATION_NOT_FOUND,
      `Could not load application representation (${appResponse.status})`,
      { component: "application_representation", requestId: `req_${Date.now()}` }
    );
  }
  if (!seedResponse.ok) {
    throw new OperationalError(
      OPERATIONAL_ERROR_CODES.DATA_SOURCE_UNAVAILABLE,
      `Could not load seed data (${seedResponse.status})`,
      { component: "seed_storage", requestId: `req_${Date.now()}` }
    );
  }
  const [source, seedSource] = await Promise.all([appResponse.text(), seedResponse.text()]);
  const designIntent = {};
  if (parameters.has("character")) designIntent.character = parameters.get("character");
  if (parameters.has("archetype")) designIntent.archetype = parameters.get("archetype");
  if (parameters.has("rhythm")) designIntent.rhythm = parameters.get("rhythm");
  if (parameters.has("motion")) designIntent.motion = parameters.get("motion");

  mountAirApp(root, source, {
    demo: selected,
    demos,
    storage: window.localStorage,
    seedSource,
    principal: demos[selected].principal,
    designIntent: Object.keys(designIntent).length > 0 ? designIntent : undefined
  });
} catch (error) {
  renderFatalError(root, error);
}
