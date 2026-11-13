export type MomentKind =
  | "shared"
  | "personal"
  | "cannot-open-until"
  | "future-moment-maker";

export type ContentKind = "photo" | "video" | "voice" | "written";
export type MediaContentKind = Exclude<ContentKind, "written">;
export type Audience = "public" | "connections" | "family" | "private";
export type ReleaseKind = "date" | "occasion";
export type AttachmentNames = Partial<Record<MediaContentKind, string>>;

export type MomentDraft = {
  title: string;
  story: string;
  tags: string;
  content: ContentKind[];
  attachmentNames: AttachmentNames;
  writtenMessage: string;
  audience: Audience;
  accessCodeRequired: boolean;
  accessCode: string;
  releaseKind: ReleaseKind;
  releaseDate: string;
  occasion: string;
  customOccasionDate: string;
  recipientName: string;
  relationship: string;
  createRecipient: boolean;
};

export const initialMomentDraft: MomentDraft = {
  title: "",
  story: "",
  tags: "",
  content: [],
  attachmentNames: {},
  writtenMessage: "",
  audience: "connections",
  accessCodeRequired: false,
  accessCode: "",
  releaseKind: "date",
  releaseDate: "",
  occasion: "18th Birthday",
  customOccasionDate: "",
  recipientName: "",
  relationship: "",
  createRecipient: false,
};
