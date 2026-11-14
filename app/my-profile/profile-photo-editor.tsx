"use client";

import NextImage from "next/image";
import { useRef, useState, useTransition } from "react";
import { saveProfilePhoto } from "@/app/actions/profile";

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

export default function ProfilePhotoEditor({
  initialPhoto,
}: {
  initialPhoto: string | null;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(initialPhoto);
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
    setPhotoData(null);

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

  function handleSave() {
    if (!photoData || isSaving) return;
    const formData = new FormData();
    formData.set("photoData", photoData);
    setError(null);
    setMessage(null);

    startSaving(async () => {
      try {
        const result = await saveProfilePhoto(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        setPhotoData(null);
        setMessage(result.success ?? "Your profile photo has been saved.");
      } catch {
        setError("Your profile photo could not be saved. Please try again.");
      }
    });
  }

  return (
    <>
      {preview ? (
        <NextImage
          src={preview}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1280px) calc(100vw - 4rem), 1152px"
          className="z-0 object-cover object-center"
        />
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 160 160"
          fill="none"
          className="absolute left-1/2 top-1/2 z-0 h-48 w-48 -translate-x-1/2 -translate-y-1/2 text-[#D8A35B]/20 sm:h-56 sm:w-56"
        >
          <circle cx="80" cy="52" r="30" fill="currentColor" />
          <path
            d="M25 145c4-33 25-51 55-51s51 18 55 51"
            fill="currentColor"
          />
        </svg>
      )}
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        aria-label="Upload Profile Photo"
        title="Upload Profile Photo"
        className="group absolute bottom-5 left-1/2 z-20 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-[#D8A35B] bg-[#0F172A]/90 text-[#f0c98e] shadow-lg shadow-black/40 backdrop-blur transition hover:scale-105 hover:bg-[#D8A35B] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
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
      {photoData && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="absolute bottom-6 left-[calc(50%+2.5rem)] z-20 rounded-full border border-[#D8A35B] bg-[#0F172A]/90 px-4 py-2 text-xs font-semibold text-[#f0c98e] shadow-lg backdrop-blur transition hover:bg-[#D8A35B] hover:text-[#0F172A] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          {isSaving ? "Saving…" : "Save Photo"}
        </button>
      )}
      {(error || message) && (
        <p
          role={error ? "alert" : "status"}
          className={`absolute bottom-[4.5rem] left-1/2 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border px-3 py-2 text-center text-xs shadow-lg backdrop-blur ${
            error
              ? "border-red-300/30 bg-[#0F172A]/95 text-red-200"
              : "border-[#D8A35B]/30 bg-[#0F172A]/95 text-[#f0c98e]"
          }`}
        >
          {error ?? message}
        </p>
      )}
    </>
  );
}
