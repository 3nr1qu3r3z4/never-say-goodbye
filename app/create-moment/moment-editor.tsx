"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loadMomentDraft,
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
import { isHeicFile, toSupportedImage } from "@/lib/convert-image";

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
  { value: "video", icon: "🎥", label: "Video", accept: "video/*" },
  { value: "voice", icon: "🎤", label: "Voice Recording", accept: "audio/*" },
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
    subtitle: "Send a message forward to a day or milestone that matters.",
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
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";
const sectionClassName =
  "rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7";
const secondaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-[#D8A35B]/60 px-6 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]";

export default function MomentEditor({ kind }: { kind: MomentKind }) {
  const router = useRouter();
  const [draft, setDraft] = useState<MomentDraft>(initialMomentDraft);
  const [draftId, setDraftId] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [accessCodeSaved, setAccessCodeSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  function updateDraft<Key extends keyof MomentDraft>(
    key: Key,
    value: MomentDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatusMessage("");
  }

  function toggleContent(content: ContentKind) {
    setDraft((current) => ({
      ...current,
      content: current.content.includes(content)
        ? current.content.filter((item) => item !== content)
        : [...current.content, content],
    }));
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
      if (option.value === "photo" && (await isHeicFile(file))) {
        setStatusMessage("Preparing your iPhone photo…");
        const supportedFile = await toSupportedImage(file);
        updateDraft("attachmentNames", {
          ...draft.attachmentNames,
          [option.value]: supportedFile.name,
        });
        setStatusMessage("iPhone photo is ready to add.");
        return;
      }

      updateDraft("attachmentNames", {
        ...draft.attachmentNames,
        [option.value]: file.name,
      });
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error
          ? cause.message
          : "This photo could not be prepared. Please try another image.",
      );
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
          "Draft saved to your account. Choose local files again when you return.",
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
    <main className="relative min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
      />
      <div className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/create-moment"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          ← All Moment Types
        </Link>
        <header className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
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
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[#D8A35B]/35 has-[:checked]:border-[#D8A35B]/60 has-[:checked]:bg-[#D8A35B]/[0.06]"
                >
                  <input
                    type="checkbox"
                    checked={draft.content.includes(option.value)}
                    onChange={() => toggleContent(option.value)}
                    className="h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                  />
                  <span aria-hidden="true" className="text-xl">
                    {option.icon}
                  </span>
                  {option.label}
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
                    {option.icon} Add a {option.label.toLowerCase()}
                  </label>
                  <input
                    id={`moment-${option.value}`}
                    type="file"
                    accept={option.accept}
                    onChange={(event) =>
                      void handleMediaSelection(option, event.currentTarget)
                    }
                    className="mt-2 block w-full cursor-pointer rounded-xl border border-white/10 bg-slate-950/50 text-sm text-slate-300 file:mr-4 file:min-h-12 file:border-0 file:bg-[#D8A35B]/15 file:px-4 file:font-medium file:text-[#f0c98e] hover:file:bg-[#D8A35B]/25"
                  />
                  {draft.attachmentNames[option.value] && (
                    <p className="mt-2 text-xs text-slate-400">
                      Selected: {draft.attachmentNames[option.value]}
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
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[#D8A35B]/30"
                    >
                      <input
                        type="radio"
                        name="audience"
                        value={audience.value}
                        checked={draft.audience === audience.value}
                        onChange={() => updateDraft("audience", audience.value)}
                        className="h-4 w-4 accent-[#D8A35B]"
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
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <input
                    type="checkbox"
                    checked={draft.accessCodeRequired}
                    onChange={(event) =>
                      updateDraft("accessCodeRequired", event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[#D8A35B]"
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
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white"
                    >
                      <input
                        type="radio"
                        name="release-kind"
                        checked={draft.releaseKind === choice.value}
                        onChange={() => updateDraft("releaseKind", choice.value)}
                        className="h-4 w-4 accent-[#D8A35B]"
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
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <input
                    type="checkbox"
                    checked={draft.createRecipient}
                    onChange={(event) =>
                      updateDraft("createRecipient", event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[#D8A35B]"
                  />
                  <span className="text-sm text-white">
                    This person does not have an account yet
                  </span>
                </label>
                {draft.createRecipient && (
                  <p className="mt-3 rounded-xl border border-[#D8A35B]/20 bg-[#D8A35B]/[0.05] p-4 text-sm leading-6 text-slate-300">
                    A Future Moment Maker™ profile will hold a place for their
                    story until they are ready to claim it.
                  </p>
                )}
              </>
            )}
          </section>

          <section aria-labelledby="save-heading" className={sectionClassName}>
            <StepHeading number="04" id="save-heading" title="Keep This Moment" />
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Save your progress or preview how this story will appear.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!isReady || isSaving}
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
              className="mt-4 min-h-6 text-sm text-[#f0c98e]"
            >
              {statusMessage}
            </p>
          </section>

          <button
            type="submit"
            disabled={isSaving}
            className="min-h-14 w-full rounded-full bg-[#D8A35B] px-8 py-4 text-sm font-semibold tracking-wide text-[#0F172A] shadow-lg shadow-[#D8A35B]/10 transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] sm:text-base"
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
            className="my-auto w-full max-w-2xl rounded-3xl border border-[#D8A35B]/30 bg-[#0F172A] p-6 shadow-2xl shadow-black/50 sm:p-9"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8A35B]">
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
                className="rounded-full border border-white/10 px-3 py-1 text-xl text-slate-300 transition hover:border-[#D8A35B]/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
              >
                ×
              </button>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
              <p className="whitespace-pre-wrap leading-7 text-slate-300">
                {draft.story || "Your story will appear here."}
              </p>
              {draft.content.includes("written") && draft.writtenMessage && (
                <p className="mt-5 whitespace-pre-wrap border-l-2 border-[#D8A35B]/50 pl-4 font-serif leading-7 text-white">
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
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
                      >
                        {content?.icon} {fileName || content?.label}
                      </span>
                    );
                  })}
                </div>
              )}
              {draft.tags.trim() && (
                <p className="mt-5 text-sm text-[#f0c98e]">{draft.tags}</p>
              )}
              <p className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-500">
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8A35B]/35 bg-[#D8A35B]/10 text-xs font-semibold tracking-wide text-[#f0c98e]"
      >
        {number}
      </span>
      <h2 id={id} className="pt-1 font-serif text-xl text-white sm:text-2xl">
        {title}
      </h2>
    </div>
  );
}
