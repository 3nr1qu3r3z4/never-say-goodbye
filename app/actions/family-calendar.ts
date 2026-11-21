"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { validCalendarDate } from "@/lib/family-calendar";

export type CalendarActionState = { error?: string; success?: string };

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(form: FormData, name: string): string | null | undefined {
  const value = field(form, name);
  if (!value) return null;
  return validCalendarDate(value) ? value : undefined;
}

export async function saveCalendarProfile(
  _state: CalendarActionState, form: FormData,
): Promise<CalendarActionState> {
  const user = await requireUser();
  const birthDate = optionalDate(form, "birthDate");
  const memorialDate = optionalDate(form, "memorialDate");
  const birthYear = field(form, "birthYear");
  if (birthDate === undefined || memorialDate === undefined ||
      (birthYear && (!/^\d{4}$/.test(birthYear) || Number(birthYear) < 1000)) ||
      (birthDate && birthYear && birthDate.slice(0, 4) !== birthYear) ||
      (birthDate && memorialDate && birthDate > memorialDate) ||
      (birthYear && memorialDate && Number(birthYear) > Number(memorialDate.slice(0, 4)))) {
    return { error: "Enter valid dates, a matching birth year, and a memorial date after birth." };
  }
  const sql = getSql();
  const rows = await sql`
    UPDATE users SET birth_date = ${birthDate}::date,
      birth_year = ${birthYear ? Number(birthYear) : null},
      memorial_date = ${memorialDate}::date,
      share_birthday = ${form.get("shareBirthday") === "on"},
      share_anniversary = ${form.get("shareAnniversary") === "on"},
      share_memorial_date = ${form.get("shareMemorialDate") === "on"},
      share_relationship_milestones = ${form.get("shareMilestones") === "on"},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${user.id} RETURNING id
  `;
  if (rows.length === 0) return { error: "Your account is no longer available." };
  revalidatePath("/family-calendar");
  return { success: "Your family date preferences have been saved." };
}

export async function saveCalendarReminders(
  _state: CalendarActionState, form: FormData,
): Promise<CalendarActionState> {
  const user = await requireUser();
  const sql = getSql();
  await sql`
    INSERT INTO family_calendar_reminders (user_id, day_of, one_day_before, one_week_before, one_month_before)
    VALUES (${user.id}, ${form.get("dayOf") === "on"}, ${form.get("oneDay") === "on"},
      ${form.get("oneWeek") === "on"}, ${form.get("oneMonth") === "on"})
    ON CONFLICT (user_id) DO UPDATE SET day_of = EXCLUDED.day_of,
      one_day_before = EXCLUDED.one_day_before, one_week_before = EXCLUDED.one_week_before,
      one_month_before = EXCLUDED.one_month_before
  `;
  revalidatePath("/family-calendar");
  return { success: "Reminder preferences saved. Notifications are not available yet." };
}

export async function createCalendarEvent(
  _state: CalendarActionState, form: FormData,
): Promise<CalendarActionState> {
  const user = await requireUser();
  const treeId = field(form, "treeId");
  const title = field(form, "title");
  const date = optionalDate(form, "date");
  if (!treeId || !title || title.length > 120 || !date) {
    return { error: "Choose a tree and enter a title and valid date." };
  }
  const sql = getSql();
  const rows = await sql`
    INSERT INTO family_calendar_events (id, tree_id, creator_user_id, title, event_date, repeats_yearly)
    SELECT ${randomUUID()}, ltm.tree_id, ${user.id}, ${title}, ${date}::date,
           ${form.get("repeatsYearly") === "on"}
    FROM legacy_tree_members AS ltm
    WHERE ltm.tree_id = ${treeId} AND ltm.user_id = ${user.id}
    RETURNING id
  `;
  if (rows.length === 0) return { error: "You must belong to the selected tree." };
  revalidatePath("/family-calendar");
  return { success: "Family event added." };
}

export async function enableCalendarImports(
  _state: CalendarActionState, form: FormData,
): Promise<CalendarActionState> {
  const user = await requireUser();
  const treeId = field(form, "treeId");
  const sql = getSql();
  const rows = await sql`
    INSERT INTO family_calendar_import_settings (tree_id, enabled)
    SELECT tree_id, TRUE FROM legacy_tree_members
    WHERE tree_id = ${treeId} AND user_id = ${user.id}
    ON CONFLICT (tree_id) DO UPDATE SET enabled = TRUE
    RETURNING tree_id
  `;
  if (rows.length === 0) return { error: "You must belong to the selected tree." };
  revalidatePath("/family-calendar");
  return { success: "Family dates are synchronized with this tree." };
}

