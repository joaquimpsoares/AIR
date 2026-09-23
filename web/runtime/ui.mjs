import { AirError, AppRuntime, parseAir, parseSeedData } from "./air.mjs";
import { compilePresentation } from "./presentation.mjs";
import { compileVisualDesign, VISUAL_DESIGN_IR_VERSION, ARCHETYPES, CHARACTERS, COMPOSITIONS, SHELL_TYPES } from "./visual_design.mjs";
import {
  COLLECTION_REPRESENTATION,
  FORM_REPRESENTATION,
  NAVIGATION_REPRESENTATION,
  HERO_REPRESENTATION,
  WORKFLOW_REPRESENTATION,
  SHELL_REPRESENTATION,
  FEATURE_STORY_REPRESENTATION,
  DASHBOARD_REPRESENTATION,
  PROOF_REPRESENTATION,
  PRICING_REPRESENTATION,
  PRODUCT_STORY_REPRESENTATION,
  DRAWER_REPRESENTATION,
  DRAWER_SIZE,
  DRAWER_STACK_POLICY,
  MENU_REPRESENTATION,
  SECTION_RHYTHM,
  SECTION_RELATIONSHIP,
  SECTION_RHYTHM_VALUES,
  SCHEDULE_REPRESENTATION,
  SCHEDULE_VIEW_MODE,
  resolveCollectionArtifactLayout,
  resolveFormArtifactLayout,
  resolveNavigationArtifactLayout,
  resolveHeroArtifactLayout,
  resolveWorkflowArtifactLayout,
  resolveShellArtifactLayout,
  resolveFeatureStorySectionLayout,
  resolveSocialProofSectionLayout,
  resolvePricingSectionLayout,
  resolveDashboardSectionLayout,
  resolveProductStorySectionLayout,
  resolveDataStorySectionLayout,
  resolveDataVisualizationLayout,
  resolveSemanticGraphLayout,
  resolveDrawerArtifactLayout,
  resolveMenuArtifactLayout,
  resolveScheduleArtifactLayout
} from "./ui_hierarchy.mjs";
import {
  VISUAL_INTENTS,
  DATA_VISUALIZATION_REPRESENTATIONS,
  SEMANTIC_GRAPH_MODES,
  SEMANTIC_GRAPH_REPRESENTATIONS,
  compileVisualizationIR,
  compileWorkflowGraph,
  compileTimelineGraph,
  compileDagGraph,
  compileScheduleVisualizationIR,
  compileScheduleIR,
  getZonedDateParts,
  addDaysToDateString,
  formatDisplayDate
} from "./visualization_ir.mjs";
import {
  renderDataVisualization,
  renderSemanticGraph
} from "./visualization_web.mjs";
import { DemoAuthAdapter } from "./auth.mjs";

const ICONS = Object.freeze({
  dashboard: '<path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m-2-12a4 4 0 0 1 0 7.75"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2V6Z"/>',
  check: '<path d="m9 11 3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  collection: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  sort: '<path d="m8 9 4-4 4 4M16 15l-4 4-4-4"/>',
  spark: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3ZM5 15l.9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15Z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
  warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/>'
});

