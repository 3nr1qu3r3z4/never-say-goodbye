import { getCalendarEvents, getCalendarSettings, getEditableCalendarSources } from "@/lib/family-calendar-data";
import { getTreeMilestones } from "@/lib/tree-milestones-data";
import { milestoneDate } from "@/lib/tree-milestones";
import { ProfileDates, SourceDates } from "@/app/family-calendar/calendar-forms";
import { AdminConsent, DeleteMilestone, MilestoneForm, type MilestonePerson } from "./milestone-forms";

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
  return (
    <section aria-label="Family Milestones" className="mt-6 rounded-3xl border border-[color:var(--nsg-accent)]/25 bg-slate-950/20 p-4 sm:p-6">
      <h3 className="font-serif text-2xl text-white">🎂 Family Milestones</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">Save family milestones here. Tree members can see approved milestones in Family Calendar™ automatically. A month-only or undated milestone appears separately until an exact day is known. Manage an existing full birthday in the previously saved family dates below instead of adding it again.</p>
      <AdminConsent treeId={treeId} allowed={allowAdmin} />
      {people.map((person) => {
        const items = milestones.filter((item) => item.subjectType === person.type && item.subjectId === person.id);
        if (!items.length && !person.canEdit) return null;
        return (
          <div key={`${person.type}-${person.id}`} className="mt-4 rounded-xl border border-[color:var(--nsg-border)]/10 p-4">
            <h4 className="font-serif text-lg text-white">{person.name}</h4>
            {items.length > 0 && <ul className="mt-3 space-y-3">
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
            </ul>}
            {person.canEdit && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-[color:var(--nsg-accent-light)]">Add a milestone for {person.name}</summary><div className="mt-3"><MilestoneForm treeId={treeId} person={person} /></div></details>}
          </div>
        );
      })}
      {familyDates.length > 0 && <div className="mt-5">
        <h4 className="font-serif text-lg text-white">Previously saved family dates</h4>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">{familyDates.map((event) => <li key={event.id}>{event.title} · {event.date}</li>)}</ul>
      </div>}
      <div className="mt-5 space-y-3">
        <ProfileDates profile={settings.profile} />
        {isAdmin && <SourceDates treeId={treeId} records={sources} />}
      </div>
    </section>
  );
}
