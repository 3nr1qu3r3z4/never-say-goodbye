import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("legacy Moments remain inactive and disconnected recipients require reassignment", {
  skip: process.env.CANNOT_OPEN_TEST_PGLITE ? false : "Set CANNOT_OPEN_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.CANNOT_OPEN_TEST_PGLITE);
  const db = new PGlite();
  try {
    const migrations = fs.readdirSync(path.join(root, "db", "migrations"))
      .filter((name) => /^\d+_.+\.sql$/.test(name) && name < "030_").sort();
    for (const file of migrations) await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('recipient', 'recipient@example.test', 'hash', 'Recipient', 'Test', 'Recipient', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('outsider', 'outsider@example.test', 'hash', 'Outsider', 'Test', 'Outsider', 'full-name', 'free', '2026-01-01', '2026-01-01');
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('connection', 'recipient', 'owner', 'Owner', 'Family', 'accepted', '2026-01-01', '2026-01-01');
      INSERT INTO moments (id, user_id, kind, title, story, audience, created_at, updated_at)
      VALUES ('legacy', 'owner', 'cannot-open-until', 'Legacy', 'Preserve me', 'private', '2026-01-01', '2026-01-01'),
             ('review', 'owner', 'cannot-open-until', 'Review', 'Review me', 'private', '2026-01-01', '2026-01-01');
    `);
    const migration = fs.readFileSync(path.join(root, "db", "migrations", "030_cannot_open_until.sql"), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    const mediaMigration = fs.readFileSync(path.join(root, "db", "migrations", "031_cannot_open_until_media.sql"), "utf8");
    await db.exec(mediaMigration);
    await db.exec(mediaMigration);
    const commitMigration = fs.readFileSync(path.join(root, "db", "migrations", "032_cannot_open_until_commit_guard.sql"), "utf8");
    await db.exec(commitMigration);
    await db.exec(commitMigration);
    const recipientMigration = fs.readFileSync(path.join(root, "db", "migrations", "033_time_capsule_recipients.sql"), "utf8");
    await db.exec(recipientMigration);
    await db.exec(recipientMigration);
    const timeMigration = fs.readFileSync(path.join(root, "db", "migrations", "034_time_capsule_opening_time.sql"), "utf8");
    await db.exec(timeMigration);
    await db.exec(timeMigration);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM cannot_open_until_settings")).rows[0].count, 0);
    assert.equal((await db.query("SELECT story FROM moments WHERE id = 'legacy'")).rows[0].story, "Preserve me");
    await assert.rejects(db.exec(`INSERT INTO cannot_open_until_settings (moment_id, recipient_user_id, connection_id)
      VALUES ('legacy', 'outsider', 'connection')`));
    await db.exec(`INSERT INTO cannot_open_until_settings
      (moment_id, status, recipient_kind, intended_user_id, recipient_user_id, connection_id, release_date, release_timezone, unlock_at, reviewed_at)
      VALUES ('legacy', 'active', 'current', 'recipient', 'recipient', 'connection', '2030-01-01', 'UTC', '2030-01-01T00:00:00Z', CURRENT_TIMESTAMP)`);
    const sql = async (strings, ...values) => {
      const query = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return (await db.query(query, values)).rows;
    };
    sql.transaction = async (statements) => Promise.all(statements);
    const exports = {};
    const env = {};
    const source = fs.readFileSync(path.join(root, "lib", "cannot-open-until.ts"), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(compiled, {
      exports, process: { env },
      require: (name) => {
        if (name === "server-only") return {};
        if (name === "@/lib/db") return { getSql: () => sql };
        throw new Error(`Unexpected import: ${name}`);
      },
    });
    assert.equal(await exports.getAccessibleTimeCapsule("owner", "legacy"), null);
    env.CANNOT_OPEN_UNTIL_ENABLED = "true";
    assert.equal((await exports.getAccessibleTimeCapsule("owner", "legacy")).story, "Preserve me");
    assert.equal(await exports.getAccessibleTimeCapsule("recipient", "legacy"), null);
    assert.equal(await exports.getAccessibleTimeCapsule("outsider", "legacy"), null);
    const actions = {};
    const photos = {};
    const photoCode = ts.transpileModule(fs.readFileSync(path.join(root, "lib", "profile-photo.ts"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(photoCode, { exports: photos, Buffer, require: (name) => {
      if (name === "server-only") return {};
      throw new Error(`Unexpected import: ${name}`);
    } });
    const actionSource = fs.readFileSync(path.join(root, "app", "actions", "cannot-open-until.ts"), "utf8");
    const actionCode = ts.transpileModule(actionSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    let viewer = "owner";
    vm.runInNewContext(actionCode, {
      exports: actions, Date, Error,
      require: (name) => {
        if (name === "node:crypto") return createRequire(import.meta.url)("node:crypto");
        if (name === "next/cache") return { revalidatePath: () => {} };
        if (name === "@/lib/auth") return { getCurrentUser: async () => ({ id: viewer }) };
        if (name === "@/lib/db") return { getSql: () => sql };
        if (name === "@/lib/cannot-open-until") return exports;
        if (name === "@/lib/profile-photo") return photos;
        throw new Error(`Unexpected import: ${name}`);
      },
    });
    const form = new FormData();
    const review = new FormData();
    review.set("id", "review");
    review.set("recipient", "recipient");
    review.set("date", "2099-01-01");
    review.set("time", "00:00");
    review.set("timezone", "UTC");
    viewer = "outsider";
    assert.ok((await actions.activateTimeCapsule({}, review)).error);
    viewer = "owner";
    review.set("recipient", "owner");
    assert.ok((await actions.activateTimeCapsule({}, review)).error);
    review.set("recipient", "recipient");
    await db.exec("UPDATE connected_lives SET status = 'pending' WHERE id = 'connection'");
    assert.ok((await actions.activateTimeCapsule({}, review)).success);
    await db.exec("UPDATE connected_lives SET status = 'accepted' WHERE id = 'connection'");
    assert.ok((await actions.activateTimeCapsule({}, review)).success);
    assert.equal((await db.query("SELECT story FROM moments WHERE id = 'review'")).rows[0].story, "Review me");
    await db.exec("DELETE FROM moments WHERE id = 'review'");
    form.set("id", "legacy");
    form.set("recipient", "recipient");
    form.set("date", "2099-01-01");
    form.set("time", "00:00");
    form.set("timezone", "UTC");
    viewer = "outsider";
    assert.ok((await actions.activateTimeCapsule({}, form)).error);
    viewer = "owner";
    assert.ok((await actions.activateTimeCapsule({}, form)).success);
    assert.equal((await exports.getReceivedTimeCapsules("recipient")).length, 0);
    assert.ok((await actions.reassignTimeCapsule({}, form)).success);
    const listing = await exports.getReceivedTimeCapsules("recipient");
    assert.equal(listing.length, 1);
    assert.equal(listing[0].title, "Legacy");
    assert.equal(listing[0].sender, "Owner");
    assert.equal(listing[0].releaseDate, "2099-01-01");
    assert.equal(listing[0].released, false);
    assert.equal("story" in listing[0], false);
    assert.equal((await exports.getReceivedTimeCapsule("recipient", "legacy")).title, "Legacy");
    assert.equal(await exports.getReceivedTimeCapsule("outsider", "legacy"), null);
    await db.exec(`
      INSERT INTO moment_videos (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('video', 'owner', 'legacy', 'video-path', 'video.mp4', 'video/mp4', 1, 'attached');
      INSERT INTO moment_audio (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('audio', 'owner', 'legacy', 'audio-path', 'audio.mp3', 'audio/mpeg', 1, 'attached');
    `);
    await db.exec("UPDATE moment_videos SET filename = 'edited.mp4' WHERE id = 'video'");
    await db.exec("UPDATE moment_audio SET filename = 'edited.mp3' WHERE id = 'audio'");
    await db.exec(`
      INSERT INTO moment_videos (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('new-video', 'owner', 'new-video-path', 'new.mp4', 'video/mp4', 1, 'ready');
      INSERT INTO moment_audio (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('new-audio', 'owner', 'new-audio-path', 'new.mp3', 'audio/mpeg', 1, 'ready');
    `);
    const photoData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    const edit = new FormData();
    for (const [key, val] of Object.entries({
      id: "legacy", version: "2026-01-01", title: "Edited title", story: "Edited story",
      tags: "family", message: "Message", photoAction: "replace", photoData,
      photoName: "photo.jpg", videoAction: "replace", videoId: "new-video",
      audioAction: "replace", audioId: "new-audio",
    })) edit.set(key, val);
    viewer = "outsider";
    assert.ok((await actions.saveTimeCapsuleContent({}, edit)).error);
    viewer = "owner";
    edit.set("audioId", "missing");
    assert.ok((await actions.saveTimeCapsuleContent({}, edit)).error);
    assert.equal((await db.query("SELECT moment_id FROM moment_videos WHERE id = 'video'")).rows[0].moment_id, "legacy");
    edit.set("audioId", "new-audio");
    assert.ok((await actions.saveTimeCapsuleContent({}, edit)).success);
    assert.equal((await db.query("SELECT moment_id FROM moment_videos WHERE id = 'new-video'")).rows[0].moment_id, "legacy");
    assert.equal((await db.query("SELECT moment_id FROM moment_audio WHERE id = 'new-audio'")).rows[0].moment_id, "legacy");
    assert.equal((await db.query("SELECT state FROM moment_videos WHERE id = 'video'")).rows[0].state, "deleting");
    assert.equal((await db.query("SELECT details_json::jsonb ->> 'photoData' AS photo FROM moments WHERE id = 'legacy'")).rows[0].photo, photoData);
    assert.match((await actions.saveTimeCapsuleContent({}, edit)).error, /changed elsewhere/);
    await db.exec("UPDATE moments SET story = 'Edited before release' WHERE id = 'legacy'");
    assert.ok((await actions.releaseTimeCapsule({}, form)).success);
    assert.match((await actions.saveTimeCapsuleContent({}, edit)).error, /read-only/);
    assert.equal((await exports.getAccessibleTimeCapsule("recipient", "legacy")).story, "Edited before release");
    assert.equal((await exports.getReceivedTimeCapsule("recipient", "legacy")).released, true);
    await assert.rejects(db.exec("UPDATE moments SET story = 'Edited after release' WHERE id = 'legacy'"), /read-only/);
    await assert.rejects(db.exec("UPDATE moments SET details_json = '{}' WHERE id = 'legacy'"), /read-only/);
    await assert.rejects(db.exec("UPDATE cannot_open_until_settings SET manual_released_at = NULL WHERE moment_id = 'legacy'"), /read-only/);
    await assert.rejects(db.exec("UPDATE moment_videos SET moment_id = NULL WHERE id = 'new-video'"), /read-only/);
    await assert.rejects(db.exec("DELETE FROM moment_audio WHERE id = 'new-audio'"), /read-only/);
    await db.exec("UPDATE moments SET archived_at = CURRENT_TIMESTAMP WHERE id = 'legacy'");
    assert.equal(await exports.getAccessibleTimeCapsule("recipient", "legacy"), null);
    assert.equal(await exports.getReceivedTimeCapsule("recipient", "legacy"), null);
    assert.equal((await exports.getAccessibleTimeCapsule("owner", "legacy")).story, "Edited before release");
    await db.exec("UPDATE moments SET archived_at = NULL WHERE id = 'legacy'");
    assert.equal((await exports.getReceivedTimeCapsule("recipient", "legacy")).released, true);
    await db.exec("UPDATE connected_lives SET status = 'declined' WHERE id = 'connection'");
    await db.exec("UPDATE connected_lives SET status = 'accepted' WHERE id = 'connection'");
    assert.deepEqual((await db.query("SELECT recipient_user_id, connection_id FROM cannot_open_until_settings")).rows[0],
      { recipient_user_id: null, connection_id: null });
    assert.equal(await exports.getAccessibleTimeCapsule("recipient", "legacy"), null);
    assert.equal(await exports.getReceivedTimeCapsule("recipient", "legacy"), null);
    await db.exec("UPDATE cannot_open_until_settings SET recipient_user_id = 'recipient', connection_id = 'connection'");
    await db.exec("DELETE FROM users WHERE id = 'recipient'");
    assert.deepEqual((await db.query("SELECT recipient_user_id, connection_id FROM cannot_open_until_settings")).rows[0],
      { recipient_user_id: null, connection_id: null });
    assert.equal((await db.query("SELECT story FROM moments WHERE id = 'legacy'")).rows[0].story, "Edited before release");
    await db.exec(`
      INSERT INTO moments (id, user_id, kind, title, story, audience, created_at, updated_at)
      VALUES ('due', 'owner', 'cannot-open-until', 'Due', 'Scheduled content', 'private', '2026-01-01', '2026-01-01');
      INSERT INTO moment_videos (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('due-video', 'owner', 'due', 'due-video-path', 'video.mp4', 'video/mp4', 1, 'attached');
      INSERT INTO moment_audio (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('due-audio', 'owner', 'due', 'due-audio-path', 'audio.mp3', 'audio/mpeg', 1, 'attached');
    `);
    await db.exec(`
      INSERT INTO cannot_open_until_settings (moment_id, status, release_date, release_timezone, unlock_at, reviewed_at)
      VALUES ('due', 'active', '2020-01-01', 'UTC', '2020-01-01T00:00:00Z', CURRENT_TIMESTAMP);
    `);
    await assert.rejects(db.exec("UPDATE moments SET title = 'Changed' WHERE id = 'due'"), /read-only/);
    await assert.rejects(db.exec("UPDATE cannot_open_until_settings SET unlock_at = '2099-01-01T00:00:00Z' WHERE moment_id = 'due'"), /read-only/);
    await assert.rejects(db.exec("UPDATE moment_videos SET pathname = 'replacement' WHERE id = 'due-video'"), /read-only/);
    await assert.rejects(db.exec("UPDATE moment_audio SET state = 'deleting', moment_id = NULL WHERE id = 'due-audio'"), /read-only/);
    await db.exec("UPDATE moments SET archived_at = CURRENT_TIMESTAMP WHERE id = 'due'");
    await db.exec("DELETE FROM moments WHERE id = 'due'");
    assert.equal((await db.query("SELECT moment_id FROM moment_videos WHERE id = 'due-video'")).rows[0].moment_id, null);
    await db.exec(`
      INSERT INTO moment_videos (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('create-video', 'owner', 'create-video-path', 'video.mp4', 'video/mp4', 1, 'ready');
      INSERT INTO moment_audio (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('create-audio', 'owner', 'create-audio-path', 'audio.mp3', 'audio/mpeg', 1, 'ready');
    `);
    sql.transaction = async (statements) => Promise.all(statements);
    const creator = {};
    const creatorCode = ts.transpileModule(fs.readFileSync(path.join(root, "lib", "moment-actions.ts"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(creatorCode, { exports: creator, Date, Error, require: (name) => {
      if (name === "node:crypto") return { randomUUID: () => "created" };
      if (name === "@/lib/auth") return { getCurrentUser: async () => ({ id: "owner" }) };
      if (name === "@/lib/db") return { getSql: () => sql };
      if (name === "@/lib/password") return { hashSecret: async () => "hash" };
      if (name === "@/lib/profile-photo") return { validatePhoto: (photo) => photo };
      if (name === "@/lib/cannot-open-until") return exports;
      if (name === "@/lib/time-capsule-schedule") return { timeCapsuleDelayMinutes: () => null };
      throw new Error(`Unexpected import: ${name}`);
    } });
    const draft = {
      title: "Media capsule", story: "", tags: "", content: ["video", "voice"],
      attachmentNames: { video: "video.mp4", voice: "audio.mp3" }, photoData: "",
      videoUploadId: "create-video", audioUploadId: "create-audio", writtenMessage: "",
      audience: "private", accessCodeRequired: false, accessCode: "", releaseKind: "date",
      releaseDate: "2099-01-01", occasion: "", customOccasionDate: "", recipientName: "",
      relationship: "", createRecipient: false, familyPlaceholderId: "",
      timeCapsuleRecipientKind: "current", timeCapsuleRecipientId: "outsider", releaseTimezone: "UTC",
    };
    assert.ok((await creator.publishMoment("cannot-open-until", "", draft)).success);
    assert.equal((await db.query("SELECT moment_id FROM moment_videos WHERE id = 'create-video'")).rows[0].moment_id, "created");
    assert.equal((await db.query("SELECT moment_id FROM moment_audio WHERE id = 'create-audio'")).rows[0].moment_id, "created");
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM cannot_open_until_settings WHERE moment_id = 'created' AND status = 'active'")).rows[0].count, 1);
    const remove = new FormData();
    remove.set("id", "created");
    viewer = "outsider";
    assert.ok((await actions.deleteTimeCapsule({}, remove)).error);
    viewer = "owner";
    assert.ok((await actions.deleteTimeCapsule({}, remove)).success);
    assert.equal((await db.query("SELECT moment_id FROM moment_audio WHERE id = 'create-audio'")).rows[0].moment_id, null);
    env.CANNOT_OPEN_UNTIL_ENABLED = "false";
    assert.ok((await actions.activateTimeCapsule({}, form)).error);
  } finally {
    await db.close();
  }
});

test("recipient pages show only metadata while locked and reauthorize released content", async () => {
  const loadPage = (file, deps) => {
    const source = fs.readFileSync(path.join(root, "app", "cannot-open-until", "inbox", ...file), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, require: (name) => {
      if (!(name in deps)) throw new Error(`Unexpected import: ${name}`);
      return deps[name];
    } });
    return exports.default;
  };
  const link = { default: ({ children, href }) => React.createElement("a", { href }, children) };
  let enabled = true;
  let listing = { id: "one", title: "Future memory", sender: "Sender", releaseDate: "2099-01-01", releaseTimezone: "UTC", unlockAt: "2099-01-01T00:00:00.000Z", released: false };
  let content = { id: "one", title: "Future memory", story: "PRIVATE STORY", writtenMessage: "PRIVATE MESSAGE", tags: "PRIVATE TAGS", hasPhoto: true, hasVideo: true, hasAudio: true };
  let contentQueries = 0;
  const deps = {
    "react/jsx-runtime": jsxRuntime, "next/link": link,
    "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "./locked-countdown": { default: ({ unlockAt }) => React.createElement("p", null, `Countdown to ${unlockAt}`) },
    "@/lib/time-capsule-schedule": { formatTimeCapsuleInstant: (instant) => instant.slice(0, 10) },
    "@/lib/auth": { requireUser: async () => ({ id: "recipient" }) },
    "@/lib/cannot-open-until": {
      cannotOpenUntilEnabled: () => enabled,
      getReceivedTimeCapsules: async () => listing ? [listing] : [],
      getReceivedTimeCapsule: async () => listing,
      getAccessibleTimeCapsule: async () => { contentQueries++; return content; },
    },
  };
  const inbox = loadPage(["page.tsx"], deps);
  const detail = loadPage(["[id]", "page.tsx"], deps);
  const params = { params: Promise.resolve({ id: "one" }) };
  const lockedList = renderToStaticMarkup(await inbox());
  assert.match(lockedList, /Future memory/);
  assert.match(lockedList, /Sender/);
  assert.match(lockedList, /2099-01-01/);
  assert.match(lockedList, /Locked/);
  assert.doesNotMatch(lockedList, /PRIVATE|\/api\/moments/);
  const locked = renderToStaticMarkup(await detail(params));
  assert.match(locked, /Locked until release/);
  assert.match(locked, /Countdown to 2099-01-01T00:00:00.000Z/);
  assert.doesNotMatch(locked, /PRIVATE|\/api\/moments|<audio|<video/);
  assert.equal(contentQueries, 0);
  listing = { ...listing, released: true };
  const released = renderToStaticMarkup(await detail(params));
  assert.match(released, /PRIVATE STORY/);
  assert.match(released, /PRIVATE MESSAGE/);
  assert.match(released, /\/api\/moments\/one\/photo/);
  assert.match(released, /\/api\/moments\/one\/video/);
  assert.match(released, /\/api\/moments\/one\/audio/);
  assert.equal(contentQueries, 1);
  content = null;
  await assert.rejects(detail(params), /not found/);
  listing = null;
  await assert.rejects(detail(params), /not found/);
  enabled = false;
  await assert.rejects(inbox(), /not found/);
  await assert.rejects(detail(params), /not found/);
});

test("locked countdown updates against the open instant without granting access", () => {
  const source = fs.readFileSync(path.join(root, "app", "cannot-open-until", "inbox", "[id]", "locked-countdown.tsx"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  let now = Date.parse("2030-01-01T00:00:00.000Z");
  let remaining = null;
  let tick;
  let effectStarted = false;
  let refreshes = 0;
  const deps = {
    "react/jsx-runtime": jsxRuntime,
    react: {
      useState: () => [remaining, (value) => { remaining = value; }],
      useEffect: (effect) => { if (!effectStarted) { effectStarted = true; effect(); } },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes++; } }) },
  };
  vm.runInNewContext(code, {
    exports, Date: { parse: Date.parse, now: () => now },
    window: { setInterval: (callback) => { tick = callback; return 1; }, clearInterval: () => {} },
    require: (name) => {
      if (!(name in deps)) throw new Error(`Unexpected import: ${name}`);
      return deps[name];
    },
  });
  const props = { unlockAt: "2030-01-02T01:02:03.000Z" };
  assert.equal(exports.default(props), null);
  let element = exports.default(props);
  assert.match(renderToStaticMarkup(element), /Opens in 1d 1h 2m 3s/);
  assert.match(renderToStaticMarkup(element), /Check for early release/);
  now = Date.parse(props.unlockAt);
  tick();
  element = exports.default(props);
  assert.match(renderToStaticMarkup(element), /Check availability/);
  element.props.children[2].props.onClick();
  assert.equal(refreshes, 1);
});

test("owner review and released views expose the appropriate controls", () => {
  const source = fs.readFileSync(path.join(root, "app", "cannot-open-until", "[id]", "owner-controls.tsx"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const noop = async () => ({});
  const deps = {
    "react/jsx-runtime": jsxRuntime, react: React,
    "next/image": { default: () => null }, "@vercel/blob/client": { upload: noop },
    "@/lib/prepare-moment-photo": { prepareMomentPhoto: noop },
    "@/lib/time-capsule-schedule": { formatTimeCapsuleInstant: () => "Opening" },
    "@/lib/moment-audio-actions": { beginMomentAudioUpload: noop, completeMomentAudioUpload: noop },
    "@/lib/moment-video-actions": { beginMomentVideoUpload: noop, completeMomentVideoUpload: noop },
    "@/app/actions/content-archive": { changeArchiveState: noop },
    "@/app/actions/family-tree": { searchFamilyMomentMakers: noop },
    "@/app/actions/cannot-open-until": {
      activateTimeCapsule: noop, deleteTimeCapsule: noop, reassignTimeCapsule: noop,
      releaseTimeCapsule: noop, saveTimeCapsuleContent: noop, createClaimLink: noop, decideTimeCapsuleClaim: noop,
    },
  };
  vm.runInNewContext(code, { exports, require: (name) => {
    if (!(name in deps)) throw new Error(`Unexpected import: ${name}`);
    return deps[name];
  } });
  const moment = {
    id: "one", title: "Test", story: "Memory", tags: "", message: "", version: "1",
    hasPhoto: false, hasVideo: false, hasAudio: false, photoName: null, videoName: null,
    audioName: null, archived: false, review: true, released: false, recipientId: null,
    recipientName: null, releaseDate: null, releaseTimezone: null, oldReleaseDate: "2020-01-01",
    oldOccasion: "Birthday",
  };
  const render = (data) => renderToStaticMarkup(React.createElement(exports.default, {
    moment: data, candidates: { current: [{ id: "relative", name: "Relative" }], future: [], placeholders: [] }, claims: [],
  }));
  const review = render(moment);
  assert.match(review, /Review Required/);
  assert.match(review, /not an active schedule/);
  assert.match(review, /Activate schedule/);
  assert.match(review, /Edit content/);
  assert.doesNotMatch(review, /Release now/);
  const released = render({ ...moment, review: false, released: true, archived: true });
  assert.match(released, /Released · Read-only/);
  assert.match(released, /Recipient unavailable/);
  assert.match(released, /cannot be changed after release/);
  assert.match(released, /Restore/);
  assert.match(released, /Delete permanently/);
  assert.doesNotMatch(released, /Edit content|Release now|name="date"/);
});
