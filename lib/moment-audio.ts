export const MAX_MOMENT_AUDIO_BYTES = 100 * 1024 * 1024;

export function getMomentAudioFormat(filename: string) {
  const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[1].toLowerCase();
  switch (extension) {
    case "mp3":
      return { extension, contentType: "audio/mpeg" };
    case "m4a":
      return { extension, contentType: "audio/mp4" };
    case "wav":
      return { extension, contentType: "audio/wav" };
    default:
      return null;
  }
}
