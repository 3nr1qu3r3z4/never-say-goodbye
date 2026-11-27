import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { momentBorderClassName } from "@/lib/moment-card-style";
import type { Audience, MomentKind } from "@/lib/moment-types";

export const metadata: Metadata = {
  title: "Future Moment Maker™ | Never Say Goodbye",
};
export const instant = false;

type FutureRecord = {
  name: string;
  relationship: string;
  status: string;
  createdAt: string;
  treeName: string | null;
};
type RelatedMoment = { id: string; title: string; kind: MomentKind; audience: Audience; hasAccessCode: boolean };

export default async function FutureMomentMakerRecord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sql = getSql();
  const [records, moments] = await Promise.all([
    sql`
      SELECT f.name, f.relationship, f.status, f.created_at AS "createdAt",
             t.name AS "treeName"
      FROM future_moment_makers f
      LEFT JOIN legacy_trees t ON t.id = f.legacy_tree_id
        AND EXISTS (SELECT 1 FROM legacy_tree_members member
          WHERE member.tree_id = t.id AND member.user_id = ${user.id})
      WHERE f.id = ${id} AND f.owner_user_id = ${user.id}
        AND f.status <> 'archived' AND f.archived_at IS NULL
    `,
    sql`
      SELECT m.id, m.title, m.kind, m.audience, (m.access_code_hash IS NOT NULL) AS "hasAccessCode" FROM moments m
      JOIN future_moment_makers f ON f.id = m.future_moment_maker_id
      WHERE f.id = ${id} AND f.owner_user_id = ${user.id} AND m.user_id = ${user.id}
        AND f.status <> 'archived' AND f.archived_at IS NULL AND m.archived_at IS NULL
      ORDER BY m.created_at DESC
    `,
  ]);
  const record = (records as FutureRecord[])[0];
  if (!record) notFound();
  const related = moments as RelatedMoment[];
  const createdDate = new Date(record.createdAt);
  const created = Number.isNaN(createdDate.getTime()) ? "Unavailable"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(createdDate);

  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-4 py-12 text-slate-100 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/connected-lives" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">← Connected Lives™</Link>
        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">Future Moment Maker™</p>
          <h1 className="mt-3 break-words font-serif text-4xl text-white sm:text-5xl">{record.name}</h1>
          <p className="mt-4 text-slate-400">A place reserved for a story still to come.</p>
        </header>
        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            ["Relationship", record.relationship],
            ["Status", record.status === "awaiting-claim" ? "Awaiting Claim" : record.status === "claimed" ? "Claimed" : record.status === "archived" ? "Archived" : record.status],
            ["Created", created],
            ["Related Family Tree", record.treeName ?? "Not available"],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
            <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="mt-2 break-words font-serif text-lg text-white">{value}</dd>
          </div>)}
        </dl>
        <section className="mt-10" aria-labelledby="related-moments-heading">
          <h2 id="related-moments-heading" className="font-serif text-2xl text-white">Related Legacy Moments</h2>
          {related.length ? <ul className="mt-4 space-y-3">{related.map((moment) => <li key={moment.id} className={`rounded-2xl border ${momentBorderClassName(moment.kind, moment.audience, moment.hasAccessCode)} bg-white/[0.03] p-5`}>
            <p className="break-words font-serif text-lg text-white">{moment.title}</p>
            <p className="mt-2 text-sm text-slate-400">{moment.kind.replaceAll("-", " ")}</p>
          </li>)}</ul> : <p className="mt-4 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 text-sm text-slate-400">No legacy moments are associated with this record yet.</p>}
        </section>
      </div>
    </main>
  );
}