function icon(name, size = 18) {
  const body = ICONS[name] ?? ICONS.collection;
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function displayStatus(value) {
  return String(value).replaceAll("_", " ");
}

function titleCase(value) {
  return displayStatus(value).replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusTone(value) {
  const normalized = String(value).toLowerCase();
  if (/active|done|complete|paid|positive/.test(normalized)) return "positive";
  if (/trial|review|progress|planning|medium|warning/.test(normalized)) return "warning";
  if (/urgent|inactive|rejected|danger|cancelled/.test(normalized)) return "danger";
  if (/high|violet/.test(normalized)) return "violet";
  return "neutral";
}

function initials(value) {
  return String(value).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function isInteractiveRowTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(target.closest("button, a, select, input, textarea, [role='button'], [data-row-action-menu], [role='menuitem'], [data-menu-action], [data-dismiss-menu], [data-drawer-overflow-menu]"));
}

export function resolveThemeMode(mode) {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof matchMedia !== "undefined") {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function themePreference(theme, options = {}) {
  if (options.userThemeOverride === "light" || options.userThemeOverride === "dark") {
    return options.userThemeOverride;
  }
  if (theme?.mode && theme.mode !== "system") return theme.mode;
  if (typeof matchMedia !== "undefined") {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function classifyAirError(error) {
  if (!error) return "UNKNOWN_ERROR";
  if (error.phase === "parse" || error.name === "AirParseError") return "COMPILE_ERROR";
  if (error.phase === "validate" || error.phase === "resolve") return "CONFIG_ERROR";
  if (error.phase === "data" || (typeof error.message === "string" && error.message.includes("seed"))) return "DATA_ERROR";
  if (error.code === "AIR_AUTH_FORBIDDEN" || error.code === "AIR_AUTH_UNAUTHORIZED") return "ACCESS_DENIED";
  return "RUNTIME_ERROR";
}

export function renderFatalError(root, error, options = {}) {
  if (!root) return;
  root.removeAttribute("aria-busy");
  const classification = classifyAirError(error);
  const reference = error?.requestId || error?.incidentId || `ref_${Date.now().toString(36)}`;
  
  // Structured internal developer diagnostics
  console.error(`[AIR ${classification}] Startup Exception:`, {
    error,
    classification,
    code: error?.code ?? null,
    phase: error?.phase ?? null,
    message: error?.message ?? String(error),
    reference,
    stack: error?.stack ?? null
  });

  let userError = null;
  if (error && typeof error.toUserError === "function") {
    userError = error.toUserError();
  } else if (error && error.name === "OperationalError") {
    userError = {
      title: error.safeUserTitle || "Application Unavailable",
      message: error.safeUserMessage || "The application encountered an operational error.",
      reference
    };
  } else {
    const rawMsg = error?.message ?? String(error);
    const is404 = rawMsg.includes("404") || rawMsg.includes("not found");
    userError = {
      title: is404 ? "Application Unavailable" : "Application Error",
      message: is404 ? "The application definition could not be loaded." : "This application could not start.",
      reference
    };
  }

  root.innerHTML = `<main class="fatal"><div class="fatal-mark">!</div><p class="eyebrow">AIR Service State</p><h1>${escapeHtml(userError.title)}</h1><p>${escapeHtml(userError.message)}</p><p class="meta" style="font-size: 0.85em; opacity: 0.75;">Reference: <code>${escapeHtml(userError.reference)}</code></p><button class="button secondary" data-retry-button>Try again</button></main>`;
  
  const retryBtn = root.querySelector("[data-retry-button]");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      if (typeof options.onRetry === "function") {
        options.onRetry();
      } else if (typeof location !== "undefined") {
        location.reload();
      }
    });
  }
}

/**
 * Pure Visual Design IR Web Renderer Entry Point.
 * Renders HTML/DOM directly from Presentation IR v1 -> Visual Design IR v1 and the runtime.
 * Contains ZERO resource/domain-specific branches.
 */
export function renderPresentation(root, initialPresentationIr, runtime, options = {}) {
  let presentationIr = initialPresentationIr;
  const isEmbedded = options.mode === "embedded" || (root && root.id === "live-app-root") || (root && typeof root.classList?.contains === "function" && root.classList.contains("live-app-wrapper"));
  const hostMode = isEmbedded ? "embedded" : (options.mode ?? "standalone");
  if (isEmbedded && root && typeof root.classList?.add === "function") {
    root.classList.add("app-host-embedded");
  }

  const authAdapter = options.authAdapter ?? new DemoAuthAdapter();

  let visualDesignIr = compileVisualDesign(
    presentationIr,
    options.designIntent ?? options.model?.design ?? {},
    {
      prefersReducedMotion: typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
      viewport: (root?.clientWidth ? root.clientWidth : (typeof window !== "undefined" ? window.innerWidth : 1024)) < 768 ? "mobile" : "desktop"
    }
  );

  const initialWidth = options.containerWidth ?? (root?.clientWidth ? root.clientWidth : (typeof window !== "undefined" ? window.innerWidth : 1024));

  const state = {
    screenId: options.initialScreen ?? presentationIr.app.initialScreen,
    containerWidth: initialWidth,
    detail: null,
    modal: null,
    drawer: null,
    openMenu: null,
    confirm: null,
    theme: themePreference(presentationIr.theme),
    queries: new Map(),
    toastTimer: null,
    compilerStep: 1,
    mobileMenuOpen: false,
    authState: { status: "idle", message: "", email: "", demoToken: "" },
    scheduleState: {
      currentDate: options.currentDate ?? new Date().toISOString().slice(0, 10),
      viewMode: options.scheduleViewMode ?? "day",
      timezone: options.timezone ?? presentationIr.app?.timezone ?? "UTC",
      selectedGroup: "",
      selectedStatus: "",
      hideCancelled: false,
      linearView: false
    },
    screenViewMode: new Map(),
    notificationCenterOpen: false
  };

  const currentScreen = () => presentationIr.screens.find((s) => s.id === state.screenId) ?? presentationIr.screens[0];

  const queryState = (screen) => {
    if (!state.queries.has(screen.id)) {
      state.queries.set(screen.id, {
        search: "",
        filters: Object.fromEntries((screen.collection?.filterableFields ?? []).map((field) => [field, ""])),
        sort: screen.collection?.sortChoices?.[0] ?? "",
        page: 1
      });
    }
    return state.queries.get(screen.id);
  };

  function applyTheme() {
    const target = (isEmbedded && root) ? root : (typeof document !== "undefined" ? document.documentElement : null);
    if (!target) return;
    if (target.dataset) {
      target.dataset.theme = state.theme;
      target.dataset.accent = presentationIr.theme.accent;
      target.dataset.density = visualDesignIr.theme.density;
      target.dataset.character = visualDesignIr.character;
      target.dataset.archetype = visualDesignIr.archetype;
    }
    if (target.style) {
      target.style.colorScheme = state.theme;
    }
    if (isEmbedded && root && typeof root.setAttribute === "function") {
      root.setAttribute("data-air-theme-host", "true");
    }
  }

  function recompileIr() {
    if (options.model) {
      presentationIr = compilePresentation(options.model, { principal: runtime?.principal, runtime });
      visualDesignIr = compileVisualDesign(
        presentationIr,
        options.designIntent ?? options.model?.design ?? {},
        {
          prefersReducedMotion: typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
          viewport: state.containerWidth < 768 ? "mobile" : "desktop"
        }
      );
    }
  }

  function navigate(screenId) {
    state.screenId = screenId;
    state.detail = null;
    state.modal = null;
    state.drawer = null;
    state.openMenu = null;
    state.confirm = null;
    if (!isEmbedded && typeof history !== "undefined" && typeof location !== "undefined") {
      history.replaceState(null, "", `${location.pathname}?demo=${encodeURIComponent(options.demo ?? "demo")}#${screenId}`);
    }
    render();
    if (root) {
      root.querySelector(".content")?.focus({ preventScroll: true });
    }
  }

  function notify(message, tone = "success") {
    if (!root) return;
    const host = root.querySelector?.("#air-toast") || (typeof document !== "undefined" ? document.querySelector("#air-toast") : null);
    if (!host) return;
    host.className = `toast ${tone} visible`;
    host.innerHTML = `<span class="toast-dot"></span>${escapeHtml(message)}`;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => host.classList.remove("visible"), 3200);
  }

  function renderNav() {
    return presentationIr.navigation.items.filter((item) => item.visible).map((item) => `
      <button class="nav-item ${item.screenId === state.screenId ? "active" : ""}" data-nav="${escapeHtml(item.screenId)}" aria-current="${item.screenId === state.screenId ? "page" : "false"}">
        ${icon(item.icon)}<span>${escapeHtml(item.title)}</span>
      </button>`).join("");
  }

  function renderDemoPicker() {
    if (!options.demos) return "";
    const choices = Object.entries(options.demos).map(([id, demo]) => `<option value="${escapeHtml(id)}" ${id === options.demo ? "selected" : ""}>${escapeHtml(demo.label)}</option>`).join("");
    return `<label class="demo-picker"><span>Runtime demo</span><select id="demo-picker">${choices}</select></label>`;
  }

  function renderUserSwitcher() {
    if (!authAdapter?.demoMode) return "";
    const users = authAdapter.users ?? [];
    const currentId = runtime?.principal?.id;
    const choices = users.map((u) => `<option value="${escapeHtml(u.id)}" ${u.id === currentId ? "selected" : ""}>${escapeHtml(u.name)} (${escapeHtml(u.roles.join(","))})</option>`).join("");
    return `<label class="demo-user-picker"><span>[DEMO ONLY] Switch User</span><select id="user-switch-select">${choices}</select></label>`;
  }

  function valueMarkup(screen, fieldId, value, compact = false) {
    const field = screen?.editor?.fields?.find((f) => f.id === fieldId);
    const display = (runtime && screen?.resource) ? runtime.displayValue(screen.resource, fieldId, value) : String(value ?? "");
    if (field?.type === "enum") return `<span class="badge ${statusTone(value)}"><span></span>${escapeHtml(displayStatus(display))}</span>`;
    if (field?.id === screen?.labelField && !compact) {
      return `<span class="identity"><span class="avatar">${escapeHtml(initials(display))}</span><strong>${escapeHtml(display)}</strong></span>`;
    }
    return `<span>${escapeHtml(display)}</span>`;
  }

  function renderTable(screen, columns, records, interactive = true) {
    if (!records || records.length === 0) return "";
    const head = columns.map((fieldId) => {
      const field = screen?.editor?.fields?.find((f) => f.id === fieldId);
      return `<th scope="col">${escapeHtml(field?.label ?? titleCase(fieldId))}</th>`;
    }).join("");
    const rows = records.map((record) => {
      const tone = (runtime && screen?.resource) ? runtime.highlight(screen.resource, record) : null;
      const isMenuOpen = state.openMenu?.id === `row-menu-${screen?.resource}-${record.id}`;
      return `
      <tr class="${tone ? `highlight-${escapeHtml(tone)}` : ""}" ${interactive && screen?.resource ? `tabindex="0" data-detail="${escapeHtml(screen.resource)}:${escapeHtml(record.id)}"` : ""}>
        ${columns.map((fieldId) => `<td data-field="${escapeHtml(fieldId)}">${valueMarkup(screen, fieldId, record[fieldId])}</td>`).join("")}
        ${interactive && screen?.resource ? `
          <td class="row-actions" style="text-align: right; width: 44px;">
            <button type="button" class="action-menu-button" data-row-action-menu="${escapeHtml(screen.resource)}:${escapeHtml(record.id)}" aria-label="Actions for ${escapeHtml(record[screen.labelField] ?? record.id)}" aria-haspopup="menu" aria-expanded="${isMenuOpen}">
              ${icon("menu", 16)}
            </button>
          </td>` : (interactive ? `<td class="row-arrow" aria-label="View record">${icon("chevron", 16)}</td>` : "")}
      </tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="semantic-table"><thead><tr>${head}${interactive ? '<th class="row-actions" scope="col" style="text-align: right; width: 44px;"><span class="sr-only">Actions</span></th>' : ""}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderRecordList(screen, fields, records, interactive = true) {
    if (!records || records.length === 0) return "";
    const primaryFieldId = fields.find((f) => f.priority === "primary")?.id ?? screen?.labelField ?? fields[0]?.id;
    const secondaryFields = fields.filter((f) => f.id !== primaryFieldId);

    const cards = records.map((record) => {
      const tone = (runtime && screen?.resource) ? runtime.highlight(screen.resource, record) : null;
      const primaryValue = record[primaryFieldId];
      const isMenuOpen = state.openMenu?.id === `row-menu-${screen?.resource}-${record.id}`;
      
      const rows = secondaryFields.map((field) => {
        const value = record[field.id];
        return `
        <div class="card-field-row" data-field="${escapeHtml(field.id)}">
          <span class="card-field-label">${escapeHtml(field.label ?? titleCase(field.id))}</span>
          <span class="card-field-value">${valueMarkup(screen, field.id, value, true)}</span>
        </div>`;
      }).join("");

      return `
      <article class="record-card ${tone ? `highlight-${escapeHtml(tone)}` : ""}" ${interactive && screen?.resource ? `tabindex="0" data-detail="${escapeHtml(screen.resource)}:${escapeHtml(record.id)}"` : ""}>
        <div class="record-card-header">
          <div class="record-card-primary">
            <span class="card-field-value primary-value">${valueMarkup(screen, primaryFieldId, primaryValue)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            ${interactive && screen?.resource ? `
              <button type="button" class="action-menu-button" data-row-action-menu="${escapeHtml(screen.resource)}:${escapeHtml(record.id)}" aria-label="Actions for ${escapeHtml(record[screen.labelField] ?? record.id)}" aria-haspopup="menu" aria-expanded="${isMenuOpen}">
                ${icon("menu", 16)}
              </button>` : ""}
            ${interactive ? `<span class="card-arrow" aria-hidden="true">${icon("chevron", 16)}</span>` : ""}
          </div>
        </div>
        <div class="record-card-body">
          ${rows}
        </div>
      </article>`;
    }).join("");

    return `<div class="record-list" role="feed" aria-label="${escapeHtml(screen.title)} record list">${cards}</div>`;
  }

  function renderDashboard(screen) {
    const dashboardDecision = resolveDashboardSectionLayout(state.containerWidth);
    const metricsSection = screen.sections?.find((s) => s.type === "metrics_grid");
    const recentSection = screen.sections?.find((s) => s.type === "recent_activity");
    const vizSection = screen.sections?.find((s) => s.type === "data_story" || s.type === "visual_insights" || s.type === "charts");

    const metrics = (metricsSection?.metrics ?? []).map((metric) => `
      <article class="metric-card tone-${escapeHtml(metric.tone)}">
        <div class="metric-icon">${icon("dashboard")}</div>
        <p>${escapeHtml(metric.label)}</p>
        <strong>${escapeHtml(runtime ? runtime.formatMetric(metric, runtime.metric(metric)) : "0")}</strong>
        <span>Live from ${escapeHtml(metric.source)}</span>
      </article>`).join("");

    let visualChartsMarkup = "";
    if (vizSection?.charts && vizSection.charts.length > 0) {
      const charts = vizSection.charts.map((chartSpec) => {
        const records = runtime ? runtime.records(chartSpec.source || chartSpec.resource) : [];
        const vizIr = compileVisualizationIR({
          ...chartSpec,
          containerWidth: state.containerWidth
        }, records, { containerWidth: state.containerWidth });
        return renderDataVisualization(vizIr);
      }).join("");
      visualChartsMarkup = `<section class="visualization-grid" data-section-role="data_story" data-section-relationship="independent">${charts}</section>`;
    } else if (runtime && metricsSection?.metrics?.length > 0) {
      const firstMetric = metricsSection.metrics.find((m) => m.source && runtime.entities?.has(m.source));
      if (firstMetric && runtime.records(firstMetric.source).length >= 2) {
        const records = runtime.records(firstMetric.source);
        const targetScreen = presentationIr.screens.find((s) => s.resource === firstMetric.source);
        const statusField = targetScreen?.editor?.fields?.find((f) => f.type === "enum" || f.id === "status" || f.id === "category" || f.id === "state");
        const dateField = targetScreen?.editor?.fields?.find((f) => f.type === "date" || f.id === "joined" || f.id === "created" || f.id === "date");

        const generatedCharts = [];
        if (statusField) {
          const vizIr = compileVisualizationIR({
            id: `viz_${firstMetric.source}_status`,
            title: `${targetScreen?.title || firstMetric.source} by ${statusField.label || statusField.id}`,
            intent: VISUAL_INTENTS.COMPARE,
            measure: firstMetric.field || "id",
            aggregate: firstMetric.aggregation === "sum" ? "sum" : "count",
            dimension: statusField.id,
            format: firstMetric.format === "currency" ? "currency" : "number",
            containerWidth: state.containerWidth
          }, records, { containerWidth: state.containerWidth });
          generatedCharts.push(renderDataVisualization(vizIr));
        }

        if (dateField && records.some((r) => r[dateField.id])) {
          const vizIr = compileVisualizationIR({
            id: `viz_${firstMetric.source}_trend`,
            title: `${targetScreen?.title || firstMetric.source} Trend over Time`,
            intent: VISUAL_INTENTS.TREND,
            measure: firstMetric.field || "id",
            aggregate: firstMetric.aggregation === "sum" ? "sum" : "count",
            dimension: dateField.id,
            format: firstMetric.format === "currency" ? "currency" : "number",
            containerWidth: state.containerWidth
          }, records, { containerWidth: state.containerWidth });
          generatedCharts.push(renderDataVisualization(vizIr));
        }

        if (generatedCharts.length > 0) {
          visualChartsMarkup = `<section class="visualization-grid" data-section-role="data_story" data-section-relationship="independent">${generatedCharts.join("")}</section>`;
        }
      }
    }

    const lists = (recentSection?.lists ?? []).map((list) => {
      const targetScreen = presentationIr.screens.find((s) => s.resource === list.source);
      const result = runtime ? runtime.query(list.source, { sort: targetScreen?.collection?.sortChoices?.[0], limit: list.limit, paginate: false }) : { records: [] };
      const listContent = result.records.length
        ? (state.containerWidth < 640 ? renderRecordList(targetScreen, result.records) : renderTable(targetScreen, list.columns, result.records))
        : `<div class="empty-state"><div>${icon("collection", 26)}</div><h3>No records yet</h3></div>`;

      return `<section class="panel recent-panel" data-section-role="collection" data-section-relationship="independent" data-section-representation="${escapeHtml(dashboardDecision.representation)}">
        <div class="panel-heading"><div><p class="eyebrow">Latest activity</p><h2>${escapeHtml(list.title)}</h2></div><button class="text-button" data-nav="${escapeHtml(targetScreen?.id ?? state.screenId)}">View all ${icon("chevron", 14)}</button></div>
        ${listContent}
      </section>`;
    }).join("");

    const metricGridClass = dashboardDecision.representation === DASHBOARD_REPRESENTATION.DASHBOARD_STACK ? "single-column" : dashboardDecision.representation === DASHBOARD_REPRESENTATION.DASHBOARD_CONDENSED ? "two-column" : "";

    return `<div class="section-stack" data-section-rhythm="comfortable">
      <div class="page-heading"><div><p class="eyebrow">Workspace</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div><span class="date-chip">${new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</span></div>
      <section class="metric-grid ${metricGridClass}" data-section-role="metrics" data-section-relationship="independent" data-section-representation="${escapeHtml(dashboardDecision.representation)}" aria-label="Key metrics">${metrics}</section>
      ${visualChartsMarkup}
      ${lists}
    </div>`;
  }

  function filterOptions(screen, fieldId) {
    const field = screen.editor?.fields?.find((f) => f.id === fieldId);
    if (!field) return [];
    if (field.type === "enum") return field.options.map((value) => [value, displayStatus(value)]);
    if (field.type === "ref" && runtime) {
      const targetScreen = presentationIr.screens.find((s) => s.resource === field.ref);
      return runtime.query(field.ref, { paginate: false }).records.map((record) => [record.id, record[targetScreen?.labelField ?? "id"]]);
    }
    if (runtime) {
      return [...new Set(runtime.records(screen.resource).map((record) => record[field.id]).filter(Boolean))].sort().map((value) => [value, value]);
    }
    return [];
  }

  function renderCollection(screen) {
    const query = queryState(screen);
    const result = runtime ? runtime.query(screen.resource, {
      search: query.search,
      searchFields: screen.collection.searchableFields,
      filters: query.filters,
      sort: query.sort,
      page: query.page,
      pageSize: screen.collection.pageSize
    }) : { records: [], total: 0, page: 1, totalPages: 1, pageSize: 8 };

    query.page = result.page;
    const filters = (screen.collection.filterableFields ?? []).map((fieldId) => {
      const field = screen.editor.fields.find((f) => f.id === fieldId);
      const options = filterOptions(screen, fieldId).map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(query.filters[fieldId]) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
      return `<label class="select-control"><span class="sr-only">Filter by ${escapeHtml(field?.label ?? fieldId)}</span><select data-filter="${escapeHtml(fieldId)}"><option value="">All ${escapeHtml((field?.label ?? fieldId).toLowerCase())}</option>${options}</select></label>`;
    }).join("");

    const sortOptions = (screen.collection.sortChoices ?? []).map((sortId) => {
      const fieldId = sortId.startsWith("-") ? sortId.slice(1) : sortId;
      const field = screen.editor.fields.find((f) => f.id === fieldId);
      return `<option value="${escapeHtml(sortId)}" ${query.sort === sortId ? "selected" : ""}>${escapeHtml(field?.label ?? fieldId)}${sortId.startsWith("-") ? " ↓" : " ↑"}</option>`;
    }).join("");

    const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
    const to = Math.min(result.page * result.pageSize, result.total);
    const createAction = screen.actions?.find((a) => a.intent === "create" && a.available);
    const createButton = createAction
      ? `<button class="button primary" data-create="${escapeHtml(screen.resource)}">${icon("plus", 17)} ${escapeHtml(createAction.label)}</button>`
      : "";

    const hasActiveFilters = Boolean(query.search || Object.values(query.filters).some(Boolean));
    const emptyStateInfo = hasActiveFilters ? screen.states.filteredEmpty : screen.states.empty;

    const fieldsForLayout = (screen.editor?.fields ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      priority: f.id === screen.labelField ? "primary" : f.type === "enum" || f.id === "status" ? "primary" : "secondary"
    }));

    const layoutDecision = resolveCollectionArtifactLayout(state.containerWidth, fieldsForLayout);
    let collectionContent = "";

    if (result.records.length === 0) {
      collectionContent = `<div class="empty-state"><div>${icon(hasActiveFilters ? "search" : screen.icon, 26)}</div><h3>${escapeHtml(emptyStateInfo.title)}</h3><p>${escapeHtml(emptyStateInfo.message)}</p></div>`;
    } else if (layoutDecision.representation === COLLECTION_REPRESENTATION.RECORD_LIST || layoutDecision.mode === "card_list") {
      collectionContent = renderRecordList(screen, fieldsForLayout, result.records);
    } else if (layoutDecision.representation === COLLECTION_REPRESENTATION.CONDENSED_TABLE) {
      collectionContent = renderTable(screen, layoutDecision.visibleColumns ?? screen.collection.columns, result.records);
    } else {
      collectionContent = renderTable(screen, screen.collection.columns, result.records);
    }

    const viewToggle = screen.schedule
      ? `<div class="screen-view-toggle"><button type="button" class="view-toggle-btn active" data-screen-view="collection">Table</button><button type="button" class="view-toggle-btn" data-screen-view="schedule">Schedule</button></div>`
      : "";

    return `<div class="section-stack" data-section-rhythm="comfortable">
      <div class="page-heading collection-heading">
        <div><p class="eyebrow">${escapeHtml(screen.title)}</p><h1>${escapeHtml(screen.title)}</h1><p>Manage ${escapeHtml(screen.title.toLowerCase())}</p></div>
        <div style="display: flex; align-items: center; gap: 8px;">${viewToggle}${createButton}</div>
      </div>
      <section class="panel collection-panel" data-section-role="collection" data-section-relationship="independent" data-collection-representation="${escapeHtml(layoutDecision.representation || layoutDecision.mode)}">
        <div class="toolbar">
          <label class="search-control">${icon("search", 17)}<span class="sr-only">Search ${escapeHtml(screen.title)}</span><input type="search" data-search placeholder="Search ${escapeHtml(screen.title.toLowerCase())}…" value="${escapeHtml(query.search)}"></label>
          <div class="toolbar-actions">${filters}<label class="select-control sort-control">${icon("sort", 15)}<span class="sr-only">Sort</span><select data-sort>${sortOptions}</select></label></div>
        </div>
        <div class="result-meta"><span><strong>${result.total}</strong> ${result.total === 1 ? screen.singular.toLowerCase() : screen.title.toLowerCase()}</span>${hasActiveFilters ? '<button class="text-button" data-clear-filters>Clear filters</button>' : ""}</div>
        ${collectionContent}
        <div class="pagination"><span>${from}–${to} of ${result.total}</span><div><button class="icon-button" data-page="${result.page - 1}" ${result.page <= 1 ? "disabled" : ""} aria-label="Previous page">${icon("back", 16)}</button><span>Page ${result.page} of ${result.totalPages}</span><button class="icon-button next" data-page="${result.page + 1}" ${result.page >= result.totalPages ? "disabled" : ""} aria-label="Next page">${icon("chevron", 16)}</button></div></div>
      </section>
    </div>`;
  }

  function renderSchedule(screen) {
    const scheduleSpec = {
      ...(screen.schedule ?? { resource: screen.resource }),
      currentDate: state.scheduleState.currentDate,
      viewMode: state.scheduleState.viewMode,
      timezone: state.scheduleState.timezone || screen.schedule?.timezone || "UTC",
      containerWidth: state.containerWidth,
      filter: {
        ...(state.scheduleState.selectedGroup ? { [screen.schedule?.groupField ?? "resource"]: state.scheduleState.selectedGroup } : {}),
        ...(state.scheduleState.selectedStatus ? { [screen.schedule?.statusField ?? "status"]: state.scheduleState.selectedStatus } : {})
      },
      hideCancelled: state.scheduleState.hideCancelled,
      clock: options.clock ?? options.now
    };

    const scheduleIr = compileScheduleVisualizationIR(scheduleSpec, [], { runtime, now: options.clock ?? options.now, containerWidth: state.containerWidth });
    const isAgenda = scheduleIr.representation === SCHEDULE_REPRESENTATION.AGENDA_LIST;

    // Group filter options
    const allGroups = scheduleIr.groups;
    const groupFilterOptions = allGroups.map((g) => `<option value="${escapeHtml(g.id)}" ${state.scheduleState.selectedGroup === g.id ? "selected" : ""}>${escapeHtml(g.label)}</option>`).join("");

    // Date Navigation Header
    const dateToolbar = `
      <div class="schedule-toolbar">
        <div class="schedule-nav-group">
          <button type="button" class="button secondary compact" data-schedule-nav="today">Today</button>
          <div class="icon-button-group">
            <button type="button" class="icon-button" data-schedule-nav="prev" aria-label="Previous date">${icon("back", 16)}</button>
            <button type="button" class="icon-button next" data-schedule-nav="next" aria-label="Next date">${icon("chevron", 16)}</button>
          </div>
          <h2 class="schedule-date-title" aria-live="polite">${escapeHtml(scheduleIr.navigation.rangeLabel)}</h2>
        </div>
        <div class="schedule-actions-group">
          <label class="select-control group-select">
            <span class="sr-only">Filter by Resource</span>
            <select data-schedule-filter-group>
              <option value="">All ${escapeHtml((screen.schedule?.groupResource ?? "resources").toLowerCase())}</option>
              ${groupFilterOptions}
            </select>
          </label>
          <div class="view-mode-toggle" role="group" aria-label="View mode">
            <button type="button" class="view-toggle-btn ${scheduleIr.viewMode === "day" ? "active" : ""}" data-schedule-view="day">Day</button>
            <button type="button" class="view-toggle-btn ${scheduleIr.viewMode === "week" ? "active" : ""}" data-schedule-view="week">Week</button>
          </div>
          <button type="button" class="button secondary compact" data-schedule-linear-toggle aria-label="Toggle accessible schedule list">
            ${icon("collection", 14)} List
          </button>
          <button type="button" class="button primary compact" data-create="${escapeHtml(screen.resource)}">
            ${icon("plus", 14)} Add
          </button>
        </div>
      </div>
    `;

    // Linearized accessible data table toggle (PART 28 & PART 30)
    let linearTableMarkup = "";
    if (state.scheduleState.linearView) {
      linearTableMarkup = `
        <div class="schedule-accessible-table" role="region" aria-label="Linear Schedule Table">
          <table class="table-view">
            <thead>
              <tr>
                <th>Time</th>
                <th>Resource</th>
                <th>Title</th>
                <th>Status</th>
                <th>Quote / Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${scheduleIr.accessibleTableRows.map((row) => `
                <tr>
                  <td><code>${escapeHtml(row.timeRange)}</code></td>
                  <td><strong>${escapeHtml(row.group)}</strong></td>
                  <td>${escapeHtml(row.title)}</td>
                  <td><span class="badge ${statusTone(row.status)}">${escapeHtml(displayStatus(row.status))}</span></td>
                  <td>${escapeHtml(row.quote)}</td>
                  <td><button class="button secondary compact" data-detail="${escapeHtml(screen.resource)}:${escapeHtml(row.id)}">View</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    let scheduleBody = "";

    if (state.scheduleState.linearView) {
      scheduleBody = linearTableMarkup;
    } else if (scheduleIr.isEmpty) {
      scheduleBody = `
        <div class="empty-state">
          <div>${icon("calendar", 26)}</div>
          <h3>${escapeHtml(scheduleIr.emptyState.title)}</h3>
          <p>${escapeHtml(scheduleIr.emptyState.message)}</p>
          <button class="button primary" data-create="${escapeHtml(screen.resource)}">${icon("plus", 16)} Add</button>
        </div>
      `;
    } else if (isAgenda) {
      // -------------------------------------------------------------
      // AGENDA LIST REPRESENTATION (< 640px Mobile)
      // -------------------------------------------------------------
      const itemsByDate = new Map();
      for (const item of scheduleIr.allIntervals) {
        if (!itemsByDate.has(item.dateString)) itemsByDate.set(item.dateString, []);
        itemsByDate.get(item.dateString).push(item);
      }

      const agendaSections = Array.from(itemsByDate.entries()).map(([dateStr, dayItems]) => {
        const dateHeader = formatDisplayDate(dateStr, scheduleIr.timezone, "day");
        const cards = dayItems.map((item) => {
          if (item.isBlackout) {
            return `
              <div class="schedule-agenda-card blackout" role="article" aria-label="${escapeHtml(item.title)} blackout">
                <div class="agenda-card-time"><span class="badge danger">${escapeHtml(item.timeRangeLabel)}</span></div>
                <div class="agenda-card-main">
                  <span class="agenda-group-chip">${escapeHtml(item.groupLabel)}</span>
                  <strong class="agenda-card-title">${escapeHtml(item.title)}</strong>
                  <span class="agenda-status-pill blocked">Unavailable</span>
                </div>
              </div>
            `;
          }

          return `
            <div class="schedule-agenda-card" role="button" tabindex="0" data-detail="${escapeHtml(item.entityId)}:${escapeHtml(item.recordId)}" aria-label="${escapeHtml(item.title)} on ${escapeHtml(item.groupLabel)}">
              <div class="agenda-card-time"><span class="badge neutral">${escapeHtml(item.timeRangeLabel)}</span></div>
              <div class="agenda-card-main">
                <span class="agenda-group-chip">${escapeHtml(item.groupLabel)}</span>
                <strong class="agenda-card-title">${escapeHtml(item.title)}</strong>
                <div class="agenda-card-footer">
                  <span class="badge ${statusTone(item.status)}">${escapeHtml(displayStatus(item.status))}</span>
                  ${item.quote ? `<span class="agenda-quote">${escapeHtml(item.quote)}</span>` : ""}
                </div>
              </div>
            </div>
          `;
        }).join("");

        return `
          <div class="agenda-day-group">
            <h3 class="agenda-day-heading">${escapeHtml(dateHeader)}</h3>
            <div class="agenda-cards-list">${cards}</div>
          </div>
        `;
      }).join("");

      scheduleBody = `<div class="schedule-agenda-container" role="feed" aria-label="Chronological Schedule Agenda">${agendaSections}</div>`;
    } else {
      // -------------------------------------------------------------
      // RESOURCE TIME GRID (Wide >= 1024px & Medium 640-1023px)
      // -------------------------------------------------------------
      const timeAxisMarkup = scheduleIr.timeAxisTicks.map((t) => `
        <div class="time-tick" style="left: ${t.percent}%;">
          <span class="time-tick-label">${escapeHtml(t.label)}</span>
        </div>
      `).join("");

      const rowsMarkup = scheduleIr.groups.map((group) => {
        const groupItems = scheduleIr.allIntervals.filter((it) => it.groupId === group.id);

        const blocksMarkup = groupItems.map((item) => {
          const subLaneHeight = item.totalSubLanes > 1 ? Math.floor(100 / item.totalSubLanes) - 4 : 88;
          const subLaneTop = item.totalSubLanes > 1 ? item.subLane * Math.floor(100 / item.totalSubLanes) + 4 : 6;

          if (item.isBlackout) {
            return `
              <div class="schedule-block blackout"
                style="left: ${item.leftPercent}%; width: ${item.widthPercent}%; top: ${subLaneTop}%; height: ${subLaneHeight}%;"
                title="Blackout: ${escapeHtml(item.title)} (${escapeHtml(item.timeRangeLabel)})"
                role="article"
                aria-label="Blackout: ${escapeHtml(item.title)} (${escapeHtml(item.timeRangeLabel)})">
                <span class="block-title">${escapeHtml(item.title)}</span>
                <span class="block-time">${escapeHtml(item.timeRangeLabel)}</span>
              </div>
            `;
          }

          return `
            <div class="schedule-block tone-${escapeHtml(item.tone)}"
              style="left: ${item.leftPercent}%; width: ${item.widthPercent}%; top: ${subLaneTop}%; height: ${subLaneHeight}%;"
              tabindex="0"
              role="button"
              data-detail="${escapeHtml(item.entityId)}:${escapeHtml(item.recordId)}"
              title="${escapeHtml(item.title)} (${escapeHtml(item.timeRangeLabel)})"
              aria-label="${escapeHtml(item.title)}, ${escapeHtml(item.groupLabel)}, ${escapeHtml(item.timeRangeLabel)}, ${escapeHtml(item.status)}">
              <span class="block-title">${escapeHtml(item.title)}</span>
              <div class="block-meta">
                <span class="block-time">${escapeHtml(item.timeRangeLabel)}</span>
                ${item.quote ? `<span class="block-quote">${escapeHtml(item.quote)}</span>` : ""}
              </div>
            </div>
          `;
        }).join("");

        // Empty clickable slots for grid slot booking (PART 12)
        const emptySlots = [];
        for (let h = scheduleIr.displayStartHour; h < scheduleIr.displayEndHour; h += 2) {
          const slotStart = `${scheduleIr.currentDate}T${String(h).padStart(2, "0")}:00:00.000Z`;
          const slotEnd = `${scheduleIr.currentDate}T${String(h + 2).padStart(2, "0")}:00:00.000Z`;
          const slotPercent = ((h - scheduleIr.displayStartHour) / (scheduleIr.displayEndHour - scheduleIr.displayStartHour)) * 100;
          const slotWidth = (2 / (scheduleIr.displayEndHour - scheduleIr.displayStartHour)) * 100;
          emptySlots.push(`
            <div class="schedule-empty-slot"
              style="left: ${slotPercent}%; width: ${slotWidth}%;"
              data-create-slot="${escapeHtml(group.id)}:${escapeHtml(slotStart)}:${escapeHtml(slotEnd)}"
              title="Click to book ${escapeHtml(group.label)} at ${String(h).padStart(2, "0")}:00"
              aria-label="Available slot ${escapeHtml(group.label)} at ${String(h).padStart(2, "0")}:00">
            </div>
          `);
        }

        return `
          <div class="schedule-grid-row" data-group-id="${escapeHtml(group.id)}">
            <div class="row-group-label" title="${escapeHtml(group.label)}">
              <strong>${escapeHtml(group.label)}</strong>
            </div>
            <div class="row-lane">
              ${emptySlots.join("")}
              ${blocksMarkup}
            </div>
          </div>
        `;
      }).join("");

      // Current time indicator line (PART 19)
      const nowLineMarkup = scheduleIr.nowMarker.visible ? `
        <div class="schedule-now-line" style="left: ${scheduleIr.nowMarker.percent}%;" title="Current Time: ${escapeHtml(scheduleIr.nowMarker.timeLabel)}">
          <span class="now-pill">${escapeHtml(scheduleIr.nowMarker.timeLabel)}</span>
        </div>
      ` : "";

      scheduleBody = `
        <div class="schedule-grid-container" data-representation="${escapeHtml(scheduleIr.representation)}">
          <div class="schedule-grid-header">
            <div class="corner-cell">${escapeHtml(screen.schedule?.groupResource ? titleCase(screen.schedule.groupResource) : "Resource")}</div>
            <div class="time-axis-lane">
              ${timeAxisMarkup}
              ${nowLineMarkup}
            </div>
          </div>
          <div class="schedule-grid-body">
            ${rowsMarkup}
          </div>
        </div>
      `;
    }

    return `
      <div class="section-stack" data-section-rhythm="comfortable">
        <div class="page-heading schedule-page-heading">
          <div>
            <p class="eyebrow">${escapeHtml(screen.title)}</p>
            <h1>${escapeHtml(screen.title)}</h1>
            <p>Schedule and resource allocation</p>
          </div>
          <div class="screen-view-toggle">
            <button type="button" class="view-toggle-btn" data-screen-view="collection">Table</button>
            <button type="button" class="view-toggle-btn active" data-screen-view="schedule">Schedule</button>
          </div>
        </div>
        <section class="panel schedule-panel" data-section-role="schedule" data-section-relationship="independent" data-schedule-representation="${escapeHtml(scheduleIr.representation)}">
          ${dateToolbar}
          ${scheduleBody}
        </section>
      </div>
    `;
  }

  function renderWorkflowInbox(screen) {
    const pending = [];
    if (runtime) {
      for (const proc of screen.processes) {
        const records = runtime.records(proc.resource);
        for (const record of records) {
          const actions = runtime.availableActions(proc.resource, record.id);
          if (actions.length > 0) {
            pending.push({ resource: proc.resource, record, actions });
          }
        }
      }
    }

    const itemsMarkup = pending.length ? pending.map(({ resource, record, actions }) => {
      const targetScreen = presentationIr.screens.find((s) => s.resource === resource);
      const title = runtime ? runtime.displayValue(resource, targetScreen?.labelField ?? "id", record[targetScreen?.labelField ?? "id"]) : record.id;
      const status = record.status ?? record.state ?? "Pending";
      const actionButtons = actions.map((a) => `<button class="button primary" data-detail="${escapeHtml(resource)}:${escapeHtml(record.id)}">${escapeHtml(a.label)}</button>`).join("");
      return `<li class="panel inbox-item" tabindex="0" data-detail="${escapeHtml(resource)}:${escapeHtml(record.id)}">
        <div class="inbox-item-main">
          <span class="badge ${statusTone(status)}">${escapeHtml(displayStatus(status))}</span>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(resource)} · ID: ${escapeHtml(record.id)}</span>
        </div>
        <div class="inbox-actions">${actionButtons}</div>
      </li>`;
    }).join("") : `<div class="empty-state"><div>${icon("check", 28)}</div><h3>All caught up</h3><p>You have no pending approvals or actions requiring attention.</p></div>`;

    return `<div class="section-stack" data-section-rhythm="comfortable">
      <div class="page-heading"><div><p class="eyebrow">Tasks</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div></div>
      <section class="panel inbox-panel" data-section-role="workflow_inbox" data-section-relationship="independent"><ol class="inbox-list" aria-label="Pending review items">${itemsMarkup}</ol></section>
    </div>`;
  }

  function renderAuthLogin(screen) {
    const section = screen.sections?.[0];
    const fields = section?.fields ?? [];
    const submitAction = section?.actions?.[0];
    const isSubmitting = state.authState.status === "submitting";
    const errorMessage = state.authState.status === "error" ? state.authState.message : "";
    const hasRegister = presentationIr.screens.some((s) => s.id === "auth_register");
    const hasForgot = presentationIr.screens.some((s) => s.id === "auth_forgot_password");
    const hasVerify = presentationIr.screens.some((s) => s.id === "auth_verify");

    return `<div class="auth-card-container">
      <div class="brand"><span class="brand-mark">${icon("lock", 24)}</span><strong>${escapeHtml(presentationIr.app.title)}</strong></div>
      <section class="panel auth-panel">
        <div class="panel-heading"><div><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div></div>
        <form id="auth-login-form" novalidate>
          ${errorMessage ? `<div class="auth-error-banner" role="alert" aria-live="assertive">${escapeHtml(errorMessage)}</div>` : ""}
          <div class="form-grid">
            ${fields.map((field) => `
              <label class="field span-2" for="auth-${escapeHtml(field.id)}">
                <span>${escapeHtml(field.label)} <i aria-hidden="true">*</i></span>
                <input id="auth-${escapeHtml(field.id)}" name="${escapeHtml(field.name)}" type="${escapeHtml(field.type)}" placeholder="${escapeHtml(field.placeholder)}" required autocomplete="${escapeHtml(field.autoComplete)}" ${isSubmitting ? "disabled" : ""}>
              </label>`).join("")}
          </div>
          <div class="modal-actions auth-actions">
            <button type="submit" class="button primary span-2" ${isSubmitting ? "disabled" : ""}>
              ${isSubmitting ? escapeHtml(section.feedback.submittingLabel) : escapeHtml(submitAction?.label ?? "Sign In")}
            </button>
          </div>
          <div class="auth-links">
            ${hasForgot ? '<button type="button" class="text-button" data-nav="auth_forgot_password">Forgot password?</button>' : ""}
            ${hasRegister ? '<button type="button" class="text-button" data-nav="auth_register">Need an account? Register</button>' : ""}
            ${hasVerify ? '<button type="button" class="text-button" data-nav="auth_verify">Verify account</button>' : ""}
          </div>
        </form>
      </section>
    </div>`;
  }

  function renderAuthRegister(screen) {
    const isSubmitting = state.authState.status === "submitting";
    const errorMessage = state.authState.status === "error" ? state.authState.message : "";

    return `<div class="auth-card-container">
      <div class="brand"><span class="brand-mark">${icon("lock", 24)}</span><strong>${escapeHtml(presentationIr.app.title)}</strong></div>
      <section class="panel auth-panel">
        <div class="panel-heading"><div><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div></div>
        <form id="auth-register-form" novalidate>
          ${errorMessage ? `<div class="auth-error-banner" role="alert" aria-live="assertive">${escapeHtml(errorMessage)}</div>` : ""}
          <div class="form-grid">
            <label class="field span-2" for="reg-name">
              <span>Full Name <i aria-hidden="true">*</i></span>
              <input id="reg-name" name="name" type="text" placeholder="e.g. Jane Doe" required autocomplete="name" ${isSubmitting ? "disabled" : ""}>
            </label>
            <label class="field span-2" for="reg-email">
              <span>Email Address <i aria-hidden="true">*</i></span>
              <input id="reg-email" name="identity" type="email" placeholder="jane@example.com" required autocomplete="username" ${isSubmitting ? "disabled" : ""}>
            </label>
            <label class="field span-2" for="reg-password">
              <span>Password <i aria-hidden="true">*</i></span>
              <input id="reg-password" name="password" type="password" placeholder="••••••••" required autocomplete="new-password" ${isSubmitting ? "disabled" : ""}>
            </label>
            <label class="field span-2" for="reg-confirm">
              <span>Confirm Password <i aria-hidden="true">*</i></span>
              <input id="reg-confirm" name="confirm_password" type="password" placeholder="••••••••" required autocomplete="new-password" ${isSubmitting ? "disabled" : ""}>
            </label>
          </div>
          <div class="modal-actions auth-actions">
            <button type="submit" class="button primary span-2" ${isSubmitting ? "disabled" : ""}>
              ${isSubmitting ? "Creating account…" : "Create Account"}
            </button>
          </div>
          <div class="auth-links">
            <button type="button" class="text-button" data-nav="auth_login">Already have an account? Sign in</button>
          </div>
        </form>
      </section>
    </div>`;
  }

  function renderAuthVerify(screen) {
    const isSubmitting = state.authState.status === "submitting";
    const errorMessage = state.authState.status === "error" ? state.authState.message : "";

    return `<div class="auth-card-container">
      <div class="brand"><span class="brand-mark">${icon("lock", 24)}</span><strong>${escapeHtml(presentationIr.app.title)}</strong></div>
      <section class="panel auth-panel">
        <div class="panel-heading"><div><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div></div>
        <form id="auth-verify-form" novalidate>
          ${errorMessage ? `<div class="auth-error-banner" role="alert" aria-live="assertive">${escapeHtml(errorMessage)}</div>` : ""}
          <div class="form-grid">
            <label class="field span-2" for="verify-email">
              <span>Email Address <i aria-hidden="true">*</i></span>
              <input id="verify-email" name="identity" type="email" value="${escapeHtml(state.authState.email)}" placeholder="user@example.com" required ${isSubmitting ? "disabled" : ""}>
            </label>
            <label class="field span-2" for="verify-code">
              <span>Verification Code (Demo: <code>123456</code>) <i aria-hidden="true">*</i></span>
              <input id="verify-code" name="code" type="text" placeholder="123456" required ${isSubmitting ? "disabled" : ""}>
            </label>
          </div>
          <div class="modal-actions auth-actions">
            <button type="submit" class="button primary span-2" ${isSubmitting ? "disabled" : ""}>
              ${isSubmitting ? "Verifying…" : "Verify Identity"}
            </button>
          </div>
          <div class="auth-links">
            <button type="button" class="text-button" data-nav="auth_login">Back to Sign In</button>
          </div>
        </form>
      </section>
    </div>`;
  }

  function renderAuthForgotPassword(screen) {
    const isSubmitting = state.authState.status === "submitting";
    const errorMessage = state.authState.status === "error" ? state.authState.message : "";
    const infoMessage = state.authState.status === "info" ? state.authState.message : "";

    return `<div class="auth-card-container">
      <div class="brand"><span class="brand-mark">${icon("lock", 24)}</span><strong>${escapeHtml(presentationIr.app.title)}</strong></div>
      <section class="panel auth-panel">
        <div class="panel-heading"><div><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div></div>
        <form id="auth-forgot-form" novalidate>
          ${errorMessage ? `<div class="auth-error-banner" role="alert" aria-live="assertive">${escapeHtml(errorMessage)}</div>` : ""}
          ${infoMessage ? `<div class="auth-info-banner" role="status">${escapeHtml(infoMessage)}</div>` : ""}
          ${state.authState.demoToken ? `
            <div class="panel" style="margin-bottom: 1rem; border-color: var(--accent);">
              <p><strong>[DEMO ONLY] Single-Use Reset Token:</strong></p>
              <code>${escapeHtml(state.authState.demoToken)}</code>
              <button type="button" class="button secondary" style="margin-top: 0.5rem;" data-nav="auth_reset_password" data-prefill-token="${escapeHtml(state.authState.demoToken)}">Proceed to Reset Password</button>
            </div>` : ""}
          <div class="form-grid">
            <label class="field span-2" for="forgot-email">
              <span>Account Email <i aria-hidden="true">*</i></span>
              <input id="forgot-email" name="identity" type="email" placeholder="user@example.com" required autocomplete="username" ${isSubmitting ? "disabled" : ""}>
            </label>
          </div>
          <div class="modal-actions auth-actions">
            <button type="submit" class="button primary span-2" ${isSubmitting ? "disabled" : ""}>
              ${isSubmitting ? "Submitting…" : "Send Recovery Instructions"}
            </button>
          </div>
          <div class="auth-links">
            <button type="button" class="text-button" data-nav="auth_login">Back to Sign In</button>
          </div>
        </form>
      </section>
    </div>`;
  }

  function renderAuthResetPassword(screen) {
    const isSubmitting = state.authState.status === "submitting";
    const errorMessage = state.authState.status === "error" ? state.authState.message : "";

    return `<div class="auth-card-container">
      <div class="brand"><span class="brand-mark">${icon("lock", 24)}</span><strong>${escapeHtml(presentationIr.app.title)}</strong></div>
      <section class="panel auth-panel">
        <div class="panel-heading"><div><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div></div>
        <form id="auth-reset-form" novalidate>
          ${errorMessage ? `<div class="auth-error-banner" role="alert" aria-live="assertive">${escapeHtml(errorMessage)}</div>` : ""}
          <div class="form-grid">
            <label class="field span-2" for="reset-token">
              <span>Reset Token <i aria-hidden="true">*</i></span>
              <input id="reset-token" name="token" type="text" value="${escapeHtml(state.authState.demoToken)}" placeholder="rst_..." required ${isSubmitting ? "disabled" : ""}>
            </label>
            <label class="field span-2" for="reset-password">
              <span>New Password <i aria-hidden="true">*</i></span>
              <input id="reset-password" name="password" type="password" placeholder="••••••••" required autocomplete="new-password" ${isSubmitting ? "disabled" : ""}>
            </label>
            <label class="field span-2" for="reset-confirm">
              <span>Confirm New Password <i aria-hidden="true">*</i></span>
              <input id="reset-confirm" name="confirm_password" type="password" placeholder="••••••••" required autocomplete="new-password" ${isSubmitting ? "disabled" : ""}>
            </label>
          </div>
          <div class="modal-actions auth-actions">
            <button type="submit" class="button primary span-2" ${isSubmitting ? "disabled" : ""}>
              ${isSubmitting ? "Resetting…" : "Set New Password"}
            </button>
          </div>
          <div class="auth-links">
            <button type="button" class="text-button" data-nav="auth_login">Back to Sign In</button>
          </div>
        </form>
      </section>
    </div>`;
  }

  function renderAccountProfile(screen) {
    const principal = runtime?.principal;
    const user = authAdapter.users?.find((u) => u.id === principal?.id) ?? {
      id: principal?.id ?? "unknown",
      name: principal?.id ?? "User",
      email: `${principal?.id ?? "user"}@example.com`,
      roles: principal?.roles ?? [],
      verified: true,
      active: true
    };

    return `<div class="section-stack" data-section-rhythm="comfortable">
      <div class="page-heading">
        <div><p class="eyebrow">Account</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div>
      </div>
      <section class="panel" data-section-role="account_profile" data-section-relationship="independent">
        <div class="panel-heading"><div><h2>Profile Details</h2></div></div>
        <form id="profile-form" novalidate>
          <div class="form-grid">
            <label class="field span-2" for="prof-id">
              <span>User ID</span>
              <input id="prof-id" type="text" value="${escapeHtml(user.id)}" disabled>
            </label>
            <label class="field span-2" for="prof-email">
              <span>Email Address</span>
              <input id="prof-email" type="email" value="${escapeHtml(user.email)}" disabled>
            </label>
            <label class="field span-2" for="prof-roles">
              <span>Assigned Roles</span>
              <input id="prof-roles" type="text" value="${escapeHtml(user.roles?.join(", "))}" disabled>
            </label>
            <label class="field span-2" for="prof-name">
              <span>Display Name <i aria-hidden="true">*</i></span>
              <input id="prof-name" name="name" type="text" value="${escapeHtml(user.name)}" required>
            </label>
          </div>
          <div class="modal-actions" style="margin-top: 1rem; display: flex; gap: 0.75rem;">
            <button type="submit" class="button primary">Save Profile</button>
            <button type="button" class="button danger-ghost" data-logout>${icon("close", 16)} Sign out</button>
          </div>
        </form>
      </section>
    </div>`;
  }

  function renderAccountSecurity(screen) {
    const principal = runtime?.principal;
    const sessions = [...authAdapter.sessions.values()].filter((s) => s.userId === principal?.id);

    return `<div class="section-stack" data-section-rhythm="comfortable">
      <div class="page-heading">
        <div><p class="eyebrow">Account</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div>
      </div>
      <section class="panel" data-section-role="account_password" data-section-relationship="independent">
        <div class="panel-heading"><div><h2>Change Password</h2></div></div>
        <form id="change-password-form" novalidate>
          <div class="form-grid">
            <label class="field span-2" for="cp-current">
              <span>Current Password <i aria-hidden="true">*</i></span>
              <input id="cp-current" name="current_password" type="password" placeholder="••••••••" required autocomplete="current-password">
            </label>
            <label class="field span-2" for="cp-new">
              <span>New Password <i aria-hidden="true">*</i></span>
              <input id="cp-new" name="new_password" type="password" placeholder="••••••••" required autocomplete="new-password">
            </label>
            <label class="field span-2" for="cp-confirm">
              <span>Confirm New Password <i aria-hidden="true">*</i></span>
              <input id="cp-confirm" name="confirm_password" type="password" placeholder="••••••••" required autocomplete="new-password">
            </label>
          </div>
          <div class="modal-actions" style="margin-top: 1rem;">
            <button type="submit" class="button primary">Update Password</button>
          </div>
        </form>
      </section>

      <section class="panel" data-section-role="active_sessions" data-section-relationship="independent">
        <div class="panel-heading">
          <div><h2>Active Sessions</h2><p>Manage devices and active authentication tokens</p></div>
          ${sessions.filter((s) => s.id !== authAdapter.currentSessionId).length > 0 ? '<button class="button secondary" data-revoke-others>Revoke all other sessions</button>' : ""}
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Device</th><th>Created</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${sessions.map((sess) => `
                <tr>
                  <td><strong>${escapeHtml(sess.device)}</strong><br><small>${escapeHtml(sess.id)}</small></td>
                  <td>${escapeHtml(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sess.createdAt)))}</td>
                  <td>${sess.id === authAdapter.currentSessionId ? '<span class="badge positive"><span></span>Current Session</span>' : '<span class="badge neutral"><span></span>Active</span>'}</td>
                  <td>${sess.id === authAdapter.currentSessionId ? "—" : `<button class="button danger-ghost" data-revoke-session="${escapeHtml(sess.id)}">Revoke</button>`}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>`;
  }

  function renderUserManagement(screen) {
    const principal = runtime?.principal;
    const users = authAdapter.users ?? [];

    return `<div class="section-stack" data-section-rhythm="comfortable">
      <div class="page-heading">
        <div><p class="eyebrow">Administration</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div>
      </div>
      <section class="panel" data-section-role="user_management" data-section-relationship="independent">
        <div class="panel-heading"><div><h2>System Accounts (${users.length})</h2></div></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Identity</th><th>Email</th><th>Roles</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${users.map((u) => `
                <tr>
                  <td><strong>${escapeHtml(u.name)}</strong><br><small>${escapeHtml(u.id)}</small></td>
                  <td>${escapeHtml(u.email)}</td>
                  <td>
                    <select data-admin-role="${escapeHtml(u.id)}" ${u.id === principal?.id ? "disabled title='Cannot demote self'" : ""}>
                      <option value="admin" ${u.roles.includes("admin") ? "selected" : ""}>Admin</option>
                      <option value="manager" ${u.roles.includes("manager") ? "selected" : ""}>Manager</option>
                      <option value="member" ${u.roles.includes("member") ? "selected" : ""}>Member</option>
                    </select>
                  </td>
                  <td>
                    <span class="badge ${u.active ? "positive" : "danger"}"><span></span>${u.active ? "Active" : "Deactivated"}</span>
                    <span class="badge ${u.verified ? "positive" : "warning"}"><span></span>${u.verified ? "Verified" : "Unverified"}</span>
                  </td>
                  <td>
                    ${u.id !== principal?.id ? `<button class="button ${u.active ? "danger-ghost" : "secondary"}" data-admin-toggle-active="${escapeHtml(u.id)}">${u.active ? "Deactivate" : "Activate"}</button>` : '<small class="text-muted">Self</small>'}
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>`;
  }

  function renderDetail() {
    const { entityId, recordId } = state.detail;
    const screen = presentationIr.screens.find((s) => s.resource === entityId);
    const record = runtime ? runtime.get(entityId, recordId) : null;
    if (!record || !screen) {
      state.detail = null;
      return renderCollection(screen ?? currentScreen());
    }
    const title = runtime ? runtime.displayValue(entityId, screen.labelField, record[screen.labelField]) : record.id;
    const editAllowed = runtime ? runtime.can(entityId, "edit", record) && runtime.editableFields(entityId, record).length > 0 : true;
    const editButton = editAllowed ? `<button class="button secondary" data-edit="${escapeHtml(entityId)}:${escapeHtml(recordId)}">${icon("edit", 16)} Edit</button>` : "";
    
    const deleteAction = screen.actions?.find((a) => a.intent === "delete" || a.intent === "archive");
    const canDelete = runtime ? runtime.can(entityId, deleteAction?.intent ?? "delete", record) : true;
    const deleteButton = canDelete ? `<button class="button danger-ghost" data-delete="${escapeHtml(entityId)}:${escapeHtml(recordId)}">${icon("trash", 16)} ${escapeHtml(deleteAction?.label ?? "Delete")}</button>` : "";
    
    const workflowActions = runtime ? runtime.availableActions(entityId, recordId).map((action) => `<button class="button primary" data-transition="${escapeHtml(action.action)}" data-comment="${escapeHtml(action.comment)}">${escapeHtml(action.label)}</button>`).join("") : "";
    const history = runtime ? runtime.history(entityId, recordId) : [];

    // Semantic Workflow Graph Artifact
    let workflowGraphMarkup = "";
    const proc = runtime?.processes?.get ? runtime.processes.get(entityId) : runtime?.processes?.[entityId];
    if (proc) {
      const graphIr = compileWorkflowGraph(proc, record, { containerWidth: state.containerWidth });
      workflowGraphMarkup = renderSemanticGraph(graphIr);
    }

    // Semantic Timeline Graph Artifact
    let timelineGraphMarkup = "";
    if (history.length > 0) {
      const timelineIr = compileTimelineGraph(history, { containerWidth: state.containerWidth });
      timelineGraphMarkup = renderSemanticGraph(timelineIr);
    }

    return `<div class="section-stack" data-section-rhythm="comfortable">
      <button class="back-button" data-close-detail>${icon("back", 16)} Back to ${escapeHtml(screen.title)}</button>
      <div class="detail-hero" data-section-role="hero" data-section-relationship="independent"><div class="detail-identity"><span class="avatar large">${escapeHtml(initials(title))}</span><div><p class="eyebrow">${escapeHtml(screen.singular)} profile</p><h1>${escapeHtml(title)}</h1><span class="record-id">${escapeHtml(record.id)}</span></div></div><div class="detail-actions">${workflowActions}${editButton}${deleteButton}</div></div>
      ${workflowGraphMarkup}
      <section class="panel detail-panel" data-section-role="detail" data-section-relationship="independent"><div class="panel-heading"><div><p class="eyebrow">Record details</p><h2>Information</h2></div></div><dl>${screen.editor.fields.map((field) => `<div><dt>${escapeHtml(field.label)}</dt><dd>${valueMarkup(screen, field.id, record[field.id], true)}</dd></div>`).join("")}</dl></section>
      ${timelineGraphMarkup}
    </div>`;
  }

  function highlightCompilerSnippet(code) {
    if (!code) return "";
    return escapeHtml(code)
      .replace(/\b(air version=\d+|app|process|transition|from|to|by|distinct|approvals|state|initial|import|export|const|let|function|return)\b/g, '<span class="tok-kw">$1</span>')
      .replace(/("schema"|"process"|"states"|"guards"|"screens"|"id"|"type"|"archetype"|"character"|"composition"|"shell"|"version")/g, '<span class="tok-prop">$1</span>')
      .replace(/\b(draft|approved|paid|manager|finance|distinct_actor|workflow_inbox|product_launch|technical-premium|asymmetric_bento|public|true|false)\b/g, '<span class="tok-val">$1</span>')
      .replace(/(\/\/[^\n]*)/g, '<span class="tok-comment">$1</span>');
  }

  function renderHeroSection(section) {
    const raw = section.rawSection ?? section;
    const primary = raw.primaryAction;
    const secondary = raw.secondaryAction;
    const motionAttr = section.motion ? `data-motion="${escapeHtml(section.motion.type)}"` : "";
    const heroDecision = resolveHeroArtifactLayout(state.containerWidth);
    const isStacked = heroDecision.representation === HERO_REPRESENTATION.STACKED;

    return `<header class="landing-hero motion-spotlight" ${motionAttr} id="hero" data-hero-representation="${escapeHtml(heroDecision.representation)}">
      <div class="landing-hero-composition ${isStacked ? "stacked-hero" : ""}">
        <div class="landing-hero-content">
          <div class="hero-eyebrow-badge">
            <span class="hero-badge-dot"></span>
            <span>Autonomous Intent Architecture</span>
          </div>
          <h1 class="landing-hero-headline">${escapeHtml(raw.headline ?? raw.title ?? presentationIr.app.title)}</h1>
          <p class="landing-hero-tagline">${escapeHtml(raw.tagline ?? raw.subtitle ?? presentationIr.app.subtitle)}</p>
          <div class="landing-hero-actions">
            ${primary ? `<a href="${escapeHtml(primary.url)}" class="button primary large">${escapeHtml(primary.label)}</a>` : '<a href="#pricing" class="button primary large">Get Started Free</a>'}
            ${secondary ? `<a href="${escapeHtml(secondary.url)}" class="button secondary large">${escapeHtml(secondary.label)}</a>` : '<a href="#compiler_story" class="button secondary large">Explore Architecture</a>'}
          </div>
          <div class="hero-trust-strip">
            <div class="trust-stat">
              <strong class="trust-stat-val">100%</strong>
              <span class="trust-stat-lbl">Invariant Assurance</span>
            </div>
            <div class="trust-stat-divider"></div>
            <div class="trust-stat">
              <strong class="trust-stat-val">Two-Key</strong>
              <span class="trust-stat-lbl">Security Engine</span>
            </div>
            <div class="trust-stat-divider"></div>
            <div class="trust-stat">
              <strong class="trust-stat-val">0 Lines</strong>
              <span class="trust-stat-lbl">Handwritten UI Glue</span>
            </div>
          </div>
        </div>
        <div class="landing-hero-visual">
          <div class="hero-stage-card">
            <div class="hero-terminal-header">
              <div class="term-dots"><span class="term-dot"></span><span class="term-dot"></span><span class="term-dot"></span></div>
              <span class="term-title">air.compiler // live transformation</span>
              <span class="term-status"><span class="pulse-dot"></span> active</span>
            </div>
            <div class="hero-transformation-workbench">
              <div class="transform-step step-intent">
                <div class="step-meta"><span class="step-badge">1</span> <span class="step-title">Natural Intent</span></div>
                <div class="step-intent-quote">&ldquo;Build a multi-tier approval workflow with distinct actor checks.&rdquo;</div>
              </div>
              <div class="transform-flow-arrow"><span class="flow-line"></span><span class="flow-arrow-icon">&darr;</span></div>
              <div class="transform-step step-source">
                <div class="step-meta"><span class="step-badge">2</span> <span class="step-title">Compact AIR Source</span></div>
                <div class="step-code-snippet">
                  <code><span class="tok-kw">process</span> items <span class="tok-prop">state</span>=<span class="tok-val">status</span><br><span class="tok-kw">transition</span> from=<span class="tok-val">draft</span> to=<span class="tok-val">approved</span> <span class="tok-kw">by</span>=<span class="tok-val">manager</span> <span class="tok-prop">distinct</span>=<span class="tok-val">true</span></code>
                </div>
              </div>
              <div class="transform-flow-arrow"><span class="flow-line"></span><span class="flow-arrow-icon">&darr;</span></div>
              <div class="transform-step step-graph">
                <div class="step-meta"><span class="step-badge">3</span> <span class="step-title">Semantic Invariant Graph</span></div>
                <div class="step-graph-preview">
                  <span class="graph-node valid">draft</span>
                  <span class="graph-link">&xrarr;</span>
                  <span class="graph-node active">manager_approval</span>
                  <span class="graph-link">&xrarr;</span>
                  <span class="graph-node valid">approved</span>
                </div>
              </div>
              <div class="transform-flow-arrow"><span class="flow-line"></span><span class="flow-arrow-icon">&darr;</span></div>
              <div class="transform-step step-delivery">
                <div class="step-meta"><span class="step-badge">4</span> <span class="step-title">Multi-Platform Delivery (0 Handwritten CSS)</span></div>
                <div class="delivery-targets">
                  <div class="target-node"><span class="target-dot"></span> Web DOM</div>
                  <div class="target-node"><span class="target-dot"></span> iOS SwiftUI</div>
                  <div class="target-node"><span class="target-dot"></span> Android Compose</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>`;
  }

  function renderCompilerStorySection(section) {
    const stages = section.pipelineStages ?? [];
    const activeStep = Math.min(Math.max(1, state.compilerStep), stages.length);
    const activeStage = stages[activeStep - 1] ?? stages[0];

    return `<section class="landing-section compiler-story-section" id="compiler_story">
      <div class="landing-section-heading">
        <p class="eyebrow">Interactive Compiler Architecture</p>
        <h2>${escapeHtml(section.title ?? "Autonomous Intent Compilation")}</h2>
        <p>${escapeHtml(section.subtitle ?? "How natural intent transforms into deterministic, reactive multi-platform systems without UI boilerplate.")}</p>
      </div>
      <div class="compiler-showcase">
        <div class="compiler-pipeline-stepper" role="tablist" aria-label="Compilation Pipeline Stages">
          ${stages.map((stage) => `
            <button class="stepper-tab ${stage.step === activeStep ? "active" : ""}" data-compiler-step="${stage.step}" role="tab" aria-selected="${stage.step === activeStep ? "true" : "false"}">
              <span class="step-num">${stage.step}</span>
              <span class="step-label">${escapeHtml(stage.label)}</span>
            </button>
          `).join("")}
        </div>
        <div class="compiler-stage-display motion-spotlight">
          <div class="stage-header">
            <div class="stage-badge">
              <span class="step-pill">Stage ${activeStage?.step ?? 1} of ${stages.length}</span>
              <strong>${escapeHtml(activeStage?.label ?? "")}</strong>
            </div>
            <span class="stage-annotation">${escapeHtml(activeStage?.annotation ?? "")}</span>
          </div>
          <div class="stage-code-panel">
            <pre class="stage-code-block"><code>${highlightCompilerSnippet(activeStage?.code ?? "")}</code></pre>
          </div>
          <div class="stage-nav-controls">
            <button type="button" class="button secondary small" data-compiler-step="${Math.max(1, activeStep - 1)}" ${activeStep <= 1 ? "disabled" : ""}>${icon("back", 14)} Previous Stage</button>
            <div class="stage-flow-dots">
              ${stages.map((s) => `<span class="flow-dot ${s.step === activeStep ? "active" : s.step < activeStep ? "completed" : ""}"></span>`).join("")}
            </div>
            <button type="button" class="button primary small" data-compiler-step="${Math.min(stages.length, activeStep + 1)}" ${activeStep >= stages.length ? "disabled" : ""}>Next Stage ${icon("chevron", 14)}</button>
          </div>
        </div>
      </div>
    </section>`;
  }

  function renderFeatureSection(section) {
    const raw = section.rawSection ?? section;
    const motionAttr = section.motion ? `data-motion="${escapeHtml(section.motion.type)}"` : "";
    const featureLayout = section.featureLayout;
    const sectionDecision = resolveFeatureStorySectionLayout(state.containerWidth);

    if (section.composition === COMPOSITIONS.FLAT_FEATURE_LIST) {
      return `<section class="landing-section minimal-feature-section" id="features" ${motionAttr} data-section-representation="${escapeHtml(sectionDecision.representation)}">
        <div class="landing-section-heading">
          <p class="eyebrow">Capabilities</p>
          <h2>${escapeHtml(raw.title ?? "Capabilities")}</h2>
          <p>${escapeHtml(raw.subtitle ?? "")}</p>
        </div>
        <div class="flat-feature-list ${state.containerWidth < 640 ? "stacked" : ""}">
          ${(raw.items ?? []).map((item, idx) => `
            <div class="flat-feature-row">
              <div class="flat-feature-index">0${idx + 1}</div>
              <div class="flat-feature-body">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.description)}</p>
              </div>
            </div>
          `).join("")}
        </div>
      </section>`;
    }

    if (section.composition === COMPOSITIONS.EDITORIAL_NARRATIVE) {
      return `<section class="landing-section editorial-feature-section" id="features" ${motionAttr} data-section-representation="${escapeHtml(sectionDecision.representation)}">
        <div class="landing-section-heading">
          <p class="eyebrow">Architecture & Guarantees</p>
          <h2>${escapeHtml(raw.title ?? "System Philosophy")}</h2>
          <p>${escapeHtml(raw.subtitle ?? "")}</p>
        </div>
        <div class="editorial-columns ${state.containerWidth < 768 ? "single-column" : ""}">
          ${(raw.items ?? []).map((item) => `
            <article class="editorial-story-item">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.description)}</p>
            </article>
          `).join("")}
        </div>
      </section>`;
    }

    // Dominant Anchor Feature Layout
    if (featureLayout && featureLayout.dominantAnchor) {
      const isNarrow = sectionDecision.representation === FEATURE_STORY_REPRESENTATION.NARRATIVE_STACK;
      const isBalanced = sectionDecision.representation === FEATURE_STORY_REPRESENTATION.BALANCED_GRID;
      const gridClass = isNarrow ? "narrative-stack" : isBalanced ? "balanced-grid" : "bento-grid";
      const previewStackedClass = state.containerWidth < 500 ? "stacked-metrics" : "";

      return `<section class="landing-section feature-section" id="features" ${motionAttr} data-section-representation="${escapeHtml(sectionDecision.representation)}">
        <div class="landing-section-heading">
          <p class="eyebrow">Capabilities & Invariants</p>
          <h2>${escapeHtml(raw.title ?? "Built for Autonomous Engineering")}</h2>
          <p>${escapeHtml(raw.subtitle ?? "Everything you need to build robust, verifiable software systems.")}</p>
        </div>
        <div class="feature-grid ${gridClass}">
          <article class="bento-card dominant-card motion-card ${isNarrow ? "stacked-card" : ""}">
            <div class="bento-card-badge"><span class="badge positive"><span></span>Core Capability</span></div>
            <div class="bento-card-icon large">${icon(featureLayout.dominantAnchor.icon ?? "spark", 30)}</div>
            <h3>${escapeHtml(featureLayout.dominantAnchor.title)}</h3>
            <p class="dominant-desc">${escapeHtml(featureLayout.dominantAnchor.description)}</p>
            <div class="dominant-visual-preview ${previewStackedClass}">
              <div class="preview-metric"><span>Invariant Assurance</span><strong>100% Deterministic</strong></div>
              <div class="preview-metric"><span>Boilerplate Generated</span><strong>0 Lines</strong></div>
            </div>
          </article>
          ${(featureLayout.supportingStories ?? []).map((item, idx) => `
            <article class="bento-card supporting-card motion-card ${isNarrow ? "stacked-card" : ""}">
              <div class="bento-card-icon">${icon(item.icon ?? (idx === 0 ? "check" : "collection"), 22)}</div>
              <h4>${escapeHtml(item.title)}</h4>
              <p>${escapeHtml(item.description)}</p>
            </article>
          `).join("")}
          ${featureLayout.proofHighlight ? `
            <article class="bento-card proof-card motion-card ${isNarrow ? "stacked-card" : ""}">
              <div class="bento-card-icon">${icon(featureLayout.proofHighlight.icon ?? "lock", 22)}</div>
              <h4>${escapeHtml(featureLayout.proofHighlight.title)}</h4>
              <p>${escapeHtml(featureLayout.proofHighlight.description)}</p>
              <div class="proof-card-footer"><span class="chip-live">Live Automated Verification</span></div>
            </article>
          ` : ""}
        </div>
      </section>`;
    }

    const items = (raw.items ?? []).map((item) => `
      <article class="feature-card motion-card" tabindex="0">
        <div class="feature-card-icon">${icon(item.icon ?? "spark", 24)}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>
    `).join("");

    return `<section class="landing-section feature-section" id="features" ${motionAttr} data-section-representation="${escapeHtml(sectionDecision.representation)}">
      <div class="landing-section-heading">
        <p class="eyebrow">Capabilities</p>
        <h2>${escapeHtml(raw.title ?? "Capabilities")}</h2>
        <p>${escapeHtml(raw.subtitle ?? "")}</p>
      </div>
      <div class="feature-grid ${sectionDecision.representation === FEATURE_STORY_REPRESENTATION.NARRATIVE_STACK ? "narrative-stack" : ""}">${items}</div>
    </section>`;
  }

  function renderSocialProofSection(section) {
    const raw = section.rawSection ?? section;
    const proofDecision = resolveSocialProofSectionLayout(state.containerWidth);
    const isStacked = proofDecision.representation === PROOF_REPRESENTATION.PROOF_STACK;

    const stats = (raw.stats ?? [
      { label: "Token Compression", value: "94%" },
      { label: "Execution Latency", value: "< 2ms" },
      { label: "Security Vulnerabilities", value: "0" }
    ]).map((stat) => `
      <div class="stat-callout-item">
        <strong class="stat-value">${escapeHtml(stat.value)}</strong>
        <span class="stat-label">${escapeHtml(stat.label)}</span>
      </div>
    `).join("");

    const testimonials = (raw.testimonials ?? []).map((item) => `
      <blockquote class="editorial-quote-card">
        <span class="quote-symbol" aria-hidden="true">“</span>
        <p class="quote-text">${escapeHtml(item.quote)}</p>
        <footer class="quote-footer">
          <strong class="quote-author">${escapeHtml(item.author)}</strong>
          <span class="quote-role">${escapeHtml(item.role)}</span>
        </footer>
      </blockquote>
    `).join("");

    return `<section class="landing-section social-proof-section" id="proof" data-section-representation="${escapeHtml(proofDecision.representation)}">
      <div class="landing-section-heading">
        <p class="eyebrow">Empirical Verification</p>
        <h2>${escapeHtml(raw.title ?? "Proven Quantitative Reductions")}</h2>
        <p>${escapeHtml(raw.subtitle ?? "Measured across complex enterprise applications.")}</p>
      </div>
      ${stats ? `<div class="stats-callout-grid ${isStacked ? "stacked-stats" : ""}">${stats}</div>` : ""}
      ${testimonials ? `<div class="editorial-quotes-wrap ${isStacked ? "single-column" : ""}">${testimonials}</div>` : ""}
    </section>`;
  }

  function renderPricingSection(section) {
    const raw = section.rawSection ?? section;
    const pricingDecision = resolvePricingSectionLayout(state.containerWidth);
    const isSequential = pricingDecision.representation === PRICING_REPRESENTATION.SEQUENTIAL_PLANS;

    const tiers = (raw.tiers ?? []).map((tier) => `
      <article class="pricing-card ${tier.popular ? "popular" : ""}">
        ${tier.popular ? '<div class="pricing-badge">Most Popular</div>' : ""}
        <div class="pricing-card-header">
          <h3>${escapeHtml(tier.name)}</h3>
          <p>${escapeHtml(tier.description)}</p>
        </div>
        <div class="pricing-card-price">
          <strong>${escapeHtml(tier.price)}</strong>
          <span>/${escapeHtml(tier.period)}</span>
        </div>
        <ul class="pricing-features">
          ${(tier.features ?? []).map((f) => `<li>${icon("check", 16)} <span>${escapeHtml(f)}</span></li>`).join("")}
        </ul>
        <div class="pricing-card-cta">
          <button class="button ${tier.popular ? "primary" : "secondary"}" style="width: 100%;">${escapeHtml(tier.cta)}</button>
        </div>
      </article>
    `).join("");

    return `<section class="landing-section pricing-section" id="pricing" data-section-representation="${escapeHtml(pricingDecision.representation)}">
      <div class="landing-section-heading">
        <p class="eyebrow">Pricing Plans</p>
        <h2>${escapeHtml(raw.title ?? "Predictable, Transparent Pricing")}</h2>
        <p>${escapeHtml(raw.subtitle ?? "Scale seamlessly from local prototype to distributed enterprise cluster.")}</p>
      </div>
      <div class="pricing-grid ${isSequential ? "sequential-plans" : ""}">${tiers}</div>
    </section>`;
  }

  function renderFaqSection(section) {
    const raw = section.rawSection ?? section;
    const items = (raw.items ?? []).map((item, idx) => `
      <details class="faq-item" ${idx === 0 ? "open" : ""}>
        <summary class="faq-question">
          <span>${escapeHtml(item.question)}</span>
          ${icon("chevron", 18)}
        </summary>
        <div class="faq-answer">
          <p>${escapeHtml(item.answer)}</p>
        </div>
      </details>
    `).join("");

    return `<section class="landing-section faq-section" id="faq">
      <div class="landing-section-heading">
        <p class="eyebrow">Knowledge Base</p>
        <h2>${escapeHtml(raw.title ?? "Frequently Asked Questions")}</h2>
        <p>${escapeHtml(raw.subtitle ?? "Everything you need to know about AIR architecture.")}</p>
      </div>
      <div class="faq-accordion">${items}</div>
    </section>`;
  }

  function renderCtaSection(section) {
    const raw = section.rawSection ?? section;
    return `<section class="landing-section cta-section">
      <div class="cta-banner">
        <div class="cta-banner-content">
          <h2>${escapeHtml(raw.headline ?? "Start Building Software from Intent Today")}</h2>
          <p>${escapeHtml(raw.tagline ?? "Experience the speed and safety of autonomous software compilation.")}</p>
          <div class="cta-banner-actions">
            <a href="${escapeHtml(raw.action?.url ?? "#pricing")}" class="button primary large">${escapeHtml(raw.action?.label ?? "Deploy Your First App")}</a>
          </div>
        </div>
      </div>
    </section>`;
  }

  function renderFooterSection(section) {
    const raw = section.rawSection ?? section;
    const links = (raw.links ?? [
      { label: "Documentation", url: "#" },
      { label: "GitHub", url: "https://github.com/joaquimpsoares/AIR" },
      { label: "Privacy Policy", url: "#" },
      { label: "Security Architecture", url: "#" }
    ]).map((l) => `
      <a href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a>
    `).join("");

    return `<footer class="landing-footer">
      <div class="landing-footer-inner">
        <div class="landing-footer-brand">
          <div class="brand"><span class="brand-mark">${icon("spark", 18)}</span><strong>${escapeHtml(raw.brand ?? presentationIr.app.title)}</strong></div>
          <p class="copyright">${escapeHtml(raw.copyright ?? `© ${new Date().getFullYear()} AIR Platform. All rights reserved.`)}</p>
        </div>
        <nav class="landing-footer-links" aria-label="Footer navigation">${links}</nav>
      </div>
    </footer>`;
  }

  function renderMarketingLanding(screen) {
    const visualScreen = visualDesignIr.screens.find((s) => s.id === screen.id) ?? visualDesignIr.screens[0];
    const sectionsHtml = (visualScreen.sections ?? []).map((section) => {
      switch (section.semanticType) {
        case "hero":
          return renderHeroSection(section);
        case "compiler_story":
          return renderCompilerStorySection(section);
        case "feature_grid":
        case "features":
          return renderFeatureSection(section);
        case "social_proof":
        case "testimonials":
          return renderSocialProofSection(section);
        case "pricing_grid":
        case "pricing":
          return renderPricingSection(section);
        case "faq_accordion":
        case "faq":
          return renderFaqSection(section);
        case "call_to_action":
        case "cta":
          return renderCtaSection(section);
        case "footer":
          return renderFooterSection(section);
        default:
          return "";
      }
    }).join("");

    return `<div class="marketing-landing section-stack" data-section-rhythm="spacious" data-marketing-landing>${sectionsHtml}</div>`;
  }

  function renderPage() {
    if (state.detail) return renderDetail();
    const screen = currentScreen();
    if (!screen) return `<div class="panel"><h2>Page not found</h2></div>`;
    if (screen.type === "marketing_landing") return renderMarketingLanding(screen);
    if (screen.type === "auth_login") return renderAuthLogin(screen);
    if (screen.type === "auth_register") return renderAuthRegister(screen);
    if (screen.type === "auth_verify") return renderAuthVerify(screen);
    if (screen.type === "auth_forgot_password") return renderAuthForgotPassword(screen);
    if (screen.type === "auth_reset_password") return renderAuthResetPassword(screen);
    if (screen.type === "account_profile") return renderAccountProfile(screen);
    if (screen.type === "account_security") return renderAccountSecurity(screen);
    if (screen.type === "user_management") return renderUserManagement(screen);
    if (screen.type === "dashboard") return renderDashboard(screen);
    if (screen.type === "schedule") return renderSchedule(screen);
    if (screen.type === "resource_management") {
      const viewMode = state.screenViewMode.get(screen.id);
      if (viewMode === "schedule" && screen.schedule) {
        return renderSchedule(screen);
      }
      return renderCollection(screen);
    }
    if (screen.type === "workflow_inbox") return renderWorkflowInbox(screen);
    return `<div class="panel"><h2>Screen ${escapeHtml(screen.title)}</h2></div>`;
  }

  function hydrateEditorValues(screen, record) {
    if (!record || !screen) return {};
    const values = {};
    for (const field of screen.editor?.fields ?? []) {
      const rawVal = record[field.id];
      if (rawVal === undefined || rawVal === null) {
        values[field.id] = field.defaultValue ?? "";
      } else if (field.type === "money") {
        values[field.id] = typeof rawVal === "number" ? rawVal.toFixed(2) : String(rawVal);
      } else if (field.type === "bool") {
        values[field.id] = Boolean(rawVal);
      } else if (field.type === "ratio") {
        values[field.id] = typeof rawVal === "object" && rawVal !== null && typeof rawVal.toString === "function" ? rawVal.toString() : String(rawVal);
      } else if (field.type === "integer") {
        values[field.id] = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";
      } else if (field.type === "date" || field.type === "datetime") {
        values[field.id] = typeof rawVal === "string" ? rawVal : (rawVal instanceof Date ? rawVal.toISOString().slice(0, 10) : String(rawVal));
      } else {
        values[field.id] = rawVal;
      }
    }
    return values;
  }

  function inputFor(screen, field, value, error) {
    const id = `field-${slug(field.id)}`;
    const common = `id="${id}" name="${escapeHtml(field.id)}" ${field.required ? "required" : ""} aria-invalid="${Boolean(error)}" ${error ? `aria-describedby="${id}-error"` : ""}`;
    let control;
    if (field.type === "text" && field.long) {
      control = `<textarea ${common} placeholder="${escapeHtml(field.placeholder)}" rows="4">${escapeHtml(value)}</textarea>`;
    } else if (field.type === "enum") {
      control = `<select ${common}><option value="">Select ${escapeHtml(field.label.toLowerCase())}</option>${field.options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === option ? "selected" : ""}>${escapeHtml(displayStatus(option))}</option>`).join("")}</select>`;
    } else if (field.type === "ref" && runtime) {
      const targetScreen = presentationIr.screens.find((s) => s.resource === field.ref);
      control = `<select ${common}><option value="">Select ${escapeHtml((targetScreen?.singular ?? field.ref).toLowerCase())}</option>${runtime.query(field.ref, { paginate: false }).records.map((record) => `<option value="${escapeHtml(record.id)}" ${String(value) === record.id ? "selected" : ""}>${escapeHtml(record[targetScreen?.labelField ?? "id"])}</option>`).join("")}</select>`;
    } else if (field.type === "bool") {
      control = `<label class="checkbox"><input ${common} type="checkbox" ${value ? "checked" : ""}> Enabled</label>`;
    } else {
      const type = field.type === "phone" ? "tel" : (field.type === "money" || field.type === "number" || field.type === "integer") ? "number" : ["email", "date"].includes(field.type) ? field.type : "text";
      const stepAttr = field.type === "money" ? 'step="0.01"' : field.type === "integer" ? 'step="1"' : "";
      const minAttr = field.min !== undefined && field.min !== null ? (["number", "integer", "money"].includes(field.type) ? `min="${field.min}"` : `minlength="${field.min}"`) : "";
      const maxAttr = field.max !== undefined && field.max !== null ? (["number", "integer", "money"].includes(field.type) ? `max="${field.max}"` : `maxlength="${field.max}"`) : "";
      control = `<input ${common} type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder)}" ${minAttr} ${maxAttr} ${stepAttr}>`;
    }
    return `<label class="field ${field.type === "text" && field.long ? "span-2" : ""}" for="${id}"><span>${escapeHtml(field.label)}${field.required ? '<i aria-hidden="true">*</i>' : ""}</span>${control}${error ? `<small class="field-error" id="${id}-error">${escapeHtml(error)}</small>` : ""}</label>`;
  }

  function renderDrawer() {
    if (!state.drawer) return "";
    const { purpose, entityId, recordId, size = DRAWER_SIZE.STANDARD, status = "open" } = state.drawer;
    const drawerDecision = resolveDrawerArtifactLayout(state.containerWidth, size);
    const formDecision = resolveFormArtifactLayout(state.containerWidth);
    const screen = presentationIr.screens.find((s) => s.resource === entityId);

    if (purpose === "create" || purpose === "edit") {
      const editing = Boolean(recordId);
      const record = editing && runtime ? (runtime.get(screen?.resource, recordId) ?? runtime.records(screen?.resource)?.find((item) => item.id === recordId)) : {};
      const values = state.drawer.values ?? (editing ? hydrateEditorValues(screen, record) : {});
      const fields = editing && runtime
        ? runtime.editableFields(screen?.resource, record).map((f) => screen?.editor?.fields?.find((ef) => ef.id === f.id)).filter(Boolean)
        : (screen?.editor?.fields ?? []).filter((field) => !field.readOnly && field.id !== "workflow_status");

      return `<div class="drawer-backdrop" data-dismiss-drawer data-status="${escapeHtml(status)}">
        <aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title" data-drawer-panel data-representation="${escapeHtml(drawerDecision.representation)}" data-size="${escapeHtml(drawerDecision.size)}" data-status="${escapeHtml(status)}">
          <header class="drawer-header">
            <div>
              <p class="eyebrow">${editing ? "Update record" : "New record"}</p>
              <h2 id="drawer-title">${editing ? `Edit ${escapeHtml(screen?.singular ?? "Record")}` : `Add ${escapeHtml(screen?.singular ?? "Record")}`}</h2>
            </div>
            <button class="icon-button" data-close-drawer aria-label="Close drawer">${icon("close", 18)}</button>
          </header>
          <div class="drawer-body">
            <form id="drawer-record-form" data-entity="${escapeHtml(screen?.resource ?? entityId)}" data-record="${escapeHtml(recordId ?? "")}" novalidate>
              <div class="form-grid ${formDecision.representation === FORM_REPRESENTATION.SINGLE_COLUMN ? "single-column" : "multi-column"}">
                ${fields.map((field) => inputFor(screen, field, values[field.id] ?? (editing ? "" : (field.defaultValue ?? "")), state.drawer.errors?.[field.id])).join("")}
              </div>
            </form>
          </div>
          <footer class="drawer-footer">
            <button type="button" class="button secondary" data-close-drawer>Cancel</button>
            <button type="submit" form="drawer-record-form" class="button primary">${editing ? "Save changes" : `Create ${escapeHtml(screen?.singular ?? "Record")}`}</button>
          </footer>
        </aside>
      </div>`;
    }

    if (purpose === "detail") {
      const record = runtime ? runtime.get(entityId, recordId) : null;
      if (!record || !screen) {
        state.drawer = null;
        return "";
      }
      const title = runtime ? runtime.displayValue(entityId, screen.labelField, record[screen.labelField]) : record.id;
      const editAllowed = runtime ? runtime.can(entityId, "edit", record) && runtime.editableFields(entityId, record).length > 0 : true;

      // Classify transitions & actions per Drawer Action Policy
      const availableTransitions = runtime ? runtime.availableActions(entityId, recordId) : [];
      const deleteAction = screen.actions?.find((a) => a.intent === "delete" || a.intent === "archive");
      const canDelete = runtime ? runtime.can(entityId, deleteAction?.intent ?? "delete", record) : true;

      const isDestructiveAction = (actionName) => {
        const s = actionName.toLowerCase();
        return ["cancel", "reject", "deny", "terminate", "delete", "archive", "mark_no_show", "no_show"].includes(s);
      };

      const forwardTransitions = availableTransitions.filter((a) => !isDestructiveAction(a.action));
      const destructiveTransitions = availableTransitions.filter((a) => isDestructiveAction(a.action));

      let primaryAction = null;
      let secondaryAction = null;
      const overflowList = [];

      if (forwardTransitions.length > 0) {
        primaryAction = {
          type: "transition",
          action: forwardTransitions[0].action,
          label: forwardTransitions[0].label,
          comment: forwardTransitions[0].comment,
          tone: "primary"
        };
        if (editAllowed) {
          secondaryAction = {
            type: "edit",
            label: "Edit",
            icon: "edit"
          };
        } else if (forwardTransitions.length > 1) {
          secondaryAction = {
            type: "transition",
            action: forwardTransitions[1].action,
            label: forwardTransitions[1].label,
            comment: forwardTransitions[1].comment,
            tone: "secondary"
          };
        }
        for (let i = (secondaryAction?.type === "transition" ? 2 : 1); i < forwardTransitions.length; i++) {
          overflowList.push({
            type: "transition",
            action: forwardTransitions[i].action,
            label: forwardTransitions[i].label,
            comment: forwardTransitions[i].comment,
            tone: "neutral"
          });
        }
      } else if (editAllowed) {
        primaryAction = {
          type: "edit",
          label: "Edit",
          icon: "edit"
        };
      }

      if (destructiveTransitions.length > 0 || (canDelete && deleteAction)) {
        if (overflowList.length > 0) {
          overflowList.push({ separator: true });
        }
        for (const dt of destructiveTransitions) {
          overflowList.push({
            type: "transition",
            action: dt.action,
            label: dt.label,
            comment: dt.comment,
            tone: "destructive",
            icon: "trash"
          });
        }
        if (canDelete && deleteAction) {
          overflowList.push({
            type: "delete",
            label: deleteAction.label ?? "Delete",
            icon: "trash",
            tone: "destructive"
          });
        }
      }

      state.drawer.overflowActions = overflowList;

      const primaryMarkup = primaryAction ? (
        primaryAction.type === "transition"
          ? `<button class="button primary" data-transition="${escapeHtml(primaryAction.action)}" data-comment="${escapeHtml(primaryAction.comment)}">${escapeHtml(primaryAction.label)}</button>`
          : `<button class="button primary" data-drawer-edit="${escapeHtml(entityId)}:${escapeHtml(recordId)}">${icon("edit", 16)} Edit</button>`
      ) : "";

      const secondaryMarkup = secondaryAction ? (
        secondaryAction.type === "transition"
          ? `<button class="button secondary" data-transition="${escapeHtml(secondaryAction.action)}" data-comment="${escapeHtml(secondaryAction.comment)}">${escapeHtml(secondaryAction.label)}</button>`
          : `<button class="button secondary" data-drawer-edit="${escapeHtml(entityId)}:${escapeHtml(recordId)}">${icon("edit", 16)} Edit</button>`
      ) : "";

      const overflowMarkup = overflowList.length > 0 ? (
        `<button class="button secondary icon-only" data-drawer-overflow-menu aria-label="More actions" title="More actions">${icon("menu", 16)}</button>`
      ) : "";

      const history = runtime ? runtime.history(entityId, recordId) : [];
      let workflowGraphMarkup = "";
      const proc = runtime?.processes?.get ? runtime.processes.get(entityId) : runtime?.processes?.[entityId];
      if (proc) {
        const graphIr = compileWorkflowGraph(proc, record, { containerWidth: state.containerWidth });
        workflowGraphMarkup = `<div style="margin-top: 16px;">${renderSemanticGraph(graphIr)}</div>`;
      }

      return `<div class="drawer-backdrop" data-dismiss-drawer data-status="${escapeHtml(status)}">
        <aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title" data-drawer-panel data-representation="${escapeHtml(drawerDecision.representation)}" data-size="${escapeHtml(drawerDecision.size)}" data-status="${escapeHtml(status)}">
          <header class="drawer-header">
            <div>
              <p class="eyebrow">${escapeHtml(screen.singular)} details</p>
              <h2 id="drawer-title">${escapeHtml(title)}</h2>
            </div>
            <button class="icon-button" data-close-drawer aria-label="Close drawer">${icon("close", 18)}</button>
          </header>
          <div class="drawer-body drawer-detail-section">
            <div class="drawer-detail-grid">
              ${screen.editor.fields.map((field) => `
                <div class="drawer-detail-item ${field.type === "text" && field.long ? "span-2" : ""}">
                  <span class="drawer-detail-label">${escapeHtml(field.label)}</span>
                  <span class="drawer-detail-value">${valueMarkup(screen, field.id, record[field.id], false)}</span>
                </div>
              `).join("")}
            </div>
            ${workflowGraphMarkup}
          </div>
          <footer class="drawer-footer drawer-action-footer">
            <div class="drawer-footer-actions">
              ${secondaryMarkup}
              ${primaryMarkup}
              ${overflowMarkup}
            </div>
          </footer>
        </aside>
      </div>`;
    }

    if (purpose === "filter") {
      const q = queryState(screen);
      return `<div class="drawer-backdrop" data-dismiss-drawer data-status="${escapeHtml(status)}">
        <aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title" data-drawer-panel data-representation="${escapeHtml(drawerDecision.representation)}" data-size="compact" data-status="${escapeHtml(status)}">
          <header class="drawer-header">
            <div>
              <p class="eyebrow">Filters</p>
              <h2 id="drawer-title">Filter ${escapeHtml(screen?.plural ?? screen?.title ?? "Records")}</h2>
            </div>
            <button class="icon-button" data-close-drawer aria-label="Close drawer">${icon("close", 18)}</button>
          </header>
          <div class="drawer-body" style="display: flex; flex-direction: column; gap: 16px;">
            <label class="field">
              <span>Search</span>
              <input type="search" placeholder="Search ${escapeHtml(screen?.plural?.toLowerCase() ?? "records")}…" value="${escapeHtml(q.search)}" data-filter-search>
            </label>
            ${(screen?.collection?.filterableFields ?? []).map((fieldId) => {
              const field = screen.editor.fields.find((f) => f.id === fieldId);
              if (!field) return "";
              if (field.type === "enum") {
                return `<label class="field">
                  <span>${escapeHtml(field.label)}</span>
                  <select data-filter-select="${escapeHtml(fieldId)}">
                    <option value="">All ${escapeHtml(field.label.toLowerCase())}</option>
                    ${field.options.map((opt) => `<option value="${escapeHtml(opt)}" ${q.filters[fieldId] === opt ? "selected" : ""}>${escapeHtml(displayStatus(opt))}</option>`).join("")}
                  </select>
                </label>`;
              }
              return "";
            }).join("")}
          </div>
          <footer class="drawer-footer">
            <button type="button" class="button secondary" data-filter-clear>Reset</button>
            <button type="button" class="button primary" data-close-drawer>Done</button>
          </footer>
        </aside>
      </div>`;
    }

    return "";
  }

  function renderMenu() {
    if (!state.openMenu) return "";
    const { items, position, isMobileSheet } = state.openMenu;
    const menuDecision = resolveMenuArtifactLayout(state.containerWidth);
    const isSheet = isMobileSheet || menuDecision.representation === MENU_REPRESENTATION.COMPACT_SHEET;

    let style = "";
    if (!isSheet && position) {
      style = `top: ${position.top}px; left: ${position.left}px;`;
    }

    return `<div class="menu-backdrop" data-dismiss-menu>
      <div class="menu-dropdown" role="menu" data-menu-panel data-representation="${isSheet ? "compact_sheet" : "dropdown"}" style="${style}" tabindex="-1">
        ${items.map((it, idx) => {
          if (it.separator) return '<div class="menu-separator" role="separator"></div>';
          return `
            <button type="button" class="menu-item ${it.tone === "destructive" ? "destructive" : ""}" role="menuitem" data-menu-action="${escapeHtml(it.id)}" data-tone="${escapeHtml(it.tone ?? "neutral")}" ${it.disabled ? "disabled" : ""} tabindex="-1" data-index="${idx}">
              ${it.icon ? icon(it.icon, 16) : ""}
              <span>${escapeHtml(it.label)}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>`;
  }

  function renderModal() {
    if (!state.modal) return "";
    const screen = presentationIr.screens.find((s) => s.resource === state.modal.entityId);
    const editing = Boolean(state.modal.recordId);
    const record = editing && runtime ? runtime.records(screen.resource).find((item) => item.id === state.modal.recordId) : {};
    const values = state.modal.values ?? record ?? {};
    const fields = editing && runtime
      ? runtime.editableFields(screen.resource, record).map((f) => screen.editor.fields.find((ef) => ef.id === f.id)).filter(Boolean)
      : screen.editor.fields.filter((field) => !field.readOnly && field.id !== "workflow_status");

    const formDecision = resolveFormArtifactLayout(state.containerWidth);

    return `<div class="modal-backdrop" data-dismiss-modal><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel data-form-representation="${escapeHtml(formDecision.representation)}">
      <div class="modal-heading"><div><p class="eyebrow">${editing ? "Update record" : "New record"}</p><h2 id="modal-title">${editing ? `Edit ${escapeHtml(screen.singular)}` : `Add ${escapeHtml(screen.singular)}`}</h2></div><button class="icon-button" data-close-modal aria-label="Close">${icon("close", 18)}</button></div>
      <form id="record-form" data-entity="${escapeHtml(screen.resource)}" data-record="${escapeHtml(state.modal.recordId ?? "")}" novalidate>
        <div class="form-grid ${formDecision.representation === FORM_REPRESENTATION.SINGLE_COLUMN ? "single-column" : "multi-column"}">${fields.map((field) => inputFor(screen, field, values[field.id] ?? field.defaultValue ?? "", state.modal.errors?.[field.id])).join("")}</div>
        <div class="modal-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button type="submit" class="button primary">${editing ? "Save changes" : `Create ${escapeHtml(screen.singular)}`}</button></div>
      </form>
    </section></div>`;
  }

  function closeDrawer(force = false) {
    if (!state.drawer) return;
    if (state.drawer.status === "closing") return;
    if (!force && state.drawer.isDirty) {
      state.confirm = { type: "discard_drawer" };
      render();
      root.querySelector("[data-confirm-modal]")?.querySelector("button, input")?.focus();
      return;
    }

    const prefersReducedMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || typeof document === "undefined") {
      const prev = state.drawer.previousFocusedElement;
      state.drawer = null;
      render();
      if (prev && typeof prev.focus === "function") prev.focus();
      return;
    }

    state.drawer.status = "closing";
    render();

    const drawerEl = root.querySelector("[data-drawer-panel]");
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        if (state.drawer?.status === "closing") {
          const prev = state.drawer.previousFocusedElement;
          state.drawer = null;
          render();
          if (prev && typeof prev.focus === "function") prev.focus();
        }
      }
    };

    if (drawerEl && typeof drawerEl.addEventListener === "function") {
      drawerEl.addEventListener("animationend", finish, { once: true });
      setTimeout(finish, 260);
    } else {
      finish();
    }
  }

  function renderConfirm() {
    if (!state.confirm) return "";
    if (state.confirm.type === "discard_drawer") {
      return `<div class="modal-backdrop" data-dismiss-discard-confirm><section class="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" data-confirm-modal><div class="danger-icon">${icon("trash", 22)}</div><h2 id="confirm-title">Discard changes?</h2><p>You have unsaved changes in this record. Are you sure you want to discard them?</p><div class="modal-actions"><button type="button" class="button secondary" data-cancel-discard>Keep editing</button><button type="button" class="button danger" data-confirm-discard>Discard</button></div></section></div>`;
    }
    const screen = presentationIr.screens.find((s) => s.resource === state.confirm.entityId);
    const record = runtime ? runtime.records(screen?.resource).find((item) => item.id === state.confirm.recordId) : null;
    const label = record?.[screen?.labelField] ?? record?.id;
    const isArchive = screen?.collection?.lifecycle === "archive";
    const verb = isArchive ? "Archive" : "Delete";
    const consequence = isArchive ? "It will leave active views but remain stored." : "This action cannot be undone.";
    return `<div class="modal-backdrop"><section class="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" data-confirm-modal><div class="danger-icon">${icon("trash", 22)}</div><h2 id="confirm-title">${verb} ${escapeHtml(screen?.singular?.toLowerCase() ?? "record")}?</h2><p><strong>${escapeHtml(label)}</strong> will be ${isArchive ? "archived" : "permanently removed"}. ${consequence}</p><div class="modal-actions"><button class="button secondary" data-cancel-delete>Cancel</button><button class="button danger" data-confirm-delete>${verb} ${escapeHtml(screen?.singular?.toLowerCase() ?? "record")}</button></div></section></div>`;
  }

  function formatRelativeTime(isoString, now = new Date()) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const diffMs = now.valueOf() - date.valueOf();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  }

  function renderNotificationCenter() {
    if (!state.notificationCenterOpen) return "";
    const isMobile = state.containerWidth < 768;
    const notifications = runtime ? runtime.notifications() : [];
    const unreadCount = runtime ? runtime.unreadNotificationCount() : 0;
    const now = runtime?.clock?.() ?? new Date();

    const feedHtml = notifications.length === 0
      ? `<div class="empty-notifications">
           <div class="empty-icon">${icon("bell", 28)}</div>
           <p>No notifications</p>
         </div>`
      : `<div class="notification-feed" role="feed" aria-label="Notification list">
           ${notifications.map((notif) => {
             const toneIcon = notif.tone === "warning" || notif.tone === "danger" ? "warning" : notif.tone === "success" ? "check" : "bell";
             return `
               <article class="notification-card ${notif.read ? "read" : "unread"}" data-notification-card data-notification-id="${escapeHtml(notif.id)}" data-resource="${escapeHtml(notif.action?.resource ?? notif.resource)}" data-record="${escapeHtml(notif.action?.recordId ?? notif.recordId)}" tabindex="0" role="button" aria-label="${escapeHtml(notif.label)}: ${escapeHtml(notif.title)}">
                 <div class="notification-tone-icon ${escapeHtml(notif.tone)}">${icon(toneIcon, 16)}</div>
                 <div class="notification-content">
                   <div class="notification-meta">
                     <span class="notification-label">${escapeHtml(notif.label)}</span>
                     <span class="notification-time">${escapeHtml(formatRelativeTime(notif.createdAt, now))}</span>
                   </div>
                   <h4 class="notification-title">${escapeHtml(notif.title)}</h4>
                   ${notif.body ? `<p class="notification-body">${escapeHtml(notif.body)}</p>` : ""}
                 </div>
                 <div class="notification-actions">
                   <button type="button" class="icon-button-sm ${notif.read ? "read-btn" : "unread-btn"}" data-toggle-read="${escapeHtml(notif.id)}" aria-label="${notif.read ? "Mark as unread" : "Mark as read"}" title="${notif.read ? "Mark as unread" : "Mark as read"}">${icon("check", 13)}</button>
                   <button type="button" class="icon-button-sm dismiss-btn" data-dismiss-notif="${escapeHtml(notif.id)}" aria-label="Dismiss notification" title="Dismiss">${icon("close", 13)}</button>
                 </div>
                 ${!notif.read ? `<span class="unread-dot" aria-hidden="true"></span>` : ""}
               </article>
             `;
           }).join("")}
         </div>`;

    if (isMobile) {
      return `<div class="modal-backdrop notification-sheet-backdrop" data-dismiss-notifications>
        <section class="notification-sheet drawer-panel" role="dialog" aria-modal="true" aria-labelledby="notif-sheet-title" data-notification-sheet>
          <header class="drawer-header notification-center-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 id="notif-sheet-title">Notifications</h2>
              ${unreadCount > 0 ? `<span class="badge accent">${unreadCount} new</span>` : ""}
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${unreadCount > 0 ? `<button type="button" class="text-button" data-mark-all-read>Mark all read</button>` : ""}
              <button class="icon-button" data-close-notifications aria-label="Close notifications">${icon("close", 18)}</button>
            </div>
          </header>
          <div class="drawer-body notification-center-body">
            ${feedHtml}
          </div>
        </section>
      </div>`;
    }

    return `<div class="notification-popover-backdrop" data-dismiss-notifications>
      <section class="notification-popover panel" role="dialog" aria-modal="true" aria-labelledby="notif-popover-title" data-notification-popover>
        <header class="notification-center-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3 id="notif-popover-title">Notifications</h3>
            ${unreadCount > 0 ? `<span class="badge accent">${unreadCount} new</span>` : ""}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${unreadCount > 0 ? `<button type="button" class="text-button" data-mark-all-read>Mark all read</button>` : ""}
            <button class="icon-button" data-close-notifications aria-label="Close notifications">${icon("close", 16)}</button>
          </div>
        </header>
        <div class="notification-center-body">
          ${feedHtml}
        </div>
      </section>
    </div>`;
  }

  function render() {
    applyTheme();
    root.removeAttribute("aria-busy");
    const isAuthScreen = ["auth_login", "auth_register", "auth_verify", "auth_forgot_password", "auth_reset_password"].includes(currentScreen()?.type);
    
    if (isAuthScreen) {
      root.innerHTML = `<main class="content auth-content" tabindex="-1">${renderPage()}</main><div id="air-toast" class="toast" role="status" aria-live="polite"></div>`;
    } else if (visualDesignIr.shell.type === SHELL_TYPES.PUBLIC || currentScreen()?.type === "marketing_landing") {
      // Public / Marketing Shell
      const navDecision = resolveShellArtifactLayout(state.containerWidth, true);
      const isCompactNav = navDecision.representation === SHELL_REPRESENTATION.PUBLIC_COMPACT;

      root.innerHTML = `<div class="public-shell" data-archetype="${escapeHtml(visualDesignIr.archetype)}" data-character="${escapeHtml(visualDesignIr.character)}" data-shell-representation="${escapeHtml(navDecision.representation)}">
        <header class="public-nav-header">
          <div class="public-nav-inner">
            <a href="#hero" class="brand public-brand" aria-label="AIR Platform home">
              <span class="brand-monogram">AIR</span>
              <div class="brand-info">
                <strong class="brand-title">${escapeHtml(presentationIr.app.title)}</strong>
                <span class="brand-tagline">Autonomous Intent Runtime</span>
              </div>
            </a>
            ${!isCompactNav ? `
            <nav class="public-nav-links" aria-label="Public navigation">
              ${visualDesignIr.shell.publicNavItems.map((item) => `<a href="${escapeHtml(item.href)}" class="public-nav-link">${escapeHtml(item.label)}</a>`).join("")}
            </nav>
            ` : ""}
            <div class="public-nav-actions">
              <button class="icon-button" data-theme-toggle aria-label="Toggle theme" title="Toggle theme">
                ${icon(state.theme === "dark" ? "sun" : "moon", 18)}
              </button>
              ${!isCompactNav ? `
              <a href="${escapeHtml(visualDesignIr.shell.primaryCta.href)}" class="button primary small desktop-cta">${escapeHtml(visualDesignIr.shell.primaryCta.label)}</a>
              ` : `
              <button class="icon-button mobile-nav-toggle" data-mobile-nav-toggle aria-label="Toggle mobile menu" aria-expanded="${state.mobileMenuOpen}">
                ${icon(state.mobileMenuOpen ? "close" : "collection", 20)}
              </button>
              `}
            </div>
          </div>
          ${isCompactNav && state.mobileMenuOpen ? `
            <div class="public-mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile navigation">
              <nav class="public-mobile-nav-links">
                ${visualDesignIr.shell.publicNavItems.map((item) => `<a href="${escapeHtml(item.href)}" class="public-mobile-nav-link" data-close-mobile-nav>${escapeHtml(item.label)}</a>`).join("")}
                <a href="${escapeHtml(visualDesignIr.shell.primaryCta.href)}" class="button primary public-mobile-cta" data-close-mobile-nav>${escapeHtml(visualDesignIr.shell.primaryCta.label)}</a>
              </nav>
            </div>
          ` : ""}
        </header>
        <main class="public-content" tabindex="-1">${renderPage()}</main>
        <div id="air-toast" class="toast" role="status" aria-live="polite"></div>
        ${renderDrawer()}
        ${renderMenu()}
      </div>`;
    } else {
      const principal = runtime?.principal;
      const isAuthenticated = Boolean(principal && (principal.id || (principal.roles && principal.roles.length > 0)));
      const currentUser = authAdapter.users?.find((u) => u.id === principal?.id);
      const shellDecision = resolveShellArtifactLayout(state.containerWidth, false);
      const isCompactShell = shellDecision.representation === SHELL_REPRESENTATION.COMPACT;
      const unreadCount = runtime ? runtime.unreadNotificationCount() : 0;

      root.innerHTML = `<div class="app-shell" data-host-mode="${escapeHtml(hostMode)}" data-archetype="${escapeHtml(visualDesignIr.archetype)}" data-character="${escapeHtml(visualDesignIr.character)}" data-shell-representation="${escapeHtml(shellDecision.representation)}">
        ${!isCompactShell ? `
        <aside class="sidebar">
          <div class="brand"><span class="brand-mark">${icon("spark", 20)}</span><div><strong>${escapeHtml(presentationIr.app.title)}</strong><small>AIR native</small></div></div>
          ${isAuthenticated ? `
            <div class="sidebar-user-chip" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 0.75rem;">
              <span class="avatar">${escapeHtml(initials(currentUser?.name ?? principal?.id ?? principal?.roles?.[0] ?? "U"))}</span>
              <div style="flex: 1; min-width: 0;">
                <strong style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem;">${escapeHtml(currentUser?.name ?? principal?.id ?? "Authenticated User")}</strong>
                <small style="color: var(--muted); font-size: 0.75rem;">${escapeHtml(principal?.roles?.join(", ") ?? "user")}</small>
              </div>
              <button class="icon-button bell-button" data-notification-bell aria-label="Notifications, ${unreadCount} unread" aria-expanded="${Boolean(state.notificationCenterOpen)}" title="Notifications">
                ${icon("bell", 18)}
                ${unreadCount > 0 ? `<span class="unread-badge" aria-hidden="true">${unreadCount > 99 ? "99+" : unreadCount}</span>` : ""}
              </button>
            </div>` : ""}
          <nav aria-label="Primary navigation">${renderNav()}</nav>
          <div class="sidebar-footer">
            ${renderUserSwitcher()}
            ${renderDemoPicker()}
            <button class="theme-button" data-theme-toggle>${icon(state.theme === "dark" ? "sun" : "moon", 17)}<span>${state.theme === "dark" ? "Light" : "Dark"} mode</span></button>
            ${isAuthenticated ? `<button class="logout-button button danger-ghost" data-logout style="width: 100%; justify-content: flex-start;">${icon("close", 16)} Sign out</button>` : ""}
            <button class="reset-button" data-reset>Reset demo data</button>
          </div>
        </aside>
        ` : `
        <header class="mobile-header">
          <div class="brand"><span class="brand-mark">${icon("spark", 18)}</span><strong>${escapeHtml(presentationIr.app.title)}</strong></div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${isAuthenticated ? `
              <button class="icon-button bell-button" data-notification-bell aria-label="Notifications, ${unreadCount} unread" aria-expanded="${Boolean(state.notificationCenterOpen)}" title="Notifications">
                ${icon("bell", 18)}
                ${unreadCount > 0 ? `<span class="unread-badge" aria-hidden="true">${unreadCount > 99 ? "99+" : unreadCount}</span>` : ""}
              </button>
              <button class="icon-button logout-button" data-logout aria-label="Sign out" title="Sign out">${icon("close", 18)}</button>
            ` : ""}
            <button class="icon-button" data-theme-toggle aria-label="Toggle theme">${icon(state.theme === "dark" ? "sun" : "moon", 18)}</button>
          </div>
        </header>
        `}
        <main class="content" tabindex="-1">${renderPage()}</main>
        ${isCompactShell ? `<nav class="mobile-nav" aria-label="Primary navigation">${renderNav()}</nav>` : ""}
      </div><div id="air-toast" class="toast" role="status" aria-live="polite"></div>${renderModal()}${renderConfirm()}${renderDrawer()}${renderMenu()}${renderNotificationCenter()}`;
    }
    bindEvents();
  }

  function bindEvents() {
    root.querySelectorAll("[data-nav]").forEach((control) => control.addEventListener("click", () => {
      const target = control.dataset.nav;
      if (control.dataset.prefillToken) {
        state.authState.demoToken = control.dataset.prefillToken;
      }
      navigate(target);
    }));

    root.querySelectorAll("[data-theme-toggle]").forEach((control) => control.addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      if (typeof localStorage !== "undefined") localStorage.setItem("air:theme", state.theme);
      applyTheme();
      render();
    }));

    root.querySelector("#demo-picker")?.addEventListener("change", (event) => {
      location.href = `${location.pathname}?demo=${encodeURIComponent(event.target.value)}`;
    });

    root.querySelector("#user-switch-select")?.addEventListener("change", async (event) => {
      const targetUserId = event.target.value;
      const result = await authAdapter.switchUser(targetUserId);
      if (result.ok && runtime) {
        runtime.principal = result.principal;
        recompileIr();
        notify(`Switched to user ${targetUserId}`);
        const currentScreenStillVisible = presentationIr.screens.some((s) => s.id === state.screenId && (!s.authority || runtime.principal.roles.includes("admin")));
        if (!currentScreenStillVisible) {
          navigate(presentationIr.app.initialScreen);
        } else {
          render();
        }
      } else if (!result.ok) {
        notify(result.error ?? "Failed to switch user", "danger");
      }
    });

    root.querySelectorAll("[data-logout]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (authAdapter && typeof authAdapter.logout === "function") {
          await authAdapter.logout();
        }
        if (runtime) {
          runtime.principal = null;
        }
        recompileIr();
        state.authState = { status: "idle", message: "", email: "", demoToken: "" };
        notify("Signed out");
        const targetScreen = presentationIr.screens.find((s) => s.type === "auth_login")?.id ?? presentationIr.app.initialScreen;
        navigate(targetScreen);
      });
    });

    root.querySelector("[data-reset]")?.addEventListener("click", () => {
      if (!confirm("Reset all demo records to their original seed data?")) return;
      if (runtime) runtime.reset();
      state.detail = null;
      state.drawer = null;
      render();
      notify("Demo data restored");
    });

    // Drawer and Create/Edit/Detail Triggers
    root.querySelectorAll("[data-create]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const entityId = event.currentTarget.dataset.create;
        state.drawer = {
          purpose: "create",
          entityId,
          size: DRAWER_SIZE.STANDARD,
          values: {},
          errors: {},
          isDirty: false,
          previousFocusedElement: document.activeElement
        };
        render();
        root.querySelector("[data-drawer-panel]")?.querySelector("input, select, textarea, button")?.focus();
      });
    });

    root.querySelectorAll("[data-detail]").forEach((row) => {
      const open = (event) => {
        if (event && isInteractiveRowTarget(event.target) && event.target !== row) {
          return;
        }
        const [entityId, recordId] = row.dataset.detail.split(":");
        state.drawer = {
          purpose: "detail",
          entityId,
          recordId,
          size: DRAWER_SIZE.STANDARD,
          values: {},
          errors: {},
          isDirty: false,
          previousFocusedElement: document.activeElement
        };
        render();
        root.querySelector("[data-drawer-panel]")?.querySelector("button, input, select, textarea")?.focus();
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          if (isInteractiveRowTarget(event.target) && event.target !== row) return;
          event.preventDefault();
          open(event);
        }
      });
    });

    root.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const [entityId, recordId] = event.currentTarget.dataset.edit.split(":");
        const screen = presentationIr.screens.find((s) => s.resource === entityId);
        const record = runtime ? (runtime.get(entityId, recordId) ?? runtime.records(entityId)?.find((item) => item.id === recordId)) : null;
        state.drawer = {
          purpose: "edit",
          entityId,
          recordId,
          size: DRAWER_SIZE.STANDARD,
          values: hydrateEditorValues(screen, record),
          errors: {},
          isDirty: false,
          previousFocusedElement: document.activeElement
        };
        render();
        root.querySelector("[data-drawer-panel]")?.querySelector("input, select, textarea, button")?.focus();
      });
    });

    root.querySelectorAll("[data-drawer-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [entityId, recordId] = btn.dataset.drawerEdit.split(":");
        const screen = presentationIr.screens.find((s) => s.resource === entityId);
        const record = runtime ? (runtime.get(entityId, recordId) ?? runtime.records(entityId)?.find((item) => item.id === recordId)) : null;
        if (state.drawer) {
          state.drawer.purpose = "edit";
          state.drawer.entityId = entityId;
          state.drawer.recordId = recordId;
          state.drawer.values = hydrateEditorValues(screen, record);
          state.drawer.errors = {};
          state.drawer.isDirty = false;
          render();
          root.querySelector("[data-drawer-panel]")?.querySelector("input, select, textarea, button")?.focus();
        }
      });
    });

    root.querySelectorAll("[data-close-drawer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeDrawer(false);
      });
    });

    root.querySelectorAll("[data-dismiss-drawer]").forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) {
          closeDrawer(false);
        }
      });
    });

    // Drawer form tracking & atomic submission
    root.querySelector("#drawer-record-form")?.addEventListener("input", (event) => {
      if (state.drawer) {
        state.drawer.isDirty = true;
        if (!state.drawer.values) state.drawer.values = {};
        const fieldName = event.target.name;
        if (fieldName) {
          state.drawer.values[fieldName] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
        }
      }
    });

    root.querySelector("#drawer-record-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const entityId = form.dataset.entity;
      const recordId = form.dataset.record;
      const screen = presentationIr.screens.find((s) => s.resource === entityId);
      const formData = new FormData(form);
      const values = Object.fromEntries(
        screen.editor.fields
          .filter((f) => !f.readOnly && form.elements.namedItem(f.id))
          .map((f) => [f.id, f.type === "bool" ? formData.has(f.id) : formData.get(f.id) ?? ""])
      );
      try {
        if (runtime) {
          if (recordId) {
            runtime.update(entityId, recordId, values);
            notify(`${screen.singular} updated`);
          } else {
            runtime.create(entityId, values);
            notify(`${screen.singular} created`);
          }
        }
        closeDrawer(true);
      } catch (error) {
        if (state.drawer) {
          state.drawer.errors = error.fieldErrors ?? { _form: error.message };
          state.drawer.values = values;
        }
        render();
      }
    });

    function executeMenuAction(actionId) {
      const parts = actionId.split(":");
      const verb = parts[0];

      if (verb === "view") {
        const [, entityId, recordId] = parts;
        state.drawer = {
          purpose: "detail",
          entityId,
          recordId,
          size: DRAWER_SIZE.STANDARD,
          values: {},
          errors: {},
          isDirty: false,
          previousFocusedElement: document.activeElement
        };
        render();
      } else if (verb === "edit") {
        const [, entityId, recordId] = parts;
        const screen = presentationIr.screens.find((s) => s.resource === entityId);
        const record = runtime ? (runtime.get(entityId, recordId) ?? runtime.records(entityId)?.find((item) => item.id === recordId)) : null;
        state.drawer = {
          purpose: "edit",
          entityId,
          recordId,
          size: DRAWER_SIZE.STANDARD,
          values: hydrateEditorValues(screen, record),
          errors: {},
          isDirty: false,
          previousFocusedElement: document.activeElement
        };
        render();
      } else if (verb === "delete") {
        const [, entityId, recordId] = parts;
        state.confirm = { entityId, recordId };
        render();
      } else if (verb === "transition") {
        const [, entityId, recordId, transAction, commentReq] = parts;
        let comment = "";
        if (commentReq !== "none") {
          const response = prompt(commentReq === "required" ? "Comment required" : "Optional comment");
          if (response == null) return;
          comment = response;
        }
        try {
          if (runtime) runtime.transition(entityId, recordId, transAction, { comment });
          render();
          notify("Workflow updated");
        } catch (error) {
          notify(error.message, "danger");
        }
      }
    }

    let activeMenuCloseHandler = null;

    function unmountMenu() {
      if (activeMenuCloseHandler) {
        window.removeEventListener("scroll", activeMenuCloseHandler, true);
        window.removeEventListener("resize", activeMenuCloseHandler, true);
        activeMenuCloseHandler = null;
      }
      const existing = root?.querySelector?.(".menu-backdrop");
      if (existing) existing.remove();
      if (state.openMenu?.triggerEl) {
        state.openMenu.triggerEl.setAttribute("aria-expanded", "false");
      }
      state.openMenu = null;
    }

    function mountMenu(menuData) {
      unmountMenu();
      state.openMenu = menuData;
      if (menuData.triggerEl) {
        menuData.triggerEl.setAttribute("aria-expanded", "true");
      }

      const { items, position, isMobileSheet } = menuData;
      const menuDecision = resolveMenuArtifactLayout(state.containerWidth);
      const isSheet = isMobileSheet || menuDecision.representation === MENU_REPRESENTATION.COMPACT_SHEET;

      let style = "";
      if (!isSheet && position) {
        style = `top: ${position.top}px; left: ${position.left}px;`;
      }

      const html = `<div class="menu-backdrop" data-dismiss-menu>
        <div class="menu-dropdown" role="menu" data-menu-panel data-representation="${isSheet ? "compact_sheet" : "dropdown"}" style="${style}" tabindex="-1">
          ${items.map((it, idx) => {
            if (it.separator) return '<div class="menu-separator" role="separator"></div>';
            return `
              <button type="button" class="menu-item ${it.tone === "destructive" ? "destructive" : ""}" role="menuitem" data-menu-action="${escapeHtml(it.id)}" data-tone="${escapeHtml(it.tone ?? "neutral")}" ${it.disabled ? "disabled" : ""} tabindex="-1" data-index="${idx}">
                ${it.icon ? icon(it.icon, 16) : ""}
                <span>${escapeHtml(it.label)}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>`;

      const wrap = document.createElement("div");
      wrap.innerHTML = html;
      const backdrop = wrap.firstElementChild;
      if (!backdrop || !root) return;

      root.appendChild(backdrop);

      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          e.stopPropagation();
          unmountMenu();
        }
      });

      backdrop.querySelectorAll("[data-menu-action]").forEach((itemBtn) => {
        itemBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const actionId = itemBtn.dataset.menuAction;
          unmountMenu();
          executeMenuAction(actionId);
        });
      });

      const menuPanel = backdrop.querySelector("[data-menu-panel]");
      const menuItems = Array.from(menuPanel?.querySelectorAll('[role="menuitem"]:not([disabled])') || []);
      if (menuItems.length > 0) {
        menuItems[0].focus();
      }

      menuPanel?.addEventListener("keydown", (e) => {
        const active = document.activeElement;
        const curIdx = menuItems.indexOf(active);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = (curIdx + 1) % menuItems.length;
          menuItems[next]?.focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const prev = (curIdx - 1 + menuItems.length) % menuItems.length;
          menuItems[prev]?.focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          menuItems[0]?.focus();
        } else if (e.key === "End") {
          e.preventDefault();
          menuItems[menuItems.length - 1]?.focus();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          const trigger = menuData.triggerEl;
          unmountMenu();
          trigger?.focus();
        }
      });

      activeMenuCloseHandler = (e) => {
        if (e.target && typeof e.target.closest === "function" && e.target.closest(".menu-dropdown")) return;
        unmountMenu();
      };
      window.addEventListener("scroll", activeMenuCloseHandler, true);
      window.addEventListener("resize", activeMenuCloseHandler, true);
    }

    // Row Action Menu Triggers
    root.querySelectorAll("[data-row-action-menu]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const [entityId, recordId] = btn.dataset.rowActionMenu.split(":");
        const screen = presentationIr.screens.find((s) => s.resource === entityId);
        const record = runtime ? runtime.get(entityId, recordId) : null;

        if (state.openMenu && state.openMenu.id === `row-menu-${entityId}-${recordId}`) {
          unmountMenu();
          return;
        }

        const items = [];
        items.push({ id: `view:${entityId}:${recordId}`, label: "View details", icon: "collection" });

        const canEdit = runtime ? runtime.can(entityId, "edit", record) && runtime.editableFields(entityId, record).length > 0 : true;
        if (canEdit) {
          items.push({ id: `edit:${entityId}:${recordId}`, label: "Edit", icon: "edit" });
        }

        if (runtime && recordId) {
          const availActions = runtime.availableActions(entityId, recordId);
          for (const act of availActions) {
            items.push({ id: `transition:${entityId}:${recordId}:${act.action}:${act.comment ?? "none"}`, label: act.label, icon: "spark" });
          }
        }

        const deleteAction = screen?.actions?.find((a) => a.intent === "delete" || a.intent === "archive");
        const canDelete = runtime ? runtime.can(entityId, deleteAction?.intent ?? "delete", record) : true;
        if (canDelete) {
          items.push({ separator: true });
          items.push({
            id: `delete:${entityId}:${recordId}`,
            label: deleteAction?.label ?? "Delete",
            icon: "trash",
            tone: "destructive"
          });
        }

        const rect = btn.getBoundingClientRect();
        const isMobile = state.containerWidth < 640;

        let top;
        let left;
        if (isEmbedded && root) {
          const rootRect = root.getBoundingClientRect();
          const scale = rootRect.width > 0 && root.offsetWidth > 0 ? (rootRect.width / root.offsetWidth) : 1;
          const unscaledTop = (rect.bottom - rootRect.top) / scale + (root.scrollTop || 0) + 4;
          const unscaledLeft = (rect.right - rootRect.left) / scale + (root.scrollLeft || 0) - 180;
          top = Math.round(unscaledTop);
          left = Math.round(unscaledLeft);
          const rootLogicalW = root.clientWidth || root.offsetWidth || 1200;
          const rootLogicalH = root.clientHeight || root.offsetHeight || 720;
          if (left < 10) left = 10;
          if (left + 190 > rootLogicalW) left = Math.max(10, rootLogicalW - 190);
          if (top + 200 > rootLogicalH) {
            const aboveTop = (rect.top - rootRect.top) / scale + (root.scrollTop || 0) - 190;
            top = Math.max(10, Math.round(aboveTop));
          }
        } else {
          top = Math.round(rect.bottom + 4);
          left = Math.round(rect.right - 180);
          if (left < 10) left = 10;
          if (typeof window !== "undefined" && window.innerWidth) {
            if (left + 200 > window.innerWidth) left = window.innerWidth - 210;
            if (top + 220 > window.innerHeight) top = Math.max(10, rect.top - 200);
          }
        }

        mountMenu({
          id: `row-menu-${entityId}-${recordId}`,
          triggerEl: btn,
          items,
          isMobileSheet: isMobile,
          position: { top, left }
        });
      });
    });

    root.querySelectorAll("[data-drawer-overflow-menu]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!state.drawer || state.drawer.purpose !== "detail") return;
        const { entityId, recordId } = state.drawer;
        const record = runtime ? (runtime.get(entityId, recordId) ?? runtime.records(entityId)?.find((item) => item.id === recordId)) : null;
        if (!record) return;

        if (state.openMenu && state.openMenu.id === `drawer-overflow-${entityId}-${recordId}`) {
          unmountMenu();
          return;
        }

        const overflowActions = state.drawer.overflowActions ?? [];
        const items = [];
        for (const act of overflowActions) {
          if (act.separator) {
            items.push({ separator: true });
          } else if (act.type === "transition") {
            items.push({
              id: `transition:${entityId}:${recordId}:${act.action}:${act.comment ?? "none"}`,
              label: act.label,
              icon: act.icon ?? "spark",
              tone: act.tone ?? "neutral"
            });
          } else if (act.type === "delete") {
            items.push({
              id: `delete:${entityId}:${recordId}`,
              label: act.label,
              icon: "trash",
              tone: "destructive"
            });
          } else if (act.type === "edit") {
            items.push({
              id: `edit:${entityId}:${recordId}`,
              label: "Edit",
              icon: "edit"
            });
          }
        }

        const rect = btn.getBoundingClientRect();
        const isMobile = state.containerWidth < 640;
        let top;
        let left;
        if (isEmbedded && root) {
          const rootRect = root.getBoundingClientRect();
          const scale = rootRect.width > 0 && root.offsetWidth > 0 ? (rootRect.width / root.offsetWidth) : 1;
          const unscaledTop = (rect.bottom - rootRect.top) / scale + (root.scrollTop || 0) + 4;
          const unscaledLeft = (rect.right - rootRect.left) / scale + (root.scrollLeft || 0) - 180;
          top = Math.round(unscaledTop);
          left = Math.round(unscaledLeft);
          const rootLogicalW = root.clientWidth || root.offsetWidth || 1200;
          const rootLogicalH = root.clientHeight || root.offsetHeight || 720;
          if (left < 10) left = 10;
          if (left + 190 > rootLogicalW) left = Math.max(10, rootLogicalW - 190);
          if (top + 200 > rootLogicalH) {
            const aboveTop = (rect.top - rootRect.top) / scale + (root.scrollTop || 0) - 190;
            top = Math.max(10, Math.round(aboveTop));
          }
        } else {
          top = Math.round(rect.bottom + 4);
          left = Math.round(rect.right - 180);
          if (left < 10) left = 10;
          if (typeof window !== "undefined" && window.innerWidth) {
            if (left + 200 > window.innerWidth) left = window.innerWidth - 210;
            if (top + 220 > window.innerHeight) top = Math.max(10, rect.top - 200);
          }
        }

        mountMenu({
          id: `drawer-overflow-${entityId}-${recordId}`,
          triggerEl: btn,
          items,
          isMobileSheet: isMobile,
          position: { top, left }
        });
      });
    });

    root.querySelectorAll("[data-open-filters]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const screen = currentScreen();
        if (screen) {
          state.drawer = {
            purpose: "filter",
            entityId: screen.resource,
            size: DRAWER_SIZE.COMPACT,
            isDirty: false,
            previousFocusedElement: document.activeElement
          };
          render();
        }
      });
    });

    root.querySelector("[data-filter-search]")?.addEventListener("input", (event) => {
      const screen = currentScreen();
      if (screen?.collection) {
        const q = queryState(screen);
        q.search = event.target.value;
        q.page = 1;
        render();
      }
    });

    root.querySelectorAll("[data-filter-select]").forEach((sel) => {
      sel.addEventListener("change", (event) => {
        const screen = currentScreen();
        if (screen?.collection) {
          const q = queryState(screen);
          q.filters[event.target.dataset.filterSelect] = event.target.value;
          q.page = 1;
          render();
        }
      });
    });

    root.querySelector("[data-filter-clear]")?.addEventListener("click", () => {
      const screen = currentScreen();
      if (screen?.collection) {
        const q = queryState(screen);
        q.search = "";
        Object.keys(q.filters).forEach((k) => { q.filters[k] = ""; });
        q.page = 1;
        render();
      }
    });

    root.querySelectorAll("[data-transition]").forEach((control) => control.addEventListener("click", () => {
      let comment = "";
      if (control.dataset.comment !== "none") {
        const response = prompt(control.dataset.comment === "required" ? "Comment required" : "Optional comment");
        if (response == null) return;
        comment = response;
      }
      try {
        if (runtime) runtime.transition(state.drawer?.entityId ?? state.detail?.entityId, state.drawer?.recordId ?? state.detail?.recordId, control.dataset.transition, { comment });
        render();
        notify("Workflow updated");
      } catch (error) {
        notify(error.message, "danger");
      }
    }));

    root.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const [entityId, recordId] = event.currentTarget.dataset.delete.split(":");
        state.confirm = { entityId, recordId };
        render();
      });
    });

    root.querySelector("[data-cancel-delete]")?.addEventListener("click", () => {
      state.confirm = null;
      render();
    });

    root.querySelector("[data-confirm-delete]")?.addEventListener("click", () => {
      const { entityId, recordId } = state.confirm;
      const screen = presentationIr.screens.find((s) => s.resource === entityId);
      const isArchive = screen.collection.lifecycle === "archive";
      try {
        if (runtime) {
          if (isArchive) runtime.archive(entityId, recordId);
          else runtime.delete(entityId, recordId);
        }
        state.confirm = null;
        state.detail = null;
        state.drawer = null;
        render();
        notify(`${screen.singular} ${isArchive ? "archived" : "deleted"}`);
      } catch (error) {
        notify(error.message, "danger");
      }
    });

    root.querySelector("[data-cancel-discard]")?.addEventListener("click", () => {
      state.confirm = null;
      render();
      root.querySelector("[data-drawer-panel]")?.querySelector("input, select, textarea, button")?.focus();
    });

    root.querySelector("[data-confirm-discard]")?.addEventListener("click", () => {
      state.confirm = null;
      closeDrawer(true);
    });

    root.querySelectorAll("[data-dismiss-discard-confirm]").forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) {
          state.confirm = null;
          render();
          root.querySelector("[data-drawer-panel]")?.querySelector("input, select, textarea, button")?.focus();
        }
      });
    });

    root.querySelector("[data-dismiss-modal]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        state.modal = null;
        render();
      }
    });

    root.querySelector("[data-close-modal]")?.addEventListener("click", () => {
      state.modal = null;
      render();
    });

    // Focus trap and keyboard listeners
    root.onkeydown = (event) => {
      if (event.key === "Escape") {
        if (state.notificationCenterOpen) {
          state.notificationCenterOpen = false;
          render();
          root.querySelector("[data-notification-bell]")?.focus();
          return;
        }
        if (state.openMenu) {
          state.openMenu = null;
          render();
          return;
        }
        if (state.confirm) {
          const isDiscard = state.confirm.type === "discard_drawer";
          state.confirm = null;
          render();
          if (isDiscard) {
            root.querySelector("[data-drawer-panel]")?.querySelector("input, select, textarea, button")?.focus();
          }
          return;
        }
        if (state.drawer) {
          closeDrawer(false);
          return;
        }
        if (state.modal) {
          state.modal = null;
          render();
          return;
        }
      }

      if (event.key === "Tab" && state.drawer) {
        const drawerPanel = root.querySelector("[data-drawer-panel]");
        if (drawerPanel) {
          const focusables = Array.from(drawerPanel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
          if (focusables.length > 0) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey) {
              if (document.activeElement === first || !drawerPanel.contains(document.activeElement)) {
                event.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last || !drawerPanel.contains(document.activeElement)) {
                event.preventDefault();
                first.focus();
              }
            }
          }
        }
      }

      if (state.openMenu && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End")) {
        const menuPanel = root.querySelector("[data-menu-panel]");
        if (menuPanel) {
          const items = Array.from(menuPanel.querySelectorAll('[role="menuitem"]:not([disabled])'));
          if (items.length > 0) {
            event.preventDefault();
            const currentIndex = items.indexOf(document.activeElement);
            if (event.key === "Home") {
              items[0].focus();
            } else if (event.key === "End") {
              items[items.length - 1].focus();
            } else if (event.key === "ArrowDown") {
              const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
              items[nextIndex].focus();
            } else if (event.key === "ArrowUp") {
              const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
              items[prevIndex].focus();
            }
          }
        }
      }
    };

    // Schedule Navigation & View Controls
    root.querySelectorAll("[data-screen-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.screenView;
        const scr = currentScreen();
        if (scr) {
          state.screenViewMode.set(scr.id, mode);
          render();
        }
      });
    });

    root.querySelectorAll("[data-schedule-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = btn.dataset.scheduleNav;
        const viewMode = state.scheduleState.viewMode;
        if (dir === "today") {
          state.scheduleState.currentDate = getZonedDateParts(options.clock ?? options.now ?? new Date(), state.scheduleState.timezone).dateString;
        } else if (dir === "prev") {
          state.scheduleState.currentDate = addDaysToDateString(state.scheduleState.currentDate, viewMode === "week" ? -7 : -1);
        } else if (dir === "next") {
          state.scheduleState.currentDate = addDaysToDateString(state.scheduleState.currentDate, viewMode === "week" ? 7 : 1);
        }
        render();
      });
    });

    root.querySelectorAll("[data-schedule-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.scheduleState.viewMode = btn.dataset.scheduleView;
        render();
      });
    });

    root.querySelector("[data-schedule-filter-group]")?.addEventListener("change", (event) => {
      state.scheduleState.selectedGroup = event.target.value;
      render();
    });

    root.querySelector("[data-schedule-linear-toggle]")?.addEventListener("click", () => {
      state.scheduleState.linearView = !state.scheduleState.linearView;
      render();
    });

    root.querySelectorAll("[data-create-slot]").forEach((slot) => {
      slot.addEventListener("click", () => {
        const [groupId, slotStart, slotEnd] = slot.dataset.createSlot.split(":");
        const scr = currentScreen();
        const groupField = scr.schedule?.groupField ?? "resource";
        const startField = scr.schedule?.startField ?? "start_at";
        const endField = scr.schedule?.endField ?? "end_at";
        state.drawer = {
          purpose: "create",
          entityId: scr.resource,
          size: DRAWER_SIZE.STANDARD,
          values: {
            [groupField]: groupId,
            [startField]: slotStart,
            [endField]: slotEnd
          },
          errors: {},
          isDirty: true,
          previousFocusedElement: document.activeElement
        };
        render();
        root.querySelector("[data-drawer-panel]")?.querySelector("input, select, textarea, button")?.focus();
      });
    });

    // 1. Auth Login Form Submission
    root.querySelector("#auth-login-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const identity = form.elements.identity?.value?.trim();
      const password = form.elements.password?.value;
      if (!identity || !password) {
        state.authState = { status: "error", message: "Please enter your identity credentials." };
        render();
        return;
      }
      state.authState = { status: "submitting", message: "" };
      render();

      const authResult = await authAdapter.authenticate(identity, password);

      if (!authResult.ok) {
        if (authResult.unverified) {
          state.authState = { status: "error", message: "Account requires verification.", email: authResult.email };
          render();
          return;
        }
        state.authState = { status: "error", message: authResult.error ?? "Invalid email or password." };
        render();
        return;
      }

      state.authState = { status: "success", message: "" };
      if (runtime) {
        runtime.principal = authResult.principal;
      }
      recompileIr();
      notify("Signed in successfully");
      const nextScreen = presentationIr.screens.find((s) => !["auth_login", "auth_register", "auth_verify", "auth_forgot_password", "auth_reset_password"].includes(s.type))?.id ?? "overview";
      navigate(nextScreen);
    });

    // 2. Auth Registration Form Submission
    root.querySelector("#auth-register-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = form.elements.name?.value?.trim();
      const identity = form.elements.identity?.value?.trim();
      const password = form.elements.password?.value;
      const confirmPassword = form.elements.confirm_password?.value;

      state.authState = { status: "submitting", message: "" };
      render();

      const result = await authAdapter.register(name, identity, password, confirmPassword);
      if (!result.ok) {
        state.authState = { status: "error", message: result.error ?? "Registration failed." };
        render();
        return;
      }

      state.authState = { status: "idle", message: "", email: result.email };
      notify("Account registered! Please verify your identity.");
      navigate("auth_verify");
    });

    // 3. Auth Verify Form Submission
    root.querySelector("#auth-verify-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const identity = form.elements.identity?.value?.trim();
      const code = form.elements.code?.value?.trim();

      state.authState = { status: "submitting", message: "" };
      render();

      const result = await authAdapter.verifyIdentity(identity, code);
      if (!result.ok) {
        state.authState = { status: "error", message: result.error ?? "Verification failed.", email: identity };
        render();
        return;
      }

      state.authState = { status: "idle", message: "", email: "" };
      notify("Identity verified successfully! You can now sign in.");
      navigate("auth_login");
    });

    // 4. Auth Forgot Password Form Submission
    root.querySelector("#auth-forgot-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const identity = form.elements.identity?.value?.trim();

      state.authState = { status: "submitting", message: "" };
      render();

      const result = await authAdapter.requestPasswordReset(identity);
      state.authState = {
        status: "info",
        message: result.message,
        demoToken: result.demoResetToken ?? ""
      };
      render();
    });

    // 5. Auth Reset Password Form Submission
    root.querySelector("#auth-reset-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const token = form.elements.token?.value?.trim();
      const password = form.elements.password?.value;
      const confirmPassword = form.elements.confirm_password?.value;

      state.authState = { status: "submitting", message: "" };
      render();

      const result = await authAdapter.resetPassword(token, password, confirmPassword);
      if (!result.ok) {
        state.authState = { status: "error", message: result.error ?? "Password reset failed.", demoToken: token };
        render();
        return;
      }

      state.authState = { status: "idle", message: "", demoToken: "" };
      notify("Password reset successfully. Please sign in.");
      navigate("auth_login");
    });

    // 6. Profile Edit Form Submission
    root.querySelector("#profile-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = form.elements.name?.value?.trim();
      const principal = runtime?.principal;
      if (!principal?.id) return;

      const result = await authAdapter.updateProfile(principal.id, { name });
      if (!result.ok) {
        notify(result.error ?? "Failed to update profile", "danger");
        return;
      }

      // If runtime has a users resource record, also sync it
      if (runtime?.entities?.has("users") && runtime.records("users").some((u) => u.id === principal.id)) {
        try { runtime.update("users", principal.id, { name }); } catch (_) {}
      }

      notify("Profile updated successfully");
      render();
    });

    // 7. Security: Change Password Form Submission
    root.querySelector("#change-password-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const currentPassword = form.elements.current_password?.value;
      const newPassword = form.elements.new_password?.value;
      const confirmPassword = form.elements.confirm_password?.value;
      const principal = runtime?.principal;
      if (!principal?.id) return;

      const result = await authAdapter.changePassword(principal.id, currentPassword, newPassword, confirmPassword);
      if (!result.ok) {
        notify(result.error ?? "Password change failed", "danger");
        return;
      }

      form.reset();
      notify("Password changed successfully");
    });

    // 8. Security: Revoke Session
    root.querySelectorAll("[data-revoke-session]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const sessionId = btn.dataset.revokeSession;
        await authAdapter.revokeSession(sessionId);
        notify("Session revoked");
        render();
      });
    });

    // 9. Security: Revoke All Other Sessions
    root.querySelector("[data-revoke-others]")?.addEventListener("click", async () => {
      const principal = runtime?.principal;
      if (!principal?.id) return;
      await authAdapter.revokeOtherSessions(principal.id);
      notify("All other sessions revoked");
      render();
    });

    // 10. Admin: Toggle User Active
    root.querySelectorAll("[data-admin-toggle-active]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const targetUserId = btn.dataset.adminToggleActive;
        const user = authAdapter.users?.find((u) => u.id === targetUserId);
        if (!user) return;
        const result = await authAdapter.adminUpdateUser(runtime?.principal, targetUserId, { active: !user.active });
        if (!result.ok) {
          notify(result.error ?? "Unauthorized", "danger");
          return;
        }
        notify(`User ${user.name} ${result.user.active ? "activated" : "deactivated"}`);
        render();
      });
    });

    // 11. Admin: Change User Role
    root.querySelectorAll("[data-admin-role]").forEach((select) => {
      select.addEventListener("change", async (event) => {
        const targetUserId = event.target.dataset.adminRole;
        const newRole = event.target.value;
        const result = await authAdapter.adminUpdateUser(runtime?.principal, targetUserId, { roles: [newRole] });
        if (!result.ok) {
          notify(result.error ?? "Unauthorized", "danger");
          render();
          return;
        }
        notify(`User role updated to ${newRole}`);
        render();
      });
    });

    // 12. Standard Resource Record Form Submission
    root.querySelector("#record-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const entityId = form.dataset.entity;
      const recordId = form.dataset.record;
      const screen = presentationIr.screens.find((s) => s.resource === entityId);
      const formData = new FormData(form);
      const values = Object.fromEntries(screen.editor.fields.filter((f) => !f.readOnly && form.elements.namedItem(f.id)).map((f) => [f.id, f.type === "bool" ? formData.has(f.id) : formData.get(f.id) ?? ""]));
      try {
        if (runtime) {
          if (recordId) {
            runtime.update(entityId, recordId, values);
            notify(`${screen.singular} updated`);
          } else {
            runtime.create(entityId, values);
            notify(`${screen.singular} created`);
          }
        }
        state.modal = null;
        render();
      } catch (error) {
        state.modal.errors = error.fieldErrors ?? {};
        render();
      }
    });

    const screen = currentScreen();
    if (screen?.collection) {
      const query = queryState(screen);
      root.querySelector("[data-search]")?.addEventListener("input", (event) => { query.search = event.target.value; query.page = 1; render(); });
      root.querySelectorAll("[data-filter]").forEach((select) => select.addEventListener("change", (event) => { query.filters[event.target.dataset.filter] = event.target.value; query.page = 1; render(); }));
      root.querySelector("[data-sort]")?.addEventListener("change", (event) => { query.sort = event.target.value; render(); });
      root.querySelector("[data-clear-filters]")?.addEventListener("click", () => { query.search = ""; Object.keys(query.filters).forEach((key) => { query.filters[key] = ""; }); render(); });
      root.querySelectorAll("[data-page]").forEach((btn) => btn.addEventListener("click", () => { query.page = Number(btn.dataset.page); render(); }));
    }

    // Mobile navigation toggle & drawer
    root.querySelector("[data-mobile-nav-toggle]")?.addEventListener("click", () => {
      state.mobileMenuOpen = !state.mobileMenuOpen;
      render();
    });

    // Data Visualization View Toggle (Chart vs Exact Accessible Data Table)
    root.querySelectorAll("[data-viz-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const vizId = btn.dataset.vizToggle;
        const stage = root.querySelector(`#viz-stage-${vizId}`);
        const table = root.querySelector(`#viz-table-${vizId}`);
        if (stage && table) {
          const isTableVisible = !table.classList.contains("hidden");
          if (isTableVisible) {
            table.classList.add("hidden");
            stage.classList.remove("hidden");
            btn.setAttribute("aria-expanded", "false");
          } else {
            table.classList.remove("hidden");
            stage.classList.add("hidden");
            btn.setAttribute("aria-expanded", "true");
          }
        }
      });
    });

    root.querySelectorAll("[data-close-mobile-nav]").forEach((link) => {
      link.addEventListener("click", () => {
        state.mobileMenuOpen = false;
        render();
      });
    });

    // Interactive compiler showcase stage switcher
    root.querySelectorAll("[data-compiler-step]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const step = Number(btn.dataset.compilerStep);
        if (Number.isFinite(step) && step >= 1) {
          state.compilerStep = step;
          render();
        }
      });
    });

    // Motion spotlight pointer follow
    root.querySelectorAll(".motion-spotlight").forEach((spotlight) => {
      spotlight.addEventListener("pointermove", (event) => {
        if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return;
        }
        const rect = spotlight.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        spotlight.style.setProperty("--pointer-x", `${x}px`);
        spotlight.style.setProperty("--pointer-y", `${y}px`);
      });
    });

    // Notification Center Event Handlers
    root.querySelectorAll("[data-notification-bell]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.notificationCenterOpen = !state.notificationCenterOpen;
        render();
        if (state.notificationCenterOpen) {
          root.querySelector("[data-notification-sheet], [data-notification-popover]")?.focus();
        }
      });
    });

    root.querySelectorAll("[data-close-notifications]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.notificationCenterOpen = false;
        render();
      });
    });

    root.querySelectorAll("[data-dismiss-notifications]").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          state.notificationCenterOpen = false;
          render();
        }
      });
    });

    root.querySelectorAll("[data-mark-all-read]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (runtime) {
          runtime.markAllNotificationsAsRead();
          render();
        }
      });
    });

    root.querySelectorAll("[data-toggle-read]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.toggleRead;
        if (runtime && id) {
          runtime.markNotificationAsRead(id);
          render();
        }
      });
    });

    root.querySelectorAll("[data-dismiss-notif]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.dismissNotif;
        if (runtime && id) {
          runtime.dismissNotification(id);
          render();
        }
      });
    });

    root.querySelectorAll("[data-notification-card]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const id = card.dataset.notificationId;
        const resource = card.dataset.resource;
        const recordId = card.dataset.record;
        if (runtime && id) {
          runtime.markNotificationAsRead(id);
        }
        state.notificationCenterOpen = false;
        if (resource && recordId) {
          state.drawer = {
            purpose: "detail",
            entityId: resource,
            recordId: recordId,
            size: DRAWER_SIZE.STANDARD,
            status: "open",
            previousFocusedElement: card
          };
        }
        render();
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  // Container capability detection & real-time recomposition via ResizeObserver
  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined" && root) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.round(entry.contentRect.width || root.clientWidth || window.innerWidth || 1024);
        if (width > 0 && Math.abs(width - state.containerWidth) >= 16) {
          state.containerWidth = width;
          render();
        }
      }
    });
    resizeObserver.observe(root);
  }

  // Reactive subscription: Automatically re-render on semantic runtime mutations
  let unsubscribe = null;
  if (runtime && typeof runtime.subscribe === "function") {
    unsubscribe = runtime.subscribe((_event) => {
      render();
    });
  }

  render();
  return {
    navigate,
    render,
    authAdapter,
    state,
    runtime,
    model: options.model ?? null,
    presentationIr,
    records(resourceId) { return runtime?.records(resourceId) ?? []; },
    get(resourceId, id) { return runtime?.get(resourceId, id) ?? null; },
    update(resourceId, id, values) { return runtime?.update(resourceId, id, values); },
    create(resourceId, values) { return runtime?.create(resourceId, values); },
    setContainerWidth(width) {
      state.containerWidth = width;
      render();
    },
    destroy() {
      if (unsubscribe) unsubscribe();
      if (resizeObserver) resizeObserver.disconnect();
      if (state.toastTimer) clearTimeout(state.toastTimer);
    },
    dispose() {
      if (unsubscribe) unsubscribe();
      if (resizeObserver) resizeObserver.disconnect();
      if (state.toastTimer) clearTimeout(state.toastTimer);
      if (root) {
        root.innerHTML = "";
        root.classList.remove("app-host-embedded");
      }
    }
  };
}

/**
 * Mounts an AIR app by compiling AIR -> Semantic Model -> Presentation Compiler -> Presentation IR -> Web Renderer.
 */
export function mountAirApp(root, source, options = {}) {
  let model;
  let runtime;
  let presentationIr;
  try {
    model = parseAir(source);
    const seedData = parseSeedData(options.seedSource ?? {}, model);
    runtime = new AppRuntime(model, {
      storage: options.storage,
      seedData,
      principal: options.principal,
      namespace: options.namespace
    });
    presentationIr = compilePresentation(model, { principal: options.principal, runtime });
    return renderPresentation(root, presentationIr, runtime, { ...options, model });
  } catch (error) {
    renderFatalError(root, error, {
      onRetry: options.onRetry ?? (() => mountAirApp(root, source, options)),
      ...options
    });
    return null;
  }
}
