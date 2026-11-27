import "server-only";

import { getSql } from "@/lib/db";
import type { CalendarEvent } from "@/lib/family-calendar";
import type { CalendarProfile, Reminders, SourceRecord } from "@/app/family-calendar/calendar-forms";

export type CalendarTree = { id: string; name: string; role: string };
export type FamilyBulletin = { id: string; treeId: string; message: string; authorName: string; createdAt: string };

export async function getFamilyBulletins(userId: string, treeId: string | null): Promise<FamilyBulletin[]> {
  const sql = getSql();
  return await sql`
    SELECT b.id, b.tree_id AS "treeId", b.message,
           COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS "authorName",
           b.created_at::text AS "createdAt"
    FROM family_bulletins b
    JOIN legacy_tree_members member ON member.tree_id = b.tree_id AND member.user_id = ${userId}
    JOIN users u ON u.id = b.author_user_id
    WHERE (${treeId}::text IS NULL OR b.tree_id = ${treeId})
    ORDER BY b.created_at DESC, b.id
    LIMIT ${treeId === null ? 5 : null}
  ` as FamilyBulletin[];
}

export async function getCalendarSettings(userId: string) {
  const sql = getSql();
  const [profiles, reminders, trees] = await Promise.all([
    sql`SELECT COALESCE(birth_date::text, '') AS "birthDate",
               COALESCE(birth_year::text, '') AS "birthYear",
               COALESCE(memorial_date::text, '') AS "memorialDate",
               share_birthday AS "shareBirthday", share_anniversary AS "shareAnniversary",
               share_memorial_date AS "shareMemorialDate",
               share_relationship_milestones AS "shareMilestones"
        FROM users WHERE id = ${userId}`,
    sql`SELECT day_of AS "dayOf", one_day_before AS "oneDay",
               one_week_before AS "oneWeek", one_month_before AS "oneMonth"
        FROM family_calendar_reminders WHERE user_id = ${userId}`,
    sql`SELECT t.id, t.name, m.role FROM legacy_trees t
        JOIN legacy_tree_members m ON m.tree_id = t.id
        WHERE m.user_id = ${userId} ORDER BY t.name, t.id`,
  ]);
  return {
    profile: profiles[0] as CalendarProfile,
    reminders: (reminders[0] ?? { dayOf: false, oneDay: false, oneWeek: false, oneMonth: false }) as Reminders,
    trees: trees as CalendarTree[],
  };
}

