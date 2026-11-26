"use client";

import { useEffect, useState, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loadMomentDraft,
  getFamilyPlaceholders,
  publishMoment as publishMomentAction,
  saveMomentDraft,
} from "@/lib/moment-actions";
import {
  initialMomentDraft,
  type Audience,
  type ContentKind,
  type MediaContentKind,
  type MomentDraft,
  type MomentKind,
} from "@/lib/moment-types";
import { prepareMomentPhoto } from "@/lib/prepare-moment-photo";
import { beginMomentVideoUpload, completeMomentVideoUpload } from "@/lib/moment-video-actions";
import { getMomentVideoFormat, MAX_MOMENT_VIDEO_BYTES } from "@/lib/moment-video";
import { beginMomentAudioUpload, completeMomentAudioUpload } from "@/lib/moment-audio-actions";
import { getMomentAudioFormat, MAX_MOMENT_AUDIO_BYTES } from "@/lib/moment-audio";

const contentOptions: {
  value: ContentKind;
  icon: string;
  label: string;
  accept?: string;
}[] = [
  {
    value: "photo",
    icon: "📷",
    label: "Photo",
    accept: "image/*,.heic,.heif",
  },
  { value: "video", icon: "🎥", label: "Video", accept: ".mp4,.mov,.m4v,video/mp4,video/quicktime,video/x-m4v" },
  { value: "voice", icon: "🎤", label: "Audio", accept: ".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav" },
  { value: "written", icon: "✍", label: "Written Message" },
];

const audiences: { value: Audience; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "connections", label: "Connections Only" },
  { value: "family", label: "Family Only" },
  { value: "private", label: "Private" },
];

const occasions = [
  "18th Birthday",
  "Wedding Day",
  "Graduation",
  "Retirement",
  "Custom Date",
];

const config: Record<
  MomentKind,
  { title: string; icon: string; subtitle: string; prompt: string }
> = {
  shared: {
    title: "Shared Moment",
    icon: "❤️",
    subtitle: "A story to keep close and share with the people you choose.",
    prompt: "What would you like your loved ones to know about this moment?",
  },
  personal: {
    title: "Personal Moment",
    icon: "🔒",
    subtitle: "A private story, held with care and protected by your choices.",
    prompt: "Write the message or memory you want to keep personal.",
  },
  "cannot-open-until": {
    title: "Cannot Open Until™",
    icon: "⏳",
    subtitle: "Save a message with a future date or milestone. Timed unlocking and delivery are not yet available.",
    prompt: "What would you like to tell them when that day arrives?",
  },
  "future-moment-maker": {
    title: "Future Moment Maker™",
    icon: "✨",
    subtitle: "Begin a collection for someone whose story is still unfolding.",
    prompt: "What would you like this person to know about their beginnings?",
  },
};

const fieldClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20";
const sectionClassName =
  "rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 sm:p-7";
const secondaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--nsg-accent)]/60 px-6 py-3 text-sm font-semibold text-[color:var(--nsg-accent-light)] transition hover:border-[color:var(--nsg-accent)] hover:bg-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]";

