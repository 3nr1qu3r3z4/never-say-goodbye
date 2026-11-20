"use server";

import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { frequentVisitsEnabled } from "@/lib/frequent-visits";

export async function recordProfileVisit(profileId: string): Promise<void> {
  if (!frequentVisitsEnabled()) return;
  if (typeof profileId !== "string" || profileId.length < 1 || profileId.length > 200) {
    throw new Error("Invalid profile.");
  }
  const viewer = await getCurrentUser();
  if (!viewer || viewer.id === profileId) {
    throw new Error("A signed-in viewer and another profile are required.");
  }
  const sql = getSql();
  const [result] = await sql`
    WITH eligible AS (
      SELECT id FROM users
      WHERE id = ${profileId} AND discoverability IN ('searchable', 'public')
        AND account_status <> 'frozen'
    ), recorded AS (
      INSERT INTO profile_visits (viewer_user_id, profile_user_id)
      SELECT ${viewer.id}, id FROM eligible
      ON CONFLICT (viewer_user_id, profile_user_id, visit_date) DO NOTHING
    )
    SELECT EXISTS (SELECT 1 FROM eligible) AS allowed
  `;
  if (!result.allowed) throw new Error("Profile unavailable.");
}
