"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createSession, deleteCurrentSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/password";

export type AuthFormState = { error?: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const memberships = ["free"] as const;
const displayStyles = ["full-name", "first-last", "custom"] as const;
const discoverabilityOptions = ["private", "searchable", "public"] as const;

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

export async function signupAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const firstName = value(formData, "firstName");
  const middleName = value(formData, "middleName");
  const lastName = value(formData, "lastName");
  const email = value(formData, "email").toLowerCase();
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  const displayStyle = value(formData, "displayStyle");
  const customDisplayName = value(formData, "customDisplayName");
  const membership = value(formData, "membership");
  const discoverability = value(formData, "discoverability");

  if (
    firstName.length < 1 ||
    firstName.length > 80 ||
    lastName.length < 1 ||
    lastName.length > 80 ||
    middleName.length > 80
  ) {
    return { error: "Enter a valid first and last name." };
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (
    typeof password !== "string" ||
    typeof confirmPassword !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    return { error: "Your password must be between 8 and 128 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Your passwords do not match. Please try again." };
  }
  if (!displayStyles.includes(displayStyle as (typeof displayStyles)[number])) {
    return { error: "Choose how your profile name should appear." };
  }
  if (!memberships.includes(membership as (typeof memberships)[number])) {
    return { error: "Only Free membership is available for new accounts right now." };
  }
  if (
    !discoverabilityOptions.includes(
      discoverability as (typeof discoverabilityOptions)[number],
    )
  ) {
    return { error: "Choose a profile visibility option." };
  }
  if (formData.get("terms") !== "on" || formData.get("visibilityAcknowledgment") !== "on") {
    return { error: "Please accept both agreements to continue." };
  }

  const selectedStyle = displayStyle as (typeof displayStyles)[number];
  const displayName =
    selectedStyle === "custom"
      ? customDisplayName
      : selectedStyle === "first-last"
        ? `${firstName} ${lastName}`
        : [firstName, middleName, lastName].filter(Boolean).join(" ");
  if (!displayName || displayName.length > 120) {
    return { error: "Enter a valid profile display name." };
  }

  const sql = getSql();
  const existingUsers =
    await sql`SELECT id FROM users WHERE LOWER(email) = ${email} LIMIT 1`;
  if (existingUsers.length > 0) {
    return { error: "An account with that email already exists. Try signing in." };
  }

  const userId = randomUUID();
  const treeId = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashSecret(password);

  try {
    await sql.transaction([
      sql`
        INSERT INTO users (
          id, email, password_hash, first_name, middle_name, last_name,
          display_name, display_style, membership, discoverability, featured,
          created_at, updated_at
        ) VALUES (
          ${userId}, ${email}, ${passwordHash}, ${firstName}, ${middleName || null},
          ${lastName}, ${displayName}, ${selectedStyle}, ${membership},
          ${discoverability}, ${formData.get("featured") === "on"},
          ${now}, ${now}
        )
      `,
      sql`
        INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
        VALUES (${treeId}, ${userId}, ${`${displayName}'s Legacy Tree™`}, ${now}, ${now})
      `,
      sql`
        INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
        VALUES (${treeId}, ${userId}, 'owner', ${now})
      `,
    ]);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return { error: "An account with that email already exists. Try signing in." };
    }
    throw error;
  }

  await createSession(userId);
  redirect("/dashboard?welcome=1");
}

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = value(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!emailPattern.test(email) || typeof password !== "string" || !password) {
    return { error: "Enter your email and password." };
  }

  const sql = getSql();
  const [user] = (await sql`
    SELECT id, password_hash AS "passwordHash"
    FROM users WHERE LOWER(email) = ${email}
    LIMIT 1
  `) as { id: string; passwordHash: string }[];
  if (!user || !(await verifySecret(password, user.passwordHash))) {
    return { error: "The email or password is not correct." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteCurrentSession();
  redirect("/");
}
