"use client";

import { useEffect, useRef } from "react";

export default function SearchabilityWarning({
  open,
  onChoose,
}: {
  open: boolean;
  onChoose: (choice: "searchable" | "private") => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="searchability-warning-title"
      aria-describedby="searchability-warning-description"
      onCancel={(event) => { event.preventDefault(); onChoose("searchable"); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onChoose("searchable");
        }
      }}
      className="m-auto w-[min(90%,32rem)] rounded-2xl border border-[#D8A35B]/40 bg-slate-900 p-6 text-slate-100 shadow-2xl backdrop:bg-black/70"
    >
      <h2 id="searchability-warning-title" className="font-serif text-2xl text-white">Want family to find you?</h2>
      <div id="searchability-warning-description" className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
        <p>If your profile is hidden, family members won&apos;t be able to find you through Find People or add you to their Legacy Tree™.</p>
        <p>You can become searchable now and switch back to hidden later after your family has connected with you.</p>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" autoFocus onClick={() => onChoose("searchable")} className="min-h-11 rounded-full bg-[#D8A35B] px-5 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]">Keep Searchable (Recommended)</button>
        <button type="button" onClick={() => onChoose("private")} className="min-h-11 rounded-full border border-white/30 px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]">Stay Hidden</button>
      </div>
    </dialog>
  );
}
