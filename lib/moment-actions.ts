"use server";

import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { hashSecret } from "@/lib/password";
import { validatePhoto } from "@/lib/profile-photo";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import { timeCapsuleDelayMinutes } from "@/lib/time-capsule-schedule";
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
    typeof draft.photoData === "string" &&
    typeof draft.videoUploadId === "string" &&
    (draft.audioUploadId === undefined || typeof draft.audioUploadId === "string") &&
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
    typeof draft.createRecipient === "boolean" &&
    typeof draft.familyPlaceholderId === "string" &&
    (draft.timeCapsuleRecipientKind === undefined || (typeof draft.timeCapsuleRecipientKind === "string" &&
      ["", "current", "future", "placeholder"].includes(draft.timeCapsuleRecipientKind))) &&
    (draft.timeCapsuleRecipientId === undefined || typeof draft.timeCapsuleRecipientId === "string") &&
    (draft.releaseTimezone === undefined || typeof draft.releaseTimezone === "string") &&
    (draft.timeCapsuleReleaseMode === undefined || draft.timeCapsuleReleaseMode === "date" || draft.timeCapsuleReleaseMode === "delay") &&
    (draft.releaseTime === undefined || typeof draft.releaseTime === "string") &&
    (draft.delayChoice === undefined || typeof draft.delayChoice === "string") &&
    (draft.delayAmount === undefined || typeof draft.delayAmount === "string") &&
    (draft.delayUnit === undefined || draft.delayUnit === "minutes" || draft.delayUnit === "hours" || draft.delayUnit === "days")
  );
}

function isMomentKind(value: string): value is MomentKind {
  return momentKinds.includes(value as MomentKind);
}

