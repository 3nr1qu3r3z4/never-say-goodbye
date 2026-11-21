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

function loadModule(relativePath, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Response, console, ...globals,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("founder authorization fails closed and guards data access", async () => {
  const env = {};
  let user = { id: "ordinary" };
  const admin = loadModule("lib/admin.ts", {
    "server-only": {},
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "@/lib/auth": { requireUser: async () => user },
  }, { process: { env } });
  assert.equal(admin.isFounder(user), false);
  env.FOUNDER_USER_IDS = " founder-id, another-id ";
  assert.equal(admin.isFounder(user), false);
  await assert.rejects(admin.requireFounder(), /not found/);
  user = { id: "founder-id" };
  assert.equal(admin.isFounder(user), true);
  assert.equal((await admin.requireFounder()).id, "founder-id");

  let queries = 0;
  const data = loadModule("lib/admin-dashboard-data.ts", {
    "server-only": {},
    "@/lib/admin": { requireFounder: async () => { throw new Error("not found"); } },
    "@/lib/db": { getSql: () => { queries++; } },
    "@/lib/site-analytics": { siteAnalyticsEnabled: () => true },
  });
  await assert.rejects(data.getAdminDashboardData(), /not found/);
  assert.equal(queries, 0);
});

test("dashboard labels conversion and unavailable analytics accurately", async () => {
  const counts = {
    users: 3, completedProfiles: 1, profilePhotos: 2, connectedLives: 1,
    pendingConnections: 1, acceptedConnections: 1, moments: 1, drafts: 0,
    futureMakers: 0, placeholders: 0, treeMembers: 3, membersWithMoments: 1,
    membersWithConnections: 1,
  };
  let analytics = null;
  const page = loadModule("app/admin-dashboard/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children) },
    "@/lib/admin-dashboard-data": { getAdminDashboardData: async () => ({ counts, signups: [], analytics }) },
  }).default;
  let html = renderToStaticMarkup(await page());
  assert.match(html, /Visitor tracking is not enabled/);
  assert.match(html, /Current Profile Photos/);
  assert.match(html, /Unavailable/);
  assert.match(html, /Visitors Today<\/dt><dd[^>]*>Unavailable/);
  assert.match(html, /First Moments Created<\/dt><dd[^>]*>1/);
  assert.match(html, /Connected Lives Established<\/dt><dd[^>]*>1/);
  analytics = { totals: { visits: 6, visits7: 6, visits30: 6, visitorsToday: 2, visitorsWeek: 3, visitorsMonth: 4, unique90: 4, signups90: 1 }, daily: [] };
  html = renderToStaticMarkup(await page());
  assert.match(html, /25\.0%/);
  assert.match(html, /not a cohort funnel/);
  assert.match(html, /Visitors Today<\/dt><dd[^>]*>2/);
  assert.match(html, /Visitors This Week<\/dt><dd[^>]*>3/);
  assert.match(html, /Visitors This Month<\/dt><dd[^>]*>4/);
  analytics.totals.unique90 = 0;
  html = renderToStaticMarkup(await page());
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("beta visits, attribution, aggregate metrics and retention in PostgreSQL", {
  skip: process.env.ADMIN_TEST_PGLITE ? false : "Set ADMIN_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.ADMIN_TEST_PGLITE);
  const db = new PGlite();
  const bootstrap = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of migrations) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    await db.exec(fs.readFileSync(path.join(root, "db", "migrations", "019_site_analytics.sql"), "utf8"));
    await bootstrap.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    for (const table of ["site_analytics_visitors", "site_analytics_visitor_days", "site_analytics_daily"]) {
      const query = `SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`;
      assert.deepEqual((await db.query(query, [table])).rows, (await bootstrap.query(query, [table])).rows);
    }

    let fixedNow;
    const sql = (strings, ...values) => {
      let text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      if (fixedNow && text.includes("CURRENT_TIMESTAMP")) {
        text = text.replaceAll("CURRENT_TIMESTAMP", `$${values.length + 1}::timestamptz`);
        values.push(fixedNow);
      }
      return db.query(text, values).then((result) => result.rows);
    };
    sql.transaction = (queries) => Promise.all(queries);
    const env = { SITE_ANALYTICS_ENABLED: "true", CRON_SECRET: "secret", NODE_ENV: "production" };
    const jar = new Map();
    const cookieStore = {
      get: (name) => jar.has(name) ? { value: jar.get(name) } : undefined,
      set: (name, value, options) => {
        assert.equal(options.httpOnly, true);
        assert.equal(options.secure, true);
        jar.set(name, value);
      },
    };
    const dependencies = {
      "server-only": {},
      "next/headers": { cookies: async () => cookieStore },
      "@/lib/db": { getSql: () => sql },
    };
    const analytics = loadModule("lib/site-analytics.ts", dependencies, { process: { env } });
    const route = loadModule("app/api/site-visit/route.ts", {
      "node:crypto": crypto, "next/headers": dependencies["next/headers"],
      "@/lib/db": dependencies["@/lib/db"], "@/lib/site-analytics": analytics,
    }, { process: { env } });
    const request = () => new Request("https://example.test/api/site-visit", {
      method: "POST", headers: { "X-NSG-Analytics": "1", "sec-fetch-site": "same-origin" },
    });
    assert.equal((await route.POST(new Request("https://example.test/api/site-visit", { method: "POST" }))).status, 403);
    assert.equal((await route.POST(request())).status, 204);
    assert.equal((await route.POST(request())).status, 204);
    assert.equal((await db.query("SELECT visits::int AS visits FROM site_analytics_daily")).rows[0].visits, 1);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM site_analytics_visitor_days")).rows[0].count, 1);
    await analytics.attributeSignup();
    jar.delete(analytics.visitCookieName);
    assert.equal((await route.POST(request())).status, 204);
    assert.equal((await db.query("SELECT visits::int AS visits FROM site_analytics_daily")).rows[0].visits, 2);

    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at, bio, profile_photo_data)
      VALUES ('one', 'one@example.test', 'hash', 'One', 'User', 'One', 'full-name', 'free', '2026-01-01', '2026-01-01', 'Biography', 'photo'),
             ('two', 'two@example.test', 'hash', 'Two', 'User', 'Two', 'full-name', 'free', '2026-02-01', '2026-02-01', '  ', 'photo');
      INSERT INTO moments (id, user_id, kind, title, created_at, updated_at)
      VALUES ('moment', 'one', 'shared', 'Story', '2026-01-01', '2026-01-01');
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('connection', 'one', 'two', 'Two', 'Family', 'pending', '2026-01-01', '2026-01-01');
    `);
    const data = loadModule("lib/admin-dashboard-data.ts", {
      "server-only": {}, "@/lib/admin": { requireFounder: async () => ({ id: "one" }) },
      "@/lib/db": dependencies["@/lib/db"], "@/lib/site-analytics": analytics,
    });
    const result = await data.getAdminDashboardData();
    assert.equal(result.counts.users, 2);
    assert.equal(result.counts.completedProfiles, 1);
    assert.equal(result.counts.profilePhotos, 2);
    assert.equal(result.counts.membersWithMoments, 1);
    assert.equal(result.counts.membersWithConnections, 1);
    assert.equal(result.counts.connectedLives, 0);
    assert.equal(result.counts.pendingConnections, 1);
    assert.equal(result.signups[0].email, "two@example.test");
    assert.equal(result.signups[0].complete, false);
    assert.equal(result.analytics.totals.visits, 2);
    assert.equal(result.analytics.totals.unique90, 1);
    assert.equal(result.analytics.totals.signups90, 1);
    assert.equal(result.analytics.totals.visitorsToday, 1);
    assert.equal(result.analytics.totals.visitorsWeek, 1);
    assert.equal(result.analytics.totals.visitorsMonth, 1);

    const [{ today }] = (await db.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date::text AS today")).rows;
    const shiftDate = (date, days) => {
      const value = new Date(`${date}T00:00:00Z`);
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(0, 10);
    };
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const weekStart = shiftDate(today, -((weekday + 6) % 7));
    const monthStart = `${today.slice(0, 7)}-01`;
    const beforeWeek = shiftDate(weekStart, -1);
    const beforeMonth = shiftDate(monthStart, -1);
    await db.exec(`
      INSERT INTO site_analytics_visitors (visitor_id)
      VALUES ('repeat'), ('prior-week'), ('prior-month'), ('future');
    `);
    for (const [visitor, date] of [
      ["repeat", today], ["repeat", shiftDate(today, -1)],
      ["prior-week", beforeWeek], ["prior-month", beforeMonth],
      ["future", shiftDate(today, 1)],
    ]) {
      await db.query("INSERT INTO site_analytics_visitor_days (visitor_id, visit_date) VALUES ($1, $2::date)", [visitor, date]);
    }
    const calendar = (await data.getAdminDashboardData()).analytics.totals;
    assert.equal(calendar.visitorsToday, 2);
    assert.equal(calendar.visitorsWeek, 2 + Number(beforeMonth >= weekStart));
    assert.equal(calendar.visitorsMonth, 2 + Number(beforeWeek >= monthStart));

    await db.exec(`
      INSERT INTO site_analytics_visitors (visitor_id, last_seen_at, signup_at)
      VALUES ('old', CURRENT_TIMESTAMP - INTERVAL '91 days', CURRENT_TIMESTAMP - INTERVAL '91 days'),
             ('active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '91 days');
      INSERT INTO site_analytics_visitor_days (visitor_id, visit_date)
      VALUES ('old', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 90);
    `);
    const cron = loadModule("app/api/cron/site-analytics/route.ts", {
      "next/server": { connection: async () => {} },
      "@/lib/db": dependencies["@/lib/db"],
    }, { process: { env } });
    assert.equal((await cron.GET(new Request("https://example.test/"))).status, 401);
    assert.equal((await cron.GET(new Request("https://example.test/", { headers: { authorization: "Bearer secret" } }))).status, 204);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM site_analytics_visitors WHERE visitor_id = 'old'")).rows[0].count, 0);
    assert.equal((await db.query("SELECT signup_at FROM site_analytics_visitors WHERE visitor_id = 'active'")).rows[0].signup_at, null);
    assert.equal((await db.query("SELECT visits::int AS visits FROM site_analytics_daily")).rows[0].visits, 2);

    await db.exec(`
      DELETE FROM site_analytics_visitor_days;
      INSERT INTO site_analytics_visitors (visitor_id)
      VALUES ('cal-a'), ('cal-b'), ('cal-c'), ('cal-d'), ('cal-e'), ('cal-f');
      INSERT INTO site_analytics_visitor_days (visitor_id, visit_date)
      VALUES ('cal-a', '2027-03-01'), ('cal-a', '2027-02-28'),
             ('cal-b', '2027-02-28'), ('cal-c', '2027-02-22'),
             ('cal-d', '2027-02-01'), ('cal-e', '2027-01-31'),
             ('cal-f', '2027-03-02');
    `);
    fixedNow = "2027-02-28T12:00:00Z";
    let boundaryTotals = (await data.getAdminDashboardData()).analytics.totals;
    assert.equal(boundaryTotals.visitorsToday, 2);
    assert.equal(boundaryTotals.visitorsWeek, 3);
    assert.equal(boundaryTotals.visitorsMonth, 4);
    fixedNow = "2027-03-01T12:00:00Z";
    boundaryTotals = (await data.getAdminDashboardData()).analytics.totals;
    assert.equal(boundaryTotals.visitorsToday, 1);
    assert.equal(boundaryTotals.visitorsWeek, 1);
    assert.equal(boundaryTotals.visitorsMonth, 1);
    fixedNow = undefined;

    env.SITE_ANALYTICS_ENABLED = "false";
    assert.equal((await data.getAdminDashboardData()).analytics, null);
    env.SITE_ANALYTICS_ENABLED = "true";
    env.CRON_SECRET = "";
    assert.throws(() => analytics.siteAnalyticsEnabled(), /requires CRON_SECRET/);
  } finally {
    await db.close();
    await bootstrap.close();
  }
});
