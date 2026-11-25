import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDashboardData } from "@/lib/admin-dashboard-data";

export const metadata: Metadata = {
  title: "Admin Dashboard | Never Say Goodbye",
  robots: { index: false, follow: false },
};
export const instant = false;

const cardClass = "rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5";

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className={cardClass}><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-2 font-serif text-3xl text-white">{typeof value === "number" ? value.toLocaleString("en-US") : value}</dd></div>;
}

export default async function AdminDashboardPage() {
  const { counts, signups, analytics } = await getAdminDashboardData();
  const totals = analytics?.totals;
  const conversion = totals && totals.unique90 > 0
    ? `${(totals.signups90 / totals.unique90 * 100).toFixed(1)}%`
    : "Unavailable";

  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-6xl space-y-10">
        <header>
          <Link href="/dashboard" className="text-sm text-[color:var(--nsg-accent-light)] hover:underline">← My Legacy</Link>
          <h1 className="mt-5 font-serif text-4xl text-white">Admin Dashboard</h1>
          <p className="mt-3 text-slate-400">A read-only view of platform health.</p>
        </header>

        <section aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="mb-4 font-serif text-2xl">Founder Overview</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Visitors Today" value={totals?.visitorsToday ?? "Unavailable"} />
            <Stat label="Visitors This Week" value={totals?.visitorsWeek ?? "Unavailable"} />
            <Stat label="Visitors This Month" value={totals?.visitorsMonth ?? "Unavailable"} />
            <Stat label="Accounts Created" value={counts.users} />
            <Stat label="Conversion Rate (90 days)" value={conversion} />
            <Stat label="Profiles Completed" value={counts.completedProfiles} />
            <Stat label="First Moments Created" value={counts.membersWithMoments} />
            <Stat label="Connected Lives Established" value={counts.acceptedConnections} />
          </dl>
          <p className="mt-3 text-sm text-slate-400">Visitors are unique browsers, measured in UTC calendar periods; weeks start Monday. First moments count members with a published moment; established connections are accepted connections. Accounts and profiles reflect current records. Conversion is a 90-day estimate.</p>
        </section>

        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="mb-4 font-serif text-2xl">Platform Summary</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Registered Users" value={counts.users} />
            <Stat label="Completed Profiles" value={counts.completedProfiles} />
            <Stat label="Connected Lives (accepted)" value={counts.connectedLives} />
            <Stat label="Moments Created" value={counts.moments} />
            <Stat label="Current Profile Photos" value={counts.profilePhotos} />
            <Stat label="Total Site Visits" value={totals?.visits ?? "Unavailable"} />
            <Stat label="Unique Visitors (90 days)" value={totals?.unique90 ?? "Unavailable"} />
            <Stat label="Visitor-to-Signup Estimate (90 days)" value={conversion} />
          </dl>
          <p className="mt-3 text-sm text-slate-400">A completed profile has a photo and a non-empty bio. Profile photos count current photos, not historical uploads. Moment media uploads are not currently stored.</p>
        </section>

        <section aria-labelledby="funnel-heading">
          <h2 id="funnel-heading" className="mb-4 font-serif text-2xl">Visitor Funnel</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Site Visitors (90 days)" value={totals?.unique90 ?? "Unavailable"} />
            <Stat label="Accounts Created" value={counts.users} />
            <Stat label="Profiles Completed" value={counts.completedProfiles} />
            <Stat label="Members With a Moment" value={counts.membersWithMoments} />
            <Stat label="Members Who Created a Connected Life" value={counts.membersWithConnections} />
          </dl>
          <p className="mt-3 text-sm text-slate-400">Visitor and account figures cover different periods; this is a platform snapshot, not a cohort funnel. Account counts reflect current records.</p>
        </section>

        <section aria-labelledby="conversion-heading" className={cardClass}>
          <h2 id="conversion-heading" className="font-serif text-2xl">Conversion and Visits</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><dt className="text-sm text-slate-400">Total Site Visits</dt><dd>{totals?.visits.toLocaleString("en-US") ?? "Unavailable"}</dd></div>
            <div><dt className="text-sm text-slate-400">Total Registered Users</dt><dd>{counts.users.toLocaleString("en-US")}</dd></div>
            <div><dt className="text-sm text-slate-400">Estimated Conversion Rate</dt><dd>{conversion}</dd></div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-slate-400">Estimated conversion is browsers with an attributable signup divided by unique browsers seen in the last 90 days, not total registrations divided by visits. Tracking starts when enabled; earlier activity is unavailable. Visits are browser sessions separated by 30 minutes without a page navigation. Blockers, shared devices and bots affect these estimates.</p>
        </section>

        <section aria-labelledby="signups-heading" className={cardClass}>
          <h2 id="signups-heading" className="font-serif text-2xl">Recent Signups</h2>
          {signups.length === 0 ? <p className="mt-4 text-slate-400">No registered users yet.</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="text-slate-400"><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Join Date (UTC)</th><th className="p-2">Profile</th></tr></thead>
                <tbody>{signups.map((signup) => <tr key={`${signup.email}-${signup.createdAt}`} className="border-t border-[color:var(--nsg-border)]/10"><td className="p-2">{signup.name}</td><td className="p-2">{signup.email}</td><td className="p-2">{signup.createdAt.slice(0, 10)}</td><td className="p-2">{signup.complete ? "Complete" : "Incomplete"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="mb-4 font-serif text-2xl">Platform Activity</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Future Moment Makers" value={counts.futureMakers} />
            <Stat label="Family Placeholders" value={counts.placeholders} />
            <Stat label="Legacy Tree Memberships" value={counts.treeMembers} />
            <Stat label="Draft Moments" value={counts.drafts} />
            <Stat label="Published Moments" value={counts.moments} />
          </dl>
        </section>

        <section aria-labelledby="engagement-heading">
          <h2 id="engagement-heading" className="mb-4 font-serif text-2xl">Engagement</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Stat label="Pending Connection Requests" value={counts.pendingConnections} />
            <Stat label="Accepted Connections" value={counts.acceptedConnections} />
          </dl>
        </section>

        <section aria-labelledby="visits-heading" className={cardClass}>
          <h2 id="visits-heading" className="font-serif text-2xl">Visitor Insight</h2>
          {analytics ? <>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-slate-400">Last 7 Days Visits</dt><dd>{analytics.totals.visits7.toLocaleString("en-US")}</dd></div>
              <div><dt className="text-sm text-slate-400">Last 30 Days Visits</dt><dd>{analytics.totals.visits30.toLocaleString("en-US")}</dd></div>
            </dl>
            <h3 className="mt-6 font-semibold">Daily Visits (UTC)</h3>
            {analytics.daily.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{analytics.daily.map((day) => <li key={day.date}>{day.date}: {day.visits.toLocaleString("en-US")}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">No visits recorded yet.</p>}
          </> : <p className="mt-4 text-sm text-slate-400">Visitor tracking is not enabled.</p>}
        </section>
      </div>
    </main>
  );
}
