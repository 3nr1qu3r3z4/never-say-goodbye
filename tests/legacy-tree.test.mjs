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
    exports, Date,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function familyComponent(user, sql) {
  return loadModule("app/legacy-tree/family-members.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children) },
    "@/app/actions/family-tree": { createLegacyTree: async () => {} },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/db": { getSql: () => sql },
    "./family-member-form": { default: () => React.createElement("div", null, "Family management form") },
  }).default;
}

async function renderFamily(component) {
  let element = await component();
  if (element.type.name === "FamilyMembersForUser") {
    element = await element.type(element.props);
  }
  return renderToStaticMarkup(element);
}

test("tree page never renders the hard-coded example family", () => {
  const page = loadModule("app/legacy-tree/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: React,
    "./family-members": { default: () => null },
  }).default;
  const html = renderToStaticMarkup(React.createElement(page));
  assert.doesNotMatch(html, /John Michael Doe|Mary Elizabeth Doe|James Michael Doe|Emma Rose Doe|Debbie Doe|Bobby Hayes/);
});

test("guests and users without a tree receive the empty state", async () => {
  const sql = () => ({});
  sql.transaction = async () => [[], [], [], [], [], []];
  for (const [user, createTarget, connectTarget] of [
    [null, "/signup", "/login"],
    [{ id: "owner" }, null, "/connected-lives"],
  ]) {
    const html = await renderFamily(familyComponent(user, sql));
    assert.match(html, /Your Legacy Tree is waiting to be built\./);
    assert.match(html, /Connect family members, add Future Moment Makers/);
    assert.match(html, /Create My Legacy Tree/);
    assert.match(html, /Connect Family/);
    if (createTarget) assert.ok(html.includes(`href="${createTarget}"`));
    else assert.match(html, /<form/);
    assert.ok(html.includes(`href="${connectTarget}"`));
    assert.doesNotMatch(html, /John Michael Doe|Debbie Doe/);
  }
});

test("tree creation and membership-scoped display in disposable PostgreSQL", {
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
    for (const id of ["owner", "relative", "outsider", "orphan", "rollback"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', '2026-01-01', '2026-01-01')`, [id, `${id}@example.test`]);
    }
    const sql = (strings, ...values) => ({
      text: strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, ""),
      values,
    });
    let failMembershipInsert = false;
    sql.transaction = async (queries) => db.transaction(async (tx) => {
      const results = [];
      for (const query of queries) {
        if (failMembershipInsert && query.text.includes("INSERT INTO legacy_tree_members")) {
          throw new Error("simulated membership failure");
        }
        results.push((await tx.query(query.text, query.values)).rows);
      }
      return results;
    });
    let user = { id: "owner", displayName: "Owner" };
    let sequence = 0;
    const actions = loadModule("app/actions/family-tree.ts", {
      "node:crypto": { randomUUID: () => `created-${++sequence}` },
      "next/cache": { revalidatePath: () => {} },
      "next/navigation": { redirect: () => { throw new Error("redirect"); } },
      "@/lib/auth": { getCurrentUser: async () => user },
      "@/lib/db": { getSql: () => sql },
    });
    await Promise.all([actions.createLegacyTree(), actions.createLegacyTree()]);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_trees WHERE owner_user_id = 'owner'")).rows[0].count, 1);
    const [tree] = (await db.query("SELECT id, name FROM legacy_trees WHERE owner_user_id = 'owner'")).rows;
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_tree_members WHERE tree_id = $1 AND user_id = 'owner'", [tree.id])).rows[0].count, 1);
    await db.query(`INSERT INTO legacy_tree_members (tree_id, user_id, relationship, role, joined_at) VALUES ($1, 'relative', 'Sibling', 'member', '2026-01-01')`, [tree.id]);
    await db.query(`INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, status, created_at, updated_at)
      VALUES ('future', 'owner', $1, 'Future Relative', 'Grandchild', 'claimed', '2026-01-01', '2026-01-01')`, [tree.id]);
    await db.query(`INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, created_at, updated_at)
      VALUES ('placeholder', $1, 'owner', 'Family History', 'Grandparent', '2026-01-01', '2026-01-01')`, [tree.id]);
    await db.exec(`
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('outsider-tree', 'outsider', 'Private Other Tree', '2026-01-01', '2026-01-01'),
             ('orphan-tree', 'orphan', 'Existing Tree', '2026-01-01', '2026-01-01'),
             ('second-tree', 'relative', 'Second Family Tree', '2026-01-02', '2026-01-02');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      VALUES ('outsider-tree', 'outsider', 'owner', '2026-01-01'),
             ('second-tree', 'owner', 'member', '2026-01-02');
      INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, created_at, updated_at)
      VALUES ('second-placeholder', 'second-tree', 'owner', 'Second Tree Relative', 'Cousin', '2026-01-02', '2026-01-02');
      INSERT INTO moments (id, user_id, family_placeholder_id, kind, title, story, access_code_hash, created_at, updated_at)
      VALUES ('own', 'owner', 'placeholder', 'shared', 'Own Story', 'Visible story', NULL, '2026-01-01', '2026-01-01'),
             ('protected', 'owner', 'placeholder', 'shared', 'Protected Story', 'Hidden protected body', 'hash', '2026-01-01', '2026-01-01'),
             ('other', 'relative', 'placeholder', 'shared', 'Other Author Story', 'Hidden other body', NULL, '2026-01-01', '2026-01-01');
    `);
    const html = await renderFamily(familyComponent(user, sql));
    for (const text of ["owner", "relative", "Sibling", "Future Relative", "Claimed", "Family History", "Family management form", "Own Story", "Visible story", "Protected Story", "Protected or scheduled content is not shown here."]) {
      assert.ok(html.includes(text), `Expected ${text} in the rendered tree`);
    }
    assert.doesNotMatch(html, /Private Other Tree|outsider|John Michael Doe|Debbie Doe|Hidden protected body|Other Author Story|Hidden other body/);
    const secondTreeStart = html.indexOf('<section aria-label="Second Family Tree">');
    assert.ok(secondTreeStart > 0);
    const secondTreeEnd = html.indexOf("</section>", secondTreeStart);
    const secondTree = html.slice(secondTreeStart, secondTreeEnd);
    assert.ok(secondTree.includes("Second Tree Relative"));
    assert.equal(secondTree.includes("Family History"), false);
    assert.equal(html.slice(secondTreeEnd).includes("Second Tree Relative"), false);
    assert.equal(html.slice(0, secondTreeStart).includes("Second Tree Relative"), false);

    user = { id: "orphan", displayName: "Orphan" };
    await actions.createLegacyTree();
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_trees WHERE owner_user_id = 'orphan'")).rows[0].count, 1);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_tree_members WHERE tree_id = 'orphan-tree' AND user_id = 'orphan'")).rows[0].count, 1);
    user = { id: "rollback", displayName: "Rollback" };
    failMembershipInsert = true;
    await assert.rejects(actions.createLegacyTree(), /simulated membership failure/);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM legacy_trees WHERE owner_user_id = 'rollback'")).rows[0].count, 0);
    user = null;
    await assert.rejects(actions.createLegacyTree(), /redirect/);
  } finally {
    await db.close();
  }
});
