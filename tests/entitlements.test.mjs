import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
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

function loadEntitlements(sql = () => { throw new Error("Unexpected database access"); }) {
  return loadModule("lib/entitlements.ts", {
    "server-only": {},
    "@/lib/db": { getSql: () => sql },
    "@/lib/site-themes": loadModule("lib/site-themes.ts"),
  });
}

test("approved limits, themes and planned features are resolved independently of beta access", () => {
  const service = loadEntitlements();
  for (const [plan, photos, stories, audio, makers, cannot] of [
    ["free", 25, 10, 5, 3, 2],
    ["legacy-plus", 500, 500, 50, 10, 25],
    ["family-legacy", 2500, 2500, 250, 25, 25],
    ["legacy-forever", 10000, 10000, 1000, null, 25],
  ]) {
    const policy = service.resolveEntitlements(plan, "grandfathered");
    assert.equal(policy.limits.photos, photos);
    assert.equal(policy.limits.stories, stories);
    assert.equal(policy.limits.audioMoments, audio);
    assert.equal(policy.limits.futureMomentMakers, makers);
    assert.equal(policy.limits.cannotOpenUntil, cannot);
    assert.equal(policy.enforcementEnabled, false);
    assert.equal(service.getThemeAccess(policy, "sunset").eligibleAfterBeta, true);
    assert.equal(service.getFeatureAccess(policy, "successorAssignment").eligible, plan === "legacy-forever");
    assert.equal(service.getFeatureAccess(policy, "successorAssignment").available, true);
    assert.equal(service.getFeatureAccess(policy, "scheduledDelivery").eligible, plan !== "free");
    assert.equal(service.getFeatureAccess(policy, "cannotOpenUntil").available, false);
  }
  const unreviewed = service.resolveEntitlements("free", "unreviewed");
  assert.equal(service.getThemeAccess(unreviewed, "sunset").availableNow, true);
  assert.equal(service.getThemeAccess(unreviewed, "sunset").eligibleAfterBeta, null);
  assert.equal(service.getThemeAccess(service.resolveEntitlements("legacy-plus", "not-grandfathered"), "sunset").eligibleAfterBeta, false);
  assert.equal(service.getThemeAccess(service.resolveEntitlements("family-legacy", "not-grandfathered"), "sunset").eligibleAfterBeta, true);
});

test("usage reports distinguish plan, grandfathered, and unreviewed limits without enforcement", () => {
  const service = loadEntitlements();
  const usage = {
    photos: 26, stories: 9, audioMoments: 5, futureMomentMakers: 3,
    cannotOpenUntil: 1, publicVideos: 3, nonPublicVideos: 2,
  };
  const free = service.createUsageReport(service.resolveEntitlements("free", "not-grandfathered"), usage);
  assert.equal(free.photos.planRemaining, 0);
  assert.equal(free.photos.wouldExceedOnAdd, true);
  assert.equal(free.stories.planRemaining, 1);
  assert.equal(free.videos.kind, "audience");
  assert.equal(free.videos.public.wouldExceedOnAdd, true);
  assert.equal(free.videos.nonPublic.wouldExceedOnAdd, true);
  assert.equal(free.enforcementEnabled, false);

  const beta = service.createUsageReport(service.resolveEntitlements("free", "grandfathered"), usage);
  assert.equal(beta.photos.planLimit, 25);
  assert.equal(beta.photos.effectiveLimit, null);
  assert.equal(beta.photos.wouldExceedOnAdd, false);
  const pending = service.createUsageReport(service.resolveEntitlements("free", "unreviewed"), usage);
  assert.equal(pending.photos.planRemaining, 0);
  assert.equal(pending.photos.effectiveLimit, "unreviewed");
  assert.equal(pending.photos.wouldExceedOnAdd, null);
  const forever = service.createUsageReport(service.resolveEntitlements("legacy-forever", "not-grandfathered"), usage);
  assert.equal(forever.futureMomentMakers.planLimit, null);
  assert.equal(forever.futureMomentMakers.wouldExceedOnAdd, false);
  assert.equal(forever.videos.total.current, 5);
  assert.equal(forever.videos.total.planRemaining, 995);
  for (const [plan, limit] of [["legacy-plus", 50], ["family-legacy", 250], ["legacy-forever", 1000]]) {
    const policy = service.resolveEntitlements(plan, "not-grandfathered");
    const before = service.createUsageReport(policy, { ...usage, publicVideos: limit - 1, nonPublicVideos: 0 });
    const at = service.createUsageReport(policy, { ...usage, publicVideos: limit, nonPublicVideos: 0 });
    assert.equal(before.videos.total.wouldExceedOnAdd, false);
    assert.equal(at.videos.total.wouldExceedOnAdd, true);
  }
});

