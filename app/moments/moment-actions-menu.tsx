"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteSharedMoment } from "@/app/actions/moments";

export default function MomentActionsMenu({
  momentId,
  title,
  isAuthor,
}: {
  momentId: string;
  title: string;
  isAuthor: boolean;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        summaryRef.current?.focus();
      }
    }
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function confirmDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await deleteSharedMoment(momentId);
      if (result.error) {
        setError(result.error);
      } else {
        dialogRef.current?.close();
        router.refresh();
      }
    } catch (cause) {
      console.error("Could not delete the moment.", cause);
      setError("This moment could not be deleted. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <details ref={menuRef} className="absolute right-3 top-3 z-20">
        <summary
          ref={summaryRef}
          aria-label={`Actions for ${title}`}
          className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full text-2xl text-slate-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B] [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden="true">⋮</span>
        </summary>
        <div className="absolute right-0 mt-1 w-52 rounded-xl border border-white/15 bg-slate-900 p-1 shadow-xl">
          <a
            href={`/moments/${encodeURIComponent(momentId)}`}
            className="block rounded-lg px-4 py-3 text-sm text-slate-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#D8A35B]"
          >
            View Moment
          </a>
          {isAuthor && (
            <>
              <button
                type="button"
                disabled
                className="block w-full cursor-not-allowed rounded-lg px-4 py-3 text-left text-sm text-slate-500"
              >
                Edit Moment <span className="text-xs">(not available yet)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  if (menuRef.current) menuRef.current.open = false;
                  dialogRef.current?.showModal();
                }}
                className="block w-full rounded-lg px-4 py-3 text-left text-sm text-rose-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#D8A35B]"
              >
                Delete Moment
              </button>
            </>
          )}
        </div>
      </details>
      {isAuthor && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onCancel={(event) => {
            if (pending) event.preventDefault();
          }}
          onClose={() => summaryRef.current?.focus()}
          className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-[#D8A35B]/30 bg-[#0F172A] p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
        >
          <h2 id={titleId} className="font-serif text-2xl text-white">Delete Moment?</h2>
          <p id={messageId} className="mt-4 text-sm leading-6 text-slate-300">
            Are you sure you want to permanently delete this moment?
          </p>
          {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
          <form onSubmit={confirmDelete} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              className="min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-full bg-rose-700 px-5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </form>
        </dialog>
      )}
    </>
  );
}
