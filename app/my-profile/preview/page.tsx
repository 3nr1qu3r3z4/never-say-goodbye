import type { Metadata } from "next";
import Image from "next/image";
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
  discoverability: "private" | "searchable" | "public";
  publicProfilePhoto: boolean;
  publicProfileBio: boolean;
  publicSharedMoments: boolean;
  publicConnectedLives: boolean;
  publicLegacyTree: boolean;
  publicFutureMomentMakers: boolean;
  publicPersonalMoments: boolean;
};

type Moment = {
  id: string;
  title: string;
  kind: "shared" | "personal";
  audience: "public" | "connections" | "family" | "private";
};

type Connection = {
  id: string;
  displayName: string;
  relationship: string;
};

type LegacyTree = {
  id: string;
  name: string;
};

type FutureMomentMaker = {
  id: string;
  name: string;
  relationship: string;
};

export default async function MyProfilePreviewPage() {
  const user = await requireUser();
  const sql = getSql();
  const [profileRows, moments, connections, legacyTrees, futureMomentMakers] =
    await Promise.all([
    sql`
      SELECT COALESCE(
               NULLIF(BTRIM(u.display_name), ''),
               NULLIF(BTRIM(u.first_name || ' ' || u.last_name), ''),
               'Moment Maker'
             ) AS "displayName",
             COALESCE(NULLIF(to_jsonb(u) ->> 'bio', ''), '') AS bio,
             COALESCE(NULLIF(to_jsonb(u) ->> 'descriptor_one', ''), '') AS "descriptorOne",
             COALESCE(NULLIF(to_jsonb(u) ->> 'descriptor_two', ''), '') AS "descriptorTwo",
             COALESCE(NULLIF(to_jsonb(u) ->> 'descriptor_three', ''), '') AS "descriptorThree",
             COALESCE(to_jsonb(u) ->> 'location', '') AS location,
             COALESCE(to_jsonb(u) ->> 'personal_motto', '') AS "personalMotto",
             NULLIF(to_jsonb(u) ->> 'profile_photo_data', '') AS "profilePhoto",
             COALESCE(to_jsonb(u) ->> 'discoverability', 'searchable') AS discoverability,
             COALESCE((to_jsonb(u) ->> 'public_profile_photo')::boolean, TRUE) AS "publicProfilePhoto",
             COALESCE((to_jsonb(u) ->> 'public_profile_bio')::boolean, TRUE) AS "publicProfileBio",
             COALESCE((to_jsonb(u) ->> 'public_shared_moments')::boolean, TRUE) AS "publicSharedMoments",
             COALESCE((to_jsonb(u) ->> 'public_connected_lives')::boolean, TRUE) AS "publicConnectedLives",
             COALESCE((to_jsonb(u) ->> 'public_legacy_tree')::boolean, TRUE) AS "publicLegacyTree",
             COALESCE((to_jsonb(u) ->> 'public_future_moment_makers')::boolean, FALSE) AS "publicFutureMomentMakers",
             COALESCE((to_jsonb(u) ->> 'public_personal_moments')::boolean, FALSE) AS "publicPersonalMoments"
      FROM users AS u
      WHERE u.id = ${user.id}
      LIMIT 1
    `,
    sql`
      SELECT id, title, kind, audience
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
    sql`
      SELECT id, name
      FROM legacy_trees
      WHERE owner_user_id = ${user.id}
      ORDER BY created_at
    `,
    sql`
      SELECT id, name, relationship
      FROM future_moment_makers
      WHERE owner_user_id = ${user.id}
        AND status != 'archived'
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
    discoverability: "searchable",
    publicProfilePhoto: true,
    publicProfileBio: true,
    publicSharedMoments: true,
    publicConnectedLives: true,
    publicLegacyTree: true,
    publicFutureMomentMakers: false,
    publicPersonalMoments: false,
  };
  const displayName = profile.displayName || user.displayName || "Moment Maker";
  const descriptors = [
    profile.descriptorOne,
    profile.descriptorTwo,
    profile.descriptorThree,
  ].filter((word): word is string => Boolean(word?.trim()));
  const profileMoments = moments as Moment[];
  const isPubliclyVisible = profile.discoverability !== "private";
  const sharedMoments = profileMoments.filter(
    (moment) =>
      isPubliclyVisible &&
      profile.publicSharedMoments &&
      moment.kind === "shared" &&
      moment.audience === "public",
  );
  const personalMoments = profileMoments.filter(
    (moment) =>
      isPubliclyVisible &&
      profile.publicPersonalMoments &&
      moment.kind === "personal" &&
      moment.audience === "public",
  );
  const connectedLives =
    isPubliclyVisible && profile.publicConnectedLives
      ? (connections as Connection[])
      : [];
  const visibleLegacyTrees =
    isPubliclyVisible && profile.publicLegacyTree
      ? (legacyTrees as LegacyTree[])
      : [];
  const visibleFutureMomentMakers =
    isPubliclyVisible && profile.publicFutureMomentMakers
      ? (futureMomentMakers as FutureMomentMaker[])
      : [];
  const discoverabilityLabel =
    profile.discoverability === "public"
      ? "Public"
      : profile.discoverability === "searchable"
        ? "Searchable Only"
        : "Private";

  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <div className="px-4 pt-4 sm:px-8 sm:pt-8">
        <figure
          aria-label={`Moment Maker profile for ${displayName}`}
          className="relative mx-auto flex aspect-square w-full max-w-[42rem] items-end overflow-hidden rounded-[1.75rem] border border-[#D8A35B]/25 bg-gradient-to-br from-[#344255] via-[#172437] to-[#101827] shadow-2xl shadow-black/30 sm:rounded-[2rem]"
        >
          {isPubliclyVisible && profile.publicProfilePhoto && (
            profile.profilePhoto ? (
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
            )
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
          {isPubliclyVisible ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
                Moment Maker
              </p>
              <p className="mt-3 inline-flex rounded-full border border-[#D8A35B]/30 bg-[#D8A35B]/[0.08] px-3 py-1 text-xs font-medium text-[#f0c98e]">
                Profile visibility: {discoverabilityLabel}
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
              {profile.publicProfileBio && profile.bio && (
                <p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap leading-7 text-slate-300">
                  {profile.bio}
                </p>
              )}
            </>
          ) : (
            <p className="mx-auto max-w-xl rounded-2xl border border-[#D8A35B]/25 bg-white/[0.03] p-6 leading-7 text-slate-300">
              Your profile is private. Only approved connections can find it.
            </p>
          )}
        </div>
      </div>

      {sharedMoments.length > 0 && (
        <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              Stories in your own words
            </p>
            <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
              Shared Moments
            </h2>
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
          </div>
        </section>
      )}

      {personalMoments.length > 0 && (
        <section className="px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              Saved for the right moment
            </p>
            <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
              Personal Moments
            </h2>
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
          </div>
        </section>
      )}

      {connectedLives.length > 0 && (
        <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              Always connected
            </p>
            <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
              Connected Lives™
            </h2>
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
          </div>
        </section>
      )}

      {visibleLegacyTrees.length > 0 && (
        <section className="px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl text-white sm:text-4xl">
              Legacy Tree™
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {visibleLegacyTrees.map((tree) => (
                <article
                  key={tree.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="font-serif text-xl text-white">{tree.name}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {visibleFutureMomentMakers.length > 0 && (
        <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl text-white sm:text-4xl">
              Future Moment Makers™
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleFutureMomentMakers.map((maker) => (
                <article
                  key={maker.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="font-serif text-xl text-white">{maker.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {maker.relationship}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-white/10 px-6 py-8 text-center">
        <p className="font-serif text-lg text-white">Never Say Goodbye</p>
        <p className="mt-4 text-xs tracking-wide text-slate-500">
          NeverSayGoodbye.life
        </p>
      </footer>
    </main>
  );
}
