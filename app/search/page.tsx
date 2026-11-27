import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { searchAccessibleMoments } from "@/lib/moment-access";
import { searchOwnedLegacy } from "@/lib/legacy-search";
import MomentCard from "@/app/moments/moment-card";
import SearchForm from "./search-form";

export const metadata: Metadata = {
  title: "Search Legacy | Never Say Goodbye",
  description: "Search your Never Say Goodbye legacy.",
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
  searchParams: Promise<{
    name?: string;
    birthYear?: string;
    birthLocation?: string;
    homeLocation?: string;
  }>;
}) {
  const {
    name: rawName,
    birthYear: rawBirthYear,
    birthLocation: rawBirthLocation,
    homeLocation: rawHomeLocation,
  } = await searchParams;
  const name = rawName?.trim().slice(0, 100) ?? "";
  const birthYear = rawBirthYear?.trim().slice(0, 4) ?? "";
  const birthLocation = rawBirthLocation?.trim().slice(0, 100) ?? "";
  const homeLocation = rawHomeLocation?.trim().slice(0, 100) ?? "";
  const sql = getSql();
  const user = await getCurrentUser();
  const [profileRows, moments, legacy] = await Promise.all([
    name ? sql`
        SELECT
          u.id,
          COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS "displayName",
          CASE
            WHEN COALESCE((to_jsonb(u) ->> 'public_profile_bio')::boolean, TRUE)
            THEN COALESCE(to_jsonb(u) ->> 'bio', '')
            ELSE ''
          END AS bio,
          CASE WHEN u.public_location THEN COALESCE(u.location, '') ELSE '' END AS location,
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
      ` : Promise.resolve([]),
    name && user ? searchAccessibleMoments(user.id, name) : Promise.resolve([]),
    name && user ? searchOwnedLegacy(user.id, name) : Promise.resolve({ trees: [], futureMakers: [], drafts: [] }),
  ]);
  const profiles = profileRows as SearchProfile[];
  const hasResults = profiles.length > 0 || moments.length > 0 ||
    legacy.trees.length > 0 || legacy.futureMakers.length > 0 || legacy.drafts.length > 0;
  const descriptors = (profile: SearchProfile) =>
    [
      profile.descriptorOne,
      profile.descriptorTwo,
      profile.descriptorThree,
    ].filter(Boolean);

  return (
    <main className="min-h-screen overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <section className="relative isolate px-6 py-16 sm:px-8 sm:py-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]"
        />
        <div className="mx-auto max-w-5xl">
          <header className="mt-4 text-center sm:mt-8">
            <h1 className="font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
              Search Legacy
            </h1>
          </header>

          <SearchForm
            initialName={name}
            initialBirthYear={birthYear}
            initialBirthLocation={birthLocation}
            initialHomeLocation={homeLocation}
          />

          {name ? (
            <section aria-live="polite" className="mt-12">
              <h2 className="font-serif text-2xl text-white sm:text-3xl">
                Search results for “{name}”
              </h2>
              {profiles.length > 0 ? (
                <>
                <h3 className="mt-8 font-serif text-xl text-white">People</h3>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {profiles.map((profile) => (
                    <li
                      key={profile.id}
                      className="rounded-2xl border border-[color:var(--nsg-accent)]/20 bg-white/[0.03] transition hover:border-[color:var(--nsg-accent)]/50 hover:bg-white/[0.05]"
                    >
                      <Link
                        href={`/moment-maker/${encodeURIComponent(profile.id)}`}
                        className="flex gap-4 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)] sm:p-6"
                      >
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[color:var(--nsg-accent)]/30 bg-slate-900">
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
                              className="absolute inset-0 m-auto h-16 w-16 text-[color:var(--nsg-accent)]/30"
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
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--nsg-accent)]">
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
                          <span className="mt-4 inline-flex text-sm font-semibold text-[color:var(--nsg-accent-light)]">
                            View Profile →
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                </>
              ) : null}
              {moments.length > 0 && (
                <section aria-labelledby="moment-results-heading" className="mt-8">
                  <h3 id="moment-results-heading" className="font-serif text-xl text-white">Shared Moments</h3>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {moments.map((moment) => <MomentCard key={moment.id} moment={moment} />)}
                  </ul>
                </section>
              )}
              {[
                { label: "Legacy Trees™", items: legacy.trees.map((tree) => ({ id: tree.id, title: tree.name, href: `/legacy-tree#legacy-tree-item-${encodeURIComponent(tree.id)}` })) },
                { label: "Future Moment Makers™", items: legacy.futureMakers.map((maker) => ({ id: maker.id, title: maker.name, href: `/future-moment-maker/${encodeURIComponent(maker.id)}` })) },
                { label: "Drafts", items: legacy.drafts.map((draft) => ({ id: draft.id, title: draft.title, href: `/drafts#draft-${encodeURIComponent(draft.id)}` })) },
              ].map((group) => group.items.length > 0 && (
                <section key={group.label} className="mt-8">
                  <h3 className="font-serif text-xl text-white">{group.label}</h3>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {group.items.map((item) => <li key={item.id}><Link href={item.href} className="block rounded-2xl border border-[color:var(--nsg-accent)]/20 bg-white/[0.03] p-5 break-words text-white hover:border-[color:var(--nsg-accent)]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]">{item.title}</Link></li>)}
                  </ul>
                </section>
              ))}
              {!hasResults && (
                <p className="mt-6 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-6 text-slate-300">
                  No results found.
                </p>
              )}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
