"use client";

import { useActionState } from "react";
import { deleteTreeMilestone, saveMilestoneAdminConsent, saveTreeMilestone, type MilestoneState } from "@/app/actions/tree-milestones";
import type { TreeMilestone } from "@/lib/tree-milestones";

export type MilestonePerson = {
  id: string;
  type: "user" | "placeholder" | "future";
  name: string;
  canEdit: boolean;
};

const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white";
const buttonClass = "mt-3 min-h-11 rounded-full border border-[#D8A35B]/60 px-5 text-sm font-semibold text-[#f0c98e] disabled:opacity-60";

function ActionForm({ action, children, label, confirmRemoval }: {
  action: (state: MilestoneState, form: FormData) => Promise<MilestoneState>;
  children: React.ReactNode;
  label: string;
  confirmRemoval?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3" onSubmit={(event) => {
      if (confirmRemoval && !window.confirm("Remove this milestone?")) event.preventDefault();
    }}>
      {children}
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving…" : label}</button>
      <p role="status" aria-live="polite" className={`text-sm ${state.error ? "text-rose-300" : "text-[#f0c98e]"}`}>{state.error ?? state.success ?? ""}</p>
    </form>
  );
}

export function AdminConsent({ treeId, allowed }: { treeId: string; allowed: boolean }) {
  return (
    <details className="mt-4 rounded-xl border border-white/10 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-white">My milestone editing permission</summary>
      <p className="mt-3 text-sm text-slate-400">You control your milestones. Allowing tree owners and admins to manage them also lets them share those milestones with this tree. You can revoke editing permission here.</p>
      <ActionForm action={saveMilestoneAdminConsent} label="Save Permission">
        <input type="hidden" name="treeId" value={treeId} />
        <label className="flex items-start gap-2 text-sm text-slate-200"><input name="allow" type="checkbox" defaultChecked={allowed} className="mt-1 accent-[#D8A35B]" />Allow this tree&apos;s owners and admins to manage my milestones</label>
      </ActionForm>
    </details>
  );
}

export function MilestoneForm({ treeId, person, milestone }: {
  treeId: string;
  person: MilestonePerson;
  milestone?: TreeMilestone;
}) {
  return (
    <ActionForm action={saveTreeMilestone} label={milestone ? "Save Changes" : "Add Milestone"}>
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="subjectType" value={person.type} />
      <input type="hidden" name="subjectId" value={person.id} />
      {milestone && <input type="hidden" name="milestoneId" value={milestone.id} />}
      {milestone ? (
        <input type="hidden" name="kind" value={milestone.kind} />
      ) : (
        <label className="block text-sm text-slate-200">Milestone type
          <select name="kind" defaultValue="birthday" className={fieldClass}>
            <option value="birthday">Birthday</option>
            <option value="anniversary">Anniversary</option>
            <option value="wedding">Wedding Anniversary</option>
            <option value="graduation">Graduation</option>
            <option value="custom">Custom Family Milestone</option>
          </select>
        </label>
      )}
      {(!milestone || milestone.kind === "custom") && <label className="block text-sm text-slate-200">Custom milestone name <span className="text-slate-400">(for custom milestones)</span><input name="title" maxLength={120} defaultValue={milestone?.kind === "custom" ? milestone.title : ""} className={fieldClass} /></label>}
      <p className="text-xs leading-5 text-slate-400">Enter what you know. A day requires a month; a day without a year must repeat yearly. Leave unknown dates blank.</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-sm text-slate-200">Month<input type="number" name="month" min="1" max="12" defaultValue={milestone?.month ?? ""} className={fieldClass} /></label>
        <label className="block text-sm text-slate-200">Day<input type="number" name="day" min="1" max="31" defaultValue={milestone?.day ?? ""} className={fieldClass} /></label>
        <label className="block text-sm text-slate-200">Year<input type="number" name="year" min="1000" max="9999" defaultValue={milestone?.year ?? ""} className={fieldClass} /></label>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-200"><input name="repeatsYearly" type="checkbox" defaultChecked={milestone?.repeatsYearly ?? false} className="mt-1 accent-[#D8A35B]" />Repeat yearly (birthdays and anniversaries repeat when month and day are known)</label>
      <p className="text-xs text-slate-400">Saving shares this milestone with members of this Legacy Tree™.</p>
    </ActionForm>
  );
}

export function DeleteMilestone({ treeId, milestoneId }: { treeId: string; milestoneId: string }) {
  return (
    <ActionForm action={deleteTreeMilestone} label="Remove Milestone" confirmRemoval>
      <input type="hidden" name="treeId" value={treeId} />
      <input type="hidden" name="milestoneId" value={milestoneId} />
    </ActionForm>
  );
}
