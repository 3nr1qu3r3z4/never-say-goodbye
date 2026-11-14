import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import ProfilePhotoEditor from "./profile-photo-editor";

export const metadata: Metadata = {
  title: "My Profile | Never Say Goodbye",
  description: "Preview your Moment Maker profile.",
};

export const instant = false;

type ProfileMoment = {
  id: string;
  title: string;
  kind: "shared" | "personal";
};

type ConnectedLife = {
  id: string;
  displayName: string;
  relationship: string;
};

export default async function MyProfilePage() {
  const user = await requireUser();
  const sql = getSql();
  const [profileRows, momentRows, connectedLifeRows] = await Promise.all([
    sql`
      SELECT profile_photo_data AS "profilePhoto"
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
  const profilePhoto =
    (profileRows as { profilePhoto: string | null }[])[0]?.profilePhoto ?? null;
  const moments = momentRows as ProfileMoment[];
  const connectedLives = connectedLifeRows as ConnectedLife[];
  const sharedMoments = moments.filter((moment) => moment.kind === "shared");
  const personalMoments = moments.filter((moment) => moment.kind === "personal");

  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <section className="px-4 pt-4 sm:px-8 sm:pt-8">
        <figure
          aria-label={`Moment Maker profile for ${user.displayName}`}
          className="relative mx-auto flex h-[45svh] min-h-[20rem] max-h-[38rem] max-w-6xl items-end overflow-hidden rounded-[1.75rem] border border-[#D8A35B]/25 bg-gradient-to-br from-[#344255] via-[#172437] to-[#101827] shadow-2xl shadow-black/30 sm:rounded-[2rem]"
        >
          <ProfilePhotoEditor initialPhoto={profilePhoto} />
          <div
            aria-hidden="true"
            className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_50%_45%,rgba(216,163,91,0.2),transparent_58%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 z-10 bg-gradient-to-t from-[#0F172A] via-transparent to-[#0F172A]/10"
          />
          <span className="relative z-20 p-5 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-[#f0c98e]/80 sm:p-8">
            My Moments
          </span>
        </figure>

        <div className="mx-auto max-w-4xl px-2 pb-12 pt-8 text-center sm:pb-16 sm:pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Moment Maker
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
            {user.displayName}
          </h1>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full border border-[#D8A35B]/60 px-6 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
          >
            Back to My Legacy
          </Link>
        </div>
      </section>

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
