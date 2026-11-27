"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function MembershipError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[membership] Could not load membership information.", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-8">
        <h1 className="font-serif text-3xl text-white">Membership &amp; Usage</h1>
        <p className="mt-4 text-slate-300">Your membership information could not be loaded. Please try again.</p>
        <div className="mt-6 flex flex-wrap gap-5">
          <button type="button" onClick={reset} className="min-h-11 font-semibold text-[color:var(--nsg-accent-light)] underline underline-offset-4">Try again</button>
          <Link href="/my-profile" className="inline-flex min-h-11 items-center font-semibold text-[color:var(--nsg-accent-light)] underline underline-offset-4">My Profile</Link>
        </div>
      </div>
    </main>
  );
}
