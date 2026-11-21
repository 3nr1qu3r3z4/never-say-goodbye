import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccessibleMoments } from "@/lib/moment-access";
import MomentActionsMenu from "./moment-actions-menu";

export const metadata: Metadata = {
  title: "Shared Moments | Never Say Goodbye",
};
export const instant = false;

export default async function MomentsPage() {
  const user = await requireUser();
  const moments = await getAccessibleMoments(user.id);

  return (
    <main className="min-h-screen bg-[#0F172A] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm font-semibold text-[#f0c98e] hover:underline">
          My Legacy
        </Link>
        <h1 className="mt-8 font-serif text-4xl text-white">Shared Moments</h1>
        <p className="mt-4 leading-7 text-slate-400">
          Your Shared Moments and moments shared with your Connected Lives™ or Family audience appear here.
        </p>
        {moments.length ? (
          <ul className="mt-8 space-y-3">
            {moments.map((moment) => (
              <li key={moment.id} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 pr-16">
                <MomentActionsMenu momentId={moment.id} title={moment.title} isAuthor={moment.isAuthor} />
                <a
                  href={`/moments/${encodeURIComponent(moment.id)}`}
                  className="font-serif text-xl text-white hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
                >
                  {moment.title}
                </a>
                <p className="mt-2 text-sm text-slate-400">By {moment.authorName}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
            No Shared Moments are available yet.
          </p>
        )}
      </div>
    </main>
  );
}
