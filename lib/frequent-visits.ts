import "server-only";

import { getSql } from "@/lib/db";
import { relationshipForViewer, relationshipLabel } from "@/lib/connected-lives";

const sectionLimit = 8;

type ProfileRow = {
  id: string;
  displayName: string;
  profilePhoto: string | null;
  relationshipType: string | null;
  relationshipSubjectId: string | null;
};

export type NavigationProfile = {
  id: string;
  displayName: string;
  profilePhoto: string | null;
  relationship: string;
};

export function frequentVisitsEnabled(): boolean {
  if (process.env.FREQUENT_VISITS_ENABLED !== "true") return false;
  if (!process.env.CRON_SECRET) {
    throw new Error("FREQUENT_VISITS_ENABLED requires CRON_SECRET for visit retention.");
  }
  return true;
}

function toNavigationProfiles(rows: ProfileRow[], viewerId: string): NavigationProfile[] {
  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    profilePhoto: row.profilePhoto,
    relationship: row.relationshipType
      ? relationshipLabel(relationshipForViewer(row.relationshipType, row.relationshipSubjectId, viewerId))
      : "Moment Maker",
  })).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
}

export async function getFrequentVisitSections(viewerId: string): Promise<{
  visited: NavigationProfile[];
  suggested: NavigationProfile[];
}> {
  const sql = getSql();
  const visited = (await sql`
    SELECT u.id,
           COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS "displayName",
           CASE WHEN u.public_profile_photo THEN NULLIF(u.profile_photo_data, '') ELSE NULL END AS "profilePhoto",
           connection.relationship_type AS "relationshipType",
           connection.relationship_subject_user_id AS "relationshipSubjectId"
    FROM profile_visits AS visit
    JOIN users AS u ON u.id = visit.profile_user_id
    LEFT JOIN LATERAL (
      SELECT cl.relationship_type, cl.relationship_subject_user_id
      FROM connected_lives AS cl
      WHERE cl.status = 'accepted'
        AND ((cl.owner_user_id = ${viewerId} AND cl.connected_user_id = u.id)
          OR (cl.connected_user_id = ${viewerId} AND cl.owner_user_id = u.id))
      ORDER BY cl.accepted_at DESC NULLS LAST, cl.id
      LIMIT 1
    ) AS connection ON TRUE
    WHERE visit.viewer_user_id = ${viewerId}
      AND visit.visit_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 89
      AND visit.visit_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      AND u.discoverability IN ('searchable', 'public')
      AND u.account_status <> 'frozen'
    GROUP BY u.id, connection.relationship_type, connection.relationship_subject_user_id
    ORDER BY COUNT(*) DESC, MAX(visit.visit_date) DESC, u.display_name, u.id
    LIMIT 8
  `) as ProfileRow[];
  const visitedIds = new Set(visited.map((profile) => profile.id));
  let suggested: ProfileRow[] = [];
  if (visited.length < sectionLimit) {
    const candidates = (await sql`
      WITH connections AS (
        SELECT DISTINCT ON (person.id)
          person.id,
          COALESCE(NULLIF(BTRIM(person.display_name), ''), 'Moment Maker') AS "displayName",
          CASE WHEN person.public_profile_photo THEN NULLIF(person.profile_photo_data, '') ELSE NULL END AS "profilePhoto",
          cl.relationship_type AS "relationshipType",
          cl.relationship_subject_user_id AS "relationshipSubjectId",
          cl.accepted_at
        FROM connected_lives AS cl
        JOIN users AS person ON person.id = CASE
          WHEN cl.owner_user_id = ${viewerId} THEN cl.connected_user_id
          ELSE cl.owner_user_id
        END
        WHERE cl.status = 'accepted'
          AND (cl.owner_user_id = ${viewerId} OR cl.connected_user_id = ${viewerId})
          AND person.id <> ${viewerId}
          AND person.discoverability IN ('searchable', 'public')
          AND person.account_status <> 'frozen'
        ORDER BY person.id, cl.accepted_at DESC NULLS LAST, cl.id
      )
      SELECT id, "displayName", "profilePhoto", "relationshipType", "relationshipSubjectId"
      FROM connections
      ORDER BY accepted_at DESC NULLS LAST, "displayName", id
      LIMIT 16
    `) as ProfileRow[];
    suggested = candidates.filter((profile) => !visitedIds.has(profile.id))
      .slice(0, sectionLimit - visited.length);
  }

  return {
    visited: toNavigationProfiles(visited, viewerId),
    suggested: toNavigationProfiles(suggested, viewerId),
  };
}
