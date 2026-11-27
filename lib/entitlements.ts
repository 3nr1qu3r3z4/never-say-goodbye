import "server-only";

import { getSql } from "@/lib/db";
import { siteThemes, type SiteTheme } from "@/lib/site-themes";
import type { MembershipPlan } from "@/lib/membership-plans";

export type PlanId = MembershipPlan["id"];
export type BetaAccess = "grandfathered" | "not-grandfathered" | "unreviewed";
export type Feature =
  | "profile"
  | "photos"
  | "videos"
  | "stories"
  | "audioMoments"
  | "legacyTree"
  | "connectedLives"
  | "familyCalendar"
  | "pdfExport"
  | "familySharing"
  | "futureMomentMakers"
  | "cannotOpenUntil"
  | "familyReminders"
  | "scheduledDelivery"
  | "successorAssignment";

type VideoLimit =
  | { kind: "audience"; public: number; nonPublic: number }
  | { kind: "total"; total: number };

type PlanPolicy = {
  themes: readonly SiteTheme[];
  videos: VideoLimit;
  photos: number;
  stories: number;
  audioMoments: number;
  futureMomentMakers: number | null;
  cannotOpenUntil: number;
  familyReminders: boolean;
  scheduledDelivery: boolean;
  successorAssignment: boolean;
};

const plusThemes: readonly SiteTheme[] = ["classic", "evergreen", "ocean"];
const familyThemes: readonly SiteTheme[] = ["classic", "evergreen", "ocean", "sunset", "lavender", "cottage"];

const policies: Record<PlanId, PlanPolicy> = {
  free: {
    themes: ["classic"], videos: { kind: "audience", public: 3, nonPublic: 2 },
    photos: 25, stories: 10, audioMoments: 5, futureMomentMakers: 3,
    cannotOpenUntil: 2, familyReminders: false, scheduledDelivery: false, successorAssignment: false,
  },
  "legacy-plus": {
    themes: plusThemes, videos: { kind: "total", total: 50 },
    photos: 500, stories: 500, audioMoments: 50, futureMomentMakers: 10,
    cannotOpenUntil: 25, familyReminders: true, scheduledDelivery: true, successorAssignment: false,
  },
  "family-legacy": {
    themes: familyThemes, videos: { kind: "total", total: 250 },
    photos: 2500, stories: 2500, audioMoments: 250, futureMomentMakers: 25,
    cannotOpenUntil: 25, familyReminders: true, scheduledDelivery: true, successorAssignment: false,
  },
  "legacy-forever": {
    themes: familyThemes, videos: { kind: "total", total: 1000 },
    photos: 10000, stories: 10000, audioMoments: 1000, futureMomentMakers: null,
    cannotOpenUntil: 25, familyReminders: true, scheduledDelivery: true, successorAssignment: true,
  },
};

export type Entitlements = {
  plan: PlanId | null;
  legacyMembership: "tier-2" | "tier-3" | null;
  betaAccess: BetaAccess;
  enforcementEnabled: false;
  currentThemes: readonly SiteTheme[];
  planThemes: readonly SiteTheme[] | null;
  futureThemes: readonly SiteTheme[] | null;
  limits: PlanPolicy | null;
};

function validateBetaAccess(betaAccess: BetaAccess) {
  if (!["grandfathered", "not-grandfathered", "unreviewed"].includes(betaAccess)) {
    throw new Error(`Unknown beta access status: ${betaAccess}`);
  }
}

export function resolveEntitlements(plan: PlanId, betaAccess: BetaAccess): Entitlements {
  const policy = policies[plan];
  if (!policy) throw new Error(`Unknown membership plan: ${plan}`);
  validateBetaAccess(betaAccess);
  return {
    plan,
    legacyMembership: null,
    betaAccess,
    enforcementEnabled: false,
    currentThemes: siteThemes.map((theme) => theme.id),
    planThemes: policy.themes,
    futureThemes: betaAccess === "unreviewed" ? null
      : betaAccess === "grandfathered" ? familyThemes : policy.themes,
    limits: policy,
  };
}

