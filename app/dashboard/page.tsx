import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { getDashboardData } from "@/lib/account-data";
import { requireUser } from "@/lib/auth";
import SignupWelcome from "./signup-welcome";

export const metadata: Metadata = {
  title: "My Legacy | Never Say Goodbye",
  description: "Your Never Say Goodbye moments and connected lives.",
};
export const instant = false;

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  const actions = [
    {
      icon: "➕",
      title: "Create A Moment",
      description: "Record a story, upload a photo, share a memory.",
      href: "/create-moment",
    },
    {
      icon: "🔒",
      title: "Cannot Open Until™",
      description: "Create a moment for a future date or milestone.",
      href: "/create-moment/cannot-open-until",
    },
    {
      icon: "❤️",
      title: "Connected Lives™",
      description: "Manage the people who matter most.",
      href: "/search",
    },
    {
      icon: "🌳",
      title: "Legacy Tree™",
      description: "Explore family connections and future generations.",
      href: "/legacy-tree",
    },
    {
      icon: "📝",
      title: "Drafts",
      count: data.counts.drafts,
      description: "Continue unfinished moments and messages.",
      href: "/drafts",
    },
    {
      icon: "⚙️",
      title: "Legacy Controls™",
      description: "Manage privacy, visibility, and sharing preferences.",
      href: "/legacy-controls",
    },
    {
      icon: "👤",
      title: "My Profile",
      description: "Update how your Moment Maker profile appears.",
      href: "/my-profile",
    },
  ];
  const statistics = [
    { label: "Shared Moments", value: data.counts.sharedMoments },
    { label: "Personal Moments", value: data.counts.personalMoments },
    { label: "Connected Lives", value: data.counts.connectedLives },
    {
      label: "Future Moment Makers™",
      value: data.counts.futureMomentMakers,
    },
    { label: "Drafts", value: data.counts.drafts },
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
            aria-labelledby="connected-lives-heading"
            className="w-full max-w-[18rem] rounded-2xl border border-[#D8A35B]/30 bg-white/[0.04] p-5 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="connected-lives-heading"
                className="font-serif text-xl text-white sm:text-2xl"
              >
                Connected Lives
              </h2>
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8A35B]/25 bg-[#D8A35B]/10 text-lg"
              >
                ❤️
              </span>
            </div>
            <Link
              href="/search"
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#D8A35B]/70 bg-[#D8A35B]/10 px-5 py-3 font-semibold text-[#f0c98e] shadow-lg shadow-[#D8A35B]/10 transition hover:-translate-y-0.5 hover:border-[#D8A35B] hover:bg-[#D8A35B]/15 hover:shadow-[#D8A35B]/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
            >
              <span aria-hidden="true">❤️</span>
              <span>
                {data.counts.connectedLives}{" "}
                {data.counts.connectedLives === 1 ? "Connected Life" : "Connected Lives"}
              </span>
              <span aria-hidden="true" className="text-lg">→</span>
            </Link>
          </section>
          <form action={logoutAction} className="self-start lg:self-center">
            <button
              type="submit"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-slate-300 transition hover:border-[#D8A35B]/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <Suspense fallback={null}>
        <SignupWelcome />
      </Suspense>

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-10 sm:space-y-16 sm:px-8 sm:py-14">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group flex min-h-36 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#D8A35B]/40 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
              >
                <span className="flex items-center justify-between">
                  <span aria-hidden="true" className="text-2xl">
                    {action.icon}
                  </span>
                </span>
                <h3 className="mt-3 font-serif text-xl text-white transition group-hover:text-[#f0c98e]">
                  {action.title}
                  {"count" in action && ` (${action.count})`}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {action.description}
                </p>
              </Link>
            ))}
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
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
              >
                <dd className="font-serif text-3xl text-[#f0c98e] sm:text-4xl">
                  {statistic.value}
                </dd>
                <dt className="mt-2 text-sm leading-5 text-slate-400">
                  {statistic.label}
                </dt>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="future-makers-heading">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              A place reserved for a moment still to come
            </p>
            <h2
              id="future-makers-heading"
              className="mt-2 font-serif text-2xl text-white sm:text-3xl"
            >
              Future Moment Makers™
            </h2>
          </div>
          {data.futureMomentMakers.length === 0 ? (
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h3 className="font-serif text-xl text-white">
                A place for a story still to come
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Future Moment Makers™ you create will be kept here.
              </p>
              <Link
                href="/create-moment/future-moment-maker"
                className="mt-5 inline-flex rounded-full border border-[#D8A35B]/60 px-6 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10"
              >
                Create a Future Moment Maker™
              </Link>
            </article>
          ) : (
            <div className="space-y-4">
              {data.futureMomentMakers.map((futureMaker) => (
                <article
                  key={futureMaker.id}
                  className="rounded-2xl border border-[#D8A35B]/30 bg-gradient-to-br from-slate-800/70 to-slate-950 p-6 shadow-xl shadow-black/20 sm:p-8"
                >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#D8A35B]/40 bg-[#D8A35B]/10 font-serif text-xl text-[#f0c98e] shadow-[0_0_18px_rgba(216,163,91,0.12)]"
                >
                  {futureMaker.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3 className="font-serif text-xl text-white">
                    {futureMaker.name}
                  </h3>
                  <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                    {futureMaker.relationship} · Awaiting Claim
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:gap-8">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Reserved Moments
                  </dt>
                  <dd className="mt-1 font-serif text-lg text-[#f0c98e]">
                    {futureMaker.momentCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Status
                  </dt>
                  <dd className="mt-1 text-sm text-slate-200">Awaiting Claim</dd>
                </div>
              </dl>
            </div>
            <Link
              href="/future-moment-maker"
              className="mt-6 inline-flex rounded-full border border-[#D8A35B]/60 px-6 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
            >
              View Future Moment Maker™
            </Link>
                </article>
              ))}
            </div>
          )}
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
