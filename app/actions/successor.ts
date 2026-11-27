"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSql } from "@/lib/db";

export type SuccessorActionState = { error?: string; success?: string; transferred?: boolean };

function refreshSuccessorViews() {
  revalidatePath("/my-profile/successor");
  revalidatePath("/my-profile");
  revalidatePath("/dashboard");
  revalidatePath("/my-profile/membership");
}

export async function saveSuccessor(_state: SuccessorActionState, form: FormData): Promise<SuccessorActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your successor." };
  const candidate = form.get("successorId");
  const trigger = form.get("trigger");
  if (typeof candidate !== "string" || !candidate.trim() || candidate.length > 200 || candidate === user.id) {
    return { error: "Choose an eligible successor other than yourself." };
  }
  if (trigger !== "30" && trigger !== "60" && trigger !== "90" && trigger !== "now") {
    return { error: "Choose when the transfer should begin." };
  }
  if (trigger === "now" && form.get("confirmTransfer") !== "on") {
    return { error: "Confirm that you want to permanently transfer your membership now." };
  }
  const sql = getSql();
  const [row] = trigger === "now"
    ? await sql`SELECT successor_transfer(${user.id}, ${candidate}, false) AS result` as { result: string }[]
    : await sql`SELECT successor_save_assignment(${user.id}, ${candidate}, ${Number(trigger)}) AS result` as { result: string }[];
  if (row.result === "ineligible") return { error: "This membership cannot be transferred." };
  if (row.result === "invalid_successor") return { error: "Choose an available successor who does not already have Lifetime Membership." };
  if (row.result !== "saved" && row.result !== "transferred") {
    throw new Error(`Unexpected successor assignment result: ${row.result}`);
  }
  refreshSuccessorViews();
  if (row.result === "transferred") redirect("/dashboard?successor=transferred");
  return { success: "Your successor assignment was saved." };
}

export async function removeSuccessor(): Promise<SuccessorActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your successor." };
  const sql = getSql();
  const rows = await sql`
    DELETE FROM successor_assignments WHERE owner_user_id = ${user.id}
      AND successor_can_manage(${user.id}) RETURNING owner_user_id
  `;
  if (!rows.length) return { error: "Your successor assignment is no longer available." };
  refreshSuccessorViews();
  return { success: "Your successor assignment was removed." };
}
