import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import * as crypto from "node:crypto";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
    Date,
    console,
  });
  return exports;
}

const themes = loadModule("lib/site-themes.ts");

function actionFixture(user = { id: "alice" }, exists = true) {
  const queries = [];
  const revalidated = [];
  const actions = loadModule("app/actions/appearance.ts", {
    "next/cache": { revalidatePath: (...args) => revalidated.push(args) },
    "@/lib/auth": { requireUser: async () => {
      if (!user) throw new Error("Not authenticated");
      return user;
    } },
    "@/lib/db": { getSql: () => async (strings, ...values) => {
      queries.push({ text: strings.join("?"), values });
      return exists ? [{ id: user.id }] : [];
    } },
    "@/lib/site-themes": themes,
  });
  return { actions, queries, revalidated };
}

function themeForm(value) {
  const data = new FormData();
  if (value !== null) data.set("theme", value);
  return data;
}

test("each curated theme can be saved for the signed-in user regardless of beta membership", async () => {
  for (const theme of themes.siteThemes) {
    const { actions, queries, revalidated } = actionFixture({ id: "alice", membership: "free" });
    const result = await actions.saveSiteTheme({}, themeForm(theme.id));
    assert.ok(result.success);
    assert.equal(queries.length, 1);
    assert.match(queries[0].text, /UPDATE users SET site_theme = \?/);
    assert.match(queries[0].text, /WHERE id = \?/);
    assert.equal(queries[0].values[0], theme.id);
    assert.equal(queries[0].values.at(-1), "alice");
    assert.deepEqual(revalidated, [["/", "layout"]]);
  }
});

test("invalid or unauthenticated theme changes cannot write and missing users report an error", async () => {
  for (const invalid of [null, "", "custom", "CLASSIC"]) {
    const { actions, queries } = actionFixture();
    assert.ok((await actions.saveSiteTheme({}, themeForm(invalid))).error);
    assert.equal(queries.length, 0);
  }
  const anonymous = actionFixture(null);
  await assert.rejects(anonymous.actions.saveSiteTheme({}, themeForm("classic")), /Not authenticated/);
  assert.equal(anonymous.queries.length, 0);
  const missing = actionFixture({ id: "alice" }, false);
  assert.ok((await missing.actions.saveSiteTheme({}, themeForm("classic"))).error);
  assert.equal(missing.revalidated.length, 0);
});

test("appearance presents accessible selections and explains beta and future plan access", () => {
  const Appearance = loadModule("app/my-profile/appearance.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: React,
    "@/app/actions/appearance": { saveSiteTheme: async () => ({}) },
    "@/lib/site-themes": themes,
  }).default;
  const html = renderToStaticMarkup(React.createElement(Appearance, { selectedTheme: "ocean" }));
  assert.match(html, /All themes are available during beta/);
  assert.match(html, /Available with Legacy Plus/);
  assert.match(html, /Available with Family Legacy/);
  assert.doesNotMatch(html, /future theme packs/i);
  for (const theme of themes.siteThemes) {
    assert.ok(html.includes(theme.name));
    assert.ok(!html.includes(theme.colors));
    assert.ok(!html.includes(theme.description));
  }
  assert.equal((html.match(/>Preview<\/span>/g) ?? []).length, themes.siteThemes.length);
  assert.match(html, /Currently selected/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, themes.siteThemes.length);
  assert.equal((html.match(/checked=""/g) ?? []).length, 1);
  const ocean = html.match(/<input[^>]*value="ocean"[^>]*>/)?.[0];
  assert.ok(ocean);
  assert.match(ocean, /checked=""/);
  assert.doesNotMatch(html, /disabled=""/);
});

test("theme sync uses the signed-in account and defaults guests to classic", async () => {
  for (const [user, expected] of [[null, "classic"], [{ siteTheme: "cottage" }, "cottage"]]) {
    const currentTheme = loadModule("app/current-theme.tsx", {
      "react/jsx-runtime": jsxRuntime,
      "@/lib/auth": { getCurrentUser: async () => user },
      "@/lib/site-themes": themes,
      "./theme-sync": { default: () => null },
    }).default;
    assert.equal((await currentTheme()).props.theme, expected);
  }
});

