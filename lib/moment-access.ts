import "server-only";

import { getSql } from "@/lib/db";

export type AccessibleMoment = {
  id: string;
  title: string;
  story: string;
  writtenMessage: string | null;
  authorName: string;
};

async function findAccessibleMoments(viewerId: string, momentId: string | null) {
  const sql = getSql();
  return (await sql`
    SELECT m.id, m.title, m.story,
           m.details_json::jsonb ->> 'writtenMessage' AS "writtenMessage",
           COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS "authorName"
    FROM moments AS m
    JOIN users AS u ON u.id = m.user_id
    WHERE m.kind = 'shared'
      AND m.audience IN ('connections', 'family')
      AND m.access_code_hash IS NULL
      AND (${momentId}::text IS NULL OR m.id = ${momentId})
      AND (
        m.user_id = ${viewerId}
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
  `) as AccessibleMoment[];
}

export async function getAccessibleMoments(viewerId: string) {
  return findAccessibleMoments(viewerId, null);
}

export async function getAccessibleMoment(viewerId: string, momentId: string) {
  const moments = await findAccessibleMoments(viewerId, momentId);
  return moments[0] ?? null;
}
