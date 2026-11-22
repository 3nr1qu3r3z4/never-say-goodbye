import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardData } from "@/lib/account-data";
import { requireUser } from "@/lib/auth";
import { isFounder } from "@/lib/admin";
import { frequentVisitsEnabled, getFrequentVisitSections } from "@/lib/frequent-visits";
import { getRecentFamilyActivity } from "@/lib/moment-access";
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
  "group rounded-2xl border border-white/10 bg-white/[0.03] transition duration-200 hover:-translate-y-1 hover:border-[#D8A35B]/40 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-[#D8A35B]/10";
const actionFocusClassName =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]";
const notificationActionClassName =
  "flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#D8A35B]/70 bg-[#D8A35B]/10 px-5 py-3 text-center font-semibold text-[#f0c98e] shadow-lg shadow-[#D8A35B]/10 transition hover:-translate-y-0.5 hover:border-[#D8A35B] hover:bg-[#D8A35B]/15 hover:shadow-[#D8A35B]/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  const familyActivity = await getRecentFamilyActivity(user.id);
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
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <header className="relative border-b border-white/10 px-6 py-10 sm:px-8 sm:py-14">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_68%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
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
          </div>

          <section
            aria-labelledby="moments-in-the-making-heading"
            className="w-full max-w-md rounded-2xl border border-[#D8A35B]/30 bg-white/[0.04] p-5 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6"
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8A35B]/25 bg-[#D8A35B]/10 text-lg"
              >
                ❤️
              </span>
            </div>
            {familyActivity.length ? (
              <ol className="mt-4 divide-y divide-white/10">
                {familyActivity.map((activity) => {
                  const types = [
                    activity.hasVideo && "video",
                    activity.hasPhoto && "photo",
                    activity.hasMessage && "message",
                  ].filter(Boolean);
                  const description = types.length ? types.join(", ").replace(/, ([^,]+)$/, " and $1") : "memory";
                  const icon = activity.hasVideo ? "🎥" : activity.hasPhoto ? "📷" : "💬";
                  return (
                    <li key={activity.id} className="flex gap-3 py-3">
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
                          className={`mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[#f0c98e] hover:underline ${actionFocusClassName}`}
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
              <Link href="/connected-lives" className={`mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#f0c98e] hover:underline ${actionFocusClassName}`}>
                {data.counts.newLivesRequests > 0
                  ? `${data.counts.newLivesRequests} ${data.counts.newLivesRequests === 1 ? "New Request" : "New Requests"}`
                  : `${data.counts.unreadLivesNotifications} ${data.counts.unreadLivesNotifications === 1 ? "New Update" : "New Updates"}`}
              </Link>
            )}
            <Link href="/search" className={`mt-4 ${notificationActionClassName}`}>
              <span>Find People</span>
              <span aria-hidden="true" className="text-lg">→</span>
            </Link>
          </section>
        </div>
      </header>

      <Suspense fallback={null}>
        <SignupWelcome />
      </Suspense>

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-10 sm:space-y-16 sm:px-8 sm:py-14">
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
                  <h3 className="mt-3 font-serif text-xl text-white transition group-hover:text-[#f0c98e]">
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
                  <ul className="border-t border-white/10 p-2">
                    {action.items.map((item) => (
                      <li key={item.href}>
                        {item.href === "/moments" ? (
                          <a
                            href={item.href}
                            className={`flex min-h-11 items-center rounded-lg px-3 text-sm text-slate-200 transition hover:bg-white/5 hover:text-[#f0c98e] ${actionFocusClassName}`}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link
                            href={item.href}
                            className={`flex min-h-11 items-center rounded-lg px-3 text-sm text-slate-200 transition hover:bg-white/5 hover:text-[#f0c98e] ${actionFocusClassName}`}
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

        <section aria-label="Search your legacy">
          <label htmlFor="legacy-search" className="sr-only">
            Search moments, people, messages, trees, future moment makers, and
            drafts
          </label>
          <input
            id="legacy-search"
            type="search"
            placeholder="Search moments, people, messages, trees, future moment makers, and drafts..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white placeholder:text-slate-500 focus:border-[#D8A35B]/50 focus:outline-none focus:ring-2 focus:ring-[#D8A35B]/20"
          />
        </section>

        <section aria-labelledby="summary-heading">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              Your story, at a glance
            </p>
            <h2
              id="summary-heading"
              className="mt-2 font-serif text-2xl text-white sm:text-3xl"
            >
              My Legacy Snapshot
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {statistics.map((statistic) => (
              <div
                key={statistic.label}
                className={`relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 ${
                  statistic.href ? "group transition hover:border-[#D8A35B]/40 hover:bg-white/[0.06]" : ""
                }`}
              >
                <dt className="order-2 mt-2 text-sm leading-5 text-slate-400">
                  {statistic.label}
                  {statistic.href && (
                    <>
                      <span aria-hidden="true" className="ml-2 inline-block text-[#f0c98e] transition group-hover:translate-x-1">→</span>
                      <Link
                        href={statistic.href}
                        aria-label={`View ${statistic.label}, ${statistic.value}`}
                        className={`absolute inset-0 rounded-2xl ${actionFocusClassName}`}
                      />
                    </>
                  )}
                </dt>
                <dd className="order-1 font-serif text-3xl text-[#f0c98e] sm:text-4xl">
                  {statistic.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="activity-heading">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              The story keeps growing
            </p>
            <h2
              id="activity-heading"
              className="mt-2 font-serif text-2xl text-white sm:text-3xl"
            >
              Recent Activity
            </h2>
          </div>
          <ol className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] px-5 sm:px-7">
            {data.recentActivity.length > 0 ? data.recentActivity.map((activity) => (
              <li
                key={activity.id}
                className="flex gap-4 py-5"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#D8A35B] shadow-[0_0_10px_rgba(216,163,91,0.45)]"
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

        <section aria-labelledby="successor-heading">
          <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
                Planning for the future
              </p>
              <h2
                id="successor-heading"
                className="mt-2 font-serif text-2xl text-white"
              >
                Legacy Successor™
              </h2>
              <p className="mt-3 font-serif text-lg text-slate-300">
                Not Assigned
              </p>
            </div>
            <button
              type="button"
              className="inline-flex self-start rounded-full border border-[#D8A35B]/60 px-6 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] sm:self-auto"
            >
              Assign Successor
            </button>
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10 px-6 py-8 text-center sm:px-8">
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
