import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, ...globals,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("visit tracker does not record during server rendering or prefetch", async () => {
  let calls = 0;
  const action = { recordProfileVisit: async () => { calls += 1; } };
  const tracker = loadModule("app/moment-maker/[id]/visit-tracker.tsx", {
    react: React,
    "@/app/actions/profile-visits": action,
  }).default;
  renderToStaticMarkup(React.createElement(tracker, { profileId: "person" }));
  assert.equal(calls, 0);

  let effect;
  const mounted = loadModule("app/moment-maker/[id]/visit-tracker.tsx", {
    react: { useEffect: (callback) => { effect = callback; }, startTransition: (callback) => callback() },
    "@/app/actions/profile-visits": action,
  }).default;
  mounted({ profileId: "person" });
  assert.equal(calls, 0);
  effect();
  await Promise.resolve();
  assert.equal(calls, 1);
});

test("dashboard keeps suggested connections separate from visits", () => {
  const component = loadModule("app/dashboard/frequent-visits.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "next/image": { default: () => null },
  }).default;
  const html = renderToStaticMarkup(React.createElement(component, {
    visited: [{ id: "a", displayName: "Visited Person", profilePhoto: null, relationship: "Moment Maker" }],
    suggested: [{ id: "b", displayName: "Suggested Person", profilePhoto: null, relationship: "Family" }],
  }));
  assert.ok(html.indexOf("Frequently Visited") < html.indexOf("Visited Person"));
  assert.ok(html.indexOf("Visited Person") < html.indexOf("Suggested Connections"));
  assert.ok(html.indexOf("Suggested Connections") < html.indexOf("Suggested Person"));
  assert.doesNotMatch(html, /visit count|ranking/i);
});

