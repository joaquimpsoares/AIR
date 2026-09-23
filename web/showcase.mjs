/**
 * AIR Showcase & Benchmarks Interactive Controller
 *
 * Implements:
 * - Decoupled Source / Preview Execution (Last-Known-Good Preview on invalid edit)
 * - Transactional Preview Swapping
 * - Blank Project Mode & Start from Scratch Workflow
 * - Viewport-Fitted IDE Workspace & Focus Modes (Split, Code Focus, App Focus)
 * - Deterministic Generic Explain Engine (Zero runtime LLM)
 * - In-App Documentation Reader & Benchmark Explorer
 */

import { mountAirApp, renderFatalError } from "./runtime/ui.mjs";
import { parseAir } from "./runtime/air.mjs";
import { compilePresentation } from "./runtime/presentation.mjs";

const EXAMPLES = {
  "customer-manager": {
    title: "Customer Manager",
    tagline: "30-second introduction to AIR resources, validation, and CRUD UI",
    airPath: "../showcase/customer-manager/app.air",
    seedPath: "../showcase/customer-manager/seed.json",
    metaPath: "../showcase/customer-manager/example.json",
    principal: { roles: ["admin"] },
    tags: ["CRUD", "Validation", "Unique Email", "Search & Filter", "Responsive Cards", "Edit Drawer"]
  },
  "approval-workflow": {
    title: "Approval Workflow",
    tagline: "State machines, authority guards, separation-of-duty, and audit history",
    airPath: "../showcase/approval-workflow/app.air",
    seedPath: "../showcase/approval-workflow/seed.json",
    metaPath: "../showcase/approval-workflow/example.json",
    principal: { actor: "users", id: "u_02", roles: ["manager"] },
    tags: ["Process", "Guarded Transitions", "Role Authority", "Separation of Duty", "Audit Timeline"]
  },
  "reservation-hub": {
    title: "Reservation Hub",
    tagline: "Temporal interval semantics, conflict prevention, and exact money rates",
    airPath: "../showcase/reservation-hub/app.air",
    seedPath: "../showcase/reservation-hub/seed.json",
    metaPath: "../showcase/reservation-hub/example.json",
    principal: { roles: ["admin", "operator"] },
    tags: ["Intervals", "Non-Overlap Invariants", "Money Rates (USD/h)", "Computed Quotes", "Calendar Agenda"]
  },
  "inventory-hub": {
    title: "Inventory Hub",
    tagline: "Exact integer inventory, computed totals, workflows, and edge-triggered notifications",
    airPath: "../showcase/inventory-hub/app.air",
    seedPath: "../showcase/inventory-hub/seed.json",
    metaPath: "../showcase/inventory-hub/example.json",
    principal: { roles: ["admin", "operator"] },
    tags: ["Integer Stock", "Line Items", "Computed Totals", "Edge Notifications", "Bell Center"]
  },
  "blank": {
    title: "Blank Playground",
    tagline: "Start with a clean sheet or insert a minimal application starter",
    airPath: null,
    seedPath: null,
    metaPath: null,
    principal: { roles: ["admin"] },
    tags: ["Playground", "Clean Sheet", "Live Editing", "Zero AI Runtime"]
  }
};

const BUILTIN_EXAMPLES = {
  "customer-manager": {
    air: `air version=2
app customer_manager title="Customer Manager" subtitle="Instant CRM with search, validation, and status lifecycle" initial=overview
theme mode=dark accent=violet
capability storage.local

resource customers label=name
field customers.name text required min=2
field customers.email email required unique
field customers.company text
field customers.status enum values=Active,Trial,Inactive required default=Trial
field customers.joined date required default=today
field customers.notes text long

manage customers lifecycle=archive
access customers view=role:admin|role:user edit=role:admin|role:user

overview
insight customers.total op=count field=name label="Total Customers"
`,
    seed: {
      "customers": [
        { "id": "cust_001", "name": "Acme Industrial Corp", "email": "contact@acme.corp", "company": "Acme Corp", "status": "Active", "joined": "2026-01-15", "notes": "Key enterprise customer with dedicated SLA." },
        { "id": "cust_002", "name": "Globex Robotics", "email": "operations@globex.io", "company": "Globex", "status": "Trial", "joined": "2026-03-01", "notes": "Piloting warehouse automation module." },
        { "id": "cust_003", "name": "Initech Systems", "email": "billing@initech.com", "company": "Initech", "status": "Active", "joined": "2025-11-20", "notes": "Upgraded from quarterly to annual contract." },
        { "id": "cust_004", "name": "Umbrella Laboratories", "email": "procurement@umbrella.org", "company": "Umbrella", "status": "Inactive", "joined": "2025-08-10", "notes": "Account on hold pending compliance audit." },
        { "id": "cust_005", "name": "Soylent Logistics", "email": "support@soylent.net", "company": "Soylent", "status": "Trial", "joined": "2026-02-28", "notes": "Evaluating multi-warehouse distribution." }
      ]
    }
  },
  "approval-workflow": {
    air: `air version=2
app approval_workflow title="Expense Approval" subtitle="Guarded state transitions, authority policies, and audit timeline" initial=overview
theme mode=dark accent=blue
capability storage.local

resource users label=name
field users.name text required
field users.email email required unique
field users.role enum values=employee,manager,finance required default=employee
actor users
manage users create=admin edit=admin
access users view=role:admin|self edit=role:admin

resource expenses label=description
field expenses.description text required min=3
field expenses.amount money currency=USD required default=0
field expenses.category enum values=Travel,Meals,Equipment,Software required default=Travel
field expenses.submitter ref=users required
field expenses.status enum values=Draft,Submitted,Approved,Rejected required default=Draft
field expenses.created_at date required default=today
field expenses.updated_at date required default=today

manage expenses lifecycle=archive
access expenses view=role:manager|role:finance|owner:submitter edit=role:manager|owner:submitter

process expenses state=status initial=Draft terminal=Approved,Rejected history touch=updated_at
transition expenses.submit from=Draft to=Submitted action=submit by=owner:submitter event=submitted
transition expenses.approve from=Submitted to=Approved action=approve by=role:manager separate=submitter event=approved
transition expenses.reject from=Submitted to=Rejected action=reject by=role:manager separate=submitter comment=required event=rejected

highlight expenses.submitted when="status==Submitted" tone=warning
highlight expenses.approved when="status==Approved" tone=positive
highlight expenses.rejected when="status==Rejected" tone=danger

overview
insight expenses.total op=sum field=amount label="Total Expenses"
`,
    seed: {
      "users": [
        { "id": "u_01", "name": "Elena Rostova", "email": "elena@company.com", "role": "employee" },
        { "id": "u_02", "name": "Marcus Vance", "email": "marcus@company.com", "role": "manager" },
        { "id": "u_03", "name": "Sarah Chen", "email": "sarah@company.com", "role": "finance" }
      ],
      "expenses": [
        { "id": "exp_001", "description": "Flight to Tokyo Conference", "amount": 1450.00, "category": "Travel", "submitter": "u_01", "status": "Submitted", "created_at": "2026-03-10", "updated_at": "2026-03-10" },
        { "id": "exp_002", "description": "Ergonomic Office Chair", "amount": 380.00, "category": "Equipment", "submitter": "u_01", "status": "Approved", "created_at": "2026-03-05", "updated_at": "2026-03-06" },
        { "id": "exp_003", "description": "Team Dinner with Clients", "amount": 240.00, "category": "Meals", "submitter": "u_01", "status": "Draft", "created_at": "2026-03-12", "updated_at": "2026-03-12" }
      ]
    }
  },
  "reservation-hub": {
    air: `air version=2
app reservation_hub title="Reservation Hub" subtitle="Resource scheduling, interval conflict prevention, and dynamic rates" initial=overview timezone="UTC"
theme mode=dark accent=violet
capability storage.local

resource locations label=name
field locations.name text required min=2
field locations.timezone text required default="UTC"
field locations.status enum values=Active,Inactive required default=Active
manage locations lifecycle=archive
access locations view=role:admin|role:operator edit=role:admin|role:operator

resource resources label=name
field resources.name text required min=2
field resources.location ref=locations required
field resources.type enum values=MeetingRoom,Desk,Studio,TrainingHall required default=MeetingRoom
field resources.capacity number required default=4
field resources.status enum values=Available,Maintenance,Retired required default=Available
field resources.hourly_rate rate currency=USD unit=h required default=50
manage resources lifecycle=archive
access resources view=role:admin|role:operator edit=role:admin|role:operator

resource customers label=name
field customers.name text required min=2
field customers.email email required unique
field customers.status enum values=Active,Suspended required default=Active
manage customers lifecycle=archive
access customers view=role:admin|role:operator edit=role:admin|role:operator

resource reservations label=title
field reservations.title text required min=2
field reservations.customer ref=customers required
field reservations.resource ref=resources required
field reservations.start_at date required default=today
field reservations.end_at date required default=today
field reservations.booking_period interval start=start_at end=end_at
field reservations.attendees number required default=1
field reservations.status enum values=Requested,Confirmed,CheckedIn,Completed,Cancelled,NoShow required default=Requested
field reservations.amount money currency=USD required default=0
field reservations.quote money currency=USD computed="booking_period.duration * resource.hourly_rate"
field reservations.created_at date required default=today
field reservations.updated date required default=today

manage reservations lifecycle=archive
access reservations view=role:admin|role:operator edit=role:admin|role:operator

invariant reservations.no_overlap none=reservations scope=resource overlaps=booking_period where="status!=Cancelled" deny="Resource is already booked during this period"
invariant reservations.capacity when="attendees>resource.capacity" deny="Attendees cannot exceed resource capacity"

process reservations state=status initial=Requested terminal=Completed,Cancelled,NoShow history touch=updated
transition reservations.confirm from=Requested to=Confirmed action=confirm by=role:operator event=confirmed
transition reservations.check_in from=Confirmed to=CheckedIn action=check_in by=role:operator event=checked_in
transition reservations.complete from=CheckedIn to=Completed action=complete by=role:operator event=completed
transition reservations.cancel from=Requested,Confirmed to=Cancelled action=cancel by=role:operator comment=optional event=cancelled
transition reservations.mark_no_show from=Confirmed to=NoShow action=mark_no_show by=role:operator event=no_show

highlight reservations.confirmed when="status==Confirmed" tone=positive
highlight reservations.cancelled when="status==Cancelled" tone=neutral

overview
insight reservations.total_quote op=sum field=quote label="Total Quote Value"
`,
    seed: {
      "locations": [
        { "id": "loc_01", "name": "San Francisco Tech Center", "timezone": "America/Los_Angeles", "status": "Active" },
        { "id": "loc_02", "name": "London Workspace", "timezone": "Europe/London", "status": "Active" }
      ],
      "resources": [
        { "id": "res_01", "name": "Boardroom Alpha", "location": "loc_01", "type": "MeetingRoom", "capacity": 12, "status": "Available", "hourly_rate": 120.00 },
        { "id": "res_02", "name": "Podcast Studio 1", "location": "loc_01", "type": "Studio", "capacity": 4, "status": "Available", "hourly_rate": 75.00 },
        { "id": "res_03", "name": "Executive Suite", "location": "loc_02", "type": "MeetingRoom", "capacity": 8, "status": "Available", "hourly_rate": 95.00 }
      ],
      "customers": [
        { "id": "cust_01", "name": "Apex Ventures", "email": "booking@apex.vc", "status": "Active" },
        { "id": "cust_02", "name": "HyperScale Labs", "email": "admin@hyperscale.io", "status": "Active" }
      ],
      "reservations": [
        { "id": "resv_001", "title": "Q1 Strategy Offsite", "customer": "cust_01", "resource": "res_01", "start_at": "2026-03-25", "end_at": "2026-03-26", "attendees": 10, "status": "Confirmed", "amount": 2880.00, "quote": 2880.00, "created_at": "2026-03-01", "updated": "2026-03-02" },
        { "id": "resv_002", "title": "Audio Podcast Episode 42", "customer": "cust_02", "resource": "res_02", "start_at": "2026-03-28", "end_at": "2026-03-28", "attendees": 3, "status": "Requested", "amount": 300.00, "quote": 300.00, "created_at": "2026-03-15", "updated": "2026-03-15" }
      ]
    }
  },
  "inventory-hub": {
    air: `air version=2
app inventory_hub title="Inventory Hub" subtitle="Warehouse stock tracking, order fulfillment, and low-stock edge alerts" initial=overview timezone="UTC"
theme mode=dark accent=emerald
capability storage.local

resource products label=name
field products.sku text required unique
field products.name text required min=2
field products.category enum values=Electronics,Hardware,Apparel,Supplies required default=Supplies
field products.unit_price money currency=USD required default=0
field products.status enum values=Active,Draft,Discontinued required default=Active
manage products lifecycle=archive
access products view=role:admin|role:operator edit=role:admin|role:operator

resource warehouses label=name
field warehouses.code text required unique
field warehouses.name text required min=2
field warehouses.region text required default="North America"
field warehouses.status enum values=Active,Inactive required default=Active
manage warehouses lifecycle=archive
access warehouses view=role:admin|role:operator edit=role:admin|role:operator

resource inventory_balances label=product
field inventory_balances.product ref=products required
field inventory_balances.warehouse ref=warehouses required
field inventory_balances.quantity_on_hand integer required default=0
field inventory_balances.quantity_reserved integer required default=0
field inventory_balances.reorder_level integer required default=5
field inventory_balances.status enum values=InStock,LowStock,OutOfStock required default=InStock
manage inventory_balances lifecycle=archive
access inventory_balances view=role:admin|role:operator edit=role:admin|role:operator

highlight inventory_balances.low_stock when="quantity_on_hand<=reorder_level&quantity_on_hand>0" tone=warning
highlight inventory_balances.out_of_stock when="quantity_on_hand<=0" tone=danger

notify inventory_balances.low_stock when="quantity_on_hand<=reorder_level&quantity_on_hand>0" tone=warning label="Low Stock Alert" title="Low Stock Warning" body="Stock for item has dropped to {quantity_on_hand}" audience=role:operator
notify inventory_balances.out_of_stock when="quantity_on_hand<=0" tone=danger label="Out of Stock" title="Stock Depleted" body="Item is out of stock ({quantity_on_hand} remaining)" audience=role:operator

resource customers label=name
field customers.name text required min=2
field customers.email email required unique
field customers.status enum values=Active,Suspended required default=Active
manage customers lifecycle=archive
access customers view=role:admin|role:operator edit=role:admin|role:operator

resource orders label=order_number
field orders.order_number text required unique
field orders.customer ref=customers required
field orders.status enum values=Draft,Submitted,Allocated,Fulfilled,Cancelled required default=Draft
field orders.subtotal money currency=USD required default=0
field orders.discount money currency=USD required default=0
field orders.tax money currency=USD required default=0
field orders.total money currency=USD computed="subtotal - discount + tax"
field orders.created_at date required default=today
field orders.updated date required default=today
manage orders lifecycle=archive
access orders view=role:admin|role:operator edit=role:admin|role:operator

process orders state=status initial=Draft terminal=Fulfilled,Cancelled history touch=updated
transition orders.submit from=Draft to=Submitted action=submit by=role:operator event=submitted
transition orders.allocate from=Submitted to=Allocated action=allocate by=role:operator event=allocated
transition orders.fulfill from=Allocated to=Fulfilled action=fulfill by=role:operator event=fulfilled
transition orders.cancel from=Draft,Submitted,Allocated to=Cancelled action=cancel by=role:operator comment=optional event=cancelled

highlight orders.fulfilled when="status==Fulfilled" tone=positive
notify orders.new_order on=created tone=info label="New Order" title="New Order Created" body="Order {order_number} has been placed" audience=role:admin|role:operator

overview
insight orders.total_revenue op=sum field=total label="Total Order Value"
`,
    seed: {
      "products": [
        { "id": "prod_01", "sku": "SKU-PRO-01", "name": "Mechanical Keyboard", "category": "Electronics", "unit_price": 120.00, "status": "Active" },
        { "id": "prod_02", "sku": "SKU-MON-02", "name": "4K IPS Monitor 27\"", "category": "Electronics", "unit_price": 450.00, "status": "Active" },
        { "id": "prod_03", "sku": "SKU-CAB-03", "name": "Braided USB-C Cable", "category": "Supplies", "unit_price": 18.00, "status": "Active" }
      ],
      "warehouses": [
        { "id": "wh_01", "code": "WH-US-WEST", "name": "Oakland Logistics Center", "region": "North America", "status": "Active" },
        { "id": "wh_02", "code": "WH-EU-CENTRAL", "name": "Frankfurt Depot", "region": "Europe", "status": "Active" }
      ],
      "inventory_balances": [
        { "id": "bal_01", "product": "prod_01", "warehouse": "wh_01", "quantity_on_hand": 12, "quantity_reserved": 0, "reorder_level": 10, "status": "InStock" },
        { "id": "bal_02", "product": "prod_02", "warehouse": "wh_01", "quantity_on_hand": 4, "quantity_reserved": 1, "reorder_level": 5, "status": "LowStock" },
        { "id": "bal_03", "product": "prod_03", "warehouse": "wh_02", "quantity_on_hand": 85, "quantity_reserved": 5, "reorder_level": 20, "status": "InStock" }
      ],
      "customers": [
        { "id": "cust_01", "name": "Apex Tech Solutions", "email": "procurement@apextech.com", "status": "Active" },
        { "id": "cust_02", "name": "OmniGlobal Services", "email": "orders@omniglobal.org", "status": "Active" }
      ],
      "orders": [
        { "id": "ord_001", "order_number": "ORD-2026-001", "customer": "cust_01", "status": "Submitted", "subtotal": 570.00, "discount": 20.00, "tax": 44.00, "total": 594.00, "created_at": "2026-03-20", "updated": "2026-03-20" }
      ]
    }
  }
};

