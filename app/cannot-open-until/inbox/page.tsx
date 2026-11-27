import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { cannotOpenUntilEnabled, getReceivedTimeCapsules } from "@/lib/cannot-open-until";

export const instant = false;

export default async function TimeCapsuleInboxPage() {
  const user = await requireUser();
  if (!cannotOpenUntilEnabled()) notFound();
  const moments = await getReceivedTimeCapsules(user.id);
  return <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-4xl">
      <Link href="/moments" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">Shared Moments</Link>
      <h1 className="mt-8 font-serif text-4xl text-white">Received Cannot Open Until™ Moments</h1>
      <p className="mt-4 leading-7 text-slate-300">Moments shared with you appear here. Their contents remain private until they are released.</p>
      {moments.length ? <ul className="mt-8 space-y-3">{moments.map((moment) =>
        <li key={moment.id} className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
          <Link href={`/cannot-open-until/inbox/${encodeURIComponent(moment.id)}`} className="break-words font-semibold text-[color:var(--nsg-accent-light)] hover:underline">{moment.title}</Link>
          <p className="mt-2 text-sm text-slate-300">From {moment.sender}</p>
          <p className="mt-1 text-sm text-slate-400">{moment.released ? "Released" : "Locked"} · Release date: {moment.releaseDate} ({moment.releaseTimezone})</p>
        </li>)}</ul> : <p className="mt-8 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 text-sm text-slate-400">No Cannot Open Until™ Moments are available to you.</p>}
    </div>
  </main>;
}
