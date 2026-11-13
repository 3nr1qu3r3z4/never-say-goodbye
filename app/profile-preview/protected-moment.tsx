"use client";

import { useState, type FormEvent } from "react";

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

  function closeDialog() {
    setDialogOpen(false);
    setCode("");
    setHasError(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="group w-full overflow-hidden rounded-2xl border border-[#D8A35B]/20 bg-slate-900 text-left transition hover:-translate-y-1 hover:border-[#D8A35B]/50 hover:shadow-lg hover:shadow-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
      >
        <span className="relative block h-36 overflow-hidden">
          <span
            aria-hidden="true"
            className="absolute inset-0 scale-110 bg-gradient-to-br from-[#D8A35B]/25 via-slate-700 to-[#0F172A] blur-xl"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-3xl text-white/70"
          >
            🔒
          </span>
          <span className="absolute bottom-3 right-4 text-xs uppercase tracking-[0.18em] text-[#f0c98e]">
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
          aria-labelledby="unlocked-moment-heading"
          className="mt-6 rounded-2xl border border-[#D8A35B]/30 bg-white/[0.04] p-6 shadow-xl shadow-black/20 sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
            Private Moment
          </p>
          <h3
            id={`unlocked-moment-heading-${momentId}`}
            className="mt-2 font-serif text-2xl text-white"
          >
            {title}
          </h3>
          <p className="mt-3 leading-7 text-slate-300">
            This moment was created as a private message and was unlocked using
            an approved access code.
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
            className="w-full max-w-md rounded-2xl border border-[#D8A35B]/30 bg-[#0F172A] p-6 shadow-2xl shadow-black/50 sm:p-8"
            role="dialog"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
              ACCESS PROTECTED
            </p>
            <h2
              id={dialogTitleId}
              className="mt-2 font-serif text-2xl text-white"
            >
              Private Moment
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              This moment has been protected by the Moment Maker.
              <br />
              Please enter an access code to continue.
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
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20"
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
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/30 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#D8A35B] px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
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
