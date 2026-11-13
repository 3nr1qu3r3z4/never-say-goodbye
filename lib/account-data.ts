import "server-only";

import { db } from "@/lib/db";
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

export function getSavedDrafts(user: AuthenticatedUser): SavedDraft[] {
  return db
    .prepare(
      `SELECT id, kind, title,
              strftime('%Y-%m-%d %H:%M UTC', updated_at) AS updatedAt
       FROM drafts WHERE user_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(user.id) as SavedDraft[];
}

export function getDashboardData(user: AuthenticatedUser): DashboardData {
  const count = (query: string) =>
    (db.prepare(query).get(user.id) as { count: number }).count;

  const counts = {
    sharedMoments: count(
      "SELECT COUNT(*) AS count FROM moments WHERE user_id = ? AND kind = 'shared'",
    ),
    personalMoments: count(
      "SELECT COUNT(*) AS count FROM moments WHERE user_id = ? AND kind = 'personal'",
    ),
    connectedLives: count(
      "SELECT COUNT(*) AS count FROM connected_lives WHERE owner_user_id = ? AND status = 'accepted'",
    ),
    futureMomentMakers: count(
      "SELECT COUNT(*) AS count FROM future_moment_makers WHERE owner_user_id = ? AND status != 'archived'",
    ),
    drafts: count("SELECT COUNT(*) AS count FROM drafts WHERE user_id = ?"),
  };

  const futureMomentMakers = db
    .prepare(
      `SELECT future_moment_makers.id, future_moment_makers.name,
              future_moment_makers.relationship,
              COUNT(moments.id) AS momentCount
       FROM future_moment_makers
       LEFT JOIN moments ON moments.future_moment_maker_id = future_moment_makers.id
       WHERE future_moment_makers.owner_user_id = ?
         AND future_moment_makers.status != 'archived'
       GROUP BY future_moment_makers.id
       ORDER BY future_moment_makers.created_at DESC
       LIMIT 5`,
    )
    .all(user.id) as DashboardData["futureMomentMakers"];

  const momentActivity = db
    .prepare(
      `SELECT id, kind, title, created_at AS createdAt
       FROM moments WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 5`,
    )
    .all(user.id) as {
    id: string;
    kind: string;
    title: string;
    createdAt: string;
  }[];
  const connectionActivity = db
    .prepare(
      `SELECT id, display_name AS displayName, created_at AS createdAt
       FROM connected_lives WHERE owner_user_id = ?
       ORDER BY created_at DESC LIMIT 5`,
    )
    .all(user.id) as {
    id: string;
    displayName: string;
    createdAt: string;
  }[];

  const recentActivity = [
    ...momentActivity.map((moment) => ({
      id: `moment-${moment.id}`,
      action: "Created",
      detail: moment.title || moment.kind,
      createdAt: moment.createdAt,
    })),
    ...connectionActivity.map((connection) => ({
      id: `connection-${connection.id}`,
      action: "Connected",
      detail: `${connection.displayName} to Connected Lives™`,
      createdAt: connection.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map(({ id, action, detail }) => ({ id, action, detail }));

  return { counts, futureMomentMakers, recentActivity };
}
