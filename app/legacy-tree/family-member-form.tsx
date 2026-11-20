"use client";

import { useActionState, useState } from "react";
import {
  addFamilyMember,
  type AddFamilyMemberState,
} from "@/app/actions/family-tree";

type FamilyTreeOption = { id: string; name: string };
type MomentMakerOption = { id: string; displayName: string };
type MemberType = "existing" | "future" | "placeholder";

const fieldClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

export default function FamilyMemberForm({
  trees,
  momentMakers,
}: {
  trees: FamilyTreeOption[];
  momentMakers: MomentMakerOption[];
}) {
  const [memberType, setMemberType] = useState<MemberType>("placeholder");
  const [state, formAction, isPending] = useActionState<
    AddFamilyMemberState,
    FormData
  >(addFamilyMember, {});

  if (trees.length === 0) {
    return (
      <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
        Create or join a Legacy Tree™ before adding family members.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <label className="block text-sm font-medium text-slate-200">
        Legacy Tree™
        <select name="treeId" required className={fieldClassName}>
          {trees.map((tree) => (
            <option key={tree.id} value={tree.id}>
              {tree.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-slate-200">
          Add Family Member
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {([
            ["existing", "Existing Moment Maker™"],
            ["future", "Future Moment Maker™"],
            ["placeholder", "Family Placeholder 🕊️"],
          ] as const).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white transition hover:border-[#D8A35B]/35 has-[:checked]:border-[#D8A35B]/60 has-[:checked]:bg-[#D8A35B]/[0.06]"
            >
              <input
                type="radio"
                name="memberType"
                value={value}
                checked={memberType === value}
                onChange={() => setMemberType(value)}
                className="h-4 w-4 accent-[#D8A35B]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {memberType === "existing" ? (
        <>
          <label className="block text-sm font-medium text-slate-200">
            Existing Moment Maker™
            <select
              name="existingUserId"
              required
              className={fieldClassName}
              defaultValue=""
            >
              <option value="" disabled>
                Select a searchable Moment Maker™
              </option>
              {momentMakers.map((maker) => (
                <option key={maker.id} value={maker.id}>
                  {maker.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Relationship
            <input
              name="relationship"
              required
              maxLength={80}
              className={fieldClassName}
              placeholder="e.g. Sister"
            />
          </label>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium text-slate-200">
            Name
            <input
              name="name"
              required
              maxLength={120}
              className={fieldClassName}
              placeholder="Enter their name"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Relationship
            <input
              name="relationship"
              required
              maxLength={80}
              className={fieldClassName}
              placeholder="e.g. Grandmother"
            />
          </label>
          {memberType === "placeholder" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-200">
                  Birth Year <span className="text-slate-500">(Optional)</span>
                  <input
                    name="birthYear"
                    type="number"
                    min="1000"
                    max="9999"
                    step="1"
                    className={fieldClassName}
                    placeholder="e.g. 1942"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-200">
                  Death Year <span className="text-slate-500">(Optional)</span>
                  <input
                    name="deathYear"
                    type="number"
                    min="1000"
                    max="9999"
                    step="1"
                    className={fieldClassName}
                    placeholder="e.g. 2018"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-200">
                Notes <span className="text-slate-500">(Optional)</span>
                <textarea
                  name="notes"
                  maxLength={1000}
                  rows={3}
                  className={`${fieldClassName} py-3`}
                  placeholder="Add a little context for future generations"
                />
              </label>
              <p className="rounded-xl border border-[#D8A35B]/20 bg-[#D8A35B]/[0.05] p-4 text-sm leading-6 text-slate-300">
                Family Placeholders do not have accounts, cannot log in, and
                cannot receive email or notifications. They preserve family
                connections in your Legacy Tree™.
              </p>
            </>
          )}
        </>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#D8A35B] px-7 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-[#e6b66f] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
      >
        {isPending ? "Adding…" : "Add Family Member"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-6 text-sm ${state.error ? "text-rose-300" : "text-[#f0c98e]"}`}
      >
        {state.error ?? state.success ?? ""}
      </p>
      {state.success && state.treeId && (
        <a
          href={`#legacy-tree-item-${encodeURIComponent(state.treeId)}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[#f0c98e] underline decoration-[#D8A35B]/40 underline-offset-4 hover:text-white"
        >
          View My Tree
        </a>
      )}
    </form>
  );
}
