"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { loadFamilyFeed } from "@/app/actions/family-calendar";
import { BulletinForm } from "@/app/family-calendar/calendar-forms";

type FeedData = Extract<Awaited<ReturnType<typeof loadFamilyFeed>>, { trees: unknown }>;
type FeedTarget = { treeId: string | null; bulletinId: string | null };
const feedEvent = "nsg:open-family-feed";

export function FamilyFeedLink({ treeId, bulletinId, className }: { treeId: string; bulletinId: string; className?: string }) {
  const href = `/family-calendar?tree=${encodeURIComponent(treeId)}#bulletin-${encodeURIComponent(bulletinId)}`;
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent<FeedTarget>(feedEvent, { detail: { treeId, bulletinId } }));
  }
  return <a href={href} onClick={open} className={className}>View Shout-Out</a>;
}

export default function FamilyFeed({ initialTreeId = null }: { initialTreeId?: string | null }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const lastTreeId = useRef<string | null>(initialTreeId);
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signIn, setSignIn] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  const load = useCallback(async (treeId: string | null) => {
    const request = ++requestId.current;
    lastTreeId.current = treeId;
    setLoading(true);
    setError("");
    setSignIn(false);
    try {
      const result = await loadFamilyFeed(treeId);
      if (request !== requestId.current) return;
      if ("error" in result) {
        setData(null);
        setError(result.error);
        setSignIn(result.signIn === true);
      } else {
        setData(result);
      }
    } catch (cause) {
      if (request !== requestId.current) return;
      console.error("Could not load Family Feed.", cause);
      setData(null);
      setError("Family Feed could not be loaded. Please try again.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  const open = useCallback((treeId: string | null, bulletinId: string | null = null) => {
    setTarget(bulletinId);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    void load(treeId);
  }, [load]);

  useEffect(() => {
    function openFromLink(event: Event) {
      const detail = (event as CustomEvent<FeedTarget>).detail;
      open(detail.treeId, detail.bulletinId);
    }
    function openFromHash() {
      const hash = window.location.hash;
      if (hash !== "#bulletins" && !hash.startsWith("#bulletin-")) return;
      let bulletinId: string | null = null;
      try {
        bulletinId = hash.startsWith("#bulletin-") ? decodeURIComponent(hash.slice(10)) : null;
      } catch (cause) {
        console.error("Could not open the Family Feed link.", cause);
        return;
      }
      open(new URLSearchParams(window.location.search).get("tree") ?? initialTreeId, bulletinId);
    }
    window.addEventListener(feedEvent, openFromLink);
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
    return () => {
      window.removeEventListener(feedEvent, openFromLink);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [initialTreeId, open]);

  useEffect(() => {
    if (!loading && data && target) {
      document.getElementById(`bulletin-${target}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [data, loading, target]);

  const refresh = useCallback(() => {
    router.refresh();
    void load(data?.selectedTreeId ?? null);
  }, [data?.selectedTreeId, load, router]);

  return (
    <>
      <button type="button" onClick={() => open(initialTreeId)} className="fixed bottom-5 right-5 z-40 min-h-12 rounded-full border border-[color:var(--nsg-accent)]/60 bg-[color:var(--nsg-surface)] px-5 text-sm font-semibold text-[color:var(--nsg-accent-light)] shadow-xl hover:bg-[color:var(--nsg-background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]">
        Family Feed™
      </button>
      <dialog ref={dialogRef} aria-labelledby="family-feed-heading"
        onClose={() => { requestId.current++; setTarget(null); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") dialogRef.current?.close();
        }}
        className="family-feed-panel fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md overflow-y-auto border-l border-[color:var(--nsg-accent)]/30 bg-[color:var(--nsg-background)] p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/70 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id="family-feed-heading" className="font-serif text-2xl text-white">Family Feed™</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close Family Feed"
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[color:var(--nsg-accent)]">×</button>
        </div>
        {loading ? <p role="status" className="mt-6 text-sm text-slate-400">Loading…</p> : error ? (
          <div className="mt-6 text-sm text-rose-300" role="alert">
            <p>{error}</p>
            {signIn ? <a href="/login" className="mt-3 inline-block text-[color:var(--nsg-accent-light)] underline">Sign In</a>
              : <button type="button" onClick={() => void load(lastTreeId.current)} className="mt-3 text-[color:var(--nsg-accent-light)] underline">Try Again</button>}
          </div>
        ) : data && (
          data.selectedTreeId ? (
            <>
              {data.trees.length > 1 && <label className="mt-6 block text-sm text-slate-300">Family tree
                <select value={data.selectedTreeId} onChange={(event) => { setTarget(null); void load(event.target.value); }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--nsg-border)]/15 bg-slate-950 px-3 text-white">
                  {data.trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
                </select>
              </label>}
              <section className="mt-6" aria-labelledby="family-feed-create">
                <h3 id="family-feed-create" className="font-serif text-xl text-white">Create Family Shout-Out</h3>
                <div className="mt-4"><BulletinForm key={data.selectedTreeId} treeId={data.selectedTreeId} onSuccess={refresh} /></div>
              </section>
              <section className="mt-6" aria-labelledby="family-feed-recent">
                <h3 id="family-feed-recent" className="font-serif text-xl text-white">Recent Family Shout-Outs</h3>
                {data.bulletins.length ? <ol className="mt-3 space-y-3">
                  {data.bulletins.map((bulletin) => <li id={`bulletin-${bulletin.id}`} key={bulletin.id} className="scroll-mt-6 rounded-xl border border-[color:var(--nsg-border)]/10 p-4">
                    <p className="font-semibold text-white">{bulletin.authorName}</p>
                    <time dateTime={bulletin.createdAt} className="mt-1 block text-xs text-slate-400">
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(bulletin.createdAt))} UTC
                    </time>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{bulletin.message}</p>
                  </li>)}
                </ol> : <p className="mt-3 text-sm text-slate-400">No family shout-outs yet.</p>}
                {target && !data.bulletins.some((bulletin) => bulletin.id === target) && <p role="status" className="mt-3 text-sm text-slate-400">This shout-out is no longer available.</p>}
              </section>
            </>
          ) : <p className="mt-6 text-sm text-slate-300">Create or join a <a href="/legacy-tree" className="text-[color:var(--nsg-accent-light)] underline">Legacy Tree™</a> to share with family.</p>
        )}
      </dialog>
    </>
  );
}