test("unknown accounts error and legacy memberships remain explicitly unreviewed", async () => {
  let rows = [];
  const service = loadEntitlements(async () => rows);
  await assert.rejects(service.getEntitlements("missing"), /unknown account/);
  await assert.rejects(service.getUsageCounts("missing"), /unknown account/);
  rows = [{ membership: "tier-2", betaAccess: "grandfathered" }];
  const legacy = await service.getEntitlements("legacy");
  assert.equal(legacy.plan, null);
  assert.equal(legacy.legacyMembership, "tier-2");
  assert.equal(service.getThemeAccess(legacy, "sunset").eligibleAfterBeta, true);
  assert.equal(service.getFeatureAccess(legacy, "successorAssignment").eligible, null);
  const report = service.createUsageReport(legacy, {
    photos: 26, stories: 0, audioMoments: 0, futureMomentMakers: 0,
    cannotOpenUntil: 0, publicVideos: 1, nonPublicVideos: 2,
  });
  assert.equal(report.photos.planLimit, "unreviewed");
  assert.equal(report.photos.effectiveLimit, null);
  assert.equal(report.videos.kind, "unreviewed");
  assert.equal(report.videos.total, 3);
  rows = [{ membership: "unknown", betaAccess: null }];
  await assert.rejects(service.getEntitlements("legacy"), /Unknown stored membership/);
  rows = [{ membership: "free", betaAccess: null }];
  assert.equal((await service.getEntitlements("pending")).betaAccess, "unreviewed");
  for (const membership of ["legacy-plus", "family-legacy", "legacy-forever"]) {
    rows = [{ membership, betaAccess: null }];
    assert.equal((await service.getEntitlements("paid")).plan, membership);
  }
  assert.throws(() => service.resolveEntitlements("unknown", "unreviewed"), /Unknown membership plan/);
});

