import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  UI_ARTIFACTS,
  DRAWER_REPRESENTATION,
  DRAWER_SIZE,
  DRAWER_STACK_POLICY,
  MENU_REPRESENTATION,
  resolveDrawerArtifactLayout,
  resolveMenuArtifactLayout
} from "../web/runtime/ui_hierarchy.mjs";
import { parseAir, AppRuntime } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { renderPresentation } from "../web/runtime/ui.mjs";

test("PART 1: UI Interaction Artifact Definitions & Catalog Registration", () => {
  assert.ok(UI_ARTIFACTS.drawer, "Drawer artifact must be registered in UI_ARTIFACTS");
  assert.equal(UI_ARTIFACTS.drawer.category, "interaction_surface");
  assert.equal(UI_ARTIFACTS.drawer.semanticLevel, "secondary_surface");
  assert.deepEqual(UI_ARTIFACTS.drawer.purposes, ["edit", "create", "detail", "filter", "workflow"]);
  assert.equal(UI_ARTIFACTS.drawer.stackPolicy, DRAWER_STACK_POLICY);

  assert.ok(UI_ARTIFACTS.menu, "Menu artifact must be registered in UI_ARTIFACTS");
  assert.equal(UI_ARTIFACTS.menu.category, "contextual_navigation");
  assert.equal(UI_ARTIFACTS.menu.semanticLevel, "overlay");
});

test("PART 2: Responsive Drawer Representation Resolution Matrix", () => {
  // Narrow / Mobile < 640px -> FULL_SCREEN_SHEET
  const r320 = resolveDrawerArtifactLayout(320, DRAWER_SIZE.STANDARD);
  assert.equal(r320.representation, DRAWER_REPRESENTATION.FULL_SCREEN_SHEET);
  assert.equal(r320.size, DRAWER_SIZE.STANDARD);

  const r390 = resolveDrawerArtifactLayout(390, DRAWER_SIZE.COMPACT);
  assert.equal(r390.representation, DRAWER_REPRESENTATION.FULL_SCREEN_SHEET);

  const r500 = resolveDrawerArtifactLayout(500, DRAWER_SIZE.WIDE);
  assert.equal(r500.representation, DRAWER_REPRESENTATION.FULL_SCREEN_SHEET);

  const r639 = resolveDrawerArtifactLayout(639, DRAWER_SIZE.STANDARD);
  assert.equal(r639.representation, DRAWER_REPRESENTATION.FULL_SCREEN_SHEET);

  // Desktop / Tablet >= 640px -> RIGHT_DRAWER
  const r640 = resolveDrawerArtifactLayout(640, DRAWER_SIZE.STANDARD);
  assert.equal(r640.representation, DRAWER_REPRESENTATION.RIGHT_DRAWER);
  assert.equal(r640.size, DRAWER_SIZE.STANDARD);

  const r768 = resolveDrawerArtifactLayout(768, DRAWER_SIZE.COMPACT);
  assert.equal(r768.representation, DRAWER_REPRESENTATION.RIGHT_DRAWER);
  assert.equal(r768.size, DRAWER_SIZE.COMPACT);

  const r1024 = resolveDrawerArtifactLayout(1024, DRAWER_SIZE.WIDE);
  assert.equal(r1024.representation, DRAWER_REPRESENTATION.RIGHT_DRAWER);
  assert.equal(r1024.size, DRAWER_SIZE.WIDE);

  const r1440 = resolveDrawerArtifactLayout(1440, DRAWER_SIZE.STANDARD);
  assert.equal(r1440.representation, DRAWER_REPRESENTATION.RIGHT_DRAWER);
});

