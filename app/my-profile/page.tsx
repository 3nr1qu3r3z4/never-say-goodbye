import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import ProfileEditor from "./profile-editor";

export const metadata: Metadata = {
  title: "My Profile | Never Say Goodbye",
  description: "Manage your Moment Maker profile.",
};

export const instant = false;

type ProfileDetails = {
  displayName: string | null;
  bio: string | null;
  descriptorOne: string | null;
  descriptorTwo: string | null;
  descriptorThree: string | null;
  location: string | null;
  personalMotto: string | null;
  profilePhoto: string | null;
};

export default async function MyProfilePage() {
  const user = await requireUser();
  const sql = getSql();
  const rows = (await sql`
    SELECT COALESCE(
             NULLIF(BTRIM(display_name), ''),
             NULLIF(BTRIM(first_name || ' ' || last_name), ''),
             'Moment Maker'
           ) AS "displayName",
           COALESCE(bio, '') AS bio,
           COALESCE(descriptor_one, '') AS "descriptorOne",
           COALESCE(descriptor_two, '') AS "descriptorTwo",
           COALESCE(descriptor_three, '') AS "descriptorThree",
           COALESCE(location, '') AS location,
           COALESCE(personal_motto, '') AS "personalMotto",
           profile_photo_data AS "profilePhoto"
    FROM users
    WHERE id = ${user.id}
    LIMIT 1
  `) as ProfileDetails[];
  const profile = rows[0] ?? {
    displayName: user.displayName || "Moment Maker",
    bio: "",
    descriptorOne: "",
    descriptorTwo: "",
    descriptorThree: "",
    location: "",
    personalMotto: "",
    profilePhoto: null,
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
      />
      <div className="relative mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          My Legacy
        </Link>

        <header className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Your story, thoughtfully preserved
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-white sm:text-5xl">
            My Profile
          </h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-400">
            Share a little about yourself with the people who matter most.
          </p>
        </header>

        <section className="mt-9 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-11 sm:p-9">
          <ProfileEditor
            displayName={profile.displayName || user.displayName || "Moment Maker"}
            bio={profile.bio ?? ""}
            descriptorOne={profile.descriptorOne ?? ""}
            descriptorTwo={profile.descriptorTwo ?? ""}
            descriptorThree={profile.descriptorThree ?? ""}
            location={profile.location ?? ""}
            personalMotto={profile.personalMotto ?? ""}
            profilePhoto={profile.profilePhoto}
          />
        </section>

        <footer className="mt-10 text-center">
          <p className="font-serif text-lg text-white">Never Say Goodbye</p>
          <p className="mt-2 text-sm text-slate-500">
            Build it today. Leave it forever.
          </p>
        </footer>
      </div>
    </main>
  );
}
