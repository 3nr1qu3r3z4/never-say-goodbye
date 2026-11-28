"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { saveCalendarEventNote } from "@/app/actions/family-calendar";
import { calendarEventIcon, type CalendarEvent } from "@/lib/family-calendar";
import type { CalendarNote } from "@/lib/family-calendar-data";

function UpcomingCard({ event, treeId, initialNote, today, tomorrow, view }: {
  event: CalendarEvent; treeId: string; initialNote: string; today: string; tomorrow: string; view: "grid" | "list";
}) {
  const [note, setNote] = useState(initialNote);
  const [draft, setDraft] = useState(initialNote);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) editorRef.current?.focus();
  }, [editing]);

  function save(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await saveCalendarEventNote(treeId, event.id, event.date, draft);
        if ("error" in result) {
          setError(result.error);
        } else {
          setNote(result.note);
          setDraft(result.note);
          setEditing(false);
          buttonRef.current?.focus();
        }
      } catch (cause) {
        console.error("Could not save family calendar note.", cause);
        setError("Could not save this note. Please try again.");
      }
    });
  }

  return <li className={view === "grid"
    ? "flex items-start gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-4"
    : "flex items-start gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] px-4 py-2"}>
    <span aria-hidden="true" className="text-xl">{calendarEventIcon(event.id)}</span>
    <div className="min-w-0 flex-1">
      <div className={view === "grid" ? "" : "flex flex-wrap items-center justify-between gap-x-4"}>
        <p className="break-words font-semibold text-white">{event.title}</p>
        <time dateTime={event.date} className={`${view === "grid" ? "mt-1 block" : ""} text-sm text-slate-400`}>
          {event.date === today ? "Today" : event.date === tomorrow ? "Tomorrow" : new Intl.DateTimeFormat("en-US", {
            month: "long", day: "numeric", ...(event.date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}), timeZone: "UTC",
          }).format(new Date(`${event.date}T00:00:00Z`))}
        </time>
      </div>
      {note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{note}</p>}
      {editing && <form onSubmit={save} className="mt-3">
        <textarea ref={editorRef} aria-label={`Note for ${event.title}`} value={draft} onChange={(change) => setDraft(change.target.value)}
          maxLength={1000} rows={3} className="w-full rounded-xl border border-[color:var(--nsg-border)]/20 bg-slate-950/60 p-3 text-sm text-white" />
        {error && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
        <div className="mt-2 flex gap-3 text-sm">
          <button type="submit" disabled={pending} className="font-semibold text-[color:var(--nsg-accent-light)] disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
          <button type="button" disabled={pending} onClick={() => { setDraft(note); setError(""); setEditing(false); buttonRef.current?.focus(); }} className="text-slate-300 disabled:opacity-60">Cancel</button>
        </div>
      </form>}
    </div>
    <button ref={buttonRef} type="button" aria-label={`${note ? "Edit" : "Add"} note for ${event.title}`} aria-expanded={editing}
      onClick={() => { setDraft(note); setError(""); setEditing(!editing); }} disabled={pending}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)] ${note ? "text-[color:var(--nsg-accent-light)]" : "text-slate-400 hover:text-white"}`}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3.75h10l4 4v12.5H5z" /><path d="M15 3.75v4h4M8 12h8M8 15.5h8" />
      </svg>
    </button>
  </li>;
}

export default function UpcomingFamilyMoments({ events, notes, treeId, today, tomorrow }: {
  events: CalendarEvent[]; notes: CalendarNote[]; treeId: string; today: string; tomorrow: string;
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
        {events.map((event) => <UpcomingCard key={JSON.stringify([event.id, event.date])} event={event} treeId={treeId}
          initialNote={notes.find((item) => item.eventId === event.id && item.date === event.date)?.note ?? ""}
          today={today} tomorrow={tomorrow} view={view} />)}
      </ul> : <p className="mt-4 text-sm text-slate-400">No upcoming family moments.</p>}
    </section>
  );
}