const MINIMAL_AIR_STARTER = `air version=2
app my_app title="My App" initial=overview
theme mode=dark accent=violet
capability storage.local

resource items label=name
field items.name text required min=2

manage items

overview
insight items.total op=count field=name label="Total Items"
`;

const DOCS = [
  { id: "getting-started/introduction", title: "Introduction", section: "Getting Started" },
  { id: "getting-started/installation", title: "Installation & Setup", section: "Getting Started" },
  { id: "getting-started/first-application", title: "First Application", section: "Getting Started" },
  { id: "getting-started/project-structure", title: "Project Structure", section: "Getting Started" },
  { id: "getting-started/run-and-edit", title: "Run, Edit & Test", section: "Getting Started" },
  { id: "guides/writing-air-by-hand", title: "Writing AIR by Hand", section: "Authoring Guides" },
  { id: "guides/ai-coding-agents", title: "AI Coding Agents", section: "Authoring Guides" },
  { id: "guides/resources-and-fields", title: "Resources & Fields", section: "Authoring Guides" },
  { id: "guides/forms-and-management", title: "Forms & Management", section: "Authoring Guides" },
  { id: "guides/workflows", title: "Workflows & State Machines", section: "Authoring Guides" },
  { id: "guides/permissions", title: "Permissions & Authority", section: "Authoring Guides" },
  { id: "guides/computed-values", title: "Computed Values & Math", section: "Authoring Guides" },
  { id: "guides/relational-collections", title: "Relational Collections", section: "Authoring Guides" },
  { id: "guides/temporal-and-intervals", title: "Temporal & Intervals", section: "Authoring Guides" },
  { id: "guides/schedules", title: "Schedules & Calendars", section: "Authoring Guides" },
  { id: "guides/notifications", title: "Notifications & Center", section: "Authoring Guides" },
  { id: "guides/analytics-and-visualizations", title: "Analytics & Charts", section: "Authoring Guides" },
  { id: "guides/development-workflow", title: "Development Workflow", section: "Authoring Guides" },
  { id: "guides/current-boundaries", title: "Current Boundaries", section: "Authoring Guides" },
  { id: "reference/cli", title: "CLI Reference", section: "Reference" },
  { id: "reference/air-language", title: "AIR Language Grammar", section: "Reference" },
  { id: "reference/repository-structure", title: "Repository Structure", section: "Reference" },
  { id: "benchmarks/methodology", title: "Methodology & Proof", section: "Benchmarks" }
];

// Active State
let currentView = "home";
let currentExampleId = "customer-manager";
let currentDocId = "getting-started/introduction";
let currentFocusMode = "split";
let currentCodeTab = "air";
let currentPreviewScaleMode = "fit";
let currentViewportWidth = "100%";

let canonicalAirSource = "";
let editorBuffer = "";
let lastValidSource = "";
let lastValidModel = null;
let currentSeedSource = "";
let currentRuntimeInstance = null;
let homeLiveAppInstance = null;
let debounceTimer = null;
let loadGeneration = 0;
let playgroundSessionId = `pg_${Date.now()}`;

