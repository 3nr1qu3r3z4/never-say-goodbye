export const MAX_MOMENT_VIDEO_BYTES = 100 * 1024 * 1024;

export function getMomentVideoFormat(filename: string) {
  const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[1].toLowerCase();
  if (extension === "mp4" || extension === "m4v") {
    return { extension, contentType: "video/mp4" };
  }
  if (extension === "mov") {
    return { extension, contentType: "video/quicktime" };
  }
  return null;
}
