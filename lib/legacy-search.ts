import "server-only";

import { getSql } from "@/lib/db";

export async function searchOwnedLegacy(userId: string, term: string) {
  const sql = getSql();
  const [trees, futureMakers, drafts] = await Promise.all([
    sql`
      SELECT t.id, t.name FROM legacy_trees t
      JOIN legacy_tree_members member ON member.tree_id = t.id
      WHERE member.user_id = ${userId} AND strpos(lower(t.name), lower(${term})) > 0
      ORDER BY t.name, t.id LIMIT 30
    `,
    sql`
      SELECT id, name FROM future_moment_makers
      WHERE owner_user_id = ${userId} AND status <> 'archived' AND archived_at IS NULL
        AND strpos(lower(name), lower(${term})) > 0
      ORDER BY name, id LIMIT 30
    `,
    sql`
      SELECT id, title FROM drafts
      WHERE user_id = ${userId} AND strpos(lower(title), lower(${term})) > 0
      ORDER BY updated_at DESC, id LIMIT 30
    `,
  ]);
  return {
    trees: trees as { id: string; name: string }[],
    futureMakers: futureMakers as { id: string; name: string }[],
    drafts: drafts as { id: string; title: string }[],
  };
}
