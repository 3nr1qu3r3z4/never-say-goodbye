import "server-only";

import { getSql } from "@/lib/db";
import type { TreeMilestone } from "@/lib/tree-milestones";

export async function getTreeMilestones(userId: string, treeId: string): Promise<TreeMilestone[]> {
  const sql = getSql();
  return await sql`
    SELECT m.id, m.tree_id AS "treeId",
           CASE WHEN m.user_id IS NOT NULL THEN 'user'
                WHEN m.placeholder_id IS NOT NULL THEN 'placeholder' ELSE 'future' END AS "subjectType",
           COALESCE(m.user_id, m.placeholder_id, m.future_id) AS "subjectId",
           COALESCE(NULLIF(BTRIM(u.display_name), ''), p.name, f.name, 'Moment Maker') AS "personName",
           m.kind, m.title, m.year, m.month, m.day, m.repeats_yearly AS "repeatsYearly",
           (m.user_id = ${userId} OR (viewer.role IN ('owner', 'admin')
             AND (m.user_id IS NULL OR subject.allow_milestone_admin))) AS "canEdit"
    FROM family_tree_milestones m
    JOIN legacy_tree_members viewer ON viewer.tree_id = m.tree_id AND viewer.user_id = ${userId}
    LEFT JOIN legacy_tree_members subject ON subject.tree_id = m.tree_id AND subject.user_id = m.user_id
    LEFT JOIN users u ON u.id = subject.user_id
    LEFT JOIN family_placeholders p ON p.id = m.placeholder_id AND p.legacy_tree_id = m.tree_id
    LEFT JOIN future_moment_makers f ON f.id = m.future_id AND f.legacy_tree_id = m.tree_id AND f.status <> 'archived'
    WHERE m.tree_id = ${treeId}
      AND (subject.user_id IS NOT NULL OR p.id IS NOT NULL OR f.id IS NOT NULL)
    ORDER BY "personName", m.created_at, m.id
  ` as TreeMilestone[];
}
