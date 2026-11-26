"use server";

import { randomUUID } from "node:crypto";
import { BlobNotFoundError, head } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { getMomentAudioFormat, MAX_MOMENT_AUDIO_BYTES } from "@/lib/moment-audio";

export async function beginMomentAudioUpload(filename: string, size: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to upload audio." };
  if (typeof filename !== "string" || filename.length > 255 || !filename.trim()) {
    return { error: "Choose audio with a valid file name." };
  }
  const format = getMomentAudioFormat(filename);
  if (!format) return { error: "Choose an MP3, M4A, or WAV audio file." };
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_MOMENT_AUDIO_BYTES) {
    return { error: "Choose audio up to 100 MiB." };
  }

  const id = randomUUID();
  const pathname = `moment-audio/${id}.${format.extension}`;
  const sql = getSql();
  await sql`
    INSERT INTO moment_audio (id, user_id, pathname, filename, content_type, size_bytes, state)
    VALUES (${id}, ${user.id}, ${pathname}, ${filename}, ${format.contentType}, ${size}, 'pending')
  `;
  return { id, pathname, contentType: format.contentType };
}

export async function completeMomentAudioUpload(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to finish uploading audio." };
  if (typeof id !== "string" || !id) return { error: "This audio upload is not available." };
  const sql = getSql();
  const [audio] = await sql`
    SELECT pathname, content_type AS "contentType", size_bytes AS "sizeBytes"
    FROM moment_audio
    WHERE id = ${id} AND user_id = ${user.id} AND state = 'pending'
  ` as { pathname: string; contentType: string; sizeBytes: number | string }[];
  if (!audio) return { error: "This audio upload is not available." };

  let blob;
  try {
    blob = await head(audio.pathname);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { error: "The audio upload did not finish. Please try again." };
    throw error;
  }
  if (blob.pathname !== audio.pathname || blob.contentType !== audio.contentType || blob.size !== Number(audio.sizeBytes)) {
    return { error: "The uploaded audio did not match the selected file. Please try again." };
  }
  const updated = await sql`
    UPDATE moment_audio SET state = 'ready'
    WHERE id = ${id} AND user_id = ${user.id} AND state = 'pending'
    RETURNING id
  `;
  if (!updated.length) return { error: "This audio upload is no longer available." };
  return { success: true };
}
