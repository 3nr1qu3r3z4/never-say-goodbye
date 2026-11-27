import "server-only";

import { getSql } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { legacyReflection, summarizeReflectionTree, type ReflectionTreePerson } from "@/lib/legacy-reflection";

export type DashboardData = {
  reflection: string;
  counts: {
    sharedMoments: number;
    personalMoments: number;
    connectedLives: number;
    newLivesRequests: number;
    unreadLivesNotifications: number;
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
    newLivesRequestCounts,
    unreadLivesNotificationCounts,
    futureCounts,
    draftCounts,
    futureMomentMakers,
    momentActivity,
    connectionActivity,
    treePeople,
  ] = await sql.transaction([
    sql`SELECT COUNT(*)::int AS count FROM moments WHERE user_id = ${user.id} AND kind = 'shared' AND archived_at IS NULL`,
    sql`SELECT COUNT(*)::int AS count FROM moments WHERE user_id = ${user.id} AND kind = 'personal' AND archived_at IS NULL`,
    sql`SELECT COUNT(*)::int AS count FROM connected_lives
        WHERE (owner_user_id = ${user.id} OR connected_user_id = ${user.id})
          AND status = 'accepted'`,
    sql`SELECT COUNT(DISTINCT n.id)::int AS count
        FROM notifications AS n
        JOIN connected_lives AS cl
          ON cl.id = n.related_entity_id
         AND cl.status = 'pending'
         AND cl.connected_user_id = ${user.id}
        WHERE n.recipient_user_id = ${user.id}
          AND n.type = 'connected_lives_request'
          AND n.read_at IS NULL`,
    sql`SELECT COUNT(*)::int AS count
        FROM notifications
        WHERE recipient_user_id = ${user.id}
          AND read_at IS NULL`,
    sql`SELECT COUNT(*)::int AS count FROM future_moment_makers WHERE owner_user_id = ${user.id} AND status != 'archived' AND archived_at IS NULL`,
    sql`SELECT COUNT(*)::int AS count FROM drafts WHERE user_id = ${user.id}`,
    sql`
      SELECT future_moment_makers.id, future_moment_makers.name,
             future_moment_makers.relationship,
             COUNT(moments.id)::int AS "momentCount"
      FROM future_moment_makers
      LEFT JOIN moments ON moments.future_moment_maker_id = future_moment_makers.id AND moments.archived_at IS NULL
      WHERE future_moment_makers.owner_user_id = ${user.id}
        AND future_moment_makers.status != 'archived'
        AND future_moment_makers.archived_at IS NULL
      GROUP BY future_moment_makers.id
      ORDER BY future_moment_makers.created_at DESC
      LIMIT 5
    `,
    sql`
      SELECT id, kind, title, created_at AS "createdAt"
      FROM moments WHERE user_id = ${user.id} AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 5
    `,
    sql`
      SELECT cl.id,
             CASE
               WHEN cl.owner_user_id = ${user.id}
                 THEN COALESCE(NULLIF(BTRIM(recipient.display_name), ''), cl.display_name)
               ELSE COALESCE(NULLIF(BTRIM(requester.display_name), ''), cl.display_name)
             END AS "displayName",
             cl.created_at AS "createdAt"
      FROM connected_lives AS cl
      LEFT JOIN users AS requester ON requester.id = cl.owner_user_id
      LEFT JOIN users AS recipient ON recipient.id = cl.connected_user_id
      WHERE (cl.owner_user_id = ${user.id} OR cl.connected_user_id = ${user.id})
        AND cl.status = 'accepted'
      ORDER BY cl.created_at DESC LIMIT 5
    `,
    sql`
      WITH selected_tree AS (
        SELECT t.id, t.owner_user_id
        FROM legacy_trees t
        JOIN legacy_tree_members viewer ON viewer.tree_id = t.id AND viewer.user_id = ${user.id}
        ORDER BY (t.owner_user_id = ${user.id}) DESC, t.created_at, t.id
        LIMIT 1
      )
      SELECT 'member' AS kind, t.owner_user_id AS id, NULL::text AS relationship,
             NULL::text AS "linePartnerType", NULL::text AS "linePartnerId", TRUE AS "isOwner"
      FROM selected_tree t
      UNION ALL
      SELECT 'member', m.user_id, m.relationship, m.line_partner_type, m.line_partner_id, FALSE
      FROM legacy_tree_members m JOIN selected_tree t ON t.id = m.tree_id
      WHERE m.user_id <> t.owner_user_id
      UNION ALL
      SELECT 'placeholder', p.id, p.relationship, p.line_partner_type, p.line_partner_id, FALSE
      FROM family_placeholders p JOIN selected_tree t ON t.id = p.legacy_tree_id
      UNION ALL
      SELECT 'future', f.id, f.relationship, f.line_partner_type, f.line_partner_id, FALSE
      FROM future_moment_makers f JOIN selected_tree t ON t.id = f.legacy_tree_id
      WHERE f.status <> 'archived' AND f.archived_at IS NULL
    `,
  ]);
  const count = (rows: unknown) =>
    Number((rows as { count: number }[])[0]?.count ?? 0);
  const counts = {
    sharedMoments: count(sharedCounts),
    personalMoments: count(personalCounts),
    connectedLives: count(connectedCounts),
    newLivesRequests: count(newLivesRequestCounts),
    unreadLivesNotifications: count(unreadLivesNotificationCounts),
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

  const familyTree = summarizeReflectionTree((treePeople as {
    kind: ReflectionTreePerson["kind"];
    id: string;
    relationship: string | null;
    linePartnerType: string | null;
    linePartnerId: string | null;
    isOwner: boolean;
  }[]).map((person) => ({
    kind: person.kind,
    data: { id: person.id, linePartnerType: person.linePartnerType, linePartnerId: person.linePartnerId },
    name: person.id,
    relationship: person.relationship,
    isOwner: person.isOwner,
  })));

  const reflection = legacyReflection(counts, familyTree, Math.floor(Date.now() / 86_400_000));
  return { counts, reflection, futureMomentMakers: makers, recentActivity };
}