export async function loadMomentDraft(kind: MomentKind) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to load your saved drafts." };

  const sql = getSql();
  const [row] = (await sql`
    SELECT id, payload_json AS "payloadJson", access_code_hash AS "accessCodeHash"
    FROM drafts WHERE user_id = ${user.id} AND kind = ${kind}
    ORDER BY updated_at DESC LIMIT 1
  `) as {
    id: string;
    payloadJson: string;
    accessCodeHash: string | null;
  }[];
  if (!row) return { draft: null, accessCodeSaved: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.payloadJson);
  } catch {
    return { error: "This saved draft could not be read. You can start a new one." };
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    parsed = {
      ...parsed,
      ...(!("familyPlaceholderId" in parsed) ? { familyPlaceholderId: "" } : {}),
      ...(!("photoData" in parsed) ? { photoData: "" } : {}),
      ...(!("videoUploadId" in parsed) ? { videoUploadId: "" } : {}),
      ...(!("audioUploadId" in parsed) ? { audioUploadId: "" } : {}),
      ...(!("timeCapsuleRecipientKind" in parsed) ? { timeCapsuleRecipientKind: "" } : {}),
      ...(!("timeCapsuleRecipientId" in parsed) ? { timeCapsuleRecipientId: "" } : {}),
      ...(!("releaseTimezone" in parsed) ? { releaseTimezone: "UTC" } : {}),
      ...(!("timeCapsuleReleaseMode" in parsed) ? { timeCapsuleReleaseMode: "date" } : {}),
      ...(!("releaseTime" in parsed) ? { releaseTime: "00:00" } : {}),
      ...(!("delayChoice" in parsed) ? { delayChoice: "60" } : {}),
      ...(!("delayAmount" in parsed) ? { delayAmount: "1" } : {}),
      ...(!("delayUnit" in parsed) ? { delayUnit: "hours" } : {}),
    };
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

export async function getFamilyPlaceholders() {
  const user = await getCurrentUser();
  if (!user) return [];

  const sql = getSql();
  return (await sql`
    SELECT fp.id, fp.name, fp.relationship
    FROM family_placeholders AS fp
    JOIN legacy_tree_members AS ltm ON ltm.tree_id = fp.legacy_tree_id
    WHERE ltm.user_id = ${user.id}
    ORDER BY fp.name
  `) as { id: string; name: string; relationship: string }[];
}

export async function getTimeCapsuleRecipients() {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled(user.id)) return { error: "Cannot Open Until™ is not available." };
  const sql = getSql();
  const [current, future, placeholders] = await sql.transaction([
    sql`SELECT DISTINCT u.id, u.display_name AS name FROM connected_lives c
      JOIN users u ON u.id = CASE WHEN c.owner_user_id = ${user.id} THEN c.connected_user_id ELSE c.owner_user_id END
      WHERE c.status = 'accepted' AND (c.owner_user_id = ${user.id} OR c.connected_user_id = ${user.id})
      ORDER BY name, u.id`,
    sql`SELECT DISTINCT f.id, f.name, f.relationship FROM future_moment_makers f
      WHERE f.archived_at IS NULL AND f.status <> 'archived' AND
        (f.owner_user_id = ${user.id} OR EXISTS (
          SELECT 1 FROM legacy_tree_members t WHERE t.tree_id = f.legacy_tree_id AND t.user_id = ${user.id}))
      ORDER BY f.name, f.id`,
    sql`SELECT DISTINCT f.id, f.name, f.relationship FROM family_placeholders f
      JOIN legacy_tree_members t ON t.tree_id = f.legacy_tree_id
      WHERE t.user_id = ${user.id} AND f.death_year IS NULL AND NOT EXISTS (
        SELECT 1 FROM honored_lives h WHERE h.family_placeholder_id = f.id)
      ORDER BY f.name, f.id`,
  ]);
  return {
    current: current as { id: string; name: string }[],
    future: future as { id: string; name: string; relationship: string }[],
    placeholders: placeholders as { id: string; name: string; relationship: string }[],
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
  if (draft.photoData) {
    const photo = validatePhoto(draft.photoData);
    if (typeof photo !== "string") return photo;
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

  const sql = getSql();
  const uploadedMediaEnabled = kind === "shared" || (kind === "cannot-open-until" && cannotOpenUntilEnabled(user.id));
  if (uploadedMediaEnabled && draft.content.includes("video") && draft.videoUploadId) {
    const [video] = await sql`
      UPDATE moment_videos SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = ${draft.videoUploadId} AND user_id = ${user.id} AND state = 'ready'
      RETURNING id
    `;
    if (!video) return { error: "This video is no longer available. Please upload it again." };
  }
  if (uploadedMediaEnabled && draft.content.includes("voice") && draft.audioUploadId) {
    const [audio] = await sql`
      UPDATE moment_audio SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = ${draft.audioUploadId} AND user_id = ${user.id} AND state = 'ready'
      RETURNING id
    `;
    if (!audio) return { error: "This audio is no longer available. Please upload it again." };
  }
  const id = draftId || randomUUID();
  const [existing] = (await sql`
    SELECT kind, access_code_hash AS "accessCodeHash"
    FROM drafts WHERE id = ${id} AND user_id = ${user.id}
    LIMIT 1
  `) as { kind: MomentKind; accessCodeHash: string | null }[];
  if (draftId && (!existing || existing.kind !== kind)) {
    return { error: "This draft is no longer available. Save it again as a new draft." };
  }

  let accessCodeHash: string | null = null;
  if (kind === "personal" && draft.accessCodeRequired) {
    accessCodeHash = draft.accessCode
      ? await hashSecret(draft.accessCode)
      : (existing?.accessCodeHash ?? null);
  }

  const attachmentNames = { ...draft.attachmentNames };
  if (!draft.content.includes("photo")) delete attachmentNames.photo;
  const persistedDraft = {
    ...draft,
    attachmentNames,
    photoData: draft.content.includes("photo") ? draft.photoData : "",
    videoUploadId: uploadedMediaEnabled && draft.content.includes("video") ? draft.videoUploadId : "",
    audioUploadId: uploadedMediaEnabled && draft.content.includes("voice") ? draft.audioUploadId || "" : "",
    accessCode: "",
  };
  if (existing) {
    await sql`
      UPDATE drafts
      SET title = ${draft.title.slice(0, 200)},
          payload_json = ${JSON.stringify(persistedDraft)},
          access_code_hash = ${accessCodeHash},
          updated_at = ${new Date().toISOString()}
      WHERE id = ${id} AND user_id = ${user.id}
    `;
  } else {
    const now = new Date().toISOString();
    await sql`
      INSERT INTO drafts (id, user_id, kind, title, payload_json, access_code_hash, created_at, updated_at)
      VALUES (
        ${id}, ${user.id}, ${kind}, ${draft.title.slice(0, 200)},
        ${JSON.stringify(persistedDraft)}, ${accessCodeHash}, ${now}, ${now}
      )
    `;
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
  const uploadedMediaEnabled = kind === "shared" || (kind === "cannot-open-until" && cannotOpenUntilEnabled(user.id));
  if (!draft.title.trim() || draft.title.length > 200) {
    return { error: "Add a title of 200 characters or fewer." };
  }
  if (draft.photoData) {
    const photo = validatePhoto(draft.photoData);
    if (typeof photo !== "string") return photo;
  }
  if (draft.content.includes("photo") && !draft.photoData) {
    return { error: "Choose a photo before publishing, or deselect Photo." };
  }
  if (uploadedMediaEnabled && draft.content.includes("video") && !draft.videoUploadId) {
    return { error: "Upload a video before publishing, or deselect Video." };
  }
  if (uploadedMediaEnabled && draft.content.includes("voice") && !draft.audioUploadId) {
    return { error: "Upload audio before publishing, or deselect Audio." };
  }
  if (!draft.story.trim() && !draft.writtenMessage.trim() && !draft.content.includes("photo") &&
      !(uploadedMediaEnabled && draft.content.includes("video") && draft.videoUploadId) &&
      !(uploadedMediaEnabled && draft.content.includes("voice") && draft.audioUploadId)) {
    return { error: "Add a written story, message, photo, video, or audio before publishing." };
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
  const sendTimeCapsule = kind === "cannot-open-until" && cannotOpenUntilEnabled(user.id);
  const delayMode = sendTimeCapsule && draft.timeCapsuleReleaseMode === "delay";
  if (
    kind === "cannot-open-until" &&
    draft.releaseKind === "date" &&
    !delayMode && !draft.releaseDate
  ) {
    return { error: "Choose an open date for this moment." };
  }
  const delayMinutes = delayMode ? timeCapsuleDelayMinutes(draft.delayAmount ?? "", draft.delayUnit ?? "hours") : null;
  const parsedDate = new Date(`${draft.releaseDate}T00:00:00Z`);
  const releaseTime = draft.releaseTime ?? "00:00";
  if (sendTimeCapsule && (!draft.timeCapsuleRecipientKind || !draft.timeCapsuleRecipientId ||
      draft.releaseKind !== "date" ||
      (delayMode ? delayMinutes === null : (
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.releaseDate) || draft.releaseDate.startsWith("0000-") ||
        !Number.isFinite(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== draft.releaseDate ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(releaseTime))) ||
      !draft.releaseTimezone || draft.releaseTimezone.length > 100)) {
    return { error: "Choose a recipient, a valid open date and time or delay, and a time zone. Delays must be between 1 minute and 365 days." };
  }
  if (
    kind === "future-moment-maker" &&
    (!draft.recipientName.trim() || !draft.relationship.trim())
  ) {
    return { error: "Add the recipient’s name and relationship." };
  }

  const sql = getSql();
  if (draft.familyPlaceholderId && kind !== "cannot-open-until") {
    const [placeholder] = (await sql`
      SELECT fp.id
      FROM family_placeholders AS fp
      JOIN legacy_tree_members AS ltm ON ltm.tree_id = fp.legacy_tree_id
      WHERE fp.id = ${draft.familyPlaceholderId}
        AND ltm.user_id = ${user.id}
      LIMIT 1
    `) as { id: string }[];
    if (!placeholder) {
      return { error: "That Family Placeholder is not available in your tree." };
    }
  }

  const savedDraftRows = draftId
    ? await sql`
        SELECT kind, access_code_hash AS "accessCodeHash"
        FROM drafts WHERE id = ${draftId} AND user_id = ${user.id}
        LIMIT 1
      `
    : [];
  const savedDraft = savedDraftRows[0] as
    | { kind: MomentKind; accessCodeHash: string | null }
    | undefined;
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
  const videoUploadId = uploadedMediaEnabled && draft.content.includes("video") ? draft.videoUploadId : null;
  const audioUploadId = uploadedMediaEnabled && draft.content.includes("voice") ? draft.audioUploadId || null : null;
  const futureMakerId =
    kind === "future-moment-maker" ? randomUUID() : null;
  const attachmentNames = { ...draft.attachmentNames };
  if (!draft.content.includes("photo")) delete attachmentNames.photo;
  const details = {
    writtenMessage: draft.writtenMessage,
    attachmentNames,
    photoData: draft.content.includes("photo") ? draft.photoData : null,
    releaseKind: draft.releaseKind,
    customOccasionDate: draft.customOccasionDate,
    createRecipient: draft.createRecipient,
  };

  const statements = [];
  if (futureMakerId) {
    const [tree] = await sql`
      SELECT id FROM legacy_trees
      WHERE owner_user_id = ${user.id}
      ORDER BY created_at LIMIT 1
    ` as { id: string }[];
    statements.push(sql`
      INSERT INTO future_moment_makers
        (id, owner_user_id, legacy_tree_id, name, relationship, created_at, updated_at)
      VALUES (
        ${futureMakerId}, ${user.id}, ${tree?.id ?? null},
        ${draft.recipientName.trim()}, ${draft.relationship.trim()}, ${now}, ${now}
      )
    `);
  }
  const momentStatementIndex = statements.length;
  statements.push(sql`
      WITH eligible_video AS (
        SELECT id FROM moment_videos
        WHERE id = ${videoUploadId} AND user_id = ${user.id} AND state = 'ready'
        FOR UPDATE
      ), eligible_audio AS (
        SELECT id FROM moment_audio
        WHERE id = ${audioUploadId} AND user_id = ${user.id} AND state = 'ready'
        FOR UPDATE
      ), claimed_video AS (
        UPDATE moment_videos SET state = 'attached', moment_id = ${momentId}
        WHERE id IN (SELECT id FROM eligible_video)
          AND (${audioUploadId}::text IS NULL OR EXISTS (SELECT 1 FROM eligible_audio))
        RETURNING id
      ), claimed_audio AS (
        UPDATE moment_audio SET state = 'attached', moment_id = ${momentId}
        WHERE id IN (SELECT id FROM eligible_audio)
          AND (${videoUploadId}::text IS NULL OR EXISTS (SELECT 1 FROM eligible_video))
        RETURNING id
      )
      INSERT INTO moments (
        id, user_id, future_moment_maker_id, kind, title, story, tags,
        content_json, details_json, audience, access_code_hash, release_date,
        occasion, family_placeholder_id, created_at, updated_at
      ) SELECT
        ${momentId}, ${user.id}, ${futureMakerId}, ${kind}, ${draft.title.trim()},
        ${draft.story.trim()}, ${draft.tags.trim()}, ${JSON.stringify(draft.content)},
        ${JSON.stringify(details)}, ${kind === "shared" ? draft.audience : "private"},
        ${accessCodeHash},
        ${kind === "cannot-open-until"
          ? delayMode ? null : draft.releaseKind === "date" ? draft.releaseDate : draft.customOccasionDate || null
          : draft.customOccasionDate || null},
        ${kind === "cannot-open-until" && draft.releaseKind === "occasion"
          ? draft.occasion
          : null},
        ${kind === "cannot-open-until" ? null : draft.familyPlaceholderId || null},
        ${now}, ${now}
      WHERE (${videoUploadId}::text IS NULL OR EXISTS (SELECT 1 FROM claimed_video))
        AND (${audioUploadId}::text IS NULL OR EXISTS (SELECT 1 FROM claimed_audio))
      RETURNING id
    `);
  if (sendTimeCapsule) {
    statements.push(sql`SELECT activate_recipient_time_capsule(
      ${user.id}, ${momentId}, ${draft.timeCapsuleRecipientKind}, ${draft.timeCapsuleRecipientId},
      ${delayMode ? null : draft.releaseDate}::date, ${draft.releaseTimezone},
      ${delayMode ? null : releaseTime}::time, ${delayMinutes}::integer)`);
  }
  if (draftId) {
    statements.push(sql`
      DELETE FROM drafts WHERE id = ${draftId} AND user_id = ${user.id}
        AND EXISTS (SELECT 1 FROM moments WHERE id = ${momentId})
    `);
  }
  let results;
  try {
    results = await sql.transaction(statements);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Moment is unavailable") && (videoUploadId || audioUploadId)) {
      return { error: "An attached audio or video file is no longer available. Please upload it again." };
    }
    if (error instanceof Error && (error.message.includes("Recipient is unavailable") ||
      error.message.includes("Choose a valid future date") || error.message.includes("Choose a valid time zone") ||
      error.message.includes("Choose a valid delay") || error.message.includes("exists exactly once"))) {
      return { error: "Choose an available recipient and a valid future time and time zone. Times skipped or repeated by daylight saving are not allowed." };
    }
    throw error;
  }
  if ((videoUploadId || audioUploadId) && !results[momentStatementIndex]?.length) {
    return { error: "An attached audio or video file is no longer available. Please upload it again." };
  }

  return { success: true };
}
