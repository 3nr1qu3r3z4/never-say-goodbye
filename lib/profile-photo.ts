import "server-only";

const maxEncodedPhotoLength = 900_000;
const photoDataUrlPattern =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function validatePhoto(value: unknown): string | { error: string } {
  if (typeof value !== "string" || value.length > maxEncodedPhotoLength) {
    return { error: "Choose an image smaller than 640 KB after optimization." };
  }
  const match = photoDataUrlPattern.exec(value);
  if (!match) {
    return { error: "Choose a JPG, JPEG, PNG, or WEBP image." };
  }

  const [, mimeType, encodedImage] = match;
  const image = Buffer.from(encodedImage, "base64");
  const hasValidSignature =
    (mimeType === "image/jpeg" &&
      image[0] === 0xff &&
      image[1] === 0xd8 &&
      image[2] === 0xff) ||
    (mimeType === "image/png" &&
      image.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )) ||
    (mimeType === "image/webp" &&
      image.toString("ascii", 0, 4) === "RIFF" &&
      image.toString("ascii", 8, 12) === "WEBP");
  if (image.length === 0 || image.length > 640 * 1024 || !hasValidSignature) {
    return { error: "The selected image could not be saved. Please try another." };
  }

  return value;
}
