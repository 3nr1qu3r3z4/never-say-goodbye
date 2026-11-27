import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createUsageReport, getEntitlements, getUsageCounts } from "@/lib/entitlements";
import { membershipPlans } from "@/lib/membership-plans";
import { siteThemes } from "@/lib/site-themes";
import MembershipUsage from "./usage-summary";

export const metadata: Metadata = {
  title: "Membership & Usage | Never Say Goodbye",
  description: "See your membership and content usage.",
};
export const instant = false;

export default async function MembershipPage() {
  const user = await requireUser();
  const [entitlements, usage] = await Promise.all([
    getEntitlements(user.id),
    getUsageCounts(user.id),
  ]);
  const plan = entitlements.plan === null
    ? null : membershipPlans.find((candidate) => candidate.id === entitlements.plan);
  if (entitlements.plan !== null && !plan) {
    throw new Error("The current membership plan is not available.");
  }
  const themes = siteThemes
    .filter((theme) => entitlements.currentThemes.includes(theme.id))
    .map((theme) => theme.name);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]" />
      <div className="relative mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/my-profile" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--nsg-accent-light)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">
          My Profile
        </Link>
        <MembershipUsage
          report={createUsageReport(entitlements, usage)}
          planName={plan?.name ?? "Legacy membership"}
          themes={themes}
        />
        <Link href="/my-profile/membership/content" className="mt-6 inline-block rounded-full border border-[color:var(--nsg-accent)]/50 px-5 py-3 text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:bg-white/5">
          Manage Content
        </Link>
      </div>
    </main>
  );
}
