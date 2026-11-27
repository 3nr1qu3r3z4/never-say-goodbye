import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOwnSuccessor, getOwnSuccessorCandidates, successorPreviewEnabled } from "@/lib/successor";
import SuccessorControls from "./successor-controls";

export const metadata: Metadata = { title: "Successor Assignment | Never Say Goodbye" };
export const instant = false;

export default async function SuccessorPage() {
  const user = await requireUser();
  if (!successorPreviewEnabled(user.id)) notFound();
  const [designation, candidates] = await Promise.all([getOwnSuccessor(), getOwnSuccessorCandidates()]);
  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Link href="/my-profile" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">My Profile</Link>
        <h1 className="mt-8 font-serif text-4xl text-white">Legacy Successor™</h1>
        <p className="mt-4 leading-7 text-slate-300">
          This designation is informational only and does not grant access, ownership, transfer rights, legal authority, or decision-making authority.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-400">Only you can manage this designation. The person you choose is not notified and is not asked to accept.</p>
        <SuccessorControls designation={designation} candidates={candidates} />
      </div>
    </main>
  );
}