// DOM Elements (guarded for universal testability)
const doc = typeof document !== "undefined" ? document : null;
const editor = doc ? doc.getElementById("air-code-editor") : null;
const liveAppRoot = doc ? doc.getElementById("live-app-root") : null;
const previewLabel = doc ? doc.getElementById("preview-label") : null;
const previewTitle = doc ? doc.getElementById("preview-title") : null;
const previewStatusPill = doc ? doc.getElementById("preview-status-pill") : null;
const moduleTitle = doc ? doc.getElementById("module-title") : null;
const moduleDesc = doc ? doc.getElementById("module-desc") : null;
const moduleTags = doc ? doc.getElementById("module-tags") : null;
const statusDot = doc ? doc.querySelector("#compiler-status .status-dot") : null;
const statusText = doc ? doc.querySelector("#compiler-status .status-text") : null;
const errorBanner = doc ? doc.getElementById("compiler-error-banner") : null;
const errorTitle = doc ? doc.getElementById("compiler-error-title") : null;
const errorMsg = doc ? doc.getElementById("compiler-error-msg") : null;
const editorLiveHint = doc ? doc.getElementById("editor-live-hint") : null;
const whatAirProvides = doc ? doc.getElementById("what-air-provides-content") : null;
const semanticIRViewer = doc ? doc.getElementById("semantic-ir-code") : null;
const presentationIRViewer = doc ? doc.getElementById("presentation-ir-code") : null;
const artifactsIRViewer = doc ? doc.getElementById("artifacts-ir-code") : null;
const explainCardsList = doc ? doc.getElementById("explain-cards-list") : null;
const lineExplainStrip = doc ? doc.getElementById("line-explain-strip") : null;
const stripLineBadge = doc ? doc.getElementById("strip-line-badge") : null;
const stripLineCode = doc ? doc.getElementById("strip-line-code") : null;
const stripLineDesc = doc ? doc.getElementById("strip-line-desc") : null;
const inventoryBar = doc ? doc.getElementById("inventory-notification-bar") : null;
const footprintTbody = doc ? doc.getElementById("footprint-tbody") : null;
const modificationsList = doc ? doc.getElementById("modifications-list") : null;
const removedScaffoldingContent = doc ? doc.getElementById("removed-scaffolding-content") : null;
const heroRatioValue = doc ? doc.getElementById("compression-hero-value") : null;
const heroRatioBadge = doc ? doc.getElementById("compression-hero-badge") : null;
const convFileList = doc ? doc.getElementById("conv-file-list") : null;
const convFileCode = doc ? doc.getElementById("conv-file-content") : null;

// Draggable Splitter & Container
const splitContainer = doc ? doc.getElementById("split-container") : null;
const leftPane = doc ? doc.getElementById("left-code-pane") : null;
const splitDivider = doc ? doc.getElementById("split-divider") : null;
const clearConfirmModal = doc ? doc.getElementById("clear-confirm-modal") : null;

let benchmarkResults = null;

function syncSourceEditor() {
  const editorEl = document.getElementById("air-code-editor");
  if (editorEl && editorEl.value !== editorBuffer) {
    editorEl.value = editorBuffer;
  }
}

function setEditorSource(source) {
  editorBuffer = source;
  syncSourceEditor();
}

function setInspectorTab(tabName) {
  currentCodeTab = tabName;
  document.querySelectorAll(".tabs-list .tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".code-editor-wrapper .tab-content").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `tab-content-${tabName}`);
  });
  if (tabName === "air") {
    syncSourceEditor();
  } else if (tabName === "explain") {
    renderExplainTab(editorBuffer);
  }
}

async function init() {
  const benchPaths = ["benchmarks/results.json", "../benchmarks/results.json", "/benchmarks/results.json", "/web/benchmarks/results.json"];
  for (const bp of benchPaths) {
    try {
      const res = await fetch(bp);
      if (res.ok) {
        benchmarkResults = await res.json();
        break;
      }
    } catch {
      // try next
    }
  }

  initSplitResizer();
  bindNavigationEvents();
  bindExplorerEvents();
  setupInventoryNotificationDemo();
  loadHomepageLiveProof();

  window.addEventListener("popstate", () => {
    handleInitialRoute();
  });

  handleInitialRoute();
}

function handleInitialRoute() {
  const hash = window.location.hash.replace("#", "").trim();
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view") || params.get("tab");
  const exampleParam = params.get("example") || params.get("demo");
  const docParam = params.get("doc");

  if (exampleParam && EXAMPLES[exampleParam]) {
    currentExampleId = exampleParam;
    switchView("examples");
  } else if (docParam) {
    const matched = DOCS.find((d) => d.id === docParam || d.id.endsWith(docParam));
    if (matched) currentDocId = matched.id;
    switchView("docs");
  } else if (hash === "capabilities" || viewParam === "capabilities") {
    switchView("capabilities");
  } else if (hash === "examples" || viewParam === "examples") {
    switchView("examples");
  } else if (hash === "benchmarks" || viewParam === "benchmarks") {
    switchView("benchmarks");
  } else if (hash === "docs" || viewParam === "docs") {
    switchView("docs");
  } else {
    switchView("home");
  }
}

function switchView(viewName) {
  // If leaving examples view, cleanly dispose previous runtime instance
  if (currentView === "examples" && viewName !== "examples" && currentRuntimeInstance) {
    if (typeof currentRuntimeInstance.dispose === "function") currentRuntimeInstance.dispose();
    else if (typeof currentRuntimeInstance.destroy === "function") currentRuntimeInstance.destroy();
    currentRuntimeInstance = null;
    if (liveAppRoot) liveAppRoot.innerHTML = "";
  }

  currentView = viewName;

  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  document.querySelectorAll(".mobile-nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  const mobileMenu = document.getElementById("showcase-mobile-menu");
  const mobileToggleBtn = document.getElementById("btn-showcase-mobile-toggle");
  if (mobileMenu) {
    mobileMenu.classList.add("hidden");
  }
  if (mobileToggleBtn) {
    mobileToggleBtn.setAttribute("aria-expanded", "false");
  }

  document.querySelectorAll(".showcase-view").forEach((section) => {
    section.classList.toggle("active", section.id === `view-${viewName}`);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  const url = new URL(window.location);
  url.hash = viewName === "home" ? "" : `#${viewName}`;
  if (viewName === "examples") {
    url.searchParams.set("example", currentExampleId);
    url.searchParams.delete("doc");
  } else if (viewName === "docs") {
    url.searchParams.set("doc", currentDocId);
    url.searchParams.delete("example");
  } else {
    url.searchParams.delete("example");
    url.searchParams.delete("doc");
  }
  window.history.replaceState({}, "", url);

  if (viewName === "examples") {
    loadExample(currentExampleId);
    requestAnimationFrame(() => applyPreviewScaling());
  } else if (viewName === "docs") {
    loadDoc(currentDocId);
  } else if (viewName === "home") {
    loadHomepageLiveProof();
  }
}

function bindNavigationEvents() {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
    });
  });

  // Mobile menu toggle & links
  const mobileToggleBtn = document.getElementById("btn-showcase-mobile-toggle");
  const mobileMenu = document.getElementById("showcase-mobile-menu");
  if (mobileToggleBtn && mobileMenu) {
    mobileToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = mobileMenu.classList.toggle("hidden");
      mobileToggleBtn.setAttribute("aria-expanded", String(!isHidden));
    });
  }

  document.querySelectorAll(".mobile-nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
    });
  });

  const brandHome = document.getElementById("nav-brand-home");
  if (brandHome) {
    brandHome.addEventListener("click", (e) => {
      e.preventDefault();
      switchView("home");
    });
  }

  const navLaunch = document.getElementById("btn-quick-launch-example");
  if (navLaunch) {
    navLaunch.addEventListener("click", () => {
      switchView("examples");
    });
  }

  const heroExplore = document.getElementById("hero-btn-explore");
  if (heroExplore) {
    heroExplore.addEventListener("click", () => {
      switchView("examples");
    });
  }

  const heroProof = document.getElementById("hero-btn-proof");
  if (heroProof) {
    heroProof.addEventListener("click", () => {
      switchView("benchmarks");
    });
  }

  const homeProofOpenExplorer = document.getElementById("home-proof-open-explorer");
  if (homeProofOpenExplorer) {
    homeProofOpenExplorer.addEventListener("click", (e) => {
      e.preventDefault();
      currentExampleId = "customer-manager";
      switchView("examples");
    });
  }

  document.querySelectorAll(".example-card").forEach((card) => {
    card.addEventListener("click", () => {
      const exId = card.dataset.launch;
      if (exId && EXAMPLES[exId]) {
        currentExampleId = exId;
        switchView("examples");
      }
    });
  });

  // Start Building Buttons
  const copyAiPromptBtn = document.getElementById("btn-copy-ai-prompt");
  if (copyAiPromptBtn) {
    copyAiPromptBtn.addEventListener("click", async () => {
      const promptText = `Write an AIR application for a customer CRM.\nInclude name (required), email (unique), company,\nand status (Active, Trial, Inactive).\nAdd search, filtering, and responsive edit drawers.`;
      try {
        await navigator.clipboard.writeText(promptText);
        const orig = copyAiPromptBtn.innerHTML;
        copyAiPromptBtn.innerHTML = `<span>✓ Copied!</span>`;
        setTimeout(() => { copyAiPromptBtn.innerHTML = orig; }, 2000);
      } catch (err) {
        console.warn(err);
      }
    });
  }

  const copyInstallCmdBtn = document.getElementById("btn-copy-install-cmd");
  if (copyInstallCmdBtn) {
    copyInstallCmdBtn.addEventListener("click", async () => {
      const cmdText = `git clone https://github.com/joaquimpsoares/AIR.git\ncd AIR\nnpm install\nnpm run dev`;
      try {
        await navigator.clipboard.writeText(cmdText);
        const orig = copyInstallCmdBtn.innerHTML;
        copyInstallCmdBtn.innerHTML = `<span>✓ Copied!</span>`;
        setTimeout(() => { copyInstallCmdBtn.innerHTML = orig; }, 2000);
      } catch (err) {
        console.warn(err);
      }
    });
  }

  const viewAiGuideBtn = document.getElementById("btn-view-ai-guide");
  if (viewAiGuideBtn) {
    viewAiGuideBtn.addEventListener("click", () => {
      currentDocId = "guides/ai-coding-agents";
      switchView("docs");
    });
  }

  const viewQuickstartGuideBtn = document.getElementById("btn-view-quickstart-guide");
  if (viewQuickstartGuideBtn) {
    viewQuickstartGuideBtn.addEventListener("click", () => {
      currentDocId = "getting-started/first-application";
      switchView("docs");
    });
  }

  // Docs navigation
  document.querySelectorAll(".docs-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const docId = btn.dataset.doc;
      if (docId) {
        currentDocId = docId;
        loadDoc(docId);
      }
    });
  });

  const prevDocBtn = document.getElementById("docs-btn-prev");
  const nextDocBtn = document.getElementById("docs-btn-next");
  if (prevDocBtn) {
    prevDocBtn.addEventListener("click", () => {
      const idx = DOCS.findIndex((d) => d.id === currentDocId);
      if (idx > 0) {
        currentDocId = DOCS[idx - 1].id;
        loadDoc(currentDocId);
      }
    });
  }
  if (nextDocBtn) {
    nextDocBtn.addEventListener("click", () => {
      const idx = DOCS.findIndex((d) => d.id === currentDocId);
      if (idx < DOCS.length - 1) {
        currentDocId = DOCS[idx + 1].id;
        loadDoc(currentDocId);
      }
    });
  }
}

