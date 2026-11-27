import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies, env = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, process: { env },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function form(candidate) {
  const data = new FormData();
  data.set("successorId", candidate);
  data.set("ownerId", "owner");
  return data;
}

test("preview requires both an explicit flag and an approved account", async () => {
  const env = {};
  const service = loadModule("lib/successor.ts", {
    "server-only": {},
    "@/lib/auth": { requireUser: async () => ({ id: "owner" }) },
    "@/lib/db": { getSql: () => { throw new Error("Database must not be accessed"); } },
  }, env);
  assert.equal(service.successorPreviewEnabled("owner"), false);
  env.SUCCESSOR_ASSIGNMENT_ENABLED = "true";
  assert.equal(service.successorPreviewEnabled("owner"), false);
  env.SUCCESSOR_ASSIGNMENT_PREVIEW_USER_IDS = " other, owner ";
  assert.equal(service.successorPreviewEnabled("owner"), true);
  assert.equal(service.successorPreviewEnabled("someone-else"), false);
  env.SUCCESSOR_ASSIGNMENT_ENABLED = "false";
  await assert.rejects(service.getOwnSuccessor(), /not available/);
});

test("owner page displays informational wording, status and controls only in preview", async () => {
  let enabled = false;
  let signedIn = true;
  let queries = 0;
  const Controls = loadModule("app/my-profile/successor/successor-controls.tsx", {
    react: React, "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "@/app/actions/successor": { saveSuccessor: async () => ({}), removeSuccessor: async () => ({}) },
  }).default;
  const Page = loadModule("app/my-profile/successor/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("Not found"); } },
    "@/lib/auth": { requireUser: async () => {
      if (!signedIn) throw new Error("Sign in required");
      return { id: "owner" };
    } },
    "@/lib/successor": {
      successorPreviewEnabled: () => enabled,
      getOwnSuccessor: async () => { queries++; return { name: "Alex", available: false }; },
      getOwnSuccessorCandidates: async () => { queries++; return [{ id: "bob", name: "Bob" }]; },
    },
    "./successor-controls": { default: Controls },
  }).default;
  await assert.rejects(Page(), /Not found/);
  assert.equal(queries, 0);
  enabled = true;
  const html = renderToStaticMarkup(await Page());
  assert.match(html, /This designation is informational only and does not grant access, ownership, transfer rights, legal authority, or decision-making authority\./);
  assert.match(html, /Alex/);
  assert.match(html, /Unavailable or no longer connected/);
  assert.match(html, /Replace successor/);
  assert.match(html, /Remove designation/);
  assert.match(html, /not notified and is not asked to accept/);
  signedIn = false;
  await assert.rejects(Page(), /Sign in required/);
  assert.equal(queries, 2);
});

