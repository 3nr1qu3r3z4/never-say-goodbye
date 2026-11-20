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
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const options = loadModule("lib/email-preferences.ts");
const names = options.emailPreferenceOptions.map(({ name }) => name);

function makeForm(checked) {
  const data = new FormData();
  for (const name of checked) data.append(name, "on");
  return data;
}

function loadAction(requireUser, sql, redirect = () => {}) {
  return loadModule("app/actions/email-preferences.ts", {
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect },
    "@/lib/auth": { requireUser },
    "@/lib/db": { getSql: () => sql },
    "@/lib/email-preferences": options,
  }).saveEmailPreferences;
}

function loadPage(requireUser, sql) {
  return loadModule("app/email-preferences/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "@/app/actions/email-preferences": { saveEmailPreferences: async () => {} },
    "@/lib/auth": { requireUser },
    "@/lib/db": { getSql: () => sql },
    "@/lib/email-preferences": options,
  }).default;
}

test("preferences page displays account email and defaults all options to checked", async () => {
  const page = loadPage(
    async () => ({ id: "alice", email: "alice@example.test" }),
    async (_strings, userId) => { assert.equal(userId, "alice"); return []; },
  );
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Email notifications are not enabled yet/);
  assert.match(html, /readOnly=""[^>]*value="alice@example.test"/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 7);
  assert.equal((html.match(/checked=""/g) ?? []).length, 7);
  for (const { label } of options.emailPreferenceOptions) assert.ok(html.includes(label));
});

test("saving uses the authenticated user and preserves selected and unselected options", async () => {
  let written;
  let redirectPath;
  const action = loadAction(
    async () => ({ id: "alice" }),
    async (strings, ...values) => { written = { query: strings.join("?"), values }; },
    (url) => { redirectPath = url; },
  );
  const form = makeForm([names[0], names[2], names[6]]);
  form.set("userId", "bob");
  form.set("email", "other@example.test");
  await action(form);
  assert.match(written.query, /ON CONFLICT \(user_id\) DO UPDATE/);
  assert.deepEqual(written.values, ["alice", true, false, true, false, false, false, true]);
  assert.equal(redirectPath, "/email-preferences?saved=1");

  const saved = Object.fromEntries(names.map((name, i) => [name, written.values[i + 1]]));
  const page = loadPage(async () => ({ id: "alice", email: "alice@example.test" }), async () => [saved]);
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ saved: "1" }) }));
  assert.equal((html.match(/checked=""/g) ?? []).length, 3);
  for (const [i, name] of names.entries()) {
    const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
    assert.ok(input);
    assert.equal(input.includes('checked=""'), written.values[i + 1], name);
  }
  assert.match(html, /Email preferences saved successfully/);
});

test("unauthenticated or malformed submissions cannot write preferences", async () => {
  let writes = 0;
  const sql = async () => { writes++; };
  const unauthorized = loadAction(async () => { throw new Error("not signed in"); }, sql);
  await assert.rejects(unauthorized(makeForm(names)), /not signed in/);
  const action = loadAction(async () => ({ id: "alice" }), sql);
  const invalid = makeForm([]);
  invalid.set(names[0], "invalid");
  await assert.rejects(action(invalid), /Invalid email preferences/);
  const duplicate = makeForm([names[0], names[0]]);
  await assert.rejects(action(duplicate), /Invalid email preferences/);
  assert.equal(writes, 0);
});

test("database failures are not reported as successful saves", async () => {
  const action = loadAction(async () => ({ id: "alice" }), async () => { throw new Error("database unavailable"); });
  await assert.rejects(action(makeForm(names)), /database unavailable/);
});

test("migration and preference round trip in disposable PostgreSQL", {
  skip: process.env.EMAIL_PREFERENCES_TEST_PGLITE ? false : "Set EMAIL_PREFERENCES_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.EMAIL_PREFERENCES_TEST_PGLITE);
  const db = new PGlite();
  const bootstrap = new PGlite();
  try {
    await db.exec("CREATE TABLE schema_migrations (version TEXT PRIMARY KEY); CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('alice'), ('bob');");
    const migration = fs.readFileSync(path.join(root, "db", "migrations", "018_email_preferences.sql"), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    const schemaQuery = `SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'email_preferences' ORDER BY column_name`;
    assert.deepEqual((await db.query(schemaQuery)).rows, (await bootstrap.query(schemaQuery)).rows);
    await db.exec("INSERT INTO email_preferences (user_id) VALUES ('bob')");
    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    const action = loadAction(async () => ({ id: "alice" }), sql);
    await action(makeForm([names[1], names[4]]));
    const page = loadPage(async () => ({ id: "alice", email: "alice@example.test" }), sql);
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    assert.equal((html.match(/checked=""/g) ?? []).length, 2);
    assert.match(html, /name="connectionRequestAccepted"[^>]*checked=""/);
    assert.match(html, /name="newAudioMessageShared"[^>]*checked=""/);
    await action(makeForm([]));
    assert.equal((renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) })).match(/checked=""/g) ?? []).length, 0);
    const bob = (await db.query("SELECT * FROM email_preferences WHERE user_id = 'bob'")).rows[0];
    assert.ok(Object.entries(bob).filter(([key]) => key !== "user_id").every(([, value]) => value === true));
    await db.exec("DELETE FROM users WHERE id = 'alice'");
    assert.equal((await db.query("SELECT * FROM email_preferences WHERE user_id = 'alice'")).rows.length, 0);
  } finally {
    await db.close();
    await bootstrap.close();
  }
});
