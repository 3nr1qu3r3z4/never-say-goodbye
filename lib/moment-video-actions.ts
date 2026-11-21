"use server";

import { randomUUID } from "node:crypto";
import { BlobNotFoundError, head } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { getMomentVideoFormat, MAX_MOMENT_VIDEO_BYTES } from "@/lib/moment-video";

export async function beginMomentVideoUpload(filename: string, size: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to upload a video." };
  if (typeof filename !== "string" || filename.length > 255 || !filename.trim()) {
    return { error: "Choose a video with a valid file name." };
  }
  const format = getMomentVideoFormat(filename);
  if (!format) return { error: "Choose an MP4, MOV, or M4V video." };
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_MOMENT_VIDEO_BYTES) {
    return { error: "Choose a video up to 100 MiB." };
  }

  const id = randomUUID();
  const pathname = `moment-videos/${id}.${format.extension}`;
  const sql = getSql();
  await sql`
    INSERT INTO moment_videos (id, user_id, pathname, filename, content_type, size_bytes, state)
    VALUES (${id}, ${user.id}, ${pathname}, ${filename}, ${format.contentType}, ${size}, 'pending')
  `;
  return { id, pathname, contentType: format.contentType };
}

export async function completeMomentVideoUpload(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to finish uploading a video." };
  if (typeof id !== "string" || !id) return { error: "This video upload is not available." };
  const sql = getSql();
  const [video] = await sql`
    SELECT pathname, content_type AS "contentType", size_bytes AS "sizeBytes"
    FROM moment_videos
    WHERE id = ${id} AND user_id = ${user.id} AND state = 'pending'
  ` as { pathname: string; contentType: string; sizeBytes: number | string }[];
  if (!video) return { error: "This video upload is not available." };

  let blob;
  try {
    blob = await head(video.pathname);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { error: "The video upload did not finish. Please try again." };
    throw error;
  }
  if (blob.pathname !== video.pathname || blob.contentType !== video.contentType || blob.size !== Number(video.sizeBytes)) {
    return { error: "The uploaded video did not match the selected file. Please try again." };
  }
  const updated = await sql`
    UPDATE moment_videos SET state = 'ready'
    WHERE id = ${id} AND user_id = ${user.id} AND state = 'pending'
    RETURNING id
  `;
  if (!updated.length) return { error: "This video upload is no longer available." };
  return { success: true };
}
