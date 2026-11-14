import type { Metadata } from "next";
import Image from "next/image";
import { getSql } from "@/lib/db";
import SearchForm from "./search-form";

export const metadata: Metadata = {
  title: "Find A Moment Maker | Never Say Goodbye",
  description: "Search for discoverable Moment Maker profiles.",
};

export const instant = false;

type SearchProfile = {
  id: string;
  displayName: string;
  bio: string;
  location: string;
  descriptorOne: string;
  descriptorTwo: string;
  descriptorThree: string;
  profilePhoto: string | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name: rawName } = await searchParams;
  const name = rawName?.trim().slice(0, 100) ?? "";
  const sql = getSql();
  const profiles = name
    ? ((await sql`
        SELECT
          u.id,
          COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS "displayName",
          CASE
            WHEN COALESCE((to_jsonb(u) ->> 'public_profile_bio')::boolean, TRUE)
            THEN COALESCE(to_jsonb(u) ->> 'bio', '')
            ELSE ''
          END AS bio,
          COALESCE(to_jsonb(u) ->> 'location', '') AS location,
          COALESCE(to_jsonb(u) ->> 'descriptor_one', '') AS "descriptorOne",
          COALESCE(to_jsonb(u) ->> 'descriptor_two', '') AS "descriptorTwo",
          COALESCE(to_jsonb(u) ->> 'descriptor_three', '') AS "descriptorThree",
          CASE
            WHEN COALESCE((to_jsonb(u) ->> 'public_profile_photo')::boolean, TRUE)
            THEN NULLIF(to_jsonb(u) ->> 'profile_photo_data', '')
            ELSE NULL
          END AS "profilePhoto"
        FROM users AS u
        WHERE u.discoverability IN ('searchable', 'public')
          AND u.display_name ILIKE ${`%${name}%`}
        ORDER BY u.featured DESC, u.display_name
        LIMIT 30
      `) as SearchProfile[])
    : [];
  const descriptors = (profile: SearchProfile) =>
    [
      profile.descriptorOne,
      profile.descriptorTwo,
      profile.descriptorThree,
    ].filter(Boolean);

  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <section className="relative isolate px-6 py-16 sm:px-8 sm:py-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
        />
        <div className="mx-auto max-w-5xl">
          <header className="mt-4 text-center sm:mt-8">
            <h1 className="font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
              Find A Moment Maker
            </h1>
            <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400 sm:text-lg">
              Search for people and the moments they chose to share.
            </p>
          </header>

          <SearchForm initialName={name} />

          {name ? (
            <section aria-live="polite" className="mt-12">
              <h2 className="font-serif text-2xl text-white sm:text-3xl">
                Search results for “{name}”
              </h2>
              {profiles.length > 0 ? (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  {profiles.map((profile) => (
                    <li
                      key={profile.id}
                      className="flex gap-4 rounded-2xl border border-[#D8A35B]/20 bg-white/[0.03] p-5 sm:p-6"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[#D8A35B]/30 bg-slate-900">
                        {profile.profilePhoto ? (
                          <Image
                            src={profile.profilePhoto}
                            alt=""
                            fill
                            unoptimized
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : (
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 160 160"
                            fill="none"
                            className="absolute inset-0 m-auto h-16 w-16 text-[#D8A35B]/30"
                          >
                            <circle cx="80" cy="52" r="30" fill="currentColor" />
                            <path
                              d="M25 145c4-33 25-51 55-51s51 18 55 51"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                          Moment Maker
                        </p>
                        <h3 className="mt-1 font-serif text-xl text-white">
                          {profile.displayName}
                        </h3>
                        {descriptors(profile).length > 0 && (
                          <p className="mt-2 text-sm text-slate-300">
                            {descriptors(profile).join(" · ")}
                          </p>
                        )}
                        {profile.location && (
                          <p className="mt-2 text-sm text-slate-400">
                            {profile.location}
                          </p>
                        )}
                        {profile.bio && (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                            {profile.bio}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-slate-300">
                  No Moment Makers found.
                </p>
              )}
            </section>
          ) : (
            <p className="mt-10 text-center text-sm text-slate-500">
              Enter a name to find a Moment Maker.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
