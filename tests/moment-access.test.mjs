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

function loadModule(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("moment page authorizes before rendering and hides denied or missing moments", async () => {
  let allowed = false;
  let signedIn = true;
  const calls = [];
  const page = loadModule("app/moments/[id]/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => {
      if (!signedIn) throw new Error("sign in");
      return { id: "viewer" };
    } },
    "@/lib/moment-access": {
      getAccessibleMoment: async (...args) => {
        calls.push(args);
        return allowed
          ? { title: "A story", authorName: "Author", story: "Memory", writtenMessage: "Message" }
          : null;
      },
    },
  }).default;

  await assert.rejects(page({ params: Promise.resolve({ id: "moment" }) }), /not found/);
  assert.deepEqual(calls[0], ["viewer", "moment"]);
  allowed = true;
  const html = renderToStaticMarkup(await page({ params: Promise.resolve({ id: "moment" }) }));
  assert.match(html, /A story/);
  assert.match(html, /Memory/);
  assert.match(html, /Message/);
  signedIn = false;
  await assert.rejects(page({ params: Promise.resolve({ id: "moment" }) }), /sign in/);
  assert.equal(calls.length, 2);
});

test("moment audiences are enforced against current relationships in PostgreSQL", {
  skip: process.env.LEGACY_TREE_TEST_PGLITE ? false : "Set LEGACY_TREE_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.LEGACY_TREE_TEST_PGLITE);
  const db = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }

    for (const id of ["author", "accepted", "reverse", "pending", "declined", "relative", "outsider"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', '2026-01-01', '2026-01-01')`, [id, `${id}@example.test`]);
    }
    await db.exec(`
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('accepted', 'author', 'accepted', 'Accepted', 'Friend', 'accepted', '2026-01-01', '2026-01-01'),
             ('reverse', 'reverse', 'author', 'Author', 'Friend', 'accepted', '2026-01-01', '2026-01-01'),
             ('pending', 'author', 'pending', 'Pending', 'Friend', 'pending', '2026-01-01', '2026-01-01'),
             ('declined', 'author', 'declined', 'Declined', 'Friend', 'declined', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('shared-tree', 'author', 'Shared', '2026-01-01', '2026-01-01'),
             ('other-tree', 'outsider', 'Other', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      VALUES ('shared-tree', 'author', 'owner', '2026-01-01'),
             ('shared-tree', 'relative', 'member', '2026-01-01'),
             ('other-tree', 'outsider', 'owner', '2026-01-01');
      INSERT INTO moments (id, user_id, kind, title, story, details_json, audience, access_code_hash, created_at, updated_at)
      VALUES ('connections', 'author', 'shared', 'Connection title', 'Connection story', '{"writtenMessage":"Connection message"}', 'connections', NULL, '2026-01-01', '2026-01-01'),
             ('family', 'author', 'shared', 'Family title', 'Family story', '{}', 'family', NULL, '2026-01-01', '2026-01-01'),
             ('protected', 'author', 'personal', 'Protected', 'Secret', '{}', 'private', 'hash', '2026-01-01', '2026-01-01'),
             ('scheduled', 'author', 'cannot-open-until', 'Scheduled', 'Secret', '{}', 'private', NULL, '2026-01-01', '2026-01-01'),
             ('future', 'author', 'future-moment-maker', 'Future', 'Secret', '{}', 'private', NULL, '2026-01-01', '2026-01-01'),
             ('private', 'author', 'shared', 'Private', 'Secret', '{}', 'private', NULL, '2026-01-01', '2026-01-01'),
             ('public', 'author', 'shared', 'Public', 'Public story', '{}', 'public', NULL, '2026-01-01', '2026-01-01'),
             ('unexpected-code', 'author', 'shared', 'Protected', 'Secret', '{}', 'connections', 'hash', '2026-01-01', '2026-01-01');
    `);
    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    const access = loadModule("lib/moment-access.ts", {
      "server-only": {},
      "@/lib/db": { getSql: () => sql },
    });

    for (const viewer of ["author", "accepted", "reverse"]) {
      assert.equal((await access.getAccessibleMoment(viewer, "connections"))?.story, "Connection story", viewer);
    }
    assert.equal((await access.getAccessibleMoment("accepted", "connections"))?.writtenMessage, "Connection message");
    assert.equal(await access.getAccessibleMoment(null, "connections"), null);
    assert.equal(await access.getAccessibleMoment(null, "family"), null);
    for (const viewer of ["pending", "declined", "relative", "outsider"]) {
      assert.equal(await access.getAccessibleMoment(viewer, "connections"), null, viewer);
    }
    for (const viewer of ["author", "relative"]) {
      assert.equal((await access.getAccessibleMoment(viewer, "family"))?.story, "Family story", viewer);
    }
    for (const viewer of ["accepted", "pending", "outsider"]) {
      assert.equal(await access.getAccessibleMoment(viewer, "family"), null, viewer);
    }
    for (const id of ["protected", "scheduled", "future", "private", "public", "unexpected-code", "missing"]) {
      assert.equal(await access.getAccessibleMoment("author", id), null, id);
      assert.equal(await access.getAccessibleMoment("accepted", id), null, id);
    }
    assert.deepEqual(Array.from(await access.getAccessibleMoments("relative"), (moment) => moment.id), ["family"]);
    assert.deepEqual(Array.from(await access.getAccessibleMoments("author"), (moment) => moment.id).sort(), ["connections", "family"]);

    await db.exec(`
      UPDATE connected_lives SET status = 'declined' WHERE id = 'accepted';
      DELETE FROM legacy_tree_members WHERE tree_id = 'shared-tree' AND user_id = 'relative';
    `);
    assert.equal(await access.getAccessibleMoment("accepted", "connections"), null);
    assert.equal(await access.getAccessibleMoment("relative", "family"), null);
    assert.equal((await access.getAccessibleMoments("relative")).length, 0);
  } finally {
    await db.close();
  }
});
