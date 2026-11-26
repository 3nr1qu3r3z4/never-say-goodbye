"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export type MilestoneState = { error?: string; success?: string };

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function numberField(form: FormData, name: string, min: number, max: number) {
  const value = field(form, name);
  if (!value) return null;
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) return undefined;
  return Number(value);
}

function revalidateMilestones() {
  revalidatePath("/legacy-tree");
  revalidatePath("/family-calendar");
  revalidatePath("/dashboard");
}

export async function saveMilestoneAdminConsent(_state: MilestoneState, form: FormData): Promise<MilestoneState> {
  const user = await requireUser();
  const sql = getSql();
  const rows = await sql`
    UPDATE legacy_tree_members SET allow_milestone_admin = ${form.get("allow") === "on"}
    WHERE tree_id = ${field(form, "treeId")} AND user_id = ${user.id}
    RETURNING tree_id
  `;
  if (!rows.length) return { error: "You must belong to this tree." };
  revalidateMilestones();
  return { success: "Milestone editing permission saved." };
}

export async function saveTreeMilestone(_state: MilestoneState, form: FormData): Promise<MilestoneState> {
  const user = await requireUser();
  const treeId = field(form, "treeId");
  const milestoneId = field(form, "milestoneId");
  const subjectType = field(form, "subjectType");
  const subjectId = field(form, "subjectId");
  const kind = field(form, "kind");
  const labels: Record<string, string> = {
    birthday: "Birthday", anniversary: "Anniversary", wedding: "Wedding Anniversary",
    graduation: "Graduation", custom: field(form, "title"),
  };
  const title = labels[kind];
  const year = numberField(form, "year", 1000, 9999);
  const month = numberField(form, "month", 1, 12);
  const day = numberField(form, "day", 1, 31);
  const repeats = (["birthday", "anniversary", "wedding"].includes(kind) && month !== null && day !== null)
    || form.get("repeatsYearly") === "on";
  if (!treeId || !subjectId || !["user", "placeholder", "future"].includes(subjectType) ||
      !["birthday", "anniversary", "wedding", "graduation", "custom"].includes(kind) ||
      !title || title.length > 120 || year === undefined || month === undefined || day === undefined ||
      (day !== null && month === null) ||
      (day !== null && month !== null && day > new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate()) ||
      (repeats && (month === null || day === null)) ||
      (!repeats && day !== null && year === null)) {
    return { error: "Enter a valid milestone and date. A day without a year must repeat yearly." };
  }
  const sql = getSql();
  const subjectUser = subjectType === "user" ? subjectId : null;
  const placeholder = subjectType === "placeholder" ? subjectId : null;
  const future = subjectType === "future" ? subjectId : null;
  const rows = milestoneId
    ? await sql`
        UPDATE family_tree_milestones AS m
        SET title = ${title}, year = ${year}, month = ${month}, day = ${day}, repeats_yearly = ${repeats}
        WHERE m.id = ${milestoneId} AND m.tree_id = ${treeId} AND m.kind = ${kind}
          AND m.user_id IS NOT DISTINCT FROM ${subjectUser}
          AND m.placeholder_id IS NOT DISTINCT FROM ${placeholder}
          AND m.future_id IS NOT DISTINCT FROM ${future}
          AND EXISTS (
            SELECT 1 FROM legacy_tree_members viewer
            LEFT JOIN legacy_tree_members subject ON subject.tree_id = viewer.tree_id AND subject.user_id = m.user_id
            WHERE viewer.tree_id = m.tree_id AND viewer.user_id = ${user.id}
              AND (m.user_id = viewer.user_id OR (viewer.role IN ('owner', 'admin')
                AND (m.user_id IS NULL OR subject.allow_milestone_admin)))
          )
        RETURNING m.id
      `
    : await sql`
        INSERT INTO family_tree_milestones
          (id, tree_id, user_id, placeholder_id, future_id, kind, title, year, month, day, repeats_yearly)
        SELECT ${randomUUID()}, viewer.tree_id, ${subjectUser}, ${placeholder}, ${future}, ${kind}, ${title},
               ${year}, ${month}, ${day}, ${repeats}
        FROM legacy_tree_members viewer
        WHERE viewer.tree_id = ${treeId} AND viewer.user_id = ${user.id}
          AND (
            (${subjectUser}::text IS NOT NULL AND EXISTS (
              SELECT 1 FROM legacy_tree_members subject
              JOIN users subject_user ON subject_user.id = subject.user_id
              WHERE subject.tree_id = viewer.tree_id AND subject.user_id = ${subjectUser}
                AND (subject.user_id = viewer.user_id OR
                  (viewer.role IN ('owner', 'admin') AND subject.allow_milestone_admin))
                AND (${kind} <> 'birthday' OR subject_user.birth_date IS NULL)
            ))
            OR (viewer.role IN ('owner', 'admin') AND (
              (${placeholder}::text IS NOT NULL AND EXISTS (
                SELECT 1 FROM family_placeholders p WHERE p.id = ${placeholder} AND p.legacy_tree_id = viewer.tree_id
                  AND (${kind} <> 'birthday' OR p.birth_date IS NULL)
              ))
              OR (${future}::text IS NOT NULL AND EXISTS (
                SELECT 1 FROM future_moment_makers f WHERE f.id = ${future}
                  AND f.legacy_tree_id = viewer.tree_id AND f.status <> 'archived'
              ))
            ))
          )
        ON CONFLICT DO NOTHING RETURNING id
      `;
  if (!rows.length) return { error: "This milestone could not be saved. Check access and consent. If a birthday already exists, manage it under the previously saved family dates." };
  revalidateMilestones();
  return { success: "Milestone saved to your Legacy Tree™." };
}

export async function deleteTreeMilestone(_state: MilestoneState, form: FormData): Promise<MilestoneState> {
  const user = await requireUser();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM family_tree_milestones AS m
    WHERE m.id = ${field(form, "milestoneId")} AND m.tree_id = ${field(form, "treeId")}
      AND EXISTS (
        SELECT 1 FROM legacy_tree_members viewer
        LEFT JOIN legacy_tree_members subject ON subject.tree_id = viewer.tree_id AND subject.user_id = m.user_id
        WHERE viewer.tree_id = m.tree_id AND viewer.user_id = ${user.id}
          AND (m.user_id = viewer.user_id OR (viewer.role IN ('owner', 'admin')
            AND (m.user_id IS NULL OR subject.allow_milestone_admin)))
      )
    RETURNING m.id
  `;
  if (!rows.length) return { error: "This milestone is unavailable or you no longer have permission to delete it." };
  revalidateMilestones();
  return { success: "Milestone removed." };
}
