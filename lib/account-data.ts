import "server-only";

import { getSql } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth";

export type DashboardData = {
  counts: {
    sharedMoments: number;
    personalMoments: number;
    connectedLives: number;
    futureMomentMakers: number;
    drafts: number;
  };
  futureMomentMakers: {
    id: string;
    name: string;
    relationship: string;
    momentCount: number;
  }[];
  recentActivity: { id: string; action: string; detail: string }[];
};

export type SavedDraft = {
  id: string;
  kind: "shared" | "personal" | "cannot-open-until" | "future-moment-maker";
  title: string;
  updatedAt: string;
};

export async function getSavedDrafts(
  user: AuthenticatedUser,
): Promise<SavedDraft[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, kind, title,
           TO_CHAR(updated_at::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"') AS "updatedAt"
    FROM drafts WHERE user_id = ${user.id}
    ORDER BY updated_at DESC
  `) as SavedDraft[];
}

export async function getDashboardData(
  user: AuthenticatedUser,
): Promise<DashboardData> {
  const sql = getSql();
  const [
    sharedCounts,
    personalCounts,
    connectedCounts,
    futureCounts,
    draftCounts,
    futureMomentMakers,
    momentActivity,
    connectionActivity,
  ] = await sql.transaction([
    sql`SELECT COUNT(*)::int AS count FROM moments WHERE user_id = ${user.id} AND kind = 'shared'`,
    sql`SELECT COUNT(*)::int AS count FROM moments WHERE user_id = ${user.id} AND kind = 'personal'`,
    sql`SELECT COUNT(*)::int AS count FROM connected_lives WHERE owner_user_id = ${user.id} AND status = 'accepted'`,
    sql`SELECT COUNT(*)::int AS count FROM future_moment_makers WHERE owner_user_id = ${user.id} AND status != 'archived'`,
    sql`SELECT COUNT(*)::int AS count FROM drafts WHERE user_id = ${user.id}`,
    sql`
      SELECT future_moment_makers.id, future_moment_makers.name,
             future_moment_makers.relationship,
             COUNT(moments.id)::int AS "momentCount"
      FROM future_moment_makers
      LEFT JOIN moments ON moments.future_moment_maker_id = future_moment_makers.id
      WHERE future_moment_makers.owner_user_id = ${user.id}
        AND future_moment_makers.status != 'archived'
      GROUP BY future_moment_makers.id
      ORDER BY future_moment_makers.created_at DESC
      LIMIT 5
    `,
    sql`
      SELECT id, kind, title, created_at AS "createdAt"
      FROM moments WHERE user_id = ${user.id}
      ORDER BY created_at DESC LIMIT 5
    `,
    sql`
      SELECT id, display_name AS "displayName", created_at AS "createdAt"
      FROM connected_lives WHERE owner_user_id = ${user.id}
      ORDER BY created_at DESC LIMIT 5
    `,
  ]);
  const count = (rows: unknown) =>
    Number((rows as { count: number }[])[0]?.count ?? 0);
  const counts = {
    sharedMoments: count(sharedCounts),
    personalMoments: count(personalCounts),
    connectedLives: count(connectedCounts),
    futureMomentMakers: count(futureCounts),
    drafts: count(draftCounts),
  };
  const makers = futureMomentMakers as DashboardData["futureMomentMakers"];
  const moments = momentActivity as {
    id: string;
    kind: string;
    title: string;
    createdAt: string;
  }[];
  const connections = connectionActivity as {
    id: string;
    displayName: string;
    createdAt: string;
  }[];

  const recentActivity = [
    ...moments.map((moment) => ({
      id: `moment-${moment.id}`,
      action: "Created",
      detail: moment.title || moment.kind,
      createdAt: moment.createdAt,
    })),
    ...connections.map((connection) => ({
      id: `connection-${connection.id}`,
      action: "Connected",
      detail: `${connection.displayName} to Connected Lives™`,
      createdAt: connection.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map(({ id, action, detail }) => ({ id, action, detail }));

  return { counts, futureMomentMakers: makers, recentActivity };
}
