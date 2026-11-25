import type { Metadata } from "next";
import Link from "next/link";
import { saveEmailPreferences } from "@/app/actions/email-preferences";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { emailPreferenceOptions, type EmailPreferences } from "@/lib/email-preferences";

export const metadata: Metadata = {
  title: "Email Preferences | Never Say Goodbye",
  description: "Choose which activity notifications you would like to receive.",
};

export const instant = false;

export default async function EmailPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const sql = getSql();
  const [preferences] = (await sql`
    SELECT new_connection_requests AS "newConnectionRequests",
           connection_request_accepted AS "connectionRequestAccepted",
           new_photo_shared AS "newPhotoShared",
           new_video_shared AS "newVideoShared",
           new_audio_message_shared AS "newAudioMessageShared",
           shared_moments AS "sharedMoments",
           legacy_successor_updates AS "legacySuccessorUpdates"
    FROM email_preferences
    WHERE user_id = ${user.id}
  `) as EmailPreferences[];
  const { saved } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]"
      />
      <div className="relative mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          My Legacy
        </Link>
        <header className="mt-10 text-center sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
            Connected Lives™
          </p>
          <h1 className="mt-4 font-serif text-4xl text-white sm:text-5xl">
            Email Preferences
          </h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-400">
            Choose the activity you would like to hear about.
          </p>
        </header>
        <form action={saveEmailPreferences} className="mt-9 space-y-6 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-11 sm:p-9">
          <p className="rounded-xl border border-[color:var(--nsg-accent)]/20 bg-[color:var(--nsg-accent)]/[0.05] px-4 py-3 text-sm leading-6 text-slate-300">
            Email notifications are not enabled yet. Your preferences will be used when email notifications are activated in a future release.
          </p>
          {saved === "1" && (
            <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-200">
              Email preferences saved successfully.
            </p>
          )}
          <div>
            <label htmlFor="account-email" className="block text-sm font-medium text-slate-200">
              Email Address
            </label>
            <input
              id="account-email"
              type="email"
              value={user.email}
              readOnly
              className="mt-2 min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
            />
            <p className="mt-2 text-sm text-slate-400">This is your account email address.</p>
          </div>
          <fieldset>
            <legend className="font-serif text-xl text-white">Notification Preferences</legend>
            <div className="mt-4 space-y-3">
              {emailPreferenceOptions.map(({ name, label }) => (
                <label key={name} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[color:var(--nsg-accent)]/30">
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={preferences ? preferences[name] : true}
                    className="h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[color:var(--nsg-accent)] px-7 py-3 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">
            Save Preferences
          </button>
        </form>
      </div>
    </main>
  );
}
