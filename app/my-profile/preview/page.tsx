import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const metadata: Metadata = {
  title: "Profile Preview | Never Say Goodbye",
  description: "Preview your Moment Maker profile as visitors will see it.",
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

type Moment = {
  id: string;
  title: string;
  kind: "shared" | "personal";
};

type Connection = {
  id: string;
  displayName: string;
  relationship: string;
};

export default async function MyProfilePreviewPage() {
  const user = await requireUser();
  const sql = getSql();
  const [profileRows, moments, connections] = await Promise.all([
    sql`
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
    `,
    sql`
      SELECT id, title, kind
      FROM moments
      WHERE user_id = ${user.id}
        AND kind IN ('shared', 'personal')
      ORDER BY created_at DESC
    `,
    sql`
      SELECT id, display_name AS "displayName", relationship
      FROM connected_lives
      WHERE owner_user_id = ${user.id}
        AND status = 'accepted'
      ORDER BY created_at DESC
    `,
  ]);
  const profile = (profileRows as ProfileDetails[])[0] ?? {
    displayName: user.displayName || "Moment Maker",
    bio: "",
    descriptorOne: "",
    descriptorTwo: "",
    descriptorThree: "",
    location: "",
    personalMotto: "",
    profilePhoto: null,
  };
  const displayName = profile.displayName || user.displayName || "Moment Maker";
  const descriptors = [
    profile.descriptorOne,
    profile.descriptorTwo,
    profile.descriptorThree,
  ].filter((word): word is string => Boolean(word?.trim()));
  const profileMoments = moments as Moment[];
  const sharedMoments = profileMoments.filter((moment) => moment.kind === "shared");
  const personalMoments = profileMoments.filter(
    (moment) => moment.kind === "personal",
  );
  const connectedLives = connections as Connection[];

  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <div className="px-4 pt-4 sm:px-8 sm:pt-8">
        <figure
          aria-label={`Moment Maker profile for ${displayName}`}
          className="relative mx-auto flex aspect-square w-full max-w-[42rem] items-end overflow-hidden rounded-[1.75rem] border border-[#D8A35B]/25 bg-gradient-to-br from-[#344255] via-[#172437] to-[#101827] shadow-2xl shadow-black/30 sm:rounded-[2rem]"
        >
          {profile.profilePhoto ? (
            <Image
              src={profile.profilePhoto}
              alt={`${displayName} profile`}
              fill
              unoptimized
              sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1280px) calc(100vw - 4rem), 1152px"
              className="object-cover object-center"
            />
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 160 160"
              fill="none"
              className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 text-[#D8A35B]/20 sm:h-56 sm:w-56"
            >
              <circle cx="80" cy="52" r="30" fill="currentColor" />
              <path
                d="M25 145c4-33 25-51 55-51s51 18 55 51"
                fill="currentColor"
              />
            </svg>
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(216,163,91,0.2),transparent_58%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-[#0F172A]/10"
          />
          <span className="relative p-5 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-[#f0c98e]/80 sm:p-8">
            My Moments
          </span>
        </figure>

        <div className="mx-auto max-w-4xl px-2 pb-12 pt-8 text-center sm:pb-16 sm:pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Moment Maker
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
            {displayName}
          </h1>
          {descriptors.length > 0 && (
            <ul
              aria-label="Three words that describe this Moment Maker"
              className="mt-5 flex flex-wrap justify-center gap-2"
            >
              {descriptors.map((word, index) => (
                <li
                  key={`${index}-${word}`}
                  className="rounded-full border border-[#D8A35B]/30 bg-[#D8A35B]/[0.08] px-4 py-2 text-sm font-medium text-[#f0c98e]"
                >
                  {word}
                </li>
              ))}
            </ul>
          )}
          {profile.personalMotto && (
            <p className="mt-4 font-serif text-lg italic text-[#f0c98e]">
              “{profile.personalMotto}”
            </p>
          )}
          {profile.location && (
            <p className="mt-3 text-sm text-slate-400">{profile.location}</p>
          )}
          {profile.bio && (
            <p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap leading-7 text-slate-300">
              {profile.bio}
            </p>
          )}
          <Link
            href="/my-profile"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full border border-[#D8A35B]/60 px-6 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
          >
            Edit My Profile
          </Link>
        </div>
      </div>

      <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Stories in your own words
          </p>
          <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
            Shared Moments
          </h2>
          {sharedMoments.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sharedMoments.map((moment) => (
                <article
                  key={moment.id}
                  className="flex min-h-40 flex-col justify-end rounded-2xl border border-white/10 bg-gradient-to-br from-[#293b4a] via-[#33465a] to-[#172437] p-5"
                >
                  <span aria-hidden="true" className="mb-auto text-2xl text-[#f0c98e]">
                    ✦
                  </span>
                  <h3 className="font-serif text-lg text-white">{moment.title}</h3>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
              Your Shared Moments will appear here.
            </p>
          )}
        </div>
      </section>

      <section className="px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Saved for the right moment
          </p>
          <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
            Personal Moments
          </h2>
          {personalMoments.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {personalMoments.map((moment) => (
                <article
                  key={moment.id}
                  className="rounded-2xl border border-[#D8A35B]/20 bg-white/[0.03] p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                    Private Moment
                  </p>
                  <h3 className="mt-3 font-serif text-xl text-white">
                    🔒 {moment.title}
                  </h3>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
              Your Personal Moments will appear here.
            </p>
          )}
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Always connected
          </p>
          <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
            Connected Lives™
          </h2>
          {connectedLives.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {connectedLives.map((connection) => (
                <article
                  key={connection.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                >
                  <h3 className="font-serif text-lg text-white">
                    {connection.displayName}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {connection.relationship}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
              Your Connected Lives™ will appear here.
            </p>
          )}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center">
        <p className="font-serif text-lg text-white">Never Say Goodbye</p>
        <p className="mt-4 text-xs tracking-wide text-slate-500">
          NeverSayGoodbye.life
        </p>
      </footer>
    </main>
  );
}
