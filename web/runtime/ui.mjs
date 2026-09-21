import { AirError, AppRuntime, parseAir, parseSeedData } from "./air.mjs";
import { compilePresentation } from "./presentation.mjs";
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
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
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

function themePreference(theme) {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("air:theme");
    if (saved === "light" || saved === "dark") return saved;
  }
  if (theme?.mode && theme.mode !== "system") return theme.mode;
  if (typeof matchMedia !== "undefined") {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function renderFatalError(root, error) {
  root.removeAttribute("aria-busy");
  let userError = null;
  if (error && typeof error.toUserError === "function") {
    userError = error.toUserError();
  } else if (error && error.name === "OperationalError") {
    userError = {
      title: error.safeUserTitle || "Application Unavailable",
      message: error.safeUserMessage || "The application encountered an operational error.",
      reference: error.requestId || error.incidentId || `ref_${Date.now()}`
    };
  } else {
    const rawMsg = error?.message ?? String(error);
    const is404 = rawMsg.includes("404") || rawMsg.includes("not found");
    userError = {
      title: is404 ? "Application Unavailable" : "Application Error",
      message: is404 ? "The application definition could not be loaded." : "This application could not start.",
      reference: `ref_${Date.now().toString(36)}`
    };
  }

  root.innerHTML = `<main class="fatal"><div class="fatal-mark">!</div><p class="eyebrow">AIR Service State</p><h1>${escapeHtml(userError.title)}</h1><p>${escapeHtml(userError.message)}</p><p class="meta" style="font-size: 0.85em; opacity: 0.75;">Reference: <code>${escapeHtml(userError.reference)}</code></p><button class="button secondary" onclick="location.reload()">Try again</button></main>`;
}

/**
 * Pure Presentation IR Renderer Entry Point.
 * Renders HTML/DOM directly from Presentation IR v1 and the runtime.
 * Contains ZERO resource/domain-specific branches.
 */
export function renderPresentation(root, initialPresentationIr, runtime, options = {}) {
  let presentationIr = initialPresentationIr;
  const authAdapter = options.authAdapter ?? new DemoAuthAdapter();

  const state = {
    screenId: options.initialScreen ?? presentationIr.app.initialScreen,
    detail: null,
    modal: null,
    confirm: null,
    theme: themePreference(presentationIr.theme),
    queries: new Map(),
    toastTimer: null,
    authState: { status: "idle", message: "", email: "", demoToken: "" }
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
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.accent = presentationIr.theme.accent;
    document.documentElement.dataset.density = presentationIr.theme.density;
    document.documentElement.style.colorScheme = state.theme;
  }

  function recompileIr() {
    if (options.model) {
      presentationIr = compilePresentation(options.model, { principal: runtime?.principal, runtime });
    }
  }

  function navigate(screenId) {
    state.screenId = screenId;
    state.detail = null;
    state.modal = null;
    state.confirm = null;
    if (typeof history !== "undefined" && typeof location !== "undefined") {
      history.replaceState(null, "", `${location.pathname}?demo=${encodeURIComponent(options.demo ?? "demo")}#${screenId}`);
    }
    render();
    if (typeof document !== "undefined") {
      document.querySelector(".content")?.focus({ preventScroll: true });
    }
  }

  function notify(message, tone = "success") {
    if (typeof document === "undefined") return;
    const host = document.querySelector("#air-toast");
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
    const field = screen.editor?.fields?.find((f) => f.id === fieldId);
    const display = runtime ? runtime.displayValue(screen.resource, fieldId, value) : String(value ?? "");
    if (field?.type === "enum") return `<span class="badge ${statusTone(value)}"><span></span>${escapeHtml(displayStatus(display))}</span>`;
    if (field?.id === screen.labelField && !compact) {
      return `<span class="identity"><span class="avatar">${escapeHtml(initials(display))}</span><strong>${escapeHtml(display)}</strong></span>`;
    }
    return `<span>${escapeHtml(display)}</span>`;
  }

  function renderTable(screen, columns, records, interactive = true) {
    if (!records || records.length === 0) return "";
    const head = columns.map((fieldId) => {
      const field = screen.editor?.fields?.find((f) => f.id === fieldId);
      return `<th scope="col">${escapeHtml(field?.label ?? titleCase(fieldId))}</th>`;
    }).join("");
    const rows = records.map((record) => {
      const tone = runtime ? runtime.highlight(screen.resource, record) : null;
      return `
      <tr class="${tone ? `highlight-${escapeHtml(tone)}` : ""}" ${interactive ? `tabindex="0" data-detail="${escapeHtml(screen.resource)}:${escapeHtml(record.id)}"` : ""}>
        ${columns.map((fieldId) => `<td data-label="${escapeHtml(screen.editor?.fields?.find(f => f.id === fieldId)?.label ?? titleCase(fieldId))}">${valueMarkup(screen, fieldId, record[fieldId])}</td>`).join("")}
        ${interactive ? `<td class="row-arrow" aria-label="View record">${icon("chevron", 16)}</td>` : ""}
      </tr>`;
    }).join("");
    return `<div class="table-wrap"><table><thead><tr>${head}${interactive ? '<th class="row-arrow"><span class="sr-only">Actions</span></th>' : ""}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderDashboard(screen) {
    const metricsSection = screen.sections?.find((s) => s.type === "metrics_grid");
    const recentSection = screen.sections?.find((s) => s.type === "recent_activity");

    const metrics = (metricsSection?.metrics ?? []).map((metric) => `
      <article class="metric-card tone-${escapeHtml(metric.tone)}">
        <div class="metric-icon">${icon("dashboard")}</div>
        <p>${escapeHtml(metric.label)}</p>
        <strong>${escapeHtml(runtime ? runtime.formatMetric(metric, runtime.metric(metric)) : "0")}</strong>
        <span>Live from ${escapeHtml(metric.source)}</span>
      </article>`).join("");

    const lists = (recentSection?.lists ?? []).map((list) => {
      const targetScreen = presentationIr.screens.find((s) => s.resource === list.source);
      const result = runtime ? runtime.query(list.source, { sort: targetScreen?.collection?.sortChoices?.[0], limit: list.limit, paginate: false }) : { records: [] };
      return `<section class="panel recent-panel">
        <div class="panel-heading"><div><p class="eyebrow">Latest activity</p><h2>${escapeHtml(list.title)}</h2></div><button class="text-button" data-nav="${escapeHtml(targetScreen?.id ?? state.screenId)}">View all ${icon("chevron", 14)}</button></div>
        ${result.records.length ? renderTable(targetScreen, list.columns, result.records) : `<div class="empty-state"><div>${icon("collection", 26)}</div><h3>No records yet</h3></div>`}
      </section>`;
    }).join("");

    return `<div class="page-heading"><div><p class="eyebrow">Workspace</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div><span class="date-chip">${new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</span></div>
      <section class="metric-grid" aria-label="Key metrics">${metrics}</section>${lists}`;
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

    return `<div class="page-heading collection-heading"><div><p class="eyebrow">${escapeHtml(screen.title)}</p><h1>${escapeHtml(screen.title)}</h1><p>Manage ${escapeHtml(screen.title.toLowerCase())}</p></div>${createButton}</div>
      <section class="panel collection-panel">
        <div class="toolbar">
          <label class="search-control">${icon("search", 17)}<span class="sr-only">Search ${escapeHtml(screen.title)}</span><input type="search" data-search placeholder="Search ${escapeHtml(screen.title.toLowerCase())}…" value="${escapeHtml(query.search)}"></label>
          <div class="toolbar-actions">${filters}<label class="select-control sort-control">${icon("sort", 15)}<span class="sr-only">Sort</span><select data-sort>${sortOptions}</select></label></div>
        </div>
        <div class="result-meta"><span><strong>${result.total}</strong> ${result.total === 1 ? screen.singular.toLowerCase() : screen.title.toLowerCase()}</span>${hasActiveFilters ? '<button class="text-button" data-clear-filters>Clear filters</button>' : ""}</div>
        ${result.records.length ? renderTable(screen, screen.collection.columns, result.records) : `<div class="empty-state"><div>${icon(hasActiveFilters ? "search" : screen.icon, 26)}</div><h3>${escapeHtml(emptyStateInfo.title)}</h3><p>${escapeHtml(emptyStateInfo.message)}</p></div>`}
        <div class="pagination"><span>${from}–${to} of ${result.total}</span><div><button class="icon-button" data-page="${result.page - 1}" ${result.page <= 1 ? "disabled" : ""} aria-label="Previous page">${icon("back", 16)}</button><span>Page ${result.page} of ${result.totalPages}</span><button class="icon-button next" data-page="${result.page + 1}" ${result.page >= result.totalPages ? "disabled" : ""} aria-label="Next page">${icon("chevron", 16)}</button></div></div>
      </section>`;
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

    return `<div class="page-heading"><div><p class="eyebrow">Tasks</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div></div>
      <section class="panel inbox-panel"><ol class="inbox-list" aria-label="Pending review items">${itemsMarkup}</ol></section>`;
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

    return `<div class="page-heading">
      <div><p class="eyebrow">Account</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div>
    </div>
    <div class="panel-grid">
      <section class="panel">
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

    return `<div class="page-heading">
      <div><p class="eyebrow">Account</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div>
    </div>
    <div class="panel-grid">
      <section class="panel">
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

      <section class="panel">
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

    return `<div class="page-heading">
      <div><p class="eyebrow">Administration</p><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p></div>
    </div>
    <section class="panel">
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
    </section>`;
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
    const historyMarkup = history.length ? `<section class="panel history-panel"><div class="panel-heading"><div><p class="eyebrow">Immutable history</p><h2>Workflow decisions</h2></div></div><ol>${history.map((entry) => `<li><strong>${escapeHtml(displayStatus(entry.event))}</strong><span>${escapeHtml(entry.actor?.id ?? "system")} · ${escapeHtml(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.at)))}</span>${entry.comment ? `<p>${escapeHtml(entry.comment)}</p>` : ""}${!entry.completed ? '<small>Awaiting additional approval</small>' : ""}</li>`).join("")}</ol></section>` : "";
    
    return `<button class="back-button" data-close-detail>${icon("back", 16)} Back to ${escapeHtml(screen.title)}</button>
      <div class="detail-hero"><div class="detail-identity"><span class="avatar large">${escapeHtml(initials(title))}</span><div><p class="eyebrow">${escapeHtml(screen.singular)} profile</p><h1>${escapeHtml(title)}</h1><span class="record-id">${escapeHtml(record.id)}</span></div></div><div class="detail-actions">${workflowActions}${editButton}${deleteButton}</div></div>
      <section class="panel detail-panel"><div class="panel-heading"><div><p class="eyebrow">Record details</p><h2>Information</h2></div></div><dl>${screen.editor.fields.map((field) => `<div><dt>${escapeHtml(field.label)}</dt><dd>${valueMarkup(screen, field.id, record[field.id], true)}</dd></div>`).join("")}</dl></section>${historyMarkup}`;
  }

  function renderPage() {
    if (state.detail) return renderDetail();
    const screen = currentScreen();
    if (!screen) return `<div class="panel"><h2>Page not found</h2></div>`;
    if (screen.type === "auth_login") return renderAuthLogin(screen);
    if (screen.type === "auth_register") return renderAuthRegister(screen);
    if (screen.type === "auth_verify") return renderAuthVerify(screen);
    if (screen.type === "auth_forgot_password") return renderAuthForgotPassword(screen);
    if (screen.type === "auth_reset_password") return renderAuthResetPassword(screen);
    if (screen.type === "account_profile") return renderAccountProfile(screen);
    if (screen.type === "account_security") return renderAccountSecurity(screen);
    if (screen.type === "user_management") return renderUserManagement(screen);
    if (screen.type === "dashboard") return renderDashboard(screen);
    if (screen.type === "resource_management") return renderCollection(screen);
    if (screen.type === "workflow_inbox") return renderWorkflowInbox(screen);
    return `<div class="panel"><h2>Screen ${escapeHtml(screen.title)}</h2></div>`;
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
      const type = field.type === "phone" ? "tel" : field.type === "money" ? "number" : ["email", "date", "number"].includes(field.type) ? field.type : "text";
      control = `<input ${common} type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder)}" ${field.min ? `minlength="${field.min}"` : ""} ${field.type === "money" ? 'step="0.01"' : ""}>`;
    }
    return `<label class="field ${field.type === "text" && field.long ? "span-2" : ""}" for="${id}"><span>${escapeHtml(field.label)}${field.required ? '<i aria-hidden="true">*</i>' : ""}</span>${control}${error ? `<small class="field-error" id="${id}-error">${escapeHtml(error)}</small>` : ""}</label>`;
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

    return `<div class="modal-backdrop" data-dismiss-modal><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel>
      <div class="modal-heading"><div><p class="eyebrow">${editing ? "Update record" : "New record"}</p><h2 id="modal-title">${editing ? `Edit ${escapeHtml(screen.singular)}` : `Add ${escapeHtml(screen.singular)}`}</h2></div><button class="icon-button" data-close-modal aria-label="Close">${icon("close", 18)}</button></div>
      <form id="record-form" data-entity="${escapeHtml(screen.resource)}" data-record="${escapeHtml(state.modal.recordId ?? "")}" novalidate>
        <div class="form-grid">${fields.map((field) => inputFor(screen, field, values[field.id] ?? field.defaultValue ?? "", state.modal.errors?.[field.id])).join("")}</div>
        <div class="modal-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button type="submit" class="button primary">${editing ? "Save changes" : `Create ${escapeHtml(screen.singular)}`}</button></div>
      </form>
    </section></div>`;
  }

  function renderConfirm() {
    if (!state.confirm) return "";
    const screen = presentationIr.screens.find((s) => s.resource === state.confirm.entityId);
    const record = runtime ? runtime.records(screen.resource).find((item) => item.id === state.confirm.recordId) : null;
    const label = record?.[screen.labelField] ?? record?.id;
    const isArchive = screen.collection.lifecycle === "archive";
    const verb = isArchive ? "Archive" : "Delete";
    const consequence = isArchive ? "It will leave active views but remain stored." : "This action cannot be undone.";
    return `<div class="modal-backdrop"><section class="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><div class="danger-icon">${icon("trash", 22)}</div><h2 id="confirm-title">${verb} ${escapeHtml(screen.singular.toLowerCase())}?</h2><p><strong>${escapeHtml(label)}</strong> will be ${isArchive ? "archived" : "permanently removed"}. ${consequence}</p><div class="modal-actions"><button class="button secondary" data-cancel-delete>Cancel</button><button class="button danger" data-confirm-delete>${verb} ${escapeHtml(screen.singular.toLowerCase())}</button></div></section></div>`;
  }

  function render() {
    applyTheme();
    root.removeAttribute("aria-busy");
    const isAuthScreen = ["auth_login", "auth_register", "auth_verify", "auth_forgot_password", "auth_reset_password"].includes(currentScreen()?.type);
    if (isAuthScreen) {
      root.innerHTML = `<main class="content auth-content" tabindex="-1">${renderPage()}</main><div id="air-toast" class="toast" role="status" aria-live="polite"></div>`;
    } else {
      const principal = runtime?.principal;
      const isAuthenticated = Boolean(principal && (principal.id || (principal.roles && principal.roles.length > 0)));
      const currentUser = authAdapter.users?.find((u) => u.id === principal?.id);
      root.innerHTML = `<div class="app-shell">
        <aside class="sidebar">
          <div class="brand"><span class="brand-mark">${icon("spark", 20)}</span><div><strong>${escapeHtml(presentationIr.app.title)}</strong><small>AIR native</small></div></div>
          ${isAuthenticated ? `
            <div class="sidebar-user-chip" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 0.75rem;">
              <span class="avatar">${escapeHtml(initials(currentUser?.name ?? principal?.id ?? principal?.roles?.[0] ?? "U"))}</span>
              <div style="flex: 1; min-width: 0;">
                <strong style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem;">${escapeHtml(currentUser?.name ?? principal?.id ?? "Authenticated User")}</strong>
                <small style="color: var(--muted); font-size: 0.75rem;">${escapeHtml(principal?.roles?.join(", ") ?? "user")}</small>
              </div>
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
        <header class="mobile-header">
          <div class="brand"><span class="brand-mark">${icon("spark", 18)}</span><strong>${escapeHtml(presentationIr.app.title)}</strong></div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${isAuthenticated ? `<button class="icon-button logout-button" data-logout aria-label="Sign out" title="Sign out">${icon("close", 18)}</button>` : ""}
            <button class="icon-button" data-theme-toggle aria-label="Toggle theme">${icon(state.theme === "dark" ? "sun" : "moon", 18)}</button>
          </div>
        </header>
        <main class="content" tabindex="-1">${renderPage()}</main>
        <nav class="mobile-nav" aria-label="Primary navigation">${renderNav()}</nav>
      </div><div id="air-toast" class="toast" role="status" aria-live="polite"></div>${renderModal()}${renderConfirm()}`;
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
      render();
      notify("Demo data restored");
    });

    root.querySelector("[data-create]")?.addEventListener("click", (event) => {
      state.modal = { entityId: event.currentTarget.dataset.create, errors: {} };
      render();
    });

    root.querySelectorAll("[data-detail]").forEach((row) => {
      const open = () => {
        const [entityId, recordId] = row.dataset.detail.split(":");
        state.detail = { entityId, recordId };
        render();
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });

    root.querySelector("[data-close-detail]")?.addEventListener("click", () => {
      state.detail = null;
      render();
    });

    root.querySelector("[data-edit]")?.addEventListener("click", (event) => {
      const [entityId, recordId] = event.currentTarget.dataset.edit.split(":");
      state.modal = { entityId, recordId, errors: {} };
      render();
    });

    root.querySelectorAll("[data-transition]").forEach((control) => control.addEventListener("click", () => {
      let comment = "";
      if (control.dataset.comment !== "none") {
        const response = prompt(control.dataset.comment === "required" ? "Comment required" : "Optional comment");
        if (response == null) return;
        comment = response;
      }
      try {
        if (runtime) runtime.transition(state.detail.entityId, state.detail.recordId, control.dataset.transition, { comment });
        render();
        notify("Workflow updated");
      } catch (error) {
        notify(error.message, "danger");
      }
    }));

    root.querySelector("[data-delete]")?.addEventListener("click", (event) => {
      const [entityId, recordId] = event.currentTarget.dataset.delete.split(":");
      state.confirm = { entityId, recordId };
      render();
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
        render();
        notify(`${screen.singular} ${isArchive ? "archived" : "deleted"}`);
      } catch (error) {
        notify(error.message, "danger");
      }
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
  }

  render();
  return {
    navigate,
    render,
    authAdapter
  };
}

/**
 * Legacy wrapper: mounts an AIR app by compiling AIR -> Semantic Model -> Presentation Compiler -> Presentation IR -> Web Renderer.
 */
export function mountAirApp(root, source, options = {}) {
  let model;
  let runtime;
  let presentationIr;
  try {
    model = parseAir(source);
    const seedData = parseSeedData(options.seedSource ?? {}, model);
    runtime = new AppRuntime(model, { storage: options.storage, seedData, principal: options.principal });
    presentationIr = compilePresentation(model, { principal: options.principal, runtime });
  } catch (error) {
    renderFatalError(root, error);
    return null;
  }

  return renderPresentation(root, presentationIr, runtime, { ...options, model });
}
