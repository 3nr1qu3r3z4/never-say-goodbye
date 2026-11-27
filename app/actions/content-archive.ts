"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export type ArchiveState = { error?: string; success?: string };

export async function changeArchiveState(_state: ArchiveState, form: FormData): Promise<ArchiveState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your content." };
  const id = form.get("id");
  const kind = form.get("kind");
  const operation = form.get("operation");
  if (typeof id !== "string" || !id.trim() ||
      (kind !== "moment" && kind !== "future") ||
      (operation !== "archive" && operation !== "restore")) {
    return { error: "Choose an available item to manage." };
  }

  const sql = getSql();
  const rows = kind === "moment"
    ? operation === "archive"
      ? await sql`UPDATE moments SET archived_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND user_id = ${user.id} AND archived_at IS NULL RETURNING id`
      : await sql`UPDATE moments SET archived_at = NULL
          WHERE id = ${id} AND user_id = ${user.id} AND archived_at IS NOT NULL RETURNING id`
    : operation === "archive"
      ? await sql`UPDATE future_moment_makers SET archived_at = CURRENT_TIMESTAMP
          WHERE id = ${id} AND owner_user_id = ${user.id}
            AND archived_at IS NULL AND status <> 'archived' RETURNING id`
      : await sql`UPDATE future_moment_makers
          SET archived_at = NULL, status = CASE WHEN status = 'archived' THEN 'awaiting-claim' ELSE status END
          WHERE id = ${id} AND owner_user_id = ${user.id}
            AND (archived_at IS NOT NULL OR status = 'archived') RETURNING id`;
  if (!rows.length) return { error: "This item is no longer available for that action." };

  for (const path of ["/my-profile/membership", "/my-profile/membership/content", "/dashboard",
    "/moments", "/connected-lives", "/legacy-tree", "/family-calendar", "/my-profile/preview", "/search"]) {
    revalidatePath(path);
  }
  revalidatePath("/moments/[id]", "page");
  revalidatePath("/moment-maker/[id]", "page");
  revalidatePath("/future-moment-maker/[id]", "page");
  revalidatePath("/cannot-open-until");
  revalidatePath("/cannot-open-until/[id]", "page");
  revalidatePath("/cannot-open-until/inbox");
  revalidatePath("/cannot-open-until/inbox/[id]", "page");
  return { success: operation === "archive" ? "Archived." : "Restored." };
}
