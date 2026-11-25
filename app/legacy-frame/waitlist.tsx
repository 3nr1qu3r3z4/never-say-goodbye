"use client";

import { useActionState } from "react";
import { submitLegacyFrameInterest } from "@/app/actions/legacy-frame";

const inputClassName =
  "min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20";

export default function LegacyFrameWaitlist() {
  const [state, action, isPending] = useActionState(
    submitLegacyFrameInterest,
    {},
  );

  return (
    <form action={action} className="w-full max-w-md">
      <label htmlFor="frame-interest-email" className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="frame-interest-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="Your email address"
          className={inputClassName}
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--nsg-accent)] px-6 py-3 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          {isPending ? "Saving..." : "Notify Me When Available"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Your email is saved with your interest. Availability details will be
        shared here when announced.
      </p>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-3 text-sm text-[color:var(--nsg-accent-light)]">
          {state.success}
        </p>
      )}
    </form>
  );
}
