"use client";

import NextImage from "next/image";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { saveProfile } from "@/app/actions/profile";

const maxPhotoBytes = 640 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

function createWebpPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const sourceUrl = URL.createObjectURL(file);

    image.onload = async () => {
      URL.revokeObjectURL(sourceUrl);
      try {
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        const scale = Math.min(1, 1400 / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Image preview is unavailable.");
          context.drawImage(image, 0, 0, width, height);

          for (const quality of [0.84, 0.74, 0.64, 0.54]) {
            const blob = await new Promise<Blob | null>((done) =>
              canvas.toBlob(done, "image/webp", quality),
            );
            if (!blob) throw new Error("This image could not be optimized.");
            if (blob.size <= maxPhotoBytes) {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== "string") {
                  reject(new Error("This image could not be previewed."));
                  return;
                }
                resolve(reader.result);
              };
              reader.onerror = () =>
                reject(new Error("This image could not be previewed."));
              reader.readAsDataURL(blob);
              return;
            }
          }

          width = Math.max(1, Math.round(width * 0.8));
          height = Math.max(1, Math.round(height * 0.8));
        }

        throw new Error("This image is too large to save. Choose a smaller image.");
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error("This image could not be opened."));
    };
    image.src = sourceUrl;
  });
}

type ProfileEditorProps = {
  displayName: string;
  bio: string;
  location: string;
  personalMotto: string;
  profilePhoto: string | null;
};

const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

export default function ProfileEditor({
  displayName,
  bio,
  location,
  personalMotto,
  profilePhoto,
}: ProfileEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(profilePhoto);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError(null);
    setMessage(null);

    if (!acceptedTypes.includes(file.type)) {
      setError("Choose a JPG, PNG, or WEBP image.");
      input.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("Choose an image smaller than 20 MB.");
      input.value = "";
      return;
    }

    try {
      const data = await createWebpPreview(file);
      setPreview(data);
      setPhotoData(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This image could not be previewed. Please try another.",
      );
    }

    input.value = "";
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const formData = new FormData(event.currentTarget);
    if (photoData) formData.set("photoData", photoData);
    setError(null);
    setMessage(null);

    startSaving(async () => {
      try {
        const result = await saveProfile(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        setPhotoData(null);
        setMessage(result.success ?? "Your profile has been saved.");
      } catch {
        setError("Your profile could not be saved. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <section aria-labelledby="profile-photo-heading">
        <h2
          id="profile-photo-heading"
          className="font-serif text-xl text-white sm:text-2xl"
        >
          Profile Photo
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Choose a photo that helps your family recognize you.
        </p>
        <div className="relative mt-5 h-72 overflow-hidden rounded-2xl border border-[#D8A35B]/30 bg-gradient-to-br from-[#344255] via-[#172437] to-[#101827] sm:h-96">
          {preview ? (
            <NextImage
              src={preview}
              alt={`${displayName} profile preview`}
              fill
              unoptimized
              sizes="(max-width: 640px) calc(100vw - 3rem), 768px"
              className="object-cover object-center"
            />
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 160 160"
              fill="none"
              className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 text-[#D8A35B]/25 sm:h-56 sm:w-56"
            >
              <circle cx="80" cy="52" r="30" fill="currentColor" />
              <path
                d="M25 145c4-33 25-51 55-51s51 18 55 51"
                fill="currentColor"
              />
            </svg>
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 via-transparent to-transparent"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Upload Profile Photo"
            title="Upload Profile Photo"
            className="group absolute bottom-4 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-[#D8A35B] bg-[#0F172A]/90 text-[#f0c98e] shadow-lg shadow-black/40 backdrop-blur transition hover:scale-105 hover:bg-[#D8A35B] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4v-10Z"
              />
              <circle cx="12" cy="13.5" r="3.25" />
            </svg>
            <span className="pointer-events-none absolute bottom-full mb-3 whitespace-nowrap rounded-lg border border-[#D8A35B]/30 bg-[#0F172A] px-3 py-2 text-xs font-medium text-white opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-visible:opacity-100">
              Upload Profile Photo
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Choose a JPG, PNG, or WEBP profile photo"
          />
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-200 sm:col-span-2">
          Display Name
          <input
            name="displayName"
            defaultValue={displayName}
            required
            maxLength={120}
            autoComplete="name"
            className={inputClassName}
          />
        </label>
        <label className="text-sm font-medium text-slate-200 sm:col-span-2">
          Bio
          <textarea
            name="bio"
            defaultValue={bio}
            maxLength={1000}
            rows={5}
            className={`${inputClassName} resize-y py-3`}
          />
        </label>
        <label className="text-sm font-medium text-slate-200">
          Location <span className="text-slate-500">(Optional)</span>
          <input
            name="location"
            defaultValue={location}
            maxLength={120}
            autoComplete="address-level2"
            className={inputClassName}
          />
        </label>
        <label className="text-sm font-medium text-slate-200">
          Personal Motto <span className="text-slate-500">(Optional)</span>
          <input
            name="personalMotto"
            defaultValue={personalMotto}
            maxLength={240}
            className={inputClassName}
          />
        </label>
      </div>

      <div aria-live="polite" className="min-h-5">
        {error && <p className="text-sm text-red-200">{error}</p>}
        {message && <p className="text-sm text-[#f0c98e]">{message}</p>}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#D8A35B] px-7 py-3 text-sm font-semibold text-[#0F172A] shadow-lg shadow-[#D8A35B]/10 transition hover:bg-[#e6b66f] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          {isSaving ? "Saving…" : "Save Profile"}
        </button>
        <Link
          href="/my-profile/preview"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-[#D8A35B]/60 px-7 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          Preview My Profile
        </Link>
      </div>
    </form>
  );
}
