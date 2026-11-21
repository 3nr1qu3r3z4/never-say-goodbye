import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db";
import { siteAnalyticsEnabled, validVisitorId, visitorCookieName, visitCookieName } from "@/lib/site-analytics";

export async function POST(request: Request) {
  if (request.headers.get("X-NSG-Analytics") !== "1" ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response("Invalid request.", { status: 403 });
  }
  if (!siteAnalyticsEnabled()) return new Response(null, { status: 204 });

  const cookieStore = await cookies();
  const existingVisitor = cookieStore.get(visitorCookieName)?.value;
  const visitorId = validVisitorId(existingVisitor) ? existingVisitor : randomUUID();
  const existingVisit = cookieStore.get(visitCookieName)?.value;
  const newVisit = !validVisitorId(existingVisit) || !validVisitorId(existingVisitor);
  const sql = getSql();
  await sql`
    WITH visitor AS (
      INSERT INTO site_analytics_visitors (visitor_id, last_seen_at)
      VALUES (${visitorId}, CURRENT_TIMESTAMP)
      ON CONFLICT (visitor_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
      RETURNING visitor_id
    ), visitor_day AS (
      INSERT INTO site_analytics_visitor_days (visitor_id, visit_date)
      SELECT visitor_id, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date FROM visitor
      ON CONFLICT DO NOTHING
    )
    INSERT INTO site_analytics_daily (visit_date, visits)
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 1
    WHERE ${newVisit}
    ON CONFLICT (visit_date) DO UPDATE SET visits = site_analytics_daily.visits + 1
  `;

  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  if (!validVisitorId(existingVisitor)) {
    cookieStore.set(visitorCookieName, visitorId, { ...common, maxAge: 90 * 24 * 60 * 60 });
  }
  cookieStore.set(visitCookieName, newVisit ? randomUUID() : existingVisit, {
    ...common,
    maxAge: 30 * 60,
  });
  return new Response(null, { status: 204 });
}
