export const emailPreferenceOptions = [
  { name: "newConnectionRequests", label: "New Connection Requests" },
  { name: "connectionRequestAccepted", label: "Connection Request Accepted" },
  { name: "newPhotoShared", label: "New Photo Shared" },
  { name: "newVideoShared", label: "New Video Shared" },
  { name: "newAudioMessageShared", label: "New Audio Moment Shared" },
  { name: "sharedMoments", label: "Shared Moments" },
] as const;

export type EmailPreferences = Record<(typeof emailPreferenceOptions)[number]["name"], boolean>;
