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
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, process, Response,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("delete confirmation explains the permanent removal", () => {
  const Button = loadModule("app/my-profile/membership/content/delete-moment-button.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: React,
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/app/actions/content-delete": { deleteManagedMoment() {} },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Button, { id: "m", name: "Family day" }));
  for (const text of ["Delete Moment?", "This action permanently deletes the entire Moment and all associated content.",
    "Story", "Photos", "Audio", "Video", "Cannot Open Until™ content", "Future Moment Maker™ content",
    "This action cannot be undone.", "Cancel", "Delete Permanently"]) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /aria-label="Delete Family day"/);
});

test("owner deletion removes active, archived and released Moments and retries failed media cleanup", {
  skip: process.env.CONTENT_ARCHIVE_TEST_PGLITE ? false : "Set CONTENT_ARCHIVE_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.CONTENT_ARCHIVE_TEST_PGLITE);
  const db = new PGlite();
  const oldSecret = process.env.CRON_SECRET;
  try {
    await db.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('other', 'other@example.test', 'hash', 'Other', 'Test', 'Other', 'full-name', 'free', '2026-01-01', '2026-01-01');
      INSERT INTO moments (id, user_id, kind, title, story, details_json, audience, archived_at, created_at, updated_at)
      VALUES ('active', 'owner', 'shared', 'Active', 'Story', '{"photoData":"data:image/jpeg;base64,abc"}', 'private', NULL, '2026-01-01', '2026-01-01'),
             ('archived', 'owner', 'future-moment-maker', 'Archived', 'Story', '{}', 'private', now(), '2026-01-01', '2026-01-01'),
             ('released', 'owner', 'cannot-open-until', 'Released', 'Story', '{}', 'private', NULL, '2026-01-01', '2026-01-01'),
             ('failure', 'owner', 'shared', 'Failure', '', '{}', 'private', NULL, '2026-01-01', '2026-01-01');
      INSERT INTO moment_videos (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('video', 'owner', 'active', 'video-path', 'video.mp4', 'video/mp4', 1, 'attached'),
             ('archived-video', 'owner', 'archived', 'archived-video-path', 'video.mp4', 'video/mp4', 1, 'attached'),
             ('released-video', 'owner', 'released', 'released-video-path', 'video.mp4', 'video/mp4', 1, 'attached'),
             ('failed-video', 'owner', 'failure', 'failed-video-path', 'video.mp4', 'video/mp4', 1, 'attached');
      INSERT INTO moment_audio (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('audio', 'owner', 'active', 'audio-path', 'audio.mp3', 'audio/mpeg', 1, 'attached'),
             ('released-audio', 'owner', 'released', 'released-audio-path', 'audio.mp3', 'audio/mpeg', 1, 'attached');
    `);
    await db.exec(`
      INSERT INTO cannot_open_until_settings (moment_id, status, release_date, release_timezone, unlock_at, reviewed_at)
      VALUES ('released', 'active', '2020-01-01', 'UTC', '2020-01-01', now());
    `);
    const sql = (strings, ...values) => {
      const query = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return { query, values, then: (resolve, reject) => db.query(query, values).then((result) => result.rows).then(resolve, reject) };
    };
    sql.transaction = (statements) => db.transaction(async (tx) => {
      const results = [];
      for (const statement of statements) results.push((await tx.query(statement.query, statement.values)).rows);
      return results;
    });
    let viewer = null;
    const removed = [];
    const revalidated = [];
    const actions = loadModule("app/actions/content-delete.ts", {
      "@vercel/blob": { del: async (pathname) => {
        if (pathname === "failed-video-path") throw new Error("Blob unavailable");
        removed.push(pathname);
      } },
      "next/cache": { revalidatePath: (path) => revalidated.push(path) },
      "@/lib/auth": { getCurrentUser: async () => viewer ? { id: viewer } : null },
      "@/lib/db": { getSql: () => sql },
    });
    const entitlements = loadModule("lib/entitlements.ts", {
      "server-only": {}, "@/lib/db": { getSql: () => sql },
      "@/lib/site-themes": loadModule("lib/site-themes.ts", {}),
    });

    assert.ok((await actions.deleteManagedMoment("active")).error);
    viewer = "other";
    assert.ok((await actions.deleteManagedMoment("active")).error);
    assert.deepEqual(removed, []);
    viewer = "owner";
    const before = await entitlements.getUsageCounts("owner");
    assert.equal(before.photos, 1);
    assert.equal(before.audioMoments, 2);
    assert.ok((await actions.deleteManagedMoment("active")).success);
    const after = await entitlements.getUsageCounts("owner");
    assert.equal(after.photos, 0);
    assert.equal(after.audioMoments, 1);
    assert.equal(after.stories, before.stories - 1);
    assert.ok(revalidated.includes("/my-profile/membership"));
    assert.ok((await actions.deleteManagedMoment("archived")).success);
    await assert.rejects(db.exec("UPDATE moments SET story = 'Changed' WHERE id = 'released'"), /read-only/);
    assert.ok((await actions.deleteManagedMoment("released")).success);
    assert.deepEqual(removed.sort(), ["archived-video-path", "audio-path", "released-audio-path", "released-video-path", "video-path"]);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM cannot_open_until_settings WHERE moment_id = 'released'")).rows[0].n, 0);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moment_videos WHERE id IN ('video', 'released-video')")).rows[0].n, 0);
    assert.ok((await actions.deleteManagedMoment("active")).error);
    const result = await actions.deleteManagedMoment("failure");
    assert.equal(result.cleanupPending, true);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moments WHERE id = 'failure'")).rows[0].n, 0);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moment_videos WHERE id = 'failed-video' AND moment_id IS NULL AND state = 'attached'")).rows[0].n, 1);
    process.env.CRON_SECRET = "test-secret";
    const route = loadModule("app/api/cron/moment-videos/route.ts", {
      "@vercel/blob": { del: async (pathname) => removed.push(pathname) },
      "next/server": { connection: async () => {} }, "@/lib/db": { getSql: () => sql },
    });
    const response = await route.GET({ headers: { get: () => "Bearer test-secret" } });
    assert.equal(response.status, 204);
    assert.ok(removed.includes("failed-video-path"));
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moment_videos WHERE id = 'failed-video'")).rows[0].n, 0);

    await db.exec(`
      INSERT INTO moments (id, user_id, kind, title, created_at, updated_at)
      VALUES ('rollback', 'owner', 'shared', 'Rollback', '2026-01-01', '2026-01-01');
      INSERT INTO moment_audio (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('rollback-audio', 'owner', 'rollback', 'rollback-path', 'audio.mp3', 'audio/mpeg', 1, 'attached');
      CREATE FUNCTION reject_test_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Test deletion failure'; END; $$;
      CREATE TRIGGER reject_test_delete BEFORE DELETE ON moments
      FOR EACH ROW WHEN (OLD.id = 'rollback') EXECUTE FUNCTION reject_test_delete();
    `);
    await assert.rejects(actions.deleteManagedMoment("rollback"), /Test deletion failure/);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moment_audio WHERE moment_id = 'rollback'")).rows[0].n, 1);
    assert.ok(!removed.includes("rollback-path"));
  } finally {
    if (oldSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldSecret;
    await db.close();
  }
});