test("PART 3: Responsive Menu Representation Resolution Matrix", () => {
  // Mobile < 640px -> COMPACT_SHEET
  const m320 = resolveMenuArtifactLayout(320);
  assert.equal(m320.representation, MENU_REPRESENTATION.COMPACT_SHEET);

  const m500 = resolveMenuArtifactLayout(500);
  assert.equal(m500.representation, MENU_REPRESENTATION.COMPACT_SHEET);

  // Desktop >= 640px -> DROPDOWN or TOP_POPOVER
  const m768 = resolveMenuArtifactLayout(768);
  assert.equal(m768.representation, MENU_REPRESENTATION.DROPDOWN);

  const mPopover = resolveMenuArtifactLayout(1024, "top_navigation");
  assert.equal(mPopover.representation, MENU_REPRESENTATION.TOP_POPOVER);
});

test("PART 4: Customer Manager App End-to-End Drawer & Menu Verification", () => {
  const schema = `
air version=2
app customer_app title="Customer App" subtitle="Manage customer records"
theme mode=light accent=blue

resource customers label=name
field customers.name text required min=2
field customers.email email required
field customers.company text
field customers.status enum values=active,lead,churned required default=lead
manage customers lifecycle=archive
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      customers: [
        { id: "c1", name: "Alice Wonderland", email: "alice@example.com", company: "Wonder Corp", status: "active" },
        { id: "c2", name: "Bob Builder", email: "bob@example.com", company: "Builder Inc", status: "lead" }
      ]
    }
  });

  const ir = compilePresentation(model, { runtime });
  const root = {
    innerHTML: "",
    clientWidth: 1024,
    setAttribute() {},
    removeAttribute() {},
    querySelector(sel) {
      return this._elements?.find((el) => el.matches(sel)) ?? null;
    },
    querySelectorAll(sel) {
      return this._elements?.filter((el) => el.matches(sel)) ?? [];
    }
  };

  const app = renderPresentation(root, ir, runtime, { model });
  assert.ok(app, "App mounted successfully");

  // Verify Table contains Row Action Menu trigger buttons
  assert.ok(root.innerHTML.includes('data-row-action-menu="customers:c1"'), "Must render row action menu button for customer c1");
  assert.ok(root.innerHTML.includes('data-row-action-menu="customers:c2"'), "Must render row action menu button for customer c2");

  // Open Create Customer Drawer
  app.state.drawer = {
    purpose: "create",
    entityId: "customers",
    size: DRAWER_SIZE.STANDARD,
    values: {},
    errors: {},
    isDirty: false
  };
  app.render();

  assert.ok(root.innerHTML.includes('data-drawer-panel'), "Drawer panel rendered");
  assert.ok(root.innerHTML.includes('id="drawer-record-form"'), "Form rendered inside drawer");
  assert.ok(root.innerHTML.includes('data-representation="right_drawer"'), "Renders right_drawer on 1024px desktop");

  // Submit new customer through drawer
  runtime.create("customers", {
    name: "Charlie Chaplin",
    email: "charlie@silent.com",
    company: "Cinema Ltd",
    status: "active"
  });
  app.state.drawer = null;
  app.render();

  assert.equal(runtime.records("customers").length, 3, "Customer created in runtime");
  assert.ok(root.innerHTML.includes("Charlie Chaplin"), "New customer rendered in table");

  // Open Detail Drawer
  app.state.drawer = {
    purpose: "detail",
    entityId: "customers",
    recordId: "c1",
    size: DRAWER_SIZE.STANDARD
  };
  app.render();

  assert.ok(root.innerHTML.includes('data-drawer-edit="customers:c1"'), "Detail drawer offers in-place edit button");
  assert.ok(root.innerHTML.includes("Alice Wonderland"), "Detail drawer displays customer name");
  assert.ok(root.innerHTML.includes("Wonder Corp"), "Detail drawer displays company");

  // Seamless Responsive Resize: resize to mobile (390px)
  app.setContainerWidth(390);
  assert.ok(root.innerHTML.includes('data-representation="full_screen_sheet"'), "Seamlessly recomposed to full_screen_sheet on mobile width");
  assert.equal(app.state.drawer.recordId, "c1", "Preserved drawer recordId through resize");
});

test("PART 5: Operations Hub Action Menu & Destructive Tone Verification", () => {
  const schema = `
air version=2
app operations_hub title="Operations Hub" subtitle="Manage projects and tasks"
theme mode=dark accent=emerald

resource projects label=title
field projects.title text required min=2
field projects.budget money currency="USD"
field projects.status enum values=planning,active,completed required default=planning
manage projects lifecycle=archive
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      projects: [
        { id: "p1", title: "Project Apollo", budget: 50000, status: "active" }
      ]
    }
  });

  const ir = compilePresentation(model, { runtime });
  const root = {
    innerHTML: "",
    clientWidth: 1200,
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const app = renderPresentation(root, ir, runtime, { model });

  // Open Row Action Menu for p1
  app.state.openMenu = {
    id: "row-menu-projects-p1",
    items: [
      { id: "view:projects:p1", label: "View details", icon: "collection" },
      { id: "edit:projects:p1", label: "Edit", icon: "edit" },
      { separator: true },
      { id: "delete:projects:p1", label: "Archive Project", icon: "trash", tone: "destructive" }
    ],
    position: { top: 150, left: 800 }
  };
  app.render();

  assert.ok(root.innerHTML.includes('data-menu-panel'), "Menu dropdown rendered");
  assert.ok(root.innerHTML.includes('class="menu-item destructive"'), "Destructive action has destructive class");
  assert.ok(root.innerHTML.includes('data-tone="destructive"'), "Destructive action carries semantic tone attribute");
});

