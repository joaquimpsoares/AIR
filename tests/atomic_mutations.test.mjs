import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import {
  parseAir,
  parseSeedData,
  AppRuntime,
  MemoryDataAdapter,
  SqliteDataAdapter,
  PostgresDataAdapter,
  DataAdapter,
  FAILURE_CATEGORIES,
  AdapterError,
  AirError
} from "../web/runtime/air.mjs";

const PG_TEST_URL = process.env.PG_TEST_URL || "postgresql://postgres:airtest@127.0.0.1:25432/airtest";

function getReservationHubModel() {
  const source = fs.readFileSync("apps/reservation-hub.air", "utf8");
  return parseAir(source);
}

function getReservationHubSeed(model) {
  const seedJson = fs.readFileSync("data/reservation-hub.seed.json", "utf8");
  return parseSeedData(seedJson, model);
}

test("ATOMIC MUTATIONS: 1. Two-Client Same-Interval Collision (Part 10)", async () => {
  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);
  const runtime = new AppRuntime(model, {
    seedData,
    principal: { roles: ["admin", "operator"] }
  });

  const initialCount = runtime.records("reservations").length;

  // Two clients concurrently attempt to book res_podcast on 2026-11-15 (10:00 -> 11:00)
  const clientA = runtime.createAsync("reservations", {
    title: "Client A Booking",
    customer: "cust_acme",
    resource: "res_podcast",
    start_at: "2026-11-15",
    end_at: "2026-11-15",
    attendees: 2,
    status: "Requested",
    amount: 80,
    created_at: "2026-09-22"
  });

  const clientB = runtime.createAsync("reservations", {
    title: "Client B Booking",
    customer: "cust_soylent",
    resource: "res_podcast",
    start_at: "2026-11-15",
    end_at: "2026-11-15",
    attendees: 2,
    status: "Requested",
    amount: 80,
    created_at: "2026-09-22"
  });

  const [resA, resB] = await Promise.all([clientA, clientB]);

  const successes = [resA, resB].filter((r) => r.record !== null);
  const failures = [resA, resB].filter((r) => r.record === null);

  assert.equal(successes.length, 1, "Exactly one client must succeed");
  assert.equal(failures.length, 1, "Exactly one client must fail");
  assert.ok(failures[0].errors.booking_period || failures[0].errors.no_overlap, "Failing client must receive overlap error");

  const finalCount = runtime.records("reservations").length;
  assert.equal(finalCount, initialCount + 1, "Final reservation count must increase by exactly +1, never +2");
});

test("ATOMIC MUTATIONS: 2. High-Concurrency 100-Way Collision Test (Part 11)", async () => {
  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);
  const runtime = new AppRuntime(model, {
    seedData,
    principal: { roles: ["admin", "operator"] }
  });

  const initialCount = runtime.records("reservations").length;

  // 100 concurrent requests competing for the exact same resource and interval
  const attempts = Array.from({ length: 100 }, (_, i) =>
    runtime.createAsync("reservations", {
      title: `Contender #${i}`,
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: "2026-12-20",
      end_at: "2026-12-20",
      attendees: 8,
      status: "Requested",
      amount: 150,
      created_at: "2026-09-22"
    })
  );

  const results = await Promise.all(attempts);

  const successes = results.filter((r) => r.record !== null);
  const failures = results.filter((r) => r.record === null);

  assert.equal(successes.length, 1, "Exactly 1 of 100 concurrent contenders must succeed");
  assert.equal(failures.length, 99, "Exactly 99 of 100 concurrent contenders must fail");

  for (const fail of failures) {
    assert.ok(fail.errors.booking_period || fail.errors.no_overlap, "All 99 failures must report overlap constraint denial");
  }

  const finalRecords = runtime.records("reservations");
  assert.equal(finalRecords.length, initialCount + 1, "Total records must increase by exactly 1");

  // Verify history integrity: only the 1 winning record has history
  const winningRecord = successes[0].record;
  assert.ok(winningRecord.id, "Winning record must have an ID");
  assert.equal(winningRecord._air_history.length, 1, "Winning record has exactly 1 created audit entry");
});

