"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { loadFamilyEvent, postFamilyEventUpdate } from "@/app/actions/family-calendar";
import type { CalendarEvent, FamilyEventTarget, FamilyEventUpdate } from "@/lib/family-calendar";

const openEvent = "nsg:open-family-event";

export function openFamilyEvent(target: FamilyEventTarget) {
  window.dispatchEvent(new CustomEvent<FamilyEventTarget>(openEvent, { detail: target }));
}

export default function FamilyEventDialog({ onPosted }: {
  onPosted: (target: FamilyEventTarget, event: CalendarEvent, update: FamilyEventUpdate) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const [target, setTarget] = useState<FamilyEventTarget | null>(null);
  const [data, setData] = useState<{ event: CalendarEvent; updates: FamilyEventUpdate[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(async (next: FamilyEventTarget) => {
    const request = ++requestId.current;
    setTarget(next);
    setData(null);
    setDraft("");
    setError("");
    setLoading(true);
    try {
      const result = await loadFamilyEvent(next);
      if (request !== requestId.current) return;
      if ("error" in result) setError(result.error);
      else setData(result);
    } catch (cause) {
      if (request !== requestId.current) return;
      console.error("Could not load family event.", cause);
      setError("Could not load this event. Please try again.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    function open(event: Event) {
      const next = (event as CustomEvent<FamilyEventTarget>).detail;
      if (!dialog.current?.open) dialog.current?.showModal();
      void load(next);
    }
    window.addEventListener(openEvent, open);
    return () => window.removeEventListener(openEvent, open);
  }, [load]);

  function post(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!target || !data || pending) return;
    const currentTarget = target;
    const currentEvent = data.event;
    const request = requestId.current;
    setError("");
    startTransition(async () => {
      try {
        const result = await postFamilyEventUpdate(currentTarget, draft);
        if ("error" in result) {
          if (request === requestId.current) setError(result.error);
          return;
        }
        onPosted(currentTarget, currentEvent, result.update);
        if (request !== requestId.current) return;
        setData((current) => current && {
          ...current,
          updates: [...current.updates, result.update],
        });
        setDraft("");
      } catch (cause) {
        console.error("Could not post family event update.", cause);
        if (request === requestId.current) setError("Could not post this update. Please try again.");
      }
    });
  }

  return <dialog ref={dialog} aria-labelledby="family-event-title"
    onClose={() => { requestId.current++; }}
    onKeyDown={(event) => { if (event.key === "Escape") dialog.current?.close(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-[color:var(--nsg-accent)]/30 bg-[color:var(--nsg-background)] p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/70 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 id="family-event-title" className="font-serif text-2xl text-white">{data?.event.title ?? "Family Event"}</h2>
        {data && <time dateTime={data.event.date} className="mt-1 block text-sm text-slate-400">
          {new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${data.event.date}T00:00:00Z`))}
        </time>}
      </div>
      <button type="button" aria-label="Close event" onClick={() => dialog.current?.close()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[color:var(--nsg-accent)]">×</button>
    </div>
    {loading ? <p role="status" className="mt-6 text-sm text-slate-400">Loading…</p> : data && <>
      <h3 className="mt-6 font-serif text-xl text-white">Family Updates</h3>
      {data.updates.length > 0 && <ol className="mt-4 space-y-4">
        {data.updates.map((update) => <li key={update.id} className="border-b border-[color:var(--nsg-border)]/10 pb-4">
          <p className="font-semibold text-white">{update.authorName}</p>
          <time dateTime={update.createdAt} className="mt-1 block text-xs text-slate-400">
            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(update.createdAt))} UTC
          </time>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-200">{update.message}</p>
        </li>)}
      </ol>}
      <form onSubmit={post} className="mt-5">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Share a family update"
          placeholder="Share a family update..." maxLength={1000} required rows={3}
          className="w-full rounded-xl border border-[color:var(--nsg-border)]/15 bg-slate-950/60 p-3 text-sm text-white" />
        <button type="submit" disabled={pending} className="mt-3 min-h-11 rounded-full border border-[color:var(--nsg-accent)]/60 px-5 text-sm font-semibold text-[color:var(--nsg-accent-light)] disabled:opacity-60">
          {pending ? "Posting…" : "Post Update"}
        </button>
      </form>
    </>}
    {error && <div role="alert" className="mt-4 text-sm text-rose-300">
      <p>{error}</p>
      {!data && target && <button type="button" onClick={() => void load(target)} className="mt-2 underline">Try Again</button>}
    </div>}
  </dialog>;
}
