import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { getAccessibleMoment } from "@/lib/moment-access";
import { streamMomentMedia } from "@/lib/moment-media-stream";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const moment = await getAccessibleMoment(user?.id ?? null, id, false);
  if (!moment?.hasAudio) return new Response("Not found.", { status: 404 });

  const sql = getSql();
  const [audio] = await sql`
    SELECT pathname, content_type AS "contentType", size_bytes AS "sizeBytes"
    FROM moment_audio WHERE moment_id = ${id} AND state = 'attached'
  ` as { pathname: string; contentType: string; sizeBytes: number | string }[];
  if (!audio) return new Response("Not found.", { status: 404 });
  return streamMomentMedia(request, audio, "audio");
}
