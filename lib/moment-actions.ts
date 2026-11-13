"use server";

import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashSecret } from "@/lib/password";
import type {
  Audience,
  ContentKind,
  MomentDraft,
  MomentKind,
} from "@/lib/moment-types";

const momentKinds: MomentKind[] = [
  "shared",
  "personal",
  "cannot-open-until",
  "future-moment-maker",
];
const contentKinds: ContentKind[] = ["photo", "video", "voice", "written"];
const audiences: Audience[] = ["public", "connections", "family", "private"];

function isMomentDraft(value: unknown): value is MomentDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  const attachments = draft.attachmentNames;
  return (
    typeof draft.title === "string" &&
    typeof draft.story === "string" &&
    typeof draft.tags === "string" &&
    Array.isArray(draft.content) &&
    draft.content.every((kind) => contentKinds.includes(kind)) &&
    !!attachments &&
    typeof attachments === "object" &&
    Object.values(attachments).every((name) => typeof name === "string") &&
    typeof draft.writtenMessage === "string" &&
    audiences.includes(draft.audience as Audience) &&
    typeof draft.accessCodeRequired === "boolean" &&
    typeof draft.accessCode === "string" &&
    (draft.releaseKind === "date" || draft.releaseKind === "occasion") &&
    typeof draft.releaseDate === "string" &&
    typeof draft.occasion === "string" &&
    typeof draft.customOccasionDate === "string" &&
    typeof draft.recipientName === "string" &&
    typeof draft.relationship === "string" &&
    typeof draft.createRecipient === "boolean"
  );
}

function isMomentKind(value: string): value is MomentKind {
  return momentKinds.includes(value as MomentKind);
}

