"use client";

import { useState } from "react";
import { openFamilyEvent } from "@/app/family-event-dialog";
import { calendarEventIcon, type CalendarEvent } from "@/lib/family-calendar";

export default function UpcomingFamilyMoments({ events, treeId, today, tomorrow }: {
  events: CalendarEvent[]; treeId: string; today: string; tomorrow: string;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <section aria-labelledby="upcoming-family-moments" className="mb-6 rounded-3xl border border-[color:var(--nsg-accent)]/30 bg-[color:var(--nsg-accent)]/[0.06] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="upcoming-family-moments" className="font-serif text-2xl text-white">Upcoming Family Moments</h2>
        <div role="group" aria-label="Upcoming family moments view" className="flex shrink-0 items-center rounded-full border border-[color:var(--nsg-border)]/15 bg-slate-950/60 p-1">
          {(["grid", "list"] as const).map((option) => <button key={option} type="button" aria-pressed={view === option}
            onClick={() => setView(option)}
            className={`min-h-10 rounded-full px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)] ${view === option ? "bg-[color:var(--nsg-accent)]/15 text-[color:var(--nsg-accent-light)]" : "text-slate-400 hover:text-white"}`}>
            {option === "grid" ? "Grid" : "List"}
          </button>)}
        </div>
      </div>
      {events.length ? <ul className={view === "grid" ? "mt-4 grid gap-3 sm:grid-cols-2" : "mt-4 space-y-2"}>
        {events.map((event) => <li key={JSON.stringify([event.id, event.date])}>
          <button type="button" onClick={() => openFamilyEvent({ treeId, eventId: event.id, date: event.date })}
            className={`flex h-full w-full items-start gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] text-left hover:border-[color:var(--nsg-accent)]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)] ${view === "grid" ? "p-4" : "px-4 py-2"}`}>
            <span aria-hidden="true" className="text-xl">{calendarEventIcon(event.id)}</span>
            <span className={view === "grid" ? "min-w-0" : "flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4"}>
              <span className="block break-words font-semibold text-white">{event.title}</span>
              <time dateTime={event.date} className={`${view === "grid" ? "mt-1 block" : ""} text-sm text-slate-400`}>
                {event.date === today ? "Today" : event.date === tomorrow ? "Tomorrow" : new Intl.DateTimeFormat("en-US", {
                  month: "long", day: "numeric", ...(event.date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}), timeZone: "UTC",
                }).format(new Date(`${event.date}T00:00:00Z`))}
              </time>
            </span>
          </button>
        </li>)}
      </ul> : <p className="mt-4 text-sm text-slate-400">No upcoming family moments.</p>}
    </section>
  );
}
