import type { Audience, MomentKind } from "@/lib/moment-types";

export const restrictedMomentBorder = "border-[#d8a35b]/50";

export function momentBorderClassName(kind: MomentKind, audience: Audience, hasAccessCode = false) {
  return audience !== "public" || hasAccessCode || kind === "cannot-open-until" || kind === "future-moment-maker"
    ? restrictedMomentBorder
    : "border-[color:var(--nsg-border)]/10";
}
