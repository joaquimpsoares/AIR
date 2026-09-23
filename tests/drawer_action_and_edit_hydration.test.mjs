import test from "node:test";
import assert from "node:assert/strict";
import { parseAir, AppRuntime } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { renderPresentation } from "../web/runtime/ui.mjs";

test("PART 1-16 & 24: Generic Edit Hydration, Defaults, Dirty State & Save Lifecycle", () => {
  const schema = `
air version=2
app reservation_hub title="Reservation Hub" subtitle="Resource scheduling" initial=reservations timezone="UTC"
theme mode=dark accent=violet

resource customers label=name
field customers.name text required
manage customers lifecycle=archive

resource resources label=name
field resources.name text required
field resources.hourly_rate rate currency=USD unit=h required default=50
manage resources lifecycle=archive

resource reservations label=title
field reservations.title text required
field reservations.customer ref=customers required
field reservations.resource ref=resources required
field reservations.start_at date required default=today
field reservations.end_at date required default=today
field reservations.booking_period interval start=start_at end=end_at
field reservations.attendees number required default=1
field reservations.amount money currency=USD required default=0
field reservations.status enum values=Requested,Confirmed,Completed,Cancelled required default=Requested
manage reservations lifecycle=archive
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      customers: [{ id: "cust_soylent", name: "Soylent Media Labs" }],
      resources: [{ id: "res_boardroom", name: "Executive Boardroom", hourly_rate: 100 }],
      reservations: [
        {
          id: "r1",
          title: "On-Demand Standup Meeting",
          customer: "cust_soylent",
          resource: "res_boardroom",
          start_at: "2026-09-22",
          end_at: "2026-09-22",
          attendees: 8,
          amount: 300,
          status: "Confirmed"
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

  const app = renderPresentation(root, ir, runtime, {
    model,
    initialScreen: "reservations"
  });

  // 1. DETAIL VIEW: Booking period composite value formatting (No [object Object])
  app.state.drawer = {
    purpose: "detail",
    entityId: "reservations",
    recordId: "r1",
    values: {},
    errors: {},
    isDirty: false
  };
  app.render();

  assert.ok(root.innerHTML.includes("On-Demand Standup Meeting"), "Renders detail title");
  assert.ok(!root.innerHTML.includes("[object Object]"), "Zero [object Object] in detail rendering");
  assert.ok(root.innerHTML.includes("Sep 22, 2026"), "Formatted date in detail display");
  assert.ok(root.innerHTML.includes("$300.00"), "Formatted money in detail display");

  // 2. DETAIL -> EDIT TRANSITION: Hydration from existing canonical record
  app.state.drawer = {
    purpose: "edit",
    entityId: "reservations",
    recordId: "r1"
  };
  app.render();

  // Verify form is populated with existing record values, NOT create defaults
  assert.ok(root.innerHTML.includes('value="On-Demand Standup Meeting"'), "Hydrates Title");
  assert.ok(root.innerHTML.includes('value="cust_soylent" selected'), "Selects Customer reference");
  assert.ok(root.innerHTML.includes('value="res_boardroom" selected'), "Selects Resource reference");
  assert.ok(root.innerHTML.includes('value="2026-09-22"'), "Hydrates start date");
  assert.ok(root.innerHTML.includes('value="8"'), "Hydrates Attendees (8, not default 1)");
  assert.ok(root.innerHTML.includes('value="300.00"'), "Hydrates Amount (300.00, not default 0)");

  // 3. CREATE MODE: Must use schema defaults
  app.state.drawer = {
    purpose: "create",
    entityId: "reservations",
    values: {
      attendees: 1,
      amount: 0
    }
  };
  app.render();

  assert.ok(!root.innerHTML.includes('value="On-Demand Standup Meeting"'), "Create mode is clean");
  assert.ok(root.innerHTML.includes('value="1"'), "Create mode uses default attendees 1");
  assert.ok(root.innerHTML.includes('value="0"'), "Create mode uses default amount 0");

  // 4. RESIZE & RERENDER PRESERVATION
  app.state.drawer = {
    purpose: "edit",
    entityId: "reservations",
    recordId: "r1",
    values: {
      title: "Modified Standup",
      attendees: 12
    },
    isDirty: true
  };
  app.setContainerWidth(390); // Mobile resize
  assert.ok(root.innerHTML.includes('value="Modified Standup"'), "Preserves modified title on resize");
  assert.ok(root.innerHTML.includes('value="12"'), "Preserves modified attendees on resize");
  assert.equal(app.state.drawer.isDirty, true, "Preserves dirty state");
});

test("PART 17-20: Semantic Formatters & Interval Presentation", () => {
  const schema = `
air version=2
app test_app title="Test App" subtitle="Testing formatters" initial=items
resource items label=name
field items.name text required
field items.period interval start=start_at end=end_at
field items.start_at date required
field items.end_at date required
manage items lifecycle=archive
`;
  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      items: [
        { id: "i1", name: "Range Item", start_at: "2026-10-01", end_at: "2026-10-05" }
      ]
    }
  });

  const display = runtime.displayValue("items", "period", { start: "2026-10-01", end: "2026-10-05" });
  assert.equal(display, "Oct 1, 2026 → Oct 5, 2026");
  assert.ok(!display.includes("[object Object]"), "Interval display does not return [object Object]");
});

test("PART 25: Generic Drawer Action Policy & Overflow Bounding", () => {
  const schema = `
air version=2
app test_app title="Test App" subtitle="Action Policy Test" initial=tasks
resource tasks label=title
field tasks.title text required
field tasks.status enum values=Pending,InReview,Approved,Rejected,Cancelled required default=Pending
manage tasks lifecycle=archive
process tasks state=status initial=Pending terminal=Approved,Rejected,Cancelled
transition tasks.review from=Pending to=InReview by=role:admin action=review
transition tasks.approve from=InReview to=Approved by=role:admin action=approve
transition tasks.reject from=InReview to=Rejected by=role:admin action=reject
transition tasks.cancel from=Pending,InReview to=Cancelled by=role:admin action=cancel
`;
  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    principal: { roles: ["admin"] },
    seedData: {
      tasks: [
        { id: "t1", title: "Review Document", status: "InReview" }
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

  const app = renderPresentation(root, ir, runtime, {
    model,
    initialScreen: "tasks"
  });

  app.state.drawer = {
    purpose: "detail",
    entityId: "tasks",
    recordId: "t1"
  };
  app.render();

  // Verify Drawer Action Policy:
  // 1. Forward action `approve` rendered as primary
  assert.ok(root.innerHTML.includes('data-transition="approve"'), "Approve action rendered as primary");
  // 2. `Edit` action rendered as secondary
  assert.ok(root.innerHTML.includes('data-drawer-edit='), "Edit action rendered as secondary");
  // 3. Overflow menu trigger `[•••]` rendered for destructive/secondary transitions (`reject`, `cancel`, `archive`)
  assert.ok(root.innerHTML.includes("data-drawer-overflow-menu"), "Overflow menu trigger rendered");
  // 4. Duplicate footer close button removed
  assert.ok(!root.innerHTML.includes('data-close-drawer>Close</button>'), "Redundant footer Close button removed");
});
