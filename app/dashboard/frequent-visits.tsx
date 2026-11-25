import Image from "next/image";
import Link from "next/link";
import type { NavigationProfile } from "@/lib/frequent-visits";

function ProfileCards({ profiles }: { profiles: NavigationProfile[] }) {
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {profiles.map((profile) => (
        <li key={profile.id}>
          <Link
            href={`/moment-maker/${encodeURIComponent(profile.id)}`}
            className="flex h-full items-center gap-4 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-4 transition hover:border-[color:var(--nsg-accent)]/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
          >
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--nsg-accent)]/30 bg-slate-900 font-serif text-lg text-[color:var(--nsg-accent-light)]">
              {profile.profilePhoto ? (
                <Image src={profile.profilePhoto} alt="" fill unoptimized sizes="56px" className="object-cover" />
              ) : (
                <span aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block break-words font-serif text-lg text-white">{profile.displayName}</span>
              <span className="mt-1 block text-sm text-slate-400">{profile.relationship}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function FrequentVisits({ visited, suggested }: {
  visited: NavigationProfile[];
  suggested: NavigationProfile[];
}) {
  return (
    <div className="space-y-10">
      <section aria-labelledby="frequently-visited-heading">
        <h2 id="frequently-visited-heading" className="font-serif text-2xl text-white sm:text-3xl">
          Frequently Visited
        </h2>
        {visited.length ? <ProfileCards profiles={visited} /> : (
          <p className="mt-4 text-sm text-slate-400">
            Profiles you visit will appear here.
          </p>
        )}
      </section>
      {suggested.length > 0 && (
        <section aria-labelledby="suggested-connections-heading">
          <h2 id="suggested-connections-heading" className="font-serif text-2xl text-white sm:text-3xl">
            Suggested Connections
          </h2>
          <p className="mt-2 text-sm text-slate-400">People from your Connected Lives™.</p>
          <ProfileCards profiles={suggested} />
        </section>
      )}
    </div>
  );
}
