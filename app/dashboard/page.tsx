import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDashboardData } from "@/lib/account-data";
import { requireUser } from "@/lib/auth";
import { isFounder } from "@/lib/admin";
import { frequentVisitsEnabled, getFrequentVisitSections } from "@/lib/frequent-visits";
import { getRecentFamilyActivity, getRecentOwnMoments } from "@/lib/moment-access";
import { getCalendarEvents, getCalendarSettings, getFamilyBulletins } from "@/lib/family-calendar-data";
import { datedCalendarMilestones, occurrences } from "@/lib/family-calendar";
import { getTreeMilestones } from "@/lib/tree-milestones-data";
import { getLegacyConnections, getLegacyProfile } from "@/lib/my-legacy-data";
import { canManageSuccessor, getOwnSuccessor, hasTransferredSuccessor } from "@/lib/successor";
import MomentCard from "@/app/moments/moment-card";
import SignupWelcome from "./signup-welcome";
import FrequentVisits from "./frequent-visits";

export const metadata: Metadata = {
  title: "My Legacy | Never Say Goodbye",
  description: "Your Never Say Goodbye moments and connected lives.",
};
export const instant = false;

type DashboardAction = {
  icon: string;
  title: string;
  description: string;
} & (
  | { href: string; items?: never }
  | { href?: never; items: { label: string; href: string }[] }
);

const actionCardClassName =
  "group rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] transition duration-200 hover:-translate-y-1 hover:border-[color:var(--nsg-accent)]/40 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-[color:var(--nsg-accent)]/10";