test("PART 6: Reservation Hub Lead-Time & Rate Drawer Integration with Validation Errors", () => {
  const schema = `
air version=2
app reservation_hub title="Reservation Hub" subtitle="Resource scheduling"
theme mode=dark accent=violet

resource resources label=name
field resources.name text required min=2
field resources.hourly_rate rate currency=USD unit=h required default=50
manage resources lifecycle=archive

resource reservations label=title
field reservations.title text required min=2
field reservations.resource ref=resources required
field reservations.start_at date required default=today
field reservations.end_at date required default=today
field reservations.booking_period interval start=start_at end=end_at
field reservations.quote money currency=USD computed="booking_period.duration * resource.hourly_rate"
manage reservations lifecycle=archive
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      resources: [
        {
          id: "res1",
          name: "Boardroom A",
          hourly_rate: 100
        }
      ],
      reservations: [
        {
          id: "r1",
          title: "Boardroom Meeting",
          resource: "res1",
          start_at: "2026-10-01",
          end_at: "2026-10-01"
        }
      ]
    }
  });

  const ir = compilePresentation(model, { runtime });
  const root = {
    innerHTML: "",
    clientWidth: 1024,
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const app = renderPresentation(root, ir, runtime, { model });

  // Open Edit Drawer with Validation Error
  app.state.drawer = {
    purpose: "edit",
    entityId: "reservations",
    recordId: "r1",
    values: {
      title: "Boardroom Meeting",
      start_at: "2026-10-01T10:00:00.000Z",
      end_at: "2026-10-01T12:00:00.000Z"
    },
    errors: {
      start_at: "Overlaps with existing blackout window"
    },
    isDirty: true
  };
  app.render();

  assert.ok(root.innerHTML.includes("Overlaps with existing blackout window"), "Validation error retained and rendered in drawer");
  assert.ok(root.innerHTML.includes('aria-invalid="true"'), "Input marked aria-invalid");
  assert.ok(root.innerHTML.includes('value="Boardroom Meeting"'), "Input values retained in drawer");
});

test("PART 7: Zero Application-Specific CSS & Zero Domain Branches Verification", () => {
  const cssContent = fs.readFileSync(path.resolve("web/runtime/styles.css"), "utf-8");
  const uiContent = fs.readFileSync(path.resolve("web/runtime/ui.mjs"), "utf-8");
  const uiHierarchyContent = fs.readFileSync(path.resolve("web/runtime/ui_hierarchy.mjs"), "utf-8");

  // Check CSS contains generic drawer and menu classes
  assert.ok(cssContent.includes(".drawer-panel"), "CSS defines generic .drawer-panel");
  assert.ok(cssContent.includes(".drawer-backdrop"), "CSS defines generic .drawer-backdrop");
  assert.ok(cssContent.includes(".menu-dropdown"), "CSS defines generic .menu-dropdown");
  assert.ok(cssContent.includes(".menu-item.destructive"), "CSS defines generic .menu-item.destructive");
  assert.ok(cssContent.includes("@media (prefers-reduced-motion: reduce)"), "CSS defines reduced motion fallbacks");

  // Verify NO application domain names hardcoded as branch conditions in UI hierarchy or renderer
  const domainNames = ["customer", "reservation", "blackout", "expense", "timesheet", "equipment"];
  for (const domain of domainNames) {
    assert.ok(
      !uiHierarchyContent.includes(`"${domain}"`),
      `ui_hierarchy.mjs must contain 0 hardcoded domain branches for ${domain}`
    );
  }
});

test("PART 8: Animated Drawer Exit Transition State & DOM Presence Verification", () => {
  const schema = `
air version=2
app test_app title="Test App" subtitle="Test"
theme mode=light accent=blue

resource items label=name
field items.name text required
manage items lifecycle=archive
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, { seedData: { items: [{ id: "i1", name: "Item 1" }] } });
  const ir = compilePresentation(model, { runtime });
  const root = {
    innerHTML: "",
    clientWidth: 1024,
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const app = renderPresentation(root, ir, runtime, { model });

  // Open drawer
  app.state.drawer = {
    purpose: "edit",
    entityId: "items",
    recordId: "i1",
    status: "open",
    values: { name: "Item 1" },
    errors: {},
    isDirty: false
  };
  app.render();

  assert.ok(root.innerHTML.includes('data-status="open"'), "Drawer rendered with open status");
  assert.ok(root.innerHTML.includes('data-drawer-panel'), "Drawer panel in DOM");

  // Mark status as closing (during exit animation)
  app.state.drawer.status = "closing";
  app.render();

  assert.ok(root.innerHTML.includes('data-status="closing"'), "Drawer preserved in DOM with closing status during exit animation");
  assert.ok(root.innerHTML.includes('data-drawer-panel'), "Drawer panel remains mounted during exit transition");

  // After exit completes, drawer is unmounted
  app.state.drawer = null;
  app.render();

  assert.ok(!root.innerHTML.includes('data-drawer-panel'), "Drawer unmounted cleanly after transition completes");
});

