"use client";

import Link from "next/link";
import { useActionState, useEffect, useSyncExternalStore } from "react";
import { requestTimeCapsuleClaim } from "@/app/actions/cannot-open-until";

export default function ClaimForm({ signedIn }: { signedIn: boolean }) {
  const [state, action, pending] = useActionState(requestTimeCapsuleClaim, {});
  const token = useSyncExternalStore(subscribeToHash, getHash, () => "");
  useEffect(() => {
    if (state.success) window.history.replaceState(null, "", window.location.pathname);
  }, [state.success]);

  if (!signedIn) return <div className="mt-6 space-y-4 text-slate-300">
    <p>Sign in or create an account, then open the private claim link again.</p>
    <p><Link className="underline" href="/login">Sign in</Link>{" · "}<Link className="underline" href="/signup">Create account</Link></p>
  </div>;
  return <form action={action} className="mt-6">
    <p className="text-slate-300">Request this Moment using your account. The sender must confirm your identity before you can view it.</p>
    <input type="hidden" name="token" value={token} />
    {!state.success && <button className="mt-5 rounded-full border border-[color:var(--nsg-accent)]/50 px-5 py-3 text-sm font-semibold text-[color:var(--nsg-accent-light)] disabled:opacity-50"
      disabled={!token || pending}>{pending ? "Sending…" : "Request claim"}</button>}
    <p role="status" className="mt-4 text-sm text-slate-300">{state.error ?? state.success}</p>
  </form>;
}

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHash() {
  return window.location.hash.slice(1);
}
