"use client";

import { useActionState } from "react";
import {
  addConnectedLifeTag,
  removeConnectedLifeTag,
} from "@/app/actions/connected-lives";
import type { PersonTag } from "@/lib/connected-lives-directory";

function RemoveTag({ tag }: { tag: PersonTag }) {
  const [state, action, pending] = useActionState(removeConnectedLifeTag, {});
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="tagId" value={tag.id} />
      <span className="rounded-full border border-[color:var(--nsg-border)]/15 px-3 py-1 text-xs text-slate-200">{tag.label}</span>
      <button type="submit" disabled={pending} aria-label={`Remove ${tag.label} tag`} className="min-h-9 min-w-9 rounded-full text-slate-400 hover:text-white disabled:opacity-50">×</button>
      {state.error && <span role="alert" className="text-xs text-rose-300">{state.error}</span>}
    </form>
  );
}

function PersonTags({ connectionId, subjectId, title, tags }: {
  connectionId: string; subjectId: string; title: string; tags: PersonTag[];
}) {
  const [state, action, pending] = useActionState(addConnectedLifeTag, {});
  return (
    <div className="mt-4">
      <h5 className="text-sm font-semibold text-slate-200">{title}</h5>
      {tags.length ? <div className="mt-2 flex flex-wrap gap-1">{tags.map((tag) => <RemoveTag key={tag.id} tag={tag} />)}</div>
        : <p className="mt-2 text-xs text-slate-400">No tags yet.</p>}
      <form action={action} className="mt-3">
        <input type="hidden" name="connectionId" value={connectionId} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <label className="text-xs text-slate-300">Add a shared tag
          <input name="label" required maxLength={60} className="mt-1 min-h-11 w-full rounded-xl border border-[color:var(--nsg-border)]/15 bg-slate-950/50 px-3 text-sm text-white" placeholder="e.g. Veteran" />
        </label>
        <button type="submit" disabled={pending} className="mt-2 min-h-11 rounded-full border border-[color:var(--nsg-accent)]/50 px-4 text-sm text-[color:var(--nsg-accent-light)] disabled:opacity-50">{pending ? "Adding…" : "Add Tag"}</button>
        {(state.error || state.message) && <p role="status" className={`mt-2 text-xs ${state.error ? "text-rose-300" : "text-[color:var(--nsg-accent-light)]"}`}>{state.error ?? state.message}</p>}
      </form>
    </div>
  );
}

export default function SharedTags({ connectionId, personId, viewerId, name, personTags, ownTags }: {
  connectionId: string; personId: string; viewerId: string; name: string;
  personTags: PersonTag[]; ownTags: PersonTag[];
}) {
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-medium text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4">Manage Shared Tags</summary>
      <p className="mt-3 text-xs leading-5 text-slate-400">Both participants can see, add, and remove these tags. Each tag identifies the person it describes.</p>
      <PersonTags connectionId={connectionId} subjectId={personId} title={`Tags about ${name}`} tags={personTags} />
      <PersonTags connectionId={connectionId} subjectId={viewerId} title="Tags about you" tags={ownTags} />
    </details>
  );
}
