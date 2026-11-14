"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

const maxEncodedPhotoLength = 900_000;
const webpDataUrlPattern = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/;

export type ProfilePhotoResult = {
  error?: string;
  success?: string;
};

export async function saveProfilePhoto(
  formData: FormData,
): Promise<ProfilePhotoResult> {
  const user = await requireUser();
  const value = formData.get("photoData");

  if (typeof value !== "string" || value.length > maxEncodedPhotoLength) {
    return { error: "Choose an image smaller than 640 KB after optimization." };
  }

  const match = webpDataUrlPattern.exec(value);
  if (!match) {
    return { error: "Choose a JPG, PNG, or WEBP image." };
  }

  const image = Buffer.from(match[1], "base64");
  if (
    image.length === 0 ||
    image.length > 640 * 1024 ||
    image.toString("ascii", 0, 4) !== "RIFF" ||
    image.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return { error: "The selected image could not be saved. Please try another." };
  }

  const sql = getSql();
  await sql`
    UPDATE users
    SET profile_photo_data = ${value},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${user.id}
  `;
  revalidatePath("/my-profile");

  return { success: "Your profile photo has been saved." };
}
