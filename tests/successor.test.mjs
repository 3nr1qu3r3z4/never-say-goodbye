import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies, env = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, process: { env }, Response, console,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("successor controls show the four transfer choices and invalid-recipient guidance", () => {
  const Controls = loadModule("app/my-profile/successor/successor-controls.tsx", {
    react: React, "react/jsx-runtime": jsxRuntime,
    "@/app/actions/successor": { saveSuccessor: async () => ({}), removeSuccessor: async () => ({}) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Controls, {
    assignment: { successorId: null, name: null, inactivityDays: 60, valid: false },
    candidates: [{ id: "person", name: "Alex", username: "alex" }],
  }));
  for (const label of ["After 30 days inactive", "After 60 days inactive", "After 90 days inactive", "Transfer now"]) {
    assert.ok(html.includes(label));
  }
  assert.match(html, /no longer available or already has Lifetime Membership/);
  assert.match(html, /Alex \(@alex\)/);
});

test("successor actions authenticate, validate and require immediate transfer confirmation", async () => {
  let user = null;
  let result = "saved";
  const calls = [];
  const actions = loadModule("app/actions/successor.ts", {
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => async (strings, ...values) => {
      calls.push({ text: strings.join("?"), values });
      return [{ result }];
    } },
  });
  const form = new FormData();
  form.set("successorId", "person");
  form.set("trigger", "30");
  assert.match((await actions.saveSuccessor({}, form)).error, /Sign in/);
  assert.equal(calls.length, 0);
  user = { id: "owner" };
  form.set("successorId", "owner");
  assert.match((await actions.saveSuccessor({}, form)).error, /other than yourself/);
  form.set("successorId", "person");
  form.set("trigger", "now");
  assert.match((await actions.saveSuccessor({}, form)).error, /Confirm/);
  assert.equal(calls.length, 0);
  form.set("trigger", "60");
  form.set("ownerId", "another-user");
  assert.match((await actions.saveSuccessor({}, form)).success, /saved/);
  assert.deepEqual(calls[0].values, ["owner", "person", 60]);
  result = "invalid_successor";
  assert.match((await actions.saveSuccessor({}, form)).error, /available successor/);
  result = "ineligible";
  assert.match((await actions.saveSuccessor({}, form)).error, /cannot be transferred/);
  form.set("trigger", "now");
  form.set("confirmTransfer", "on");
  result = "transferred";
  await assert.rejects(actions.saveSuccessor({}, form), /redirect:\/dashboard\?successor=transferred/);
});

test("scheduled processing rejects unauthorized requests and reports invalid assignments", async () => {
  let queried = false;
  const route = loadModule("app/api/cron/successor-transfers/route.ts", {
    "next/server": { connection: async () => {} },
    "@/lib/db": { getSql: () => async (strings) => {
      queried = true;
      if (strings.join("?").includes("FROM successor_assignments")) return [{ owner: "owner", successor: null }];
      return [{ result: "invalid_successor" }];
    } },
  }, { CRON_SECRET: "test-secret" });
  assert.equal((await route.GET(new Request("http://localhost"))).status, 401);
  assert.equal(queried, false);
  const previous = console.error;
  try {
    console.error = () => {};
    assert.equal((await route.GET(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }))).status, 500);
  } finally {
    console.error = previous;
  }
});

