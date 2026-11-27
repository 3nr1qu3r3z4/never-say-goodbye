import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccessibleMoments } from "@/lib/moment-access";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import MomentCard from "./moment-card";

export const metadata: Metadata = {
  title: "Shared Moments | Never Say Goodbye",
};
export const instant = false;

export default async function MomentsPage() {
  const user = await requireUser();
  const moments = await getAccessibleMoments(user.id);

  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">
          My Legacy
        </Link>
        <h1 className="mt-8 font-serif text-4xl text-white">Shared Moments</h1>
        <p className="mt-4 leading-7 text-slate-400">
          Your Shared Moments and moments shared with your Connected Lives™ or Family audience appear here.
        </p>
        {cannotOpenUntilEnabled(user.id) && <Link href="/cannot-open-until/inbox" className="mt-5 inline-block text-sm font-semibold text-[color:var(--nsg-accent-light)] underline">Received Cannot Open Until™ Moments</Link>}
        {moments.length ? (
          <ul className="mt-8 space-y-3">
            {moments.map((moment) => <MomentCard key={moment.id} moment={moment} />)}
          </ul>
        ) : (
          <p className="mt-8 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 text-sm text-slate-400">
            No Shared Moments are available yet.
          </p>
        )}
      </div>
    </main>
  );
}
