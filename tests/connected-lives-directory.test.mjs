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

function loadModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Date,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const relationships = loadModule("lib/connected-lives.ts");
const directory = loadModule("lib/connected-lives-directory.ts", {
  "@/lib/connected-lives": relationships,
});

test("directional relationships are reciprocal and legacy relationships are unchanged", () => {
  assert.equal(relationships.relationshipForViewer("parent", "bob", "alice"), "parent");
  assert.equal(relationships.relationshipForViewer("parent", "bob", "bob"), "child");
  assert.equal(relationships.relationshipForViewer("child", "alice", "alice"), "parent");
  assert.equal(relationships.relationshipForViewer("family", null, "alice"), "family");
});

test("directory searches and combines relationship and tag filters; sorts unknown dates last", () => {
  const people = [
    { id: "1", displayName: "Zoe", relationshipType: "parent", personTags: [{ label: "Veteran" }], acceptedAt: "2025-01-01T00:00:00Z" },
    { id: "2", displayName: "Amy", relationshipType: "close_friend", personTags: [{ label: "Teacher" }], acceptedAt: null },
    { id: "3", displayName: "Bob", relationshipType: "spouse_partner", personTags: [{ label: "Veteran" }], acceptedAt: "2026-01-01T00:00:00Z" },
    { id: "4", displayName: "Cara", relationshipType: "future_category", personTags: [{ label: "All" }], acceptedAt: "2024-01-01T00:00:00Z" },
  ];
  const ids = (search, relationship, tag, sort) =>
    Array.from(directory.filterConnections(people, search, relationship, tag, sort), (item) => item.id);
  assert.deepEqual(ids("veter", "family-group", "tag:veteran", "az"), ["3", "1"]);
  assert.deepEqual(ids("", "type:close_friend", "all", "az"), ["2"]);
  assert.deepEqual(ids("", "type:future_category", "all", "az"), ["4"]);
  assert.deepEqual(ids("", "all", "tag:all", "az"), ["4"]);
  assert.deepEqual(ids("", "all", "all", "recent"), ["3", "1", "4", "2"]);
  assert.deepEqual(ids("", "all", "all", "oldest"), ["4", "1", "3", "2"]);
  assert.deepEqual(ids("", "all", "all", "za"), ["1", "4", "3", "2"]);
});

