"use client";

import { useActionState } from "react";
import {
  addRelationshipMilestone,
  createCalendarEvent,
  createFamilyBulletin,
  enableCalendarImports,
  saveCalendarProfile,
  saveCalendarReminders,
  saveTreeSourceDate,
  type CalendarActionState,
} from "@/app/actions/family-calendar";

const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white";
const buttonClass = "mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--nsg-accent)]/60 px-6 py-2 text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:bg-[color:var(--nsg-accent)]/10 disabled:opacity-60";

type Action = (state: CalendarActionState, form: FormData) => Promise<CalendarActionState>;

function ActionForm({ action, children, label }: { action: Action; children: React.ReactNode; label: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {children}
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving…" : label}</button>
      <p role="status" aria-live="polite" className={`text-sm ${state.error ? "text-rose-300" : "text-[color:var(--nsg-accent-light)]"}`}>
        {state.error ?? state.success ?? ""}
      </p>
    </form>
  );
}

export type CalendarProfile = {
  birthDate: string; birthYear: string; memorialDate: string;
  shareBirthday: boolean; shareAnniversary: boolean;
  shareMemorialDate: boolean; shareMilestones: boolean;
};
export type Reminders = { dayOf: boolean; oneDay: boolean; oneWeek: boolean; oneMonth: boolean };
export type SourceRecord = {
  id: string; name: string; type: "placeholder" | "future" | "connection" | "user";
  firstDate: string; secondDate: string; canAnniversary: boolean; canMilestones: boolean;
};

function Checkbox({ name, label, checked }: { name: string; label: string; checked?: boolean }) {
  return <label className="flex items-center gap-3 text-sm text-slate-200"><input name={name} type="checkbox" defaultChecked={checked} className="h-4 w-4 accent-[color:var(--nsg-accent)]" />{label}</label>;
}

export function ProfileDates({ profile, open = false }: { profile: CalendarProfile; open?: boolean }) {
  return (
    <details open={open} className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
      <summary className="cursor-pointer font-serif text-xl text-white">My Family Dates &amp; Sharing</summary>
      <p className="my-4 text-sm leading-6 text-slate-400">Your full birthday and memorial date are private until you choose to share them with your tree members. A birth year alone cannot appear on the calendar; a full date is required. Anniversaries and relationship milestones require both connected people to share and belong to the same tree.</p>
      <ActionForm action={saveCalendarProfile} label="Save My Dates">
        <label className="block text-sm text-slate-200">Full Birthday <input type="date" name="birthDate" defaultValue={profile.birthDate} className={fieldClass} /></label>
        <label className="block text-sm text-slate-200">Birth Year Only <input type="number" name="birthYear" min="1000" max="9999" defaultValue={profile.birthYear} className={fieldClass} /></label>
        <label className="block text-sm text-slate-200">Memorial Date <input type="date" name="memorialDate" defaultValue={profile.memorialDate} className={fieldClass} /></label>
        <Checkbox name="shareBirthday" label="Share Birthday" checked={profile.shareBirthday} />
        <Checkbox name="shareAnniversary" label="Share Anniversary" checked={profile.shareAnniversary} />
        <Checkbox name="shareMemorialDate" label="Share Memorial Date" checked={profile.shareMemorialDate} />
        <Checkbox name="shareMilestones" label="Share Relationship Milestones" checked={profile.shareMilestones} />
      </ActionForm>
    </details>
  );
}

export function ReminderSettings({ reminders }: { reminders: Reminders }) {
  return (
    <details className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
      <summary className="cursor-pointer font-serif text-xl text-white">🔔 Reminder Settings</summary>
      <p className="my-4 text-sm text-slate-400">Preferences are saved for future reminders. Notifications are not sent yet.</p>
      <ActionForm action={saveCalendarReminders} label="Save Reminder Settings">
        <Checkbox name="dayOf" label="Day Of" checked={reminders.dayOf} />
        <Checkbox name="oneDay" label="1 Day Before" checked={reminders.oneDay} />
        <Checkbox name="oneWeek" label="1 Week Before" checked={reminders.oneWeek} />
        <Checkbox name="oneMonth" label="1 Month Before" checked={reminders.oneMonth} />
      </ActionForm>
    </details>
  );
}

