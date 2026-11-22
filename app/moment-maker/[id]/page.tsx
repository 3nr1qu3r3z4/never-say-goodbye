import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import ConnectionRequestButton from "./connection-request-button";
import ProfileLocations from "@/app/profile-locations";
import { frequentVisitsEnabled } from "@/lib/frequent-visits";
import type { ConnectionStatus } from "@/app/actions/connected-lives";
import VisitTracker from "./visit-tracker";
import MomentActionsMenu from "@/app/moments/moment-actions-menu";

export const instant = false;

export const metadata: Metadata = {
  title: "Moment Maker Profile | Never Say Goodbye",
};

type Profile = {
  id: string;
  displayName: string;
  bio: string;
  birthplace: string;
  location: string;
  descriptorOne: string;
  descriptorTwo: string;
  descriptorThree: string;
  profilePhoto: string | null;
  publicProfilePhoto: boolean;
  publicProfileBio: boolean;
  publicSharedMoments: boolean;
  publicPersonalMoments: boolean;
  discoverability: "searchable" | "public";
};

type Moment = {
  id: string;
  title: string;
  kind: "shared" | "personal";
};

export default async function MomentMakerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const sql = getSql();
  const [profileRows] = await Promise.all([
    sql`
      SELECT u.id,
             COALESCE(NULLIF(BTRIM(u.display_name), ''), 'Moment Maker') AS "displayName",
             COALESCE(to_jsonb(u) ->> 'bio', '') AS bio,
             CASE WHEN u.public_birthplace THEN COALESCE(u.birthplace, '') ELSE '' END AS birthplace,
             CASE WHEN u.public_location THEN COALESCE(u.location, '') ELSE '' END AS location,
             COALESCE(to_jsonb(u) ->> 'descriptor_one', '') AS "descriptorOne",
             COALESCE(to_jsonb(u) ->> 'descriptor_two', '') AS "descriptorTwo",
             COALESCE(to_jsonb(u) ->> 'descriptor_three', '') AS "descriptorThree",
             NULLIF(to_jsonb(u) ->> 'profile_photo_data', '') AS "profilePhoto",
             COALESCE((to_jsonb(u) ->> 'public_profile_photo')::boolean, TRUE) AS "publicProfilePhoto",
             COALESCE((to_jsonb(u) ->> 'public_profile_bio')::boolean, TRUE) AS "publicProfileBio",
             COALESCE((to_jsonb(u) ->> 'public_shared_moments')::boolean, TRUE) AS "publicSharedMoments",
             COALESCE((to_jsonb(u) ->> 'public_personal_moments')::boolean, FALSE) AS "publicPersonalMoments",
             u.discoverability
      FROM users AS u
      WHERE u.id = ${id}
        AND u.discoverability IN ('searchable', 'public')
      LIMIT 1
    `,
  ]);
  const profile = (profileRows as Profile[])[0];
  if (!profile) notFound();

  const [momentRows, connectionRows] = await Promise.all([
    sql`
      SELECT id, title, kind
      FROM moments
      WHERE user_id = ${profile.id}
        AND audience = 'public'
        AND kind IN ('shared', 'personal')
        AND (kind <> 'shared' OR access_code_hash IS NULL)
      ORDER BY created_at DESC
    `,
    currentUser && currentUser.id !== profile.id
      ? sql`
          SELECT status, owner_user_id AS "ownerUserId",
                 connected_user_id AS "connectedUserId"
          FROM connected_lives
          WHERE (owner_user_id = ${currentUser.id}
                 AND connected_user_id = ${profile.id})
             OR (owner_user_id = ${profile.id}
                 AND connected_user_id = ${currentUser.id})
          ORDER BY (status = 'accepted') DESC
          LIMIT 1
        `
      : Promise.resolve([]),
  ]);
  const moments = momentRows as Moment[];
  const sharedMoments =
    profile.publicSharedMoments
      ? moments.filter((moment) => moment.kind === "shared")
      : [];
  const personalMoments =
    profile.publicPersonalMoments
      ? moments.filter((moment) => moment.kind === "personal")
      : [];
  const connection = (
    connectionRows as {
      status: "pending" | "accepted" | "declined";
      ownerUserId: string;
      connectedUserId: string;
    }[]
  )[0];
  const connectionStatus: ConnectionStatus =
    connection?.status === "accepted"
      ? "connected"
      : connection?.status === "pending"
        ? connection.ownerUserId === currentUser?.id
          ? "sent"
          : "received"
        : "none";
  const descriptors = [
    profile.descriptorOne,
    profile.descriptorTwo,
    profile.descriptorThree,
  ].filter((descriptor) => Boolean(descriptor?.trim()));
  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      {currentUser && currentUser.id !== profile.id && frequentVisitsEnabled() && (
        <VisitTracker profileId={profile.id} />
      )}
      <section className="px-4 pt-4 sm:px-8 sm:pt-8">
        <figure
          aria-label={`Moment Maker profile for ${profile.displayName}`}
          className="relative mx-auto flex aspect-square w-full max-w-[42rem] items-end overflow-hidden rounded-[1.75rem] border border-[#D8A35B]/25 bg-gradient-to-br from-[#344255] via-[#172437] to-[#101827] shadow-2xl shadow-black/30 sm:rounded-[2rem]"
        >
          {profile.publicProfilePhoto && profile.profilePhoto && (
            <Image
              src={profile.profilePhoto}
              alt={`${profile.displayName} profile`}
              fill
              unoptimized
              sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 736px) calc(100vw - 4rem), 672px"
              className="object-cover object-center"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(216,163,91,0.2),transparent_58%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-[#0F172A]/10"
          />
          <span className="absolute bottom-5 left-5 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-[#f0c98e]/80 sm:bottom-8 sm:left-8">
            My Moments
          </span>
        </figure>

        <div className="mx-auto max-w-4xl px-2 pb-12 pt-8 text-center sm:pb-16 sm:pt-10">
          <h1 className="font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
            {profile.displayName}
          </h1>
          {descriptors.length > 0 && (
            <p className="mt-4 font-serif text-base text-slate-300 sm:text-lg">
              {descriptors.map((descriptor, index) => (
                <span key={`${descriptor}-${index}`}>
                  {index > 0 && (
                    <span className="px-2 text-[#D8A35B]">•</span>
                  )}
                  {descriptor}
                </span>
              ))}
            </p>
          )}
          <ProfileLocations birthplace={profile.birthplace} location={profile.location} />
          {profile.publicProfileBio && profile.bio && (
            <p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap leading-7 text-slate-300">
              {profile.bio}
            </p>
          )}
          {currentUser && !isOwnProfile && (
            <ConnectionRequestButton
              profileUserId={profile.id}
              initialStatus={connectionStatus}
            />
          )}
          {isOwnProfile && (
            <Link
              href="/my-profile"
              className="mt-8 inline-flex min-h-12 items-center rounded-full border border-[#D8A35B]/60 px-6 font-semibold text-[#f0c98e] transition hover:bg-[#D8A35B]/10"
            >
              Edit My Profile
            </Link>
          )}
        </div>
      </section>

      {sharedMoments.length > 0 && (
        <section className="border-y border-white/10 bg-slate-950/30 px-6 py-14 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl text-white sm:text-4xl">
              Shared Moments
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sharedMoments.map((moment) => (
                <li
                  key={moment.id}
                  className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 pr-16"
                >
                  <MomentActionsMenu momentId={moment.id} title={moment.title} isAuthor={isOwnProfile} />
                  <p className="font-serif text-lg text-white">{moment.title}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {personalMoments.length > 0 && (
        <section className="px-6 py-14 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-serif text-3xl text-white sm:text-4xl">
              Personal Moments
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {personalMoments.map((moment) => (
                <li
                  key={moment.id}
                  className="rounded-2xl border border-[#D8A35B]/20 bg-white/[0.03] p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                    Private Moment
                  </p>
                  <p className="mt-3 font-serif text-lg text-white">
                    🔒 {moment.title}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
