import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageSuccessor, getOwnSuccessor, getSuccessorCandidates } from "@/lib/successor";
import SuccessorControls from "./successor-controls";

export const metadata: Metadata = { title: "Legacy Successor | Never Say Goodbye" };
export const instant = false;

export default async function SuccessorPage({ searchParams }: {
  searchParams: Promise<{ search?: string }>;
}) {
  const user = await requireUser();
  if (!await canManageSuccessor(user.id)) notFound();
  const search = (await searchParams).search?.trim().slice(0, 100) ?? "";
  const [assignment, candidates] = await Promise.all([
    getOwnSuccessor(user.id), getSuccessorCandidates(user.id, search),
  ]);
  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">My Legacy</Link>
        <h1 className="mt-8 font-serif text-4xl text-white">Legacy Successor™</h1>
        <p className="mt-4 leading-7 text-slate-300">
          Choose one trusted person to inherit your Never Say Goodbye™ Lifetime Membership if you stop using your account.
        </p>
        <p className="mt-3 text-sm text-slate-300">A Lifetime Membership can be transferred once.</p>
        <form className="mt-6 flex flex-wrap gap-2">
          <label htmlFor="search" className="sr-only">Find a person</label>
          <input id="search" name="search" defaultValue={search} placeholder="Find a person by name or username"
            className="min-w-0 flex-1 rounded-xl border border-[color:var(--nsg-border)]/30 bg-slate-900 p-3 text-white" />
          <button className="rounded-xl border border-[color:var(--nsg-border)]/30 px-4 py-2">Find</button>
        </form>
        {candidates.length === 0 && <p className="mt-4 text-sm text-slate-300">No eligible people found. Try another name.</p>}
        <SuccessorControls assignment={assignment} candidates={candidates} />
      </div>
    </main>
  );
}
