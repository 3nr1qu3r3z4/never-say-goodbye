import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[profile-visits-retention] CRON_SECRET is not configured.");
    return new Response("Retention is not configured.", { status: 503 });
  }
  if (authorization !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sql = getSql();
  await sql`
    DELETE FROM profile_visits
    WHERE visit_date < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 89
  `;
  return new Response(null, { status: 204 });
}
