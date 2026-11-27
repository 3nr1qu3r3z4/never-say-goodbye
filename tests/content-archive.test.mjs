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

function loadModule(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    process, Response, console,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function form(id, kind, operation) {
  const data = new FormData();
  data.set("id", id);
  data.set("kind", kind);
  data.set("operation", operation);
  return data;
}

test("owner management page identifies counted contents and explains legacy recovery", async () => {
  let user = { id: "owner" };
  const calls = [];
  const page = loadModule("app/my-profile/membership/content/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "@/lib/auth": { requireUser: async () => {
      if (!user) throw new Error("Sign in required");
      return user;
    } },
    "@/lib/cannot-open-until": { cannotOpenUntilEnabled: () => false },
    "@/lib/moment-card-style": loadModule("lib/moment-card-style.ts", {}),
    "@/lib/db": { getSql: () => async (strings, ...values) => {
      calls.push(values);
      return strings.join("").includes("FROM moments")
        ? [{ id: "moment", title: "Family day", kind: "shared", audience: "public", archived: false, hasStory: true, hasPhoto: true, hasAudio: true, hasVideo: true },
           { id: "archived", title: "Old Moment", kind: "personal", audience: "private", archived: true },
           { id: "future", title: "Future Moment", kind: "future-moment-maker", audience: "public", archived: false },
           { id: "capsule", title: "Scheduled Moment", kind: "cannot-open-until", audience: "public", archived: false },
           { id: "code", title: "Code Moment", kind: "personal", audience: "public", hasAccessCode: true, archived: false }]
        : [{ id: "old", name: "Older record", archived: true, legacyArchived: true }];
    } },
    "./archive-button": { default: ({ name, archived }) => React.createElement("button", null, `${archived ? "Restore" : "Archive"} ${name}`) },
    "./delete-moment-button": { default: ({ name }) => React.createElement("button", null, `Delete ${name}`) },
  }).default;
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Story · Photo · Video · Audio/);
  assert.match(html, /Archive Family day/);
  assert.match(html, /Delete Family day/);
  assert.match(html, /Restore Old Moment.*Delete Old Moment/);
  assert.match(html, /border-\[color:var\(--nsg-border\)\]\/10[^"]*"[^>]*><div><p[^>]*>Family day/);
  assert.match(html, /border-\[#d8a35b\]\/50[^"]*"[^>]*><div><p[^>]*>Old Moment/);
  for (const title of ["Future Moment", "Scheduled Moment", "Code Moment"]) {
    assert.match(html, new RegExp(`border-\\[#d8a35b\\]/50[^"]*"[^>]*><div><p[^>]*>${title}`));
  }
  assert.match(html, /Restore Older record/);
  assert.match(html, /original status is unavailable.*Awaiting Claim/);
  assert.match(html, /Related Moments remain active/);
  assert.deepEqual(calls, [["owner"], ["owner"]]);
  user = null;
  await assert.rejects(page(), /Sign in required/);
  assert.equal(calls.length, 2);
});

test("archive actions, visibility, usage and recovery preserve owned content", {
  skip: process.env.CONTENT_ARCHIVE_TEST_PGLITE ? false : "Set CONTENT_ARCHIVE_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.CONTENT_ARCHIVE_TEST_PGLITE);
  const db = new PGlite();
  const migrated = new PGlite();
  try {
    await db.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    for (const file of fs.readdirSync(path.join(root, "db", "migrations")).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
      await migrated.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    await migrated.exec(fs.readFileSync(path.join(root, "db", "migrations", "028_content_archives.sql"), "utf8"));
    const columnQuery = `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name IN ('moments', 'future_moment_makers') AND column_name = 'archived_at' ORDER BY table_name`;
    assert.deepEqual((await db.query(columnQuery)).rows, (await migrated.query(columnQuery)).rows);
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('other', 'other@example.test', 'hash', 'Other', 'Test', 'Other', 'full-name', 'free', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('tree', 'owner', 'Family', '2026-01-01', '2026-01-01');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      VALUES ('tree', 'owner', 'owner', '2026-01-01'), ('tree', 'other', 'member', '2026-01-01');
      INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, status, expected_birth_date, created_at, updated_at)
      VALUES ('maker', 'owner', 'tree', 'Future', 'Child', 'claimed', '2027-01-01', '2026-01-01', '2026-01-01'),
             ('dated', 'owner', 'tree', 'Dated', 'Child', 'awaiting-claim', '2027-01-01', '2026-01-01', '2026-01-01'),
             ('old', 'owner', 'tree', 'Old', 'Child', 'archived', NULL, '2026-01-01', '2026-01-01');
      INSERT INTO family_tree_milestones (id, tree_id, future_id, kind, title, year, month, day, repeats_yearly)
      VALUES ('milestone', 'tree', 'maker', 'custom', 'Future day', 2027, 1, 1, FALSE);
      INSERT INTO moments (id, user_id, kind, title, story, details_json, audience, created_at, updated_at)
      VALUES ('shared', 'owner', 'shared', 'Shared', 'Story', '{"photoData":"data:image/jpeg;base64,abc"}', 'family', '2026-01-01', '2026-01-01'),
             ('locked1', 'owner', 'cannot-open-until', 'Locked 1', '', '{}', 'private', '2026-01-01', '2026-01-01'),
             ('locked2', 'owner', 'cannot-open-until', 'Locked 2', '', '{}', 'private', '2026-01-01', '2026-01-01'),
             ('locked3', 'owner', 'cannot-open-until', 'Locked 3', '', '{}', 'private', '2026-01-01', '2026-01-01');
      INSERT INTO moment_videos (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('video', 'owner', 'shared', 'video', 'video.mp4', 'video/mp4', 1, 'attached');
      INSERT INTO moment_audio (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('audio', 'owner', 'shared', 'audio', 'audio.mp3', 'audio/mpeg', 1, 'attached');
    `);
    const sql = async (strings, ...values) => {
      const query = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(query, values)).rows;
    };
    const dbImport = { getSql: () => sql };
    let viewer = "owner";
    const actions = loadModule("app/actions/content-archive.ts", {
      "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": { getCurrentUser: async () => viewer ? { id: viewer } : null },
      "@/lib/db": dbImport,
    });
    const entitlements = loadModule("lib/entitlements.ts", {
      "server-only": {}, "@/lib/db": dbImport,
      "@/lib/site-themes": loadModule("lib/site-themes.ts", {}),
    });
    const access = loadModule("lib/moment-access.ts", { "server-only": {}, "@/lib/db": dbImport });
    const calendar = loadModule("lib/family-calendar-data.ts", { "server-only": {}, "@/lib/db": dbImport });
    const milestones = loadModule("lib/tree-milestones-data.ts", { "server-only": {}, "@/lib/db": dbImport });
    const milestoneActions = loadModule("app/actions/tree-milestones.ts", {
      "node:crypto": { randomUUID }, "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": { requireUser: async () => ({ id: viewer }) }, "@/lib/db": dbImport,
    });
    const momentActions = loadModule("app/actions/moments.ts", {
      "next/cache": { revalidatePath: () => {} },
      "@/lib/auth": { getCurrentUser: async () => viewer ? { id: viewer } : null },
      "@/lib/db": dbImport,
    });

    viewer = null;
    assert.ok((await actions.changeArchiveState({}, form("shared", "moment", "archive"))).error);
    viewer = "other";
    assert.ok((await actions.changeArchiveState({}, form("shared", "moment", "archive"))).error);
    assert.ok((await actions.changeArchiveState({}, form("maker", "future", "archive"))).error);
    viewer = "owner";
    assert.ok((await actions.changeArchiveState({}, form("shared", "invalid", "archive"))).error);
    assert.ok(await access.getAccessibleMoment("other", "shared"));
    assert.ok((await actions.changeArchiveState({}, form("shared", "moment", "archive"))).success);
    assert.equal(await access.getAccessibleMoment("other", "shared"), null);
    assert.equal(await access.getAccessibleMoment("owner", "shared"), null);
    assert.ok((await momentActions.deleteSharedMoment("shared")).error);
    let counts = await entitlements.getUsageCounts("owner");
    assert.equal(counts.photos, 0);
    assert.equal(counts.stories, 0);
    assert.equal(counts.audioMoments, 0);
    assert.equal(counts.nonPublicVideos, 0);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moment_videos WHERE moment_id = 'shared' AND state = 'attached'")).rows[0].n, 1);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moment_audio WHERE moment_id = 'shared' AND state = 'attached'")).rows[0].n, 1);
    const oldSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    try {
      for (const [file, dependency] of [
        ["app/api/cron/moment-videos/route.ts", "video"],
        ["app/api/cron/moment-audio/route.ts", "audio"],
      ]) {
        const route = loadModule(file, {
          "@vercel/blob": { del: async () => { throw new Error(`Attached ${dependency} must not be deleted`); } },
          "next/server": { connection: async () => {} }, "@/lib/db": dbImport,
        });
        const result = await route.GET({ headers: { get: () => "Bearer test-secret" } });
        assert.equal(result.status, 204);
      }
    } finally {
      if (oldSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = oldSecret;
    }
    viewer = "other";
    assert.ok((await actions.changeArchiveState({}, form("shared", "moment", "restore"))).error);
    viewer = "owner";
    assert.ok((await actions.changeArchiveState({}, form("shared", "moment", "restore"))).success);
    assert.ok(await access.getAccessibleMoment("other", "shared"));
    counts = await entitlements.getUsageCounts("owner");
    assert.equal(counts.photos, 1);
    assert.equal(counts.stories, 1);
    assert.equal(counts.audioMoments, 1);
    assert.equal(counts.nonPublicVideos, 1);

    assert.ok((await actions.changeArchiveState({}, form("locked3", "moment", "archive"))).success);
    assert.equal((await entitlements.getUsageCounts("owner")).cannotOpenUntil, 2);
    assert.ok((await actions.changeArchiveState({}, form("locked3", "moment", "restore"))).success);
    assert.equal((await entitlements.getUsageReport("owner")).cannotOpenUntil.current, 3);

    assert.equal((await milestones.getTreeMilestones("other", "tree")).length, 1);
    assert.ok((await calendar.getCalendarEvents("other", "tree")).some((event) => event.id === "future:dated"));
    assert.ok((await actions.changeArchiveState({}, form("maker", "future", "archive"))).success);
    assert.ok((await actions.changeArchiveState({}, form("dated", "future", "archive"))).success);
    assert.equal((await entitlements.getUsageCounts("owner")).futureMomentMakers, 0);
    assert.equal((await milestones.getTreeMilestones("other", "tree")).length, 0);
    assert.ok(!(await calendar.getCalendarEvents("other", "tree")).some((event) => event.id === "future:dated"));
    const deleteMilestone = new FormData();
    deleteMilestone.set("treeId", "tree");
    deleteMilestone.set("milestoneId", "milestone");
    assert.ok((await milestoneActions.deleteTreeMilestone({}, deleteMilestone)).error);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM family_tree_milestones WHERE future_id = 'maker'")).rows[0].n, 1);
    assert.ok((await actions.changeArchiveState({}, form("maker", "future", "restore"))).success);
    assert.ok((await actions.changeArchiveState({}, form("dated", "future", "restore"))).success);
    assert.equal((await db.query("SELECT status FROM future_moment_makers WHERE id = 'maker'")).rows[0].status, "claimed");
    assert.equal((await milestones.getTreeMilestones("other", "tree")).length, 1);
    assert.ok((await calendar.getCalendarEvents("other", "tree")).some((event) => event.id === "future:dated"));
    assert.ok((await actions.changeArchiveState({}, form("old", "future", "restore"))).success);
    assert.equal((await db.query("SELECT status FROM future_moment_makers WHERE id = 'old'")).rows[0].status, "awaiting-claim");
    assert.equal((await entitlements.getUsageCounts("owner")).futureMomentMakers, 3);
  } finally {
    await db.close();
    await migrated.close();
  }
});
