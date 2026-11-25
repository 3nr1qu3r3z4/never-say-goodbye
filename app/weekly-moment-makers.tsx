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
      <p className="mt-4 text-slate-400">Featured profiles are temporarily unavailable.</p>
    );
  }

  return (
    <>
      {profiles.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No profiles are featured this week.</p>
      ) : (
        <ul aria-labelledby="weekly-moment-makers-heading" tabIndex={0} className="mt-4 flex gap-4 overflow-x-auto pb-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">
          {profiles.map((profile) => {
            const descriptors = [profile.descriptorOne, profile.descriptorTwo, profile.descriptorThree]
              .filter((descriptor) => descriptor.trim());
            return (
              <li key={profile.id} className="w-64 shrink-0 rounded-2xl border border-[color:var(--nsg-accent)]/20 bg-white/[0.03] p-5 sm:p-6">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border border-[color:var(--nsg-accent)]/30 bg-slate-900">
                  {profile.profilePhoto ? (
                    <Image src={profile.profilePhoto} alt="" fill unoptimized sizes="80px" className="object-cover" />
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 160 160" fill="none" className="absolute inset-0 m-auto h-16 w-16 text-[color:var(--nsg-accent)]/30">
                      <circle cx="80" cy="52" r="30" fill="currentColor" />
                      <path d="M25 145c4-33 25-51 55-51s51 18 55 51" fill="currentColor" />
                    </svg>
                  )}
                </div>
                <h4 className="mt-4 font-serif text-xl text-white">{profile.displayName}</h4>
                {descriptors.length > 0 && <p className="mt-2 text-sm text-slate-300">{descriptors.join(" · ")}</p>}
                {profile.location && <p className="mt-2 text-sm text-slate-400">{profile.location}</p>}
                <Link
                  href={`/moment-maker/${encodeURIComponent(profile.id)}`}
                  className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[color:var(--nsg-accent)]/50 px-5 py-2 text-sm font-semibold text-[color:var(--nsg-accent-light)] transition hover:bg-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
                  aria-label={`View ${profile.displayName}'s profile`}
                >
                  View Profile
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
