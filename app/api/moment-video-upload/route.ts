import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { MAX_MOMENT_VIDEO_BYTES } from "@/lib/moment-video";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to upload a video.", { status: 401 });
  let body: HandleUploadBody;
  try {
    body = await request.json() as HandleUploadBody;
  } catch {
    return new Response("Invalid upload request.", { status: 400 });
  }
  if (body?.type !== "blob.generate-client-token") {
    return new Response("Invalid upload request.", { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const sql = getSql();
        const [video] = await sql`
          SELECT content_type AS "contentType"
          FROM moment_videos
          WHERE pathname = ${pathname} AND user_id = ${user.id}
            AND state = 'pending' AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        ` as { contentType: string }[];
        if (!video) throw new Error("This video upload is not available.");
        return {
          allowedContentTypes: [video.contentType],
          maximumSizeInBytes: MAX_MOMENT_VIDEO_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("[moment-video-upload] Could not authorize upload.", error);
    return new Response("The video upload could not be authorized.", { status: 400 });
  }
}