test("migration, shared tags, privacy and future-record authorization in disposable PostgreSQL", {
  skip: process.env.CONNECTED_LIVES_TEST_PGLITE ? false : "Set CONNECTED_LIVES_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.CONNECTED_LIVES_TEST_PGLITE);
  const db = new PGlite();
  const bootstrap = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations")).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations.filter((file) => !file.startsWith("015_"))) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    const now = "2026-01-01T00:00:00.000Z";
    for (const id of ["alice", "bob", "outsider"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', $3, $3)`, [id, `${id}@example.test`, now]);
    }
    await db.exec(`
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, relationship_type, status, created_at, updated_at)
        VALUES ('legacy', 'alice', 'outsider', 'outsider', 'Connected Life', 'family', 'accepted', '${now}', '${now}'),
               ('pending', 'alice', 'bob', 'bob', 'Connected Life', NULL, 'pending', '${now}', '${now}');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at) VALUES ('tree', 'alice', 'Family', '${now}', '${now}');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('tree', 'alice', 'owner', '${now}');
      INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, status, created_at, updated_at)
        VALUES ('future', 'alice', 'tree', 'Future Person', 'Grandchild', 'awaiting-claim', '${now}', '${now}');
    `);
    const migration = fs.readFileSync(path.join(root, "db", "migrations", "015_connected_lives_directory.sql"), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    const schemaQuery = `SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public'
        AND (table_name = 'connected_lives_person_tags'
          OR (table_name = 'connected_lives' AND column_name IN ('accepted_at', 'relationship_subject_user_id')))
      ORDER BY table_name, column_name`;
    assert.deepEqual((await db.query(schemaQuery)).rows, (await bootstrap.query(schemaQuery)).rows);
    const legacy = (await db.query("SELECT relationship_type, accepted_at, relationship_subject_user_id FROM connected_lives WHERE id = 'legacy'")).rows[0];
    assert.equal(legacy.relationship_type, "family");
    assert.equal(legacy.accepted_at, null);
    assert.equal(legacy.relationship_subject_user_id, null);

    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    let currentUser = "bob";
    let sequence = 0;
    const deps = {
      "node:crypto": { randomUUID: () => `generated-${++sequence}` },
      "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": { requireUser: async () => ({ id: currentUser, displayName: currentUser }) },
      "@/lib/db": { getSql: () => sql },
      "@/lib/connected-lives": relationships,
    };
    const actions = loadModule("app/actions/connected-lives.ts", deps);
    assert.equal((await actions.respondToConnectedLivesRequest({}, form({
      requestId: "pending", response: "accept", relationshipType: "parent",
    }))).status, "connected");
    const accepted = (await db.query("SELECT relationship_type, accepted_at, relationship_subject_user_id FROM connected_lives WHERE id = 'pending'")).rows[0];
    assert.equal(accepted.relationship_type, "parent");
    assert.equal(accepted.relationship_subject_user_id, "alice");
    assert.ok(accepted.accepted_at);
    assert.equal(relationships.relationshipForViewer("parent", accepted.relationship_subject_user_id, "bob"), "parent");
    assert.equal(relationships.relationshipForViewer("parent", accepted.relationship_subject_user_id, "alice"), "child");
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "alice", label: " Veteran " }))).message);
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "alice", label: "veteran" }))).error);
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "outsider", label: "Teacher" }))).error);
    const tag = (await db.query("SELECT id FROM connected_lives_person_tags WHERE connection_id = 'pending'")).rows[0];
    currentUser = "outsider";
    assert.ok((await actions.removeConnectedLifeTag({}, form({ tagId: tag.id }))).error);
    currentUser = "alice";
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "bob", label: "Teacher" }))).message);

    let captured;
    const pageDeps = {
      "react/jsx-runtime": jsxRuntime,
      "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
      "@/lib/auth": deps["@/lib/auth"],
      "@/lib/db": deps["@/lib/db"],
      "@/lib/connected-lives": relationships,
      "@/app/actions/connected-lives": { markLivesNotificationsRead: () => {} },
      "./connection-response": { default: () => null },
      "./directory": { default: (props) => { captured = props; return null; } },
    };
    const page = loadModule("app/connected-lives/page.tsx", pageDeps).default;
    await db.exec("UPDATE users SET birth_year = 1980, share_birthday = TRUE, public_profile_photo = FALSE, profile_photo_data = 'hidden' WHERE id = 'bob'");
    renderToStaticMarkup(await page());
    let bob = captured.connections.find((item) => item.id === "pending");
    assert.equal(bob.relationshipType, "child");
    assert.equal(bob.birthYear, null);
    assert.equal(bob.profilePhoto, null);
    assert.equal(bob.personTags[0].label, "Teacher");
    assert.equal(bob.ownTags[0].label, "Veteran");
    currentUser = "bob";
    renderToStaticMarkup(await page());
    const alice = captured.connections.find((item) => item.id === "pending");
    assert.equal(alice.relationshipType, "parent");
    assert.equal(alice.personTags[0].label, "Veteran");
    assert.equal(alice.ownTags[0].label, "Teacher");
    currentUser = "alice";
    await db.exec(`INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('tree', 'bob', 'member', '${now}')`);
    renderToStaticMarkup(await page());
    bob = captured.connections.find((item) => item.id === "pending");
    assert.equal(bob.birthYear, 1980);
    await db.exec("UPDATE users SET share_birthday = FALSE WHERE id = 'bob'");
    renderToStaticMarkup(await page());
    assert.equal(captured.connections.find((item) => item.id === "pending").birthYear, null);
    await db.exec("UPDATE users SET public_profile_photo = TRUE, discoverability = 'private' WHERE id = 'bob'");
    renderToStaticMarkup(await page());
    bob = captured.connections.find((item) => item.id === "pending");
    assert.equal(bob.profilePhoto, null);
    assert.equal(bob.profileVisible, false);

    const futureDeps = {
      "react/jsx-runtime": jsxRuntime,
      "next/link": pageDeps["next/link"],
      "next/navigation": { notFound: () => { throw new Error("not found"); } },
      "@/lib/auth": deps["@/lib/auth"], "@/lib/db": deps["@/lib/db"],
    };
    const futurePage = loadModule("app/future-moment-maker/[id]/page.tsx", futureDeps).default;
    assert.match(renderToStaticMarkup(await futurePage({ params: Promise.resolve({ id: "future" }) })), /Future Person/);
    currentUser = "outsider";
    await assert.rejects(futurePage({ params: Promise.resolve({ id: "future" }) }), /not found/);
    currentUser = "alice";
    assert.ok((await actions.updateConnectedLivesRelationship({}, form({
      connectionId: "pending", relationshipType: "parent",
    }))).message);
    const updated = (await db.query("SELECT relationship_type, accepted_at, relationship_subject_user_id FROM connected_lives WHERE id = 'pending'")).rows[0];
    assert.equal(updated.relationship_subject_user_id, "bob");
    assert.equal(relationships.relationshipForViewer(updated.relationship_type, updated.relationship_subject_user_id, "alice"), "parent");
    assert.equal(relationships.relationshipForViewer(updated.relationship_type, updated.relationship_subject_user_id, "bob"), "child");
    assert.equal(String(updated.accepted_at), String(accepted.accepted_at));
    assert.ok((await actions.removeConnectedLifeTag({}, form({ tagId: tag.id }))).message);
    await db.exec("UPDATE connected_lives SET status = 'declined' WHERE id = 'pending'");
    assert.ok((await actions.addConnectedLifeTag({}, form({ connectionId: "pending", subjectId: "bob", label: "Veteran" }))).error);
  } finally {
    await db.close();
    await bootstrap.close();
  }
});
