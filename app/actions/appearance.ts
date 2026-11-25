"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isSiteTheme, type SiteTheme } from "@/lib/site-themes";

export type AppearanceResult = { error?: string; success?: string; savedTheme?: SiteTheme };

export async function saveSiteTheme(
  _previous: AppearanceResult,
  formData: FormData,
): Promise<AppearanceResult> {
  const user = await requireUser();
  const theme = formData.get("theme");
  if (!isSiteTheme(theme)) return { error: "Choose a valid site theme." };

  const sql = getSql();
  const [updated] = await sql`
    UPDATE users SET site_theme = ${theme}, updated_at = ${new Date().toISOString()}
    WHERE id = ${user.id}
    RETURNING id
  `;
  if (!updated) return { error: "Your profile could not be found. Please sign in again." };
  revalidatePath("/", "layout");
  return { success: "Your site theme has been saved.", savedTheme: theme };
}
