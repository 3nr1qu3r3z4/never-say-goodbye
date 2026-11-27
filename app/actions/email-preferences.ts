"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { emailPreferenceOptions } from "@/lib/email-preferences";

export async function saveEmailPreferences(formData: FormData): Promise<void> {
  const user = await requireUser();
  for (const { name } of emailPreferenceOptions) {
    const values = formData.getAll(name);
    if (values.length > 1 || (values.length === 1 && values[0] !== "on")) {
      throw new Error("Invalid email preferences. Please try again.");
    }
  }

  const sql = getSql();
  await sql`
    INSERT INTO email_preferences (
      user_id, new_connection_requests, connection_request_accepted,
      new_photo_shared, new_video_shared, new_audio_message_shared,
      shared_moments
    ) VALUES (
      ${user.id}, ${formData.get("newConnectionRequests") === "on"},
      ${formData.get("connectionRequestAccepted") === "on"},
      ${formData.get("newPhotoShared") === "on"},
      ${formData.get("newVideoShared") === "on"},
      ${formData.get("newAudioMessageShared") === "on"},
      ${formData.get("sharedMoments") === "on"}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      new_connection_requests = EXCLUDED.new_connection_requests,
      connection_request_accepted = EXCLUDED.connection_request_accepted,
      new_photo_shared = EXCLUDED.new_photo_shared,
      new_video_shared = EXCLUDED.new_video_shared,
      new_audio_message_shared = EXCLUDED.new_audio_message_shared,
      shared_moments = EXCLUDED.shared_moments
  `;
  revalidatePath("/email-preferences");
  redirect("/email-preferences?saved=1");
}