test("migration and usage query count owned published content and exclude drafts and orphans", {
  skip: process.env.ENTITLEMENTS_TEST_PGLITE ? false : "Set ENTITLEMENTS_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.ENTITLEMENTS_TEST_PGLITE);
  const db = new PGlite();
  const migrated = new PGlite();
  try {
    await db.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
    for (const file of fs.readdirSync(path.join(root, "db", "migrations")).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
      await migrated.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    await migrated.exec(fs.readFileSync(path.join(root, "db", "migrations", "027_beta_access_reviews.sql"), "utf8"));
    const columns = "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'beta_access_reviews' ORDER BY ordinal_position";
    assert.deepEqual((await db.query(columns)).rows, (await migrated.query(columns)).rows);
    assert.equal((await migrated.query("SELECT COUNT(*)::int AS count FROM beta_access_reviews")).rows[0].count, 0);

    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('other', 'other@example.test', 'hash', 'Other', 'Test', 'Other', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('legacy', 'legacy@example.test', 'hash', 'Legacy', 'Test', 'Legacy', 'full-name', 'tier-3', '2026-01-01', '2026-01-01');
      INSERT INTO beta_access_reviews (user_id, status)
      VALUES ('owner', 'grandfathered'), ('legacy', 'grandfathered');
      INSERT INTO future_moment_makers (id, owner_user_id, name, relationship, status, created_at, updated_at)
      VALUES ('f1', 'owner', 'A', 'Family', 'awaiting-claim', '2026-01-01', '2026-01-01'),
             ('f2', 'owner', 'B', 'Family', 'claimed', '2026-01-01', '2026-01-01'),
             ('f3', 'owner', 'C', 'Family', 'archived', '2026-01-01', '2026-01-01'),
             ('f4', 'other', 'D', 'Family', 'awaiting-claim', '2026-01-01', '2026-01-01');
      INSERT INTO moments (id, user_id, kind, title, story, details_json, audience, created_at, updated_at)
      VALUES ('public', 'owner', 'shared', 'Public', 'A story', '{"photoData":"data:image/jpeg;base64,abc"}', 'public', '2026-01-01', '2026-01-01'),
             ('family', 'owner', 'shared', 'Family', E' \\t\\n', '{"attachmentNames":{"photo":"old.jpg"}}', 'family', '2026-01-01', '2026-01-01'),
             ('locked', 'owner', 'cannot-open-until', 'Locked', 'Another story', '{"photoData":"data:image/png;base64,abc"}', 'private', '2026-01-01', '2026-01-01'),
             ('other-moment', 'other', 'shared', 'Other', 'Other story', '{"photoData":"data:image/png;base64,abc"}', 'public', '2026-01-01', '2026-01-01'),
             ('deleted', 'owner', 'shared', 'Deleted', '', '{}', 'private', '2026-01-01', '2026-01-01');
      INSERT INTO moment_videos (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('v1', 'owner', 'public', 'v1', 'v1.mp4', 'video/mp4', 1, 'attached'),
             ('v2', 'owner', 'family', 'v2', 'v2.mp4', 'video/mp4', 1, 'attached'),
             ('v3', 'owner', NULL, 'v3', 'v3.mp4', 'video/mp4', 1, 'ready'),
             ('v4', 'owner', 'deleted', 'v4', 'v4.mp4', 'video/mp4', 1, 'attached'),
             ('v5', 'other', 'other-moment', 'v5', 'v5.mp4', 'video/mp4', 1, 'attached');
      INSERT INTO moment_audio (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('a1', 'owner', 'public', 'a1', 'a1.mp3', 'audio/mpeg', 1, 'attached'),
             ('a2', 'owner', 'family', 'a2', 'a2.mp3', 'audio/mpeg', 1, 'attached'),
             ('a3', 'owner', NULL, 'a3', 'a3.mp3', 'audio/mpeg', 1, 'ready');
      INSERT INTO drafts (id, user_id, kind, title, payload_json, created_at, updated_at)
      VALUES ('draft', 'owner', 'shared', 'Draft', '{"photoData":"draft","videoUploadId":"v3","audioUploadId":"a3"}', '2026-01-01', '2026-01-01');
      DELETE FROM moments WHERE id = 'deleted';
    `);
    const sql = async (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(text, values)).rows;
    };
    const service = loadEntitlements(sql);
    const report = await service.getUsageReport("owner");
    assert.equal(report.photos.current, 2);
    assert.equal(report.stories.current, 2);
    assert.equal(report.audioMoments.current, 2);
    assert.equal(report.futureMomentMakers.current, 2);
    assert.equal(report.cannotOpenUntil.current, 1);
    assert.equal(report.videos.public.current, 1);
    assert.equal(report.videos.nonPublic.current, 1);
    assert.equal(report.photos.planRemaining, 23);
    assert.equal(report.photos.effectiveLimit, null);
    assert.equal((await service.getFutureMomentMakerQuotaStatus("owner")).enforcementEnabled, false);
    assert.equal((await service.getEntitlements("other")).betaAccess, "unreviewed");
    const legacy = await service.getUsageReport("legacy");
    assert.equal(legacy.legacyMembership, "tier-3");
    assert.equal(legacy.photos.planLimit, "unreviewed");
    assert.equal(legacy.photos.effectiveLimit, null);
  } finally {
    await db.close();
    await migrated.close();
  }
});
