import "server-only";

import { getSql } from "@/lib/db";

export type LegacyProfile = {
  displayName: string;
  bio: string;
  profilePhoto: string | null;
  discoverability: "private" | "searchable" | "public";
};

export async function getLegacyProfile(userId: string): Promise<LegacyProfile> {
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(NULLIF(BTRIM(display_name), ''),
                    NULLIF(BTRIM(first_name || ' ' || last_name), ''), 'Moment Maker') AS "displayName",
           COALESCE(bio, '') AS bio,
           NULLIF(profile_photo_data, '') AS "profilePhoto",
           discoverability
    FROM users WHERE id = ${userId}
  ` as LegacyProfile[];
  if (!rows[0]) throw new Error("The signed-in user's profile could not be found.");
  return rows[0];
}

export async function getLegacyConnections(userId: string): Promise<{ id: string; displayName: string }[]> {
  const sql = getSql();
  return await sql`
    SELECT cl.id,
           CASE WHEN cl.owner_user_id = ${userId}
             THEN COALESCE(NULLIF(BTRIM(recipient.display_name), ''), cl.display_name)
             ELSE COALESCE(NULLIF(BTRIM(requester.display_name), ''), cl.display_name)
           END AS "displayName"
    FROM connected_lives cl
    LEFT JOIN users requester ON requester.id = cl.owner_user_id
    LEFT JOIN users recipient ON recipient.id = cl.connected_user_id
    WHERE (cl.owner_user_id = ${userId} OR cl.connected_user_id = ${userId})
      AND cl.status = 'accepted'
    ORDER BY cl.updated_at DESC, cl.created_at DESC, cl.id
    LIMIT 4
  ` as { id: string; displayName: string }[];
}