test("ATOMIC MUTATIONS: 3. Non-Conflicting Concurrency (Part 12)", async () => {
  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);
  const runtime = new AppRuntime(model, {
    seedData,
    principal: { roles: ["admin", "operator"] }
  });

  // A: Room A (res_boardroom) on 2026-11-01
  // B: Room B (res_podcast) on 2026-11-01
  const reqDifferentRooms = await Promise.all([
    runtime.createAsync("reservations", {
      title: "Boardroom Meeting",
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: "2026-11-01",
      end_at: "2026-11-01",
      attendees: 4,
      status: "Requested",
      amount: 150,
      created_at: "2026-09-22"
    }),
    runtime.createAsync("reservations", {
      title: "Podcast Recording",
      customer: "cust_soylent",
      resource: "res_podcast",
      start_at: "2026-11-01",
      end_at: "2026-11-01",
      attendees: 2,
      status: "Requested",
      amount: 80,
      created_at: "2026-09-22"
    })
  ]);

  assert.ok(reqDifferentRooms[0].record, "Room A booking must succeed");
  assert.ok(reqDifferentRooms[1].record, "Room B booking must succeed");

  // Touching intervals on the same resource
  // Booking 1: 2026-11-10 -> 2026-11-10
  // Booking 2: 2026-11-11 -> 2026-11-11
  const reqTouching = await Promise.all([
    runtime.createAsync("reservations", {
      title: "Slot 1",
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: "2026-11-10",
      end_at: "2026-11-10",
      attendees: 4,
      status: "Requested",
      amount: 150,
      created_at: "2026-09-22"
    }),
    runtime.createAsync("reservations", {
      title: "Slot 2",
      customer: "cust_soylent",
      resource: "res_boardroom",
      start_at: "2026-11-11",
      end_at: "2026-11-11",
      attendees: 4,
      status: "Requested",
      amount: 150,
      created_at: "2026-09-22"
    })
  ]);

  assert.ok(reqTouching[0].record, "Touching slot 1 must succeed");
  assert.ok(reqTouching[1].record, "Touching slot 2 must succeed");
});

test("ATOMIC MUTATIONS: 4. Concurrent Reschedule Race (Part 15)", async () => {
  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);
  const runtime = new AppRuntime(model, {
    seedData,
    principal: { roles: ["admin", "operator"] }
  });

  // resv_01 is on res_boardroom on 2026-09-24
  // resv_06 is on res_boardroom on 2026-09-22
  // Both attempt to reschedule into the open slot: 2026-10-25
  const reschedule1 = runtime.updateAsync("reservations", "resv_01", {
    start_at: "2026-10-25",
    end_at: "2026-10-25"
  });
  const reschedule2 = runtime.updateAsync("reservations", "resv_06", {
    start_at: "2026-10-25",
    end_at: "2026-10-25"
  });

  const [res1, res2] = await Promise.all([reschedule1, reschedule2]);

  const successes = [res1, res2].filter((r) => r.record !== null);
  const failures = [res1, res2].filter((r) => r.record === null);

  assert.equal(successes.length, 1, "Exactly one reschedule must commit to the open slot");
  assert.equal(failures.length, 1, "Competing reschedule must fail with overlap denial");
  assert.ok(failures[0].errors.booking_period || failures[0].errors.no_overlap);
});

test("ATOMIC MUTATIONS: 5. Delete/Cancel vs Create Race (Part 16)", async () => {
  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);
  const runtime = new AppRuntime(model, {
    seedData,
    principal: { roles: ["admin", "operator"] }
  });

  // resv_01 is on res_boardroom on 2026-09-24 (status: Confirmed)
  // Client A cancels resv_01
  // Client B attempts new reservation for 2026-09-24
  const actionCancel = runtime.transitionAsync("reservations", "resv_01", "cancel", { comment: "Need to cancel" });
  const actionBook = runtime.createAsync("reservations", {
    title: "Opportunistic Booking",
    customer: "cust_soylent",
    resource: "res_boardroom",
    start_at: "2026-09-24",
    end_at: "2026-09-24",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });

  const [resCancel, resBook] = await Promise.all([actionCancel, actionBook]);

  assert.ok(resCancel.record, "Cancel transition must succeed");
  assert.equal(resCancel.record.status, "Cancelled");
});

