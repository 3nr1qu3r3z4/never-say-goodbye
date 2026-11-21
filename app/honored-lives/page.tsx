import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import HonoredLifeForm, { type Placeholder, type Tree } from "./honored-life-form";

export const metadata: Metadata = {
  title: "Honored Lives™ | Never Say Goodbye",
  robots: { index: false, follow: false },
};
export const instant = false;

export default async function HonoredLivesPage() {
  const user = await requireUser();
  const sql = getSql();
  const [trees, placeholders] = await Promise.all([
    sql`
      SELECT t.id, t.name FROM legacy_trees t
      JOIN legacy_tree_members m ON m.tree_id = t.id
      WHERE m.user_id = ${user.id} AND m.role IN ('owner', 'admin')
      ORDER BY t.name, t.id
    `,
    sql`
      SELECT p.id, p.legacy_tree_id AS "treeId", p.name, p.relationship,
             COALESCE(p.birth_date::text, '') AS "birthDate",
             p.birth_year AS "birthYear", p.death_year AS "deathYear"
      FROM family_placeholders p
      JOIN legacy_tree_members m ON m.tree_id = p.legacy_tree_id
      LEFT JOIN honored_lives h ON h.family_placeholder_id = p.id
      WHERE m.user_id = ${user.id} AND m.role IN ('owner', 'admin')
        AND h.family_placeholder_id IS NULL
      ORDER BY p.name, p.id
    `,
  ]);
  return (
    <main className="min-h-screen bg-[#0F172A] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm text-[#f0c98e] hover:underline">← My Legacy</Link>
        <h1 className="mt-6 font-serif text-4xl text-white">🕊 Honored Lives™</h1>
        <p className="mt-4 leading-7 text-slate-400">
          Preserve a loved one&apos;s story as part of your family&apos;s Legacy Tree™.
          Honored Lives are visible only to members of the selected tree.
        </p>
        <HonoredLifeForm trees={trees as Tree[]} placeholders={placeholders as Placeholder[]} />
      </div>
    </main>
  );
}
