"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

const maxEncodedPhotoLength = 900_000;
const photoDataUrlPattern =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export type ProfileSaveResult = {
  error?: string;
  success?: string;
};

function validatePhoto(value: unknown): string | ProfileSaveResult {
  if (typeof value !== "string" || value.length > maxEncodedPhotoLength) {
    return { error: "Choose an image smaller than 640 KB after optimization." };
  }
  const match = photoDataUrlPattern.exec(value);
  if (!match) {
    return { error: "Choose a JPG, JPEG, PNG, or WEBP image." };
  }

  const [, mimeType, encodedImage] = match;
  const image = Buffer.from(encodedImage, "base64");
  const hasValidSignature =
    (mimeType === "image/jpeg" &&
      image[0] === 0xff &&
      image[1] === 0xd8 &&
      image[2] === 0xff) ||
    (mimeType === "image/png" &&
      image.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )) ||
    (mimeType === "image/webp" &&
      image.toString("ascii", 0, 4) === "RIFF" &&
      image.toString("ascii", 8, 12) === "WEBP");
  if (image.length === 0 || image.length > 640 * 1024 || !hasValidSignature) {
    return { error: "The selected image could not be saved. Please try another." };
  }

  return value;
}

export async function saveProfilePhoto(
  value: string,
): Promise<ProfileSaveResult> {
  const user = await requireUser();
  const photoData = validatePhoto(value);
  if (typeof photoData !== "string") return photoData;

  const sql = getSql();
  await sql`
    UPDATE users
    SET profile_photo_data = ${photoData},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${user.id}
  `;
  revalidatePath("/my-profile");
  revalidatePath("/my-profile/preview");

  return { success: "Your profile photo has been saved." };
}

export async function saveProfile(
  formData: FormData,
): Promise<ProfileSaveResult> {
  const user = await requireUser();
  const displayNameField = formData.get("displayName");
  const descriptorOneField = formData.get("descriptorOne");
  const descriptorTwoField = formData.get("descriptorTwo");
  const descriptorThreeField = formData.get("descriptorThree");
  const bioField = formData.get("bio");
  const locationField = formData.get("location");
  const mottoField = formData.get("personalMotto");
  const photoField = formData.get("photoData");

  if (
    typeof displayNameField !== "string" ||
    typeof descriptorOneField !== "string" ||
    typeof descriptorTwoField !== "string" ||
    typeof descriptorThreeField !== "string" ||
    typeof bioField !== "string" ||
    typeof locationField !== "string" ||
    typeof mottoField !== "string"
  ) {
    return { error: "Complete the profile fields and try again." };
  }

  const displayName = displayNameField.trim();
  const descriptorOne = descriptorOneField.trim();
  const descriptorTwo = descriptorTwoField.trim();
  const descriptorThree = descriptorThreeField.trim();
  const bio = bioField.trim();
  const location = locationField.trim();
  const personalMotto = mottoField.trim();
  if (displayName.length < 1 || displayName.length > 120) {
    return { error: "Display Name must be between 1 and 120 characters." };
  }
  if (
    descriptorOne.length > 40 ||
    descriptorTwo.length > 40 ||
    descriptorThree.length > 40
  ) {
    return { error: "Each describing word must be 40 characters or fewer." };
  }
  if (bio.length > 1000 || location.length > 120 || personalMotto.length > 120) {
    return { error: "One or more profile fields exceed the allowed length." };
  }

  let photoData: string | null = null;
  if (photoField !== null && photoField !== "") {
    const validatedPhoto = validatePhoto(photoField);
    if (typeof validatedPhoto !== "string") return validatedPhoto;
    photoData = validatedPhoto;
  }

  const sql = getSql();
  await sql`
    UPDATE users
    SET display_name = ${displayName},
        bio = ${bio},
        descriptor_one = ${descriptorOne},
        descriptor_two = ${descriptorTwo},
        descriptor_three = ${descriptorThree},
        location = ${location || null},
        personal_motto = ${personalMotto || null},
        profile_photo_data = COALESCE(${photoData}, profile_photo_data),
        updated_at = ${new Date().toISOString()}
    WHERE id = ${user.id}
  `;
  revalidatePath("/my-profile");
  revalidatePath("/my-profile/preview");

  return { success: "Your profile has been saved." };
}
