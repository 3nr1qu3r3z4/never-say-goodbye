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
      <summary className="cursor-pointer text-sm font-medium text-[#f0c98e] underline decoration-[#D8A35B]/40 underline-offset-4">
        Edit relationship
      </summary>
      <form action={formAction} className="mt-4">
        <input type="hidden" name="connectionId" value={connectionId} />
        <RelationshipOptions selected={relationshipType} />
        <button
          type="submit"
          disabled={isPending}
          className="mt-4 min-h-11 rounded-full border border-[#D8A35B]/50 px-5 text-sm font-semibold text-[#f0c98e] transition hover:bg-[#D8A35B]/10 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save relationship"}
        </button>
        {(state.message || state.error) && (
          <p
            aria-live="polite"
            className={`mt-3 text-sm ${state.error ? "text-rose-300" : "text-[#f0c98e]"}`}
          >
            {state.error ?? state.message}
          </p>
        )}
      </form>
    </details>
  );
}
