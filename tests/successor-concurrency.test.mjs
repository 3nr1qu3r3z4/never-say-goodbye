import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configured = process.env.SUCCESSOR_TEST_POSTGRES && process.env.SUCCESSOR_TEST_PG;

async function assertWaiting(promise) {
  const outcome = await Promise.race([
    promise.then(() => "finished", () => "finished"),
    new Promise((resolve) => setTimeout(() => resolve("waiting"), 200)),
  ]);
  assert.equal(outcome, "waiting");
}

test("successor transfers serialize with activity, reassignment and competing transfers", {
  skip: configured ? false : "Set SUCCESSOR_TEST_POSTGRES and SUCCESSOR_TEST_PG for isolated PostgreSQL.",
  timeout: 60_000,
}, async () => {
  const { Client } = createRequire(import.meta.url)(process.env.SUCCESSOR_TEST_PG);
  const clients = Array.from({ length: 3 }, () => new Client({ connectionString: process.env.SUCCESSOR_TEST_POSTGRES }));
  const [a, b, read] = clients;
  const schema = `successor_test_${randomUUID().replaceAll("-", "")}`;
  await Promise.all(clients.map((client) => client.connect()));
  try {
    await a.query(`CREATE SCHEMA "${schema}"`);
    await Promise.all(clients.map((client) => client.query(`SET search_path TO "${schema}"`)));
    await a.query(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    await a.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      SELECT id, id || '@example.test', 'hash', id, 'Test', id, 'full-name',
        CASE WHEN id LIKE 'owner%' THEN 'legacy-forever' ELSE 'free' END, '2026-01-01', '2026-01-01'
      FROM unnest(ARRAY['owner1','owner2','owner3','owner4','owner5','owner6','owner7','p1','p2','p3','p4','p5','p6','p7']) AS id;
      INSERT INTO lifetime_memberships (current_owner_user_id)
        SELECT id FROM users WHERE membership = 'legacy-forever';
      UPDATE users SET last_activity_at = clock_timestamp() - interval '31 days' WHERE id LIKE 'owner%';
      SELECT successor_save_assignment('owner1', 'p1', 30);
      SELECT successor_save_assignment('owner2', 'p2', 30);
      SELECT successor_save_assignment('owner3', 'p3', 30);
    `);

    await a.query("BEGIN");
    await a.query("UPDATE users SET last_activity_at = clock_timestamp() WHERE id = 'owner1'");
    const activeRace = b.query("SELECT successor_transfer('owner1', 'p1', true) AS result");
    await assertWaiting(activeRace);
    await a.query("COMMIT");
    assert.equal((await activeRace).rows[0].result, "not_due");

    await a.query("BEGIN");
    assert.equal((await a.query("SELECT successor_transfer('owner2', 'p2', true) AS result")).rows[0].result, "transferred");
    const lateActivity = b.query("UPDATE users SET last_activity_at = clock_timestamp() WHERE id = 'owner2'");
    await assertWaiting(lateActivity);
    await a.query("COMMIT");
    await lateActivity;
    assert.equal((await read.query("SELECT membership FROM users WHERE id = 'owner2'")).rows[0].membership, "free");

    await a.query("BEGIN");
    assert.equal((await a.query("SELECT successor_save_assignment('owner3', 'p4', 30) AS result")).rows[0].result, "saved");
    const reassignmentRace = b.query("SELECT successor_transfer('owner3', 'p3', true) AS result");
    await assertWaiting(reassignmentRace);
    await a.query("COMMIT");
    assert.equal((await reassignmentRace).rows[0].result, "not_due");
    assert.equal((await read.query("SELECT successor_user_id FROM successor_assignments WHERE owner_user_id = 'owner3'")).rows[0].successor_user_id, "p4");

    await a.query("BEGIN");
    assert.equal((await a.query("SELECT successor_transfer('owner4', 'p5', false) AS result")).rows[0].result, "transferred");
    const repeatRace = b.query("SELECT successor_transfer('owner4', 'p6', false) AS result");
    await assertWaiting(repeatRace);
    await a.query("COMMIT");
    assert.equal((await repeatRace).rows[0].result, "ineligible");
    assert.equal((await read.query("SELECT COUNT(*)::int AS n FROM successor_transfers WHERE original_owner_user_id = 'owner4'")).rows[0].n, 1);

    assert.equal((await b.query("SELECT successor_transfer('owner5', 'p5', false) AS result")).rows[0].result, "invalid_successor");
    assert.equal((await read.query("SELECT membership FROM users WHERE id = 'owner5'")).rows[0].membership, "legacy-forever");

    await a.query("BEGIN");
    assert.equal((await a.query("SELECT successor_transfer('owner6', 'p7', false) AS result")).rows[0].result, "transferred");
    const competingOwner = b.query("SELECT successor_transfer('owner7', 'p7', false) AS result");
    await assertWaiting(competingOwner);
    await a.query("COMMIT");
    assert.equal((await competingOwner).rows[0].result, "invalid_successor");
    assert.equal((await read.query("SELECT membership FROM users WHERE id = 'owner7'")).rows[0].membership, "legacy-forever");
  } finally {
    await a.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await Promise.all(clients.map((client) => client.end()));
  }
});