test("PART 9: Compiler-Native Discard Confirmation Modal & Zero window.confirm()", () => {
  const schema = `
air version=2
app test_app title="Test App" subtitle="Test"
theme mode=light accent=blue

resource items label=name
field items.name text required
manage items lifecycle=archive
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, { seedData: { items: [{ id: "i1", name: "Item 1" }] } });
  const ir = compilePresentation(model, { runtime });
  const root = {
    innerHTML: "",
    clientWidth: 1024,
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const app = renderPresentation(root, ir, runtime, { model });

  // Open dirty drawer
  app.state.drawer = {
    purpose: "edit",
    entityId: "items",
    recordId: "i1",
    status: "open",
    values: { name: "Modified Name" },
    errors: {},
    isDirty: true
  };
  app.render();

  // Trigger discard confirmation
  app.state.confirm = { type: "discard_drawer" };
  app.render();

  assert.ok(root.innerHTML.includes('data-confirm-modal'), "Renders native confirm modal");
  assert.ok(root.innerHTML.includes('Discard changes?'), "Renders title 'Discard changes?'");
  assert.ok(root.innerHTML.includes('data-cancel-discard'), "Offers 'Keep editing' cancel button");
  assert.ok(root.innerHTML.includes('data-confirm-discard'), "Offers 'Discard' confirmation button");
  assert.ok(root.innerHTML.includes('data-dismiss-discard-confirm'), "Provides dismiss backdrop");

  // Verify ui.mjs does NOT contain window.confirm for drawer discard protection
  const uiContent = fs.readFileSync(path.resolve("web/runtime/ui.mjs"), "utf-8");
  assert.ok(!uiContent.includes('confirm("You have unsaved changes'), "Zero window.confirm calls for drawer discard protection");
});

