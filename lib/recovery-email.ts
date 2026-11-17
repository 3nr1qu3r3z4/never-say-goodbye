import "server-only";

export function getRecoveryConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECOVERY_FROM_EMAIL;
  const appUrl = process.env.APP_URL;
  const rateLimitSecret = process.env.RECOVERY_RATE_LIMIT_SECRET;
  if (!apiKey || !from || !appUrl || !rateLimitSecret || rateLimitSecret.length < 32) {
    throw new Error("Account recovery is not configured.");
  }
  const url = new URL(appUrl);
  if (
    (url.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Account recovery URL is invalid.");
  }
  return { apiKey, from, origin: url.origin, rateLimitSecret };
}

export async function sendRecoveryEmail(
  config: ReturnType<typeof getRecoveryConfig>,
  to: string,
  subject: string,
  text: string,
) {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: config.from, to: [to], subject, text }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.error("[account-recovery] Email delivery request failed.");
    throw new Error("Account recovery email delivery failed.");
  }
  if (!response.ok) {
    console.error("[account-recovery] Email delivery rejected.", {
      status: response.status,
    });
    throw new Error("Account recovery email delivery failed.");
  }
}
