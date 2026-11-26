"use client";

import { useId, useRef } from "react";

export default function PrintTreeButton({ treeId, className }: { treeId: string; className: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        onClick={() => {
          formRef.current?.reset();
          dialogRef.current?.showModal();
        }}
      >
        Print Tree
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dialogRef.current?.close();
          }
        }}
        className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-[color:var(--nsg-accent)]/30 bg-[color:var(--nsg-background)] p-6 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
      >
        <h2 id={titleId} className="font-serif text-2xl text-white">Print Tree</h2>
        <form
          ref={formRef}
          action={`/api/legacy-tree/${encodeURIComponent(treeId)}/pdf`}
          method="post"
          onSubmit={() => { setTimeout(() => dialogRef.current?.close(), 0); }}
          className="mt-5"
        >
          <input type="hidden" name="familyName" value="" />
          <fieldset>
            <legend className="text-sm font-semibold text-slate-200">Include relationship labels?</legend>
            <div className="mt-3 flex gap-6 text-sm text-slate-300">
              <label className="inline-flex items-center gap-2"><input type="radio" name="includeRelationshipLabels" value="yes" /> Yes</label>
              <label className="inline-flex items-center gap-2"><input type="radio" name="includeRelationshipLabels" value="no" defaultChecked /> No</label>
            </div>
          </fieldset>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogRef.current?.close()} className="min-h-11 rounded-full border border-[color:var(--nsg-border)]/20 px-5 text-sm font-semibold text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">Cancel</button>
            <button type="submit" className="min-h-11 rounded-full bg-[color:var(--nsg-accent)] px-5 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">Create PDF</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
