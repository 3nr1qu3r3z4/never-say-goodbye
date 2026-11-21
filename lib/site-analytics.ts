import "server-only";

import { cookies } from "next/headers";
import { getSql } from "@/lib/db";

export const visitorCookieName = "nsg_beta_visitor";
export const visitCookieName = "nsg_beta_visit";
const identifierPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validVisitorId(value: string | undefined): value is string {
  return typeof value === "string" && identifierPattern.test(value);
}

export function siteAnalyticsEnabled() {
  if (process.env.SITE_ANALYTICS_ENABLED !== "true") return false;
  if (!process.env.CRON_SECRET) {
    throw new Error("SITE_ANALYTICS_ENABLED requires CRON_SECRET for retention.");
  }
  return true;
}

export async function attributeSignup() {
  try {
    if (!siteAnalyticsEnabled()) return;
    const visitorId = (await cookies()).get(visitorCookieName)?.value;
    if (!validVisitorId(visitorId)) return;
    const sql = getSql();
    await sql`
      UPDATE site_analytics_visitors
      SET signup_at = CASE
        WHEN signup_at IS NULL OR signup_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
        THEN CURRENT_TIMESTAMP ELSE signup_at END
      WHERE visitor_id = ${visitorId}
        AND last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
    `;
  } catch {
    console.error("[site-analytics] Signup attribution failed.");
  }
}