function initSplitResizer() {
  if (!splitDivider || !leftPane || !splitContainer) return;

  const savedWidth = localStorage.getItem("air_showcase_split_width");
  if (savedWidth) {
    leftPane.style.width = `${savedWidth}px`;
  }

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  splitDivider.addEventListener("pointerdown", (e) => {
    if (currentFocusMode !== "split") return;
    isDragging = true;
    startX = e.clientX;
    startWidth = leftPane.getBoundingClientRect().width;
    splitDivider.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const containerRect = splitContainer.getBoundingClientRect();
    const delta = e.clientX - startX;
    let newWidth = startWidth + delta;

    const minWidth = 280;
    const maxWidth = containerRect.width * 0.8;

    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;

    leftPane.style.width = `${newWidth}px`;
    applyPreviewScaling();
  });

  window.addEventListener("pointerup", () => {
    if (isDragging) {
      isDragging = false;
      splitDivider.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const currentW = leftPane.getBoundingClientRect().width;
      localStorage.setItem("air_showcase_split_width", String(Math.round(currentW)));
      applyPreviewScaling();
    }
  });

  splitDivider.addEventListener("dblclick", () => {
    leftPane.style.width = "480px";
    localStorage.removeItem("air_showcase_split_width");
    applyPreviewScaling();
  });
}

function bindExplorerEvents() {
  // Example module switcher tabs
  document.querySelectorAll(".module-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const exId = btn.dataset.example;
      if (exId) {
        loadExample(exId);
      }
    });
  });

  // Focus mode switcher
  document.querySelectorAll(".focus-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.focus;
      if (mode) {
        setFocusMode(mode);
      }
    });
  });

  // Viewport switcher
  document.querySelectorAll(".viewport-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".viewport-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentViewportWidth = btn.dataset.width || "100%";
      applyPreviewScaling();
    });
  });

  // Preview Scaling Mode toggle (Fit vs Actual)
  document.querySelectorAll(".preview-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".preview-mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentPreviewScaleMode = btn.dataset.scaleMode || "fit";
      applyPreviewScaling();
    });
  });

  // ResizeObserver on preview container for smooth scaling
  const previewContainer = document.getElementById("preview-container");
  if (previewContainer && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      applyPreviewScaling();
    });
    ro.observe(previewContainer);
  }

  // Top code tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setInspectorTab(btn.dataset.tab);
    });
  });

  // Bottom proof tabs
  document.querySelectorAll(".bottom-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Auto-expand bottom panel if collapsed
      expandBottomPanel();
      document.querySelectorAll(".bottom-tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".bottom-panel-body .bottom-tab-content").forEach((c) => c.classList.add("hidden"));
      btn.classList.add("active");
      const bTab = btn.dataset.bottomTab;
      const target = document.getElementById(`bottom-content-${bTab}`);
      if (target) target.classList.remove("hidden");
    });
  });

  // Bottom drawer toggle
  const toggleBottomBtn = document.getElementById("btn-toggle-bottom-panel");
  if (toggleBottomBtn) {
    toggleBottomBtn.addEventListener("click", () => {
      toggleBottomPanel();
    });
  }

  // Line explain strip toggle
  const explainToggle = document.getElementById("explain-strip-toggle");
  const explainBtn = document.getElementById("btn-toggle-explain-strip");
  const toggleExplain = () => {
    const expanded = document.getElementById("explain-strip-expanded");
    const chevron = document.getElementById("explain-strip-chevron");
    if (expanded) {
      const isHidden = expanded.classList.toggle("hidden");
      if (chevron) chevron.textContent = isHidden ? "▾" : "▴";
    }
  };
  if (explainToggle) explainToggle.addEventListener("click", toggleExplain);
  if (explainBtn) {
    explainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleExplain();
    });
  }

  // AIR provides strip toggle
  const providesToggle = document.getElementById("air-provides-toggle");
  const providesBtn = document.getElementById("btn-toggle-air-provides");
  const toggleProvides = () => {
    const expanded = document.getElementById("air-provides-expanded");
    const chevron = document.getElementById("air-provides-chevron");
    if (expanded) {
      const isHidden = expanded.classList.toggle("hidden");
      if (chevron) chevron.textContent = isHidden ? "▾" : "▴";
    }
  };
  if (providesToggle) providesToggle.addEventListener("click", toggleProvides);
  if (providesBtn) {
    providesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleProvides();
    });
  }

  // Editor Input Live Debounce & Gutter Line Numbers
  const activeEditor = document.getElementById("air-code-editor");
  if (activeEditor) {
    activeEditor.addEventListener("input", () => {
      editorBuffer = activeEditor.value;
      handleEditorBufferChange(editorBuffer);
    });

    // Cursor movement for Line Explanation Strip
    const updateLineExplain = () => {
      if (currentCodeTab !== "air") return;
      const cursorPos = activeEditor.selectionStart || 0;
      const textUpToCursor = activeEditor.value.substring(0, cursorPos);
      const lineNumber = textUpToCursor.split("\n").length;
      const lines = activeEditor.value.split("\n");
      const currentLineText = lines[lineNumber - 1] || "";
      showLineExplanation(lineNumber, currentLineText);
    };

    activeEditor.addEventListener("keyup", updateLineExplain);
    activeEditor.addEventListener("click", updateLineExplain);
    activeEditor.addEventListener("select", updateLineExplain);
  }

  // Copy AIR
  const copyBtn = document.getElementById("btn-copy-air");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(editorBuffer);
        const label = copyBtn.querySelector("span");
        if (label) {
          const orig = label.textContent;
          label.textContent = "Copied!";
          setTimeout(() => (label.textContent = orig), 1500);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Clear AIR (prompts modal if modified)
  const clearBtn = document.getElementById("btn-clear-air");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (editorBuffer.trim().length > 0 && editorBuffer !== canonicalAirSource) {
        if (clearConfirmModal) clearConfirmModal.classList.remove("hidden");
      } else {
        performClear();
      }
    });
  }

  // Modal Cancel / Confirm
  const cancelClearBtn = document.getElementById("btn-cancel-clear");
  if (cancelClearBtn) {
    cancelClearBtn.addEventListener("click", () => {
      if (clearConfirmModal) clearConfirmModal.classList.add("hidden");
    });
  }

  const confirmClearBtn = document.getElementById("btn-confirm-clear");
  if (confirmClearBtn) {
    confirmClearBtn.addEventListener("click", () => {
      if (clearConfirmModal) clearConfirmModal.classList.add("hidden");
      performClear();
    });
  }

  // Reset AIR
  const resetBtn = document.getElementById("btn-reset-air");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (currentExampleId === "blank") {
        loadExample("customer-manager");
      } else {
        const builtin = BUILTIN_EXAMPLES[currentExampleId];
        if (builtin) {
          canonicalAirSource = builtin.air;
          editorBuffer = builtin.air;
          syncSourceEditor();
          attemptCompileAndMount(editorBuffer, true);
        }
      }
    });
  }
}

function setFocusMode(mode) {
  currentFocusMode = mode;
  document.querySelectorAll(".focus-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.focus === mode);
  });

  if (splitContainer) {
    splitContainer.classList.remove("focus-split", "focus-code", "focus-app");
    splitContainer.classList.add(`focus-${mode}`);
  }
  requestAnimationFrame(() => {
    applyPreviewScaling();
  });
}

function performClear() {
  editorBuffer = "";
  canonicalAirSource = "";
  syncSourceEditor();
  currentExampleId = "blank";
  playgroundSessionId = `pg_${Date.now()}`;

  // Update tabs
  document.querySelectorAll(".module-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.example === "blank");
  });

  if (moduleTitle) moduleTitle.textContent = "Blank Project";
  if (moduleDesc) moduleDesc.textContent = "Clean-sheet playground. Write AIR source to start.";
  if (moduleTags) moduleTags.innerHTML = `<span class="tag">Scratch</span><span class="tag">Clean Sheet</span>`;

  // Update URL
  const url = new URL(window.location);
  url.searchParams.set("example", "blank");
  window.history.replaceState({}, "", url);

  // Mount blank state
  mountBlankProjectState();
}

function handleEditorBufferChange(source) {
  editorBuffer = source;
  if (source.trim() === "") {
    clearTimeout(debounceTimer);
    mountBlankProjectState();
    return;
  }

  setCompilerStatus("compiling");
  if (editorLiveHint) editorLiveHint.textContent = "● Checking...";

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    attemptCompileAndMount(source, false);
  }, 250);
}

