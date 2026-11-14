"use server";

import { getSql } from "@/lib/db";

export type LegacyFrameInterestState = {
  error?: string;
  success?: string;
};

export async function submitLegacyFrameInterest(
  _previousState: LegacyFrameInterestState,
  formData: FormData,
): Promise<LegacyFrameInterestState> {
  const field = formData.get("email");
  const email = typeof field === "string" ? field.trim().toLowerCase() : "";

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { error: "Enter a valid email address." };
  }

  const sql = getSql();
  await sql`
    INSERT INTO legacy_frame_interests (email, created_at)
    VALUES (${email}, ${new Date().toISOString()})
    ON CONFLICT DO NOTHING
  `;

  return {
    success:
      "Your interest has been recorded. Availability details will be shared here when announced.",
  };
}
