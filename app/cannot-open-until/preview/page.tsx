import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { cannotOpenUntilPreviewEnabled } from "@/lib/cannot-open-until";
import { getSql } from "@/lib/db";

export const instant = false;

const requiredMigrations = [
  "030_cannot_open_until",
  "031_cannot_open_until_media",
  "032_cannot_open_until_commit_guard",
  "033_time_capsule_recipients",
  "034_time_capsule_opening_time",
];

export default async function FounderPreviewPage() {
  const user = await requireUser();
  if (!cannotOpenUntilPreviewEnabled(user.id)) notFound();

  const rows = await getSql()`
    SELECT version FROM schema_migrations
    WHERE version IN ('030_cannot_open_until', '031_cannot_open_until_media',
                      '032_cannot_open_until_commit_guard', '033_time_capsule_recipients',
                      '034_time_capsule_opening_time')
  ` as { version: string }[];
  const installed = new Set(rows.map((row) => row.version));
  const ready = requiredMigrations.every((version) => installed.has(version));

  return <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-12 text-slate-100">
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-4xl text-white">Cannot Open Until™ Founder Preview</h1>
      <p className="mt-4 leading-7 text-slate-300">
        This preview uses real accounts and saves real Moments. Only approved preview accounts can use it while public rollout is disabled.
      </p>
      <p className="mt-3 text-sm text-slate-300">
        Public rollout: {process.env.CANNOT_OPEN_UNTIL_ENABLED === "true" ? "enabled" : "disabled"}.
        Recipients and claimants must also be approved preview accounts while it is disabled.
      </p>
      <h2 className="mt-8 font-serif text-2xl text-white">Database migration records</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {requiredMigrations.map((version) => <li key={version}>{version}: {installed.has(version) ? "Installed" : "Missing"}</li>)}
      </ul>
      <p className="mt-3 text-xs text-slate-400">Status reflects the migration records in the database used by this application.</p>
      {ready ? <nav className="mt-8 flex flex-wrap gap-5 text-sm font-semibold text-[color:var(--nsg-accent-light)]">
        <Link className="underline" href="/create-moment/cannot-open-until">Create a Moment</Link>
        <Link className="underline" href="/cannot-open-until">Manage Moments</Link>
        <Link className="underline" href="/cannot-open-until/inbox">Recipient inbox</Link>
      </nav> : <p role="alert" className="mt-8 text-amber-300">Install the missing migrations before using the preview.</p>}
    </div>
  </main>;
}
