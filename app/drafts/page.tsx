import type { Metadata } from "next";
import Link from "next/link";
import { getSavedDrafts } from "@/lib/account-data";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "My Drafts | Never Say Goodbye",
  description: "Continue the moments and messages you have saved.",
};
export const instant = false;

const momentTitles = {
  shared: "Shared Moment",
  personal: "Personal Moment",
  "cannot-open-until": "Cannot Open Until™",
  "future-moment-maker": "Future Moment Maker™",
} as const;

export default async function DraftsPage() {
  const user = await requireUser();
  const drafts = getSavedDrafts(user);

  return (
    <main className="min-h-screen bg-[#0F172A] px-5 py-8 text-slate-100 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e]"
        >
          ← My Legacy
        </Link>
        <header className="mt-10 sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Your stories in progress
          </p>
          <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">
            Drafts
          </h1>
          <p className="mt-4 leading-7 text-slate-400">
            Continue a moment whenever you are ready.
          </p>
        </header>

        <section aria-label="Saved drafts" className="mt-8 space-y-3">
          {drafts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="font-serif text-xl text-white">
                No saved drafts yet
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Your unfinished moments will be kept here when you save them.
              </p>
              <Link
                href="/create-moment"
                className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#D8A35B] px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-[#e6b66f]"
              >
                Create A Moment
              </Link>
            </div>
          ) : (
            drafts.map((draft) => (
              <article
                key={draft.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8A35B]">
                    {momentTitles[draft.kind]}
                  </p>
                  <h2 className="mt-2 font-serif text-xl text-white">
                    {draft.title || "Untitled Moment"}
                  </h2>
                  <p className="mt-2 text-xs text-slate-500">
                    Updated {draft.updatedAt}
                  </p>
                </div>
                <Link
                  href={`/create-moment/${draft.kind}`}
                  className="inline-flex min-h-11 items-center justify-center self-start rounded-full border border-[#D8A35B]/60 px-5 py-2.5 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 sm:self-auto"
                >
                  Continue Draft
                </Link>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