export async function getCalendarEvents(userId: string, treeId: string): Promise<CalendarEvent[]> {
  const sql = getSql();
  return await sql`
    WITH access AS (
      SELECT tree_id FROM legacy_tree_members
      WHERE user_id = ${userId} AND tree_id = ${treeId}
    ), imports AS (
      SELECT tree_id FROM access
    ), shared_connections AS (
      SELECT cl.id, cl.anniversary_date,
             a.display_name AS first_name, b.display_name AS second_name,
             a.share_anniversary AND b.share_anniversary AS share_anniversary,
             a.share_relationship_milestones AND b.share_relationship_milestones AS share_milestones
      FROM connected_lives cl
      JOIN imports ON TRUE
      JOIN legacy_tree_members ma ON ma.tree_id = imports.tree_id AND ma.user_id = cl.owner_user_id
      JOIN legacy_tree_members mb ON mb.tree_id = imports.tree_id AND mb.user_id = cl.connected_user_id
      JOIN users a ON a.id = ma.user_id
      JOIN users b ON b.id = mb.user_id
      WHERE cl.status = 'accepted'
    )
    SELECT 'event:' || e.id AS id, e.title, e.event_date::text AS date,
           e.repeats_yearly AS "repeatsYearly", 'Manual Event' AS source
    FROM family_calendar_events e JOIN access ON access.tree_id = e.tree_id
    UNION ALL
    SELECT 'birthday:' || u.id, u.display_name || ' Birthday', u.birth_date::text, TRUE, 'Legacy Tree™'
    FROM imports JOIN legacy_tree_members m ON m.tree_id = imports.tree_id
    JOIN users u ON u.id = m.user_id WHERE u.share_birthday AND u.birth_date IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM family_tree_milestones tm WHERE tm.tree_id = imports.tree_id AND tm.user_id = u.id AND tm.kind = 'birthday')
    UNION ALL
    SELECT 'memorial:' || u.id, u.display_name || ' Memorial Date', u.memorial_date::text, TRUE, 'Legacy Tree™'
    FROM imports JOIN legacy_tree_members m ON m.tree_id = imports.tree_id
    JOIN users u ON u.id = m.user_id WHERE u.share_memorial_date AND u.memorial_date IS NOT NULL
    UNION ALL
    SELECT 'placeholder-birthday:' || p.id, p.name || ' Birthday', p.birth_date::text, TRUE, 'Family Placeholder'
    FROM family_placeholders p JOIN imports ON imports.tree_id = p.legacy_tree_id WHERE p.birth_date IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM family_tree_milestones tm WHERE tm.tree_id = imports.tree_id AND tm.placeholder_id = p.id AND tm.kind = 'birthday')
    UNION ALL
    SELECT 'placeholder-memorial:' || p.id, p.name || ' Memorial Date', p.memorial_date::text, TRUE, 'Family Placeholder'
    FROM family_placeholders p JOIN imports ON imports.tree_id = p.legacy_tree_id WHERE p.memorial_date IS NOT NULL
    UNION ALL
    SELECT 'honored-passing:' || p.id, p.name || ' Passing Date', h.passing_date::text, TRUE, 'Honored Life™'
    FROM family_placeholders p JOIN imports ON imports.tree_id = p.legacy_tree_id
    JOIN honored_lives h ON h.family_placeholder_id = p.id
    WHERE h.passing_date IS NOT NULL AND p.memorial_date IS NULL
    UNION ALL
    SELECT 'future:' || f.id, f.name || ' Expected Birth', f.expected_birth_date::text, FALSE, 'Future Moment Maker™'
    FROM future_moment_makers f JOIN imports ON imports.tree_id = f.legacy_tree_id
    WHERE f.status = 'awaiting-claim' AND f.archived_at IS NULL AND f.expected_birth_date IS NOT NULL
    UNION ALL
    SELECT 'anniversary:' || c.id, c.first_name || ' & ' || c.second_name || ' Anniversary',
           c.anniversary_date::text, TRUE, 'Connected Lives™'
    FROM shared_connections c WHERE c.share_anniversary AND c.anniversary_date IS NOT NULL
    UNION ALL
    SELECT 'milestone:' || m.id, m.title, m.event_date::text, m.repeats_yearly, 'Connected Lives™'
    FROM family_relationship_milestones m JOIN shared_connections c ON c.id = m.connection_id
    WHERE c.share_milestones
  ` as CalendarEvent[];
}

export async function getEditableCalendarSources(userId: string, treeId: string): Promise<SourceRecord[]> {
  const sql = getSql();
  return await sql`
    WITH access AS (
      SELECT tree_id FROM legacy_tree_members
      WHERE user_id = ${userId} AND tree_id = ${treeId} AND role IN ('owner', 'admin')
    )
    SELECT p.id, p.name, 'placeholder' AS type,
           COALESCE(p.birth_date::text, '') AS "firstDate",
           COALESCE(p.memorial_date::text, '') AS "secondDate",
           FALSE AS "canAnniversary", FALSE AS "canMilestones"
    FROM family_placeholders p JOIN access ON access.tree_id = p.legacy_tree_id
    UNION ALL
    SELECT f.id, f.name, 'future', COALESCE(f.expected_birth_date::text, ''), '', FALSE, FALSE
    FROM future_moment_makers f JOIN access ON access.tree_id = f.legacy_tree_id
    WHERE f.status = 'awaiting-claim' AND f.archived_at IS NULL
    UNION ALL
    SELECT u.id, u.display_name, 'user', COALESCE(u.birth_date::text, ''), '', FALSE, FALSE
    FROM access JOIN legacy_tree_members member ON member.tree_id = access.tree_id
    JOIN users u ON u.id = member.user_id
    WHERE member.user_id <> ${userId} AND member.allow_milestone_admin AND u.share_birthday
    UNION ALL
    SELECT cl.id, a.display_name || ' & ' || b.display_name, 'connection',
           CASE WHEN a.share_anniversary AND b.share_anniversary
             THEN COALESCE(cl.anniversary_date::text, '') ELSE '' END, '',
           a.share_anniversary AND b.share_anniversary,
           a.share_relationship_milestones AND b.share_relationship_milestones
    FROM connected_lives cl JOIN access ON TRUE
    JOIN legacy_tree_members ma ON ma.tree_id = access.tree_id AND ma.user_id = cl.owner_user_id
    JOIN legacy_tree_members mb ON mb.tree_id = access.tree_id AND mb.user_id = cl.connected_user_id
    JOIN users a ON a.id = ma.user_id JOIN users b ON b.id = mb.user_id
    WHERE cl.status = 'accepted'
      AND ((a.share_anniversary AND b.share_anniversary)
        OR (a.share_relationship_milestones AND b.share_relationship_milestones))
    ORDER BY name
  ` as SourceRecord[];
}