function resolveLegacyEntitlements(
  membership: "tier-2" | "tier-3", betaAccess: BetaAccess,
): Entitlements {
  validateBetaAccess(betaAccess);
  return {
    plan: null,
    legacyMembership: membership,
    betaAccess,
    enforcementEnabled: false,
    currentThemes: siteThemes.map((theme) => theme.id),
    planThemes: null,
    futureThemes: betaAccess === "grandfathered" ? familyThemes : null,
    limits: null,
  };
}

export function getFeatureAccess(entitlements: Entitlements, feature: Feature) {
  switch (feature) {
    case "familyReminders":
    case "scheduledDelivery":
      return { eligible: entitlements.limits?.[feature] ?? null, available: false };
    case "successorAssignment":
      return { eligible: entitlements.limits?.successorAssignment ?? null, available: true };
    case "cannotOpenUntil":
      return { eligible: true, available: false };
    case "profile":
    case "photos":
    case "videos":
    case "stories":
    case "audioMoments":
    case "legacyTree":
    case "connectedLives":
    case "familyCalendar":
    case "pdfExport":
    case "familySharing":
    case "futureMomentMakers":
      return { eligible: true, available: true };
    default: {
      const unknown: never = feature;
      throw new Error(`Unknown feature: ${unknown}`);
    }
  }
}

export function getThemeAccess(entitlements: Entitlements, theme: SiteTheme) {
  if (!siteThemes.some((candidate) => candidate.id === theme)) {
    throw new Error(`Unknown site theme: ${theme}`);
  }
  return {
    availableNow: entitlements.currentThemes.includes(theme),
    eligibleByPlan: entitlements.planThemes === null ? null : entitlements.planThemes.includes(theme),
    eligibleAfterBeta: entitlements.futureThemes === null
      ? null : entitlements.futureThemes.includes(theme),
  };
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const sql = getSql();
  const [row] = await sql`
    SELECT u.membership, r.status AS "betaAccess"
    FROM users u LEFT JOIN beta_access_reviews r ON r.user_id = u.id
    WHERE u.id = ${userId}
  ` as { membership: string; betaAccess: BetaAccess | null }[];
  if (!row) throw new Error("Cannot resolve entitlements for an unknown account.");
  const betaAccess = row.betaAccess ?? "unreviewed";
  if (row.membership === "free") return resolveEntitlements("free", betaAccess);
  if (row.membership === "legacy-plus" || row.membership === "family-legacy" || row.membership === "legacy-forever") {
    return resolveEntitlements(row.membership, betaAccess);
  }
  if (row.membership === "tier-2" || row.membership === "tier-3") {
    return resolveLegacyEntitlements(row.membership, betaAccess);
  }
  throw new Error(`Unknown stored membership: ${row.membership}`);
}

export type UsageCounts = {
  photos: number;
  stories: number;
  audioMoments: number;
  futureMomentMakers: number;
  cannotOpenUntil: number;
  publicVideos: number;
  nonPublicVideos: number;
};

