import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import ArchiveButton from "./archive-button";

export const metadata: Metadata = { title: "Manage Content | Never Say Goodbye" };
export const instant = false;

type Moment = {
  id: string;
  title: string;
  kind: string;
  archived: boolean;
  hasStory: boolean;
  hasPhoto: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
};
type Maker = { id: string; name: string; archived: boolean; legacyArchived: boolean };

export default async function ManageContentPage() {
  const user = await requireUser();
  const sql = getSql();
  const [moments, makers] = await Promise.all([
    sql`SELECT m.id, m.title, m.kind, (m.archived_at IS NOT NULL) AS archived,
               (m.story !~ '^[[:space:]]*$') AS "hasStory",
               (COALESCE(m.details_json::jsonb ->> 'photoData', '') <> '') AS "hasPhoto",
               EXISTS (SELECT 1 FROM moment_videos v WHERE v.moment_id = m.id AND v.state = 'attached') AS "hasVideo",
               EXISTS (SELECT 1 FROM moment_audio a WHERE a.moment_id = m.id AND a.state = 'attached') AS "hasAudio"
        FROM moments m WHERE m.user_id = ${user.id} ORDER BY m.created_at DESC, m.id`,
    sql`SELECT id, name, (archived_at IS NOT NULL OR status = 'archived') AS archived,
               (status = 'archived') AS "legacyArchived"
        FROM future_moment_makers WHERE owner_user_id = ${user.id} ORDER BY created_at DESC, id`,
  ]);
  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <Link href="/my-profile/membership" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">Membership &amp; Usage</Link>
        <h1 className="mt-8 font-serif text-4xl text-white">Manage Content</h1>
        <p className="mt-4 leading-7 text-slate-300">
          Archiving a Moment hides the whole Moment, including its story, photo, video and audio, and removes it from usage.
          Restore it anytime; all its contents count again, even above a plan allowance. No limits are enforced during beta.
        </p>
        <section className="mt-9" aria-labelledby="moments-heading">
          <h2 id="moments-heading" className="font-serif text-2xl text-white">Your Moments</h2>
          <p className="mt-2 text-sm text-slate-400">Shared, Personal, Cannot Open Until™ and Future Moment Maker™ Moments are listed here.</p>
          {cannotOpenUntilEnabled() && <Link href="/cannot-open-until" className="mt-3 inline-block text-sm font-semibold text-[color:var(--nsg-accent-light)] underline">Manage Cannot Open Until™ Moments</Link>}
          {(moments as Moment[]).length ? <ul className="mt-4 space-y-3">
            {(moments as Moment[]).map((moment) => <li key={moment.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
              <div><p className="break-words font-semibold text-white">{moment.title}</p>
                <p className="mt-1 text-sm capitalize text-slate-400">{moment.kind.replaceAll("-", " ")} · {moment.archived ? "Archived" : "Active"}</p>
                <p className="mt-1 text-sm text-slate-400">{[
                  moment.hasStory && "Story", moment.hasPhoto && "Photo",
                  moment.hasVideo && "Video", moment.hasAudio && "Audio",
                ].filter(Boolean).join(" · ") || "No counted media or story"}</p>
                {cannotOpenUntilEnabled() && moment.kind === "cannot-open-until" && <Link href={`/cannot-open-until/${encodeURIComponent(moment.id)}`} className="mt-2 inline-block text-sm text-[color:var(--nsg-accent-light)] underline">Manage this Moment</Link>}
              </div>
              <ArchiveButton id={moment.id} name={moment.title} kind="moment" archived={moment.archived}
                warnOnRestore={cannotOpenUntilEnabled() && moment.kind === "cannot-open-until"} />
            </li>)}
          </ul> : <p className="mt-4 text-sm text-slate-400">You have no published Moments yet.</p>}
        </section>
        <section className="mt-10" aria-labelledby="makers-heading">
          <h2 id="makers-heading" className="font-serif text-2xl text-white">Future Moment Makers™</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Archiving hides a person from your tree, calendar and search until restored. Family relationships and dates are preserved,
            but the tree layout may change. Related Moments remain active and can be managed separately.
          </p>
          {(makers as Maker[]).length ? <ul className="mt-4 space-y-3">
            {(makers as Maker[]).map((maker) => <li key={maker.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
              <div><p className="break-words font-semibold text-white">{maker.name}</p>
                <p className="mt-1 text-sm text-slate-400">{maker.archived ? "Archived" : "Active"}</p>
                {maker.legacyArchived && <p className="mt-2 text-sm text-slate-400">The original status is unavailable. Restoring this older record sets it to Awaiting Claim.</p>}
              </div>
              <ArchiveButton id={maker.id} name={maker.name} kind="future" archived={maker.archived} />
            </li>)}
          </ul> : <p className="mt-4 text-sm text-slate-400">You have no Future Moment Makers yet.</p>}
        </section>
      </div>
    </main>
  );
}
