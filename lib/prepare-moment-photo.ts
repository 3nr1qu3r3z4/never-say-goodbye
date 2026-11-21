import { isHeicFile, toSupportedImage } from "@/lib/convert-image";

const maxInputBytes = 20 * 1024 * 1024;
const maxPhotoBytes = 640 * 1024;
const maxDimension = 1600;
const timeoutMs = 60_000;

function withTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Preparing this photo took too long. Please try another image.")),
      timeoutMs,
    );
    operation.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error: unknown) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return withTimeout(new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  }));
}

function readDataUrl(blob: Blob) {
  return withTimeout(new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The photo could not be read."));
    };
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(blob);
  }));
}

export async function prepareMomentPhoto(file: File) {
  if (file.size > maxInputBytes) throw new Error("Choose an image smaller than 20 MB.");
  if (
    !["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp"].includes(file.type.toLowerCase()) &&
    !/\.(jpe?g|png|webp)$/i.test(file.name) &&
    !(await withTimeout(isHeicFile(file)))
  ) {
    throw new Error("Choose a JPG, JPEG, PNG, WEBP, HEIC, or HEIF image.");
  }

  const supported = await withTimeout(toSupportedImage(file));
  const source = URL.createObjectURL(supported);
  const image = new window.Image();
  try {
    await withTimeout(new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be opened."));
      image.src = source;
    }));
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("This image could not be opened.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo preparation is unavailable in this browser.");
    let scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));

    for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const type of ["image/webp", "image/jpeg"]) {
        for (const quality of [0.85, 0.7, 0.55, 0.4]) {
          const blob = await canvasBlob(canvas, type, quality);
          if (!blob || blob.type !== type) break;
          if (blob.size <= maxPhotoBytes) {
            return { name: supported.name, data: await readDataUrl(blob) };
          }
        }
      }
      scale *= 0.75;
    }
    throw new Error("This photo is too large to save. Please try another image.");
  } finally {
    image.onload = null;
    image.onerror = null;
    URL.revokeObjectURL(source);
  }
}
