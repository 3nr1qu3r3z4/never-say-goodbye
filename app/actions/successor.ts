"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { successorPreviewEnabled } from "@/lib/successor";

export type SuccessorActionState = { error?: string; success?: string };

function refreshSuccessorViews() {
  revalidatePath("/my-profile/successor");
  revalidatePath("/my-profile");
  revalidatePath("/dashboard");
}

export async function saveSuccessor(_state: SuccessorActionState, form: FormData): Promise<SuccessorActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your designation." };
  if (!successorPreviewEnabled(user.id)) return { error: "Successor Assignment is not available." };
  const candidate = form.get("successorId");
  if (typeof candidate !== "string" || !candidate.trim() || candidate.length > 200 || candidate === user.id) {
    return { error: "Choose an eligible Connected Lives™ member other than yourself." };
  }
  const sql = getSql();
  const now = new Date().toISOString();
  const rows = await sql`
    INSERT INTO legacy_successors (id, owner_user_id, successor_user_id, successor_name, status, created_at, updated_at)
    SELECT ${randomUUID()}, ${user.id}, person.id,
           COALESCE(NULLIF(BTRIM(person.display_name), ''), 'Moment Maker'), 'designated', ${now}, ${now}
    FROM users person
    WHERE person.id = ${candidate} AND person.id <> ${user.id}
      AND EXISTS (
        SELECT 1 FROM connected_lives cl WHERE cl.status = 'accepted'
          AND ((cl.owner_user_id = ${user.id} AND cl.connected_user_id = person.id)
            OR (cl.connected_user_id = ${user.id} AND cl.owner_user_id = person.id))
      )
    ON CONFLICT (owner_user_id) WHERE status = 'designated'
    DO UPDATE SET successor_user_id = EXCLUDED.successor_user_id,
                  successor_name = EXCLUDED.successor_name, updated_at = EXCLUDED.updated_at
    RETURNING id
  `;
  if (!rows.length) return { error: "Choose an accepted Connected Lives™ member who is still available." };
  refreshSuccessorViews();
  return { success: "Your designation was saved." };
}

export async function removeSuccessor(): Promise<SuccessorActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your designation." };
  if (!successorPreviewEnabled(user.id)) return { error: "Successor Assignment is not available." };
  const sql = getSql();
  const rows = await sql`
    DELETE FROM legacy_successors
    WHERE owner_user_id = ${user.id} AND status = 'designated'
    RETURNING id
  `;
  if (!rows.length) return { error: "Your designation is no longer available to remove." };
  refreshSuccessorViews();
  return { success: "Your designation was removed." };
}
