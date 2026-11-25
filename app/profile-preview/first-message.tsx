"use client";

import { useCallback, useEffect, useRef } from "react";

export default function FirstMessage() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollStyles = useRef<{ body: string; html: string } | null>(null);

  const restoreScrolling = useCallback(() => {
    if (scrollStyles.current) {
      document.body.style.overflow = scrollStyles.current.body;
      document.documentElement.style.overflow = scrollStyles.current.html;
      scrollStyles.current = null;
    }
  }, []);

  const openMessage = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || scrollStyles.current) return;

    if (!dialog.open) dialog.showModal();
    scrollStyles.current = {
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }, []);

  useEffect(() => {
    if (window.location.hash === "#first-message") openMessage();
    return restoreScrolling;
  }, [openMessage, restoreScrolling]);

  return (
    <>
      <button
        ref={buttonRef}
        id="first-message"
        type="button"
        onClick={openMessage}
        className="mt-8 inline-flex w-full max-w-2xl justify-center rounded-full bg-[color:var(--nsg-accent)] px-8 py-4 text-sm font-semibold tracking-wide text-[color:var(--nsg-background)] shadow-lg shadow-[color:var(--nsg-accent)]/10 transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
      >
        ❤️ Read John&apos;s First Message
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="john-first-message-heading"
        onClose={() => {
          restoreScrolling();
          buttonRef.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.close();
          }
        }}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            event.currentTarget.close();
          }
        }}
        className="fixed inset-0 m-auto h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-h-none max-w-none overflow-y-auto overscroll-contain rounded-2xl border border-[color:var(--nsg-accent)]/30 bg-[#101b2e] p-0 text-slate-100 shadow-2xl shadow-black/50 backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm sm:h-[72dvh] sm:w-[72vw] sm:rounded-3xl"
      >
        <div className="min-h-full bg-gradient-to-br from-[color:var(--nsg-accent)]/[0.07] via-transparent to-slate-950/30 px-6 pb-10 pt-5 sm:px-12 sm:pb-16 sm:pt-8">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--nsg-border)]/15 px-5 text-sm font-semibold text-slate-300 transition hover:border-[color:var(--nsg-accent)]/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
            >
              <span aria-hidden="true" className="text-xl leading-none">×</span>
              <span className="sr-only">Close message</span>
            </button>
          </div>
          <div className="mx-auto max-w-2xl pb-4 pt-6 sm:pt-10">
            <h2 id="john-first-message-heading" className="font-serif text-3xl text-white sm:text-4xl">
              John&apos;s First Message
            </h2>
            <div className="mt-10 space-y-6 font-serif text-lg leading-8 text-slate-200 sm:text-xl sm:leading-9">
              <p>To my family,</p>
              <p>
                If you are reading this, I hope you remember the laughter around
                our table, the songs we sang together, and how welcome you always
                were in our home.
              </p>
              <p>
                Keep telling your stories. The little moments are worth
                remembering, too.
              </p>
              <p>With love,<br />John</p>
            </div>
            <div className="mt-10 rounded-2xl border border-[color:var(--nsg-accent)]/25 bg-white/[0.03] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--nsg-accent)]">Voice Message</p>
              <h3 className="mt-3 font-serif text-xl text-white">🎙 A Message From Dad</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">This example does not have a recording yet.</p>
              <button type="button" disabled className="mt-5 min-h-11 rounded-full border border-[color:var(--nsg-border)]/10 bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-400">
                Audio Coming Soon
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