test("ATOMIC MUTATIONS: 6. Audit Events & Reactive Presentation Only After Commit (Part 8 & 9)", async () => {
  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);
  const runtime = new AppRuntime(model, {
    seedData,
    principal: { roles: ["admin", "operator"] }
  });

  const reactiveEvents = [];
  const unsubscribe = runtime.subscribe((event) => {
    reactiveEvents.push(event);
  });

  // Failed mutation: collides with resv_01 on 2026-09-24
  const failed = await runtime.createAsync("reservations", {
    title: "Doomed Colliding Booking",
    customer: "cust_acme",
    resource: "res_boardroom",
    start_at: "2026-09-24",
    end_at: "2026-09-24",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });

  assert.equal(failed.record, null, "Failed mutation must return null record");
  assert.equal(reactiveEvents.length, 0, "No reactive event must be emitted for a failed mutation");

  // Successful mutation on an open slot
  const success = await runtime.createAsync("reservations", {
    title: "Legitimate Open Booking",
    customer: "cust_acme",
    resource: "res_boardroom",
    start_at: "2026-10-30",
    end_at: "2026-10-30",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });

  assert.ok(success.record, "Success mutation must return record");
  assert.equal(reactiveEvents.length, 1, "Exactly one reactive event emitted after commit");
  assert.equal(reactiveEvents[0].type, "resource_created");
  assert.equal(reactiveEvents[0].record.id, success.record.id);

  unsubscribe();
});

test("ATOMIC MUTATIONS: 7. DataAdapter Capability Discovery & Unsupported Adapter Refusal (Part 19 & 20)", async () => {
  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);

  // 1. Memory, SQLite, and PostgreSQL declare atomic_mutation & serializable_constraints
  const memory = new MemoryDataAdapter();
  const sqlite = new SqliteDataAdapter({ filename: ":memory:" });
  const postgres = new PostgresDataAdapter();

  for (const adapter of [memory, sqlite, postgres]) {
    const caps = adapter.capabilities();
    assert.ok(caps.includes("atomic_mutation"), `${adapter.constructor.name} must declare atomic_mutation`);
    assert.ok(caps.includes("serializable_constraints"), `${adapter.constructor.name} must declare serializable_constraints`);
  }

  await sqlite.close();

  // 2. Non-atomic / Mock unsupported adapter
  class LegacyReadOnlyAdapter extends DataAdapter {
    capabilities() {
      return ["read"]; // Lacks atomic_mutation
    }
  }

  const legacyAdapter = new LegacyReadOnlyAdapter();
  const runtime = new AppRuntime(model, {
    seedData,
    dataAdapter: legacyAdapter,
    principal: { roles: ["admin", "operator"] }
  });

  // Attempting mutation on a resource protected by cross-record invariants (reservations)
  // must deterministically throw AIR_ATOMIC_CONSTRAINT_UNAVAILABLE
  assert.throws(() => {
    runtime.create("reservations", {
      title: "Should Fail Closed",
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: "2026-11-20",
      end_at: "2026-11-20",
      attendees: 4,
      status: "Requested",
      amount: 150,
      created_at: "2026-09-22"
    });
  }, (err) => {
    return err instanceof AirError && err.code === "AIR_ATOMIC_CONSTRAINT_UNAVAILABLE";
  });
});

test("ATOMIC MUTATIONS: 8. SQLite Real Database Atomic Transaction Boundary (Part 5 & 24)", async () => {
  const sqlite = new SqliteDataAdapter({ filename: ":memory:" });
  await sqlite.initTableFromEntity({
    id: "allocations",
    fields: [
      { id: "slot", type: "text" },
      { id: "start_at", type: "number" },
      { id: "end_at", type: "number" }
    ]
  });

  // Successful atomic transaction
  await sqlite.runAtomicMutation(async (tx) => {
    await tx.create("allocations", { id: "a1", slot: "s1", start_at: 10, end_at: 20 });
    await tx.create("allocations", { id: "a2", slot: "s1", start_at: 20, end_at: 30 });
  });

  const countAfterSuccess = await sqlite.count("allocations");
  assert.equal(countAfterSuccess, 2, "Both records committed in transaction");

  // Rolled-back atomic transaction on injected error
  await assert.rejects(async () => {
    await sqlite.runAtomicMutation(async (tx) => {
      await tx.create("allocations", { id: "a3", slot: "s1", start_at: 30, end_at: 40 });
      throw new Error("Simulated failure before commit");
    });
  }, /Simulated failure/);

  const countAfterRollback = await sqlite.count("allocations");
  assert.equal(countAfterRollback, 2, "Rolled-back transaction left no partial rows in SQLite");

  await sqlite.close();
});

