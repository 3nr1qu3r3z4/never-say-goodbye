import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configured = process.env.CANNOT_OPEN_TEST_POSTGRES && process.env.CANNOT_OPEN_TEST_PG;

function moduleFor(file, deps) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env: { CANNOT_OPEN_UNTIL_ENABLED: "true" } }, Date, Buffer, Request, Response, Headers, Uint8Array, console, require: (name) => {
    if (!(name in deps)) throw new Error(`Unexpected import: ${name}`);
    return deps[name];
  } });
  return exports;
}

function dbAdapter(client) {
  const sql = (strings, ...values) => {
    const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
    return { then: (resolve, reject) => client.query(text, values).then((result) => result.rows).then(resolve, reject) };
  };
  sql.transaction = async (queries) => {
    await client.query("BEGIN");
    try {
      const results = [];
      for (const query of queries) results.push(await query);
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  };
  return sql;
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function assertWaiting(promise) {
  const result = await Promise.race([promise.then(() => "finished", () => "finished"), new Promise((resolve) => setTimeout(() => resolve("waiting"), 200))]);
  assert.equal(result, "waiting", "operation should wait for the other transaction's row lock");
}

test("owner lifecycle and concurrent changes serialize in PostgreSQL", {
  skip: configured ? false : "Set CANNOT_OPEN_TEST_POSTGRES and CANNOT_OPEN_TEST_PG for isolated PostgreSQL.",
  timeout: 60_000,
}, async () => {
  const { Client } = createRequire(import.meta.url)(process.env.CANNOT_OPEN_TEST_PG);
  const clients = Array.from({ length: 3 }, () => new Client({ connectionString: process.env.CANNOT_OPEN_TEST_POSTGRES }));
  const schema = `capsule_test_${randomUUID().replaceAll("-", "")}`;
  await Promise.all(clients.map((client) => client.connect()));
  const [a, b, read] = clients;
  try {
    await a.query(`CREATE SCHEMA "${schema}"`);
    await Promise.all(clients.map((client) => client.query(`SET search_path TO "${schema}"`)));
    const migrations = fs.readdirSync(path.join(root, "db", "migrations")).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    for (const file of migrations) await a.query(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    await a.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('recipient', 'recipient@example.test', 'hash', 'Recipient', 'Test', 'Recipient', 'full-name', 'free', '2026-01-01', '2026-01-01'),
             ('other', 'other@example.test', 'hash', 'Other', 'Test', 'Other', 'full-name', 'free', '2026-01-01', '2026-01-01');
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('c1', 'recipient', 'owner', 'Owner', 'Family', 'accepted', '2026-01-01', '2026-01-01'),
             ('c2', 'owner', 'other', 'Other', 'Family', 'accepted', '2026-01-01', '2026-01-01');
    `);
    const build = (client, userId = "owner") => {
      const sql = dbAdapter(client);
      const access = moduleFor("lib\\cannot-open-until.ts", { "server-only": {}, "@/lib/db": { getSql: () => sql } });
      const common = { "@/lib/auth": { getCurrentUser: async () => ({ id: userId }) }, "@/lib/db": { getSql: () => sql } };
      const actions = moduleFor("app\\actions\\cannot-open-until.ts", {
        ...common, "next/cache": { revalidatePath: () => {} }, "@/lib/cannot-open-until": access,
        "@/lib/profile-photo": { validatePhoto: (value) => value },
      });
      const archive = moduleFor("app\\actions\\content-archive.ts", { ...common, "next/cache": { revalidatePath: () => {} } });
      const creator = moduleFor("lib\\moment-actions.ts", {
        ...common, "node:crypto": { randomUUID: () => "created" }, "@/lib/password": { hashSecret: async () => "hash" },
        "@/lib/profile-photo": { validatePhoto: (value) => value }, "@/lib/cannot-open-until": access,
      });
      return { actions, archive, creator, access };
    };
    const one = build(a), two = build(b), viewer = build(read, "recipient");
    const photoData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
    await a.query(`INSERT INTO moment_videos (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('video', 'owner', 'video-path', 'video.mp4', 'video/mp4', 4, 'ready');
      INSERT INTO moment_audio (id, user_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('audio', 'owner', 'audio-path', 'audio.mp3', 'audio/mpeg', 4, 'ready')`);
    const draft = { title: "Future", story: "Original", tags: "", content: ["written", "photo", "video", "voice"],
      attachmentNames: { photo: "photo.png", video: "video.mp4", voice: "audio.mp3" }, photoData,
      videoUploadId: "video", audioUploadId: "audio", writtenMessage: "A message", audience: "private", accessCodeRequired: false,
      accessCode: "", releaseKind: "date", releaseDate: "2099-01-01", occasion: "", customOccasionDate: "",
      recipientName: "", relationship: "", createRecipient: false, familyPlaceholderId: "" };
    const photos = moduleFor("lib\\profile-photo.ts", { "server-only": {} });
    const mediaStream = moduleFor("lib\\moment-media-stream.ts", { "@vercel/blob": {
      get: async (_pathname, options) => {
        const headers = new Headers();
        const data = new Uint8Array([1, 2, 3, 4]);
        const range = options.headers?.Range;
        if (range) {
          const [, start, end] = /^bytes=(\d+)-(\d+)$/.exec(range);
          headers.set("content-range", `bytes ${start}-${end}/4`);
          return { statusCode: 200, headers, stream: new Response(data.slice(Number(start), Number(end) + 1)).body };
        }
        return { statusCode: 200, headers, stream: new Response(data).body };
      },
    } });
    const mediaDeps = {
      "@/lib/auth": { getCurrentUser: async () => ({ id: "recipient" }) },
      "@/lib/db": { getSql: () => dbAdapter(read) },
      "@/lib/moment-access": { getAccessibleMoment: async () => null },
      "@/lib/cannot-open-until": viewer.access,
      "@/lib/moment-media-stream": mediaStream,
      "@/lib/profile-photo": photos,
    };
    const photo = moduleFor("app\\api\\moments\\[id]\\photo\\route.ts", mediaDeps);
    const video = moduleFor("app\\api\\moments\\[id]\\video\\route.ts", mediaDeps);
    const audio = moduleFor("app\\api\\moments\\[id]\\audio\\route.ts", mediaDeps);
    const mediaRequest = (route, range) => route.GET(new Request("https://example.test/media", {
      headers: range ? { Range: range } : {},
    }), { params: Promise.resolve({ id: "created" }) });
    assert.ok((await one.creator.publishMoment("cannot-open-until", "", draft)).success);
    assert.equal((await a.query("SELECT COUNT(*)::int AS count FROM cannot_open_until_settings WHERE moment_id = 'created'")).rows[0].count, 0);
    const activation = form({ id: "created", recipient: "recipient", date: "2099-01-01", timezone: "UTC" });
    assert.ok((await one.actions.activateTimeCapsule({}, activation)).success);
    const locked = await viewer.access.getReceivedTimeCapsule("recipient", "created");
    assert.equal(locked.released, false);
    assert.equal(locked.title, "Future");
    assert.equal(locked.sender, "Owner");
    assert.equal(locked.releaseDate, "2099-01-01");
    assert.equal("story" in locked, false);
    assert.equal(await viewer.access.getAccessibleTimeCapsule("recipient", "created"), null);
    assert.equal((await mediaRequest(photo)).status, 404);
    assert.equal((await mediaRequest(video)).status, 404);
    assert.equal((await mediaRequest(audio)).status, 404);
    assert.ok((await one.actions.releaseTimeCapsule({}, activation)).success);
    assert.equal((await viewer.access.getAccessibleTimeCapsule("recipient", "created")).story, "Original");
    assert.equal((await mediaRequest(photo)).status, 200);
    for (const route of [video, audio]) {
      const response = await mediaRequest(route, "bytes=1-2");
      assert.equal(response.status, 206);
      assert.equal(response.headers.get("content-range"), "bytes 1-2/4");
      assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), [2, 3]);
    }
    const archive = (operation) => form({ id: "created", kind: "moment", operation });
    assert.ok((await one.archive.changeArchiveState({}, archive("archive"))).success);
    assert.equal(await viewer.access.getReceivedTimeCapsule("recipient", "created"), null);
    assert.equal((await mediaRequest(video)).status, 404);
    assert.ok((await one.archive.changeArchiveState({}, archive("restore"))).success);
    assert.equal((await viewer.access.getAccessibleTimeCapsule("recipient", "created")).story, "Original");
    assert.equal((await mediaRequest(audio)).status, 200);
    await a.query("UPDATE connected_lives SET status = 'declined' WHERE id = 'c1'");
    assert.equal(await viewer.access.getReceivedTimeCapsule("recipient", "created"), null);
    assert.equal((await mediaRequest(audio)).status, 404);
    await a.query("UPDATE connected_lives SET status = 'accepted' WHERE id = 'c1'");
    assert.equal(await viewer.access.getReceivedTimeCapsule("recipient", "created"), null);
    assert.ok((await one.actions.reassignTimeCapsule({}, activation)).success);
    assert.equal((await viewer.access.getReceivedTimeCapsule("recipient", "created")).released, true);
    assert.equal((await mediaRequest(video)).status, 200);
    assert.ok((await one.actions.deleteTimeCapsule({}, activation)).success);
    assert.equal(await viewer.access.getReceivedTimeCapsule("recipient", "created"), null);
    assert.equal((await mediaRequest(photo)).status, 404);

    async function fixture(id) {
      await a.query(`INSERT INTO moments (id, user_id, kind, title, story, audience, created_at, updated_at)
        VALUES ($1, 'owner', 'cannot-open-until', 'Title', 'Original', 'private', '2026-01-01', 'v1')`, [id]);
      await a.query(`INSERT INTO cannot_open_until_settings
        (moment_id, status, recipient_user_id, connection_id, release_date, release_timezone, unlock_at, reviewed_at)
        VALUES ($1, 'active', 'recipient', 'c1', '2099-01-01', 'UTC', '2099-01-01T00:00:00Z', clock_timestamp())`, [id]);
    }
    const edit = (id) => form({ id, version: "v1", title: "Title", story: "Edited", tags: "", message: "",
      photoAction: "keep", videoAction: "keep", audioAction: "keep" });
    const release = (id) => form({ id });
    const reassign = (id) => form({ id, recipient: "other" });

    await fixture("edit-first");
    await a.query("BEGIN");
    assert.ok((await one.actions.saveTimeCapsuleContent({}, edit("edit-first"))).success);
    const releaseAfterEdit = two.actions.releaseTimeCapsule({}, release("edit-first"));
    await assertWaiting(releaseAfterEdit);
    await a.query("COMMIT");
    assert.ok((await releaseAfterEdit).success);
    assert.equal((await viewer.access.getAccessibleTimeCapsule("recipient", "edit-first")).story, "Edited");

    await fixture("release-first");
    await a.query("BEGIN");
    assert.ok((await one.actions.releaseTimeCapsule({}, release("release-first"))).success);
    const editAfterRelease = two.actions.saveTimeCapsuleContent({}, edit("release-first"));
    await assertWaiting(editAfterRelease);
    await a.query("COMMIT");
    assert.match((await editAfterRelease).error, /read-only/);
    assert.equal((await viewer.access.getAccessibleTimeCapsule("recipient", "release-first")).story, "Original");

    await fixture("release-reassign");
    await a.query("BEGIN");
    assert.ok((await one.actions.releaseTimeCapsule({}, release("release-reassign"))).success);
    const reassignAfterRelease = two.actions.reassignTimeCapsule({}, reassign("release-reassign"));
    await assertWaiting(reassignAfterRelease);
    await a.query("COMMIT");
    assert.ok((await reassignAfterRelease).success);
    assert.equal(await viewer.access.getAccessibleTimeCapsule("recipient", "release-reassign"), null);
    assert.equal((await viewer.access.getAccessibleTimeCapsule("other", "release-reassign")).story, "Original");

    await fixture("reassign-release");
    await a.query("BEGIN");
    assert.ok((await one.actions.reassignTimeCapsule({}, reassign("reassign-release"))).success);
    const releaseAfterReassign = two.actions.releaseTimeCapsule({}, release("reassign-release"));
    await assertWaiting(releaseAfterReassign);
    await a.query("COMMIT");
    assert.ok((await releaseAfterReassign).success);
    assert.equal((await viewer.access.getAccessibleTimeCapsule("other", "reassign-release")).story, "Original");

    await fixture("disconnect-release");
    await a.query("BEGIN");
    await a.query("UPDATE connected_lives SET status = 'declined' WHERE id = 'c1'");
    const releaseAfterDisconnect = two.actions.releaseTimeCapsule({}, release("disconnect-release"));
    await assertWaiting(releaseAfterDisconnect);
    await a.query("COMMIT");
    assert.ok((await releaseAfterDisconnect).success);
    assert.equal(await viewer.access.getAccessibleTimeCapsule("recipient", "disconnect-release"), null);
    await a.query("UPDATE connected_lives SET status = 'accepted' WHERE id = 'c1'");
    assert.equal(await viewer.access.getAccessibleTimeCapsule("recipient", "disconnect-release"), null);

    await fixture("release-disconnect");
    await a.query("BEGIN");
    assert.ok((await one.actions.releaseTimeCapsule({}, release("release-disconnect"))).success);
    const disconnectAfterRelease = b.query("UPDATE connected_lives SET status = 'declined' WHERE id = 'c1'");
    await assertWaiting(disconnectAfterRelease);
    await a.query("COMMIT");
    await disconnectAfterRelease;
    await a.query("UPDATE connected_lives SET status = 'accepted' WHERE id = 'c1'");
    assert.equal(await viewer.access.getAccessibleTimeCapsule("recipient", "release-disconnect"), null);

    await fixture("archive-release");
    await a.query("BEGIN");
    assert.ok((await one.archive.changeArchiveState({}, form({ id: "archive-release", kind: "moment", operation: "archive" }))).success);
    const releaseAfterArchive = two.actions.releaseTimeCapsule({}, release("archive-release"));
    await assertWaiting(releaseAfterArchive);
    await a.query("COMMIT");
    assert.ok((await releaseAfterArchive).success);
    assert.equal(await viewer.access.getAccessibleTimeCapsule("recipient", "archive-release"), null);
    assert.ok((await one.archive.changeArchiveState({}, form({ id: "archive-release", kind: "moment", operation: "restore" }))).success);
    assert.equal((await viewer.access.getAccessibleTimeCapsule("recipient", "archive-release")).story, "Original");

    await fixture("release-archive");
    await a.query("BEGIN");
    assert.ok((await one.actions.releaseTimeCapsule({}, release("release-archive"))).success);
    const archiveAfterRelease = two.archive.changeArchiveState({}, form({ id: "release-archive", kind: "moment", operation: "archive" }));
    await assertWaiting(archiveAfterRelease);
    await a.query("COMMIT");
    assert.ok((await archiveAfterRelease).success);
    assert.equal(await viewer.access.getAccessibleTimeCapsule("recipient", "release-archive"), null);

    await fixture("clock-boundary");
    await a.query("UPDATE cannot_open_until_settings SET unlock_at = clock_timestamp() + INTERVAL '1 second' WHERE moment_id = 'clock-boundary'");
    await a.query("BEGIN");
    const crossingEdit = edit("clock-boundary");
    crossingEdit.set("title", "Changed");
    assert.ok((await one.actions.saveTimeCapsuleContent({}, crossingEdit)).success);
    await read.query("SELECT pg_sleep(1.2)");
    const readAfterDeadline = viewer.access.getAccessibleTimeCapsule("recipient", "clock-boundary");
    const listAfterDeadline = two.access.getReceivedTimeCapsule("recipient", "clock-boundary");
    await assertWaiting(readAfterDeadline);
    await assertWaiting(listAfterDeadline);
    await assert.rejects(a.query("COMMIT"), /read-only/);
    assert.equal((await readAfterDeadline).story, "Original");
    assert.equal((await listAfterDeadline).title, "Title");

    await fixture("media-boundary");
    await a.query(`INSERT INTO moment_audio (id, user_id, moment_id, pathname, filename, content_type, size_bytes, state)
      VALUES ('boundary-audio', 'owner', 'media-boundary', 'boundary-path', 'original.mp3', 'audio/mpeg', 4, 'attached')`);
    await a.query("UPDATE cannot_open_until_settings SET unlock_at = clock_timestamp() + INTERVAL '1 second' WHERE moment_id = 'media-boundary'");
    await a.query("BEGIN");
    await a.query("UPDATE moment_audio SET filename = 'changed.mp3' WHERE id = 'boundary-audio'");
    await read.query("SELECT pg_sleep(1.2)");
    await assert.rejects(a.query("COMMIT"), /read-only/);
    assert.equal((await read.query("SELECT filename FROM moment_audio WHERE id = 'boundary-audio'")).rows[0].filename, "original.mp3");

    await fixture("scheduled");
    await a.query("UPDATE cannot_open_until_settings SET unlock_at = clock_timestamp() + INTERVAL '1 second' WHERE moment_id = 'scheduled'");
    assert.equal((await viewer.access.getReceivedTimeCapsule("recipient", "scheduled")).released, false);
    await read.query("SELECT pg_sleep(1.2)");
    assert.equal((await viewer.access.getReceivedTimeCapsule("recipient", "scheduled")).released, true);
    assert.equal((await viewer.access.getAccessibleTimeCapsule("recipient", "scheduled")).story, "Original");
  } finally {
    await Promise.allSettled([a.query("ROLLBACK"), b.query("ROLLBACK"), read.query("ROLLBACK")]);
    await a.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await Promise.all(clients.map((client) => client.end()));
  }
});
