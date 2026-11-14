import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";

const sessionCookieName = "nsg_session";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;

export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  displayName: string;
  membership: "free" | "tier-2" | "tier-3";
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const sql = getSql();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionDurationMs);

  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (${hashToken(token)}, ${userId}, ${expiresAt.toISOString()}, ${now.toISOString()})
  `;

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) {
    const sql = getSql();
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }
  cookieStore.delete(sessionCookieName);
}

export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;

  const sql = getSql();
  const rows = (await sql`
    SELECT users.id, users.email, users.first_name AS "firstName",
           users.middle_name AS "middleName", users.last_name AS "lastName",
           users.display_name AS "displayName", users.membership
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${hashToken(token)}
      AND sessions.expires_at > ${new Date().toISOString()}
    LIMIT 1
  `) as AuthenticatedUser[];
  const user = rows[0];

  if (!user) {
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
    return null;
  }

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
