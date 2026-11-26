import { del } from "@vercel/blob";
import { connection } from "next/server";
import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[moment-audio-retention] CRON_SECRET is not configured.");
    return new Response("Retention is not configured.", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sql = getSql();
  const uploads = await sql`
    UPDATE moment_audio AS ma SET state = 'deleting'
    WHERE ma.state = 'deleting'
      OR (ma.state = 'attached' AND ma.moment_id IS NULL)
      OR (ma.state IN ('pending', 'ready')
          AND ma.last_used_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM drafts AS d
            WHERE d.user_id = ma.user_id AND d.payload_json::jsonb ->> 'audioUploadId' = ma.id
          ))
    RETURNING id, pathname
  ` as { id: string; pathname: string }[];

  let failed = false;
  for (const audio of uploads) {
    try {
      await del(audio.pathname);
      await sql`DELETE FROM moment_audio WHERE id = ${audio.id} AND state = 'deleting'`;
    } catch (error) {
      console.error("[moment-audio-retention] Could not remove audio.", error);
      failed = true;
    }
  }
  if (failed) return new Response("Audio cleanup failed; it will be retried.", { status: 500 });
  return new Response(null, { status: 204 });
}
