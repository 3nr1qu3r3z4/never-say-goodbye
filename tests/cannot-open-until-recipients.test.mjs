import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as crypto from "node:crypto";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("intended recipients receive locked Moments and claims require owner approval", {
  skip: process.env.CANNOT_OPEN_TEST_PGLITE ? false : "Set CANNOT_OPEN_TEST_PGLITE to an installed PGlite package path.",
}, async () => {
  const { PGlite } = createRequire(import.meta.url)(process.env.CANNOT_OPEN_TEST_PGLITE);
  const db = new PGlite();
  try {
    for (const file of fs.readdirSync(path.join(root, "db", "migrations")).filter((name) => /^\d+_.+\.sql$/.test(name) && name < "033_").sort()) {
      await db.exec(fs.readFileSync(path.join(root, "db", "migrations", file), "utf8"));
    }
    await db.exec(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, display_style, membership, discoverability, created_at, updated_at)
      VALUES ('owner', 'owner@example.test', 'hash', 'Owner', 'Test', 'Owner', 'full-name', 'free', 'searchable', '2026', '2026'),
        ('recipient', 'recipient@example.test', 'hash', 'Recipient', 'Test', 'Recipient', 'full-name', 'free', 'searchable', '2026', '2026'),
        ('other', 'other@example.test', 'hash', 'Other', 'Test', 'Other', 'full-name', 'free', 'searchable', '2026', '2026'),
        ('legacy-recipient', 'legacy@example.test', 'hash', 'Legacy', 'Test', 'Legacy', 'full-name', 'free', 'searchable', '2026', '2026'),
        ('hidden', 'hidden@example.test', 'hash', 'Hidden', 'Test', 'Hidden', 'full-name', 'free', 'private', '2026', '2026');
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      VALUES ('tree', 'owner', 'Family', '2026', '2026');
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at) VALUES ('tree', 'owner', 'owner', '2026');
      INSERT INTO future_moment_makers (id, owner_user_id, legacy_tree_id, name, relationship, created_at, updated_at)
      VALUES ('future', 'owner', 'tree', 'Future', 'Child', '2026', '2026');
      INSERT INTO family_placeholders (id, legacy_tree_id, created_by_user_id, name, relationship, created_at, updated_at)
      VALUES ('placeholder', 'tree', 'owner', 'Placeholder', 'Child', '2026', '2026');
      INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('legacy-connection', 'owner', 'legacy-recipient', 'Legacy', 'Family', 'accepted', '2026', '2026');
      INSERT INTO moments (id, user_id, kind, title, story, audience, created_at, updated_at)
      VALUES ('legacy-active', 'owner', 'cannot-open-until', 'Existing', 'Preserved', 'private', '2026', '2026');
      INSERT INTO cannot_open_until_settings
        (moment_id, status, recipient_user_id, connection_id, release_date, release_timezone, unlock_at, reviewed_at)
      VALUES ('legacy-active', 'active', 'legacy-recipient', 'legacy-connection', '2099-01-01', 'UTC', '2099-01-01', clock_timestamp());
    `);
    const recipientMigration = fs.readFileSync(path.join(root, "db", "migrations", "033_time_capsule_recipients.sql"), "utf8");
    await db.exec(recipientMigration);
    await db.exec(recipientMigration);
    const sql = (strings, ...values) => {
      const text = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "");
      return { text, values, then: (resolve, reject) => db.query(text, values).then((result) => result.rows).then(resolve, reject) };
    };
    sql.transaction = (queries) => db.transaction(async (tx) => {
      const results = [];
      for (const query of queries) results.push((await tx.query(query.text, query.values)).rows);
      return results;
    });
    const load = (file, deps, environment = {}) => {
      const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText;
      const exports = {};
      vm.runInNewContext(code, { exports, process: { env: environment }, Date, Buffer, Error, console,
        require: (name) => {
          if (!(name in deps)) throw new Error(`Unexpected import: ${name}`);
          return deps[name];
        },
      });
      return exports;
    };
    let viewer = "owner";
    const access = load("lib\\cannot-open-until.ts", { "server-only": {}, "@/lib/db": { getSql: () => sql } },
      { CANNOT_OPEN_UNTIL_ENABLED: "true" });
    const common = { "@/lib/auth": { getCurrentUser: async () => ({ id: viewer }) }, "@/lib/db": { getSql: () => sql } };
    const creator = load("lib\\moment-actions.ts", {
      ...common, "node:crypto": crypto, "@/lib/password": { hashSecret: async () => "hash" },
      "@/lib/profile-photo": { validatePhoto: (photo) => photo }, "@/lib/cannot-open-until": access,
    });
    const actions = load("app\\actions\\cannot-open-until.ts", {
      ...common, "node:crypto": crypto, "next/cache": { revalidatePath() {} },
      "@/lib/cannot-open-until": access, "@/lib/profile-photo": { validatePhoto: (photo) => photo },
    });
    const form = (data) => {
      const result = new FormData();
      for (const [key, value] of Object.entries(data)) result.set(key, value);
      return result;
    };
    const available = await creator.getTimeCapsuleRecipients();
    assert.equal(available.future[0].id, "future");
    assert.equal(available.placeholders[0].id, "placeholder");
    assert.equal((await access.getReceivedTimeCapsule("legacy-recipient", "legacy-active")).title, "Existing");
    assert.deepEqual((await db.query("SELECT recipient_kind, intended_user_id FROM cannot_open_until_settings WHERE moment_id = 'legacy-active'")).rows[0],
      { recipient_kind: "current", intended_user_id: "legacy-recipient" });
    const send = async (kind, id, title) => {
      const result = await creator.publishMoment("cannot-open-until", "", {
        title, story: "PRIVATE STORY", tags: "", content: ["written"], attachmentNames: {}, photoData: "",
        videoUploadId: "", audioUploadId: "", writtenMessage: "PRIVATE MESSAGE", audience: "private",
        accessCodeRequired: false, accessCode: "", releaseKind: "date", releaseDate: "2099-01-01",
        occasion: "", customOccasionDate: "", recipientName: "", relationship: "", createRecipient: false,
        familyPlaceholderId: "", timeCapsuleRecipientKind: kind, timeCapsuleRecipientId: id, releaseTimezone: "UTC",
      });
      if (result.error) return result;
      const rows = await db.query("SELECT id FROM moments WHERE title = $1", [title]);
      return rows.rows[0].id;
    };
    assert.ok((await send("current", "hidden", "Hidden")).error);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM moments WHERE title = 'Hidden'")).rows[0].n, 0);
    viewer = "other";
    assert.ok((await send("future", "future", "Unauthorized future")).error);
    assert.ok((await send("placeholder", "placeholder", "Unauthorized placeholder")).error);
    viewer = "owner";
    const current = await send("current", "recipient", "Current");
    const locked = await access.getReceivedTimeCapsule("recipient", current);
    assert.equal(locked.title, "Current");
    assert.equal(locked.sender, "Owner");
    assert.equal(locked.releaseDate, "2099-01-01");
    assert.equal(locked.released, false);
    assert.equal("story" in locked, false);
    assert.equal(await access.getAccessibleTimeCapsule("recipient", current), null);
    assert.equal(await access.getReceivedTimeCapsule("other", current), null);
    assert.ok((await actions.releaseTimeCapsule({}, form({ id: current }))).success);
    assert.equal((await access.getAccessibleTimeCapsule("recipient", current)).story, "PRIVATE STORY");
    await assert.rejects(db.exec(`UPDATE cannot_open_until_settings SET intended_user_id = 'other', recipient_user_id = 'other' WHERE moment_id = '${current}'`), /cannot be changed/);

    const disconnected = await send("current", "recipient", "Disconnected");
    await db.exec(`INSERT INTO connected_lives (id, owner_user_id, connected_user_id, display_name, relationship, status, created_at, updated_at)
      VALUES ('connection', 'owner', 'recipient', 'Recipient', 'Family', 'accepted', '2026', '2026')`);
    await db.exec("UPDATE connected_lives SET status = 'declined' WHERE id = 'connection'");
    assert.equal(await access.getReceivedTimeCapsule("recipient", disconnected), null);
    assert.ok((await actions.activateTimeCapsule({}, form({ id: disconnected, recipient: "current:recipient", date: "2099-01-02", timezone: "UTC" }))).success);
    assert.equal(await access.getReceivedTimeCapsule("recipient", disconnected), null);
    assert.ok((await actions.reassignTimeCapsule({}, form({ id: disconnected }))).success);
    assert.equal((await access.getReceivedTimeCapsule("recipient", disconnected)).released, false);

    const future = await send("future", "future", "Future");
    const queued = (await db.query("SELECT status, recipient_kind, future_recipient_id, recipient_user_id FROM cannot_open_until_settings WHERE moment_id = $1", [future])).rows[0];
    assert.equal(queued.status, "active");
    assert.equal(queued.recipient_kind, "future");
    assert.equal(queued.future_recipient_id, "future");
    assert.equal(queued.recipient_user_id, null);
    assert.equal(await access.getReceivedTimeCapsule("recipient", future), null);
    const link = await actions.createClaimLink({}, form({ id: future }));
    assert.ok(link.claimToken);
    viewer = "recipient";
    assert.ok((await actions.requestTimeCapsuleClaim({}, form({ token: link.claimToken }))).success);
    assert.ok((await actions.requestTimeCapsuleClaim({}, form({ token: link.claimToken }))).error);
    assert.equal(await access.getReceivedTimeCapsule("recipient", future), null);
    const claim = (await db.query("SELECT id FROM cannot_open_until_claims WHERE moment_id = $1 AND status = 'pending'", [future])).rows[0].id;
    viewer = "other";
    assert.ok((await actions.decideTimeCapsuleClaim({}, form({ claim, decision: "approve" }))).error);
    viewer = "owner";
    assert.ok((await actions.decideTimeCapsuleClaim({}, form({ claim, decision: "approve" }))).success);
    assert.equal((await access.getReceivedTimeCapsule("recipient", future)).released, false);
    assert.equal(await access.getAccessibleTimeCapsule("recipient", future), null);
    assert.ok((await actions.releaseTimeCapsule({}, form({ id: future }))).success);
    assert.equal((await access.getAccessibleTimeCapsule("recipient", future)).story, "PRIVATE STORY");
    assert.equal((await db.query("SELECT user_id FROM moments WHERE id = $1", [future])).rows[0].user_id, "owner");

    const sameFuture = await send("future", "future", "Same future");
    const otherLink = await actions.createClaimLink({}, form({ id: sameFuture }));
    viewer = "other";
    assert.ok((await actions.requestTimeCapsuleClaim({}, form({ token: otherLink.claimToken }))).success);
    const otherClaim = (await db.query("SELECT id FROM cannot_open_until_claims WHERE moment_id = $1 AND status = 'pending'", [sameFuture])).rows[0].id;
    viewer = "owner";
    assert.match((await actions.decideTimeCapsuleClaim({}, form({ claim: otherClaim, decision: "approve" }))).error, /does not match/);
    assert.equal(await access.getReceivedTimeCapsule("other", sameFuture), null);

    const expiring = await send("future", "future", "Expiring link");
    const oldLink = await actions.createClaimLink({}, form({ id: expiring }));
    await db.query("UPDATE cannot_open_until_claims SET expires_at = clock_timestamp() - INTERVAL '1 second' WHERE moment_id = $1", [expiring]);
    viewer = "recipient";
    assert.ok((await actions.requestTimeCapsuleClaim({}, form({ token: oldLink.claimToken }))).error);
    viewer = "owner";
    const replacement = await actions.createClaimLink({}, form({ id: expiring }));
    assert.ok(replacement.claimToken);
    assert.ok((await actions.requestTimeCapsuleClaim({}, form({ token: replacement.claimToken }))).error);
    viewer = "recipient";
    assert.ok((await actions.requestTimeCapsuleClaim({}, form({ token: replacement.claimToken }))).success);
    viewer = "owner";

    const placeholder = await send("placeholder", "placeholder", "Placeholder");
    assert.ok((await actions.releaseTimeCapsule({}, form({ id: placeholder }))).success);
    const placeholderLink = await actions.createClaimLink({}, form({ id: placeholder }));
    viewer = "recipient";
    assert.ok((await actions.requestTimeCapsuleClaim({}, form({ token: placeholderLink.claimToken }))).success);
    const placeholderClaim = (await db.query("SELECT id FROM cannot_open_until_claims WHERE moment_id = $1 AND status = 'pending'", [placeholder])).rows[0].id;
    viewer = "owner";
    assert.ok((await actions.decideTimeCapsuleClaim({}, form({ claim: placeholderClaim, decision: "approve" }))).success);
    assert.equal((await access.getAccessibleTimeCapsule("recipient", placeholder)).story, "PRIVATE STORY");
    await db.exec(`UPDATE moments SET archived_at = CURRENT_TIMESTAMP WHERE id = '${placeholder}'`);
    assert.equal(await access.getAccessibleTimeCapsule("recipient", placeholder), null);
    await db.exec(`UPDATE moments SET archived_at = NULL WHERE id = '${placeholder}'`);
    assert.equal((await access.getAccessibleTimeCapsule("recipient", placeholder)).story, "PRIVATE STORY");
  } finally {
    await db.close();
  }
});

test("creation asks for an NSG recipient before content and does not present an attachment", () => {
  const load = (file, deps) => {
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, require: (name) => {
      if (!(name in deps)) throw new Error(`Unexpected import: ${name}`);
      return deps[name];
    } });
    return exports;
  };
  const types = load("lib\\moment-types.ts", {});
  const noop = async () => ({});
  const editor = load("app\\create-moment\\moment-editor.tsx", {
    "react/jsx-runtime": jsxRuntime, react: React,
    "@vercel/blob/client": { upload: noop }, "next/image": { default: () => null },
    "next/link": { default: ({ children, href }) => React.createElement("a", { href }, children) },
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/lib/moment-actions": { loadMomentDraft: noop, getFamilyPlaceholders: noop, getTimeCapsuleRecipients: noop, publishMoment: noop, saveMomentDraft: noop },
    "@/app/actions/family-tree": { searchFamilyMomentMakers: noop },
    "@/lib/moment-types": types, "@/lib/prepare-moment-photo": { prepareMomentPhoto: noop },
    "@/lib/moment-video-actions": { beginMomentVideoUpload: noop, completeMomentVideoUpload: noop },
    "@/lib/moment-video": {}, "@/lib/moment-audio-actions": { beginMomentAudioUpload: noop, completeMomentAudioUpload: noop },
    "@/lib/moment-audio": {},
  });
  const html = renderToStaticMarkup(React.createElement(editor.default, { kind: "cannot-open-until", timeCapsuleEnabled: true }));
  assert.ok(html.indexOf("Who is this for?") < html.indexOf("Your Story"));
  assert.ok(html.indexOf("Your Story") < html.indexOf("Choose When It Opens"));
  assert.match(html, /Current Moment Maker/);
  assert.match(html, /Future Moment Maker™/);
  assert.match(html, /Family Placeholder™/);
  assert.match(html, /Send Moment/);
  assert.doesNotMatch(html, /Attach to a Family Placeholder/);
});
