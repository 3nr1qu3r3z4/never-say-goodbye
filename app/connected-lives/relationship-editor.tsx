"use client";

import { useActionState } from "react";
import {
  updateConnectedLivesRelationship,
  type ConnectionActionResult,
} from "@/app/actions/connected-lives";
import RelationshipOptions from "./relationship-options";

export default function RelationshipEditor({
  connectionId,
  relationshipType,
}: {
  connectionId: string;
  relationshipType: string | null;
}) {
  const [state, formAction, isPending] = useActionState<
    ConnectionActionResult,
    FormData
  >(updateConnectedLivesRelationship, {});

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-medium text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4">
        Edit relationship
      </summary>
      <form action={formAction} className="mt-4">
        <input type="hidden" name="connectionId" value={connectionId} />
        <RelationshipOptions selected={relationshipType} />
        <button
          type="submit"
          disabled={isPending}
          className="mt-4 min-h-11 rounded-full border border-[color:var(--nsg-accent)]/50 px-5 text-sm font-semibold text-[color:var(--nsg-accent-light)] transition hover:bg-[color:var(--nsg-accent)]/10 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save relationship"}
        </button>
        {(state.message || state.error) && (
          <p
            aria-live="polite"
            className={`mt-3 text-sm ${state.error ? "text-rose-300" : "text-[color:var(--nsg-accent-light)]"}`}
          >
            {state.error ?? state.message}
          </p>
        )}
      </form>
    </details>
  );
}
