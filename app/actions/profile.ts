"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { validatePhoto } from "@/lib/profile-photo";

export type ProfileSaveResult = {
  error?: string;
  success?: string;
};

function validateProfileDetails(
  displayName: string,
  descriptors: string[],
  location: string,
  personalMotto: string,
): string | undefined {
  if (displayName.length < 1 || displayName.length > 120) {
    return "Display Name must be between 1 and 120 characters.";
  }
  if (descriptors.some((descriptor) => descriptor.length > 40)) {
    return "Each describing word must be 40 characters or fewer.";
  }
  if (location.length > 120 || personalMotto.length > 120) {
    return "One or more profile fields exceed the allowed length.";
  }
}

export async function saveProfilePhoto(
  value: string,
): Promise<ProfileSaveResult> {
  console.info("[profile-photo] server save received");
  const user = await requireUser();
  const photoData = validatePhoto(value);
  if (typeof photoData !== "string") {
    console.warn("[profile-photo] server validation rejected photo");
    return photoData;
  }

  const sql = getSql();
  console.info("[profile-photo] database save started");
  await sql`
    UPDATE users
    SET profile_photo_data = ${photoData},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${user.id}
  `;
  console.info("[profile-photo] database save completed");
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
  const validationError = validateProfileDetails(
    displayName, [descriptorOne, descriptorTwo, descriptorThree], location, personalMotto,
  );
  if (validationError) return { error: validationError };
  if (bio.length > 1000) {
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
  revalidatePath("/my-profile/setup");

  return { success: "Your profile has been saved." };
}

export async function saveProfileSetup(formData: FormData): Promise<ProfileSaveResult> {
  const user = await requireUser();
  const fields = [
    "displayName", "descriptorOne", "descriptorTwo", "descriptorThree",
    "birthplace", "location", "personalMotto", "discoverability",
  ] as const;
  const values = fields.map((field) => formData.get(field));
  if (!values.every((value): value is string => typeof value === "string")) {
    return { error: "Complete the profile setup fields and try again." };
  }

  const [
    displayName, descriptorOne, descriptorTwo, descriptorThree,
    birthplace, location, personalMotto, discoverability,
  ] = values.map((value) => value.trim());
  const validationError = validateProfileDetails(
    displayName, [descriptorOne, descriptorTwo, descriptorThree], location, personalMotto,
  );
  if (validationError) return { error: validationError };
  if (birthplace.length > 120) {
    return { error: "Birthplace must be 120 characters or fewer." };
  }
  if (!["private", "searchable", "public"].includes(discoverability)) {
    return { error: "Choose a valid profile visibility option." };
  }

  const sql = getSql();
  const [updated] = await sql`
    UPDATE users
    SET display_name = ${displayName},
        descriptor_one = ${descriptorOne},
        descriptor_two = ${descriptorTwo},
        descriptor_three = ${descriptorThree},
        birthplace = ${birthplace || null},
        location = ${location || null},
        personal_motto = ${personalMotto || null},
        discoverability = ${discoverability},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${user.id}
    RETURNING id
  `;
  if (!updated) return { error: "Your profile could not be found. Please sign in again." };
  revalidatePath("/my-profile");
  revalidatePath("/my-profile/setup");
  revalidatePath("/my-profile/preview");
  revalidatePath("/legacy-controls");
  revalidatePath("/search");
  return { success: "Your profile setup has been saved." };
}
