"use client";

import Link from "next/link";
import { useActionState } from "react";
import { removeSuccessor, saveSuccessor } from "@/app/actions/successor";
import type { SuccessorDesignation } from "@/lib/successor";

export default function SuccessorControls({ designation, candidates }: {
  designation: SuccessorDesignation | null;
  candidates: { id: string; name: string }[];
}) {
  const [saveState, saveAction, saving] = useActionState(saveSuccessor, {});
  const [removeState, removeAction, removing] = useActionState(removeSuccessor, {});
  return (
    <>
      <div className="mt-6 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
        <h2 className="font-serif text-xl text-white">Current designation</h2>
        <p className="mt-3 text-slate-200">
          {designation ? designation.name : "Not Assigned"}
          {designation && !designation.available && <span className="ml-2 text-sm text-slate-400">Unavailable or no longer connected</span>}
        </p>
        {designation && <form action={removeAction} className="mt-4">
          <button disabled={removing || saving} className="rounded-full border border-[color:var(--nsg-border)]/30 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50">
            {removing ? "Removing…" : "Remove designation"}
          </button>
          <p role="status" className="mt-2 text-sm text-slate-300">{removeState.error ?? removeState.success}</p>
        </form>}
      </div>
      {candidates.length ? <form action={saveAction} className="mt-6">
        <label htmlFor="successorId" className="block text-sm font-semibold text-slate-200">
          {designation ? "Choose a replacement" : "Choose a Connected Lives™ member"}
        </label>
        <select id="successorId" name="successorId" defaultValue="" required
          className="mt-2 block w-full rounded-xl border border-[color:var(--nsg-border)]/30 bg-slate-900 p-3 text-white">
          <option value="" disabled>Select a person</option>
          {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
        <button disabled={saving || removing} className="mt-4 rounded-full border border-[color:var(--nsg-accent)]/50 px-5 py-3 text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:bg-white/5 disabled:opacity-50">
          {saving ? "Saving…" : designation ? "Replace successor" : "Assign successor"}
        </button>
        <p role="status" className="mt-2 text-sm text-slate-300">{saveState.error ?? saveState.success}</p>
      </form> : <p className="mt-6 text-sm leading-6 text-slate-300">
        No accepted connections are available. Visit <Link href="/connected-lives" className="text-[color:var(--nsg-accent-light)] underline">Connected Lives™</Link> to connect with someone.
      </p>}
    </>
  );
}
