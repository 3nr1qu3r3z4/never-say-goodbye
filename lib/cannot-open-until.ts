import "server-only";

import { getSql } from "@/lib/db";
import type { AccessibleMoment } from "@/lib/moment-access";

export function cannotOpenUntilEnabled() {
  return process.env.CANNOT_OPEN_UNTIL_ENABLED === "true";
}

export async function getAccessibleTimeCapsule(viewerId: string | null, momentId: string): Promise<AccessibleMoment | null> {
  if (!cannotOpenUntilEnabled() || !viewerId) return null;
  const sql = getSql();
  // Wait for in-flight edits, then read from a fresh statement snapshot.
  const [, moments] = await sql.transaction([
    sql`SELECT s.moment_id FROM cannot_open_until_settings s
      JOIN moments m ON m.id = s.moment_id
      WHERE m.id = ${momentId} AND (m.user_id = ${viewerId} OR s.recipient_user_id = ${viewerId})
      FOR SHARE OF s`,
    sql`
    SELECT m.id, m.title, m.story, m.tags,
           m.details_json::jsonb ->> 'writtenMessage' AS "writtenMessage",
           m.details_json::jsonb -> 'attachmentNames' ->> 'photo' AS "photoName",
           m.details_json::jsonb ->> 'photoData' AS "photoData",
           m.details_json::jsonb -> 'attachmentNames' ->> 'video' AS "videoName",
           m.details_json::jsonb -> 'attachmentNames' ->> 'voice' AS "voiceName",
           EXISTS (SELECT 1 FROM moment_videos v WHERE v.moment_id = m.id AND v.state = 'attached') AS "hasVideo",
           EXISTS (SELECT 1 FROM moment_audio a WHERE a.moment_id = m.id AND a.state = 'attached') AS "hasAudio",
           COALESCE(m.details_json::jsonb ->> 'photoData', '') <> '' AS "hasPhoto",
           BTRIM(COALESCE(m.details_json::jsonb ->> 'writtenMessage', '')) <> '' AS "hasMessage",
           m.created_at AS "createdAt",
           COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS "authorName",
           m.user_id AS "authorId", (m.user_id = ${viewerId}) AS "isAuthor"
    FROM moments m JOIN users u ON u.id = m.user_id
    LEFT JOIN cannot_open_until_settings s ON s.moment_id = m.id
    WHERE m.id = ${momentId} AND m.kind = 'cannot-open-until'
      AND (
        m.user_id = ${viewerId}
        OR (
          m.archived_at IS NULL AND s.status = 'active' AND s.recipient_user_id = ${viewerId}
          AND (s.manual_released_at IS NOT NULL OR s.unlock_at <= clock_timestamp())
          AND EXISTS (
            SELECT 1 FROM connected_lives c WHERE c.id = s.connection_id AND c.status = 'accepted'
              AND ((c.owner_user_id = m.user_id AND c.connected_user_id = ${viewerId})
                OR (c.connected_user_id = m.user_id AND c.owner_user_id = ${viewerId}))
          )
        )
      )
  `,
  ], { isolationLevel: "ReadCommitted" });
  const [moment] = moments as AccessibleMoment[];
  return moment ?? null;
}

export type TimeCapsuleListing = {
  id: string;
  title: string;
  sender: string;
  releaseDate: string;
  releaseTimezone: string;
  released: boolean;
};

async function findReceivedTimeCapsules(viewerId: string, momentId: string | null): Promise<TimeCapsuleListing[]> {
  if (!cannotOpenUntilEnabled()) return [];
  const sql = getSql();
  const [, moments] = await sql.transaction([
    sql`SELECT s.moment_id FROM cannot_open_until_settings s
      WHERE s.status = 'active' AND s.recipient_user_id = ${viewerId}
        AND (${momentId}::text IS NULL OR s.moment_id = ${momentId})
      ORDER BY s.moment_id FOR SHARE OF s`,
    sql`
    SELECT m.id, m.title, COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS sender,
           s.release_date::text AS "releaseDate", s.release_timezone AS "releaseTimezone",
           (s.manual_released_at IS NOT NULL OR s.unlock_at <= clock_timestamp()) AS released
    FROM cannot_open_until_settings s
    JOIN moments m ON m.id = s.moment_id
    JOIN users u ON u.id = m.user_id
    JOIN connected_lives c ON c.id = s.connection_id AND c.status = 'accepted'
      AND ((c.owner_user_id = m.user_id AND c.connected_user_id = ${viewerId})
        OR (c.connected_user_id = m.user_id AND c.owner_user_id = ${viewerId}))
    WHERE m.kind = 'cannot-open-until' AND m.archived_at IS NULL
      AND s.status = 'active' AND s.recipient_user_id = ${viewerId}
      AND (${momentId}::text IS NULL OR m.id = ${momentId})
    ORDER BY s.unlock_at, m.id
  `,
  ], { isolationLevel: "ReadCommitted" });
  return moments as TimeCapsuleListing[];
}

export async function getReceivedTimeCapsules(viewerId: string): Promise<TimeCapsuleListing[]> {
  return findReceivedTimeCapsules(viewerId, null);
}

export async function getReceivedTimeCapsule(viewerId: string, momentId: string): Promise<TimeCapsuleListing | null> {
  const moments = await findReceivedTimeCapsules(viewerId, momentId);
  return moments[0] ?? null;
}
