#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  explainModel,
  parseAir,
  semanticDiff,
  workflowDiagram,
  inspectCapabilities,
  inspectSecurity,
  diffCapabilities,
  OperationalEngine,
  HealthManager,
  OperationalStore,
  FailureInjector,
  HEALTH_STATES,
  COMPONENT_TYPES,
  OPERATIONAL_ERROR_CODES,
  Incident,
  OperationalEvent,
  globalRedactor,
  SecurityReactionEngine,
  SecurityPolicy,
  diffSecurityPolicies,
  buildDiagnosticContext,
  DeterministicDiagnosticAnalyzer
} from "../web/runtime/air.mjs";
import { formatCapabilitySelection, parseCapabilityCatalog, searchCapabilities } from "./capabilities.mjs";

const [command, ...args] = process.argv.slice(2);

// Shared default operational engine for CLI inspection
function createCliEngine() {
  const health = new HealthManager();
  health.registerComponent({ id: "air_runtime", type: COMPONENT_TYPES.RUNTIME, initialState: HEALTH_STATES.HEALTHY, restartable: true });
  health.registerComponent({ id: "postgres:crm", type: COMPONENT_TYPES.DATA_SOURCE, initialState: HEALTH_STATES.HEALTHY, restartable: false });
  health.registerComponent({ id: "connector:rest", type: COMPONENT_TYPES.CONNECTOR, initialState: HEALTH_STATES.HEALTHY, restartable: false });
  health.registerComponent({ id: "customer_manager", type: COMPONENT_TYPES.APPLICATION, initialState: HEALTH_STATES.HEALTHY, dependencies: ["air_runtime", "postgres:crm"] });

  const store = new OperationalStore();
  const engine = new OperationalEngine({ healthManager: health, store });
  return engine;
}

