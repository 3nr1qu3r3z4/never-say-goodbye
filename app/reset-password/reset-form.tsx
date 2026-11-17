"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { resetPassword } from "@/app/actions/account-recovery";
import RecoveryShell from "@/app/account-recovery/recovery-shell";

const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

export default function ResetForm() {
  const [state, action, pending] = useActionState(resetPassword, {});
  const [token, setToken] = useState<string | null>(null);
  const tokenRead = useRef(false);

  useEffect(() => {
    if (tokenRead.current) return;
    tokenRead.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    // The fragment is available only in the browser and must be cleared promptly.
    setToken(value);
  }, []);

  return (
    <RecoveryShell title="Reset Password" description="Choose a new password for your account.">
      {state.message ? (
        <p role="status" className="mt-8 text-sm text-slate-300">{state.message}</p>
      ) : token === "" ? (
        <p role="alert" className="mt-8 text-sm text-rose-300">
          This reset link is invalid or has expired. Request a new link.
        </p>
      ) : token ? (
        <form action={action} className="mt-8 space-y-5">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="new-password" className="block text-sm text-slate-300">New Password</label>
            <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={inputClassName} />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm text-slate-300">Confirm Password</label>
            <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={inputClassName} />
          </div>
          {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
          <button type="submit" disabled={pending} className="min-h-12 w-full rounded-full bg-[#D8A35B] px-6 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-[#e6b66f] disabled:opacity-70">
            {pending ? "Saving…" : "Reset Password"}
          </button>
        </form>
      ) : (
        <p role="status" className="mt-8 text-sm text-slate-400">Checking your reset link…</p>
      )}
    </RecoveryShell>
  );
}
