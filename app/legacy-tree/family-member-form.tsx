"use client";

import { useActionState, useState } from "react";
import {
  addFamilyMember,
  type AddFamilyMemberState,
} from "@/app/actions/family-tree";
import { positionRelationship } from "@/lib/tree-positioning";

type FamilyTreeOption = { id: string; name: string; ownerName: string; partners: { type: string; id: string; name: string }[] };
type MomentMakerOption = { id: string; displayName: string };
type MemberType = "existing" | "future" | "placeholder";

const fieldClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20";

export default function FamilyMemberForm({
  trees,
  momentMakers,
}: {
  trees: FamilyTreeOption[];
  momentMakers: MomentMakerOption[];
}) {
  const [memberType, setMemberType] = useState<MemberType>("placeholder");
  const [selectedTreeId, setSelectedTreeId] = useState(trees[0]?.id ?? "");
  const [relationship, setRelationship] = useState("");
  const [state, formAction, isPending] = useActionState<
    AddFamilyMemberState,
    FormData
  >(addFamilyMember, {});
  const selectedTree = trees.find((tree) => tree.id === selectedTreeId);
  const position = positionRelationship(relationship);

  if (trees.length === 0) {
    return (
      <p className="mt-5 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
        Create or join a Legacy Tree™ before adding family members.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <label className="block text-sm font-medium text-slate-200">
        Legacy Tree™
        <select name="treeId" required className={fieldClassName} value={selectedTreeId} onChange={(event) => setSelectedTreeId(event.target.value)}>
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
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] px-4 py-3 text-sm text-white transition hover:border-[color:var(--nsg-accent)]/35 has-[:checked]:border-[color:var(--nsg-accent)]/60 has-[:checked]:bg-[color:var(--nsg-accent)]/[0.06]"
            >
              <input
                type="radio"
                name="memberType"
                value={value}
                checked={memberType === value}
                onChange={() => setMemberType(value)}
                className="h-4 w-4 accent-[color:var(--nsg-accent)]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-sm leading-6 text-slate-400">
        Enter the relationship to the tree owner, or choose a partner&apos;s family line for their parents or grandparents.
      </p>

      {memberType === "existing" ? (
        <>
          <p className="text-sm leading-6 text-slate-400">
            Adding a Moment Maker™ makes them a member of this tree. It does not create a Connected Lives™ connection or automatically share dates.
          </p>
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
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
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
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
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
              <p className="rounded-xl border border-[color:var(--nsg-accent)]/20 bg-[color:var(--nsg-accent)]/[0.05] p-4 text-sm leading-6 text-slate-300">
                Family Placeholders do not have accounts, cannot log in, and
                cannot receive email or notifications. They preserve family
                connections in your Legacy Tree™.
              </p>
            </>
          )}
        </>
      )}

      {position && position.generation > 0 && selectedTree && selectedTree.partners.length > 0 && (
        <label className="block text-sm font-medium text-slate-200">
          Family line
          <select key={selectedTreeId} name="linePartner" defaultValue="owner" className={fieldClassName}>
            <option value="owner">{selectedTree.ownerName}&apos;s family line</option>
            {selectedTree.partners.map((partner) => (
              <option key={`${partner.type}:${partner.id}`} value={`${partner.type}:${partner.id}`}>
                {partner.name}&apos;s family line
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--nsg-accent)] px-7 py-3 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
      >
        {isPending ? "Adding…" : "Add Family Member"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-6 text-sm ${state.error ? "text-rose-300" : "text-[color:var(--nsg-accent-light)]"}`}
      >
        {state.error ?? state.success ?? ""}
      </p>
      {state.success && state.treeId && (
        <a
          href={`#legacy-tree-item-${encodeURIComponent(state.treeId)}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 hover:text-white"
        >
          View My Tree
        </a>
      )}
    </form>
  );
}
