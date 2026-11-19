import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { getSql } from "@/lib/db";

type FeaturedProfile = {
  id: string;
  displayName: string;
  descriptorOne: string;
  descriptorTwo: string;
  descriptorThree: string;
  location: string;
  profilePhoto: string | null;
};

export default async function WeeklyMomentMakers() {
  await connection();
  let profiles: FeaturedProfile[];
  try {
    const sql = getSql();
    profiles = (await sql`SELECT * FROM get_weekly_moment_makers()`) as FeaturedProfile[];
  } catch (error) {
    console.error("[weekly-moment-makers] Unable to load weekly profiles", error);
    return (
      <section aria-labelledby="weekly-moment-makers-heading" className="mx-auto max-w-6xl px-6 py-20 sm:px-8">
        <h2 id="weekly-moment-makers-heading" className="font-serif text-3xl text-white sm:text-4xl">This Week&apos;s Moment Makers™</h2>
        <p className="mt-4 text-slate-400">Featured profiles are temporarily unavailable.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="weekly-moment-makers-heading" className="mx-auto max-w-6xl px-6 py-20 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">Stories to discover</p>
      <h2 id="weekly-moment-makers-heading" className="mt-3 font-serif text-3xl text-white sm:text-4xl">This Week&apos;s Moment Makers™</h2>
      <p className="mt-4 max-w-3xl leading-7 text-slate-400">
        Discover members who have chosen to share their profiles with the community.
      </p>
      {profiles.length === 0 ? (
        <p className="mt-8 text-sm text-slate-400">No profiles are featured this week.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const descriptors = [profile.descriptorOne, profile.descriptorTwo, profile.descriptorThree]
              .filter((descriptor) => descriptor.trim());
            return (
              <li key={profile.id} className="rounded-2xl border border-[#D8A35B]/20 bg-white/[0.03] p-5 sm:p-6">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border border-[#D8A35B]/30 bg-slate-900">
                  {profile.profilePhoto ? (
                    <Image src={profile.profilePhoto} alt="" fill unoptimized sizes="80px" className="object-cover" />
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 160 160" fill="none" className="absolute inset-0 m-auto h-16 w-16 text-[#D8A35B]/30">
                      <circle cx="80" cy="52" r="30" fill="currentColor" />
                      <path d="M25 145c4-33 25-51 55-51s51 18 55 51" fill="currentColor" />
                    </svg>
                  )}
                </div>
                <h3 className="mt-4 font-serif text-xl text-white">{profile.displayName}</h3>
                {descriptors.length > 0 && <p className="mt-2 text-sm text-slate-300">{descriptors.join(" · ")}</p>}
                {profile.location && <p className="mt-2 text-sm text-slate-400">{profile.location}</p>}
                <Link
                  href={`/moment-maker/${encodeURIComponent(profile.id)}`}
                  className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#D8A35B]/50 px-5 py-2 text-sm font-semibold text-[#f0c98e] transition hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
                  aria-label={`View ${profile.displayName}'s profile`}
                >
                  View Profile
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
