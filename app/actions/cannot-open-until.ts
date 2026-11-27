"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import { getSql } from "@/lib/db";
import { validatePhoto } from "@/lib/profile-photo";

export type TimeCapsuleActionState = { error?: string; success?: string; claimToken?: string };

function value(form: FormData, name: string) {
  const field = form.get(name);
  return typeof field === "string" ? field.trim() : "";
}

function refresh() {
  for (const path of ["/dashboard", "/my-profile/membership/content", "/cannot-open-until", "/cannot-open-until/inbox"]) {
    revalidatePath(path);
  }
  revalidatePath("/cannot-open-until/[id]", "page");
  revalidatePath("/cannot-open-until/inbox/[id]", "page");
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export async function activateTimeCapsule(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Cannot Open Until™ is not available." };
  const id = value(form, "id");
  const selected = value(form, "recipient");
  const separator = selected.indexOf(":");
  const kind = separator < 0 ? "current" : selected.slice(0, separator);
  const recipient = separator < 0 ? selected : selected.slice(separator + 1);
  const date = value(form, "date");
  const timezone = value(form, "timezone");
  if (!id || !recipient || !["current", "future", "placeholder"].includes(kind) ||
      (kind === "current" && recipient === user.id) || !validDate(date) || !timezone || timezone.length > 100) {
    return { error: "Choose a recipient, a valid date and a time zone." };
  }
  const sql = getSql();
  try {
    await sql`SELECT activate_recipient_time_capsule(${user.id}, ${id}, ${kind}, ${recipient}, ${date}::date, ${timezone})`;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Recipient is unavailable") ||
      error.message.includes("Moment is unavailable") || error.message.includes("Choose a valid future date") ||
      error.message.includes("read-only") || error.message.includes("recipients cannot be changed"))) {
      return { error: "Choose an available recipient and a valid future date. Released Moments cannot be rescheduled." };
    }
    throw error;
  }
  refresh();
  return { success: "The schedule is active." };
}

export async function reassignTimeCapsule(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Cannot Open Until™ is not available." };
  const id = value(form, "id");
  if (!id) return { error: "Choose an available Moment." };
  const sql = getSql();
  const rows = await sql`
    WITH eligible AS MATERIALIZED (
      SELECT s.moment_id, CASE WHEN s.recipient_kind = 'current' THEN s.intended_user_id ELSE (
        SELECT c.claimant_user_id FROM cannot_open_until_claims c
        WHERE c.moment_id = s.moment_id AND c.recipient_kind = s.recipient_kind AND c.status = 'approved'
          AND c.recipient_id = COALESCE(s.future_recipient_id, s.placeholder_recipient_id)
        LIMIT 1) END AS recipient
      FROM cannot_open_until_settings s JOIN moments m ON m.id = s.moment_id
      WHERE s.moment_id = ${id} AND m.user_id = ${user.id} AND s.status = 'active'
      FOR UPDATE OF s
    )
    UPDATE cannot_open_until_settings s
    SET recipient_user_id = eligible.recipient, connection_id = NULL, updated_at = clock_timestamp()
    FROM eligible WHERE s.moment_id = eligible.moment_id AND eligible.recipient IS NOT NULL
    RETURNING s.moment_id
  `;
  if (!rows.length) return { error: "The original recipient is unavailable or has not been approved." };
  refresh();
  return { success: "The intended recipient has been re-authorized." };
}

export async function createClaimLink(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Cannot Open Until™ is not available." };
  const id = value(form, "id");
  if (!id) return { error: "Choose an available Moment." };
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  try {
    await getSql()`SELECT create_time_capsule_claim(${user.id}, ${id}, ${randomUUID()}, ${hash})`;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Claim is unavailable")) {
      return { error: "A claim is pending, already approved, or no longer available." };
    }
    throw error;
  }
  return { success: "Share this private link with the intended recipient. It expires in seven days.", claimToken: token };
}

export async function requestTimeCapsuleClaim(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Sign in to request this claim." };
  const token = value(form, "token");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: "This claim link is invalid or expired." };
  const hash = createHash("sha256").update(token).digest("hex");
  const rows = await getSql()`
    UPDATE cannot_open_until_claims c SET status = 'pending', claimant_user_id = ${user.id}, requested_at = clock_timestamp()
    FROM cannot_open_until_settings s, moments m
    WHERE c.token_hash = ${hash} AND c.status = 'open' AND c.expires_at > clock_timestamp()
      AND s.moment_id = c.moment_id AND s.status = 'active' AND m.id = s.moment_id
      AND m.user_id <> ${user.id} AND s.recipient_user_id IS NULL
      AND c.recipient_kind = s.recipient_kind
      AND c.recipient_id = COALESCE(s.future_recipient_id, s.placeholder_recipient_id)
    RETURNING c.id`;
  if (!rows.length) return { error: "This claim link is invalid or expired." };
  refresh();
  return { success: "Your request was sent. The Moment owner must confirm your identity before access is granted." };
}