export async function loadMomentDraft(kind: MomentKind) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to load your saved drafts." };

  const row = db
    .prepare(
      `SELECT id, payload_json AS payloadJson, access_code_hash AS accessCodeHash
       FROM drafts WHERE user_id = ? AND kind = ?
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(user.id, kind) as
    | { id: string; payloadJson: string; accessCodeHash: string | null }
    | undefined;
  if (!row) return { draft: null, accessCodeSaved: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.payloadJson);
  } catch {
    return { error: "This saved draft could not be read. You can start a new one." };
  }
  if (!isMomentDraft(parsed)) {
    return { error: "This saved draft has invalid data. You can start a new one." };
  }

  return {
    draft: { ...parsed, accessCode: "" },
    draftId: row.id,
    accessCodeSaved: Boolean(row.accessCodeHash),
  };
}

export async function saveMomentDraft(
  kind: MomentKind,
  draftId: string,
  draft: MomentDraft,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to save this draft." };
  if (!isMomentKind(kind) || !isMomentDraft(draft)) {
    return { error: "This draft has invalid data and could not be saved." };
  }
  if (
    draft.title.length > 200 ||
    draft.story.length > 50_000 ||
    draft.tags.length > 2_000 ||
    draft.writtenMessage.length > 50_000 ||
    draft.accessCode.length > 128 ||
    draft.recipientName.length > 120 ||
    draft.relationship.length > 120
  ) {
    return { error: "Some fields are too long. Shorten them and try again." };
  }

  const id = draftId || randomUUID();
  const existing = db
    .prepare(
      "SELECT kind, access_code_hash AS accessCodeHash FROM drafts WHERE id = ? AND user_id = ?",
    )
    .get(id, user.id) as
    | { kind: MomentKind; accessCodeHash: string | null }
    | undefined;
  if (draftId && (!existing || existing.kind !== kind)) {
    return { error: "This draft is no longer available. Save it again as a new draft." };
  }

  let accessCodeHash: string | null = null;
  if (kind === "personal" && draft.accessCodeRequired) {
    accessCodeHash = draft.accessCode
      ? await hashSecret(draft.accessCode)
      : (existing?.accessCodeHash ?? null);
  }

  const persistedDraft = { ...draft, accessCode: "" };
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      `UPDATE drafts
       SET title = ?, payload_json = ?, access_code_hash = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      draft.title.slice(0, 200),
      JSON.stringify(persistedDraft),
      accessCodeHash,
      now,
      id,
      user.id,
    );
  } else {
    db.prepare(
      `INSERT INTO drafts (id, user_id, kind, title, payload_json, access_code_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      user.id,
      kind,
      draft.title.slice(0, 200),
      JSON.stringify(persistedDraft),
      accessCodeHash,
      now,
      now,
    );
  }
  return { draftId: id, accessCodeSaved: Boolean(accessCodeHash) };
}

export async function publishMoment(
  kind: MomentKind,
  draftId: string,
  draft: MomentDraft,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to publish this moment." };
  if (!isMomentKind(kind) || !isMomentDraft(draft)) {
    return { error: "This moment has invalid data and could not be published." };
  }
  if (!draft.title.trim() || draft.title.length > 200) {
    return { error: "Add a title of 200 characters or fewer." };
  }
  if (!draft.story.trim() && !draft.writtenMessage.trim()) {
    return { error: "Add a written story or message before publishing." };
  }
  if (
    draft.story.length > 50_000 ||
    draft.tags.length > 2_000 ||
    draft.writtenMessage.length > 50_000
  ) {
    return { error: "Some fields are too long. Shorten them and try again." };
  }
  if (
    kind === "personal" &&
    draft.accessCodeRequired &&
    (!draft.accessCode && !draftId)
  ) {
    return { error: "Add an access code before publishing this protected moment." };
  }
  if (
    kind === "cannot-open-until" &&
    draft.releaseKind === "date" &&
    !draft.releaseDate
  ) {
    return { error: "Choose an open date for this moment." };
  }
  if (
    kind === "future-moment-maker" &&
    (!draft.recipientName.trim() || !draft.relationship.trim())
  ) {
    return { error: "Add the recipient’s name and relationship." };
  }

  const savedDraft = draftId
    ? (db
        .prepare(
            "SELECT kind, access_code_hash AS accessCodeHash FROM drafts WHERE id = ? AND user_id = ?",
        )
          .get(draftId, user.id) as
          | { kind: MomentKind; accessCodeHash: string | null }
          | undefined)
    : undefined;
  if (draftId && (!savedDraft || savedDraft.kind !== kind)) {
    return { error: "This draft is no longer available. Save it and try again." };
  }

  let accessCodeHash: string | null = null;
  if (kind === "personal" && draft.accessCodeRequired) {
    accessCodeHash = draft.accessCode
      ? await hashSecret(draft.accessCode)
      : (savedDraft?.accessCodeHash ?? null);
    if (!accessCodeHash) {
      return { error: "Add an access code before publishing this protected moment." };
    }
  }

  const now = new Date().toISOString();
  const momentId = randomUUID();
  const futureMakerId =
    kind === "future-moment-maker" ? randomUUID() : null;
  const details = {
    writtenMessage: draft.writtenMessage,
    attachmentNames: draft.attachmentNames,
    releaseKind: draft.releaseKind,
    customOccasionDate: draft.customOccasionDate,
    createRecipient: draft.createRecipient,
  };

  db.transaction(() => {
    if (futureMakerId) {
      const tree = db
        .prepare(
          "SELECT id FROM legacy_trees WHERE owner_user_id = ? ORDER BY created_at LIMIT 1",
        )
        .get(user.id) as { id: string } | undefined;
      db.prepare(
        `INSERT INTO future_moment_makers
         (id, owner_user_id, legacy_tree_id, name, relationship, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        futureMakerId,
        user.id,
        tree?.id ?? null,
        draft.recipientName.trim(),
        draft.relationship.trim(),
        now,
        now,
      );
    }

    db.prepare(
      `INSERT INTO moments (
        id, user_id, future_moment_maker_id, kind, title, story, tags,
        content_json, details_json, audience, access_code_hash, release_date,
        occasion, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      momentId,
      user.id,
      futureMakerId,
      kind,
      draft.title.trim(),
      draft.story.trim(),
      draft.tags.trim(),
      JSON.stringify(draft.content),
      JSON.stringify(details),
      kind === "shared" ? draft.audience : "private",
      accessCodeHash,
      kind === "cannot-open-until" && draft.releaseKind === "date"
        ? draft.releaseDate
        : draft.customOccasionDate || null,
      kind === "cannot-open-until" && draft.releaseKind === "occasion"
        ? draft.occasion
        : null,
      now,
      now,
    );
    if (draftId) {
      db.prepare("DELETE FROM drafts WHERE id = ? AND user_id = ?").run(
        draftId,
        user.id,
      );
    }
  })();

  return { success: true };
}