function mountBlankProjectState() {
  if (currentRuntimeInstance) {
    if (typeof currentRuntimeInstance.dispose === "function") currentRuntimeInstance.dispose();
    else if (typeof currentRuntimeInstance.destroy === "function") currentRuntimeInstance.destroy();
    currentRuntimeInstance = null;
  }

  hideError();
  setCompilerStatus("blank");

  if (previewLabel) previewLabel.textContent = "LIVE APPLICATION";
  if (previewTitle) previewTitle.textContent = "Blank Project";
  if (previewStatusPill) previewStatusPill.classList.add("hidden");
  if (editorLiveHint) editorLiveHint.textContent = "○ Blank project";
  if (lineExplainStrip) lineExplainStrip.classList.add("hidden");

  if (liveAppRoot) {
    liveAppRoot.innerHTML = `
      <div class="blank-playground-container">
        <div class="blank-hero-icon">✨</div>
        <h3 class="blank-hero-title">AIR Playground</h3>
        <p class="blank-hero-subtitle">
          Write declarative AIR in the editor to the left. Once your source is syntactically and semantically valid, the live application will mount automatically.
        </p>
        <div class="blank-starter-card">
          <div class="blank-starter-title">Optional Minimal Application Starter</div>
          <pre class="blank-code-snippet"><code>${MINIMAL_AIR_STARTER.trim()}</code></pre>
          <div class="blank-actions-group">
            <button class="btn-restore-example" id="btn-blank-restore-example">Restore Customer Manager</button>
            <button class="btn-insert-starter" id="btn-blank-insert-starter">
              <span>Insert Minimal App →</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const insertBtn = document.getElementById("btn-blank-insert-starter");
    if (insertBtn) {
      insertBtn.addEventListener("click", () => {
        canonicalAirSource = MINIMAL_AIR_STARTER;
        editorBuffer = MINIMAL_AIR_STARTER;
        syncSourceEditor();
        attemptCompileAndMount(MINIMAL_AIR_STARTER, false);
      });
    }

    const restoreBtn = document.getElementById("btn-blank-restore-example");
    if (restoreBtn) {
      restoreBtn.addEventListener("click", () => {
        loadExample("customer-manager");
      });
    }
  }

  // Clear IR views
  if (semanticIRViewer) semanticIRViewer.textContent = "// Empty project buffer";
  if (presentationIRViewer) presentationIRViewer.textContent = "// Empty project buffer";
  if (artifactsIRViewer) artifactsIRViewer.textContent = "// Empty project buffer";
  if (whatAirProvides) whatAirProvides.innerHTML = `<span class="text-xs text-slate-500 p-2">Awaiting declared resources</span>`;
  if (explainCardsList) {
    explainCardsList.innerHTML = `
      <div class="explain-card">
        <div class="explain-card-body">
          Start by declaring <code>air version=2</code>, an <code>app</code> name, and a <code>resource</code> to see line-by-line semantic explanations.
        </div>
      </div>
    `;
  }
}

async function loadExample(exampleId) {
  currentExampleId = exampleId;
  const config = EXAMPLES[exampleId];
  if (!config) return;

  document.querySelectorAll(".module-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.example === exampleId);
  });

  if (previewTitle) previewTitle.textContent = config.title;
  if (moduleTitle) moduleTitle.textContent = config.title;
  if (moduleDesc) moduleDesc.textContent = config.tagline;
  if (previewStatusPill) previewStatusPill.classList.add("hidden");

  if (moduleTags && config.tags) {
    moduleTags.innerHTML = config.tags.map((t) => `<span class="tag">${t}</span>`).join("");
  }

  const url = new URL(window.location);
  url.searchParams.set("example", exampleId);
  window.history.replaceState({}, "", url);

  if (inventoryBar) {
    inventoryBar.classList.toggle("hidden", exampleId !== "inventory-hub");
  }

  if (exampleId === "blank") {
    performClear();
    return;
  }

  const builtin = BUILTIN_EXAMPLES[exampleId];
  if (builtin) {
    canonicalAirSource = builtin.air;
    editorBuffer = builtin.air;
    currentSeedSource = JSON.stringify(builtin.seed, null, 2);
    syncSourceEditor();

    attemptCompileAndMount(editorBuffer, true);
    updateMetricsAndComparisons(exampleId);
  }
}

function toggleBottomPanel() {
  const panel = document.getElementById("showcase-bottom-panel");
  const body = panel ? panel.querySelector(".bottom-panel-body") : null;
  const chevron = document.getElementById("bottom-panel-chevron");
  const toggleText = document.getElementById("bottom-panel-toggle-text");
  if (!panel || !body) return;

  const isCollapsed = panel.classList.toggle("collapsed");
  body.classList.toggle("hidden", isCollapsed);
  if (chevron) chevron.textContent = isCollapsed ? "▴" : "▾";
  if (toggleText) toggleText.textContent = isCollapsed ? "Expand" : "Collapse";
  requestAnimationFrame(() => applyPreviewScaling());
}

function expandBottomPanel() {
  const panel = document.getElementById("showcase-bottom-panel");
  const body = panel ? panel.querySelector(".bottom-panel-body") : null;
  const chevron = document.getElementById("bottom-panel-chevron");
  const toggleText = document.getElementById("bottom-panel-toggle-text");
  if (!panel || !body) return;

  panel.classList.remove("collapsed");
  body.classList.remove("hidden");
  if (chevron) chevron.textContent = "▾";
  if (toggleText) toggleText.textContent = "Collapse";
  requestAnimationFrame(() => applyPreviewScaling());
}

/**
 * Transactional Compilation & Preview Swapping
 *
 * If source is invalid:
 * - Keeps editorBuffer untouched
 * - Keeps lastValidSource untouched
 * - Keeps current running preview mounted
 * - Shows compiler diagnostics banner
 * - Updates status to "Source Error"
 * - Displays "Preview: last valid compile" indicator
 *
 * If source is valid:
 * - Instantiates candidate runtime in isolation
 * - Swaps into live preview container
 * - Disposes previous runtime
 * - Updates lastValidSource & IR inspectors
 * - Clears error banner
 */
function attemptCompileAndMount(source, isCanonicalReset = false) {
  // Step 1: Parse and dry-run compile candidate AIR source in isolation
  let candidateModel = null;
  try {
    candidateModel = parseAir(source);
    compilePresentation(candidateModel);
  } catch (err) {
    // Parse / Semantic / Presentation validation failure: Retain last working preview
    const isTheme = err.code?.startsWith("AIR_THEME") || /theme mode|accent|density/i.test(err.message || "");
    const isSemantic = isTheme || err.name === "SemanticError" || /semantic|type\s+mismatch|cyclic|reference/i.test(err.message || "");
    const errorType = isTheme ? "THEME VALIDATION ERROR" : (isSemantic ? "SEMANTIC COMPILE ERROR" : "SOURCE PARSE ERROR");
    handleCompileFailure(err, source, errorType);
    return;
  }

  // Step 2: Dispose previous runtime instance
  if (currentRuntimeInstance) {
    if (typeof currentRuntimeInstance.dispose === "function") currentRuntimeInstance.dispose();
    else if (typeof currentRuntimeInstance.destroy === "function") currentRuntimeInstance.destroy();
    currentRuntimeInstance = null;
  }

  // Step 3: Mount candidate runtime directly to liveAppRoot
  let candidateRuntime = null;
  const targetHost = liveAppRoot || (typeof document !== "undefined" ? document.getElementById("live-app-root") : null);

  try {
    if (targetHost) {
      targetHost.innerHTML = "";
    }
    const isUntouchedCanonical = isCanonicalReset || (source === canonicalAirSource && currentExampleId !== "blank");
    const seed = isUntouchedCanonical ? currentSeedSource : sanitizeSeedForModel(currentSeedSource, candidateModel);
    const namespace = isUntouchedCanonical ? `showcase:${currentExampleId}` : `showcase:playground:${playgroundSessionId}`;
    const principal = (EXAMPLES[currentExampleId] && EXAMPLES[currentExampleId].principal) || { roles: ["admin"] };

    if (targetHost) {
      candidateRuntime = mountAirApp(targetHost, source, {
        mode: "embedded",
        seedSource: seed,
        principal,
        storage: typeof window !== "undefined" ? window.sessionStorage : null,
        namespace,
        onRetry: () => {
          const el = typeof document !== "undefined" ? document.getElementById("air-code-editor") : null;
          attemptCompileAndMount(el ? el.value : source, false);
        }
      });
    }
  } catch (runtimeErr) {
    const isPresentation = runtimeErr instanceof TypeError || /toLocaleString|undefined|null|render|format/i.test(runtimeErr.message || "");
    const errorType = isPresentation ? "PRESENTATION FORMAT ERROR" : "CANDIDATE RUNTIME ERROR";
    handleCompileFailure(runtimeErr, source, errorType);
    return;
  }

  currentRuntimeInstance = candidateRuntime;
  lastValidSource = source;
  lastValidModel = candidateModel;

  hideError();
  setCompilerStatus("compiled");

  if (previewLabel) previewLabel.textContent = "LIVE RUNNING APPLICATION";
  if (previewTitle) {
    previewTitle.textContent = candidateModel.app ? candidateModel.app.title : (EXAMPLES[currentExampleId]?.title || "Custom Application");
  }
  if (previewStatusPill) previewStatusPill.classList.add("hidden");
  if (editorLiveHint) editorLiveHint.textContent = "● Live — compiled";

  updateInspectors(candidateModel, source);
  if (currentCodeTab === "explain") {
    renderExplainTab(source);
  }

  requestAnimationFrame(() => {
    applyPreviewScaling();
  });
}

function handleCompileFailure(err, failedSource, title = "SOURCE ERROR") {
  setCompilerStatus("source-error", err.message);
  showError(err.message || String(err), title);

  if (editorLiveHint) {
    editorLiveHint.textContent = "⚠️ Editing — fix source to update preview";
  }

  // If a previously compiled application is already running, show last valid preview indicator
  if (lastValidSource && currentRuntimeInstance && liveAppRoot && liveAppRoot.children.length > 0) {
    if (previewStatusPill) {
      previewStatusPill.classList.remove("hidden");
      previewStatusPill.textContent = "⚠ Preview: last valid compile";
    }
  }
}

function sanitizeSeedForModel(seedStr, model) {
  if (!seedStr) return "{}";
  try {
    const raw = typeof seedStr === "string" ? JSON.parse(seedStr) : seedStr;
    const sanitized = {};
    const declaredEntities = model.entities ? Array.from(model.entities.keys()) : [];

    for (const ent of declaredEntities) {
      if (Array.isArray(raw[ent])) {
        const entMeta = model.entities.get(ent);
        const declaredFields = entMeta && entMeta.fields
          ? entMeta.fields.map((f) => f.id)
          : (entMeta && entMeta.fieldMap ? Array.from(entMeta.fieldMap.keys()) : []);
        sanitized[ent] = raw[ent].map((rec) => {
          const cleanRec = { id: rec.id };
          for (const f of declaredFields) {
            if (rec[f] !== undefined) cleanRec[f] = rec[f];
          }
          return cleanRec;
        });
      }
    }
    return JSON.stringify(sanitized);
  } catch {
    return "{}";
  }
}

function setCompilerStatus(status, errorText = "") {
  if (!statusDot || !statusText) return;
  statusDot.className = "status-dot";

  if (status === "compiled") {
    statusDot.classList.add("green");
    statusText.textContent = "Compiled";
  } else if (status === "compiling") {
    statusDot.classList.add("blue");
    statusText.textContent = "Compiling…";
  } else if (status === "blank") {
    statusDot.classList.add("gray");
    statusText.textContent = "Blank";
  } else if (status === "source-error") {
    statusDot.classList.add("yellow");
    const lineMatch = /line\s+(\d+)/i.exec(errorText);
    statusText.textContent = lineMatch ? `Error at line ${lineMatch[1]}` : "Source Error";
  } else if (status === "runtime-error") {
    statusDot.classList.add("red");
    statusText.textContent = "Runtime Error";
  }
}

function showError(msg, title = "SOURCE ERROR") {
  if (errorBanner && errorMsg) {
    errorBanner.classList.remove("hidden");
    if (errorTitle) errorTitle.textContent = title;
    errorMsg.textContent = msg;
  }
}

function hideError() {
  if (errorBanner && errorMsg) {
    errorBanner.classList.add("hidden");
    errorMsg.textContent = "";
  }
}

function updateInspectors(model, source) {
  if (!model || !model.entities) return;

  // 1. Semantic IR
  if (semanticIRViewer) {
    const cleanAST = {
      app: model.app,
      theme: model.theme,
      entities: Object.fromEntries(
        Array.from(model.entities.entries()).map(([k, v]) => [
          k,
          {
            id: v.id,
            label: v.label,
            fields: Object.fromEntries(
              Array.from(v.fields.entries()).map(([fk, fv]) => [
                fk,
                { type: fv.type, required: fv.required, unique: fv.unique, computed: fv.computed, rate: fv.rate }
              ])
            )
          }
        ])
      ),
      processes: Object.fromEntries(Array.from(model.processes.entries())),
      transitions: Array.from(model.transitions.values()).map((t) => ({
        id: t.id,
        resource: t.resource,
        from: t.from,
        to: t.to,
        action: t.action,
        by: t.by
      })),
      invariants: Array.from(model.invariants.values()).map((inv) => ({
        id: inv.id,
        resource: inv.resource,
        overlaps: inv.overlaps
      })),
      notifications: model.notifications
        ? model.notifications.map((n) => ({ id: n.id, resource: n.resource, tone: n.tone, audience: n.audience }))
        : []
    };
    semanticIRViewer.textContent = JSON.stringify(cleanAST, null, 2);
  }

  // 2. Presentation IR
  if (presentationIRViewer) {
    const presentation = {
      experience: model.entities.size > 1 ? "multi_resource_hub" : "resource_management",
      sections: ["overview", "collection", "detail", "editor"],
      density: model.theme?.density || "comfortable",
      accent: model.theme?.accent || "violet"
    };
    presentationIRViewer.textContent = JSON.stringify(presentation, null, 2);
  }

  // 3. Artifacts IR
  if (artifactsIRViewer) {
    const artifacts = {
      collection: "Responsive Data Table & Record Cards",
      detail: "Slide-Over Drawer with Action Lifecycle & Tabs",
      editor: "Schema-Driven Form with Inline Constraint Validation",
      navigation: "Hierarchical Top / Sidebar Navigation",
      notificationCenter: model.notifications && model.notifications.length > 0 ? "Bell Badge, Popover & Sheet" : "Inactive"
    };
    artifactsIRViewer.textContent = JSON.stringify(artifacts, null, 2);
  }

  // 4. What AIR Provides Card & Bar
  const entityNames = Array.from(model.entities.keys()).join(", ");
  const hasWorkflow = model.processes.size > 0;
  const hasNotifications = model.notifications && model.notifications.length > 0;

  const providesSummary = document.getElementById("provides-summary-text");
  if (providesSummary) {
    const resCount = model.entities.size;
    providesSummary.textContent = `Table · Cards · Drawer · Form${hasNotifications ? " · Notifications" : ""} (${resCount} ${resCount === 1 ? "resource" : "resources"})`;
  }

  const pillsHtml = `
    <div class="meta-pill">
      <span class="meta-label">Declared Resources</span>
      <span class="meta-val">${entityNames || "None"}</span>
    </div>
    <div class="meta-pill">
      <span class="meta-label">Generated Artifacts</span>
      <span class="meta-val">Table, Cards, Drawer, Form${hasNotifications ? ", Bell" : ""}</span>
    </div>
    <div class="meta-pill">
      <span class="meta-label">Responsive Modes</span>
      <span class="meta-val">Desktop Grid ⇄ Mobile Cards / Sheets</span>
    </div>
    <div class="meta-pill">
      <span class="meta-label">Workflow Engine</span>
      <span class="meta-val">${hasWorkflow ? "Guarded State Machine Active" : "Standard CRUD"}</span>
    </div>
  `;

  if (whatAirProvides) {
    whatAirProvides.innerHTML = pillsHtml;
  }
  const whatAirProvidesArtifacts = document.getElementById("what-air-provides-artifacts-content");
  if (whatAirProvidesArtifacts) {
    whatAirProvidesArtifacts.innerHTML = pillsHtml;
  }
}

// ============================================================
// GENERIC DETERMINISTIC EXPLAIN ENGINE (Compiler Knowledge)
// ============================================================

function explainDeclarationLine(line) {
  const clean = line.replace(/#.*$/, "").trim();
  if (!clean) return null;

  // air version=N
  if (clean.startsWith("air ")) {
    const vMatch = /version=(\d+)/.exec(clean);
    return {
      kind: "Spec Version",
      desc: `Declares the AIR compiler specification version (${vMatch ? `v${vMatch[1]}` : "v2"}).`
    };
  }

  // app id title="..."
  if (clean.startsWith("app ")) {
    const id = clean.split(/\s+/)[1];
    const tMatch = /title="([^"]+)"/.exec(clean);
    return {
      kind: "Application Metadata",
      desc: `Configures application identity \`${id}\`${tMatch ? ` with title "${tMatch[1]}"` : ""}.`
    };
  }

  // theme mode=... accent=...
  if (clean.startsWith("theme ")) {
    const mMatch = /mode=(\w+)/.exec(clean);
    const aMatch = /accent=(\w+)/.exec(clean);
    return {
      kind: "Visual Theme",
      desc: `Applies design system theme: ${mMatch ? `${mMatch[1]} mode` : "system mode"} with ${aMatch ? `${aMatch[1]} accent` : "default accent"}.`
    };
  }

  // capability ...
  if (clean.startsWith("capability ")) {
    const cap = clean.split(/\s+/)[1];
    return {
      kind: "Platform Capability",
      desc: `Enables runtime platform capability \`${cap}\` for persistent client-side storage.`
    };
  }

  // resource R label=F
  if (clean.startsWith("resource ")) {
    const parts = clean.split(/\s+/);
    const res = parts[1];
    const lMatch = /label=(\w+)/.exec(clean);
    return {
      kind: "Business Resource",
      desc: `Defines business entity \`${res}\`. ${lMatch ? `The \`${lMatch[1]}\` field is used as the primary display label.` : ""}`
    };
  }

  // field R.F type ...
  if (clean.startsWith("field ")) {
    const parts = clean.split(/\s+/);
    const fieldPath = parts[1];
    const type = parts[2];
    const isRequired = clean.includes("required");
    const isUnique = clean.includes("unique");
    const dMatch = /default=([^\s]+)/.exec(clean);
    const cMatch = /computed="([^"]+)"/.exec(clean);
    const rMatch = /values=([^\s]+)/.exec(clean);
    const refMatch = /ref=([^\s]+)/.exec(clean);

    let details = `Adds field \`${fieldPath}\` of type \`${type}\`.`;
    if (type === "money") details = `Adds exact money field \`${fieldPath}\` calculated using BigInt minor units.`;
    else if (type === "rate") details = `Adds strongly-typed rate \`${fieldPath}\` for duration-based pricing.`;
    else if (type === "interval") details = `Declares continuous temporal interval \`${fieldPath}\` for schedule conflict validation.`;
    else if (refMatch) details = `Relational foreign reference linking \`${fieldPath}\` to records in \`${refMatch[1]}\`.`;
    else if (rMatch) details = `Restricts \`${fieldPath}\` to enum choices: ${rMatch[1]}.`;
    else if (cMatch) details = `Computed field \`${fieldPath}\` calculated dynamically from expression: \`${cMatch[1]}\`.`;

    const flags = [];
    if (isRequired) flags.push("Required");
    if (isUnique) flags.push("Unique constraint");
    if (dMatch) flags.push(`Defaults to ${dMatch[1]}`);

    return {
      kind: `Field (${type})`,
      desc: `${details}${flags.length > 0 ? ` (${flags.join(", ")})` : ""}`
    };
  }

  // actor R
  if (clean.startsWith("actor ")) {
    const res = clean.split(/\s+/)[1];
    return {
      kind: "Actor Identity",
      desc: `Registers records in \`${res}\` as authentication principals for role permissions and workflow transitions.`
    };
  }

  // manage R ...
  if (clean.startsWith("manage ")) {
    const res = clean.split(/\s+/)[1];
    const isArchive = clean.includes("lifecycle=archive");
    return {
      kind: "Managed CRUD UI",
      desc: `Generates collection table, search filters, modal forms, and edit drawers for \`${res}\`.${isArchive ? " Uses non-destructive archival." : ""}`
    };
  }

  // access R ...
  if (clean.startsWith("access ")) {
    const res = clean.split(/\s+/)[1];
    return {
      kind: "Access Control (RBAC)",
      desc: `Enforces permissions on \`${res}\` based on user roles, ownership, or relationship.`
    };
  }

  // process R state=...
  if (clean.startsWith("process ")) {
    const res = clean.split(/\s+/)[1];
    const sMatch = /state=(\w+)/.exec(clean);
    const iMatch = /initial=(\w+)/.exec(clean);
    const tMatch = /terminal=([^\s]+)/.exec(clean);
    return {
      kind: "State Machine Process",
      desc: `Declares workflow process on \`${res}\` tracking state via \`${sMatch ? sMatch[1] : "status"}\` (Starts in \`${iMatch ? iMatch[1] : "initial"}\`${tMatch ? `, terminates in \`${tMatch[1]}\`` : ""}).`
    };
  }

  // transition R.action from=... to=...
  if (clean.startsWith("transition ")) {
    const trans = clean.split(/\s+/)[1];
    const fMatch = /from=([^\s]+)/.exec(clean);
    const toMatch = /to=([^\s]+)/.exec(clean);
    const byMatch = /by=([^\s]+)/.exec(clean);
    const sepMatch = /separate=([^\s]+)/.exec(clean);
    const commentReq = clean.includes("comment=required");

    return {
      kind: "Workflow Transition",
      desc: `Allows ${byMatch ? byMatch[1] : "authorized users"} to transition from \`${fMatch ? fMatch[1] : ""}\` to \`${toMatch ? toMatch[1] : ""}\`.${sepMatch ? ` Prevents ${sepMatch[1]} from self-approving (separation of duty).` : ""}${commentReq ? " Mandatory audit comment required." : ""}`
    };
  }

  // invariant ...
  if (clean.startsWith("invariant ")) {
    const name = clean.split(/\s+/)[1];
    return {
      kind: "Semantic Invariant",
      desc: `Enforces strict business rule \`${name}\` across records before commits.`
    };
  }

  // highlight R.name when=...
  if (clean.startsWith("highlight ")) {
    const hName = clean.split(/\s+/)[1];
    const wMatch = /when="([^"]+)"/.exec(clean);
    const tMatch = /tone=(\w+)/.exec(clean);
    return {
      kind: "Semantic Highlight",
      desc: `Applies ${tMatch ? `${tMatch[1]} visual tone` : "visual highlight"} when condition \`${wMatch ? wMatch[1] : ""}\` is true.`
    };
  }

  // overview
  if (clean === "overview") {
    return {
      kind: "Dashboard Overview",
      desc: `Enables the top-level metrics overview dashboard experience.`
    };
  }

  // insight R.name op=...
  if (clean.startsWith("insight ")) {
    const iName = clean.split(/\s+/)[1];
    const opMatch = /op=(\w+)/.exec(clean);
    const fMatch = /field=(\w+)/.exec(clean);
    const lMatch = /label="([^"]+)"/.exec(clean);
    return {
      kind: "Aggregate Insight",
      desc: `Computes ${opMatch ? opMatch[1] : "count"} aggregate${fMatch ? ` on \`${fMatch[1]}\`` : ""} and displays it as "${lMatch ? lMatch[1] : iName}" on the dashboard.`
    };
  }

  // notify name ...
  if (clean.startsWith("notify ")) {
    const nName = clean.split(/\s+/)[1];
    const wMatch = /when="([^"]+)"/.exec(clean);
    const tMatch = /tone=(\w+)/.exec(clean);
    return {
      kind: "Notification Edge Trigger",
      desc: `Emits an edge-triggered notification in the Notification Center when \`${wMatch ? wMatch[1] : ""}\` transitions from false to true.`
    };
  }

  return {
    kind: "Declaration",
    desc: `AIR semantic declaration: \`${clean}\``
  };
}

