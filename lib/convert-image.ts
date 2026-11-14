export function isHeicImage(file: File): boolean {
  const mimeType = file.type.toLowerCase();
  return (
    (mimeType.startsWith("image/") &&
      (mimeType.includes("heic") || mimeType.includes("heif"))) ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

export async function toSupportedImage(file: File): Promise<File> {
  if (!isHeicImage(file)) return file;

  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;

  if (!blob) {
    throw new Error("This iPhone photo could not be converted. Please try again.");
  }

  return new File(
    [blob],
    file.name.replace(/\.(heic|heif)$/i, ".jpg"),
    { type: "image/jpeg", lastModified: file.lastModified },
  );
}
