"use client";

import { useActionState } from "react";
import { changeArchiveState } from "@/app/actions/content-archive";

export default function ArchiveButton({ id, name, kind, archived }: {
  id: string;
  name: string;
  kind: "moment" | "future";
  archived: boolean;
}) {
  const [state, action, pending] = useActionState(changeArchiveState, {});
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="operation" value={archived ? "restore" : "archive"} />
      <button disabled={pending} aria-label={`${archived ? "Restore" : "Archive"} ${name}`} className="rounded-full border border-[color:var(--nsg-accent)]/50 px-4 py-2 text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:bg-white/5 disabled:opacity-50">
        {pending ? "Saving…" : archived ? "Restore" : "Archive"}
      </button>
      <p role="status" className="mt-2 text-sm text-slate-300">{state.error ?? state.success}</p>
    </form>
  );
}