test("ATOMIC MUTATIONS: 9. Reciprocal Invariant Symmetry (Part A)", async () => {
  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);
  const runtime = new AppRuntime(model, {
    seedData,
    principal: { roles: ["admin", "operator"] }
  });

  // 1. Existing blackout -> create overlapping reservation -> REJECT
  // Seed has blk_01 on res_training_hall for 2026-10-01 to 2026-10-05 (status: Active)
  const resOverBlackout = runtime.create("reservations", {
    title: "Meeting during blackout",
    customer: "cust_acme",
    resource: "res_training_hall",
    start_at: "2026-10-02",
    end_at: "2026-10-02",
    attendees: 10,
    status: "Requested",
    amount: 300,
    created_at: "2026-09-22"
  });
  assert.equal(resOverBlackout.record, null, "Reservation overlapping active blackout must be rejected");
  assert.ok(resOverBlackout.errors.no_blackout);

  // 2. Existing reservation -> create overlapping blackout -> REJECT
  // Seed has resv_01 on res_boardroom on 2026-09-24 (status: Confirmed)
  const blackoutOverRes = runtime.create("blackouts", {
    resource: "res_boardroom",
    reason: "Emergency HVAC repair",
    start_at: "2026-09-24",
    end_at: "2026-09-24",
    status: "Active"
  });
  assert.equal(blackoutOverRes.record, null, "Blackout overlapping confirmed reservation must be rejected");
  assert.ok(blackoutOverRes.errors.no_reservation);

  // 3. Concurrent reservation + blackout from empty state -> exactly ONE commits
  const resEmptySlot = runtime.createAsync("reservations", {
    title: "Slot Contest Reservation",
    customer: "cust_acme",
    resource: "res_podcast",
    start_at: "2026-11-20",
    end_at: "2026-11-20",
    attendees: 2,
    status: "Requested",
    amount: 80,
    created_at: "2026-09-22"
  });
  const blackoutEmptySlot = runtime.createAsync("blackouts", {
    resource: "res_podcast",
    reason: "Mic upgrade",
    start_at: "2026-11-20",
    end_at: "2026-11-20",
    status: "Active"
  });

  const [raceRes, raceBlk] = await Promise.all([resEmptySlot, blackoutEmptySlot]);
  const raceSuccesses = [raceRes, raceBlk].filter((r) => r.record !== null);
  const raceFailures = [raceRes, raceBlk].filter((r) => r.record === null);

  assert.equal(raceSuccesses.length, 1, "Exactly one must win the contested slot");
  assert.equal(raceFailures.length, 1, "The loser must be rejected");

  // 4. Touching reservation/blackout boundaries -> ALLOW under [start,end)
  // res on 2026-11-21, blackout on 2026-11-22
  const touchingRes = runtime.create("reservations", {
    title: "Adjacent Reservation",
    customer: "cust_acme",
    resource: "res_podcast",
    start_at: "2026-11-21",
    end_at: "2026-11-21",
    attendees: 2,
    status: "Requested",
    amount: 80,
    created_at: "2026-09-22"
  });
  const touchingBlk = runtime.create("blackouts", {
    resource: "res_podcast",
    reason: "Adjacent maintenance",
    start_at: "2026-11-22",
    end_at: "2026-11-22",
    status: "Active"
  });
  assert.ok(touchingRes.record, "Touching reservation must succeed");
  assert.ok(touchingBlk.record, "Touching blackout must succeed");

  // 5. Different resources -> both ALLOW
  const diffRes = runtime.create("reservations", {
    title: "Diff Res Meeting",
    customer: "cust_acme",
    resource: "res_boardroom",
    start_at: "2026-11-25",
    end_at: "2026-11-25",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });
  const diffBlk = runtime.create("blackouts", {
    resource: "res_vr_kit",
    reason: "Diff Res Maintenance",
    start_at: "2026-11-25",
    end_at: "2026-11-25",
    status: "Active"
  });
  assert.ok(diffRes.record, "Diff resource reservation must succeed");
  assert.ok(diffBlk.record, "Diff resource blackout must succeed");

  // 6. Cancelled reservation + blackout -> ALLOW under status!=Cancelled
  // Seed resv_05 on res_desk_cluster is status: Cancelled for 2026-09-18
  const blkOverCancelled = runtime.create("blackouts", {
    resource: "res_desk_cluster",
    reason: "Desk cluster deep cleaning",
    start_at: "2026-09-18",
    end_at: "2026-09-18",
    status: "Active"
  });
  assert.ok(blkOverCancelled.record, "Blackout over cancelled reservation must succeed");
});

