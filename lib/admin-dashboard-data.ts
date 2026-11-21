import "server-only";

import { requireFounder } from "@/lib/admin";
import { getSql } from "@/lib/db";
import { siteAnalyticsEnabled } from "@/lib/site-analytics";

type Counts = {
  users: number;
  completedProfiles: number;
  profilePhotos: number;
  connectedLives: number;
  pendingConnections: number;
  acceptedConnections: number;
  moments: number;
  drafts: number;
  futureMakers: number;
  placeholders: number;
  treeMembers: number;
  membersWithMoments: number;
  membersWithConnections: number;
};

type Signup = {
  name: string;
  email: string;
  createdAt: string;
  complete: boolean;
};

type VisitorTotals = {
  visits: number;
  visits7: number;
  visits30: number;
  visitorsToday: number;
  visitorsWeek: number;
  visitorsMonth: number;
  unique90: number;
  signups90: number;
};

type DailyVisits = { date: string; visits: number };

export async function getAdminDashboardData() {
  await requireFounder();
  const sql = getSql();
  const [counts] = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS "users",
      (SELECT COUNT(*)::int FROM users WHERE NULLIF(BTRIM(profile_photo_data), '') IS NOT NULL AND NULLIF(BTRIM(bio), '') IS NOT NULL) AS "completedProfiles",
      (SELECT COUNT(*)::int FROM users WHERE NULLIF(BTRIM(profile_photo_data), '') IS NOT NULL) AS "profilePhotos",
      (SELECT COUNT(*)::int FROM connected_lives WHERE status = 'accepted') AS "connectedLives",
      (SELECT COUNT(*)::int FROM connected_lives WHERE status = 'pending') AS "pendingConnections",
      (SELECT COUNT(*)::int FROM connected_lives WHERE status = 'accepted') AS "acceptedConnections",
      (SELECT COUNT(*)::int FROM moments) AS "moments",
      (SELECT COUNT(*)::int FROM drafts) AS "drafts",
      (SELECT COUNT(*)::int FROM future_moment_makers) AS "futureMakers",
      (SELECT COUNT(*)::int FROM family_placeholders) AS "placeholders",
      (SELECT COUNT(*)::int FROM legacy_tree_members) AS "treeMembers",
      (SELECT COUNT(DISTINCT user_id)::int FROM moments) AS "membersWithMoments",
      (SELECT COUNT(DISTINCT owner_user_id)::int FROM connected_lives) AS "membersWithConnections"
  `) as Counts[];

  const signups = (await sql`
    SELECT display_name AS name, email, created_at AS "createdAt",
      (NULLIF(BTRIM(profile_photo_data), '') IS NOT NULL AND NULLIF(BTRIM(bio), '') IS NOT NULL) AS complete
    FROM users ORDER BY created_at DESC, id DESC LIMIT 10
  `) as Signup[];

  let analytics: { totals: VisitorTotals; daily: DailyVisits[] } | null = null;
  if (siteAnalyticsEnabled()) {
    const [totals] = (await sql`
      SELECT
        COALESCE((SELECT SUM(visits) FROM site_analytics_daily), 0)::int AS "visits",
        COALESCE((SELECT SUM(visits) FROM site_analytics_daily WHERE visit_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 6), 0)::int AS "visits7",
        COALESCE((SELECT SUM(visits) FROM site_analytics_daily WHERE visit_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 29), 0)::int AS "visits30",
        (SELECT COUNT(DISTINCT visitor_id)::int FROM site_analytics_visitor_days
          WHERE visit_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) AS "visitorsToday",
        (SELECT COUNT(DISTINCT visitor_id)::int FROM site_analytics_visitor_days
          WHERE visit_date BETWEEN date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
            AND (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) AS "visitorsWeek",
        (SELECT COUNT(DISTINCT visitor_id)::int FROM site_analytics_visitor_days
          WHERE visit_date BETWEEN date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
            AND (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) AS "visitorsMonth",
        (SELECT COUNT(DISTINCT visitor_id)::int FROM site_analytics_visitor_days WHERE visit_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 89) AS "unique90",
        (SELECT COUNT(*)::int FROM site_analytics_visitors v
          WHERE v.signup_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
            AND EXISTS (SELECT 1 FROM site_analytics_visitor_days d
              WHERE d.visitor_id = v.visitor_id AND d.visit_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 89)) AS "signups90"
    `) as VisitorTotals[];
    const daily = (await sql`
      SELECT visit_date::text AS date, visits::int AS visits
      FROM site_analytics_daily
      WHERE visit_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 29
      ORDER BY visit_date DESC
    `) as DailyVisits[];
    analytics = { totals, daily };
  }
  return { counts, signups, analytics };
}
