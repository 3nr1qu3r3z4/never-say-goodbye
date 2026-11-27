import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import { getSql } from "@/lib/db";
import { restrictedMomentBorder } from "@/lib/moment-card-style";

export const instant = false;

type Item = { id: string; title: string; review: boolean; released: boolean; archived: boolean; recipient: string | null; hasAccess: boolean; claimPending: boolean };

export default async function TimeCapsulesPage() {
  const user = await requireUser();
  if (!cannotOpenUntilEnabled(user.id)) notFound();
  const sql = getSql();
  const items = await sql`
    SELECT m.id, m.title, (COALESCE(s.status, 'review_required') = 'review_required') AS review,
      (s.status = 'active' AND (s.manual_released_at IS NOT NULL OR s.unlock_at <= clock_timestamp())) AS released,
      (m.archived_at IS NOT NULL) AS archived, (s.recipient_user_id IS NOT NULL) AS "hasAccess",
      EXISTS (SELECT 1 FROM cannot_open_until_claims c WHERE c.moment_id = m.id AND c.status = 'pending'
        AND c.recipient_kind = s.recipient_kind
        AND c.recipient_id = COALESCE(s.future_recipient_id, s.placeholder_recipient_id)) AS "claimPending",
      COALESCE(person.display_name, future.name, placeholder.name) AS recipient
    FROM moments m LEFT JOIN cannot_open_until_settings s ON s.moment_id = m.id
    LEFT JOIN users person ON person.id = s.intended_user_id
    LEFT JOIN future_moment_makers future ON future.id = s.future_recipient_id
    LEFT JOIN family_placeholders placeholder ON placeholder.id = s.placeholder_recipient_id
    WHERE m.user_id = ${user.id} AND m.kind = 'cannot-open-until'
    ORDER BY m.created_at DESC, m.id
  ` as Item[];
  const review = items.filter((item) => item.review);
  const active = items.filter((item) => !item.review);
  return <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-4xl">
      <Link href="/my-profile/membership/content" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">Manage Content</Link>
      <h1 className="mt-8 font-serif text-4xl text-white">Cannot Open Until™</h1>
      <p className="mt-4 leading-7 text-slate-300">Manage your preserved Moments. Existing Moments remain inactive until you choose a recipient and activate a date.</p>
      <Link href="/create-moment/cannot-open-until" className="mt-5 inline-block text-sm font-semibold text-[color:var(--nsg-accent-light)] underline">Create a Moment</Link>
      <Link href="/cannot-open-until/inbox" className="ml-5 mt-5 inline-block text-sm font-semibold text-[color:var(--nsg-accent-light)] underline">Received Moments</Link>
      {[
        { title: "Review Required", items: review, empty: "No Moments need review." },
        { title: "Active schedules", items: active, empty: "No active schedules yet." },
      ].map((group) => <section key={group.title} className="mt-10">
        <h2 className="font-serif text-2xl text-white">{group.title}</h2>
        {group.items.length ? <ul className="mt-4 space-y-3">{group.items.map((item) =>
          <li key={item.id} className={`rounded-2xl border ${restrictedMomentBorder} bg-white/[0.03] p-5`}>
            <Link href={`/cannot-open-until/${encodeURIComponent(item.id)}`} className="break-words font-semibold text-[color:var(--nsg-accent-light)] hover:underline">{item.title}</Link>
            <p className="mt-2 text-sm text-slate-400">{item.review ? "Review Required" : item.released ? "Released · Read-only" : "Scheduled"}{item.archived ? " · Archived" : ""}</p>
            {!item.review && <p className="mt-1 text-sm text-slate-400">{item.recipient ? `Recipient: ${item.recipient}${item.hasAccess ? "" : " · Awaiting claim or re-authorization"}` : "Recipient unavailable — owner review required"}</p>}
            {item.claimPending && <p className="mt-1 text-sm text-[color:var(--nsg-accent-light)]">Claim awaiting your review</p>}
          </li>)}</ul> : <p className="mt-4 text-sm text-slate-400">{group.empty}</p>}
      </section>)}
    </div>
  </main>;
}
