"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { validCalendarDate } from "@/lib/family-calendar";
import { validatePhoto } from "@/lib/profile-photo";

export type HonoredLifeState = { error?: string; success?: string; treeId?: string };

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createHonoredLife(
  _state: HonoredLifeState,
  form: FormData,
): Promise<HonoredLifeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to honor a life." };

  const treeId = field(form, "treeId");
  const placeholderId = field(form, "placeholderId");
  const name = field(form, "name");
  const relationship = field(form, "relationship");
  const birthDate = field(form, "birthDate");
  const passingDate = field(form, "passingDate");
  const story = field(form, "story");
  const photo = field(form, "photoData");

  if (!treeId || !name || name.length > 120 || !relationship || relationship.length > 80 || story.length > 1000) {
    return { error: "Choose a tree and enter a name, relationship, and story of at most 1,000 characters." };
  }
  if (
    (birthDate && (!validCalendarDate(birthDate) || Number(birthDate.slice(0, 4)) < 1000)) ||
    (passingDate && (!validCalendarDate(passingDate) || Number(passingDate.slice(0, 4)) < 1000)) ||
    (birthDate && passingDate && birthDate > passingDate)
  ) {
    return { error: "Enter valid dates, with the passing date on or after the birth date." };
  }
  if (photo) {
    const validated = validatePhoto(photo);
    if (typeof validated !== "string") return validated;
  }

  const sql = getSql();
  const now = new Date().toISOString();
  const birthYear = birthDate ? Number(birthDate.slice(0, 4)) : null;
  const passingYear = passingDate ? Number(passingDate.slice(0, 4)) : null;
  let rows;
  try {
    rows = placeholderId
      ? await sql`
          WITH updated AS (
            UPDATE family_placeholders fp
            SET name = ${name}, relationship = ${relationship},
                birth_date = ${birthDate || null}::date,
                birth_year = COALESCE(fp.birth_year, ${birthYear}),
                death_year = COALESCE(fp.death_year, ${passingYear}),
                updated_at = ${now}
            WHERE fp.id = ${placeholderId} AND fp.legacy_tree_id = ${treeId}
              AND EXISTS (SELECT 1 FROM legacy_tree_members member
                WHERE member.tree_id = fp.legacy_tree_id
                  AND member.user_id = ${user.id} AND member.role IN ('owner', 'admin'))
              AND (${birthYear}::int IS NULL OR fp.birth_year IS NULL OR fp.birth_year = ${birthYear})
              AND (${passingYear}::int IS NULL OR fp.death_year IS NULL OR fp.death_year = ${passingYear})
              AND (${birthYear}::int IS NULL OR fp.death_year IS NULL OR ${birthYear} <= fp.death_year)
              AND (${passingYear}::int IS NULL OR fp.birth_year IS NULL OR ${passingYear} >= fp.birth_year)
              AND (${birthDate || null}::date IS NULL OR fp.memorial_date IS NULL OR ${birthDate || null}::date <= fp.memorial_date)
              AND (${passingYear}::int IS NULL OR fp.memorial_date IS NULL OR EXTRACT(YEAR FROM fp.memorial_date) = ${passingYear})
            RETURNING fp.id
          )
          INSERT INTO honored_lives (family_placeholder_id, passing_date, short_story, profile_photo_data)
          SELECT id, ${passingDate || null}::date, ${story}, ${photo || null} FROM updated
          RETURNING family_placeholder_id
        `
      : await sql`
          WITH created AS (
            INSERT INTO family_placeholders (
              id, legacy_tree_id, created_by_user_id, name, relationship,
              birth_year, death_year, birth_date, created_at, updated_at
            )
            SELECT ${randomUUID()}, ${treeId}, ${user.id}, ${name}, ${relationship},
                   ${birthYear}, ${passingYear}, ${birthDate || null}::date, ${now}, ${now}
            WHERE EXISTS (SELECT 1 FROM legacy_tree_members member
              WHERE member.tree_id = ${treeId}
                AND member.user_id = ${user.id} AND member.role IN ('owner', 'admin'))
            RETURNING id
          )
          INSERT INTO honored_lives (family_placeholder_id, passing_date, short_story, profile_photo_data)
          SELECT id, ${passingDate || null}::date, ${story}, ${photo || null} FROM created
          RETURNING family_placeholder_id
        `;
  } catch (error) {
    if (placeholderId && error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: "This Family Placeholder already has an Honored Life." };
    }
    throw error;
  }
  if (!rows.length) {
    return { error: "Unable to save. Check your tree administrator access and that dates match existing placeholder years and memorial date." };
  }
  revalidatePath("/legacy-tree");
  revalidatePath("/honored-lives");
  revalidatePath("/family-calendar");
  revalidatePath("/dashboard");
  return { success: "Honored Life added to your Legacy Tree™.", treeId };
}