function renderExplainTab(source) {
  if (!explainCardsList) return;
  const lines = source.split("\n");
  const cards = [];

  lines.forEach((line, idx) => {
    const info = explainDeclarationLine(line);
    if (info) {
      cards.push(`
        <div class="explain-card" data-line="${idx + 1}">
          <div class="explain-card-header">
            <span class="explain-line-badge">Line ${idx + 1}</span>
            <span class="explain-kind-badge">${info.kind}</span>
          </div>
          <code class="explain-card-code">${escapeHtml(line.trim())}</code>
          <div class="explain-card-body">${info.desc}</div>
        </div>
      `);
    }
  });

  explainCardsList.innerHTML = cards.length > 0 ? cards.join("") : `<div class="p-4 text-slate-500">No declarations found</div>`;
}

function showLineExplanation(lineNumber, lineText) {
  if (!lineExplainStrip) return;
  const info = explainDeclarationLine(lineText);
  if (!info) {
    lineExplainStrip.classList.add("hidden");
    return;
  }

  lineExplainStrip.classList.remove("hidden");
  const stripKind = document.getElementById("strip-line-kind");
  const stripSummary = document.getElementById("strip-line-summary");
  if (stripKind) stripKind.textContent = info.kind;
  if (stripSummary) stripSummary.textContent = info.desc;

  if (stripLineBadge) stripLineBadge.textContent = `Line ${lineNumber}`;
  if (stripLineCode) stripLineCode.textContent = lineText.trim();
  if (stripLineDesc) stripLineDesc.textContent = info.desc;
}

