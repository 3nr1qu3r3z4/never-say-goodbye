import type { Metadata } from "next";
import Link from "next/link";
import { membershipPlans, membershipPrice } from "@/lib/membership-plans";

export const metadata: Metadata = {
  title: "Membership Plans & Pricing | Never Say Goodbye",
  description: "Explore the planned Never Say Goodbye membership options.",
};

const spotlight = [
  { text: "Automatic Family Reminders", planned: true },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-12 text-slate-100 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--nsg-accent)]">A legacy for every family</p>
          <h1 className="mt-4 font-serif text-4xl text-white sm:text-5xl">Membership Plans &amp; Pricing</h1>
          <p className="mt-4 leading-7 text-slate-300">Choose the future plan that feels right for your story.</p>
        </header>
        <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[color:var(--nsg-accent)]/30 bg-[color:var(--nsg-accent)]/[0.07] p-5 text-sm leading-6 text-slate-200">
          These plans are a preview of our future membership model. During beta, everyone keeps their current access without the listed plan limits. Only Free Legacy signup is available; paid plans are coming soon.
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {membershipPlans.map((plan) => (
            <section key={plan.id} className={`flex min-w-0 flex-col rounded-3xl border bg-white/[0.03] p-6 ${plan.mostPopular ? "border-[color:var(--nsg-accent)]/70 shadow-lg shadow-[color:var(--nsg-accent)]/10" : "border-[color:var(--nsg-border)]/10"}`}>
              <div className="flex flex-wrap gap-2">
                {plan.mostPopular && <span className="rounded-full bg-[color:var(--nsg-accent)]/20 px-3 py-1 text-xs font-semibold text-[color:var(--nsg-accent-light)]">⭐ Most Popular</span>}
                {!plan.available && <span className="rounded-full border border-[color:var(--nsg-border)]/15 px-3 py-1 text-xs font-semibold text-slate-300">Coming Soon</span>}
              </div>
              <h2 className="mt-4 font-serif text-2xl text-white">{plan.name}</h2>
              <p className="mt-2 text-xl font-semibold text-[color:var(--nsg-accent-light)]">{membershipPrice(plan)}</p>
              <p className="mt-4 text-sm leading-6 text-slate-400">{plan.tagline}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm leading-5 text-slate-200">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex gap-2">
                    <span aria-hidden="true" className="text-[color:var(--nsg-accent)]">{feature.planned ? "◷" : "✓"}</span>
                    <span>{feature.text}{feature.planned && <span className="text-slate-400"> (Coming Soon)</span>}</span>
                  </li>
                ))}
              </ul>
              {plan.available && <Link href="/signup" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--nsg-accent)] px-5 text-center text-sm font-semibold text-[color:var(--nsg-background)] hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">Create a Free Account</Link>}
            </section>
          ))}
        </div>
        <section className="mt-12 rounded-3xl border border-[color:var(--nsg-accent)]/25 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="font-serif text-3xl text-white">Never Forget™ Family Calendar</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-300">Keep track of shared birthdays, anniversaries, graduations, and family milestones.</p>
          <ul className="mt-5 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
            {spotlight.map((feature) => <li key={feature.text}><span aria-hidden="true" className="mr-2 text-[color:var(--nsg-accent)]">{feature.planned ? "◷" : "✓"}</span>{feature.text}{feature.planned && <span className="text-slate-400"> (Coming Soon)</span>}</li>)}
          </ul>
          <Link href="/family-calendar" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] underline underline-offset-4">Explore Family Calendar™</Link>
        </section>
      </div>
    </main>
  );
}
