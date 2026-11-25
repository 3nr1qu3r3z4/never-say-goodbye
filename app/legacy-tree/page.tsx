import { Suspense } from "react";
import type { Metadata } from "next";
import FamilyMembers from "./family-members";

export const metadata: Metadata = {
  title: "Legacy Tree™ | Never Say Goodbye",
  description: "Explore your family connections and preserve their stories.",
};

export default function LegacyTreePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <header className="relative px-6 pb-12 pt-16 text-center sm:px-8 sm:pb-16 sm:pt-24">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_68%)]"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
          Connected Lives™
        </p>
        <h1 className="mt-4 font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
          Legacy Tree™
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-serif text-lg leading-relaxed text-slate-300 sm:text-xl">
          The people who shaped a life of moments
        </p>
      </header>

      <Suspense fallback={<p className="pb-16 text-center text-sm text-slate-400">Loading your Legacy Tree™…</p>}>
        <FamilyMembers />
      </Suspense>
    </main>
  );
}
