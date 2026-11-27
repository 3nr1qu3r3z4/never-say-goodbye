import "server-only";

import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export function successorPreviewEnabled(userId: string) {
  if (process.env.SUCCESSOR_ASSIGNMENT_ENABLED !== "true") return false;
  return (process.env.SUCCESSOR_ASSIGNMENT_PREVIEW_USER_IDS ?? "")
    .split(",").some((id) => id.trim() === userId && id.trim() !== "");
}

export type SuccessorDesignation = {
  name: string;
  available: boolean;
};

async function previewOwner() {
  const user = await requireUser();
  if (!successorPreviewEnabled(user.id)) throw new Error("Successor Assignment is not available.");
  return user;
}

export async function getOwnSuccessor(): Promise<SuccessorDesignation | null> {
  const user = await previewOwner();
  const sql = getSql();
  const [designation] = await sql`
    SELECT COALESCE(NULLIF(BTRIM(person.display_name), ''), s.successor_name) AS name,
           (person.id IS NOT NULL AND EXISTS (
             SELECT 1 FROM connected_lives cl
             WHERE cl.status = 'accepted'
               AND ((cl.owner_user_id = ${user.id} AND cl.connected_user_id = person.id)
                 OR (cl.connected_user_id = ${user.id} AND cl.owner_user_id = person.id))
           )) AS available
    FROM legacy_successors s
    LEFT JOIN users person ON person.id = s.successor_user_id
    WHERE s.owner_user_id = ${user.id} AND s.status = 'designated'
  ` as SuccessorDesignation[];
  return designation ?? null;
}

export async function getOwnSuccessorCandidates(): Promise<{ id: string; name: string }[]> {
  const user = await previewOwner();
  const sql = getSql();
  return await sql`
    SELECT DISTINCT person.id,
           COALESCE(NULLIF(BTRIM(person.display_name), ''), 'Moment Maker') AS name
    FROM connected_lives cl
    JOIN users person ON person.id = CASE WHEN cl.owner_user_id = ${user.id}
      THEN cl.connected_user_id ELSE cl.owner_user_id END
    WHERE cl.status = 'accepted' AND person.id <> ${user.id}
      AND (cl.owner_user_id = ${user.id} OR cl.connected_user_id = ${user.id})
    ORDER BY name, person.id
  ` as { id: string; name: string }[];
}