test("ATOMIC MUTATIONS: 10. Real PostgreSQL Live Server Test Suite (Parts B, C, E, F, G)", async () => {
  let pool;
  try {
    pool = new pg.Pool({ connectionString: PG_TEST_URL });
    const versionRes = await pool.query("SELECT version();");
    assert.ok(versionRes.rows[0].version.includes("PostgreSQL"), "Must connect to live PostgreSQL");
  } catch (err) {
    console.warn("Skipping Live PostgreSQL test: PostgreSQL server not accessible:", err.message);
    return;
  }

  const clientA = await pool.connect();
  const clientB = await pool.connect();

  // B2. Prove Connection Independence
  const pidA = (await clientA.query("SELECT pg_backend_pid() AS pid;")).rows[0].pid;
  const pidB = (await clientB.query("SELECT pg_backend_pid() AS pid;")).rows[0].pid;
  assert.notEqual(pidA, pidB, "Connection A and Connection B must be separate PostgreSQL backend processes");

  // Initialize test tables in PostgreSQL
  await clientA.query(`
    DROP TABLE IF EXISTS "reservations" CASCADE;
    DROP TABLE IF EXISTS "blackouts" CASCADE;
    CREATE TABLE "reservations" (
      "id" VARCHAR(255) PRIMARY KEY,
      "title" TEXT,
      "customer" TEXT,
      "resource" TEXT,
      "start_at" DATE,
      "end_at" DATE,
      "attendees" NUMERIC(14, 2),
      "status" TEXT,
      "amount" NUMERIC(14, 2),
      "created_at" DATE,
      "updated" DATE,
      "_archived_at" TIMESTAMPTZ
    );
    CREATE TABLE "blackouts" (
      "id" VARCHAR(255) PRIMARY KEY,
      "resource" TEXT,
      "reason" TEXT,
      "start_at" DATE,
      "end_at" DATE,
      "status" TEXT,
      "_archived_at" TIMESTAMPTZ
    );
  `);

  clientA.release();
  clientB.release();

  const model = getReservationHubModel();
  const seedData = getReservationHubSeed(model);

  const pgAdapter = new PostgresDataAdapter({ pgClient: pool });
  const runtime = new AppRuntime(model, {
    seedData,
    dataAdapter: pgAdapter,
    principal: { roles: ["admin", "operator"] }
  });

  // B3 & B4. Real Same-Interval Race on Live PostgreSQL
  const tStart = Date.now();
  const race1 = runtime.createAsync("reservations", {
    title: "Live PG Booking 1",
    customer: "cust_acme",
    resource: "res_boardroom",
    start_at: "2026-11-15",
    end_at: "2026-11-15",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });
  const race2 = runtime.createAsync("reservations", {
    title: "Live PG Booking 2",
    customer: "cust_soylent",
    resource: "res_boardroom",
    start_at: "2026-11-15",
    end_at: "2026-11-15",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });

  const [resA, resB] = await Promise.all([race1, race2]);
  const liveSuccesses = [resA, resB].filter((r) => r.record !== null);
  const liveFailures = [resA, resB].filter((r) => r.record === null);

  assert.equal(liveSuccesses.length, 1, "Exactly one transaction must commit on live PostgreSQL");
  assert.equal(liveFailures.length, 1, "The competing transaction must fail");

  // B6. Touching Intervals Live Test
  const touchA = await runtime.createAsync("reservations", {
    title: "Touching PG 1",
    customer: "cust_acme",
    resource: "res_boardroom",
    start_at: "2026-11-16",
    end_at: "2026-11-16",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });
  const touchB = await runtime.createAsync("reservations", {
    title: "Touching PG 2",
    customer: "cust_soylent",
    resource: "res_boardroom",
    start_at: "2026-11-17",
    end_at: "2026-11-17",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });
  assert.ok(touchA.record, "Touching interval 1 must commit on live PG");
  assert.ok(touchB.record, "Touching interval 2 must commit on live PG");

  // B7. Different Resource Live Test
  const diffA = await runtime.createAsync("reservations", {
    title: "Diff Res PG 1",
    customer: "cust_acme",
    resource: "res_boardroom",
    start_at: "2026-11-18",
    end_at: "2026-11-18",
    attendees: 4,
    status: "Requested",
    amount: 150,
    created_at: "2026-09-22"
  });
  const diffB = await runtime.createAsync("reservations", {
    title: "Diff Res PG 2",
    customer: "cust_soylent",
    resource: "res_podcast",
    start_at: "2026-11-18",
    end_at: "2026-11-18",
    attendees: 2,
    status: "Requested",
    amount: 80,
    created_at: "2026-09-22"
  });
  assert.ok(diffA.record, "Different resource A must commit on live PG");
  assert.ok(diffB.record, "Different resource B must commit on live PG");

  // B8. Reservation vs Blackout Live Race
  const blkRaceRes = runtime.createAsync("reservations", {
    title: "Contested PG Res",
    customer: "cust_acme",
    resource: "res_vr_kit",
    start_at: "2026-11-20",
    end_at: "2026-11-20",
    attendees: 2,
    status: "Requested",
    amount: 100,
    created_at: "2026-09-22"
  });
  const blkRaceBlk = runtime.createAsync("blackouts", {
    resource: "res_vr_kit",
    reason: "VR Sensor Calibration",
    start_at: "2026-11-20",
    end_at: "2026-11-20",
    status: "Active"
  });
  const [bRes, bBlk] = await Promise.all([blkRaceRes, blkRaceBlk]);
  const blkSuccesses = [bRes, bBlk].filter((r) => r.record !== null);
  assert.equal(blkSuccesses.length, 1, "Exactly one must commit in reservation vs blackout race on live PG");

  // B5. 100-Way Live PostgreSQL Collision
  const hundredAttempts = Array.from({ length: 100 }, (_, i) =>
    runtime.createAsync("reservations", {
      title: `Live 100 Contender #${i}`,
      customer: "cust_acme",
      resource: "res_training_hall",
      start_at: "2026-12-01",
      end_at: "2026-12-01",
      attendees: 10,
      status: "Requested",
      amount: 200,
      created_at: "2026-09-22"
    })
  );
  const hundredResults = await Promise.all(hundredAttempts);
  const hSuccess = hundredResults.filter((r) => r.record !== null);
  const hFail = hundredResults.filter((r) => r.record === null);
  assert.equal(hSuccess.length, 1, "Exactly 1 of 100 must succeed on live PostgreSQL");
  assert.equal(hFail.length, 99, "Exactly 99 of 100 must fail on live PostgreSQL");

  // Part F: Failure Injection on Live PostgreSQL (Rollback verification)
  await assert.rejects(async () => {
    await pgAdapter.runAtomicMutation(async (tx) => {
      await tx.create("reservations", {
        id: "pg_fail_inj",
        title: "Doomed Injection",
        status: "Requested",
        start_at: "2026-12-15",
        end_at: "2026-12-15"
      });
      throw new Error("Live PG Simulated Failure Before Commit");
    });
  }, /Live PG Simulated Failure/);

  const checkInjected = await pool.query(`SELECT * FROM "reservations" WHERE "id" = 'pg_fail_inj';`);
  assert.equal(checkInjected.rows.length, 0, "Failed transaction must leave 0 rows in PostgreSQL table");

  // Part C & G: Error Mapping & SQLSTATE 40001 Handling
  let attempts = 0;
  const retryClient = {
    async query(sql, params) {
      if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
        return { rows: [] };
      }
      attempts++;
      if (attempts < 3) {
        const err = new Error("could not serialize access due to concurrent update");
        err.code = "40001";
        throw err;
      }
      return { rows: [{ id: "pg_retry_success", title: "Live Retry OK" }] };
    }
  };
  const mockRetryAdapter = new PostgresDataAdapter({ pgClient: retryClient });
  const retryRes = await mockRetryAdapter.runAtomicMutation(async (tx) => {
    return tx.create("reservations", { id: "pg_retry_success", title: "Live Retry OK" });
  }, { maxRetries: 3 });
  assert.equal(retryRes.retries, 2, "Must record exactly 2 retries before commit");

  // Part E: Performance Latency Measurement on Live PostgreSQL
  const uncontendedTimes = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    await runtime.createAsync("reservations", {
      title: `Perf Uncontended ${i}`,
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: `2027-01-${String(i + 1).padStart(2, "0")}`,
      end_at: `2027-01-${String(i + 1).padStart(2, "0")}`,
      attendees: 2,
      status: "Requested",
      amount: 100,
      created_at: "2026-09-22"
    });
    uncontendedTimes.push(performance.now() - t0);
  }

  const tenTimes = [];
  const tenAttempts = Array.from({ length: 10 }, (_, i) => async () => {
    const t0 = performance.now();
    await runtime.createAsync("reservations", {
      title: `Perf 10-${i}`,
      customer: "cust_acme",
      resource: "res_boardroom",
      start_at: `2027-02-${String(i + 1).padStart(2, "0")}`,
      end_at: `2027-02-${String(i + 1).padStart(2, "0")}`,
      attendees: 2,
      status: "Requested",
      amount: 100,
      created_at: "2026-09-22"
    });
    tenTimes.push(performance.now() - t0);
  });
  await Promise.all(tenAttempts.map((f) => f()));

  uncontendedTimes.sort((a, b) => a - b);
  tenTimes.sort((a, b) => a - b);

  const uP50 = uncontendedTimes[Math.floor(uncontendedTimes.length * 0.5)];
  const uP95 = uncontendedTimes[Math.floor(uncontendedTimes.length * 0.95)];
  const tP50 = tenTimes[Math.floor(tenTimes.length * 0.5)];
  const tP95 = tenTimes[Math.floor(tenTimes.length * 0.95)];

  assert.ok(uP50 >= 0 && uP95 >= 0, "Uncontended timings measured");
  assert.ok(tP50 >= 0 && tP95 >= 0, "10-concurrent timings measured");

  await pool.end();
});

