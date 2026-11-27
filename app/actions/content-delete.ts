"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

type Media = { id: string; pathname: string; kind: "audio" | "video" };

export async function deleteManagedMoment(momentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to delete a Moment." };
  if (typeof momentId !== "string" || !momentId.trim()) {
    return { error: "This Moment could not be found." };
  }

  const sql = getSql();
  const [, media, deleted] = await sql.transaction([
    sql`SELECT id FROM moments WHERE id = ${momentId} AND user_id = ${user.id} FOR UPDATE`,
    sql`SELECT v.id, v.pathname, 'video' AS kind
        FROM moment_videos v JOIN moments m ON m.id = v.moment_id
        WHERE m.id = ${momentId} AND m.user_id = ${user.id}
        UNION ALL
        SELECT a.id, a.pathname, 'audio' AS kind
        FROM moment_audio a JOIN moments m ON m.id = a.moment_id
        WHERE m.id = ${momentId} AND m.user_id = ${user.id}`,
    sql`DELETE FROM moments WHERE id = ${momentId} AND user_id = ${user.id} RETURNING id`,
  ], { isolationLevel: "ReadCommitted" });
  if (!deleted.length) return { error: "This Moment is no longer available to delete." };

  for (const path of ["/my-profile/membership", "/my-profile/membership/content", "/dashboard",
    "/moments", "/legacy-tree", "/family-calendar", "/my-profile/preview", "/cannot-open-until",
    "/cannot-open-until/inbox"]) {
    revalidatePath(path);
  }
  for (const path of ["/moments/[id]", "/moment-maker/[id]", "/future-moment-maker/[id]",
    "/cannot-open-until/[id]", "/cannot-open-until/inbox/[id]"]) {
    revalidatePath(path, "page");
  }

  let cleanupPending = false;
  for (const item of media as Media[]) {
    try {
      await del(item.pathname);
      if (item.kind === "video") {
        await sql`DELETE FROM moment_videos WHERE id = ${item.id} AND moment_id IS NULL`;
      } else {
        await sql`DELETE FROM moment_audio WHERE id = ${item.id} AND moment_id IS NULL`;
      }
    } catch (error) {
      console.error("[moment-deletion] Media cleanup failed; retention will retry.", error);
      cleanupPending = true;
    }
  }
  return { success: true, cleanupPending };
}