export function ImportDates({ treeId }: { treeId: string }) {
  return <ActionForm action={enableCalendarImports} label="🌳 Enable Family Date Sync"><input type="hidden" name="treeId" value={treeId} /></ActionForm>;
}

export function ManualEvent({ treeId }: { treeId: string }) {
  return (
    <details className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
      <summary className="cursor-pointer font-serif text-xl text-white">Add Family Event</summary>
      <p className="my-4 text-sm text-slate-400">This event is visible to members of the selected Legacy Tree™.</p>
      <ActionForm action={createCalendarEvent} label="Add Event">
        <input type="hidden" name="treeId" value={treeId} />
        <label className="block text-sm text-slate-200">Event Name <input name="title" required maxLength={120} className={fieldClass} placeholder="Family Reunion" /></label>
        <label className="block text-sm text-slate-200">Date <input name="date" type="date" required className={fieldClass} /></label>
        <Checkbox name="repeatsYearly" label="Repeat yearly" />
      </ActionForm>
    </details>
  );
}

export function BulletinForm({ treeId }: { treeId: string }) {
  return (
    <ActionForm action={createFamilyBulletin} label="Share Shout-Out">
      <input type="hidden" name="treeId" value={treeId} />
      <div>
        <label htmlFor="shout-out-message" className="block text-sm text-slate-400">What&apos;s happening with the family today?</label>
        <textarea id="shout-out-message" name="message" required rows={3} aria-describedby="shout-out-limit" className={fieldClass} onInput={(event) => {
          event.currentTarget.setCustomValidity(Array.from(event.currentTarget.value.trim()).length > 300
            ? "Enter no more than 300 characters." : "");
        }} />
        <p id="shout-out-limit" className="mt-1 text-xs text-slate-400">300 characters maximum</p>
      </div>
    </ActionForm>
  );
}

export function SourceDateEditor({ treeId, record }: { treeId: string; record: SourceRecord }) {
  return (
    <div>
      {(record.type !== "connection" || record.canAnniversary) && (
        <ActionForm action={saveTreeSourceDate} label="Save Changes">
          <input type="hidden" name="treeId" value={treeId} />
          <input type="hidden" name="sourceId" value={record.id} />
          <input type="hidden" name="sourceType" value={record.type} />
          <label className="block text-sm text-slate-200">
            {record.type === "placeholder" || record.type === "user" ? "Birthday" : record.type === "future" ? "Expected Birth Date" : "Anniversary Date"}
            <input type="date" name="firstDate" defaultValue={record.firstDate} className={fieldClass} />
          </label>
          {record.type === "placeholder" && <label className="block text-sm text-slate-200">Memorial Date <input type="date" name="secondDate" defaultValue={record.secondDate} className={fieldClass} /></label>}
        </ActionForm>
      )}
      {record.type === "connection" && record.canMilestones && (
        <div className={record.canAnniversary ? "mt-4 border-t border-[color:var(--nsg-border)]/10 pt-4" : ""}>
          <ActionForm action={addRelationshipMilestone} label="Add Relationship Milestone">
            <input type="hidden" name="treeId" value={treeId} />
            <input type="hidden" name="sourceId" value={record.id} />
            <label className="block text-sm text-slate-200">Milestone <input name="title" required maxLength={120} className={fieldClass} /></label>
            <label className="block text-sm text-slate-200">Date <input type="date" name="date" required className={fieldClass} /></label>
            <Checkbox name="repeatsYearly" label="Repeat yearly" />
          </ActionForm>
        </div>
      )}
    </div>
  );
}
