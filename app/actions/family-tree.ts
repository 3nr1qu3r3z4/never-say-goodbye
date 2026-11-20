"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export type AddFamilyMemberState = {
  error?: string;
  success?: string;
};

const memberTypes = ["existing", "future", "placeholder"] as const;

export async function createLegacyTree(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sql = getSql();
  const treeId = randomUUID();
  const now = new Date().toISOString();
  const treeName = user.displayName ? `${user.displayName}'s Legacy Tree™` : "My Legacy Tree™";
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext('legacy-tree-create'), hashtext(${user.id}))`,
    sql`
      INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
      SELECT ${treeId}, ${user.id}, ${treeName}, ${now}, ${now}
      WHERE NOT EXISTS (SELECT 1 FROM legacy_tree_members WHERE user_id = ${user.id})
        AND NOT EXISTS (SELECT 1 FROM legacy_trees WHERE owner_user_id = ${user.id})
    `,
    sql`
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      SELECT tree.id, ${user.id}, 'owner', ${now}
      FROM legacy_trees AS tree
      WHERE tree.owner_user_id = ${user.id}
        AND NOT EXISTS (SELECT 1 FROM legacy_tree_members WHERE user_id = ${user.id})
      ORDER BY tree.created_at, tree.id
      LIMIT 1
      ON CONFLICT (tree_id, user_id) DO NOTHING
    `,
  ]);
  revalidatePath("/legacy-tree");
  revalidatePath("/family-calendar");
  revalidatePath("/create-moment");
}

export async function addFamilyMember(
  _previousState: AddFamilyMemberState,
  formData: FormData,
): Promise<AddFamilyMemberState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to add a family member." };

  const treeId = formData.get("treeId");
  const memberType = formData.get("memberType");
  const relationship = formData.get("relationship");
  if (
    typeof treeId !== "string" ||
    typeof memberType !== "string" ||
    !memberTypes.includes(memberType as (typeof memberTypes)[number]) ||
    typeof relationship !== "string"
  ) {
    return { error: "Choose a tree, member type, and relationship." };
  }

  const normalizedRelationship = relationship.trim();
  if (!normalizedRelationship || normalizedRelationship.length > 80) {
    return { error: "Enter a relationship of 1 to 80 characters." };
  }

  const sql = getSql();
  const [tree] = (await sql`
    SELECT lt.id
    FROM legacy_trees AS lt
    JOIN legacy_tree_members AS ltm ON ltm.tree_id = lt.id
    WHERE lt.id = ${treeId} AND ltm.user_id = ${user.id}
    LIMIT 1
  `) as { id: string }[];
  if (!tree) return { error: "You can only add members to a tree you belong to." };

  const now = new Date().toISOString();
  if (memberType === "existing") {
    const existingUserId = formData.get("existingUserId");
    if (typeof existingUserId !== "string" || !existingUserId) {
      return { error: "Choose an existing Moment Maker™." };
    }

    const [target] = (await sql`
      SELECT id
      FROM users
      WHERE id = ${existingUserId}
        AND id <> ${user.id}
        AND discoverability IN ('searchable', 'public')
      LIMIT 1
    `) as { id: string }[];
    if (!target) {
      return { error: "That Moment Maker™ is unavailable to add." };
    }

    await sql`
      INSERT INTO legacy_tree_members (tree_id, user_id, role, relationship, joined_at)
      VALUES (${tree.id}, ${target.id}, 'member', ${normalizedRelationship}, ${now})
      ON CONFLICT (tree_id, user_id) DO NOTHING
    `;
    revalidatePath("/legacy-tree");
    return { success: "Moment Maker™ added to your Legacy Tree™." };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
    return { error: "Enter a name of 1 to 120 characters." };
  }

  if (memberType === "future") {
    await sql`
      INSERT INTO future_moment_makers (
        id, owner_user_id, legacy_tree_id, name, relationship, created_at, updated_at
      ) VALUES (
        ${randomUUID()}, ${user.id}, ${tree.id}, ${name.trim()},
        ${normalizedRelationship}, ${now}, ${now}
      )
    `;
    revalidatePath("/legacy-tree");
    return { success: "Future Moment Maker™ added to your Legacy Tree™." };
  }

  const birthYearValue = formData.get("birthYear");
  const deathYearValue = formData.get("deathYear");
  const notesValue = formData.get("notes");
  const birthYear = parseOptionalYear(birthYearValue);
  const deathYear = parseOptionalYear(deathYearValue);
  if (birthYear === undefined || deathYear === undefined) {
    return { error: "Enter a valid four-digit birth or death year." };
  }
  if (birthYear !== null && deathYear !== null && deathYear < birthYear) {
    return { error: "Death year cannot be earlier than birth year." };
  }
  if (
    notesValue !== null &&
    (typeof notesValue !== "string" || notesValue.trim().length > 1000)
  ) {
    return { error: "Notes must be 1,000 characters or fewer." };
  }

  await sql`
    INSERT INTO family_placeholders (
      id, legacy_tree_id, created_by_user_id, name, relationship,
      birth_year, death_year, notes, created_at, updated_at
    ) VALUES (
      ${randomUUID()}, ${tree.id}, ${user.id}, ${name.trim()},
      ${normalizedRelationship}, ${birthYear}, ${deathYear},
      ${notesValue?.trim() || null}, ${now}, ${now}
    )
  `;
  revalidatePath("/legacy-tree");
  revalidatePath("/create-moment");
  return { success: "Family Placeholder added to your Legacy Tree™." };
}

function parseOptionalYear(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}$/.test(value)) return undefined;
  const year = Number(value);
  return year >= 1000 && year <= 9999 ? year : undefined;
}