const actionFocusClassName =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ successor?: string }> }) {
  const user = await requireUser();
  const successorEnabled = await canManageSuccessor(user.id);
  const transferred = (await searchParams).successor === "transferred" && await hasTransferredSuccessor(user.id);
  const [data, profile, connections, ownMoments, calendar, moments, bulletins, successor] = await Promise.all([
    getDashboardData(user),
    getLegacyProfile(user.id),
    getLegacyConnections(user.id),
    getRecentOwnMoments(user.id),
    getCalendarSettings(user.id),
    getRecentFamilyActivity(user.id),
    getFamilyBulletins(user.id, null),
    successorEnabled ? getOwnSuccessor(user.id) : Promise.resolve(null),
  ]);
  const selectedTree = calendar.trees[0];
  const [calendarEvents, milestones] = selectedTree
    ? await Promise.all([
      getCalendarEvents(user.id, selectedTree.id),
      getTreeMilestones(user.id, selectedTree.id),
    ])
    : [[], []];
  const today = new Date();
  const end = new Date(today.getTime() + 89 * 24 * 60 * 60 * 1000);
  const upcomingEvents = occurrences(
    [...calendarEvents, ...datedCalendarMilestones(milestones)],
    today.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  ).slice(0, 3);
  const visibility = { private: "Hidden", searchable: "Searchable Only", public: "Public" }[profile.discoverability];
  const familyActivity = [
    ...moments.map((moment) => ({ kind: "moment" as const, ...moment })),
    ...bulletins.map((bulletin) => ({ kind: "bulletin" as const, ...bulletin })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 5);
  const frequentVisits = frequentVisitsEnabled()
    ? await getFrequentVisitSections(user.id)
    : null;
  const actions: DashboardAction[] = [
    {
      icon: "➕",
      title: "Create Moment",
      description: "Record a story, upload a photo, share a memory.",
      items: [
        { label: "New Moment", href: "/create-moment" },
        { label: `Drafts (${data.counts.drafts})`, href: "/drafts" },
        { label: "Shared Moments", href: "/moments" },
        { label: "Shared Moment", href: "/create-moment/shared" },
        { label: "Personal / Protected Moment", href: "/create-moment/personal" },
        { label: "Cannot Open Until™ (scheduled opening)", href: "/create-moment/cannot-open-until" },
      ],
    },
    {
      icon: "❤️",
      title: "Connected Lives™",
      description: "Manage the people who matter most.",
      items: [
        { label: "Connected Lives Directory", href: "/connected-lives" },
        { label: "Create Future Moment Maker™", href: "/create-moment/future-moment-maker" },
        { label: "View Future Moment Makers™", href: "/connected-lives#future-heading" },
        { label: "Family Placeholders (Legacy Tree™)", href: "/legacy-tree" },
        { label: "Honored Lives™", href: "/honored-lives" },
        { label: "Email Preferences", href: "/email-preferences" },
      ],
    },
    {
      icon: "🌳",
      title: "Legacy Tree™",
      description: "Explore family connections and future generations.",
      href: "/legacy-tree",
    },
    {
      icon: "📅",
      title: "Family Calendar™",
      description: "Remember family dates and milestones together.",
      href: "/family-calendar",
    },
    {
      icon: "👤",
      title: "My Profile",
      description: "Update how your Moment Maker profile appears.",
      items: [
        { label: "View Profile", href: "/my-profile" },
        { label: "Legacy Controls™", href: "/legacy-controls" },
        ...(isFounder(user) ? [{ label: "Admin Dashboard", href: "/admin-dashboard" }] : []),
      ],
    },
  ];
  const statistics = [
    { label: "Shared Moments", value: data.counts.sharedMoments, href: "/moments" },
    { label: "Personal Moments", value: data.counts.personalMoments },
    { label: "Connected Lives", value: data.counts.connectedLives, href: "/connected-lives" },
    {
      label: "Future Moment Makers™",
      value: data.counts.futureMomentMakers,
      href: "/connected-lives#future-heading",
    },
    { label: "Drafts", value: data.counts.drafts, href: "/drafts" },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <header className="relative border-b border-[color:var(--nsg-border)]/10 px-6 py-10 sm:px-8 sm:py-14">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_68%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
              Never Say Goodbye
            </p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-white sm:text-5xl">
              My Legacy
            </h1>
            <p className="mt-6 font-serif text-2xl text-white sm:text-3xl">
              Welcome back, {user.firstName}.
            </p>
            <p className="mt-2 text-slate-400">
              Keep building the moments that matter most.
            </p>
            <section aria-labelledby="legacy-reflection-heading" className="mt-7 max-w-md">
              <h2 id="legacy-reflection-heading" className="text-sm font-semibold text-[color:var(--nsg-accent-light)]">
                <span aria-hidden="true">🌳 </span>Legacy Reflection
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {data.reflection}
              </p>
            </section>
            <section aria-labelledby="owner-profile-heading" className="mt-8 flex max-w-xl flex-wrap items-start gap-4 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
              <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--nsg-accent)]/30 bg-slate-900 font-serif text-2xl text-[color:var(--nsg-accent-light)]">
                {profile.profilePhoto ? (
                  <Image src={profile.profilePhoto} alt="" fill unoptimized sizes="80px" className="object-cover" />
                ) : <span aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="owner-profile-heading" className="break-words font-serif text-2xl text-white">{profile.displayName}</h2>
                <p className="mt-1 text-sm text-slate-400">Profile visibility: {visibility}</p>
                {profile.bio && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{profile.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  <Link href="/my-profile" className={`inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>Edit Profile</Link>
                  <Link href="/my-profile/preview" className={`inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>Preview Profile</Link>
                </div>
              </div>
            </section>
          </div>

          <section
            aria-labelledby="moments-in-the-making-heading"
            className="w-full max-w-md rounded-2xl border border-[color:var(--nsg-accent)]/30 bg-white/[0.04] p-5 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="moments-in-the-making-heading"
                className="font-serif text-xl text-white sm:text-2xl"
              >
                Moments in the Making
              </h2>
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--nsg-accent)]/25 bg-[color:var(--nsg-accent)]/10 text-lg"
              >
                ❤️
              </span>
            </div>
            {familyActivity.length ? (
              <ol className="mt-4 divide-y divide-white/10">
                {familyActivity.map((activity) => {
                  if (activity.kind === "bulletin") {
                    return (
                      <li key={`bulletin-${activity.id}`} className="flex gap-3 py-3">
                        <span aria-hidden="true" className="text-xl">❤️</span>
                        <div className="min-w-0">
                          <p className="break-words text-sm leading-5 text-slate-300">New family shout-out from <span className="font-semibold text-white">{activity.authorName}</span></p>
                          <Link href={`/family-calendar?tree=${encodeURIComponent(activity.treeId)}#bulletin-${encodeURIComponent(activity.id)}`} className={`mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>
                            View Shout-Out
                          </Link>
                        </div>
                      </li>
                    );
                  }
                  const types = [
                    activity.hasVideo && "video",
                    activity.hasPhoto && "photo",
                    activity.hasAudio && "audio",
                    activity.hasMessage && "message",
                  ].filter(Boolean);
                  const description = types.length ? types.join(", ").replace(/, ([^,]+)$/, " and $1") : "memory";
                  const icon = activity.hasVideo ? "🎥" : activity.hasPhoto ? "📷" : activity.hasAudio ? "🎵" : "💬";
                  return (
                    <li key={`moment-${activity.id}`} className="flex gap-3 py-3">
                      <span aria-hidden="true" className="text-xl">{icon}</span>
                      <div className="min-w-0">
                        <p className="break-words text-sm leading-5 text-slate-300">
                          New {description} shared by{" "}
                          <span className="font-semibold text-white">{activity.authorName}</span>
                        </p>
                        <time dateTime={activity.createdAt} className="mt-1 block text-xs text-slate-400">
                          {activity.relativeTime}
                        </time>
                        <a
                          href={`/moments/${encodeURIComponent(activity.id)}`}
                          aria-label={`View ${activity.authorName}'s moment`}
                          className={`mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}
                        >
                          View Moment
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="mt-4 text-sm leading-6 text-slate-400">
                <p>No new moments yet.</p>
                <p className="mt-1">Create a memory, share a photo, or upload a video to start building your family&apos;s story.</p>
              </div>
            )}
            {(data.counts.newLivesRequests > 0 || data.counts.unreadLivesNotifications > 0) && (
              <Link href="/connected-lives" className={`mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>
                {data.counts.newLivesRequests > 0
                  ? `${data.counts.newLivesRequests} ${data.counts.newLivesRequests === 1 ? "New Request" : "New Requests"}`
                  : `${data.counts.unreadLivesNotifications} ${data.counts.unreadLivesNotifications === 1 ? "New Update" : "New Updates"}`}
              </Link>
            )}
          </section>
        </div>
      </header>

      <Suspense fallback={null}>
        <SignupWelcome />
      </Suspense>

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-10 sm:space-y-16 sm:px-8 sm:py-14">
        <section aria-labelledby="legacy-quick-actions-heading">
          <h2 id="legacy-quick-actions-heading" className="font-serif text-2xl text-white sm:text-3xl">Quick Actions</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Create Moment", href: "/create-moment" },
              { label: "Open Legacy Tree™", href: "/legacy-tree" },
              { label: "Legacy Controls™", href: "/legacy-controls" },
              { label: "Appearance", href: "/my-profile#appearance" },
              { label: "Email Preferences", href: "/email-preferences" },
              { label: "Membership & Usage", href: "/my-profile/membership" },
            ].map((item) => <Link key={item.href} href={item.href} className={`${actionCardClassName} ${actionFocusClassName} flex min-h-14 items-center justify-center p-4 text-center font-semibold text-[color:var(--nsg-accent-light)]`}>
              {item.label}
            </Link>)}
          </div>
        </section>

        <section aria-labelledby="your-moments-heading">
          <h2 id="your-moments-heading" className="font-serif text-2xl text-white sm:text-3xl">Your Moments</h2>
          <p className="mt-2 text-sm text-slate-400">Your recent Shared Moments appear here.</p>
          {ownMoments.length ? (
            <ul className="mt-5 grid gap-3 lg:grid-cols-2">
              {ownMoments.map((moment) => <MomentCard key={moment.id} moment={moment} />)}
            </ul>
          ) : <p className="mt-5 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 text-sm text-slate-400">You haven&apos;t published a Shared Moment yet.</p>}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/moments" className={`mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>View Shared Moments</a>
        </section>

        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <section aria-labelledby="connections-preview-heading" className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
            <h2 id="connections-preview-heading" className="font-serif text-2xl text-white">Connected Lives™</h2>
            {connections.length ? <ul className="mt-4 space-y-2 text-sm text-slate-300">{connections.map((connection) => <li key={connection.id} className="break-words">{connection.displayName}</li>)}</ul> : <p className="mt-4 text-sm text-slate-400">Your accepted connections will appear here.</p>}
            <Link href="/connected-lives" className={`mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>View Connected Lives™</Link>
          </section>
          <section aria-labelledby="calendar-preview-heading" className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
            <h2 id="calendar-preview-heading" className="font-serif text-2xl text-white">Family Calendar™</h2>
            {selectedTree ? (
              <>
                <p className="mt-3 break-words text-sm text-slate-400">{selectedTree.name} · Next 90 days</p>
                {upcomingEvents.length ? <ul className="mt-3 space-y-3">{upcomingEvents.map((event) => <li key={`${event.id}-${event.date}`} className="break-words text-sm text-slate-300"><time dateTime={event.date} className="block text-xs text-slate-400">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${event.date}T00:00:00Z`))}</time>{event.title}</li>)}</ul> : <p className="mt-3 text-sm text-slate-400">No upcoming events in this period.</p>}
                <Link href={`/family-calendar?tree=${encodeURIComponent(selectedTree.id)}&view=agenda`} className={`mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>View Family Calendar™</Link>
              </>
            ) : <><p className="mt-4 text-sm text-slate-400">Create or join a Legacy Tree™ to see its family calendar.</p><Link href="/family-calendar" className={`mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>View Family Calendar™</Link></>}
          </section>
          <section aria-labelledby="tree-preview-heading" className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
            <h2 id="tree-preview-heading" className="font-serif text-2xl text-white">Legacy Tree™</h2>
            {calendar.trees.length ? <ul className="mt-4 space-y-2 text-sm text-slate-300">{calendar.trees.slice(0, 3).map((tree) => <li key={tree.id} className="break-words"><Link href={`/legacy-tree#legacy-tree-item-${encodeURIComponent(tree.id)}`} className={`hover:underline ${actionFocusClassName}`}>{tree.name}</Link></li>)}</ul> : <p className="mt-4 text-sm text-slate-400">Your family trees will appear here.</p>}
            <Link href="/legacy-tree" className={`mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline ${actionFocusClassName}`}>Open Legacy Tree™</Link>
          </section>
          <section aria-labelledby="summary-heading" className="min-w-0 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5">
            <h2 id="summary-heading" className="font-serif text-2xl text-white">My Legacy Snapshot</h2>
            <dl className="mt-4">
              {statistics.map((statistic) => (
                <div key={statistic.label} className="relative flex min-h-11 items-center justify-between gap-3 text-sm">
                  <dt className="min-w-0 text-slate-300">
                    {statistic.href ? (
                      <Link
                        href={statistic.href}
                        aria-label={`View ${statistic.label}, ${statistic.value}`}
                        className={`transition hover:text-[color:var(--nsg-accent-light)] after:absolute after:inset-0 ${actionFocusClassName}`}
                      >
                        {statistic.label}
                      </Link>
                    ) : statistic.label}
                  </dt>
                  <dd className="shrink-0 font-semibold tabular-nums text-white">{statistic.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {frequentVisits && <FrequentVisits {...frequentVisits} />}
        <section
          id="moment-making-menu"
          aria-labelledby="quick-actions-heading"
        >
          <div className="mb-5">
            <h2
              id="quick-actions-heading"
              className="font-serif text-2xl text-white sm:text-3xl"
            >
              Moment Making Menu
            </h2>
          </div>
          <div className="grid gap-4 has-[details[open]]:items-start sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => {
              const content = (
                <>
                  <span className="flex items-center justify-between">
                    <span aria-hidden="true" className="text-2xl">
                      {action.icon}
                    </span>
                    {action.items && <span aria-hidden="true">▼</span>}
                  </span>
                  <h3 className="mt-3 font-serif text-xl text-white transition group-hover:text-[color:var(--nsg-accent-light)]">
                    {action.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {action.description}
                  </p>
                </>
              );
              return action.items ? (
                <details key={action.title} className={actionCardClassName}>
                  <summary className={`flex min-h-36 cursor-pointer list-none flex-col rounded-2xl p-5 ${actionFocusClassName} [&::-webkit-details-marker]:hidden`}>
                    {content}
                  </summary>
                  <ul className="border-t border-[color:var(--nsg-border)]/10 p-2">
                    {action.items.map((item) => (
                      <li key={item.href}>
                        {item.href === "/moments" ? (
                          <a
                            href={item.href}
                            className={`flex min-h-11 items-center rounded-lg px-3 text-sm text-slate-200 transition hover:bg-white/5 hover:text-[color:var(--nsg-accent-light)] ${actionFocusClassName}`}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link
                            href={item.href}
                            className={`flex min-h-11 items-center rounded-lg px-3 text-sm text-slate-200 transition hover:bg-white/5 hover:text-[color:var(--nsg-accent-light)] ${actionFocusClassName}`}
                          >
                            {item.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <Link
                  key={action.title}
                  href={action.href}
                  className={`${actionCardClassName} flex min-h-36 flex-col p-5 ${actionFocusClassName}`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="activity-heading">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
              The story keeps growing
            </p>
            <h2
              id="activity-heading"
              className="mt-2 font-serif text-2xl text-white sm:text-3xl"
            >
              Recent Activity
            </h2>
          </div>
          <ol className="divide-y divide-white/10 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] px-5 sm:px-7">
            {data.recentActivity.length > 0 ? data.recentActivity.map((activity) => (
              <li
                key={activity.id}
                className="flex gap-4 py-5"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--nsg-accent)] shadow-[0_0_10px_color-mix(in_srgb,var(--nsg-accent)_45%,transparent)]"
                />
                <p className="text-sm leading-6 text-slate-300">
                  <span className="text-slate-500">{activity.action}:</span>{" "}
                  <span className="text-white">{activity.detail}</span>
                </p>
              </li>
            )) : (
              <li className="py-5 text-sm text-slate-400">
                Your recent moments and connections will appear here.
              </li>
            )}
          </ol>
        </section>

        {transferred && <p role="status" className="rounded-xl border border-emerald-300/20 p-4 text-emerald-200">Your Lifetime Membership was permanently transferred.</p>}
        {successorEnabled && <section aria-labelledby="successor-heading">
          <div className="flex flex-col gap-5 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
                Planning for the future
              </p>
              <h2
                id="successor-heading"
                className="mt-2 font-serif text-2xl text-white"
              >
                Legacy Successor™
              </h2>
              <p className="mt-3 text-sm text-slate-300">Choose one trusted person to inherit your Lifetime Membership.</p>
              <p className="mt-3 font-serif text-lg text-slate-300">
                {successor ? successor.name : "Not Assigned"}
              </p>
              {successor && !successor.valid && <p className="mt-2 text-sm text-amber-200">Choose another successor.</p>}
            </div>
            {successorEnabled && <Link
              href="/my-profile/successor"
              className="inline-flex self-start rounded-full border border-[color:var(--nsg-accent)]/60 px-6 py-3 text-sm font-semibold text-[color:var(--nsg-accent-light)] transition hover:border-[color:var(--nsg-accent)] hover:bg-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] sm:self-auto"
            >
              {successor ? "Manage Successor" : "Assign Successor"}
            </Link>}
          </div>
        </section>}
      </div>

      <footer className="border-t border-[color:var(--nsg-border)]/10 px-6 py-8 text-center sm:px-8">
        <p className="font-serif text-lg leading-relaxed text-white">
          Build it today.
          <br />
          Leave it forever.
        </p>
        <p className="mt-4 text-xs tracking-wide text-slate-500">
          NeverSayGoodbye.life
        </p>
      </footer>
    </main>
  );
}
