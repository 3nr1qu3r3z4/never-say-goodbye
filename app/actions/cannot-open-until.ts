"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import { getSql } from "@/lib/db";
import { validatePhoto } from "@/lib/profile-photo";

export type TimeCapsuleActionState = { error?: string; success?: string };

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
  const recipient = value(form, "recipient");
  const date = value(form, "date");
  const timezone = value(form, "timezone");
  if (!id || !recipient || recipient === user.id || !validDate(date) || !timezone || timezone.length > 100) {
    return { error: "Choose an accepted connection, a valid date and a time zone." };
  }
  const sql = getSql();
  const rows = await sql`
    WITH eligible AS MATERIALIZED (
      SELECT c.id FROM connected_lives c
      WHERE c.status = 'accepted'
        AND ((c.owner_user_id = ${user.id} AND c.connected_user_id = ${recipient})
          OR (c.connected_user_id = ${user.id} AND c.owner_user_id = ${recipient}))
      ORDER BY c.id LIMIT 1 FOR UPDATE
    ), instant AS MATERIALIZED (
      SELECT MIN(t.instant) AS unlock_at
      FROM pg_timezone_names z
      CROSS JOIN LATERAL generate_series(
        ${date}::date::timestamp AT TIME ZONE 'UTC' - INTERVAL '15 hours',
        ${date}::date::timestamp AT TIME ZONE 'UTC' + INTERVAL '36 hours',
        INTERVAL '1 minute'
      ) AS t(instant)
      WHERE z.name = ${timezone} AND (t.instant AT TIME ZONE z.name)::date = ${date}::date
    )
    INSERT INTO cannot_open_until_settings
      (moment_id, status, recipient_user_id, connection_id, release_date, release_timezone, unlock_at, reviewed_at)
    SELECT m.id, 'active', ${recipient}, eligible.id, ${date}::date, ${timezone}, instant.unlock_at, clock_timestamp()
    FROM moments m CROSS JOIN eligible CROSS JOIN instant
    WHERE m.id = ${id} AND m.user_id = ${user.id} AND m.kind = 'cannot-open-until'
      AND instant.unlock_at > clock_timestamp()
    ON CONFLICT (moment_id) DO UPDATE SET status = 'active',
      recipient_user_id = EXCLUDED.recipient_user_id, connection_id = EXCLUDED.connection_id,
      release_date = EXCLUDED.release_date, release_timezone = EXCLUDED.release_timezone,
      unlock_at = EXCLUDED.unlock_at, reviewed_at = EXCLUDED.reviewed_at, updated_at = clock_timestamp()
    WHERE cannot_open_until_settings.status = 'review_required'
       OR (cannot_open_until_settings.manual_released_at IS NULL
           AND cannot_open_until_settings.unlock_at > clock_timestamp())
    RETURNING moment_id
  `;
  if (!rows.length) return { error: "Choose an accepted connection and a valid future date. Released Moments cannot be rescheduled." };
  refresh();
  return { success: "The schedule is active." };
}

export async function reassignTimeCapsule(_state: TimeCapsuleActionState, form: FormData): Promise<TimeCapsuleActionState> {
  const user = await getCurrentUser();
  if (!user || !cannotOpenUntilEnabled()) return { error: "Cannot Open Until™ is not available." };
  const id = value(form, "id");
  const recipient = value(form, "recipient");
  if (!id || !recipient || recipient === user.id) return { error: "Choose an accepted connection." };
  const sql = getSql();
  const rows = await sql`
    WITH eligible AS MATERIALIZED (
      SELECT c.id FROM connected_lives c WHERE c.status = 'accepted'
        AND ((c.owner_user_id = ${user.id} AND c.connected_user_id = ${recipient})
          OR (c.connected_user_id = ${user.id} AND c.owner_user_id = ${recipient}))
      ORDER BY c.id LIMIT 1 FOR UPDATE
    )
    UPDATE cannot_open_until_settings s
    SET recipient_user_id = ${recipient}, connection_id = eligible.id, updated_at = clock_timestamp()
    FROM moments m, eligible
    WHERE s.moment_id = m.id AND m.id = ${id} AND m.user_id = ${user.id}
      AND m.kind = 'cannot-open-until' AND s.status = 'active'
    RETURNING s.moment_id
  `;
  if (!rows.length) return { error: "The Moment or accepted connection is no longer available." };
  refresh();
  return { success: "Recipient updated." };
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
