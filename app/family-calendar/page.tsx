import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCalendarEvents, getCalendarSettings, getEditableCalendarSources, getFamilyBulletins } from "@/lib/family-calendar-data";
import { occurrences, validCalendarDate, type CalendarEvent } from "@/lib/family-calendar";
import { BulletinForm, ImportDates, ManualEvent, ProfileDates, ReminderSettings, SourceDates } from "./calendar-forms";

export const metadata: Metadata = {
  title: "Family Calendar™ | Never Say Goodbye",
  description: "Remember the dates and milestones that bring your family together.",
};
export const instant = false;

const dayMs = 24 * 60 * 60 * 1000;
const dateText = (date: Date) => date.toISOString().slice(0, 10);
const readable = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

function eventIcon(id: string) {
  if (id.startsWith("birthday:") || id.startsWith("placeholder-birthday:")) return "🎂";
  if (id.startsWith("memorial:") || id.startsWith("placeholder-memorial:")) return "🕊";
  if (id.startsWith("anniversary:")) return "❤️";
  if (id.startsWith("future:") || id.startsWith("milestone:")) return "✨";
  return "📅";
}

function EventList({ events }: { events: CalendarEvent[] }) {
  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li key={`${event.id}-${event.date}`} className="rounded-lg border border-[#D8A35B]/20 bg-[#D8A35B]/[0.07] p-2 text-sm text-slate-100">
          <span className="block break-words"><span aria-hidden="true">{eventIcon(event.id)} </span>{event.title}</span>
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
  const { profile, reminders, trees } = await getCalendarSettings(user.id);
  const selected = params.tree ? trees.find((tree) => tree.id === params.tree) : trees[0];
  if (params.tree && !selected) notFound();
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
  const [allEvents, sources, bulletins] = selected
    ? await Promise.all([
        getCalendarEvents(user.id, selected.id),
        selected.role === "owner" || selected.role === "admin"
          ? getEditableCalendarSources(user.id, selected.id)
          : Promise.resolve([]),
        getFamilyBulletins(user.id, selected.id),
      ])
    : [[], [], []];
  const events = occurrences(allEvents, dateText(start), dateText(end));
  const link = (nextView: string, date = anchor) => {
    const query = new URLSearchParams({ view: nextView, date });
    if (selected) query.set("tree", selected.id);
    return `/family-calendar?${query.toString()}`;
  };
  const previous = view === "month"
    ? new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1))
    : new Date(base.getTime() - (view === "week" ? 7 : 90) * dayMs);
  const next = view === "month"
    ? new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1))
    : new Date(base.getTime() + (view === "week" ? 7 : 90) * dayMs);

  return (
    <main className="min-h-screen bg-[#0F172A] px-4 py-12 text-slate-100 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <Link href="/dashboard" className="text-sm font-semibold text-[#f0c98e] hover:underline">← My Legacy</Link>
        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">A place for family</p>
          <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">Family Calendar™</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-300">Remember the dates and milestones that bring your family together.</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">For member birthdays and memorial dates: add dates → choose what to share → join the same Legacy Tree™ → enable calendar sync.</p>
        </header>
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-label="Family calendar" className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
            {!selected ? (
              <p className="text-slate-300">Create or join a Legacy Tree™ to see its family calendar. <Link href="/legacy-tree" className="text-[#f0c98e] underline">Explore Legacy Tree™</Link></p>
            ) : (
              <>
                <form action="/family-calendar" className="mb-5">
                  <label htmlFor="tree" className="block text-sm text-slate-300">Family tree</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select id="tree" name="tree" defaultValue={selected.id} className="min-h-11 max-w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white">
                      {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
                    </select>
                    <input type="hidden" name="view" value={view} /><input type="hidden" name="date" value={anchor} />
                    <button className="min-h-11 rounded-xl border border-white/20 px-4 text-sm">View Calendar</button>
                  </div>
                </form>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2" aria-label="Calendar views">
                    {["month", "week", "agenda"].map((item) => (
                      <Link key={item} href={link(item)} aria-current={view === item ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm capitalize ${view === item ? "border-[#D8A35B] bg-[#D8A35B]/15 text-[#f0c98e]" : "border-white/10 text-slate-300"}`}>{item}</Link>
                    ))}
                  </div>
                  <div className="flex gap-4 text-sm text-[#f0c98e]">
                    {previous.getUTCFullYear() >= 1000 && <Link href={link(view, dateText(previous))}>← Previous</Link>}
                    <Link href={link(view, dateText(new Date()))}>Today</Link>
                    {next.getUTCFullYear() <= 9998 && <Link href={link(view, dateText(next))}>Next →</Link>}
                  </div>
                  {selected && (
                    <section id="bulletins" aria-labelledby="bulletin-heading" className="mt-6 scroll-mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                      <h2 id="bulletin-heading" className="font-serif text-2xl text-white">📌 Family Bulletin Board</h2>
                      <p className="mt-2 text-sm text-slate-400">Announcements are visible to members of {selected.name}.</p>
                      <div className="mt-5"><BulletinForm key={selected.id} treeId={selected.id} /></div>
                      {bulletins.length ? (
                        <ol className="mt-5 space-y-3">
                          {bulletins.map((bulletin) => (
                            <li id={`bulletin-${bulletin.id}`} key={bulletin.id} className="scroll-mt-6 rounded-xl border border-white/10 p-4">
                              <p className="font-semibold text-white">{bulletin.authorName}</p>
                              <time dateTime={bulletin.createdAt} className="mt-1 block text-xs text-slate-400">
                                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(bulletin.createdAt))} UTC
                              </time>
                              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{bulletin.message}</p>
                            </li>
                          ))}
                        </ol>
                      ) : <p className="mt-5 text-sm text-slate-400">No family bulletins yet.</p>}
                    </section>
                  )}
                </div>
                <h2 className="my-6 font-serif text-2xl text-white">
                  {view === "month" ? readable(anchor, { month: "long", year: "numeric" }) : `${readable(dateText(start), { month: "short", day: "numeric", year: "numeric" })} – ${readable(dateText(end), { month: "short", day: "numeric", year: "numeric" })}`}
                </h2>
                {view === "agenda" ? (
                  events.length ? <div className="space-y-5">{Array.from(new Set(events.map((event) => event.date))).map((date) => <div key={date}><h3 className="mb-2 font-semibold text-[#f0c98e]">{readable(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3><EventList events={events.filter((event) => event.date === date)} /></div>)}</div> : <p className="text-sm text-slate-400">No events in this period.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-7">
                    {Array.from({ length: count }, (_, index) => {
                      const date = dateText(new Date(start.getTime() + index * dayMs));
                      return <div key={date} className={`min-w-0 rounded-xl border border-white/10 p-2 ${date.slice(0, 7) !== anchor.slice(0, 7) && view === "month" ? "opacity-60" : ""}`}>
                        <h3 className="mb-2 text-xs font-semibold text-slate-300"><time dateTime={date}>{readable(date, { weekday: "short", month: "short", day: "numeric" })}</time></h3>
                        <EventList events={events.filter((event) => event.date === date)} />
                      </div>;
                    })}
                  </div>
                )}
                {!allEvents.length && <p className="mt-6 rounded-xl border border-[#D8A35B]/20 p-4 text-sm leading-6 text-slate-300">Your Family Calendar is waiting for family dates. Birthdays and memorial dates from tree members and placeholders, anniversaries between eligible Connected Lives™, and expected births of Future Moment Makers™ in this tree can appear when their full dates and required sharing permissions are set. Enable Family Date Sync below or add a family event.</p>}
                <ImportDates treeId={selected.id} />
                <p className="mt-2 text-xs leading-5 text-slate-400">Sync is ongoing, not a one-time copy. Eligible dates update with current sharing and tree membership and are visible to all members of this tree.</p>
              </>
            )}
          </section>
          <aside aria-label="Calendar settings" className="space-y-4">
            {selected && <ManualEvent treeId={selected.id} />}
            <ReminderSettings reminders={reminders} />
            <ProfileDates profile={profile} />
            {selected && (selected.role === "owner" || selected.role === "admin") && <SourceDates treeId={selected.id} records={sources} />}
          </aside>
        </div>
      </div>
    </main>
  );
}
