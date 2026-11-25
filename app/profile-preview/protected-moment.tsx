"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

const accessCode = "JOHN2026";

export default function ProtectedMoment({ title }: { title: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [hasError, setHasError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const momentId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dialogTitleId = `private-moment-dialog-title-${momentId}`;
  const inputId = `private-moment-code-${momentId}`;
  const errorId = `private-moment-error-${momentId}`;

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim() !== accessCode) {
      setHasError(true);
      return;
    }

    setHasError(false);
    setDialogOpen(false);
    setUnlocked(true);
    setCode("");
  }

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setCode("");
    setHasError(false);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDialog();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogOpen, closeDialog]);

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="group w-full overflow-hidden rounded-2xl border border-[color:var(--nsg-accent)]/20 bg-slate-900 text-left transition hover:-translate-y-1 hover:border-[color:var(--nsg-accent)]/50 hover:shadow-lg hover:shadow-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
      >
        <span className="relative block h-36 overflow-hidden">
          <span
            aria-hidden="true"
            className="absolute inset-0 scale-110 bg-gradient-to-br from-[color:var(--nsg-accent)]/25 via-slate-700 to-[color:var(--nsg-background)] blur-xl"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-3xl text-white/70"
          >
            🔒
          </span>
          <span className="absolute bottom-3 right-4 text-xs uppercase tracking-[0.18em] text-[color:var(--nsg-accent-light)]">
            Sealed
          </span>
        </span>
        <span className="flex items-center gap-2 px-5 py-4 font-serif text-lg text-white">
          <span aria-hidden="true">🔒</span>
          {title}
        </span>
      </button>

      {unlocked && (
        <section
          aria-labelledby={`unlocked-moment-heading-${momentId}`}
          className="mt-6 rounded-2xl border border-[color:var(--nsg-accent)]/30 bg-white/[0.04] p-6 shadow-xl shadow-black/20 sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--nsg-accent)]">
            Private Moment
          </p>
          <h3
            id={`unlocked-moment-heading-${momentId}`}
            className="mt-2 font-serif text-2xl text-white"
          >
            {title}
          </h3>
          <p className="mt-3 leading-7 text-slate-300">
            This sample message illustrates a private moment. The demonstration
            code does not protect real content.
          </p>
        </section>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            aria-labelledby={dialogTitleId}
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[color:var(--nsg-accent)]/30 bg-[color:var(--nsg-background)] p-6 shadow-2xl shadow-black/50 sm:p-8"
            role="dialog"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--nsg-accent)]">
              ACCESS PROTECTED
            </p>
            <h2
              id={dialogTitleId}
              className="mt-2 font-serif text-2xl text-white"
            >
              Private Moment
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              This is a demonstration of a protected moment.
              <br />
              Enter the sample code JOHN2026 to continue.
            </p>

            <form onSubmit={handleUnlock}>
              <label
                htmlFor={inputId}
                className="mt-5 block text-sm text-slate-300"
              >
                Access Code
              </label>
              <input
                id={inputId}
                name="accessCode"
                type="password"
                autoComplete="off"
                required
                autoFocus
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setHasError(false);
                }}
                aria-invalid={hasError}
                aria-describedby={hasError ? errorId : undefined}
                className="mt-2 min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/70 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20"
              />
              {hasError && (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-3 text-sm leading-6 text-rose-300"
                >
                  The access code entered is not valid.
                  <br />
                  Please try again.
                </p>
              )}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--nsg-border)]/15 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-[color:var(--nsg-border)]/30 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--nsg-accent)] px-5 py-2.5 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
                >
                  Unlock Moment
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
