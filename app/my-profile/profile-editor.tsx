"use client";

import NextImage from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { saveProfile, saveProfilePhoto } from "@/app/actions/profile";
import { isHeicFile, toSupportedImage } from "@/lib/convert-image";

const maxPhotoBytes = 640 * 1024;
const acceptedTypes = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
];
const cropOutputSize = 512;
const mottoCharacterLimit = 120;
const locationSuggestions = [
  "Lakeside",
  "San Diego, California",
  "Los Angeles, California",
  "San Francisco, California",
  "Phoenix, Arizona",
  "Denver, Colorado",
  "Miami, Florida",
  "Orlando, Florida",
  "Atlanta, Georgia",
  "Chicago, Illinois",
  "Boston, Massachusetts",
  "Detroit, Michigan",
  "Minneapolis, Minnesota",
  "Las Vegas, Nevada",
  "New York, New York",
  "Charlotte, North Carolina",
  "Portland, Oregon",
  "Philadelphia, Pennsylvania",
  "Nashville, Tennessee",
  "Austin, Texas",
  "Dallas, Texas",
  "Houston, Texas",
  "Seattle, Washington",
  "Washington, D.C.",
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

type CropOffset = { x: number; y: number };
type ImageDimensions = { width: number; height: number };

function constrainOffset(
  offset: CropOffset,
  dimensions: ImageDimensions,
  frameSize: number,
  zoom: number,
): CropOffset {
  const scale =
    (Math.max(frameSize / dimensions.width, frameSize / dimensions.height) *
      zoom);
  const maxX = Math.max(0, (dimensions.width * scale - frameSize) / 2);
  const maxY = Math.max(0, (dimensions.height * scale - frameSize) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  };
}

function createCroppedPhoto(
  image: HTMLImageElement,
  dimensions: ImageDimensions,
  offset: CropOffset,
  frameSize: number,
  zoom: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const scale =
      Math.max(frameSize / dimensions.width, frameSize / dimensions.height) *
      zoom;
    const sourceSize = frameSize / scale;
    const centerX = dimensions.width / 2 - offset.x / scale;
    const centerY = dimensions.height / 2 - offset.y / scale;
    const sourceX = Math.max(
      0,
      Math.min(dimensions.width - sourceSize, centerX - sourceSize / 2),
    );
    const sourceY = Math.max(
      0,
      Math.min(dimensions.height - sourceSize, centerY - sourceSize / 2),
    );
    const canvas = document.createElement("canvas");
    canvas.width = cropOutputSize;
    canvas.height = cropOutputSize;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Photo cropping is unavailable in this browser."));
      return;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      cropOutputSize,
      cropOutputSize,
    );
    const readBlob = (blob: Blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("The cropped photo could not be read."));
      };
      reader.onerror = () =>
        reject(new Error("The cropped photo could not be read."));
      reader.readAsDataURL(blob);
    };

    const encodeJpeg = (quality: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.type !== "image/jpeg") {
            reject(new Error("This browser could not prepare the cropped photo."));
            return;
          }
          if (blob.size <= maxPhotoBytes) {
            readBlob(blob);
          } else if (quality > 0.3) {
            encodeJpeg(Math.max(0.3, quality - 0.1));
          } else {
            reject(new Error("This photo is too large to save."));
          }
        },
        "image/jpeg",
        quality,
      );
    };

    const encodeWebp = (quality: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("The cropped photo could not be prepared."));
            return;
          }
          if (blob.type !== "image/webp") {
            encodeJpeg(0.85);
          } else if (blob.size <= maxPhotoBytes) {
            readBlob(blob);
          } else if (quality > 0.45) {
            encodeWebp(quality - 0.1);
          } else {
            encodeJpeg(0.85);
          }
        },
        "image/webp",
        quality,
      );
    };

    encodeWebp(0.85);
  });
}

type ProfileEditorProps = {
  displayName: string;
  descriptorOne: string;
  descriptorTwo: string;
  descriptorThree: string;
  bio: string;
  location: string;
  personalMotto: string;
  profilePhoto: string | null;
};

const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

