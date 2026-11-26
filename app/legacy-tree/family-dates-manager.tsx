"use client";

import { useEffect, useState } from "react";
import { ProfileDates, SourceDateEditor, type CalendarProfile, type SourceRecord } from "@/app/family-calendar/calendar-forms";
import { milestoneDate, type TreeMilestone } from "@/lib/tree-milestones";
import { DeleteMilestone, MilestoneForm, type MilestonePerson } from "./milestone-forms";

function personKey(type: string, id: string) {
  return JSON.stringify([type, id]);
}

export default function FamilyDatesManager({ treeId, userId, people, milestones, sources, profile }: {
  treeId: string;
  userId: string;
  people: MilestonePerson[];
  milestones: TreeMilestone[];
  sources: SourceRecord[];
  profile: CalendarProfile;
}) {
  const [selected, setSelected] = useState("");
  const sortedPeople = [...people].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const relationships = sources.filter((source) => source.type === "connection");
  const person = people.find((item) => personKey(item.type, item.id) === selected);
  const relationship = relationships.find((item) => personKey(item.type, item.id) === selected);
  const source = relationship ?? (person && sources.find((item) => item.type === person.type && item.id === person.id));
  const items = person ? milestones.filter((item) => item.subjectType === person.type && item.subjectId === person.id) : [];
  const isSelf = person?.type === "user" && person.id === userId;

  useEffect(() => {
    function selectFromCard(event: Event) {
      if (!(event instanceof CustomEvent)) return;
      const { treeId: targetTree, type, id } = event.detail ?? {};
      if (targetTree === treeId && people.some((item) => item.type === type && item.id === id)) {
        setSelected(personKey(type, id));
      }
    }
    window.addEventListener("nsg:edit-family-dates", selectFromCard);
    return () => window.removeEventListener("nsg:edit-family-dates", selectFromCard);
  }, [treeId, people]);

  return (
    <section id={`family-dates-${treeId}`} aria-labelledby={`family-dates-heading-${treeId}`} className="mt-5 scroll-mt-6">
      <h4 id={`family-dates-heading-${treeId}`} className="font-serif text-xl text-white">📅 Manage Family Dates</h4>
      {people.length || relationships.length ? (
        <label className="mt-4 block text-sm text-slate-200">
          Who would you like to update?
          <select value={person || relationship ? selected : ""} onChange={(event) => setSelected(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950 px-3 text-sm text-white">
            <option value="">Select a family member</option>
            {sortedPeople.length > 0 && <optgroup label="Family Members">
              {sortedPeople.map((item) => <option key={personKey(item.type, item.id)} value={personKey(item.type, item.id)}>{item.name}{item.type === "user" && item.id === userId ? " (You)" : ""}</option>)}
            </optgroup>}
            {relationships.length > 0 && <optgroup label="Shared Relationships">
              {relationships.map((item) => <option key={personKey(item.type, item.id)} value={personKey(item.type, item.id)}>{item.name}</option>)}
            </optgroup>}
          </select>
        </label>
      ) : <p className="mt-3 text-sm text-slate-400">No family members are available in this tree yet.</p>}

      {(person || relationship) && (
        <div key={selected} className="mt-5 space-y-4">
          <h5 className="break-words font-serif text-lg text-white">{person?.name ?? relationship?.name}</h5>
          {isSelf && <ProfileDates profile={profile} open />}
          {source && <SourceDateEditor treeId={treeId} record={source} />}
          {person && !isSelf && !source && <p className="text-sm text-slate-400">
            {person.canEdit && person.type === "user"
              ? "A shared birthday can be edited only when this person has shared it and allowed editing."
              : "You can view available milestones, but cannot edit this person’s saved family dates."}
          </p>}
          {person && items.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[color:var(--nsg-accent-light)]">Manage Existing Dates →</summary>
              <ul className="mt-3 space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-[color:var(--nsg-border)]/10 p-3">
                    <p className="font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{milestoneDate(item)}{item.repeatsYearly ? " · Repeats yearly" : ""}</p>
                    {item.canEdit && <>
                      <details className="mt-3"><summary className="cursor-pointer text-sm text-[color:var(--nsg-accent-light)]">Edit milestone</summary><div className="mt-3"><MilestoneForm treeId={treeId} person={person} milestone={item} /></div></details>
                      <DeleteMilestone treeId={treeId} milestoneId={item.id} />
                    </>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {person?.canEdit && <details>
            <summary className="cursor-pointer text-sm font-semibold text-[color:var(--nsg-accent-light)]">Add a milestone for {person.name}</summary>
            <div className="mt-3"><MilestoneForm treeId={treeId} person={person} /></div>
          </details>}
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-slate-400">How sharing works</summary>
        <p className="mt-2 text-sm leading-6 text-slate-400">Tree owners and admins can add full dates to family placeholders and Future Moment Makers™, and manage shared account birthdays when the account holder has granted editing permission. Account birthday changes apply across trees. A birth year alone cannot appear on a calendar day. These dates are visible to all members of this tree. Anniversaries and relationship milestones require an accepted Connected Lives™ connection, both people in this tree, and both to share the relevant dates.</p>
      </details>
    </section>
  );
}
