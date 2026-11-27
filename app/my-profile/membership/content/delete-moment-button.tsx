"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteManagedMoment } from "@/app/actions/content-delete";

export default function DeleteMomentButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [cleanupPending, setCleanupPending] = useState(false);

  async function confirmDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await deleteManagedMoment(id);
      if (result.error) {
        setError(result.error);
      } else if (result.cleanupPending) {
        setCleanupPending(true);
      } else {
        dialogRef.current?.close();
        router.refresh();
      }
    } catch (cause) {
      console.error("Could not delete the Moment.", cause);
      setError("This Moment could not be deleted. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button ref={buttonRef} type="button" aria-label={`Delete ${name}`}
        onClick={() => { setError(""); dialogRef.current?.showModal(); }}
        className="rounded-full border border-rose-500/60 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/40">
        Delete
      </button>
      <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={messageId}
        onCancel={(event) => { if (pending) event.preventDefault(); }}
        onClose={() => {
          if (cleanupPending) router.refresh();
          else buttonRef.current?.focus();
        }}
        className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-rose-500/30 bg-[color:var(--nsg-background)] p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/80">
        <h2 id={titleId} className="font-serif text-2xl text-white">Delete Moment?</h2>
        {cleanupPending ? (
          <>
            <p id={messageId} role="status" className="mt-4 text-sm leading-6 text-slate-300">
              The Moment was deleted, but some media could not be removed yet. Media cleanup will be retried automatically.
            </p>
            <button type="button" onClick={() => dialogRef.current?.close()}
              className="mt-6 min-h-11 rounded-full border border-[color:var(--nsg-border)]/15 px-5 text-sm font-semibold text-slate-300">
              Close
            </button>
          </>
        ) : (
          <>
            <div id={messageId} className="mt-4 text-sm leading-6 text-slate-300">
              <p>This action permanently deletes the entire Moment and all associated content.</p>
              <p className="mt-3">The following will be deleted:</p>
              <ul className="list-disc pl-5">
                <li>Story</li>
                <li>Photos</li>
                <li>Audio</li>
                <li>Video</li>
                <li>Cannot Open Until™ content</li>
                <li>Future Moment Maker™ content</li>
              </ul>
              <p className="mt-3">This action cannot be undone.</p>
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
            <form onSubmit={confirmDelete} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={pending} onClick={() => dialogRef.current?.close()}
                className="min-h-11 rounded-full border border-[color:var(--nsg-border)]/15 px-5 text-sm font-semibold text-slate-300 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={pending}
                className="min-h-11 rounded-full bg-rose-700 px-5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50">
                {pending ? "Deleting…" : "Delete Permanently"}
              </button>
            </form>
          </>
        )}
      </dialog>
    </>
  );
}