// ============================================================
// DOCUMENTATION READER CONTROLLER
// ============================================================

async function loadDoc(docId) {
  const docMeta = DOCS.find((d) => d.id === docId) || DOCS[0];
  currentDocId = docMeta.id;

  document.querySelectorAll(".docs-nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.doc === currentDocId);
  });

  const breadcrumb = document.getElementById("docs-breadcrumb");
  if (breadcrumb) {
    breadcrumb.textContent = `Documentation / ${docMeta.section} / ${docMeta.title}`;
  }

  const githubBtn = document.getElementById("docs-github-edit-btn");
  if (githubBtn) {
    githubBtn.href = `https://github.com/joaquimpsoares/AIR/blob/main/docs/${currentDocId}.md`;
  }

  const idx = DOCS.findIndex((d) => d.id === currentDocId);
  const prevBtn = document.getElementById("docs-btn-prev");
  const nextBtn = document.getElementById("docs-btn-next");
  const prevLabel = document.getElementById("docs-label-prev");
  const nextLabel = document.getElementById("docs-label-next");

  if (prevBtn) {
    if (idx > 0) {
      prevBtn.classList.remove("hidden");
      if (prevLabel) prevLabel.textContent = DOCS[idx - 1].title;
    } else {
      prevBtn.classList.add("hidden");
    }
  }

  if (nextBtn) {
    if (idx < DOCS.length - 1) {
      nextBtn.classList.remove("hidden");
      if (nextLabel) nextLabel.textContent = DOCS[idx + 1].title;
    } else {
      nextBtn.classList.add("hidden");
    }
  }

  const articleBody = document.getElementById("docs-article-body");
  if (!articleBody) return;

  articleBody.innerHTML = `<div class="p-8 text-center text-slate-400">Loading document...</div>`;

  try {
    let md = "";
    const docPaths = [
      `docs/${currentDocId}.md`,
      `../docs/${currentDocId}.md`,
      `/docs/${currentDocId}.md`,
      `/web/docs/${currentDocId}.md`
    ];

    for (const p of docPaths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          md = await res.text();
          break;
        }
      } catch {
        // try next path
      }
    }

    if (md) {
      articleBody.innerHTML = renderMarkdown(md);
      articleBody.querySelectorAll("a").forEach((link) => {
        const href = link.getAttribute("href");
        if (href && (href.startsWith("docs/") || href.endsWith(".md"))) {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            const cleanId = href.replace(/^(\.\.\/|docs\/)/, "").replace(/\.md$/, "");
            const targetDoc = DOCS.find((d) => d.id === cleanId || d.id.endsWith(cleanId));
            if (targetDoc) {
              loadDoc(targetDoc.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          });
        }
      });
    } else {
      articleBody.innerHTML = `<div class="p-8 text-center text-rose-400">Could not load document: ${currentDocId}.md</div>`;
    }
  } catch (err) {
    articleBody.innerHTML = `<div class="p-8 text-center text-rose-400">Error loading document: ${err.message}</div>`;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(md) {
  if (!md) return "";

  const lines = md.split("\n");
  let html = "";
  let inCodeBlock = false;
  let codeLang = "";
  let codeContent = [];
  let inTable = false;
  let tableHeaderParsed = false;
  let tableRows = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeContent = [];
      } else {
        inCodeBlock = false;
        html += `<pre><code class="language-${codeLang}">${escapeHtml(codeContent.join("\n"))}</code></pre>\n`;
        codeContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableHeaderParsed = false;
        tableRows = [];
      }
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
        tableHeaderParsed = true;
        continue;
      }
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      tableRows.push({ isHeader: !tableHeaderParsed, cells });
      continue;
    } else if (inTable) {
      inTable = false;
      html += renderTableHtml(tableRows);
      tableRows = [];
    }

    if (inList && !line.trim().startsWith("- ") && !line.trim().startsWith("* ") && !/^\d+\.\s/.test(line.trim()) && line.trim().length === 0) {
      html += "</ul>\n";
      inList = false;
    }

    if (!line.trim()) continue;

    if (line.startsWith("# ")) {
      html += `<h1>${formatInline(line.slice(2))}</h1>\n`;
    } else if (line.startsWith("## ")) {
      html += `<h2>${formatInline(line.slice(3))}</h2>\n`;
    } else if (line.startsWith("### ")) {
      html += `<h3>${formatInline(line.slice(4))}</h3>\n`;
    } else if (line.startsWith("#### ")) {
      html += `<h4>${formatInline(line.slice(5))}</h4>\n`;
    } else if (line.startsWith("> ")) {
      html += `<blockquote>${formatInline(line.slice(2))}</blockquote>\n`;
    } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      html += `<li>${formatInline(line.trim().slice(2))}</li>\n`;
    } else if (/^\d+\.\s/.test(line.trim())) {
      if (!inList) {
        html += "<ol>\n";
        inList = true;
      }
      html += `<li>${formatInline(line.trim().replace(/^\d+\.\s/, ""))}</li>\n`;
    } else if (line.trim() === "---" || line.trim() === "***") {
      html += `<hr style="border:0;border-top:1px solid var(--border-color);margin:24px 0;" />\n`;
    } else {
      html += `<p>${formatInline(line)}</p>\n`;
    }
  }

  if (inTable) html += renderTableHtml(tableRows);
  if (inList) html += "</ul>\n";

  return html;
}

function renderTableHtml(rows) {
  if (rows.length === 0) return "";
  let out = `<table>\n<thead>\n<tr>\n`;
  const headerRow = rows.find((r) => r.isHeader) || rows[0];
  headerRow.cells.forEach((cell) => {
    out += `<th>${formatInline(cell)}</th>\n`;
  });
  out += `</tr>\n</thead>\n<tbody>\n`;

  rows.filter((r) => !r.isHeader).forEach((row) => {
    out += `<tr>\n`;
    row.cells.forEach((cell) => {
      out += `<td>${formatInline(cell)}</td>\n`;
    });
    out += `</tr>\n`;
  });
  out += `</tbody>\n</table>\n`;
  return out;
}

