import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import ProfileSetupForm, { type ProfileSetup } from "./profile-setup-form";

export const metadata: Metadata = {
  title: "Edit Profile Setup | Never Say Goodbye",
  description: "Review and update your profile setup.",
};

export const instant = false;

export default async function ProfileSetupPage() {
  const user = await requireUser();
  const sql = getSql();
  const [profile] = (await sql`
    SELECT display_name AS "displayName", discoverability,
           descriptor_one AS "descriptorOne", descriptor_two AS "descriptorTwo",
           descriptor_three AS "descriptorThree", COALESCE(birthplace, '') AS birthplace,
           COALESCE(location, '') AS location, COALESCE(personal_motto, '') AS "personalMotto"
    FROM users WHERE id = ${user.id}
    LIMIT 1
  `) as ProfileSetup[];
  if (!profile) throw new Error("Your profile setup could not be found.");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
      />
      <div className="relative mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/my-profile"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          My Profile
        </Link>
        <header className="mt-10 text-center sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Your story, thoughtfully preserved
          </p>
          <h1 className="mt-4 font-serif text-4xl text-white sm:text-5xl">
            Edit Profile Setup
          </h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-400">
            Review how you introduce yourself and how others can find you.
          </p>
        </header>
        <section className="mt-9 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-11 sm:p-9">
          <ProfileSetupForm profile={profile} />
        </section>
      </div>
    </main>
  );
}