export async function decideTimeCapsuleClaim(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Cannot Open Until™ is not available." };
  const claim = value(form, "claim");
  const decision = value(form, "decision");
  if (!claim || !["approve", "decline"].includes(decision)) return { error: "Choose a valid claim decision." };
  try {
    await getSql()`SELECT decide_time_capsule_claim(${user.id}, ${claim}, ${decision === "approve"})`;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Claim is unavailable")) return { error: "This claim is no longer available." };
    if (error instanceof Error && error.message.includes("Claim does not match")) return { error: "This claim does not match the confirmed recipient. Review it before granting access." };
    throw error;
  }
  refresh();
  return { success: decision === "approve" ? "The intended recipient was approved." : "The claim was declined." };
}

export async function releaseTimeCapsule(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Cannot Open Until™ is not available." };
  const id = value(form, "id");
  if (!id) return { error: "Choose an available Moment." };
  const sql = getSql();
  const rows = await sql`
    UPDATE cannot_open_until_settings s SET manual_released_at = clock_timestamp(), updated_at = clock_timestamp()
    FROM moments m
    WHERE s.moment_id = m.id AND m.id = ${id} AND m.user_id = ${user.id}
      AND m.kind = 'cannot-open-until' AND s.status = 'active'
      AND s.manual_released_at IS NULL AND s.unlock_at > clock_timestamp()
    RETURNING s.moment_id
  `;
  if (!rows.length) {
    const [existing] = await sql`
      SELECT s.moment_id FROM cannot_open_until_settings s JOIN moments m ON m.id = s.moment_id
      WHERE m.id = ${id} AND m.user_id = ${user.id} AND m.kind = 'cannot-open-until' AND s.status = 'active'
        AND (s.manual_released_at IS NOT NULL OR s.unlock_at <= clock_timestamp())
    `;
    if (!existing) return { error: "This Moment is not available for release." };
    return { success: "This Moment has already been released." };
  }
  refresh();
  return { success: "The Moment has been released." };
}

export async function deleteTimeCapsule(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Cannot Open Until™ is not available." };
  const id = value(form, "id");
  if (!id) return { error: "Choose an available Moment." };
  const sql = getSql();
  const rows = await sql`
    DELETE FROM moments WHERE id = ${id} AND user_id = ${user.id} AND kind = 'cannot-open-until'
    RETURNING id
  `;
  if (!rows.length) return { error: "This Moment is no longer available." };
  refresh();
  return { success: "The Moment was deleted." };
}

export async function saveTimeCapsuleContent(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Cannot Open Until™ is not available." };
  const id = value(form, "id");
  const version = value(form, "version");
  const title = value(form, "title");
  const story = value(form, "story");
  const tags = value(form, "tags");
  const message = value(form, "message");
  const photoAction = value(form, "photoAction");
  const videoAction = value(form, "videoAction");
  const audioAction = value(form, "audioAction");
  const photoData = value(form, "photoData");
  const photoName = value(form, "photoName");
  const videoId = value(form, "videoId");
  const audioId = value(form, "audioId");
  if (!id || !version || !title || title.length > 200 || story.length > 50_000 ||
      tags.length > 2_000 || message.length > 50_000 || photoName.length > 255 ||
      ![photoAction, videoAction, audioAction].every((action) => ["keep", "replace", "remove"].includes(action)) ||
      (videoAction === "replace" && !videoId) || (audioAction === "replace" && !audioId)) {
    return { error: "Check the content and selected files, then try again." };
  }
  if (photoAction === "replace") {
    const photo = validatePhoto(photoData);
    if (typeof photo !== "string") return photo;
  }
  const sql = getSql();
  let result: string;
  try {
    const [row] = await sql`
      SELECT save_cannot_open_until_content(
        ${user.id}, ${id}, ${version}, ${title}, ${story}, ${tags}, ${message},
        ${photoAction}, ${photoData}, ${photoName}, ${videoAction}, ${videoId}, ${audioAction}, ${audioId}
      ) AS result
    ` as { result: string }[];
    result = row.result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("read-only")) {
      return { error: "This Moment was released while you were editing. Its contents are now read-only." };
    }
    throw error;
  }
  const errors: Record<string, string> = {
    not_found: "This Moment is no longer available.",
    released: "This Moment has been released and is read-only.",
    conflict: "This Moment changed elsewhere. Reload it before saving.",
    invalid: "Check the selected files and try again.",
    video_unavailable: "The video is no longer available. Upload it again.",
    audio_unavailable: "The audio is no longer available. Upload it again.",
  };
  if (result !== "saved") return { error: errors[result] ?? "The Moment could not be saved." };
  refresh();
  return { success: "Changes saved." };
}
