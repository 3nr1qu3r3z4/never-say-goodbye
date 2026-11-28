import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCalendarEvents, getCalendarSettings } from "@/lib/family-calendar-data";
import { getTreeMilestones } from "@/lib/tree-milestones-data";
import { milestoneDate } from "@/lib/tree-milestones";
import { calendarEventIcon, datedCalendarMilestones, occurrences, upcomingOccurrences, validCalendarDate, type CalendarEvent } from "@/lib/family-calendar";
import FamilyFeed from "@/app/family-feed";
import { CalendarActions } from "./calendar-forms";
import UpcomingFamilyMoments from "./upcoming-family-moments";

export const metadata: Metadata = {
  title: "Family Calendar™ | Never Say Goodbye",
  description: "Remember the dates and milestones that bring your family together.",
};
export const instant = false;

const dayMs = 24 * 60 * 60 * 1000;
const dateText = (date: Date) => date.toISOString().slice(0, 10);
const readable = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

function EventList({ events }: { events: CalendarEvent[] }) {
  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li key={`${event.id}-${event.date}`} className="rounded-lg border border-[color:var(--nsg-accent)]/20 bg-[color:var(--nsg-accent)]/[0.07] p-2 text-sm text-slate-100">
          <span className="block break-words"><span aria-hidden="true">{calendarEventIcon(event.id)} </span>{event.title}</span>
          <span className="block text-xs text-slate-400">Source: {event.source}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function FamilyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ tree?: string; view?: string; date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { reminders, trees } = await getCalendarSettings(user.id);
  const selected = trees.find((tree) => tree.ownerId === user.id);
  const view = params.view ?? "month";
  if (!["month", "week", "agenda"].includes(view)) notFound();
  const anchor = params.date ?? dateText(new Date());
  if (!validCalendarDate(anchor) || Number(anchor.slice(0, 4)) < 1000 || Number(anchor.slice(0, 4)) > 9998) notFound();

  const base = new Date(`${anchor}T00:00:00Z`);
  const monthStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const start = view === "month"
    ? new Date(monthStart.getTime() - monthStart.getUTCDay() * dayMs)
    : view === "week"
      ? new Date(base.getTime() - base.getUTCDay() * dayMs)
      : base;
  const count = view === "month" ? 42 : view === "week" ? 7 : 90;
  const end = new Date(start.getTime() + (count - 1) * dayMs);
  const [legacyEvents, milestones] = selected
    ? await Promise.all([
        getCalendarEvents(user.id, selected.id),
        getTreeMilestones(user.id, selected.id),
      ])
    : [[], []];
  const datedMilestones = datedCalendarMilestones(milestones);
  const partialMilestones = milestones.filter((milestone) => milestone.month === null || milestone.day === null);
  const allEvents = [...legacyEvents, ...datedMilestones];
  const events = occurrences(allEvents, dateText(start), dateText(end));
  const today = dateText(new Date());
  const tomorrow = dateText(new Date(new Date(`${today}T00:00:00Z`).getTime() + dayMs));
  const upcoming = upcomingOccurrences(allEvents, today);
  const link = (nextView: string, date = anchor) => {
    const query = new URLSearchParams({ view: nextView, date });
    return `/family-calendar?${query.toString()}`;
  };
  const previous = view === "month"
    ? new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1))
    : new Date(base.getTime() - (view === "week" ? 7 : 90) * dayMs);
  const next = view === "month"
    ? new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1))
    : new Date(base.getTime() + (view === "week" ? 7 : 90) * dayMs);

  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-4 py-12 text-slate-100 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <Link href="/dashboard" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">← My Legacy</Link>
        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">A place for family</p>
          <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">Family Calendar™</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-300">Remember the dates and milestones that bring your family together.</p>
        </header>
        <div className="mt-8">
          <div className="min-w-0">
            {!selected ? (
              <>
                <p className="text-slate-300">Create your Legacy Tree™ to see your family calendar. <Link href="/legacy-tree" className="text-[color:var(--nsg-accent-light)] underline">Explore Legacy Tree™</Link></p>
                <div className="mt-5 flex flex-wrap gap-2"><CalendarActions treeId={null} reminders={reminders} /></div>
              </>
            ) : (
              <>
                <UpcomingFamilyMoments events={upcoming} today={today} tomorrow={tomorrow} />
                <section aria-label="Family calendar" className="rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    {["month", "week", "agenda"].map((item) => (
                      <Link key={item} href={link(item)} aria-current={view === item ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm capitalize ${view === item ? "border-[color:var(--nsg-accent)] bg-[color:var(--nsg-accent)]/15 text-[color:var(--nsg-accent-light)]" : "border-[color:var(--nsg-border)]/10 text-slate-300"}`}>{item}</Link>
                    ))}
                    <CalendarActions treeId={selected.id} reminders={reminders} />
                  </div>
                  <div className="flex gap-4 text-sm text-[color:var(--nsg-accent-light)]">
                    {previous.getUTCFullYear() >= 1000 && <Link href={link(view, dateText(previous))}>← Previous</Link>}
                    <Link href={link(view, dateText(new Date()))}>Today</Link>
                    {next.getUTCFullYear() <= 9998 && <Link href={link(view, dateText(next))}>Next →</Link>}
                  </div>
                </div>
                <h2 className="my-6 font-serif text-2xl text-white">
                  {view === "month" ? readable(anchor, { month: "long", year: "numeric" }) : `${readable(dateText(start), { month: "short", day: "numeric", year: "numeric" })} – ${readable(dateText(end), { month: "short", day: "numeric", year: "numeric" })}`}
                </h2>
                {view === "agenda" ? (
                  events.length ? <div className="space-y-5">{Array.from(new Set(events.map((event) => event.date))).map((date) => <div key={date}><h3 className="mb-2 font-semibold text-[color:var(--nsg-accent-light)]">{readable(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3><EventList events={events.filter((event) => event.date === date)} /></div>)}</div> : <p className="text-sm text-slate-400">No events in this period.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-7">
                    {Array.from({ length: count }, (_, index) => {
                      const date = dateText(new Date(start.getTime() + index * dayMs));
                      return <div key={date} className={`min-w-0 rounded-xl border border-[color:var(--nsg-border)]/10 p-2 ${date.slice(0, 7) !== anchor.slice(0, 7) && view === "month" ? "opacity-60" : ""}`}>
                        <h3 className="mb-2 text-xs font-semibold text-slate-300"><time dateTime={date}>{readable(date, { weekday: "short", month: "short", day: "numeric" })}</time></h3>
                        <EventList events={events.filter((event) => event.date === date)} />
                      </div>;
                    })}
                  </div>
                )}
                {partialMilestones.length > 0 && <section className="mt-6 rounded-xl border border-[color:var(--nsg-border)]/10 p-4">
                  <h3 className="font-serif text-lg text-white">Milestones without an exact day</h3>
                  <p className="mt-1 text-xs text-slate-400">These are not placed on a calendar day until the date is known.</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-200">{partialMilestones.map((milestone) => <li key={milestone.id}>{milestone.personName} {milestone.title} · {milestoneDate(milestone)}</li>)}</ul>
                </section>}
                {!allEvents.length && !partialMilestones.length && <p className="mt-6 rounded-xl border border-[color:var(--nsg-accent)]/20 p-4 text-sm leading-6 text-slate-300">Your Family Calendar is waiting for family dates. Add milestones in your Legacy Tree™ or add a family event here.</p>}
                <p className="mt-5 text-sm text-slate-400">Manage milestones and sharing in <Link href="/legacy-tree" className="text-[color:var(--nsg-accent-light)] underline">Legacy Tree™</Link>.</p>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
      <FamilyFeed initialTreeId={selected?.id ?? null} />
    </main>
  );
}