test("private visit tracking, suggestions, authorization and retention in PostgreSQL", {
  skip: process.env.FREQUENT_VISITS_TEST_PGLITE ? false : "Set FREQUENT_VISITS_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.FREQUENT_VISITS_TEST_PGLITE);
  const db = new PGlite();
  const bootstrap = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    await db.exec(fs.readFileSync(path.join(root, "db", "migrations", "017_profile_visits.sql"), "utf8"));
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    const schemaQuery = `SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_visits'
      ORDER BY ordinal_position`;
    assert.deepEqual((await db.query(schemaQuery)).rows, (await bootstrap.query(schemaQuery)).rows);
    for (const id of ["viewer", "other", "amy", "bob", "private", "frozen", "pending", ...Array.from({ length: 8 }, (_, i) => `person${i}`)]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', '2026-01-01', '2026-01-01')`, [id, `${id}@example.test`]);
    }
    await db.exec(`
      UPDATE users SET discoverability = 'private' WHERE id = 'private';
      UPDATE users SET account_status = 'frozen' WHERE id = 'frozen';
      UPDATE users SET public_profile_photo = FALSE, profile_photo_data = 'private-photo' WHERE id = 'bob';
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, relationship_type, relationship_subject_user_id, status, created_at, updated_at)
      VALUES ('b', 'viewer', 'bob', 'bob', 'Family', 'parent', 'viewer', 'accepted', '2026-01-01', '2026-01-01'),
             ('a', 'amy', 'viewer', 'viewer', 'Family', 'family', 'amy', 'accepted', '2026-01-01', '2026-01-01'),
             ('p', 'viewer', 'private', 'private', 'Family', 'family', 'viewer', 'accepted', '2026-01-01', '2026-01-01'),
             ('f', 'viewer', 'frozen', 'frozen', 'Family', 'family', 'viewer', 'accepted', '2026-01-01', '2026-01-01'),
             ('n', 'viewer', 'pending', 'pending', 'Family', 'family', 'viewer', 'pending', '2026-01-01', '2026-01-01');
    `);
    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    const env = { FREQUENT_VISITS_ENABLED: "true", CRON_SECRET: "test-secret" };
    const connected = loadModule("lib/connected-lives.ts");
    const visits = loadModule("lib/frequent-visits.ts", {
      "server-only": {}, "@/lib/db": { getSql: () => sql }, "@/lib/connected-lives": connected,
    }, { process: { env } });
    let viewer = { id: "viewer" };
    const actions = loadModule("app/actions/profile-visits.ts", {
      "@/lib/auth": { getCurrentUser: async () => viewer },
      "@/lib/db": { getSql: () => sql },
      "@/lib/frequent-visits": visits,
    });
    const ids = (rows) => Array.from(rows, (row) => row.id);
    let sections = await visits.getFrequentVisitSections("viewer");
    assert.deepEqual(ids(sections.visited), []);
    assert.deepEqual(ids(sections.suggested), ["amy", "bob"]);
    assert.equal(sections.suggested.find((p) => p.id === "bob").relationship, "Child");
    assert.equal(sections.suggested.find((p) => p.id === "bob").profilePhoto, null);

    await actions.recordProfileVisit("bob");
    await actions.recordProfileVisit("bob");
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM profile_visits")).rows[0].count, 1);
    await assert.rejects(actions.recordProfileVisit("viewer"), /another profile/);
    await assert.rejects(actions.recordProfileVisit("private"), /unavailable/);
    await assert.rejects(actions.recordProfileVisit("frozen"), /unavailable/);
    viewer = null;
    await assert.rejects(actions.recordProfileVisit("amy"), /signed-in/);
    viewer = { id: "other" };
    await actions.recordProfileVisit("amy");
    sections = await visits.getFrequentVisitSections("viewer");
    assert.deepEqual(ids(sections.visited), ["bob"]);
    assert.deepEqual(ids(sections.suggested), ["amy"]);
    assert.deepEqual(ids((await visits.getFrequentVisitSections("other")).visited), ["amy"]);

    await db.exec(`
      INSERT INTO profile_visits (viewer_user_id, profile_user_id, visit_date)
      VALUES ('viewer', 'amy', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 90);
    `);
    assert.deepEqual(ids((await visits.getFrequentVisitSections("viewer")).visited), ["bob"]);
    await db.exec("UPDATE users SET discoverability = 'private' WHERE id = 'bob'");
    assert.deepEqual(ids((await visits.getFrequentVisitSections("viewer")).visited), []);
    await db.exec("UPDATE users SET discoverability = 'public' WHERE id = 'bob'");

    for (let i = 0; i < 8; i++) {
      await db.query("INSERT INTO profile_visits (viewer_user_id, profile_user_id) VALUES ('viewer', $1)", [`person${i}`]);
    }
    await db.exec(`
      INSERT INTO profile_visits (viewer_user_id, profile_user_id, visit_date)
      VALUES ('viewer', 'person7', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 89);
    `);
    sections = await visits.getFrequentVisitSections("viewer");
    assert.deepEqual(ids(sections.visited), ["bob", "person0", "person1", "person2", "person3", "person4", "person5", "person7"]);
    assert.equal(sections.suggested.length, 0);

    const cron = loadModule("app/api/cron/profile-visits/route.ts", {
      "@/lib/db": { getSql: () => sql },
    }, { process: { env }, Response, console });
    assert.equal((await cron.GET(new Request("https://example.test/"))).status, 401);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM profile_visits WHERE visit_date < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 89")).rows[0].count, 1);
    assert.equal((await cron.GET(new Request("https://example.test/", { headers: { authorization: "Bearer test-secret" } }))).status, 204);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM profile_visits WHERE visit_date < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 89")).rows[0].count, 0);

    env.CRON_SECRET = "";
    assert.throws(() => visits.frequentVisitsEnabled(), /requires CRON_SECRET/);
    env.FREQUENT_VISITS_ENABLED = "false";
    assert.equal(visits.frequentVisitsEnabled(), false);
  } finally {
    await db.close();
    await bootstrap.close();
  }
});
