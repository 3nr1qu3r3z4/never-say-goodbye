import { getCurrentUser } from "@/lib/auth";
import { getAccessibleMoment } from "@/lib/moment-access";
import { getAccessibleTimeCapsule } from "@/lib/cannot-open-until";
import { validatePhoto } from "@/lib/profile-photo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const moment = await getAccessibleMoment(user?.id ?? null, id)
    ?? await getAccessibleTimeCapsule(user?.id ?? null, id);
  if (!moment?.photoData) return new Response("Not found.", { status: 404, headers: { "Cache-Control": "private, no-store" } });

  const photo = validatePhoto(moment.photoData);
  if (typeof photo !== "string") {
    console.error("[moment-photo] Stored photo is invalid.", { momentId: id });
    return new Response("Photo is temporarily unavailable.", { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
  const [header, encoded] = photo.split(",");
  const contentType = header.slice(5, header.indexOf(";"));
  return new Response(new Uint8Array(Buffer.from(encoded, "base64")), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