test("theme accent and button text colors retain WCAG AA contrast", () => {
  const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
  const luminance = (hex) => {
    const channels = hex.match(/[0-9a-f]{2}/gi).map((part) => {
      const channel = parseInt(part, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  for (const theme of themes.siteThemes) {
    const rule = css.match(new RegExp(`\\[data-theme="${theme.id}"\\]\\s*\\{([^}]+)\\}`));
    assert.ok(rule, theme.id);
    const read = (name) => rule[1].match(new RegExp(`--nsg-${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
    const background = read("background");
    for (const name of ["accent", "accent-light", "accent-hover"]) {
      assert.ok(contrast(background, read(name)) >= 4.5, `${theme.id}: ${name}`);
      assert.ok(contrast("#0f172a", read(name)) >= 4.5, `${theme.id}: ${name} on slate cards`);
    }
  }
});

test("theme migration preserves users, defaults to classic, and persists individual choices", {
  skip: process.env.THEME_TEST_PGLITE ? false : "Set THEME_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.THEME_TEST_PGLITE);
  const db = new PGlite();
  const bootstrap = new PGlite();
  try {
    await db.exec("CREATE TABLE schema_migrations (version TEXT PRIMARY KEY); CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('alice'), ('bob');");
    const migration = fs.readFileSync(path.join(root, "db", "migrations", "024_site_theme.sql"), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    await db.query("UPDATE users SET site_theme = $1 WHERE id = $2", ["ocean", "alice"]);
    assert.deepEqual((await db.query("SELECT id, site_theme FROM users ORDER BY id")).rows, [
      { id: "alice", site_theme: "ocean" },
      { id: "bob", site_theme: "classic" },
    ]);
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    const column = await bootstrap.query("SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'site_theme'");
    assert.equal(column.rows[0].is_nullable, "NO");
    assert.match(column.rows[0].column_default, /classic/);
  } finally {
    await db.close();
    await bootstrap.close();
  }
});

test("saved theme follows the account across sessions without leaking to another user or a guest", {
  skip: process.env.THEME_TEST_PGLITE ? false : "Set THEME_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.THEME_TEST_PGLITE);
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE schema_migrations (version TEXT PRIMARY KEY);
      CREATE TABLE users (
        id TEXT PRIMARY KEY, email TEXT, first_name TEXT, middle_name TEXT,
        last_name TEXT, display_name TEXT, membership TEXT, updated_at TEXT
      );
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT);
      INSERT INTO users (id, membership) VALUES ('alice', 'free'), ('bob', 'free');
    `);
    await db.exec(fs.readFileSync(path.join(root, "db", "migrations", "024_site_theme.sql"), "utf8"));
    for (const [token, user] of [["alice-device-1", "alice"], ["alice-device-2", "alice"], ["bob-device", "bob"]]) {
      await db.query("INSERT INTO sessions VALUES ($1, $2, $3)", [
        crypto.createHash("sha256").update(token).digest("hex"), user, "2999-01-01T00:00:00.000Z",
      ]);
    }
    const sql = async (strings, ...values) => {
      const query = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(query, values)).rows;
    };
    let token = "alice-device-1";
    const auth = loadModule("lib/auth.ts", {
      "server-only": {},
      "node:crypto": crypto,
      react: { cache: (fn) => fn },
      "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
      "next/navigation": { redirect: () => { throw new Error("Not authenticated"); } },
      "@/lib/db": { getSql: () => sql },
    });
    const action = loadModule("app/actions/appearance.ts", {
      "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": auth,
      "@/lib/db": { getSql: () => sql },
      "@/lib/site-themes": themes,
    });
    const currentTheme = loadModule("app/current-theme.tsx", {
      "react/jsx-runtime": jsxRuntime,
      "@/lib/auth": auth,
      "@/lib/site-themes": themes,
      "./theme-sync": { default: () => null },
    }).default;

    assert.ok((await action.saveSiteTheme({}, themeForm("lavender"))).success);
    token = "alice-device-2";
    assert.equal((await currentTheme()).props.theme, "lavender");
    token = "bob-device";
    assert.equal((await currentTheme()).props.theme, "classic");
    token = null;
    assert.equal((await currentTheme()).props.theme, "classic");
  } finally {
    await db.close();
  }
});
