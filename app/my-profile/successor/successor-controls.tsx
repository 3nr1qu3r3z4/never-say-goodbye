"use client";

import { useActionState, useState } from "react";
import { removeSuccessor, saveSuccessor } from "@/app/actions/successor";
import type { SuccessorAssignment } from "@/lib/successor";

export default function SuccessorControls({ assignment, candidates }: {
  assignment: SuccessorAssignment | null;
  candidates: { id: string; name: string; username: string }[];
}) {
  const [state, action, saving] = useActionState(saveSuccessor, {});
  const [removeState, removeAction, removing] = useActionState(removeSuccessor, {});
  const [trigger, setTrigger] = useState(String(assignment?.inactivityDays ?? 30));
  const selectedIncluded = candidates.some((candidate) => candidate.id === assignment?.successorId);
  return (
    <>
      {assignment && !assignment.valid && <p role="alert" className="mt-5 text-amber-200">
        Your successor is no longer available or already has Lifetime Membership. Choose another person.
      </p>}
      <form action={action} className="mt-6 space-y-6">
        <div>
          <label htmlFor="successorId" className="block font-semibold text-slate-200">Choose your successor</label>
          <select id="successorId" name="successorId" required defaultValue={assignment?.successorId ?? ""}
            className="mt-2 block w-full rounded-xl border border-[color:var(--nsg-border)]/30 bg-slate-900 p-3 text-white">
            <option value="" disabled>Select a person</option>
            {assignment?.valid && assignment.successorId && !selectedIncluded &&
              <option value={assignment.successorId}>{assignment.name}</option>}
            {candidates.map((person) => <option key={person.id} value={person.id}>{person.name} (@{person.username})</option>)}
          </select>
        </div>
        <fieldset>
          <legend className="font-semibold text-slate-200">Transfer begins:</legend>
          <div className="mt-3 space-y-3">
            {[["30", "After 30 days inactive"], ["60", "After 60 days inactive"],
              ["90", "After 90 days inactive"], ["now", "Transfer now"]].map(([value, label]) =>
              <label key={value} className="flex items-center gap-3 text-slate-200">
                <input type="radio" name="trigger" value={value} checked={trigger === value}
                  onChange={() => setTrigger(value)} className="accent-[color:var(--nsg-accent)]" />
                {label}
              </label>)}
          </div>
        </fieldset>
        {trigger === "now" && <label className="flex items-start gap-3 text-sm text-slate-200">
          <input type="checkbox" name="confirmTransfer" required className="mt-1 accent-[color:var(--nsg-accent)]" />
          I understand this transfer is permanent and my account will become Free.
        </label>}
        <button disabled={saving || removing} className="rounded-full bg-[color:var(--nsg-accent)] px-6 py-3 font-semibold text-[color:var(--nsg-background)] disabled:opacity-50">
          {saving ? "Saving…" : trigger === "now" ? "Transfer Lifetime Membership" : "Save successor"}
        </button>
        <p role="status" className="text-sm text-slate-300">{state.error ?? state.success}</p>
      </form>
      {assignment && <form action={removeAction} className="mt-5">
        <button disabled={saving || removing} className="text-sm text-slate-300 underline disabled:opacity-50">
          {removing ? "Removing…" : "Remove successor"}
        </button>
        <p role="status" className="mt-2 text-sm text-slate-300">{removeState.error ?? removeState.success}</p>
      </form>}
    </>
  );
}