export default function ProfileEditor({
  displayName,
  descriptorOne,
  descriptorTwo,
  descriptorThree,
  bio,
  location,
  personalMotto,
  profilePhoto,
}: ProfileEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cropFrame = useRef<HTMLDivElement>(null);
  const sourceImage = useRef<HTMLImageElement>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    offset: CropOffset;
  } | null>(null);
  const [preview, setPreview] = useState(profilePhoto);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [cropFrameSize, setCropFrameSize] = useState(0);
  const [isPhotoPreparing, setIsPhotoPreparing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageVisible, setMessageVisible] = useState(false);
  const [motto, setMotto] = useState(personalMotto);
  const [isSaving, startSaving] = useTransition();
  const [isPhotoSaving, startPhotoSaving] = useTransition();

  useEffect(() => {
    if (!message) return;
    const fadeTimeout = window.setTimeout(
      () => setMessageVisible(false),
      3600,
    );
    const clearTimeoutId = window.setTimeout(() => setMessage(null), 4100);
    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [message]);

  function showMessage(nextMessage: string) {
    setMessageVisible(true);
    setMessage(nextMessage);
  }

  useEffect(
    () => () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!sourceUrl || !cropFrame.current) return;
    const frame = cropFrame.current;
    const observer = new ResizeObserver((entries) => {
      setCropFrameSize(entries[0]?.contentRect.width ?? frame.clientWidth);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [sourceUrl]);

  function releaseSource() {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = null;
    setSourceUrl(null);
    setDimensions(null);
    setCropFrameSize(0);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  }

  function cancelPhotoEdit() {
    if (isPhotoSaving) return;
    releaseSource();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError(null);
    setMessage(null);

    const mimeType = file.type.toLowerCase();
    const supportedExtension = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (
      !acceptedTypes.includes(mimeType) &&
      !supportedExtension &&
      !(await isHeicFile(file))
    ) {
      setError("Choose a JPG, JPEG, PNG, WEBP, HEIC, or HEIF image.");
      input.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Choose an image smaller than 20 MB.");
      input.value = "";
      return;
    }

    input.value = "";
    setIsPhotoPreparing(true);
    try {
      const supportedFile = await toSupportedImage(file);
      const supportedMimeType = supportedFile.type.toLowerCase();
      if (
        !acceptedTypes.includes(supportedMimeType) &&
        !/\.(jpe?g|png|webp)$/i.test(supportedFile.name)
      ) {
        throw new Error("Choose a JPG, JPEG, PNG, WEBP, HEIC, or HEIF image.");
      }
      const nextSource = URL.createObjectURL(supportedFile);
      const image = new window.Image();
      image.onload = () => {
        if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
        sourceUrlRef.current = nextSource;
        setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
        setOffset({ x: 0, y: 0 });
        setZoom(1);
        setSourceUrl(nextSource);
        setIsPhotoPreparing(false);
      };
      image.onerror = () => {
        URL.revokeObjectURL(nextSource);
        setError("This image could not be opened.");
        setIsPhotoPreparing(false);
      };
      image.src = nextSource;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This photo could not be prepared. Please try another image.",
      );
      setIsPhotoPreparing(false);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dimensions || !cropFrame.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offset,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart.current || !dimensions || !cropFrame.current) return;
    const start = dragStart.current;
    setOffset(
      constrainOffset(
        {
          x: start.offset.x + event.clientX - start.pointerX,
          y: start.offset.y + event.clientY - start.pointerY,
        },
        dimensions,
        cropFrame.current.clientWidth,
        zoom,
      ),
    );
  }

  function handleZoomChange(value: number) {
    setZoom(value);
    if (!dimensions || !cropFrame.current) return;
    setOffset((current) =>
      constrainOffset(
        current,
        dimensions,
        cropFrameSize,
        value,
      ),
    );
  }

  function handleSaveCroppedPhoto() {
    const image = sourceImage.current;
    if (!image || !dimensions || cropFrameSize <= 0) return;
    setError(null);
    setMessage(null);
    const imageDimensions = dimensions;
    const cropOffset = offset;
    const frameSize = cropFrameSize;
    const cropZoom = zoom;

    startPhotoSaving(async () => {
      try {
        const crop = await createCroppedPhoto(
          image,
          imageDimensions,
          cropOffset,
          frameSize,
          cropZoom,
        );
        const result = await saveProfilePhoto(crop);
        if (result.error) {
          setError(result.error);
          return;
        }
        setPreview(crop);
        showMessage(result.success ?? "Your profile photo has been saved.");
        releaseSource();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The cropped profile photo could not be saved.",
        );
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const formData = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);

    startSaving(async () => {
      try {
        const result = await saveProfile(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        showMessage(result.success ?? "Your profile has been saved.");
      } catch {
        setError("Your profile could not be saved. Please try again.");
      }
    });
  }

  const displayScale =
    dimensions && cropFrameSize > 0
      ? Math.max(
          cropFrameSize / dimensions.width,
          cropFrameSize / dimensions.height,
        ) * zoom
      : 1;

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
        <div className="group relative mx-auto mt-5 aspect-square w-full max-w-[32rem] overflow-hidden rounded-2xl border border-[#D8A35B]/30 bg-gradient-to-br from-[#344255] via-[#172437] to-[#101827]">
          {preview ? (
            <NextImage
              src={preview}
              alt={`${displayName} profile preview`}
              fill
              unoptimized
              sizes="(max-width: 640px) calc(100vw - 3rem), 512px"
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
            disabled={isPhotoPreparing}
            className="absolute bottom-4 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-[#D8A35B] bg-[#0F172A]/90 text-[#f0c98e] shadow-lg shadow-black/40 backdrop-blur transition hover:scale-105 hover:bg-[#D8A35B] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] disabled:cursor-wait disabled:opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
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
              {isPhotoPreparing ? "Preparing Photo…" : "Upload Profile Photo"}
            </span>
          </button>
          {isPhotoPreparing && (
            <p
              role="status"
              className="absolute inset-x-0 bottom-20 z-10 text-center text-sm text-white"
            >
              Preparing your photo…
            </p>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Choose a JPG, JPEG, PNG, WEBP, HEIC, or HEIF profile photo"
          />
        </div>
      </section>

      <div className="space-y-6">
        <label className="block text-sm font-medium text-slate-200">
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

        <fieldset>
          <legend className="text-sm font-medium text-slate-200">
            Three Words That Describe You
          </legend>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Share a few words that reflect who you are.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { name: "descriptorOne", label: "1", value: descriptorOne },
              { name: "descriptorTwo", label: "2", value: descriptorTwo },
              {
                name: "descriptorThree",
                label: "3",
                value: descriptorThree,
              },
            ].map((descriptor) => (
              <div key={descriptor.name}>
                <label
                  htmlFor={descriptor.name}
                  className="mb-1 block text-xs font-medium text-slate-400"
                >
                  {descriptor.label}
                </label>
                <input
                  id={descriptor.name}
                  name={descriptor.name}
                  defaultValue={descriptor.value}
                  maxLength={40}
                  placeholder={descriptor.label}
                  aria-label={descriptor.label}
                  className={`${inputClassName} mt-0 rounded-full border-[#D8A35B]/25 bg-[#D8A35B]/[0.06] text-center font-serif text-base placeholder:font-sans placeholder:text-slate-500`}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-medium text-slate-200">
          Bio
          <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
            Share a brief introduction, background, story, or personal philosophy.
          </span>
          <textarea
            name="bio"
            defaultValue={bio}
            maxLength={1000}
            rows={2}
            className={`${inputClassName} resize-y py-3`}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-200">
            Location <span className="text-slate-500">(Optional)</span>
            <input
              name="location"
              defaultValue={location}
              maxLength={120}
              autoComplete="address-level2"
            list="profile-location-suggestions"
            placeholder="City, State"
            className={inputClassName}
          />
          <datalist id="profile-location-suggestions">
            {locationSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>
        <label className="text-sm font-medium text-slate-200">
          Personal Motto <span className="text-slate-500">(Optional)</span>
          <input
            name="personalMotto"
            value={motto}
            onChange={(event) => setMotto(event.currentTarget.value)}
            maxLength={mottoCharacterLimit}
            className={inputClassName}
          />
          <span
            aria-live="polite"
            className="mt-1 block text-right text-xs text-slate-500"
          >
            {motto.length} / {mottoCharacterLimit}
          </span>
        </label>
        </div>
      </div>

      <div aria-live="polite" className="min-h-5">
        {error && <p className="text-sm text-red-200">{error}</p>}
        {message && (
        <p
          className={`text-sm text-[#f0c98e] transition-opacity duration-500 ${
            messageVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {message}
        </p>
        )}
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

      {sourceUrl && dimensions && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#020617]/85 p-4 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cancelPhotoEdit();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-editor-title"
            className="my-auto w-full max-w-2xl rounded-3xl border border-[#D8A35B]/25 bg-[#0F172A] p-5 shadow-2xl shadow-black/50 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#D8A35B]">
                  Profile Photo
                </p>
                <h2
                  id="photo-editor-title"
                  className="mt-2 font-serif text-2xl text-white sm:text-3xl"
                >
                  Adjust Your Photo
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Drag to position, then adjust the zoom for a square crop.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelPhotoEdit}
                aria-label="Cancel photo editing"
                className="rounded-full border border-white/10 px-3 py-2 text-slate-300 transition hover:border-[#D8A35B]/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Crop Preview
                </p>
                <div
                  ref={cropFrame}
                  className="relative mx-auto aspect-square w-full max-w-[26rem] touch-none cursor-grab overflow-hidden rounded-xl border border-[#D8A35B]/50 bg-slate-950 active:cursor-grabbing"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={() => {
                    dragStart.current = null;
                  }}
                  onPointerCancel={() => {
                    dragStart.current = null;
                  }}
                >
                  <NextImage
                    ref={sourceImage}
                    src={sourceUrl}
                    alt="Drag to reposition your profile photo"
                    width={Math.ceil(dimensions.width * displayScale)}
                    height={Math.ceil(dimensions.height * displayScale)}
                    unoptimized
                    className="pointer-events-none absolute max-w-none select-none"
                    style={{
                      width: dimensions.width * displayScale,
                      height: dimensions.height * displayScale,
                      left: `calc(50% + ${offset.x}px)`,
                      top: `calc(50% + ${offset.y}px)`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 sm:flex-col">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-[#D8A35B]/40">
                  <div
                    className="relative aspect-square touch-none overflow-hidden"
                    aria-label="Square crop result preview"
                  >
                    <NextImage
                      src={sourceUrl}
                      alt=""
                      width={Math.ceil(
                        dimensions.width *
                          displayScale *
                          (112 / (cropFrameSize || 112)),
                      )}
                      height={Math.ceil(
                        dimensions.height *
                          displayScale *
                          (112 / (cropFrameSize || 112)),
                      )}
                      unoptimized
                      className="pointer-events-none absolute max-w-none select-none"
                      style={{
                        width: dimensions.width * displayScale *
                          (112 / (cropFrameSize || 112)),
                        height: dimensions.height * displayScale *
                          (112 / (cropFrameSize || 112)),
                        left: `calc(50% + ${offset.x * (112 / (cropFrameSize || 112))}px)`,
                        top: `calc(50% + ${offset.y * (112 / (cropFrameSize || 112))}px)`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  </div>
                </div>
                <label className="flex-1 text-sm text-slate-300 sm:w-full">
                  Zoom
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={zoom}
                    onChange={(event) =>
                      handleZoomChange(Number(event.currentTarget.value))
                    }
                    className="mt-3 w-full accent-[#D8A35B]"
                    aria-label="Zoom profile photo"
                  />
                  <span className="mt-1 flex justify-between text-xs text-slate-500">
                    <span>Fit</span>
                    <span>{zoom.toFixed(1)}×</span>
                    <span>Zoom</span>
                  </span>
                </label>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-200">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                disabled={isPhotoSaving}
                className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-[#D8A35B]/50 hover:text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
              >
                Reset
              </button>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={cancelPhotoEdit}
                  disabled={isPhotoSaving}
                  className="min-h-11 rounded-full border border-[#D8A35B]/50 px-5 py-2.5 text-sm font-semibold text-[#f0c98e] transition hover:bg-[#D8A35B]/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCroppedPhoto}
                  disabled={isPhotoSaving}
                  className="min-h-11 rounded-full bg-[#D8A35B] px-6 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-[#e6b66f] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
                >
                  {isPhotoSaving ? "Saving…" : "Save Photo"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}
