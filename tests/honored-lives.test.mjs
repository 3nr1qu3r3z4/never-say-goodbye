import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import crypto from "node:crypto";
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
    exports, Date, Buffer,
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

test("Honored Life form provides the requested fields and explains tree visibility", () => {
  const component = loadModule("app/honored-lives/honored-life-form.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: React,
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "@/app/actions/honored-lives": { createHonoredLife: async () => ({}) },
    "@/lib/convert-image": { toSupportedImage: async (file) => file },
  }).default;
  const html = renderToStaticMarkup(React.createElement(component, {
    trees: [{ id: "tree", name: "Family" }],
    placeholders: [{ id: "person", treeId: "tree", name: "Grandmother", relationship: "Grandmother", birthDate: "", birthYear: null, deathYear: null }],
  }));
  for (const label of ["Legacy Tree", "Family Placeholder", "Name", "Relationship", "Birth Date", "Passing Date", "Short Story", "Profile Photo"]) {
    assert.ok(html.includes(label), label);
  }
  assert.match(html, /Create a new placeholder/);
  assert.match(html, /Grandmother/);
  assert.match(html, /All members of this tree can see/);
});

test("Honored Lives creation, access and atomicity in PostgreSQL", {
  skip: process.env.HONORED_LIVES_TEST_PGLITE ? false : "Set HONORED_LIVES_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.HONORED_LIVES_TEST_PGLITE);
  const db = new PGlite();
  const bootstrap = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations) await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    await db.exec(fs.readFileSync(path.join(root, "db", "migrations", "020_honored_lives.sql"), "utf8"));
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    const schema = `SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_name = 'honored_lives' ORDER BY ordinal_position`;
    assert.deepEqual((await db.query(schema)).rows, (await bootstrap.query(schema)).rows);
    for (const id of ["owner", "admin", "member", "outsider"]) {
      await db.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
        VALUES ($1, $2, 'hash', $1, 'Person', $1, 'full-name', 'free', '2026-01-01', '2026-01-01')`, [id, `${id}@example.test`]);
    }
    await db.exec(`
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('tree', 'owner', 'Family', '2026-01-01', '2026-01-01'),
             ('other-tree', 'outsider', 'Other', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      VALUES ('tree', 'owner', 'owner', '2026-01-01'), ('tree', 'admin', 'admin', '2026-01-01'),
             ('tree', 'member', 'member', '2026-01-01'), ('other-tree', 'outsider', 'owner', '2026-01-01');
      INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, birth_year, death_year, birth_date, memorial_date, created_at, updated_at)
      VALUES ('existing', 'tree', 'owner', 'Existing Relative', 'Grandparent', 1940, 2020, '1940-05-04', '2020-06-08', '2026-01-01', '2026-01-01'),
             ('other', 'other-tree', 'outsider', 'Other Relative', 'Parent', NULL, NULL, NULL, NULL, '2026-01-01', '2026-01-01');
    `);
    const sql = (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return db.query(text, values).then((result) => result.rows);
    };
    sql.transaction = (queries) => Promise.all(queries);
    let user = { id: "owner" };
    const dependencies = {
      "node:crypto": crypto,
      "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": { getCurrentUser: async () => user },
      "@/lib/db": { getSql: () => sql },
      "@/lib/family-calendar": loadModule("lib/family-calendar.ts", {}),
      "@/lib/profile-photo": loadModule("lib/profile-photo.ts", { "server-only": {} }),
    };
    const actions = loadModule("app/actions/honored-lives.ts", dependencies);
    const existing = {
      treeId: "tree", placeholderId: "existing", name: "Existing Relative",
      relationship: "Grandparent", birthDate: "1940-05-04", passingDate: "2020-03-04",
      story: "A private family story.", photoData: "data:image/png;base64,iVBORw0KGgo=",
    };
    user = { id: "member" };
    assert.ok((await actions.createHonoredLife({}, form(existing))).error);
    assert.ok((await actions.createHonoredLife({}, form({ ...existing, placeholderId: "" }))).error);
    user = { id: "outsider" };
    assert.ok((await actions.createHonoredLife({}, form(existing))).error);
    user = { id: "owner" };
    assert.ok((await actions.createHonoredLife({}, form({ ...existing, placeholderId: "other" }))).error);
    assert.ok((await actions.createHonoredLife({}, form({ ...existing, birthDate: "1941-05-04" }))).error);
    assert.ok((await actions.createHonoredLife({}, form({ ...existing, passingDate: "1930-01-01" }))).error);
    assert.ok((await actions.createHonoredLife({}, form({ ...existing, photoData: "data:text/html;base64,AAAA" }))).error);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM honored_lives")).rows[0].count, 0);

    user = { id: "admin" };
    const created = await actions.createHonoredLife({}, form(existing));
    assert.match(created.success, /added/);
    assert.equal(created.treeId, "tree");
    const duplicate = await actions.createHonoredLife({}, form({ ...existing, name: "Must not overwrite" }));
    assert.match(duplicate.error, /already has an Honored Life/);
    assert.equal((await db.query("SELECT name FROM family_placeholders WHERE id = 'existing'")).rows[0].name, "Existing Relative");
    user = { id: "owner" };
    assert.ok((await actions.createHonoredLife({}, form({
      treeId: "tree", name: "Dates Unknown", relationship: "Family",
    }))).success);
    assert.ok((await actions.createHonoredLife({}, form({
      treeId: "tree", name: "New Relative", relationship: "Aunt",
      birthDate: "1950-01-01", passingDate: "2021-02-01", story: "A new story.",
    }))).success);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM honored_lives")).rows[0].count, 3);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM family_placeholders WHERE legacy_tree_id = 'tree'")).rows[0].count, 3);

    const family = loadModule("app/legacy-tree/family-members.tsx", {
      "react/jsx-runtime": jsxRuntime,
      react: React,
      "next/link": { default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children) },
      "next/image": { default: ({ alt }) => React.createElement("span", { "aria-label": alt }) },
      "@/app/actions/family-tree": { createLegacyTree: async () => {} },
      "@/lib/auth": dependencies["@/lib/auth"],
      "@/lib/db": dependencies["@/lib/db"],
      "@/lib/tree-positioning": loadModule("lib/tree-positioning.ts", {}),
      "./family-member-form": { default: () => null },
      "./family-date-link": { default: () => null },
      "./tree-milestones-panel": { default: () => null },
    }).default;
    async function renderTree() {
      let element = await family();
      if (element.type.name === "FamilyMembersForUser") element = await element.type(element.props);
      return renderToStaticMarkup(element);
    }
    user = { id: "member" };
    const html = await renderTree();
    assert.match(html, /A private family story\./);
    assert.match(html, /Born: 1940-05-04/);
    assert.match(html, /Passed: 2020-03-04/);
    assert.equal((html.match(/Existing Relative/g) ?? []).length, 1);
    assert.equal((html.match(/Honored Life™/g) ?? []).length, 3);
    user = { id: "outsider" };
    assert.doesNotMatch(await renderTree(), /A private family story|Existing Relative/);
    user = null;
    assert.doesNotMatch(await renderTree(), /A private family story|Existing Relative/);
    assert.ok((await actions.createHonoredLife({}, form(existing))).error);

    user = { id: "owner" };
    assert.ok((await actions.createHonoredLife({}, form({
      treeId: "tree", name: "Same Year", relationship: "Family",
      birthDate: "2000-01-01", passingDate: "2000-06-01",
    }))).success);
    const [{ id: sameYearId }] = (await db.query("SELECT id FROM family_placeholders WHERE name = 'Same Year'")).rows;
    const calendar = loadModule("app/actions/family-calendar.ts", {
      "node:crypto": crypto,
      "next/cache": dependencies["next/cache"],
      "@/lib/auth": { requireUser: async () => user },
      "@/lib/db": dependencies["@/lib/db"],
      "@/lib/family-calendar": dependencies["@/lib/family-calendar"],
    });
    const invalidUpdate = await calendar.saveTreeSourceDate({}, form({
      treeId: "tree", sourceId: sameYearId, sourceType: "placeholder",
      firstDate: "2000-12-01", secondDate: "",
    }));
    assert.ok(invalidUpdate.error);
    assert.equal((await db.query("SELECT birth_date::text AS date FROM family_placeholders WHERE id = $1", [sameYearId])).rows[0].date, "2000-01-01");
  } finally {
    await db.close();
    await bootstrap.close();
  }
});
