import type { createUsageReport, QuotaStatus } from "@/lib/entitlements";

type UsageReport = ReturnType<typeof createUsageReport>;

function UsageCard({ label, quota, grandfathered }: {
  label: string;
  quota: QuotaStatus;
  grandfathered: boolean;
}) {
  const limit = quota.planLimit;
  const showProgress = !grandfathered && typeof limit === "number" && limit > 0;
  const percentage = showProgress ? quota.current / limit * 100 : 0;
  const status = percentage >= 100 ? "At or above plan allowance"
    : percentage >= 95 ? "Near plan allowance"
      : percentage >= 80 ? "Approaching plan allowance" : null;

  return (
    <div className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-slate-950/30 p-4">
      <h3 className="text-sm font-semibold text-slate-200">{label}</h3>
      <p className="mt-3 font-serif text-2xl text-white">
        {quota.current.toLocaleString()}
        {!grandfathered && typeof limit === "number" && <span className="text-slate-400"> / {limit.toLocaleString()}</span>}
      </p>
      {grandfathered ? (
        <p className="mt-2 text-xs text-slate-400">
          No plan-based limit{typeof limit === "number" ? ` · Plan reference: ${limit.toLocaleString()}` : ""}
        </p>
      ) : limit === null ? (
        <p className="mt-2 text-xs text-slate-400">No plan-based limit</p>
      ) : limit === "unreviewed" ? (
        <p className="mt-2 text-xs text-slate-400">Plan allowance unavailable</p>
      ) : null}
      {showProgress && (
        <div
          role="progressbar"
          aria-label={`${label} against plan allowance`}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(quota.current, limit)}
          aria-valuetext={`${quota.current} of ${limit}`}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div className="h-full rounded-full bg-[color:var(--nsg-accent)]" style={{ width: `${Math.min(percentage, 100)}%` }} />
        </div>
      )}
      {showProgress && quota.effectiveLimit !== "unreviewed" && status && <p className="mt-2 text-xs font-medium text-[color:var(--nsg-accent-light)]">{status}</p>}
    </div>
  );
}

export default function MembershipUsage({ report, planName, themes }: {
  report: UsageReport;
  planName: string;
  themes: readonly string[];
}) {
  const grandfathered = report.betaAccess === "grandfathered";
  return (
    <>
      <header className="mt-10 sm:mt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--nsg-accent)]">Your membership</p>
        <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">Membership &amp; Usage</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-300">A simple look at the stories and moments you&apos;re preserving.</p>
      </header>

      <section aria-labelledby="membership-heading" className="mt-9 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <h2 id="membership-heading" className="font-serif text-2xl text-white">Your Membership</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Current Plan</dt>
            <dd className="mt-2 font-serif text-xl text-white">{planName}</dd>
            {grandfathered && <dd className="mt-2 text-sm font-semibold text-[color:var(--nsg-accent-light)]">Grandfathered Beta Access</dd>}
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Theme Access</dt>
            <dd className="mt-2 text-sm leading-6 text-slate-200">{themes.join(" · ")}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="usage-heading" className="mt-6 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <h2 id="usage-heading" className="font-serif text-2xl text-white">Usage Summary</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {grandfathered
            ? "Your beta access has no plan-based limits. Plan references are shown for comparison."
            : "Plan allowances are shown for reference. No plan limits are enforced during beta."}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <UsageCard label="Photos" quota={report.photos} grandfathered={grandfathered} />
          <UsageCard label="Stories" quota={report.stories} grandfathered={grandfathered} />
          <UsageCard label="Audio Moments" quota={report.audioMoments} grandfathered={grandfathered} />
          {report.videos.kind === "audience" ? (
            <>
              <UsageCard label="Public Videos" quota={report.videos.public} grandfathered={grandfathered} />
              <UsageCard label="Non-public Videos" quota={report.videos.nonPublic} grandfathered={grandfathered} />
            </>
          ) : report.videos.kind === "total" ? (
            <UsageCard label="Videos" quota={report.videos.total} grandfathered={grandfathered} />
          ) : (
            <div className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-slate-950/30 p-4">
              <h3 className="text-sm font-semibold text-slate-200">Videos</h3>
              <p className="mt-3 font-serif text-2xl text-white">{report.videos.total.toLocaleString()}</p>
              <p className="mt-2 text-xs text-slate-400">{grandfathered ? "No plan-based limit" : "Plan allowance unavailable"}</p>
            </div>
          )}
          <UsageCard label="Future Moment Makers™" quota={report.futureMomentMakers} grandfathered={grandfathered} />
          <UsageCard label="Cannot Open Until™ Moments" quota={report.cannotOpenUntil} grandfathered={grandfathered} />
        </div>
      </section>
    </>
  );
}
