"use client";

import { useActionState } from "react";
import { recoverPassword, recoverUsername } from "@/app/actions/account-recovery";
import RecoveryShell from "./recovery-shell";

export default function RecoveryForm({ purpose }: { purpose: "username" | "password" }) {
  const [state, action, pending] = useActionState(
    purpose === "username" ? recoverUsername : recoverPassword,
    {},
  );
  return (
    <RecoveryShell
      title={purpose === "username" ? "Forgot Username?" : "Forgot Password?"}
      description="Enter the email address associated with your account."
    >
      {state.message ? (
        <div role="status" className="mt-8 text-sm leading-6 text-slate-300">
          <p>{state.message}</p>
          <p className="mt-2 text-slate-400">
            If an account exists for that address, check your inbox.
          </p>
        </div>
      ) : (
        <form action={action} className="mt-8 space-y-5">
          <div>
            <label htmlFor="recovery-email" className="block text-sm text-slate-300">
              Email Address
            </label>
            <input
              id="recovery-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              className="mt-2 min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20"
            />
          </div>
          {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
          <button type="submit" disabled={pending} className="min-h-12 w-full rounded-full bg-[color:var(--nsg-accent)] px-6 py-3 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] disabled:opacity-70">
            {pending ? "Sending…" : "Send Instructions"}
          </button>
        </form>
      )}
    </RecoveryShell>
  );
}
