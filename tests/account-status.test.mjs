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

function loadProfilePage(sql) {
  const source = fs.readFileSync(path.join(root, "app", "my-profile", "page.tsx"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children }) => React.createElement("a", null, children) },
    "@/lib/auth": { requireUser: async () => ({ id: "owner", displayName: "Owner" }) },
    "@/lib/db": { getSql: () => sql },
    "./profile-editor": { default: () => null },
    "./appearance": { default: () => null },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports.default;
}

test("owner profile displays the stored account status without transition controls", async () => {
  for (const [status, label] of [
    ["active", "Active Moment Maker"],
    ["inactive", "Inactive"],
    ["memorialized", "Memorialized"],
    ["frozen", "Frozen"],
  ]) {
    const calls = [];
    const page = loadProfilePage(async (strings, ...values) => {
      calls.push({ text: strings.join("?"), values });
      return [{ accountStatus: status, displayName: "Owner" }];
    });
    const html = renderToStaticMarkup(await page());
    assert.match(html, new RegExp(`Account status:.*${label}`));
    assert.doesNotMatch(html, /<button|<form/);
    assert.match(calls[0].text, /u\.account_status AS "accountStatus"/);
    assert.equal(calls[0].values[0], "owner");
  }
});

test("migration preserves data and records only committed status changes", {
  skip: process.env.ACCOUNT_STATUS_TEST_PGLITE ? false : "Set ACCOUNT_STATUS_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.ACCOUNT_STATUS_TEST_PGLITE);
  const db = new PGlite();
  const bootstrap = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((file) => /^\d+_.+\.sql$/.test(file) && !file.startsWith("016_"))
      .sort();
    for (const file of migrations) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('other', 'other@example.test', 'hash', 'Other', 'Test', 'Other', 'full-name', 'free', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('tree', 'owner', 'Tree', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      VALUES ('tree', 'owner', 'owner', '2026-01-01');
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('connection', 'owner', 'other', 'Other', 'Family', 'accepted', '2026-01-01', '2026-01-01');
      INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, created_at, updated_at)
      VALUES ('future', 'owner', 'tree', 'Future', 'Family', '2026-01-01', '2026-01-01');
      INSERT INTO moments (id, user_id, future_moment_maker_id, kind, title, created_at, updated_at)
      VALUES ('moment', 'owner', 'future', 'future-moment-maker', 'Message', '2026-01-01', '2026-01-01');
    `);
    const migration = fs.readFileSync(path.join(root, "db", "migrations", "016_account_status.sql"), "utf8");
    await db.exec("ALTER TABLE users ADD COLUMN account_status TEXT");
    await assert.rejects(db.exec(migration), /Account status schema already exists/);
    await db.exec("ROLLBACK; ALTER TABLE users DROP COLUMN account_status");
    await db.exec(migration);
    await db.exec(migration);
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    const columns = `SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public'
        AND (table_name = 'account_status_history' OR (table_name = 'users' AND column_name = 'account_status'))
      ORDER BY table_name, ordinal_position`;
    assert.deepEqual((await db.query(columns)).rows, (await bootstrap.query(columns)).rows);
    assert.equal((await db.query("SELECT account_status FROM users WHERE id = 'owner'")).rows[0].account_status, "active");
    assert.equal((await db.query("SELECT count(*)::int AS count FROM account_status_history")).rows[0].count, 0);
    await db.exec("UPDATE users SET account_status = 'active' WHERE id = 'owner'");
    assert.equal((await db.query("SELECT count(*)::int AS count FROM account_status_history")).rows[0].count, 0);
    await db.exec("UPDATE users SET account_status = 'inactive' WHERE id = 'owner'");
    const history = (await db.query("SELECT previous_status, new_status, actor_user_id, changed_by_database_role FROM account_status_history")).rows;
    assert.equal(history.length, 1);
    assert.equal(history[0].previous_status, "active");
    assert.equal(history[0].new_status, "inactive");
    assert.equal(history[0].actor_user_id, null);
    assert.ok(history[0].changed_by_database_role);
    await assert.rejects(db.exec("UPDATE users SET account_status = 'future' WHERE id = 'owner'"));
    await db.exec("BEGIN; UPDATE users SET account_status = 'frozen' WHERE id = 'owner'; ROLLBACK;");
    assert.equal((await db.query("SELECT count(*)::int AS count FROM account_status_history")).rows[0].count, 1);
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('new', 'new@example.test', 'hash', 'New', 'Test', 'New', 'full-name', 'free', '2026-01-01', '2026-01-01');
    `);
    assert.equal((await db.query("SELECT account_status FROM users WHERE id = 'new'")).rows[0].account_status, "active");
    await db.exec("UPDATE users SET account_status = 'memorialized' WHERE id = 'new'");
    await db.exec("UPDATE users SET account_status = 'frozen' WHERE id = 'new'");
    assert.equal((await db.query("SELECT count(*)::int AS count FROM account_status_history WHERE user_id = 'new'")).rows[0].count, 2);
    for (const table of ["legacy_tree_members", "connected_lives", "future_moment_makers", "moments"]) {
      assert.equal((await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 1);
    }
    await assert.rejects(db.exec("DELETE FROM users WHERE id = 'new'"));
  } finally {
    await db.close();
    await bootstrap.close();
  }
});
