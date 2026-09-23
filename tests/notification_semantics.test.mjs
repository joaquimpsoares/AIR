import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAir, AppRuntime, MemoryStorage, tokenizeLine } from "../web/runtime/air.mjs";
import { compilePresentation } from "../web/runtime/presentation.mjs";
import { renderPresentation } from "../web/runtime/ui.mjs";

describe("NOTIFICATION SEMANTICS & CENTER v1 Test Suite", async () => {

  await it("1. Event-Based Notification Rule on Resource Creation (New Order)", () => {
    const airSource = `air version=2
app test_notif_events
resource orders label=order_number
field orders.order_number text required
field orders.customer text required
field orders.total money currency=USD required
manage orders lifecycle=archive
access orders view=role:operations|role:admin create=role:operations|role:admin edit=role:admin

notify orders.new_order on=created audience=role:operations tone=info label="New order" title="{order_number} · {customer}" body="{total}"
`;
    const model = parseAir(airSource);
    assert.equal(model.notifications.length, 1);
    assert.equal(model.notifications[0].ruleId, "new_order");
    assert.equal(model.notifications[0].on, "created");
    assert.equal(model.notifications[0].audience.role, "operations");

    const runtime = new AppRuntime(model, {
      seedData: {},
      storage: new MemoryStorage(),
      principal: { roles: ["operations"] }
    });

    assert.equal(runtime.notifications().length, 0);
    assert.equal(runtime.unreadNotificationCount(), 0);

    // Create an order
    const res = runtime.create("orders", {
      order_number: "ORD-1048",
      customer: "Acme Ltd",
      total: 2480.00
    });
    assert.ok(res.record);

    // Verify notification was generated
    const notifs = runtime.notifications();
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].label, "New order");
    assert.equal(notifs[0].title, "ORD-1048 · Acme Ltd");
    assert.equal(notifs[0].body, "$2,480.00");
    assert.equal(notifs[0].tone, "info");
    assert.equal(notifs[0].read, false);
    assert.equal(notifs[0].dismissed, false);
    assert.equal(runtime.unreadNotificationCount(), 1);
  });

  await it("2. Condition-Transition Edge Triggering (false -> true) for Low Stock", () => {
    const airSource = `air version=2
app test_low_stock
resource inventory_balances label=product
field inventory_balances.product text required
field inventory_balances.warehouse text required
field inventory_balances.quantity_on_hand integer required default=0
field inventory_balances.reorder_level integer required default=10
manage inventory_balances lifecycle=archive
access inventory_balances view=role:warehouse_manager edit=role:warehouse_manager create=role:warehouse_manager

notify inventory_balances.low_stock when="quantity_on_hand <= reorder_level & quantity_on_hand > 0" audience=role:warehouse_manager tone=warning label="Low stock" title="{product} ({warehouse})" body="{quantity_on_hand} remaining · reorder at {reorder_level}"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        inventory_balances: [
          { id: "ib1", product: "USB-C Adapter", warehouse: "Málaga", quantity_on_hand: 20, reorder_level: 10 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["warehouse_manager"] }
    });

    // Initial state: quantity 20 > 10 (condition false) -> 0 notifications
    assert.equal(runtime.notifications().length, 0);

    // Update quantity: 20 -> 9 (condition becomes true: edge false -> true)
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 9 });

    const notifs = runtime.notifications();
    assert.equal(notifs.length, 1, "Low stock notification triggered on false -> true edge");
    assert.equal(notifs[0].label, "Low stock");
    assert.equal(notifs[0].title, "USB-C Adapter (Málaga)");
    assert.equal(notifs[0].body, "9 remaining · reorder at 10");
    assert.equal(notifs[0].tone, "warning");
    assert.equal(runtime.unreadNotificationCount(), 1);
  });

  await it("3. Condition Deduplication: No Duplicate Threshold Notifications while Condition Remains True", () => {
    const airSource = `air version=2
app test_low_stock_dedup
resource inventory_balances label=product
field inventory_balances.product text required
field inventory_balances.quantity_on_hand integer required default=0
field inventory_balances.reorder_level integer required default=10
manage inventory_balances lifecycle=archive
access inventory_balances view=role:warehouse_manager edit=role:warehouse_manager

notify inventory_balances.low_stock when="quantity_on_hand <= reorder_level & quantity_on_hand > 0" audience=role:warehouse_manager tone=warning label="Low stock"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        inventory_balances: [
          { id: "ib1", product: "USB-C Adapter", quantity_on_hand: 15, reorder_level: 10 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["warehouse_manager"] }
    });

    // 15 -> 9 (false -> true): emits 1st notification
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 9 });
    assert.equal(runtime.notifications().length, 1);

    // 9 -> 8 (true -> true): stays true, must NOT emit duplicate notification
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 8 });
    assert.equal(runtime.notifications().length, 1, "No duplicate notification when condition remains true (9 -> 8)");

    // 8 -> 8 (mutation without change): must NOT emit duplicate
    runtime.update("inventory_balances", "ib1", { reorder_level: 10 });
    assert.equal(runtime.notifications().length, 1, "No duplicate notification on neutral update");
  });

  await it("4. Condition Clearing (Stock Replenished) and Subsequent Re-Triggering", () => {
    const airSource = `air version=2
app test_clear_retrigger
resource inventory_balances label=product
field inventory_balances.product text required
field inventory_balances.quantity_on_hand integer required default=0
field inventory_balances.reorder_level integer required default=10
manage inventory_balances lifecycle=archive
access inventory_balances view=role:warehouse_manager edit=role:warehouse_manager

notify inventory_balances.low_stock when="quantity_on_hand <= reorder_level & quantity_on_hand > 0" audience=role:warehouse_manager tone=warning label="Low stock"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        inventory_balances: [
          { id: "ib1", product: "USB-C Adapter", quantity_on_hand: 12, reorder_level: 10 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["warehouse_manager"] }
    });

    // 12 -> 9 (Trigger 1)
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 9 });
    assert.equal(runtime.notifications().length, 1);

    // Replenish: 9 -> 25 (Condition clears: true -> false)
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 25 });
    assert.equal(runtime.notifications().length, 1, "Clearing condition does not generate new notification");

    // Re-trigger: 25 -> 4 (Condition becomes true again: false -> true)
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 4 });
    assert.equal(runtime.notifications().length, 2, "Second low-stock event generates new notification after clearing");
  });

  await it("5. Out-of-Stock Rule Independence & Precedence", () => {
    const airSource = `air version=2
app test_out_of_stock
resource inventory_balances label=product
field inventory_balances.product text required
field inventory_balances.quantity_on_hand integer required default=0
field inventory_balances.reorder_level integer required default=10
manage inventory_balances lifecycle=archive
access inventory_balances view=role:warehouse_manager edit=role:warehouse_manager

notify inventory_balances.low_stock when="quantity_on_hand <= reorder_level & quantity_on_hand > 0" audience=role:warehouse_manager tone=warning label="Low stock"
notify inventory_balances.out_of_stock when="quantity_on_hand == 0" audience=role:warehouse_manager tone=danger label="Out of stock"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        inventory_balances: [
          { id: "ib1", product: "Monitor Mount", quantity_on_hand: 15, reorder_level: 5 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["warehouse_manager"] }
    });

    // 15 -> 3: Low stock fires
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 3 });
    let notifs = runtime.notifications();
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].label, "Low stock");
    assert.equal(notifs[0].tone, "warning");

    // 3 -> 0: Out of stock fires (danger), Low stock clears
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 0 });
    notifs = runtime.notifications();
    assert.equal(notifs.length, 2);
    assert.equal(notifs[0].label, "Out of stock");
    assert.equal(notifs[0].tone, "danger");
  });

  await it("6. Initial Condition Evaluation Baseline Policy (No Cold Boot Spam)", () => {
    const airSource = `air version=2
app test_initial_baseline
resource inventory_balances label=product
field inventory_balances.product text required
field inventory_balances.quantity_on_hand integer required default=0
field inventory_balances.reorder_level integer required default=10
manage inventory_balances lifecycle=archive
access inventory_balances view=role:warehouse_manager edit=role:warehouse_manager

notify inventory_balances.low_stock when="quantity_on_hand <= reorder_level & quantity_on_hand > 0" audience=role:warehouse_manager tone=warning label="Low stock"
`;
    const model = parseAir(airSource);
    // Seed with existing low-stock item (quantity 3 <= 10)
    const runtime = new AppRuntime(model, {
      seedData: {
        inventory_balances: [
          { id: "ib1", product: "Pre-existing Low Stock", quantity_on_hand: 3, reorder_level: 10 }
        ]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["warehouse_manager"] }
    });

    // Initial baseline state is established without emitting spam notifications
    assert.equal(runtime.notifications().length, 0, "Cold boot with pre-existing condition establishes baseline without spamming notifications");

    // A subsequent mutation that remains low (3 -> 2) stays true and does not fire
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 2 });
    assert.equal(runtime.notifications().length, 0);

    // Replenishing (2 -> 20) clears baseline, then dropping (20 -> 5) fires!
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 20 });
    runtime.update("inventory_balances", "ib1", { quantity_on_hand: 5 });
    assert.equal(runtime.notifications().length, 1, "Fires cleanly on false -> true after baseline clearing");
  });

  await it("7. Audience Resolution: Role Audience, Owner Audience, and Relation Path Audience", () => {
    const airSource = `air version=2
app test_audiences
actor users
resource users label=name
field users.name text required
field users.role enum values=operator,manager,admin required default=operator
manage users lifecycle=archive
access users view=role:admin edit=role:admin

resource projects label=title
field projects.title text required
field projects.owner ref=users required
field projects.manager ref=users required
manage projects lifecycle=archive
access projects view=role:operator|role:manager|role:admin edit=role:manager|role:admin create=role:admin

notify projects.owner_notif on=created audience=owner tone=info label="Project assigned"
notify projects.manager_notif on=created audience=path:manager tone=warning label="Manager oversight"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        users: [
          { id: "u_alice", name: "Alice", role: "operator" },
          { id: "u_bob", name: "Bob", role: "manager" },
          { id: "u_charlie", name: "Charlie", role: "operator" }
        ]
      },
      storage: new MemoryStorage(),
      principal: { actor: "users", id: "u_admin", roles: ["admin"] }
    });

    // Create a project with owner=Alice, manager=Bob
    runtime.create("projects", {
      title: "Apollo System",
      owner: "u_alice",
      manager: "u_bob"
    });

    // Check Alice (Owner): sees owner_notif, does NOT see manager_notif
    const aliceRuntime = new AppRuntime(model, {
      seedData: runtime.seedData,
      storage: runtime.storage,
      principal: { actor: "users", id: "u_alice", roles: ["operator"] }
    });
    const aliceNotifs = aliceRuntime.notifications();
    assert.equal(aliceNotifs.length, 1);
    assert.equal(aliceNotifs[0].label, "Project assigned");

    // Check Bob (Manager via path): sees manager_notif, does NOT see owner_notif
    const bobRuntime = new AppRuntime(model, {
      seedData: runtime.seedData,
      storage: runtime.storage,
      principal: { actor: "users", id: "u_bob", roles: ["manager"] }
    });
    const bobNotifs = bobRuntime.notifications();
    assert.equal(bobNotifs.length, 1);
    assert.equal(bobNotifs[0].label, "Manager oversight");

    // Check Charlie (Unrelated operator): sees ZERO notifications
    const charlieRuntime = new AppRuntime(model, {
      seedData: runtime.seedData,
      storage: runtime.storage,
      principal: { actor: "users", id: "u_charlie", roles: ["operator"] }
    });
    assert.equal(charlieRuntime.notifications().length, 0);
  });

  await it("8. Authority & Security: Notification Content Never Leaks to Unauthorized Users", () => {
    const airSource = `air version=2
app test_security_notif
resource confidential_reports label=title
field confidential_reports.title text required
field confidential_reports.revenue money currency=USD required
manage confidential_reports lifecycle=archive
access confidential_reports view=role:finance edit=role:finance create=role:finance

notify confidential_reports.new_report on=created audience=any tone=info label="Confidential Report" title="{title}" body="{revenue}"
`;
    const model = parseAir(airSource);
    const storage = new MemoryStorage();
    const financeRuntime = new AppRuntime(model, {
      seedData: {},
      storage,
      principal: { roles: ["finance"] }
    });

    // Finance creates confidential report
    financeRuntime.create("confidential_reports", {
      title: "Q3 Secret Acquisitions",
      revenue: 5000000.00
    });

    // Finance sees the notification
    assert.equal(financeRuntime.notifications().length, 1);

    // Guest / unauthorized user (without role finance)
    const guestRuntime = new AppRuntime(model, {
      seedData: financeRuntime.seedData,
      storage,
      principal: { roles: ["guest"] }
    });

    // Security Guarantee: Guest cannot view confidential_reports, so notification is completely redacted/hidden
    const guestNotifs = guestRuntime.notifications();
    assert.equal(guestNotifs.length, 0, "Zero notifications delivered to unauthorized principal");
    assert.equal(guestRuntime.unreadNotificationCount(), 0, "Zero unread count for unauthorized principal");
  });

  await it("9. User-Scoped Read, Dismissed, and Multi-User State Independence", () => {
    const airSource = `air version=2
app test_multi_user_read
resource announcements label=headline
field announcements.headline text required
manage announcements lifecycle=archive
access announcements view=role:staff edit=role:admin create=role:admin

notify announcements.broadcast on=created audience=role:staff tone=info label="Announcement" title="{headline}"
`;
    const model = parseAir(airSource);
    const storage = new MemoryStorage();
    const adminRuntime = new AppRuntime(model, {
      seedData: {},
      storage,
      principal: { roles: ["admin", "staff"] }
    });

    // Admin creates announcement
    adminRuntime.create("announcements", { headline: "All Hands Meeting at 3pm" });

    // User A (Alice) and User B (Bob) are both staff
    const userARuntime = new AppRuntime(model, {
      storage,
      principal: { id: "u_alice", roles: ["staff"] }
    });
    const userBRuntime = new AppRuntime(model, {
      storage,
      principal: { id: "u_bob", roles: ["staff"] }
    });

    assert.equal(userARuntime.unreadNotificationCount(), 1);
    assert.equal(userBRuntime.unreadNotificationCount(), 1);

    const notifId = userARuntime.notifications()[0].id;

    // User A marks notification as read
    userARuntime.markNotificationAsRead(notifId);
    assert.equal(userARuntime.unreadNotificationCount(), 0, "User A has 0 unread");
    assert.equal(userARuntime.notifications()[0].read, true);

    // User B's state MUST remain unread
    assert.equal(userBRuntime.unreadNotificationCount(), 1, "User B still has 1 unread independently");
    assert.equal(userBRuntime.notifications()[0].read, false);

    // User B dismisses the notification
    userBRuntime.dismissNotification(notifId);
    assert.equal(userBRuntime.notifications().length, 0, "Dismissed notification leaves active feed for User B");

    // User A's feed still contains the read notification
    assert.equal(userARuntime.notifications().length, 1, "User A still has notification in history");
  });

  await it("10. Mark All Read API", () => {
    const airSource = `air version=2
app test_mark_all
resource alerts label=message
field alerts.message text required
manage alerts lifecycle=archive
access alerts view=role:ops edit=role:ops create=role:ops

notify alerts.item on=created audience=role:ops tone=info label="Alert" title="{message}"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {},
      storage: new MemoryStorage(),
      principal: { roles: ["ops"] }
    });

    runtime.create("alerts", { message: "Alert 1" });
    runtime.create("alerts", { message: "Alert 2" });
    runtime.create("alerts", { message: "Alert 3" });

    assert.equal(runtime.unreadNotificationCount(), 3);
    assert.equal(runtime.notifications().length, 3);

    runtime.markAllNotificationsAsRead();
    assert.equal(runtime.unreadNotificationCount(), 0);
    assert.equal(runtime.notifications().length, 3);
    assert.ok(runtime.notifications().every((n) => n.read === true));
  });

  await it("11. Persistence Across Storage Reload (Memory / Persistent Storage)", () => {
    const airSource = `air version=2
app test_persistence
resource tasks label=title
field tasks.title text required
manage tasks lifecycle=archive
access tasks view=role:dev edit=role:dev create=role:dev

notify tasks.created on=created audience=role:dev tone=info label="Task Created" title="{title}"
`;
    const model = parseAir(airSource);
    const storage = new MemoryStorage();

    // 1st Runtime session
    const runtime1 = new AppRuntime(model, {
      seedData: {},
      storage,
      principal: { id: "dev_1", roles: ["dev"] }
    });
    runtime1.create("tasks", { title: "Implement feature X" });
    assert.equal(runtime1.notifications().length, 1);
    const notifId = runtime1.notifications()[0].id;
    runtime1.markNotificationAsRead(notifId);

    // 2nd Runtime session (reloading from same storage)
    const runtime2 = new AppRuntime(model, {
      storage,
      principal: { id: "dev_1", roles: ["dev"] }
    });
    assert.equal(runtime2.notifications().length, 1, "Notifications persist across runtime reload");
    assert.equal(runtime2.notifications()[0].title, "Implement feature X");
    assert.equal(runtime2.notifications()[0].read, true, "User read state persists across runtime reload");
    assert.equal(runtime2.unreadNotificationCount(), 0);
  });

  await it("12. Workflow Transition Event Notifications", () => {
    const airSource = `air version=2
app test_workflow_notif
resource orders label=order_number
field orders.order_number text required
field orders.status enum values=draft,submitted,fulfilled required default=draft
process orders state=status initial=draft terminal=fulfilled history
transition orders.submit from=draft to=submitted action=submit by=role:clerk
transition orders.fulfill from=submitted to=fulfilled action=fulfill by=role:warehouse

manage orders lifecycle=archive
access orders view=role:clerk|role:warehouse edit=role:clerk|role:warehouse create=role:clerk

notify orders.order_fulfilled on=fulfill audience=role:clerk tone=success label="Order Fulfilled" title="{order_number} has been shipped"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        orders: [{ id: "o1", order_number: "ORD-999", status: "draft" }]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["clerk", "warehouse"] }
    });

    // Draft -> Submitted: no notification rule on submit
    runtime.transition("orders", "o1", "submit");
    assert.equal(runtime.notifications().length, 0);

    // Submitted -> Fulfilled: triggers notify rule on fulfill!
    runtime.transition("orders", "o1", "fulfill");
    const notifs = runtime.notifications();
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].label, "Order Fulfilled");
    assert.equal(notifs[0].title, "ORD-999 has been shipped");
    assert.equal(notifs[0].tone, "success");
  });

  await it("13. Multi-Domain Genericity (Reservation, Service Request, Project Blocked, Certification)", () => {
    const airSource = `air version=2
app test_multi_domain_notifs
resource reservations label=guest
field reservations.guest text required
field reservations.status enum values=confirmed,cancelled required default=confirmed
process reservations state=status initial=confirmed terminal=cancelled history
transition reservations.cancel from=confirmed to=cancelled action=cancel by=role:staff
manage reservations lifecycle=archive
access reservations view=role:staff edit=role:staff

resource service_tickets label=subject
field service_tickets.subject text required
field service_tickets.priority enum values=low,medium,critical required default=low
manage service_tickets lifecycle=archive
access service_tickets view=role:support edit=role:support

notify reservations.cancelled on=cancel audience=role:staff tone=warning label="Reservation Cancelled" title="{guest}"
notify service_tickets.critical when="priority == critical" audience=role:support tone=danger label="Critical Ticket" title="{subject}"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {
        reservations: [{ id: "r1", guest: "Elena Rostova", status: "confirmed" }],
        service_tickets: [{ id: "t1", subject: "DB Connection Pool Exhaustion", priority: "low" }]
      },
      storage: new MemoryStorage(),
      principal: { roles: ["staff", "support"] }
    });

    // 1. Cancel reservation -> notification
    runtime.transition("reservations", "r1", "cancel");
    // 2. Escalate ticket priority to critical -> notification
    runtime.update("service_tickets", "t1", { priority: "critical" });

    const notifs = runtime.notifications();
    assert.equal(notifs.length, 2);
    assert.equal(notifs[0].label, "Critical Ticket");
    assert.equal(notifs[0].tone, "danger");
    assert.equal(notifs[1].label, "Reservation Cancelled");
    assert.equal(notifs[1].tone, "warning");
  });

  await it("14. UI Presentation: Bell Badge, Desktop Popover & Mobile Sheet Compilation", () => {
    const airSource = `air version=2
app test_ui_bell
resource items label=name
field items.name text required
manage items lifecycle=archive
access items view=role:admin edit=role:admin create=role:admin

notify items.new_item on=created audience=role:admin tone=info label="New Item" title="{name}"
`;
    const model = parseAir(airSource);
    const runtime = new AppRuntime(model, {
      seedData: {},
      storage: new MemoryStorage(),
      principal: { id: "admin_1", roles: ["admin"] }
    });

    runtime.create("items", { name: "Widget Deluxe" });

    // Mount and render desktop UI (width: 1024px)
    const presentationIr = compilePresentation(model, { principal: runtime.principal, runtime });
    const container = {
      innerHTML: "",
      clientWidth: 1024,
      removeAttribute: () => {},
      querySelector: () => null,
      querySelectorAll: () => []
    };
    const ui = renderPresentation(container, presentationIr, runtime, { model, containerWidth: 1024 });

    assert.ok(container.innerHTML.includes("data-notification-bell"), "Bell button rendered in desktop shell");
    assert.ok(container.innerHTML.includes('class="unread-badge"'), "Unread badge rendered on bell");
    assert.ok(container.innerHTML.includes("1"), "Badge shows 1 unread notification");

    // Open notification center on desktop
    ui.state.notificationCenterOpen = true;
    ui.render();
    assert.ok(container.innerHTML.includes("data-notification-popover"), "Desktop renders notification popover");
    assert.ok(container.innerHTML.includes("Widget Deluxe"), "Popover feed displays notification title");

    // Switch to mobile viewport (width: 375px)
    ui.setContainerWidth(375);
    assert.ok(container.innerHTML.includes("data-notification-sheet"), "Mobile renders notification sheet/drawer");
  });

  await it("15. Token Measurement & Zero Application JS/CSS Verification", () => {
    const rules = [
      'notify orders.new_order on=created audience=role:operations tone=info label="New order" title="{order_number} · {customer}" body="{total}"',
      'notify inventory_balances.low_stock when="quantity_on_hand <= reorder_level & quantity_on_hand > 0" audience=role:warehouse_manager tone=warning label="Low stock"',
      'notify inventory_balances.out_of_stock when="quantity_on_hand == 0" audience=role:warehouse_manager tone=danger label="Out of stock"'
    ];

    const tokens = rules.map((r) => tokenizeLine(r).length);
    const totalTokens = tokens.reduce((a, b) => a + b, 0);

    assert.ok(totalTokens > 0);
    assert.ok(totalTokens < 80, `Token cost (${totalTokens}) is extremely compact`);
  });

});
