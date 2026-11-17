"use server";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { hashSecret } from "@/lib/password";
import { emailPattern } from "@/lib/account-validation";
import { getRecoveryConfig, sendRecoveryEmail } from "@/lib/recovery-email";

export type RecoveryState = { error?: string; message?: string };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requestRecovery(
  purpose: "username" | "password",
  formData: FormData,
): Promise<RecoveryState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (email.length > 254 || !emailPattern.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const message =
    purpose === "username"
      ? "Username recovery instructions have been sent."
      : "Password reset instructions have been sent.";

  let stage = "configuration";
  try {
    const config = getRecoveryConfig();
    const sql = getSql();
    const emailHash = createHmac("sha256", config.rateLimitSecret)
      .update(email)
      .digest("hex");
    stage = "throttling";
    const attempts = await sql`
      INSERT INTO account_recovery_attempts (email_hash, purpose, requested_at)
      VALUES (${emailHash}, ${purpose}, CURRENT_TIMESTAMP)
      ON CONFLICT (email_hash, purpose)
      DO UPDATE SET requested_at = EXCLUDED.requested_at
      WHERE account_recovery_attempts.requested_at < CURRENT_TIMESTAMP - INTERVAL '1 minute'
      RETURNING email_hash
    `;
    if (!attempts.length) {
      console.warn("[account-recovery] Recovery request throttled.", { purpose });
      return { message };
    }

    stage = "account lookup";
    const [user] = (await sql`
      SELECT id, email, username
      FROM users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `) as { id: string; email: string; username: string }[];
    if (!user) return { message };

    if (purpose === "username") {
      stage = "username email";
      await sendRecoveryEmail(
        config,
        user.email,
        "Your Never Say Goodbye username",
        `Your Never Say Goodbye username is: ${user.username}\n\nIf you did not request this, you can ignore this email.`,
      );
    } else {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashToken(token);
      stage = "reset token storage";
      await sql`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, CURRENT_TIMESTAMP + INTERVAL '30 minutes')
        ON CONFLICT (user_id)
        DO UPDATE SET token_hash = EXCLUDED.token_hash,
                      expires_at = EXCLUDED.expires_at,
                      created_at = CURRENT_TIMESTAMP
      `;
      const resetUrl = `${config.origin}/reset-password#token=${token}`;
      stage = "password email";
      await sendRecoveryEmail(
        config,
        user.email,
        "Reset your Never Say Goodbye password",
        `Use this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, you can ignore this email.`,
      );
    }
    return { message };
  } catch (error) {
    console.error("[account-recovery] Recovery request failed.", {
      purpose,
      stage,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return { error: "We could not process your request. Please try again later." };
  }
}

export async function recoverUsername(
  _previousState: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  return requestRecovery("username", formData);
}

export async function recoverPassword(
  _previousState: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  return requestRecovery("password", formData);
}

export async function resetPassword(
  _previousState: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmation = formData.get("confirmPassword");
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { error: "This reset link is invalid or has expired." };
  }
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    return { error: "Your password must be between 8 and 128 characters." };
  }
  if (password !== confirmation) {
    return { error: "Your passwords do not match." };
  }

  const sql = getSql();
  const tokenHash = hashToken(token);
  const [validToken] = await sql`
    SELECT user_id FROM password_reset_tokens
    WHERE token_hash = ${tokenHash} AND expires_at > CURRENT_TIMESTAMP
  `;
  if (!validToken) return { error: "This reset link is invalid or has expired." };

  const passwordHash = await hashSecret(password);
  const [updated] = await sql`
    WITH consumed AS (
      DELETE FROM password_reset_tokens
      WHERE token_hash = ${tokenHash} AND expires_at > CURRENT_TIMESTAMP
      RETURNING user_id
    ),
    changed AS (
      UPDATE users
      SET password_hash = ${passwordHash}, updated_at = ${new Date().toISOString()}
      FROM consumed
      WHERE users.id = consumed.user_id
      RETURNING users.id
    ),
    revoked AS (
      DELETE FROM sessions
      WHERE user_id IN (SELECT id FROM changed)
      RETURNING user_id
    )
    SELECT id FROM changed
  `;
  if (!updated) return { error: "This reset link is invalid or has expired." };
  return { message: "Your password has been reset. You can now sign in." };
}
