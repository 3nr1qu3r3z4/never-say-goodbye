import { connection } from "next/server";
import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[site-analytics-retention] CRON_SECRET is not configured.");
    return new Response("Retention is not configured.", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sql = getSql();
  await sql.transaction([
    sql`DELETE FROM site_analytics_visitor_days
        WHERE visit_date < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 89`,
    sql`DELETE FROM site_analytics_visitors
        WHERE last_seen_at < CURRENT_TIMESTAMP - INTERVAL '90 days'`,
    sql`UPDATE site_analytics_visitors SET signup_at = NULL
        WHERE signup_at < CURRENT_TIMESTAMP - INTERVAL '90 days'`,
  ]);
  return new Response(null, { status: 204 });
}
