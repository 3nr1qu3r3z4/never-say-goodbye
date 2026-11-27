import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import { getSql } from "@/lib/db";
import OwnerControls, { type OwnerMoment } from "./owner-controls";

export const instant = false;

export default async function TimeCapsulePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!cannotOpenUntilEnabled()) notFound();
  const { id } = await params;
  const sql = getSql();
  const [moments, candidates] = await Promise.all([
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
      s.recipient_user_id AS "recipientId", person.display_name AS "recipientName",
      s.release_date::text AS "releaseDate", s.release_timezone AS "releaseTimezone",
      m.release_date AS "oldReleaseDate", m.occasion AS "oldOccasion"
      FROM moments m LEFT JOIN cannot_open_until_settings s ON s.moment_id = m.id
      LEFT JOIN users person ON person.id = s.recipient_user_id
      WHERE m.id = ${id} AND m.user_id = ${user.id} AND m.kind = 'cannot-open-until'`,
    sql`SELECT DISTINCT person.id, COALESCE(NULLIF(BTRIM(person.display_name), ''), 'Moment Maker') AS name
      FROM connected_lives cl JOIN users person ON person.id = CASE WHEN cl.owner_user_id = ${user.id} THEN cl.connected_user_id ELSE cl.owner_user_id END
      WHERE cl.status = 'accepted' AND person.id <> ${user.id}
        AND (cl.owner_user_id = ${user.id} OR cl.connected_user_id = ${user.id})
      ORDER BY name, person.id`,
  ]);
  const moment = (moments as OwnerMoment[])[0];
  if (!moment) notFound();
  return <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-3xl">
      <Link href="/cannot-open-until" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">Cannot Open Until™ Moments</Link>
      <h1 className="mt-8 break-words font-serif text-4xl text-white">{moment.title}</h1>
      <OwnerControls moment={moment} candidates={candidates as { id: string; name: string }[]} />
    </div>
  </main>;
}