test("migration and successor actions preserve history and enforce owner and connection scope", {
  skip: process.env.SUCCESSOR_TEST_PGLITE ? false : "Set SUCCESSOR_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.SUCCESSOR_TEST_PGLITE);
  const db = new PGlite();
  const standalone = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((name) => /^\d+_.+\.sql$/.test(name) && name < "029_").sort();
    for (const file of migrations) await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    await standalone.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('a', 'a@example.test', 'hash', 'A', 'Test', 'Alice', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('b', 'b@example.test', 'hash', 'B', 'Test', 'Bob', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('pending', 'pending@example.test', 'hash', 'P', 'Test', 'Pending', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('other', 'other@example.test', 'hash', 'Other', 'Test', 'Other', 'full-name', 'free', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('tree', 'owner', 'Family', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_successors (id, legacy_tree_id, owner_user_id, successor_user_id, successor_name, status, created_at, updated_at)
      VALUES ('old1', 'tree', 'owner', 'a', 'Old Alice', 'pending', '2026-01-01', '2026-01-01'),
             ('old2', 'tree', 'owner', 'b', 'Old Bob', 'accepted', '2026-01-01', '2026-01-01');
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('ca', 'owner', 'a', 'Alice', 'Family', 'accepted', '2026-01-01', '2026-01-01'),
             ('cb', 'b', 'owner', 'Owner', 'Family', 'accepted', '2026-01-01', '2026-01-01'),
             ('cp', 'owner', 'pending', 'Pending', 'Family', 'pending', '2026-01-01', '2026-01-01');
    `);
    const migration = fs.readFileSync(path.join(root, "db", "migrations", "029_account_successors.sql"), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    const columns = `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'legacy_successors' ORDER BY ordinal_position`;
    assert.deepEqual((await db.query(columns)).rows, (await standalone.query(columns)).rows);
    assert.deepEqual((await db.query("SELECT id, successor_name, status FROM legacy_successors ORDER BY id")).rows, [
      { id: "old1", successor_name: "Old Alice", status: "pending" },
      { id: "old2", successor_name: "Old Bob", status: "accepted" },
    ]);
    await db.exec("DELETE FROM legacy_trees WHERE id = 'tree'");
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM legacy_successors WHERE legacy_tree_id IS NULL")).rows[0].n, 2);

    const sql = async (strings, ...values) => {
      const query = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(query, values)).rows;
    };
    let viewer = "owner";
    const env = { SUCCESSOR_ASSIGNMENT_PREVIEW_USER_IDS: "owner,other" };
    const auth = {
      requireUser: async () => { if (!viewer) throw new Error("Sign in required"); return { id: viewer }; },
      getCurrentUser: async () => viewer ? { id: viewer } : null,
    };
    const service = loadModule("lib/successor.ts", {
      "server-only": {}, "@/lib/auth": auth, "@/lib/db": { getSql: () => sql },
    }, env);
    const actions = loadModule("app/actions/successor.ts", {
      "node:crypto": { randomUUID }, "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": auth, "@/lib/db": { getSql: () => sql }, "@/lib/successor": service,
    }, env);
    assert.ok((await actions.saveSuccessor({}, form("a"))).error);
    env.SUCCESSOR_ASSIGNMENT_ENABLED = "true";
    viewer = null;
    assert.ok((await actions.saveSuccessor({}, form("a"))).error);
    viewer = "a";
    assert.ok((await actions.saveSuccessor({}, form("owner"))).error);
    viewer = "owner";
    assert.ok((await actions.saveSuccessor({}, form("owner"))).error);
    assert.ok((await actions.saveSuccessor({}, form("pending"))).error);
    assert.ok((await actions.saveSuccessor({}, form("other"))).error);
    assert.deepEqual(Array.from(await service.getOwnSuccessorCandidates(), (person) => person.id), ["a", "b"]);
    assert.equal(await service.getOwnSuccessor(), null);
    assert.ok((await actions.saveSuccessor({}, form("a"))).success);
    assert.equal((await service.getOwnSuccessor()).name, "Alice");
    assert.equal((await service.getOwnSuccessor()).available, true);
    await assert.rejects(db.exec(`INSERT INTO legacy_successors
      (id, owner_user_id, successor_user_id, successor_name, status, created_at, updated_at)
      VALUES ('duplicate', 'owner', 'b', 'Bob', 'designated', '2026-01-01', '2026-01-01')`), /unique/i);
    env.SUCCESSOR_ASSIGNMENT_ENABLED = "false";
    assert.ok((await actions.removeSuccessor()).error);
    await assert.rejects(service.getOwnSuccessor(), /not available/);
    env.SUCCESSOR_ASSIGNMENT_ENABLED = "true";
    assert.equal((await service.getOwnSuccessor()).name, "Alice");

    viewer = "other";
    assert.equal(await service.getOwnSuccessor(), null);
    assert.ok((await actions.removeSuccessor()).error);
    assert.ok((await actions.saveSuccessor({}, form("a"))).error);
    viewer = "owner";
    assert.ok((await actions.saveSuccessor({}, form("b"))).success);
    assert.equal((await service.getOwnSuccessor()).name, "Bob");
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM legacy_successors WHERE owner_user_id = 'owner' AND status = 'designated'")).rows[0].n, 1);
    await db.exec("UPDATE connected_lives SET status = 'declined' WHERE id = 'cb'");
    assert.equal((await service.getOwnSuccessor()).available, false);
    assert.ok((await actions.saveSuccessor({}, form("b"))).error);
    assert.ok((await actions.removeSuccessor()).success);
    assert.equal(await service.getOwnSuccessor(), null);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM legacy_successors WHERE status IN ('pending', 'accepted')")).rows[0].n, 2);

    await db.exec("UPDATE connected_lives SET status = 'accepted' WHERE id = 'cb'");
    await Promise.all([actions.saveSuccessor({}, form("a")), actions.saveSuccessor({}, form("b"))]);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM legacy_successors WHERE owner_user_id = 'owner' AND status = 'designated'")).rows[0].n, 1);
    const selected = (await db.query("SELECT successor_user_id AS id FROM legacy_successors WHERE status = 'designated'")).rows[0].id;
    await db.query("DELETE FROM users WHERE id = $1", [selected]);
    assert.equal((await service.getOwnSuccessor()).available, false);
    assert.ok((await actions.removeSuccessor()).success);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM notifications")).rows[0].n, 0);
  } finally {
    await db.close();
    await standalone.close();
  }
});
