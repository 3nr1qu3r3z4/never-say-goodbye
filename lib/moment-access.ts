import "server-only";

import { getSql } from "@/lib/db";

export type AccessibleMoment = {
  id: string;
  title: string;
  story: string;
  tags: string;
  writtenMessage: string | null;
  photoName: string | null;
  photoData: string | null;
  videoName: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  hasPhoto: boolean;
  hasMessage: boolean;
  createdAt: string;
  voiceName: string | null;
  authorName: string;
  authorId: string;
  isAuthor: boolean;
};

async function findAccessibleMoments(viewerId: string | null, momentId: string | null, includePhoto: boolean, familyActivity = false, profileAuthorId: string | null = null) {
  const sql = getSql();
  return (await sql`
    SELECT m.id, m.title, m.story, m.tags,
           m.details_json::jsonb ->> 'writtenMessage' AS "writtenMessage",
           m.details_json::jsonb -> 'attachmentNames' ->> 'photo' AS "photoName",
           CASE WHEN ${momentId}::text IS NOT NULL AND ${includePhoto}::boolean
             THEN m.details_json::jsonb ->> 'photoData' END AS "photoData",
           m.details_json::jsonb -> 'attachmentNames' ->> 'video' AS "videoName",
           EXISTS (SELECT 1 FROM moment_videos AS mv
                   WHERE mv.moment_id = m.id AND mv.state = 'attached') AS "hasVideo",
           EXISTS (SELECT 1 FROM moment_audio AS ma
                   WHERE ma.moment_id = m.id AND ma.state = 'attached') AS "hasAudio",
           COALESCE(m.details_json::jsonb ->> 'photoData', '') <> '' AS "hasPhoto",
           BTRIM(COALESCE(m.details_json::jsonb ->> 'writtenMessage', '')) <> '' AS "hasMessage",
           m.created_at AS "createdAt",
           m.details_json::jsonb -> 'attachmentNames' ->> 'voice' AS "voiceName",
           COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS "authorName",
           m.user_id AS "authorId",
           CASE WHEN m.user_id = ${viewerId} THEN TRUE ELSE FALSE END AS "isAuthor"
    FROM moments AS m
    JOIN users AS u ON u.id = m.user_id
    WHERE m.kind = 'shared'
      AND m.access_code_hash IS NULL
      AND (${momentId}::text IS NULL OR m.id = ${momentId})
      AND (
        ${profileAuthorId}::text IS NULL
        OR (
          m.user_id = ${profileAuthorId}
          AND m.audience = 'public'
          AND u.discoverability IN ('searchable', 'public')
          AND COALESCE((to_jsonb(u) ->> 'public_shared_moments')::boolean, TRUE)
        )
      )
      AND (
        NOT ${familyActivity}::boolean
        OR (
          m.user_id <> ${viewerId}
          AND (
            EXISTS (
              SELECT 1 FROM connected_lives AS cl
              WHERE cl.status = 'accepted'
                AND ((cl.owner_user_id = m.user_id AND cl.connected_user_id = ${viewerId})
                  OR (cl.connected_user_id = m.user_id AND cl.owner_user_id = ${viewerId}))
            )
            OR EXISTS (
              SELECT 1 FROM legacy_tree_members AS author_member
              JOIN legacy_tree_members AS viewer_member ON viewer_member.tree_id = author_member.tree_id
              WHERE author_member.user_id = m.user_id AND viewer_member.user_id = ${viewerId}
            )
          )
        )
      )
      AND (
        m.user_id = ${viewerId}
        OR (
          (${momentId}::text IS NOT NULL OR ${familyActivity}::boolean OR ${profileAuthorId}::text IS NOT NULL)
          AND m.audience = 'public'
          AND u.discoverability IN ('searchable', 'public')
          AND COALESCE((to_jsonb(u) ->> 'public_shared_moments')::boolean, TRUE)
        )
        OR (
          m.audience = 'connections'
          AND EXISTS (
            SELECT 1 FROM connected_lives AS cl
            WHERE cl.status = 'accepted'
              AND (
                (cl.owner_user_id = m.user_id AND cl.connected_user_id = ${viewerId})
                OR (cl.connected_user_id = m.user_id AND cl.owner_user_id = ${viewerId})
              )
          )
        )
        OR (
          m.audience = 'family'
          AND EXISTS (
            SELECT 1
            FROM legacy_tree_members AS author_member
            JOIN legacy_tree_members AS viewer_member
              ON viewer_member.tree_id = author_member.tree_id
            WHERE author_member.user_id = m.user_id
              AND viewer_member.user_id = ${viewerId}
          )
        )
      )
    ORDER BY m.created_at DESC, m.id
    LIMIT ${familyActivity ? 5 : null}
  `) as AccessibleMoment[];
}

export async function getAccessibleMoments(viewerId: string) {
  return findAccessibleMoments(viewerId, null, false);
}

export async function getAccessibleMoment(viewerId: string | null, momentId: string, includePhoto = true) {
  const moments = await findAccessibleMoments(viewerId, momentId, includePhoto);
  return moments[0] ?? null;
}

export async function getPublicProfileSharedMoments(viewerId: string | null, authorId: string) {
  return findAccessibleMoments(viewerId, null, false, false, authorId);
}

function relativeTime(value: string, now: number) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Date unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const units = [
    { seconds: 86400 * 365, name: "year" },
    { seconds: 86400 * 30, name: "month" },
    { seconds: 86400, name: "day" },
    { seconds: 3600, name: "hour" },
    { seconds: 60, name: "minute" },
  ];
  const unit = units.find((item) => seconds >= item.seconds)!;
  const count = Math.floor(seconds / unit.seconds);
  return `${count} ${unit.name}${count === 1 ? "" : "s"} ago`;
}

export async function getRecentFamilyActivity(viewerId: string) {
  const moments = await findAccessibleMoments(viewerId, null, false, true);
  const now = Date.now();
  return moments.map((moment) => ({ ...moment, relativeTime: relativeTime(moment.createdAt, now) }));
}
