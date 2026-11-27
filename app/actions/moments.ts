"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function deleteSharedMoment(momentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to delete a moment." };
  if (typeof momentId !== "string" || !momentId.trim()) {
    return { error: "This moment could not be found." };
  }

  const sql = getSql();
  const deleted = await sql`
    DELETE FROM moments
    WHERE id = ${momentId} AND user_id = ${user.id} AND kind = 'shared' AND archived_at IS NULL
    RETURNING id
  `;
  if (!deleted.length) return { error: "This moment is no longer available to delete." };

  revalidatePath("/moments");
  revalidatePath("/moments/[id]", "page");
  revalidatePath("/moment-maker/[id]", "page");
  revalidatePath("/my-profile/preview");
  revalidatePath("/dashboard");
  revalidatePath("/legacy-tree");
  return { success: true };
}
