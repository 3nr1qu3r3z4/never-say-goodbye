export type DelayUnit = "minutes" | "hours" | "days";

export function timeCapsuleDelayMinutes(amount: string, unit: DelayUnit): number | null {
  if (!/^\d+$/.test(amount)) return null;
  const value = Number(amount);
  const factor = unit === "minutes" ? 1 : unit === "hours" ? 60 : unit === "days" ? 1440 : 0;
  const minutes = value * factor;
  return Number.isSafeInteger(minutes) && minutes >= 1 && minutes <= 525600 ? minutes : null;
}

export function formatTimeCapsuleInstant(instant: string | number, timezone: string): string | null {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(date);
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}
