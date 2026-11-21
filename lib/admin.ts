import "server-only";

import { notFound } from "next/navigation";
import { requireUser, type AuthenticatedUser } from "@/lib/auth";

export function isFounder(user: Pick<AuthenticatedUser, "id">) {
  const ids = (process.env.FOUNDER_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(user.id);
}

export async function requireFounder() {
  const user = await requireUser();
  if (!isFounder(user)) notFound();
  return user;
}
