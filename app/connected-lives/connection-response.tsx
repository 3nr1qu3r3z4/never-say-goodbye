"use client";

import { useActionState, useState } from "react";
import {
  respondToConnectedLivesRequest,
  type ConnectionActionResult,
} from "@/app/actions/connected-lives";
import RelationshipOptions from "./relationship-options";

export default function ConnectionResponse({
  requestId,
}: {
  requestId: string;
}) {
  const [state, formAction, isPending] = useActionState<
    ConnectionActionResult,
    FormData
  >(respondToConnectedLivesRequest, {});
  const [choosingRelationship, setChoosingRelationship] = useState(false);

  return (
    <div>
      <form action={formAction} className="mt-4">
        <input type="hidden" name="requestId" value={requestId} />
        {choosingRelationship && <RelationshipOptions />}
        <div className="mt-3 flex flex-wrap gap-3">
          {choosingRelationship ? (
            <>
              <button
                type="submit"
                name="response"
                value="accept"
                disabled={isPending}
                className="min-h-11 rounded-full bg-[color:var(--nsg-accent)] px-5 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setChoosingRelationship(false)}
                disabled={isPending}
                className="min-h-11 rounded-full border border-[color:var(--nsg-border)]/15 px-5 text-sm font-semibold text-slate-300 transition hover:border-[color:var(--nsg-border)]/30 hover:text-white disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setChoosingRelationship(true)}
                disabled={isPending}
                className="min-h-11 rounded-full bg-[color:var(--nsg-accent)] px-5 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] disabled:opacity-60"
              >
                Accept
              </button>
              <button
                type="submit"
                name="response"
                value="decline"
                disabled={isPending}
                className="min-h-11 rounded-full border border-[color:var(--nsg-border)]/15 px-5 text-sm font-semibold text-slate-300 transition hover:border-[color:var(--nsg-border)]/30 hover:text-white disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Decline"}
              </button>
            </>
          )}
        </div>
      </form>
      {(state.message || state.error) && (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${state.error ? "text-rose-300" : "text-[color:var(--nsg-accent-light)]"}`}
        >
          {state.error ?? state.message}
        </p>
      )}
    </div>
  );
}
