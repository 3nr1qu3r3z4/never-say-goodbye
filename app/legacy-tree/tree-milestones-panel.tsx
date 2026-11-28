import { getCalendarEvents, getCalendarSettings, getEditableCalendarSources } from "@/lib/family-calendar-data";
import { getTreeMilestones } from "@/lib/tree-milestones-data";
import { AdminConsent, type MilestonePerson } from "./milestone-forms";
import FamilyDatesManager from "./family-dates-manager";

export default async function TreeMilestonesPanel({ treeId, userId, people, isAdmin, allowAdmin }: {
  treeId: string;
  userId: string;
  people: MilestonePerson[];
  isAdmin: boolean;
  allowAdmin: boolean;
}) {
  const [milestones, legacyEvents, settings, sources] = await Promise.all([
    getTreeMilestones(userId, treeId),
    getCalendarEvents(userId, treeId),
    getCalendarSettings(userId),
    isAdmin ? getEditableCalendarSources(userId, treeId) : Promise.resolve([]),
  ]);
  const familyDates = legacyEvents.filter((event) => !event.id.startsWith("event:"));
  const existingDates = familyDates.filter((event) => event.source !== "Connected Lives™");
  const sharedDates = familyDates.filter((event) => event.source === "Connected Lives™");
  return (
    <section aria-label="Family Milestones" className="mt-6 rounded-3xl border border-[color:var(--nsg-accent)]/25 bg-slate-950/20 p-4 sm:p-6">
      <h3 className="font-serif text-2xl text-white">🎂 Family Milestones</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">Save family milestones here. Approved milestones appear in the tree owner&apos;s Family Calendar™ automatically. A month-only or undated milestone appears separately until an exact day is known. Manage an existing full birthday in the previously saved family dates below instead of adding it again.</p>
      <FamilyDatesManager key={treeId} treeId={treeId} userId={userId} people={people} milestones={milestones} sources={sources} profile={settings.profile} />
      {existingDates.length > 0 && <details className="mt-5">
        <summary className="cursor-pointer text-sm font-semibold text-[color:var(--nsg-accent-light)]">View Existing Family Dates →</summary>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">{existingDates.map((event) => <li key={event.id}>{event.title} · {event.date}</li>)}</ul>
      </details>}
      {sharedDates.length > 0 && <details className="mt-5">
        <summary className="cursor-pointer text-sm font-semibold text-[color:var(--nsg-accent-light)]">View Shared Family Dates →</summary>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">{sharedDates.map((event) => <li key={event.id}>{event.title} · {event.date}</li>)}</ul>
      </details>}
      <div className="mt-5 space-y-3">
        <AdminConsent treeId={treeId} allowed={allowAdmin} />
      </div>
    </section>
  );
}