function formatInline(text) {
  let str = escapeHtml(text);
  str = str.replace(/`([^`]+)`/g, "<code>$1</code>");
  str = str.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  str = str.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="docs-link">$1</a>');
  return str;
}

function formatNum(val, fallback = "—") {
  if (val === null || val === undefined || isNaN(Number(val))) return fallback;
  return Number(val).toLocaleString();
}

function updateMetricsAndComparisons(exampleId) {
  if (!benchmarkResults || !benchmarkResults.examples) return;
  const data = benchmarkResults.examples.find((e) => e.id === exampleId);
  if (!data) {
    if (heroRatioBadge) heroRatioBadge.style.display = "none";
    if (footprintTbody) footprintTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500">Benchmark metrics not applicable for blank/custom project</td></tr>`;
    if (modificationsList) modificationsList.innerHTML = `<div class="text-sm text-slate-400 p-4">Blank project has no modification history.</div>`;
    return;
  }

  if (heroRatioValue && heroRatioBadge) {
    if (data.sourceCompressionRatio) {
      heroRatioValue.textContent = `${data.sourceCompressionRatio}x`;
      heroRatioBadge.style.display = "flex";
    } else {
      heroRatioBadge.style.display = "none";
    }
  }

  const conv = data.conventional;
  const isConvMeasured = Boolean(conv && conv.filesCount);

  if (footprintTbody) {
    footprintTbody.innerHTML = `
      <tr>
        <td><strong>App Source cl100k Tokens</strong></td>
        <td class="highlight-val">${formatNum(data.air?.llmTokens)} tokens</td>
        <td>${isConvMeasured ? `${formatNum(conv?.llmTokens)} tokens` : `<span class="status-pill yellow">${conv?.status || "Pending"}</span>`}</td>
        <td><strong>${data.sourceCompressionRatio ? `${data.sourceCompressionRatio}x compression` : "—"}</strong></td>
      </tr>
      <tr>
        <td><strong>Canonical AIR Tokens</strong></td>
        <td>${formatNum(data.air?.canonicalTokens)} tokens</td>
        <td>—</td>
        <td>Language syntax complexity</td>
      </tr>
      <tr>
        <td><strong>Application Files</strong></td>
        <td>${data.air?.files || 1} file</td>
        <td>${isConvMeasured ? `${conv.filesCount} files` : "—"}</td>
        <td>${isConvMeasured ? `${conv.filesCount}:1 files` : "—"}</td>
      </tr>
      <tr>
        <td><strong>Lines of Code (LOC)</strong></td>
        <td>${formatNum(data.air?.loc)} LOC</td>
        <td>${isConvMeasured ? `${formatNum(conv?.loc)} LOC` : "—"}</td>
        <td>${isConvMeasured && data.air?.loc ? `${Math.round(conv.loc / data.air.loc)}x less code` : "—"}</td>
      </tr>
      <tr>
        <td><strong>Handwritten JS/TS</strong></td>
        <td><strong>0 lines</strong></td>
        <td>${isConvMeasured ? `${formatNum(conv?.jsTokens)} tokens` : "—"}</td>
        <td>100% compiler-owned UI & state</td>
      </tr>
      <tr>
        <td><strong>Handwritten CSS</strong></td>
        <td><strong>0 lines</strong></td>
        <td>${isConvMeasured ? `${formatNum(conv?.cssTokens)} tokens` : "—"}</td>
        <td>100% runtime-owned responsive design</td>
      </tr>
    `;
  }

  if (modificationsList) {
    if (data.modifications && data.modifications.length > 0) {
      modificationsList.innerHTML = data.modifications
        .map(
          (m) => `
          <div class="mod-item">
            <div class="mod-header">
              <span class="mod-name">${m.name}</span>
              <span class="mod-ratio">${m.patchRatio ? `${m.patchRatio}x patch compression` : "Measured"}</span>
            </div>
            <div class="mod-desc">${m.description}</div>
            <div class="mod-metrics-row">
              <div class="metric-mini">
                <span class="mini-label">AIR Patch:</span>
                <span class="mini-val">${formatNum(m.air?.patchTokens)} tokens (${formatNum(m.air?.patchLoc)} LOC)</span>
              </div>
              <div class="metric-mini">
                <span class="mini-label">AIR Context:</span>
                <span class="mini-val">${formatNum(m.air?.contextTokens)} tokens</span>
              </div>
              ${
                m.conventional
                  ? `
                <div class="metric-mini">
                  <span class="mini-label">Conventional Patch:</span>
                  <span class="mini-val">${formatNum(m.conventional.patchTokens)} tokens (${formatNum(m.conventional.patchLoc)} LOC)</span>
                </div>
                <div class="metric-mini">
                  <span class="mini-label">Conventional Context:</span>
                  <span class="mini-val">${formatNum(m.conventional.contextTokens)} tokens (${m.conventional.filesChanged || 0} files)</span>
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `
        )
        .join("");
    } else {
      modificationsList.innerHTML = `<div class="text-sm text-slate-400 p-4">Detailed modifications pending for this example.</div>`;
    }
  }

  if (removedScaffoldingContent) {
    removedScaffoldingContent.innerHTML = `
      <div class="scaffolding-box">
        <h5>❌ Replaced Conventional UI Boilerplate</h5>
        <ul>
          <li>Data table sorting, filtering & search logic</li>
          <li>Responsive card list transformations</li>
          <li>Slide-over drawer animation & focus trapping</li>
          <li>Form state synchronization & field dirty tracking</li>
        </ul>
      </div>
      <div class="scaffolding-box">
        <h5>❌ Replaced Duplicate Validation</h5>
        <ul>
          <li>Redundant client/server validation schemas</li>
          <li>Unique email constraint validation checks</li>
          <li>Enum synchronization across disparate files</li>
        </ul>
      </div>
      <div class="scaffolding-box">
        <h5>❌ Replaced State Management Mechanics</h5>
        <ul>
          <li>Redux/Zustand action/reducer boilerplate</li>
          <li>REST/CRUD endpoint boilerplate</li>
          <li>Dirty state discard guard tracking</li>
        </ul>
      </div>
      <div class="scaffolding-box">
        <h5>✅ Moved into Reusable Compiler/Runtime</h5>
        <ul>
          <li>Deterministic IR compilation</li>
          <li>Zero-drift type consistency</li>
          <li>Accessible keyboard & ARIA primitives</li>
        </ul>
      </div>
    `;
  }

  if (convFileList && convFileCode) {
    if (isConvMeasured && conv.files && conv.files.length > 0) {
      convFileList.innerHTML = "";
      conv.files.forEach((f, idx) => {
        const btn = document.createElement("button");
        btn.className = `file-item-btn ${idx === 0 ? "active" : ""}`;
        btn.textContent = f.file.split("/").pop();
        btn.title = f.file;
        btn.addEventListener("click", async () => {
          document.querySelectorAll(".file-item-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          loadConventionalFileContent(f.file);
        });
        convFileList.appendChild(btn);
      });
      loadConventionalFileContent(conv.files[0].file);
    } else {
      convFileList.innerHTML = `<span class="text-xs text-slate-500 p-2">Reference source not loaded</span>`;
      convFileCode.textContent = "// Conventional reference implementation pending for this example.";
    }
  }
}

async function loadConventionalFileContent(filePath) {
  if (!convFileCode) return;
  try {
    const res = await fetch(`../${filePath}`);
    if (res.ok) {
      convFileCode.textContent = await res.text();
    } else {
      convFileCode.textContent = `// Could not load ${filePath}`;
    }
  } catch {
    convFileCode.textContent = `// Error loading ${filePath}`;
  }
}

function setupInventoryNotificationDemo() {
  const step1 = document.getElementById("demo-step-1");
  const step2 = document.getElementById("demo-step-2");
  const step3 = document.getElementById("demo-step-3");
  const step4 = document.getElementById("demo-step-4");
  const statusEl = document.getElementById("demo-step-status");

  function setStock(qty) {
    if (!currentRuntimeInstance) return;
    try {
      const records = currentRuntimeInstance.records("inventory_balances");
      const target = records.find((r) => r.id === "bal_01") || records[0];
      if (target) {
        currentRuntimeInstance.update("inventory_balances", target.id, {
          quantity_on_hand: qty
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (step1) {
    step1.addEventListener("click", () => {
      setStock(8);
      if (statusEl) statusEl.textContent = "Step 1 applied: Stock 12 -> 8 (Condition false -> true, Bell badge incremented!)";
    });
  }
  if (step2) {
    step2.addEventListener("click", () => {
      setStock(7);
      if (statusEl) statusEl.textContent = "Step 2 applied: Stock 8 -> 7 (Condition remained true, no duplicate notification emitted)";
    });
  }
  if (step3) {
    step3.addEventListener("click", () => {
      setStock(15);
      if (statusEl) statusEl.textContent = "Step 3 applied: Stock 7 -> 15 (Condition cleared back to false)";
    });
  }
  if (step4) {
    step4.addEventListener("click", () => {
      setStock(9);
      if (statusEl) statusEl.textContent = "Step 4 applied: Stock 15 -> 9 (Condition false -> true, New notification emitted!)";
    });
  }
}

async function loadHomepageLiveProof() {
  const codeEl = document.getElementById("home-proof-air-code");
  const homeAppRoot = document.getElementById("home-live-app-root");
  if (!codeEl && !homeAppRoot) return;

  const defaultBuiltin = BUILTIN_EXAMPLES["customer-manager"];
  if (defaultBuiltin) {
    if (codeEl && (!codeEl.textContent || codeEl.textContent.trim().length === 0)) {
      codeEl.textContent = defaultBuiltin.air;
    }
    if (homeAppRoot && !homeLiveAppInstance) {
      homeAppRoot.innerHTML = "";
      homeLiveAppInstance = mountAirApp(homeAppRoot, defaultBuiltin.air, {
        mode: "embedded",
        seedSource: defaultBuiltin.seed,
        principal: { roles: ["admin"] },
        storage: typeof window !== "undefined" ? window.sessionStorage : null,
        namespace: "showcase:home:customer-manager"
      });
    }
  }

  try {
    let airText = "";
    let seedText = "";

    const paths = [
      ["showcase/customer-manager/app.air", "showcase/customer-manager/seed.json"],
      ["../showcase/customer-manager/app.air", "../showcase/customer-manager/seed.json"]
    ];

    for (const [airPath, seedPath] of paths) {
      try {
        const [airRes, seedRes] = await Promise.all([fetch(airPath), fetch(seedPath)]);
        if (airRes.ok && seedRes.ok) {
          airText = await airRes.text();
          seedText = await seedRes.text();
          break;
        }
      } catch {
        // continue to next path fallback
      }
    }

    if (airText && codeEl) {
      codeEl.textContent = airText;
    }

    if (airText && homeAppRoot && (!homeLiveAppInstance || airText !== defaultBuiltin?.air)) {
      if (homeLiveAppInstance) {
        if (typeof homeLiveAppInstance.dispose === "function") homeLiveAppInstance.dispose();
        else if (typeof homeLiveAppInstance.destroy === "function") homeLiveAppInstance.destroy();
        homeLiveAppInstance = null;
      }
      homeAppRoot.innerHTML = "";
      homeLiveAppInstance = mountAirApp(homeAppRoot, airText, {
        mode: "embedded",
        seedSource: seedText || "{}",
        principal: { roles: ["admin"] },
        storage: typeof window !== "undefined" ? window.sessionStorage : null,
        namespace: "showcase:home:customer-manager"
      });
    }
  } catch (err) {
    console.warn("Could not load homepage live proof:", err);
  }
}

function applyPreviewScaling() {
  if (!liveAppRoot) return;
  const container = document.getElementById("preview-container");
  if (!container) return;

  if (currentPreviewScaleMode === "actual") {
    liveAppRoot.style.width = currentViewportWidth === "100%" ? "100%" : currentViewportWidth;
    liveAppRoot.style.maxWidth = currentViewportWidth === "100%" ? "100%" : currentViewportWidth;
    liveAppRoot.style.height = "100%";
    liveAppRoot.style.transform = "none";
    liveAppRoot.style.transformOrigin = "top left";
    container.style.overflow = "auto";
    const dimInd = document.getElementById("dimension-indicator");
    if (dimInd) dimInd.textContent = currentViewportWidth === "100%" ? "Actual (100%)" : `Actual (${currentViewportWidth})`;
    return;
  }

  // Fit mode
  const padW = 24;
  const padH = 24;
  const availW = Math.max((container.clientWidth || 800) - padW, 100);
  const availH = Math.max((container.clientHeight || 600) - padH, 100);

  let targetLogicalW = 1200;
  let targetLogicalH = 720;
  if (currentViewportWidth === "390px") {
    targetLogicalW = 390;
    targetLogicalH = 780;
  } else if (currentViewportWidth === "768px") {
    targetLogicalW = 768;
    targetLogicalH = 840;
  } else {
    targetLogicalW = 1200;
    targetLogicalH = 720;
  }

  const scaleW = availW / targetLogicalW;
  const scaleH = availH / targetLogicalH;
  const scale = Math.min(scaleW, scaleH, 1);

  liveAppRoot.style.maxWidth = "none";
  liveAppRoot.style.width = `${targetLogicalW}px`;
  liveAppRoot.style.height = `${targetLogicalH}px`;
  liveAppRoot.style.transform = `scale(${scale})`;
  liveAppRoot.style.transformOrigin = "top center";
  container.style.overflow = "hidden";

  const dimInd = document.getElementById("dimension-indicator");
  if (dimInd) {
    const pct = Math.round(scale * 100);
    dimInd.textContent = `Fit (${pct}%)`;
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

export {
  EXAMPLES,
  BUILTIN_EXAMPLES,
  MINIMAL_AIR_STARTER,
  DOCS,
  setEditorSource,
  syncSourceEditor,
  setInspectorTab,
  loadExample,
  attemptCompileAndMount,
  performClear,
  switchView,
  explainDeclarationLine,
  sanitizeSeedForModel,
  renderMarkdown,
  formatInline,
  formatNum,
  applyPreviewScaling,
  loadHomepageLiveProof
};

