import "server-only";

import { getSql } from "@/lib/db";

export type SuccessorAssignment = {
  successorId: string | null;
  name: string | null;
  inactivityDays: 30 | 60 | 90;
  valid: boolean;
};

export async function canManageSuccessor(userId: string) {
  const sql = getSql();
  const [row] = await sql`SELECT successor_can_manage(${userId}) AS eligible` as { eligible: boolean }[];
  return row.eligible;
}

export async function getOwnSuccessor(userId: string): Promise<SuccessorAssignment | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT a.successor_user_id AS "successorId", u.display_name AS name,
           a.inactivity_days AS "inactivityDays",
           (u.id IS NOT NULL AND u.membership <> 'legacy-forever') AS valid
    FROM successor_assignments a LEFT JOIN users u ON u.id = a.successor_user_id
    WHERE a.owner_user_id = ${userId}
  ` as SuccessorAssignment[];
  return row ?? null;
}

export async function hasTransferredSuccessor(userId: string) {
  const sql = getSql();
  const [row] = await sql`
    SELECT EXISTS (SELECT 1 FROM successor_transfers WHERE original_owner_user_id = ${userId}) AS transferred
  ` as { transferred: boolean }[];
  return row.transferred;
}

export async function getSuccessorCandidates(userId: string, search: string) {
  const sql = getSql();
  return await sql`
    SELECT id, display_name AS name, username
    FROM users
    WHERE successor_can_select(${userId}, id)
      AND (${search} = '' OR display_name ILIKE ${`%${search}%`} OR username ILIKE ${`%${search}%`})
    ORDER BY display_name, id LIMIT 50
  ` as { id: string; name: string; username: string }[];
}
