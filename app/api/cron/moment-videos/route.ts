import { del } from "@vercel/blob";
import { connection } from "next/server";
import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[moment-video-retention] CRON_SECRET is not configured.");
    return new Response("Retention is not configured.", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sql = getSql();
  const videos = await sql`
    UPDATE moment_videos AS mv SET state = 'deleting'
    WHERE mv.state = 'deleting'
      OR (mv.state = 'attached' AND mv.moment_id IS NULL)
      OR (mv.state IN ('pending', 'ready')
          AND mv.last_used_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM drafts AS d
            WHERE d.user_id = mv.user_id AND d.payload_json::jsonb ->> 'videoUploadId' = mv.id
          ))
    RETURNING id, pathname
  ` as { id: string; pathname: string }[];

  let failed = false;
  for (const video of videos) {
    try {
      await del(video.pathname);
      await sql`DELETE FROM moment_videos WHERE id = ${video.id} AND state = 'deleting'`;
    } catch (error) {
      console.error("[moment-video-retention] Could not remove video.", error);
      failed = true;
    }
  }
  if (failed) return new Response("Video cleanup failed; it will be retried.", { status: 500 });
  return new Response(null, { status: 204 });
}
