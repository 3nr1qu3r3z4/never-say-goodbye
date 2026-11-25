import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import ProfileEditor from "./profile-editor";
import Appearance from "./appearance";

export const metadata: Metadata = {
  title: "My Profile | Never Say Goodbye",
  description: "Manage your Moment Maker profile.",
};

export const instant = false;

type AccountStatus = "active" | "inactive" | "memorialized" | "frozen";
const accountStatusLabels: Record<AccountStatus, string> = {
  active: "Active Moment Maker",
  inactive: "Inactive",
  memorialized: "Memorialized",
  frozen: "Frozen",
};

type ProfileDetails = {
  accountStatus: AccountStatus | null;
  displayName: string | null;
  bio: string | null;
  descriptorOne: string | null;
  descriptorTwo: string | null;
  descriptorThree: string | null;
  birthplace: string | null;
  location: string | null;
  personalMotto: string | null;
  profilePhoto: string | null;
};

export default async function MyProfilePage() {
  const user = await requireUser();
  const sql = getSql();
  const rows = (await sql`
    SELECT u.account_status AS "accountStatus",
           COALESCE(
             NULLIF(BTRIM(u.display_name), ''),
             NULLIF(BTRIM(u.first_name || ' ' || u.last_name), ''),
             'Moment Maker'
           ) AS "displayName",
           COALESCE(NULLIF(to_jsonb(u) ->> 'bio', ''), '') AS bio,
           COALESCE(NULLIF(to_jsonb(u) ->> 'descriptor_one', ''), '') AS "descriptorOne",
           COALESCE(NULLIF(to_jsonb(u) ->> 'descriptor_two', ''), '') AS "descriptorTwo",
           COALESCE(NULLIF(to_jsonb(u) ->> 'descriptor_three', ''), '') AS "descriptorThree",
           COALESCE(u.birthplace, '') AS birthplace,
           COALESCE(to_jsonb(u) ->> 'location', '') AS location,
           COALESCE(to_jsonb(u) ->> 'personal_motto', '') AS "personalMotto",
           NULLIF(to_jsonb(u) ->> 'profile_photo_data', '') AS "profilePhoto"
    FROM users AS u
    WHERE u.id = ${user.id}
    LIMIT 1
  `) as ProfileDetails[];
  const profile = rows[0] ?? {
    accountStatus: null,
    displayName: user.displayName || "Moment Maker",
    bio: "",
    descriptorOne: "",
    descriptorTwo: "",
    descriptorThree: "",
    birthplace: "",
    location: "",
    personalMotto: "",
    profilePhoto: null,
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]"
      />
      <div className="relative mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          My Legacy
        </Link>

        <header className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
            Your story, thoughtfully preserved
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-white sm:text-5xl">
            My Profile
          </h1>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-400">
            Share a little about yourself with the people who matter most.
          </p>
          <Link
            href="/my-profile/setup"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--nsg-accent)]/60 px-7 py-3 text-sm font-semibold text-[color:var(--nsg-accent-light)] transition hover:border-[color:var(--nsg-accent)] hover:bg-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
          >
            Edit Profile Setup
          </Link>
        </header>

        <p className="mt-8 text-center text-sm text-slate-400">
          Account status:{" "}
          <span className="font-semibold text-slate-200">
            {profile.accountStatus ? accountStatusLabels[profile.accountStatus] : "Unavailable"}
          </span>
        </p>

        <section className="mt-9 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-11 sm:p-9">
          <ProfileEditor
            displayName={profile.displayName || user.displayName || "Moment Maker"}
            bio={profile.bio ?? ""}
            descriptorOne={profile.descriptorOne ?? ""}
            descriptorTwo={profile.descriptorTwo ?? ""}
            descriptorThree={profile.descriptorThree ?? ""}
            birthplace={profile.birthplace ?? ""}
            location={profile.location ?? ""}
            personalMotto={profile.personalMotto ?? ""}
            profilePhoto={profile.profilePhoto}
          />
        </section>

        <Appearance selectedTheme={user.siteTheme} />

        <footer className="mt-10 text-center">
          <p className="font-serif text-lg text-white"><Link href="/" className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">Never Say Goodbye</Link></p>
          <p className="mt-2 text-sm text-slate-500">
            Build it today. Leave it forever.
          </p>
        </footer>
      </div>
    </main>
  );
}