export async function getUsageCounts(userId: string): Promise<UsageCounts> {
  const sql = getSql();
  const [row] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM moments m
       WHERE m.user_id = u.id AND m.archived_at IS NULL
         AND COALESCE(m.details_json::jsonb ->> 'photoData', '') <> '') AS photos,
      (SELECT COUNT(*)::int FROM moments m
       WHERE m.user_id = u.id AND m.archived_at IS NULL AND m.story !~ '^[[:space:]]*$') AS stories,
      (SELECT COUNT(*)::int FROM moment_audio a JOIN moments m ON m.id = a.moment_id
       WHERE m.user_id = u.id AND m.archived_at IS NULL AND a.state = 'attached') AS "audioMoments",
      (SELECT COUNT(*)::int FROM future_moment_makers f
       WHERE f.owner_user_id = u.id AND f.status <> 'archived' AND f.archived_at IS NULL) AS "futureMomentMakers",
      (SELECT COUNT(*)::int FROM moments m
       WHERE m.user_id = u.id AND m.archived_at IS NULL AND m.kind = 'cannot-open-until') AS "cannotOpenUntil",
      (SELECT COUNT(*)::int FROM moment_videos v JOIN moments m ON m.id = v.moment_id
       WHERE m.user_id = u.id AND m.archived_at IS NULL AND v.state = 'attached' AND m.audience = 'public') AS "publicVideos",
      (SELECT COUNT(*)::int FROM moment_videos v JOIN moments m ON m.id = v.moment_id
       WHERE m.user_id = u.id AND m.archived_at IS NULL AND v.state = 'attached' AND m.audience <> 'public') AS "nonPublicVideos"
    FROM users u WHERE u.id = ${userId}
  ` as UsageCounts[];
  if (!row) throw new Error("Cannot calculate usage for an unknown account.");
  return row;
}

export type QuotaStatus = {
  current: number;
  planLimit: number | null | "unreviewed";
  planRemaining: number | null | "unreviewed";
  effectiveLimit: number | null | "unreviewed";
  effectiveRemaining: number | null | "unreviewed";
  wouldExceedOnAdd: boolean | null;
};

function quotaStatus(
  current: number, planLimit: number | null | "unreviewed", betaAccess: BetaAccess,
): QuotaStatus {
  const planRemaining = planLimit === "unreviewed" ? "unreviewed"
    : planLimit === null ? null : Math.max(0, planLimit - current);
  const effectiveLimit = betaAccess === "grandfathered" ? null
    : betaAccess === "unreviewed" ? "unreviewed" : planLimit;
  const effectiveRemaining = effectiveLimit === "unreviewed" ? "unreviewed"
    : effectiveLimit === null ? null : Math.max(0, effectiveLimit - current);
  return {
    current, planLimit, planRemaining, effectiveLimit, effectiveRemaining,
    wouldExceedOnAdd: effectiveLimit === "unreviewed" ? null
      : effectiveLimit === null ? false : current + 1 > effectiveLimit,
  };
}

export function createUsageReport(entitlements: Entitlements, usage: UsageCounts) {
  const { limits, betaAccess } = entitlements;
  const videoLimit = limits?.videos;
  return {
    plan: entitlements.plan,
    legacyMembership: entitlements.legacyMembership,
    betaAccess,
    enforcementEnabled: false as const,
    photos: quotaStatus(usage.photos, limits?.photos ?? "unreviewed", betaAccess),
    stories: quotaStatus(usage.stories, limits?.stories ?? "unreviewed", betaAccess),
    audioMoments: quotaStatus(usage.audioMoments, limits?.audioMoments ?? "unreviewed", betaAccess),
    futureMomentMakers: quotaStatus(usage.futureMomentMakers, limits ? limits.futureMomentMakers : "unreviewed", betaAccess),
    cannotOpenUntil: quotaStatus(usage.cannotOpenUntil, limits?.cannotOpenUntil ?? "unreviewed", betaAccess),
    videos: !videoLimit
      ? {
          kind: "unreviewed" as const,
          public: usage.publicVideos,
          nonPublic: usage.nonPublicVideos,
          total: usage.publicVideos + usage.nonPublicVideos,
        }
      : videoLimit.kind === "audience"
      ? {
          kind: "audience" as const,
          public: quotaStatus(usage.publicVideos, videoLimit.public, betaAccess),
          nonPublic: quotaStatus(usage.nonPublicVideos, videoLimit.nonPublic, betaAccess),
        }
      : {
          kind: "total" as const,
          total: quotaStatus(usage.publicVideos + usage.nonPublicVideos, videoLimit.total, betaAccess),
        },
  };
}

export async function getUsageReport(userId: string) {
  const entitlements = await getEntitlements(userId);
  const usage = await getUsageCounts(userId);
  return createUsageReport(entitlements, usage);
}

export async function getFutureMomentMakerQuotaStatus(userId: string) {
  const report = await getUsageReport(userId);
  return { ...report.futureMomentMakers, enforcementEnabled: report.enforcementEnabled };
}