export async function saveTreeSourceDate(
  _state: CalendarActionState, form: FormData,
): Promise<CalendarActionState> {
  const user = await requireUser();
  const treeId = field(form, "treeId");
  const sourceId = field(form, "sourceId");
  const sourceType = field(form, "sourceType");
  const first = optionalDate(form, "firstDate");
  const second = optionalDate(form, "secondDate");
  if (!treeId || !sourceId || first === undefined || second === undefined) {
    return { error: "Enter valid dates and select a family record." };
  }
  const sql = getSql();
  let rows;
  if (sourceType === "placeholder") {
    rows = await sql`
      UPDATE family_placeholders AS fp SET birth_date = ${first}::date,
        memorial_date = ${second}::date, updated_at = ${new Date().toISOString()}
      WHERE fp.id = ${sourceId} AND fp.legacy_tree_id = ${treeId}
        AND (${first}::date IS NULL OR fp.birth_year IS NULL OR EXTRACT(YEAR FROM ${first}::date) = fp.birth_year)
        AND (${second}::date IS NULL OR fp.death_year IS NULL OR EXTRACT(YEAR FROM ${second}::date) = fp.death_year)
        AND (${first}::date IS NULL OR fp.death_year IS NULL OR EXTRACT(YEAR FROM ${first}::date) <= fp.death_year)
        AND (${second}::date IS NULL OR fp.birth_year IS NULL OR EXTRACT(YEAR FROM ${second}::date) >= fp.birth_year)
        AND (${first}::date IS NULL OR ${second}::date IS NULL OR ${first}::date <= ${second}::date)
        AND NOT EXISTS (SELECT 1 FROM honored_lives AS honored
          WHERE honored.family_placeholder_id = fp.id
            AND honored.passing_date IS NOT NULL
            AND ${first}::date > honored.passing_date)
        AND EXISTS (SELECT 1 FROM legacy_tree_members AS admin WHERE admin.tree_id = fp.legacy_tree_id
          AND admin.user_id = ${user.id} AND admin.role IN ('owner', 'admin'))
      RETURNING fp.id
    `;
  } else if (sourceType === "future") {
    rows = await sql`
      UPDATE future_moment_makers AS f SET expected_birth_date = ${first}::date,
        updated_at = ${new Date().toISOString()}
      WHERE f.id = ${sourceId} AND f.legacy_tree_id = ${treeId} AND f.status = 'awaiting-claim'
        AND EXISTS (SELECT 1 FROM legacy_tree_members AS admin WHERE admin.tree_id = f.legacy_tree_id
          AND admin.user_id = ${user.id} AND admin.role IN ('owner', 'admin'))
      RETURNING f.id
    `;
  } else if (sourceType === "connection") {
    rows = await sql`
      UPDATE connected_lives AS cl SET anniversary_date = ${first}::date,
        updated_at = ${new Date().toISOString()}
      WHERE cl.id = ${sourceId} AND cl.status = 'accepted'
        AND EXISTS (SELECT 1 FROM legacy_tree_members AS admin WHERE admin.tree_id = ${treeId}
          AND admin.user_id = ${user.id} AND admin.role IN ('owner', 'admin'))
        AND EXISTS (SELECT 1 FROM legacy_tree_members AS m JOIN users AS u ON u.id = m.user_id
          WHERE m.tree_id = ${treeId} AND m.user_id = cl.owner_user_id AND u.share_anniversary)
        AND EXISTS (SELECT 1 FROM legacy_tree_members AS m JOIN users AS u ON u.id = m.user_id
          WHERE m.tree_id = ${treeId} AND m.user_id = cl.connected_user_id AND u.share_anniversary)
      RETURNING cl.id
    `;
  } else {
    return { error: "Choose a valid family record." };
  }
  if (rows.length === 0) return { error: "This record cannot be updated. Check access, consent, and any recorded years." };
  revalidatePath("/family-calendar");
  return { success: "Family dates saved." };
}

export async function addRelationshipMilestone(
  _state: CalendarActionState, form: FormData,
): Promise<CalendarActionState> {
  const user = await requireUser();
  const treeId = field(form, "treeId");
  const connectionId = field(form, "sourceId");
  const title = field(form, "title");
  const date = optionalDate(form, "date");
  if (!treeId || !connectionId || !title || title.length > 120 || !date) {
    return { error: "Enter a milestone title and valid date." };
  }
  const sql = getSql();
  const rows = await sql`
    INSERT INTO family_relationship_milestones (id, connection_id, title, event_date, repeats_yearly)
    SELECT ${randomUUID()}, cl.id, ${title}, ${date}::date, ${form.get("repeatsYearly") === "on"}
    FROM connected_lives AS cl
    WHERE cl.id = ${connectionId} AND cl.status = 'accepted'
      AND EXISTS (SELECT 1 FROM legacy_tree_members AS admin WHERE admin.tree_id = ${treeId}
        AND admin.user_id = ${user.id} AND admin.role IN ('owner', 'admin'))
      AND EXISTS (SELECT 1 FROM legacy_tree_members AS m JOIN users AS u ON u.id = m.user_id
        WHERE m.tree_id = ${treeId} AND m.user_id = cl.owner_user_id AND u.share_relationship_milestones)
      AND EXISTS (SELECT 1 FROM legacy_tree_members AS m JOIN users AS u ON u.id = m.user_id
        WHERE m.tree_id = ${treeId} AND m.user_id = cl.connected_user_id AND u.share_relationship_milestones)
    RETURNING id
  `;
  if (rows.length === 0) return { error: "Both members must share milestones, and you must be a tree owner or admin." };
  revalidatePath("/family-calendar");
  return { success: "Relationship milestone added." };
}
