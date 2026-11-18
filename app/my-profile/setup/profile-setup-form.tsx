"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveProfileSetup } from "@/app/actions/profile";

export type ProfileSetup = {
  displayName: string;
  discoverability: "private" | "searchable" | "public";
  descriptorOne: string;
  descriptorTwo: string;
  descriptorThree: string;
  birthplace: string;
  location: string;
  personalMotto: string;
};

const fieldClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

const visibilityOptions = [
  {
    value: "private",
    label: "Private",
    description: "Only approved connections can find me.",
  },
  {
    value: "searchable",
    label: "Searchable",
    description: "People may find my profile, but access depends on my visibility settings.",
  },
  {
    value: "public",
    label: "Public",
    description: "People may find my profile and view content I have chosen to make public.",
  },
] as const;

export default function ProfileSetupForm({ profile }: { profile: ProfileSetup }) {
  const [status, setStatus] = useState<{ error?: string; success?: string }>({});
  const [isSaving, startSaving] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const formData = new FormData(event.currentTarget);
    setStatus({});
    startSaving(async () => {
      try {
        setStatus(await saveProfileSetup(formData));
      } catch {
        setStatus({ error: "Your profile setup could not be saved. Please try again." });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <label className="block text-sm font-medium text-slate-200">
        Display Name
        <input name="displayName" defaultValue={profile.displayName} required maxLength={120} autoComplete="name" className={fieldClassName} />
      </label>

      <fieldset>
        <legend className="font-serif text-xl text-white">Discoverability</legend>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Profile Visibility controls whether other people can find your profile.
          Your other Legacy Controls™ determine what they can see.
        </p>
        <div className="mt-4 space-y-3">
          {visibilityOptions.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[#D8A35B]/30">
              <input
                type="radio"
                name="discoverability"
                value={option.value}
                defaultChecked={profile.discoverability === option.value}
                required
                className="mt-1 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-1 block leading-6 text-slate-400">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
        <Link href="/legacy-controls" className="mt-3 inline-block text-sm text-[#f0c98e] underline decoration-[#D8A35B]/40 underline-offset-4 hover:text-white">
          Review other Legacy Controls™
        </Link>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-slate-200">Three Words That Describe You</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {([
            ["descriptorOne", "First word", profile.descriptorOne],
            ["descriptorTwo", "Second word", profile.descriptorTwo],
            ["descriptorThree", "Third word", profile.descriptorThree],
          ] as const).map(([name, label, value]) => (
            <label key={name} className="block text-xs text-slate-400">
              {label}
              <input name={name} defaultValue={value} maxLength={40} className={fieldClassName} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-200">
          Birthplace <span className="text-slate-500">(Optional)</span>
          <input name="birthplace" defaultValue={profile.birthplace} maxLength={120} placeholder="City, State" className={fieldClassName} />
          <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
            Control public visibility in Legacy Controls™.
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-200">
          Current Location <span className="text-slate-500">(Optional)</span>
          <input name="location" defaultValue={profile.location} maxLength={120} autoComplete="address-level2" placeholder="City, State" className={fieldClassName} />
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-200">
        Personal Motto <span className="text-slate-500">(Optional)</span>
        <input name="personalMotto" defaultValue={profile.personalMotto} maxLength={120} className={fieldClassName} />
      </label>

      <div aria-live="polite" className="min-h-5 text-sm">
        {status.error && <p className="text-red-200">{status.error}</p>}
        {status.success && <p className="text-[#f0c98e]">{status.success}</p>}
      </div>
      <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row">
        <button type="submit" disabled={isSaving} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#D8A35B] px-7 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-[#e6b66f] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]">
          {isSaving ? "Saving…" : "Save Profile Setup"}
        </button>
        <Link href="/my-profile" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-[#D8A35B]/60 px-7 py-3 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]">
          Back to My Profile
        </Link>
      </div>
    </form>
  );
}
