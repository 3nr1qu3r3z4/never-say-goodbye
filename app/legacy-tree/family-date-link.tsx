"use client";

export default function FamilyDateLink({ treeId, type, id, name }: {
  treeId: string;
  type: "user" | "placeholder" | "future";
  id: string;
  name: string;
}) {
  return (
    <a href={`#family-dates-${encodeURIComponent(treeId)}`}
      aria-label={`Edit dates for ${name}`}
      onClick={() => window.dispatchEvent(new CustomEvent("nsg:edit-family-dates", { detail: { treeId, type, id } }))}
      className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-[color:var(--nsg-accent-light)] underline underline-offset-4">
      📅 Edit Dates
    </a>
  );
}
