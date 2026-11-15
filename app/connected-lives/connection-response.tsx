"use client";

import { useActionState } from "react";
import {
  respondToConnectedLivesRequest,
  type ConnectionActionResult,
} from "@/app/actions/connected-lives";

export default function ConnectionResponse({
  requestId,
}: {
  requestId: string;
}) {
  const [state, formAction, isPending] = useActionState<
    ConnectionActionResult,
    FormData
  >(respondToConnectedLivesRequest, {});

  return (
    <div>
      <form action={formAction} className="mt-4 flex flex-wrap gap-3">
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          name="response"
          value="accept"
          disabled={isPending}
          className="min-h-11 rounded-full bg-[#D8A35B] px-5 text-sm font-semibold text-[#0F172A] transition hover:bg-[#e6b66f] disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Accept"}
        </button>
        <button
          type="submit"
          name="response"
          value="decline"
          disabled={isPending}
          className="min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-300 transition hover:border-white/30 hover:text-white disabled:opacity-60"
        >
          Decline
        </button>
      </form>
      {(state.message || state.error) && (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${state.error ? "text-rose-300" : "text-[#f0c98e]"}`}
        >
          {state.error ?? state.message}
        </p>
      )}
    </div>
  );
}