test("successor transfers enforce eligibility, inactivity, permanence and rollback", {
  skip: process.env.SUCCESSOR_TEST_PGLITE ? false : "Set SUCCESSOR_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.SUCCESSOR_TEST_PGLITE);
  const db = new PGlite();
  try {
    await db.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, discoverability, created_at, updated_at)
      SELECT id, id || '@example.test', 'hash', id, 'Test', id, 'full-name',
        CASE WHEN id LIKE 'owner%' OR id = 'already-lifetime' THEN 'legacy-forever'
          WHEN id = 'paid' THEN 'legacy-plus' WHEN id = 'paid-legacy' THEN 'tier-3' ELSE 'free' END,
        CASE WHEN id = 'hidden' THEN 'private' ELSE 'searchable' END,
        '2026-01-01', '2026-01-01'
      FROM unnest(ARRAY['owner30','owner60','owner90','owner-manual','owner-paid','owner-rollback',
        'person30','person60','person90','paid','paid-legacy','other','hidden','already-lifetime']) AS id;
      INSERT INTO lifetime_memberships (current_owner_user_id)
        SELECT id FROM users WHERE membership = 'legacy-forever';
      INSERT INTO legacy_successors (id, owner_user_id, successor_user_id, successor_name, status, created_at, updated_at)
        VALUES ('old', 'owner30', 'person30', 'Old designation', 'designated', '2026-01-01', '2026-01-01');
    `);
    await db.exec(fs.readFileSync(path.join(root, "db", "migrations", "035_successor_membership_transfer.sql"), "utf8"));
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM legacy_successors WHERE id = 'old'")).rows[0].n, 1);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM successor_assignments")).rows[0].n, 0);

    const result = async (sql, params) => (await db.query(sql, params)).rows[0].result;
    assert.equal(await result("SELECT successor_save_assignment($1, $2, $3) AS result", ["owner30", "already-lifetime", 30]), "invalid_successor");
    assert.equal(await result("SELECT successor_save_assignment($1, $2, $3) AS result", ["owner30", "hidden", 30]), "invalid_successor");
    assert.equal(await result("SELECT successor_save_assignment($1, $2, $3) AS result", ["owner30", "owner30", 30]), "invalid_successor");
    assert.equal(await result("SELECT successor_save_assignment($1, $2, $3) AS result", ["owner30", "person30", 45]), "invalid_trigger");
    assert.equal(await result("SELECT successor_save_assignment($1, $2, $3) AS result", ["other", "person30", 30]), "ineligible");

    for (const days of [30, 60, 90]) {
      const owner = `owner${days}`;
      const person = `person${days}`;
      assert.equal(await result("SELECT successor_save_assignment($1, $2, $3) AS result", [owner, person, days]), "saved");
      await db.query("UPDATE users SET last_activity_at = clock_timestamp() - make_interval(days => $2) + interval '1 hour' WHERE id = $1", [owner, days]);
      assert.equal(await result("SELECT successor_transfer($1, $2, true) AS result", [owner, person]), "not_due");
      await db.query("UPDATE users SET last_activity_at = clock_timestamp() - make_interval(days => $2) - interval '1 hour' WHERE id = $1", [owner, days]);
      assert.equal(await result("SELECT successor_transfer($1, $2, true) AS result", [owner, person]), "transferred");
      assert.equal(await result("SELECT successor_transfer($1, $2, true) AS result", [owner, person]), "ineligible");
      const memberships = (await db.query("SELECT id, membership FROM users WHERE id IN ($1, $2) ORDER BY id", [owner, person])).rows;
      assert.deepEqual(memberships.map((row) => row.membership), ["free", "legacy-forever"]);
      assert.equal(await result("SELECT successor_save_assignment($1, $2, 30) AS result", [person, "other"]), "ineligible");
    }

    assert.equal(await result("SELECT successor_transfer($1, $2, false) AS result", ["owner-manual", "paid"]), "transferred");
    assert.deepEqual((await db.query("SELECT membership FROM users WHERE id = 'paid'")).rows[0], { membership: "legacy-forever" });
    assert.equal((await db.query("SELECT successor_previous_membership FROM successor_transfers WHERE original_owner_user_id = 'owner-manual'")).rows[0].successor_previous_membership, "legacy-plus");
    assert.equal(await result("SELECT successor_transfer($1, $2, false) AS result", ["owner-paid", "paid-legacy"]), "transferred");
    assert.equal((await db.query("SELECT membership FROM users WHERE id = 'paid-legacy'")).rows[0].membership, "legacy-forever");
    await db.exec("UPDATE users SET membership = 'legacy-forever' WHERE id = 'owner-manual'; INSERT INTO lifetime_memberships (current_owner_user_id) VALUES ('owner-manual')");
    assert.equal(await result("SELECT successor_save_assignment($1, $2, 30) AS result", ["owner-manual", "other"]), "ineligible");

    assert.equal(await result("SELECT successor_save_assignment($1, $2, 30) AS result", ["owner-rollback", "other"]), "saved");
    await db.exec(`
      CREATE FUNCTION fail_successor_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'simulated failure'; END $$;
      CREATE TRIGGER fail_successor_transfer BEFORE INSERT ON successor_transfers
      FOR EACH ROW EXECUTE FUNCTION fail_successor_transfer();
    `);
    await assert.rejects(db.query("SELECT successor_transfer($1, $2, false)", ["owner-rollback", "other"]), /simulated failure/);
    assert.equal((await db.query("SELECT membership FROM users WHERE id = 'owner-rollback'")).rows[0].membership, "legacy-forever");
    assert.equal((await db.query("SELECT membership FROM users WHERE id = 'other'")).rows[0].membership, "free");
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM successor_assignments WHERE owner_user_id = 'owner-rollback'")).rows[0].n, 1);
    await db.exec("DROP TRIGGER fail_successor_transfer ON successor_transfers");
    await db.exec("DELETE FROM users WHERE id = 'other'");
    assert.equal((await db.query("SELECT successor_user_id FROM successor_assignments WHERE owner_user_id = 'owner-rollback'")).rows[0].successor_user_id, null);
    assert.equal(await result("SELECT successor_transfer($1, NULL, true) AS result", ["owner-rollback"]), "not_due");
    await db.exec("UPDATE users SET last_activity_at = clock_timestamp() - interval '31 days' WHERE id = 'owner-rollback'");
    assert.equal(await result("SELECT successor_transfer($1, NULL, true) AS result", ["owner-rollback"]), "invalid_successor");
    assert.equal((await db.query("SELECT membership FROM users WHERE id = 'owner-rollback'")).rows[0].membership, "legacy-forever");
  } finally {
    await db.close();
  }
});