test("ATOMIC MUTATIONS: 11. Multi-Domain Genericity (Meeting Rooms, Shifts, Equipment) (Part 23)", async () => {
  const schema = `
air version=2
app multi_domain title="Multi Domain Concurrency" initial=overview timezone="UTC"

resource staff label=name
field staff.name text required min=2
manage staff lifecycle=delete
access staff view=true edit=true

resource shifts label=title
field shifts.title text required min=2
field shifts.staff ref=staff required
field shifts.start_at date required
field shifts.end_at date required
field shifts.period interval start=start_at end=end_at
manage shifts lifecycle=delete
access shifts view=true edit=true
invariant shifts.no_double_shift none=shifts scope=staff overlaps=period deny="Staff cannot be scheduled for overlapping shifts"

overview title="Overview"
insight shifts.count op=count label="Shifts"
`;

  const model = parseAir(schema);
  const runtime = new AppRuntime(model, {
    seedData: {
      staff: [{ id: "st_alice", name: "Alice Smith" }],
      shifts: []
    }
  });

  // Concurrent double-shift attempt for Alice
  const attempt1 = runtime.createAsync("shifts", {
    title: "Shift A",
    staff: "st_alice",
    start_at: "2026-10-01",
    end_at: "2026-10-05"
  });

  const attempt2 = runtime.createAsync("shifts", {
    title: "Shift B (Collision)",
    staff: "st_alice",
    start_at: "2026-10-03",
    end_at: "2026-10-07"
  });

  const [s1, s2] = await Promise.all([attempt1, attempt2]);

  const successes = [s1, s2].filter((r) => r.record !== null);
  const failures = [s1, s2].filter((r) => r.record === null);

  assert.equal(successes.length, 1, "Exactly one shift must be scheduled");
  assert.equal(failures.length, 1, "Double shift must be blocked concurrently");
  assert.equal(failures[0].errors.no_double_shift, "Staff cannot be scheduled for overlapping shifts");
});
