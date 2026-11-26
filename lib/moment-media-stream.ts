import { get } from "@vercel/blob";

type StoredMedia = { pathname: string; contentType: string; sizeBytes: number | string };

function parseRange(value: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  if ((match[1] && !Number.isSafeInteger(Number(match[1]))) ||
      (match[2] && !Number.isSafeInteger(Number(match[2])))) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start >= size || start > end || (!match[1] && Number(match[2]) === 0)) return null;
  return { start, end };
}

export async function streamMomentMedia(request: Request, media: StoredMedia, kind: "video" | "audio") {
  const size = Number(media.sizeBytes);
  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, size) : null;
  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Cache-Control": "private, no-store" } });
  }

  const blob = await get(media.pathname, {
    access: "private",
    headers: range ? { Range: `bytes=${range.start}-${range.end}` } : undefined,
  });
  if (!blob || blob.statusCode !== 200) return new Response("Not found.", { status: 404 });
  if (range && blob.headers.get("content-range") !== `bytes ${range.start}-${range.end}/${size}`) {
    await blob.stream.cancel();
    console.error(`[moment-${kind}] Blob storage returned an unexpected range.`);
    return new Response(`${kind === "video" ? "Video" : "Audio"} playback is temporarily unavailable.`, { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": media.contentType,
    "Content-Length": String(range ? range.end - range.start + 1 : size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  return new Response(blob.stream, { status: range ? 206 : 200, headers });
}
