import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import { getSql } from "@/lib/db";
import { getTimeCapsuleRecipients } from "@/lib/moment-actions";
import OwnerControls, { type OwnerMoment } from "./owner-controls";

export const instant = false;

export default async function TimeCapsulePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!cannotOpenUntilEnabled(user.id)) notFound();
  const { id } = await params;
  const sql = getSql();
  const [moments, candidates, claims] = await Promise.all([
    sql`SELECT m.id, m.title, m.story, m.tags, m.updated_at AS version,
      COALESCE(m.details_json::jsonb ->> 'writtenMessage', '') AS message,
      COALESCE(m.details_json::jsonb ->> 'photoData', '') <> '' AS "hasPhoto",
      m.details_json::jsonb -> 'attachmentNames' ->> 'photo' AS "photoName",
      m.details_json::jsonb -> 'attachmentNames' ->> 'video' AS "videoName",
      m.details_json::jsonb -> 'attachmentNames' ->> 'voice' AS "audioName",
      EXISTS (SELECT 1 FROM moment_videos v WHERE v.moment_id = m.id AND v.state = 'attached') AS "hasVideo",
      EXISTS (SELECT 1 FROM moment_audio a WHERE a.moment_id = m.id AND a.state = 'attached') AS "hasAudio",
      (m.archived_at IS NOT NULL) AS archived,
      (COALESCE(s.status, 'review_required') = 'review_required') AS review,
      COALESCE(s.status = 'active' AND (s.manual_released_at IS NOT NULL OR s.unlock_at <= clock_timestamp()), false) AS released,
      s.recipient_user_id AS "recipientId", s.recipient_kind AS "recipientKind",
      COALESCE(s.intended_user_id, s.future_recipient_id, s.placeholder_recipient_id) AS "intendedId",
      COALESCE(person.display_name, future.name, placeholder.name) AS "recipientName",
      s.release_date::text AS "releaseDate", s.release_timezone AS "releaseTimezone",
      to_char(s.unlock_at AT TIME ZONE s.release_timezone, 'HH24:MI') AS "releaseTime",
      to_char(s.unlock_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "unlockAt",
      m.release_date AS "oldReleaseDate", m.occasion AS "oldOccasion"
      FROM moments m LEFT JOIN cannot_open_until_settings s ON s.moment_id = m.id
      LEFT JOIN users person ON person.id = s.intended_user_id
      LEFT JOIN future_moment_makers future ON future.id = s.future_recipient_id
      LEFT JOIN family_placeholders placeholder ON placeholder.id = s.placeholder_recipient_id
      WHERE m.id = ${id} AND m.user_id = ${user.id} AND m.kind = 'cannot-open-until'`,
    getTimeCapsuleRecipients(),
    sql`SELECT c.id, u.display_name AS name FROM cannot_open_until_claims c
      JOIN moments m ON m.id = c.moment_id JOIN users u ON u.id = c.claimant_user_id
      JOIN cannot_open_until_settings s ON s.moment_id = c.moment_id
      WHERE m.id = ${id} AND m.user_id = ${user.id} AND c.status = 'pending'
        AND c.recipient_kind = s.recipient_kind
        AND c.recipient_id = COALESCE(s.future_recipient_id, s.placeholder_recipient_id)`,
  ]);
  const moment = (moments as OwnerMoment[])[0];
  if (!moment) notFound();
  if ("error" in candidates) throw new Error(candidates.error ?? "Recipients could not be loaded.");
  return <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-3xl">
      <Link href="/cannot-open-until" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">Cannot Open Until™ Moments</Link>
      <h1 className="mt-8 break-words font-serif text-4xl text-white">{moment.title}</h1>
      <OwnerControls moment={moment} candidates={candidates} claims={claims as { id: string; name: string }[]} />
    </div>
  </main>;
}