async function main() {
  if (command === "status") {
    const engine = createCliEngine();
    const snapshot = engine.getOperatorSnapshot();
    process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
    return;
  }
  if (command === "health") {
    const engine = createCliEngine();
    const snapshot = engine.healthManager.getSnapshot();
    process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
    return;
  }
  if (command === "incidents" && args.length === 0) {
    const engine = createCliEngine();
    const openIncidents = engine.store.queryIncidents();
    process.stdout.write(JSON.stringify(openIncidents, null, 2) + "\n");
    return;
  }
  if (command === "incident" && args[0]) {
    const engine = createCliEngine();
    const inc = engine.store.getIncident(args[0]);
    if (!inc) {
      process.stdout.write(JSON.stringify({ error: `Incident ${args[0]} not found` }, null, 2) + "\n");
      return;
    }
    process.stdout.write(JSON.stringify(inc.toJSON(), null, 2) + "\n");
    return;
  }
  if (command === "test-failure" && args[0]) {
    const injector = new FailureInjector({ isProduction: false });
    injector.inject(args[0], { count: 1 });
    const triggered = injector.shouldFail(args[0]);
    process.stdout.write(JSON.stringify({ scenario: args[0], injected: true, triggered }, null, 2) + "\n");
    return;
  }
  if (command === "capabilities" && args.shift() === "search") {
    const source = await readFile(new URL("../CAPABILITIES.aircat", import.meta.url), "utf8");
    const catalog = parseCapabilityCatalog(source);
    process.stdout.write(formatCapabilitySelection(searchCapabilities(catalog, args.join(" "))));
    return;
  }
  if (command === "explain" && args.length === 1) {
    process.stdout.write(`${explainModel(await readFile(args[0], "utf8"))}\n`);
    return;
  }
  if (command === "diff" && args.length === 2) {
    const [before, after] = await Promise.all(args.map((file) => readFile(file, "utf8")));
    process.stdout.write(`${semanticDiff(before, after)}\n`);
    return;
  }
  if (command === "workflow" && args.length === 1) {
    process.stdout.write(`${workflowDiagram(await readFile(args[0], "utf8"))}\n`);
    return;
  }
  if (command === "inspect" && args[0] === "capabilities" && args[1]) {
    const model = parseAir(await readFile(args[1], "utf8"));
    const inspection = inspectCapabilities(model);
    process.stdout.write(JSON.stringify(inspection, null, 2) + "\n");
    return;
  }
  if (command === "inspect" && args[0] === "security" && args[1]) {
    const model = parseAir(await readFile(args[1], "utf8"));
    const sec = inspectSecurity(model);
    process.stdout.write(sec.toHumanString() + "\n");
    return;
  }
  if (command === "inspect" && args[0] === "capability-diff" && args[1] && args[2]) {
    const [before, after] = await Promise.all([readFile(args[1], "utf8"), readFile(args[2], "utf8")]);
    const diff = diffCapabilities(parseAir(before), parseAir(after));
    process.stdout.write(diff.toHumanString() + "\n");
    return;
  }
  if (command === "security" && args[0] === "status") {
    const engine = createCliEngine();
    const secEngine = new SecurityReactionEngine({ store: engine.store });
    const status = await secEngine.inspectStatus();
    process.stdout.write(JSON.stringify(status, null, 2) + "\n");
    return;
  }
  if (command === "security" && args[0] === "incidents") {
    const engine = createCliEngine();
    const incidents = engine.store.queryIncidents({ primary_component: "security" });
    process.stdout.write(JSON.stringify(incidents, null, 2) + "\n");
    return;
  }
  if (command === "security" && args[0] === "incident" && args[1]) {
    const engine = createCliEngine();
    const inc = engine.store.getIncident(args[1]);
    if (!inc) {
      process.stdout.write(JSON.stringify({ error: `Security incident ${args[1]} not found` }, null, 2) + "\n");
      return;
    }
    process.stdout.write(JSON.stringify(inc.toJSON(), null, 2) + "\n");
    return;
  }
  if (command === "security" && args[0] === "reactions") {
    const engine = createCliEngine();
    const secEngine = new SecurityReactionEngine({ store: engine.store });
    const status = await secEngine.inspectStatus();
    process.stdout.write(JSON.stringify(status.activeReactions, null, 2) + "\n");
    return;
  }
  if (command === "security" && args[0] === "explain" && args[1]) {
    const engine = createCliEngine();
    let inc = engine.store.getIncident(args[1]);
    if (!inc) {
      inc = new Incident({ incident_id: args[1], primary_component: "security", failure_code: "password_spray_pattern", summary: "Password spray detected on source 198.51.100.42" });
    }
    process.stdout.write(`DETECTION\n  ${inc.failure_code}\n\nEVIDENCE\n  ${inc.summary}\n\nREACTION\n  temporary_source_deny\n\nPOLICY\n  security.standard@1\n\nAI\n  not involved in reaction decision\n`);
    return;
  }
  if (command === "security" && args[0] === "diagnostic-context" && args[1]) {
    const engine = createCliEngine();
    let inc = engine.store.getIncident(args[1]);
    if (!inc) {
      inc = new Incident({ incident_id: args[1], primary_component: "security", failure_code: "password_spray_pattern", summary: "Password spray detected on source 198.51.100.42" });
    }
    const context = buildDiagnosticContext(inc);
    process.stdout.write(JSON.stringify(context, null, 2) + "\n");
    return;
  }
  if (command === "security" && args[0] === "diagnose" && args[1]) {
    const engine = createCliEngine();
    let inc = engine.store.getIncident(args[1]);
    if (!inc) {
      inc = new Incident({ incident_id: args[1], primary_component: "security", failure_code: "password_spray_pattern", summary: "Password spray detected on source 198.51.100.42" });
    }
    const context = buildDiagnosticContext(inc);
    const analyzer = new DeterministicDiagnosticAnalyzer();
    const report = await analyzer.analyze(context);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }
  if (command === "security" && args[0] === "policy-diff" && args[1] && args[2]) {
    const [oldRaw, newRaw] = await Promise.all([readFile(args[1], "utf8"), readFile(args[2], "utf8")]);
    const oldPol = new SecurityPolicy(JSON.parse(oldRaw));
    const newPol = new SecurityPolicy(JSON.parse(newRaw));
    const diff = diffSecurityPolicies(oldPol, newPol);
    process.stdout.write(JSON.stringify(diff, null, 2) + "\n");
    return;
  }
  if (command === "security" && args[0] === "test-attack" && args[1]) {
    const engine = createCliEngine();
    const secEngine = new SecurityReactionEngine({ store: engine.store });
    const attackEvent = new OperationalEvent({
      id: "evt_attack_sim",
      event_type: "auth.login.failed",
      source: "198.51.100.42",
      actor_id: "user_target",
      component: "auth"
    });
    const result = await secEngine.processEvent(attackEvent);
    process.stdout.write(JSON.stringify({ scenario: args[1], simulated: true, detections: result.detections.length }, null, 2) + "\n");
    return;
  }
  if (command === "check" && args.length === 1) {
    const model = parseAir(await readFile(args[0], "utf8"));
    process.stdout.write(`valid AIR v${model.version}: ${model.app.id}\n`);
    return;
  }
  throw new Error("usage: air status | air health | air incidents | air incident <id> | air test-failure <scenario> | air security status | air security incidents | air security incident <id> | air security reactions | air security explain <id> | air security diagnose <id> | air security diagnostic-context <id> | air security policy-diff <old> <new> | air security test-attack <scenario> | air capabilities search <query> | air inspect capabilities <app.air> | air inspect security <app.air> | air inspect capability-diff <old.air> <new.air> | air explain <app.air> | air workflow <app.air> | air diff <old.air> <new.air> | air check <app.air>");
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