export default function MomentEditor({ kind }: { kind: MomentKind }) {
  const router = useRouter();
  const [draft, setDraft] = useState<MomentDraft>(initialMomentDraft);
  const [draftId, setDraftId] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [accessCodeSaved, setAccessCodeSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhotoPreparing, setIsPhotoPreparing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState("");
  const [familyPlaceholders, setFamilyPlaceholders] = useState<
    { id: string; name: string; relationship: string }[]
  >([]);
  const [isAudioUploading, setIsAudioUploading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioError, setAudioError] = useState("");
  const momentConfig = config[kind];

  useEffect(() => {
    let active = true;
    loadMomentDraft(kind)
      .then((result) => {
        if (!active) return;
        if ("error" in result) {
          setStatusMessage(result.error ?? "Your saved draft could not be loaded.");
        } else if (result.draft) {
          setDraft(result.draft);
          setDraftId(result.draftId);
          setAccessCodeSaved(result.accessCodeSaved);
          setStatusMessage("Your saved draft has been restored.");
        }
        setIsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setStatusMessage("Your saved draft could not be loaded. Please try again.");
        setIsReady(true);
      });
    return () => {
      active = false;
    };
  }, [kind]);

  useEffect(() => {
    let active = true;
    getFamilyPlaceholders()
      .then((placeholders) => {
        if (active) setFamilyPlaceholders(placeholders);
      })
      .catch(() => {
        if (active) {
          setStatusMessage(
            "Family Placeholders could not be loaded. You can still create a moment.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function updateDraft<Key extends keyof MomentDraft>(
    key: Key,
    value: MomentDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatusMessage("");
  }

  function toggleContent(content: ContentKind) {
    if (content === "photo") setPhotoError("");
    if (content === "video") setVideoError("");
    if (content === "voice") setAudioError("");
    setDraft((current) => {
      const removing = current.content.includes(content);
      const attachmentNames = { ...current.attachmentNames };
      if ((content === "photo" || content === "video" || content === "voice") && removing) delete attachmentNames[content];
      return {
        ...current,
        content: removing
          ? current.content.filter((item) => item !== content)
          : [...current.content, content],
        attachmentNames,
        photoData: content === "photo" && removing ? "" : current.photoData,
        videoUploadId: content === "video" && removing ? "" : current.videoUploadId,
        audioUploadId: content === "voice" && removing ? "" : current.audioUploadId,
      };
    });
    setStatusMessage("");
  }

  async function handleMediaSelection(
    option: (typeof contentOptions)[number],
    input: HTMLInputElement,
  ) {
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";
    setStatusMessage("");

    try {
      if (option.value === "photo") {
        setIsPhotoPreparing(true);
        setPhotoError("");
        setStatusMessage("Preparing your photo…");
        setDraft((current) => {
          const attachmentNames = { ...current.attachmentNames };
          delete attachmentNames.photo;
          return { ...current, photoData: "", attachmentNames };
        });
        const photo = await prepareMomentPhoto(file);
        setDraft((current) => ({
          ...current,
          photoData: photo.data,
          attachmentNames: { ...current.attachmentNames, photo: photo.name },
        }));
        setStatusMessage("Photo is ready to add.");
        return;
      }

      if (option.value === "video" && kind === "shared") {
        setIsVideoUploading(true);
        setVideoProgress(0);
        setVideoError("");
        setDraft((current) => {
          const attachmentNames = { ...current.attachmentNames };
          delete attachmentNames.video;
          return { ...current, videoUploadId: "", attachmentNames };
        });
        if (!getMomentVideoFormat(file.name)) throw new Error("Choose an MP4, MOV, or M4V video.");
        if (!file.size || file.size > MAX_MOMENT_VIDEO_BYTES) throw new Error("Choose a video up to 100 MiB.");
        const reservation = await beginMomentVideoUpload(file.name, file.size);
        if ("error" in reservation) throw new Error(reservation.error);
        await upload(reservation.pathname, file, {
          access: "private",
          handleUploadUrl: "/api/moment-video-upload",
          contentType: reservation.contentType,
          onUploadProgress: ({ percentage }) => setVideoProgress(Math.round(percentage)),
        });
        const completed = await completeMomentVideoUpload(reservation.id);
        if ("error" in completed) throw new Error(completed.error);
        setDraft((current) => ({
          ...current,
          videoUploadId: reservation.id,
          attachmentNames: { ...current.attachmentNames, video: file.name },
        }));
        setStatusMessage("Video is ready to add.");
        return;
      }

      if (option.value === "voice" && kind === "shared") {
        setIsAudioUploading(true);
        setAudioProgress(0);
        setAudioError("");
        if (!getMomentAudioFormat(file.name)) throw new Error("Choose an MP3, M4A, or WAV audio file.");
        if (!file.size || file.size > MAX_MOMENT_AUDIO_BYTES) throw new Error("Choose audio up to 100 MiB.");
        const reservation = await beginMomentAudioUpload(file.name, file.size);
        if ("error" in reservation) throw new Error(reservation.error);
        await upload(reservation.pathname, file, {
          access: "private",
          handleUploadUrl: "/api/moment-audio-upload",
          contentType: reservation.contentType,
          onUploadProgress: ({ percentage }) => setAudioProgress(Math.round(percentage)),
        });
        const completed = await completeMomentAudioUpload(reservation.id);
        if ("error" in completed) throw new Error(completed.error);
        setDraft((current) => ({
          ...current,
          audioUploadId: reservation.id,
          attachmentNames: { ...current.attachmentNames, voice: file.name },
        }));
        setStatusMessage("Audio is ready to add.");
      }
    } catch (cause) {
      const message = cause instanceof Error
        ? cause.message
        : "The selected file could not be prepared. Please try again.";
      if (option.value === "photo") setPhotoError(message);
      if (option.value === "video") setVideoError(message);
      if (option.value === "voice") setAudioError(message);
      setStatusMessage(message);
    } finally {
      if (option.value === "photo") setIsPhotoPreparing(false);
      if (option.value === "video") setIsVideoUploading(false);
      if (option.value === "voice") setIsAudioUploading(false);
    }
  }

  async function saveDraft() {
    setIsSaving(true);
    try {
      const result = await saveMomentDraft(kind, draftId, draft);
      if ("error" in result) {
        setStatusMessage(result.error ?? "This draft could not be saved.");
      } else {
        setDraftId(result.draftId);
        setAccessCodeSaved(result.accessCodeSaved);
        setDraft((current) => ({ ...current, accessCode: "" }));
        setStatusMessage(
          "Draft saved to your account. Photos and Shared Moment videos and audio are kept.",
        );
      }
    } catch {
      setStatusMessage("We couldn’t save this draft. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function publishMoment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const result = await publishMomentAction(kind, draftId, draft);
      if ("error" in result) {
        setStatusMessage(result.error ?? "This moment could not be published.");
      } else {
        router.push("/dashboard?published=1");
      }
    } catch {
      setStatusMessage("We couldn’t publish this moment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const audienceLabel =
    audiences.find((audience) => audience.value === draft.audience)?.label ??
    "Connections Only";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]"
      />
      <div className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/create-moment"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          ← All Moment Types
        </Link>
        <header className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
            {momentConfig.icon} A story worth keeping
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-white sm:text-5xl">
            {momentConfig.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-serif text-lg leading-7 text-slate-300 sm:text-xl">
            {momentConfig.subtitle}
          </p>
        </header>

        <form
          onSubmit={publishMoment}
          className="mx-auto mt-9 max-w-3xl space-y-5 sm:mt-12"
        >
          <section aria-labelledby="story-heading" className={sectionClassName}>
            <StepHeading number="01" id="story-heading" title="Your Story" />
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="moment-title" className="block text-sm text-slate-300">
                  Moment Title
                </label>
                <input
                  id="moment-title"
                  required
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  placeholder="Give this moment a name"
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="moment-story" className="block text-sm text-slate-300">
                  Tell the story
                </label>
                <textarea
                  id="moment-story"
                  rows={5}
                  value={draft.story}
                  onChange={(event) => updateDraft("story", event.target.value)}
                  placeholder={momentConfig.prompt}
                  className={`${fieldClassName} py-3 leading-6`}
                />
              </div>
              <div>
                <label htmlFor="moment-tags" className="block text-sm text-slate-300">
                  Tags <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="moment-tags"
                  value={draft.tags}
                  onChange={(event) => updateDraft("tags", event.target.value)}
                  placeholder="Family, celebration, a day to remember..."
                  className={fieldClassName}
                />
              </div>
            </div>
          </section>

          <section aria-labelledby="content-heading" className={sectionClassName}>
            <StepHeading
              number="02"
              id="content-heading"
              title="Bring This Moment To Life"
            />
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Choose one or more ways to tell this story.
            </p>
            <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Choose moment content</legend>
              {contentOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[color:var(--nsg-accent)]/35 has-[:checked]:border-[color:var(--nsg-accent)]/60 has-[:checked]:bg-[color:var(--nsg-accent)]/[0.06]"
                >
                  <input
                    type="checkbox"
                    checked={draft.content.includes(option.value)}
                    disabled={(option.value === "photo" && isPhotoPreparing) ||
                      (option.value === "video" && (isVideoUploading ||
                        (kind !== "shared" && !draft.content.includes("video")))) ||
                      (option.value === "voice" && (isAudioUploading ||
                        (kind !== "shared" && !draft.content.includes("voice"))))}
                    onChange={() => toggleContent(option.value)}
                    className="h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
                  />
                  <span aria-hidden="true" className="text-xl">
                    {option.icon}
                  </span>
                  {option.label}
                  {(option.value === "video" || option.value === "voice") && kind !== "shared" && (
                    <span className="text-xs text-slate-400">(Shared Moments only)</span>
                  )}
                </label>
              ))}
            </fieldset>

            {contentOptions
              .filter(
                (option): option is (typeof contentOptions)[number] & {
                  value: MediaContentKind;
                } =>
                  option.value !== "written" &&
                  draft.content.includes(option.value),
              )
              .map((option) => (
                <div key={option.value} className="mt-4">
                  <label
                    htmlFor={`moment-${option.value}`}
                    className="block text-sm text-slate-300"
                  >
                    {option.icon} Add {option.value === "voice" ? "audio" : `a ${option.label.toLowerCase()}`}
                  </label>
                  <input
                    id={`moment-${option.value}`}
                    type="file"
                    accept={option.accept}
                    disabled={!isReady || isSaving ||
                      (option.value === "photo" && isPhotoPreparing) ||
                      (option.value === "video" && (isVideoUploading || kind !== "shared")) ||
                      (option.value === "voice" && (isAudioUploading || kind !== "shared"))}
                    onChange={(event) =>
                      void handleMediaSelection(option, event.currentTarget)
                    }
                    className="mt-2 block w-full cursor-pointer rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 text-sm text-slate-300 file:mr-4 file:min-h-12 file:border-0 file:bg-[color:var(--nsg-accent)]/15 file:px-4 file:font-medium file:text-[color:var(--nsg-accent-light)] hover:file:bg-[color:var(--nsg-accent)]/25"
                  />
                  {draft.attachmentNames[option.value] && (
                    <p className="mt-2 text-xs text-slate-400">
                      Selected: {draft.attachmentNames[option.value]}
                    </p>
                  )}
                  {option.value === "photo" && draft.photoData && (
                    <Image
                      src={draft.photoData}
                      alt="Selected moment photo"
                      width={1600}
                      height={1600}
                      unoptimized
                      className="mt-4 max-h-96 w-auto max-w-full rounded-xl object-contain"
                    />
                  )}
                  {option.value === "photo" && isPhotoPreparing && (
                    <p className="mt-2 text-xs text-slate-400" role="status">Preparing your photo…</p>
                  )}
                  {option.value === "photo" && photoError && (
                    <p className="mt-2 text-xs text-amber-300" role="alert">{photoError}</p>
                  )}
                  {option.value === "photo" && draft.attachmentNames.photo && !draft.photoData && (
                    <p className="mt-2 text-xs text-amber-300">
                      This older draft saved only the file name. Choose the photo again to include it.
                    </p>
                  )}
                  {option.value === "video" && kind === "shared" && (
                    <p className="mt-2 text-xs text-slate-400">MP4, MOV, or M4V, up to 100 MiB. Playback depends on your browser and video codec.</p>
                  )}
                  {option.value === "video" && isVideoUploading && (
                    <p className="mt-2 text-xs text-slate-400" role="status">Uploading video: {videoProgress}%</p>
                  )}
                  {option.value === "video" && videoError && (
                    <p className="mt-2 text-xs text-amber-300" role="alert">{videoError}</p>
                  )}
                  {option.value === "video" && kind === "shared" && draft.attachmentNames.video && !draft.videoUploadId && (
                    <p className="mt-2 text-xs text-amber-300">This older draft saved only the file name. Choose the video again to include it.</p>
                  )}
                  {option.value === "voice" && kind === "shared" && (
                    <p className="mt-2 text-xs text-slate-400">MP3, M4A, or WAV, up to 100 MiB. Playback depends on your browser and audio codec.</p>
                  )}
                  {option.value === "voice" && isAudioUploading && (
                    <p className="mt-2 text-xs text-slate-400" role="status">Uploading audio: {audioProgress}%</p>
                  )}
                  {option.value === "voice" && audioError && (
                    <p className="mt-2 text-xs text-amber-300" role="alert">{audioError}</p>
                  )}
                  {option.value === "voice" && draft.attachmentNames.voice && !draft.audioUploadId && (
                    <p className="mt-2 text-xs text-amber-300">
                      This older draft saved only the file name. {kind === "shared" ? "Choose the audio again to include it." : "Audio uploads are available for Shared Moments."}
                    </p>
                  )}
                </div>
              ))}

            {draft.content.includes("written") && (
              <div className="mt-4">
                <label
                  htmlFor="written-message"
                  className="block text-sm text-slate-300"
                >
                  ✍ Write a message to go with this moment
                </label>
                <textarea
                  id="written-message"
                  rows={4}
                  value={draft.writtenMessage}
                  onChange={(event) =>
                    updateDraft("writtenMessage", event.target.value)
                  }
                  placeholder="Write from the heart..."
                  className={`${fieldClassName} py-3 leading-6`}
                />
              </div>
            )}
          </section>

          <section aria-labelledby="purpose-heading" className={sectionClassName}>
            <StepHeading number="03" id="purpose-heading" title={purposeHeading(kind)} />
            {kind === "shared" && (
              <>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Choose who may share in this story. Your Legacy Controls™ still
                  guide what visitors can see.
                </p>
                <fieldset className="mt-5 space-y-3">
                  <legend className="sr-only">Who can view this shared moment?</legend>
                  {audiences.map((audience) => (
                    <label
                      key={audience.value}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[color:var(--nsg-accent)]/30"
                    >
                      <input
                        type="radio"
                        name="audience"
                        value={audience.value}
                        checked={draft.audience === audience.value}
                        onChange={() => updateDraft("audience", audience.value)}
                        className="h-4 w-4 accent-[color:var(--nsg-accent)]"
                      />
                      {audience.label}
                    </label>
                  ))}
                </fieldset>
              </>
            )}

            {kind === "personal" && (
              <>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  This Personal Moment stays protected. You may add an access
                  code as another layer of care.
                </p>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4">
                  <input
                    type="checkbox"
                    checked={draft.accessCodeRequired}
                    onChange={(event) =>
                      updateDraft("accessCodeRequired", event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)]"
                  />
                  <span className="text-sm font-medium text-white">
                    Require Access Code
                  </span>
                </label>
                {draft.accessCodeRequired && (
                  <div className="mt-4">
                    <label htmlFor="access-code" className="block text-sm text-slate-300">
                      Access Code
                    </label>
                    <input
                      id="access-code"
                      type="password"
                      autoComplete="new-password"
                      value={draft.accessCode}
                      onChange={(event) =>
                        updateDraft("accessCode", event.target.value)
                      }
                      placeholder={
                        accessCodeSaved
                          ? "Leave blank to keep your saved access code"
                          : "Create an access code"
                      }
                      className={fieldClassName}
                    />
                  </div>
                )}
              </>
            )}

            {kind === "cannot-open-until" && (
              <>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Choose when this message will be ready to open.
                </p>
                <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">Choose a release type</legend>
                  {[
                    { value: "date" as const, label: "A specific date" },
                    { value: "occasion" as const, label: "A special occasion" },
                  ].map((choice) => (
                    <label
                      key={choice.value}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4 text-sm text-white"
                    >
                      <input
                        type="radio"
                        name="release-kind"
                        checked={draft.releaseKind === choice.value}
                        onChange={() => updateDraft("releaseKind", choice.value)}
                        className="h-4 w-4 accent-[color:var(--nsg-accent)]"
                      />
                      {choice.label}
                    </label>
                  ))}
                </fieldset>
                {draft.releaseKind === "date" ? (
                  <div className="mt-4">
                    <label htmlFor="release-date" className="block text-sm text-slate-300">
                      Open Date
                    </label>
                    <input
                      id="release-date"
                      type="date"
                      value={draft.releaseDate}
                      onChange={(event) =>
                        updateDraft("releaseDate", event.target.value)
                      }
                      className={fieldClassName}
                    />
                  </div>
                ) : (
                  <div className="mt-4">
                    <label htmlFor="occasion" className="block text-sm text-slate-300">
                      Special Occasion
                    </label>
                    <select
                      id="occasion"
                      value={draft.occasion}
                      onChange={(event) =>
                        updateDraft("occasion", event.target.value)
                      }
                      className={fieldClassName}
                    >
                      {occasions.map((occasion) => (
                        <option key={occasion} value={occasion}>
                          {occasion}
                        </option>
                      ))}
                    </select>
                    {draft.occasion === "Custom Date" && (
                      <input
                        type="date"
                        aria-label="Custom occasion date"
                        value={draft.customOccasionDate}
                        onChange={(event) =>
                          updateDraft("customOccasionDate", event.target.value)
                        }
                        className={fieldClassName}
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {kind === "future-moment-maker" && (
              <>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Whose story are you beginning, and how are they connected to
                  your family?
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="recipient-name" className="block text-sm text-slate-300">
                      Recipient Name
                    </label>
                    <input
                      id="recipient-name"
                      value={draft.recipientName}
                      onChange={(event) =>
                        updateDraft("recipientName", event.target.value)
                      }
                      placeholder="e.g. Debbie Doe"
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label htmlFor="relationship" className="block text-sm text-slate-300">
                      Relationship
                    </label>
                    <input
                      id="relationship"
                      value={draft.relationship}
                      onChange={(event) =>
                        updateDraft("relationship", event.target.value)
                      }
                      placeholder="e.g. Daughter"
                      className={fieldClassName}
                    />
                  </div>
                </div>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4">
                  <input
                    type="checkbox"
                    checked={draft.createRecipient}
                    onChange={(event) =>
                      updateDraft("createRecipient", event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)]"
                  />
                  <span className="text-sm text-white">
                    This person does not have an account yet
                  </span>
                </label>
                {draft.createRecipient && (
                  <p className="mt-3 rounded-xl border border-[color:var(--nsg-accent)]/20 bg-[color:var(--nsg-accent)]/[0.05] p-4 text-sm leading-6 text-slate-300">
                    A Future Moment Maker™ profile will hold a place for their
                    story until they are ready to claim it.
                  </p>
                )}
              </>
            )}
          </section>

          <section aria-labelledby="save-heading" className={sectionClassName}>
            {familyPlaceholders.length > 0 && (
              <div className="mb-6">
                <label
                  htmlFor="family-placeholder"
                  className="block text-sm font-medium text-slate-200"
                >
                  Attach to a Family Placeholder{" "}
                  <span className="text-slate-500">(Optional)</span>
                </label>
                <select
                  id="family-placeholder"
                  value={draft.familyPlaceholderId}
                  onChange={(event) =>
                    updateDraft("familyPlaceholderId", event.target.value)
                  }
                  className={fieldClassName}
                >
                  <option value="">Do not attach to a placeholder</option>
                  {familyPlaceholders.map((placeholder) => (
                    <option key={placeholder.id} value={placeholder.id}>
                      {placeholder.name} · {placeholder.relationship}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  This written moment will be connected to the selected person
                  in your Legacy Tree™. Your existing audience and access
                  settings still apply.
                </p>
              </div>
            )}
            <StepHeading number="04" id="save-heading" title="Keep This Moment" />
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Save your progress or preview how this story will appear.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!isReady || isSaving || isPhotoPreparing || isVideoUploading || isAudioUploading}
                onClick={saveDraft}
                className={secondaryButtonClassName}
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className={secondaryButtonClassName}
              >
                Preview
              </button>
            </div>
            <p
              role="status"
              aria-live="polite"
              className="mt-4 min-h-6 text-sm text-[color:var(--nsg-accent-light)]"
            >
              {statusMessage}
            </p>
          </section>

          <button
            type="submit"
            disabled={!isReady || isSaving || isPhotoPreparing || isVideoUploading || isAudioUploading}
            className="min-h-14 w-full rounded-full bg-[color:var(--nsg-accent)] px-8 py-4 text-sm font-semibold tracking-wide text-[color:var(--nsg-background)] shadow-lg shadow-[color:var(--nsg-accent)]/10 transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] sm:text-base"
          >
            {isSaving ? "Saving..." : "Publish Moment"}
          </button>
        </form>

        <footer className="py-10 text-center">
          <p className="font-serif text-xl leading-relaxed text-white">
            Build it today.
            <br />
            Leave it forever.
          </p>
        </footer>
      </div>

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsPreviewOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="moment-preview-heading"
            className="my-auto w-full max-w-2xl rounded-3xl border border-[color:var(--nsg-accent)]/30 bg-[color:var(--nsg-background)] p-6 shadow-2xl shadow-black/50 sm:p-9"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--nsg-accent)]">
                  {momentConfig.icon} {momentConfig.title}
                </p>
                <h2
                  id="moment-preview-heading"
                  className="mt-2 font-serif text-2xl text-white sm:text-3xl"
                >
                  {draft.title || "Your Moment"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full border border-[color:var(--nsg-border)]/10 px-3 py-1 text-xl text-slate-300 transition hover:border-[color:var(--nsg-accent)]/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
              >
                ×
              </button>
            </div>
            <div className="mt-6 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 sm:p-7">
              <p className="whitespace-pre-wrap leading-7 text-slate-300">
                {draft.story || "Your story will appear here."}
              </p>
              {draft.content.includes("written") && draft.writtenMessage && (
                <p className="mt-5 whitespace-pre-wrap border-l-2 border-[color:var(--nsg-accent)]/50 pl-4 font-serif leading-7 text-white">
                  {draft.writtenMessage}
                </p>
              )}
              {draft.content.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {draft.content.map((contentType) => {
                    const content = contentOptions.find(
                      (option) => option.value === contentType,
                    );
                    const fileName =
                      contentType === "written"
                        ? undefined
                        : draft.attachmentNames[contentType];
                    return (
                      <span
                        key={contentType}
                        className="rounded-full border border-[color:var(--nsg-border)]/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
                      >
                        {content?.icon} {fileName || content?.label}
                      </span>
                    );
                  })}
                </div>
              )}
              {draft.tags.trim() && (
                <p className="mt-5 text-sm text-[color:var(--nsg-accent-light)]">{draft.tags}</p>
              )}
              <p className="mt-6 border-t border-[color:var(--nsg-border)]/10 pt-4 text-xs text-slate-500">
                {kind === "shared" && `Shared with: ${audienceLabel}`}
                {kind === "personal" &&
                  `Personal Moment${draft.accessCodeRequired ? " · Access code protected" : " · Private"}`}
                {kind === "cannot-open-until" &&
                  `Cannot Open Until™ · ${
                    draft.releaseKind === "date"
                      ? draft.releaseDate || "Choose an open date"
                      : draft.occasion === "Custom Date"
                        ? draft.customOccasionDate || "Choose a custom date"
                        : draft.occasion
                  }`}
                {kind === "future-moment-maker" &&
                  `For ${draft.recipientName || "your Future Moment Maker™"}${
                    draft.relationship ? ` · ${draft.relationship}` : ""
                  }`}
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className={secondaryButtonClassName}
              >
                Return To Editing
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function purposeHeading(kind: MomentKind) {
  switch (kind) {
    case "shared":
      return "Choose Your Audience";
    case "personal":
      return "Protect This Memory";
    case "cannot-open-until":
      return "Choose When It Opens";
    case "future-moment-maker":
      return "Who Is This Moment For?";
  }
}

function StepHeading({
  number,
  id,
  title,
}: {
  number: string;
  id: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--nsg-accent)]/35 bg-[color:var(--nsg-accent)]/10 text-xs font-semibold tracking-wide text-[color:var(--nsg-accent-light)]"
      >
        {number}
      </span>
      <h2 id={id} className="pt-1 font-serif text-xl text-white sm:text-2xl">
        {title}
      </h2>
    </div>
  );
}
