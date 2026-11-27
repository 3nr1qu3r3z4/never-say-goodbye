import { connection } from "next/server";
import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[successor-transfer] CRON_SECRET is not configured.");
    return new Response("Transfer processing is not configured.", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sql = getSql();
  const assignments = await sql`
    SELECT a.owner_user_id AS owner, a.successor_user_id AS successor
    FROM successor_assignments a JOIN users u ON u.id = a.owner_user_id
    WHERE u.last_activity_at + make_interval(days => a.inactivity_days) <= clock_timestamp()
    ORDER BY u.last_activity_at, a.owner_user_id
  ` as { owner: string; successor: string | null }[];
  let failed = false;
  for (const assignment of assignments) {
    try {
      const [row] = await sql`
        SELECT successor_transfer(${assignment.owner}, ${assignment.successor}, true) AS result
      ` as { result: string }[];
      if (row.result !== "transferred" && row.result !== "not_due") {
        console.error("[successor-transfer] Assignment could not be transferred.", {
          owner: assignment.owner, result: row.result,
        });
        failed = true;
      }
    } catch (error) {
      console.error("[successor-transfer] Transfer processing failed.", error);
      failed = true;
    }
  }
  return failed
    ? new Response("Some transfers could not be processed; they will be retried.", { status: 500 })
    : new Response(null, { status: 204 });
}
