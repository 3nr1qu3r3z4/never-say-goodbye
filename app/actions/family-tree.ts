"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export type AddFamilyMemberState = {
  error?: string;
  success?: string;
  treeId?: string;
};

const memberTypes = ["existing", "future", "placeholder"] as const;

export async function searchFamilyMomentMakers(name: string): Promise<{
  results: { id: string; displayName: string }[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { results: [], error: "Sign in to search for a Moment Maker™." };
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return { results: [], error: "Enter a name of 1 to 100 characters." };
  }
  const sql = getSql();
  const results = await sql`
    SELECT id, display_name AS "displayName"
    FROM users
    WHERE id <> ${user.id}
      AND discoverability IN ('searchable', 'public')
      AND strpos(lower(display_name), lower(${name.trim()})) > 0
    ORDER BY display_name, id
    LIMIT 30
  ` as { id: string; displayName: string }[];
  return { results };
}

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

  const relationshipTo = formData.get("relationshipTo") ?? formData.get("linePartner");
  let referenceType: string | null = null;
  let referenceId: string | null = null;
  if (relationshipTo !== null && relationshipTo !== "" && relationshipTo !== "owner") {
    if (typeof relationshipTo !== "string") return { error: "Choose a valid person for Relationship To." };
    const separator = relationshipTo.indexOf(":");
    referenceType = relationshipTo.slice(0, separator);
    referenceId = relationshipTo.slice(separator + 1);
    if (separator < 0 || !["member", "placeholder", "future"].includes(referenceType) || !referenceId) {
      return { error: "Choose a valid person for Relationship To." };
    }
    const [reference] = await sql`
      SELECT id FROM (
        SELECT 'member' AS kind, user_id AS id FROM legacy_tree_members
        WHERE tree_id = ${tree.id} AND user_id <> (SELECT owner_user_id FROM legacy_trees WHERE id = ${tree.id})
        UNION ALL
        SELECT 'placeholder' AS kind, id FROM family_placeholders WHERE legacy_tree_id = ${tree.id}
        UNION ALL
        SELECT 'future' AS kind, id FROM future_moment_makers WHERE legacy_tree_id = ${tree.id} AND status <> 'archived'
      ) AS candidates
      WHERE kind = ${referenceType} AND id = ${referenceId}
    ` as { id: string }[];
    if (!reference) {
      return { error: "That person is not available in the selected tree." };
    }
  } else if (relationshipTo !== null && typeof relationshipTo !== "string") {
    return { error: "Choose a valid person for Relationship To." };
  }

  const now = new Date().toISOString();
  if (memberType === "existing") {
    const existingUserId = formData.get("existingUserId");
    if (typeof existingUserId !== "string" || !existingUserId) {
      return { error: "Choose an existing Moment Maker™." };
    }
    if (referenceType === "member" && referenceId === existingUserId) {
      return { error: "A person cannot be related to themselves." };
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

    const added = await sql`
      INSERT INTO legacy_tree_members (tree_id, user_id, role, relationship, joined_at, line_partner_type, line_partner_id)
      VALUES (${tree.id}, ${target.id}, 'member', ${normalizedRelationship}, ${now}, ${referenceType}, ${referenceId})
      ON CONFLICT (tree_id, user_id) DO NOTHING
      RETURNING user_id
    `;
    revalidatePath("/legacy-tree");
    return {
      success: added.length
        ? "Moment Maker™ added to your Legacy Tree™."
        : "Moment Maker™ is already in this Legacy Tree™.",
      treeId: tree.id,
    };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
    return { error: "Enter a name of 1 to 120 characters." };
  }

  if (memberType === "future") {
    await sql`
      INSERT INTO future_moment_makers (
        id, owner_user_id, legacy_tree_id, name, relationship, created_at, updated_at, line_partner_type, line_partner_id
      ) VALUES (
        ${randomUUID()}, ${user.id}, ${tree.id}, ${name.trim()},
        ${normalizedRelationship}, ${now}, ${now}, ${referenceType}, ${referenceId}
      )
    `;
    revalidatePath("/legacy-tree");
    return { success: "Future Moment Maker™ added to your Legacy Tree™.", treeId: tree.id };
  }

  const skipDetails = formData.get("skipDetails") === "yes";
  const birthYearValue = skipDetails ? null : formData.get("birthYear");
  const deathYearValue = skipDetails ? null : formData.get("deathYear");
  const notesValue = skipDetails ? null : formData.get("notes");
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
      birth_year, death_year, notes, created_at, updated_at, line_partner_type, line_partner_id
    ) VALUES (
      ${randomUUID()}, ${tree.id}, ${user.id}, ${name.trim()},
      ${normalizedRelationship}, ${birthYear}, ${deathYear},
      ${notesValue?.trim() || null}, ${now}, ${now}, ${referenceType}, ${referenceId}
    )
  `;
  revalidatePath("/legacy-tree");
  revalidatePath("/create-moment");
  return { success: "Family Placeholder added to your Legacy Tree™.", treeId: tree.id };
}

function parseOptionalYear(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}$/.test(value)) return undefined;
  const year = Number(value);
  return year >= 1000 && year <= 9999 ? year : undefined;
}
