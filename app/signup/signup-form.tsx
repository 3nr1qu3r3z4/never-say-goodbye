"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction } from "@/app/actions/auth";

const inputClassName =
  "min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

const plans = [
  {
    name: "FREE",
    description: "A meaningful place to begin.",
    value: "free",
    features: [
      "Create Moments",
      "Build Connected Lives™",
      "Join Legacy Trees™",
    ],
    action: "Start Free",
  },
  {
    name: "TIER 2",
    description: "Build and care for your family story.",
    value: "tier-2",
    features: [
      "Legacy Tree™ Ownership",
      "Cannot Open Until™",
      "Family Management",
      "Future Moment Makers™",
    ],
    action: "Choose Tier 2",
    unavailable: true,
  },
  {
    name: "TIER 3",
    description: "A deeper way to protect what matters.",
    value: "tier-3",
    features: [
      "Everything in Tier 2",
      "Legacy Successor™",
      "Merge Moment Makers™",
      "Advanced Legacy Controls™",
    ],
    action: "Choose Tier 3",
    recommended: true,
    unavailable: true,
  },
];

const displayOptions = [
  { value: "full-name", label: "Full Name" },
  { value: "first-last", label: "First & Last Name" },
  { value: "custom", label: "Custom Display Name" },
] as const;

export default function SignupForm() {
  const [formState, formAction, isPending] = useActionState(signupAction, {});
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customDisplayName, setCustomDisplayName] = useState("");
  const [displayStyle, setDisplayStyle] =
    useState<(typeof displayOptions)[number]["value"]>("full-name");
  const [selectedPlan, setSelectedPlan] = useState("free");

  const accountName = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");
  const fullName = [firstName.trim(), middleName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");
  const profileName =
    displayStyle === "custom"
      ? customDisplayName.trim() || accountName || "John Michael Doe"
      : displayStyle === "full-name"
        ? fullName || "John Michael Doe"
        : accountName || "John Michael Doe";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
      />

      <div className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          Never Say Goodbye
        </Link>

        <header className="mx-auto mt-12 max-w-2xl text-center sm:mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Your story, thoughtfully preserved
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            Become A Moment Maker™
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Start preserving the moments, stories, and connections that matter
            most.
          </p>
        </header>

        <form
          action={formAction}
          className="mx-auto mt-10 max-w-3xl space-y-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-12 sm:space-y-10 sm:p-9"
        >
          <section aria-labelledby="account-heading">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8A35B]">
                Begin your story
              </p>
              <h2
                id="account-heading"
                className="mt-2 font-serif text-2xl text-white sm:text-3xl"
              >
                Account Information
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="first-name"
                  className="mb-2 block text-sm text-slate-300"
                >
                  First Name
                </label>
                <input
                  id="first-name"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="last-name"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Last Name
                </label>
                <input
                  id="last-name"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  className={inputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClassName}
                />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="display-name-heading"
            className="border-t border-white/10 pt-7"
          >
            <h2
              id="display-name-heading"
              className="font-serif text-xl text-white sm:text-2xl"
            >
              How would you like your profile displayed?
            </h2>
            <fieldset className="mt-4 grid gap-3 sm:grid-cols-3">
              <legend className="sr-only">Choose a profile display name</legend>
              {displayOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-200 transition hover:border-[#D8A35B]/30"
                >
                  <input
                    type="radio"
                    name="displayStyle"
                    value={option.value}
                    checked={displayStyle === option.value}
                    onChange={() => setDisplayStyle(option.value)}
                    className="h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            {displayStyle === "custom" && (
              <div className="mt-4">
                <label
                  htmlFor="custom-display-name"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Custom Display Name
                </label>
                <input
                  id="custom-display-name"
                  name="customDisplayName"
                  type="text"
                  value={customDisplayName}
                  onChange={(event) =>
                    setCustomDisplayName(event.target.value)
                  }
                  placeholder="Enter the name you'd like to share"
                  className={inputClassName}
                />
              </div>
            )}
            {displayStyle === "full-name" && (
              <div className="mt-4">
                <label
                  htmlFor="middle-name"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Middle Name <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="middle-name"
                  name="middleName"
                  type="text"
                  value={middleName}
                  onChange={(event) => setMiddleName(event.target.value)}
                  placeholder="Add a middle name to your full name"
                  className={inputClassName}
                />
              </div>
            )}
            <div
              aria-live="polite"
              className="mt-4 rounded-xl border border-[#D8A35B]/20 bg-[#D8A35B]/[0.05] p-4"
            >
              <p className="text-sm text-slate-400">
                Your profile will appear as:
              </p>
              <p className="mt-1 font-serif text-xl text-[#f0c98e]">
                {profileName}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="discoverability-heading"
            className="border-t border-white/10 pt-7"
          >
            <h2
              id="discoverability-heading"
              className="font-serif text-xl text-white sm:text-2xl"
            >
              Can people find your profile?
            </h2>
            <fieldset className="mt-4 space-y-3">
              <legend className="sr-only">Profile discoverability</legend>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="discoverability"
                  value="private"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Private</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    Only approved connections can find me.
                  </span>
                </span>
              </label>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="discoverability"
                  value="searchable"
                  defaultChecked
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Searchable</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    People may find my profile, but access depends on my
                    visibility settings.
                  </span>
                </span>
              </label>
              <label className={optionClassName}>
                <input
                  type="radio"
                  name="discoverability"
                  value="public"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block font-medium">Public</span>
                  <span className="mt-1 block leading-6 text-slate-400">
                    People may find my profile and view content I have chosen
                    to make public.
                  </span>
                </span>
              </label>
            </fieldset>
            <div className="mt-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked
                  className="mt-1 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  <span className="block text-sm font-medium text-white">
                    Feature my profile
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-400">
                    Allow my profile to be considered for This Week&apos;s
                    Moment Makers™.
                  </span>
                  <span className="mt-2 block text-xs text-slate-500">
                    You can change this later from Legacy Controls™.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section
            aria-labelledby="membership-heading"
            className="border-t border-white/10 pt-7"
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8A35B]">
                Find the beginning that feels right
              </p>
              <h2
                id="membership-heading"
                className="mt-2 font-serif text-2xl text-white sm:text-3xl"
              >
                Membership Options
              </h2>
            </div>
            <fieldset className="grid gap-4 md:grid-cols-3">
              <legend className="sr-only">Select a membership option</legend>
              {plans.map((plan) => (
                <div
                  key={plan.value}
                  aria-disabled={plan.unavailable || undefined}
                  className={`relative flex flex-col rounded-2xl border bg-slate-950/40 p-5 transition ${
                    plan.recommended
                      ? "border-[#D8A35B]/70 shadow-lg shadow-[#D8A35B]/10"
                      : "border-white/10"
                  } ${selectedPlan === plan.value ? "bg-[#D8A35B]/[0.08]" : ""} ${
                    plan.unavailable ? "opacity-70" : ""
                  }`}
                >
                  {plan.recommended && (
                    <span className="absolute right-4 top-4 rounded-full bg-[#D8A35B]/15 px-2.5 py-1 text-[0.6rem] font-semibold tracking-[0.14em] text-[#f0c98e]">
                      RECOMMENDED
                    </span>
                  )}
                  {plan.unavailable && (
                    <span
                      className={`absolute right-4 rounded-full border border-[#D8A35B]/40 bg-[#D8A35B]/10 px-2.5 py-1 text-[0.6rem] font-semibold tracking-[0.12em] text-[#f0c98e] ${
                        plan.recommended ? "top-12" : "top-4"
                      }`}
                    >
                      COMING SOON
                    </span>
                  )}
                  <label
                    className={`flex items-center gap-3 ${
                      plan.unavailable ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="membership"
                      value={plan.value}
                      checked={selectedPlan === plan.value}
                      onChange={() => setSelectedPlan(plan.value)}
                      disabled={plan.unavailable}
                      className="h-4 w-4 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                    />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8A35B]">
                      {plan.name}
                    </span>
                  </label>
                  <p className="mt-3 min-h-12 font-serif text-lg leading-snug text-white">
                    {plan.description}
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span aria-hidden="true" className="text-[#D8A35B]">
                          ✓
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    aria-pressed={selectedPlan === plan.value}
                    disabled={plan.unavailable}
                    onClick={() => {
                      if (!plan.unavailable) setSelectedPlan(plan.value);
                    }}
                    className={`mt-5 min-h-11 w-full rounded-full border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500 disabled:hover:border-white/10 disabled:hover:text-slate-500 ${
                      selectedPlan === plan.value
                        ? "border-[#D8A35B] bg-[#D8A35B]/15 text-[#f0c98e]"
                        : "border-white/15 text-slate-300 hover:border-[#D8A35B]/60 hover:text-[#f0c98e]"
                    }`}
                  >
                    {plan.action}
                  </button>
                </div>
              ))}
            </fieldset>
          </section>

          <section aria-labelledby="agreements-heading" className="border-t border-white/10 pt-7">
            <h2 id="agreements-heading" className="sr-only">
              Agreements
            </h2>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-300">
                <input
                  type="checkbox"
                  name="terms"
                  required
                  className="mt-1 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>I agree to the Terms and Conditions.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-300">
                <input
                  type="checkbox"
                  name="visibilityAcknowledgment"
                  required
                  className="mt-1 h-4 w-4 shrink-0 accent-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                />
                <span>
                  I understand that I control who can discover and view my
                  profile through Legacy Controls™.
                </span>
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={isPending}
            className="min-h-14 w-full rounded-full bg-[#D8A35B] px-8 py-4 text-sm font-semibold tracking-wide text-[#0F172A] shadow-lg shadow-[#D8A35B]/10 transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] sm:text-base"
          >
            {isPending ? "Creating your account..." : "Become A Moment Maker™"}
          </button>
          {formState.error && (
            <p role="alert" className="text-center text-sm text-rose-300">
              {formState.error}
            </p>
          )}
          <p className="text-center text-xs leading-5 text-slate-500">
            Your memories are yours. Begin with the plan that feels right.
          </p>
        </form>

        <footer className="py-10 text-center">
          <p className="font-serif text-lg text-white">Never Say Goodbye</p>
          <p className="mt-2 text-sm text-slate-500">
            Connection Beyond Goodbye
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Already a Moment Maker?{" "}
            <Link
              href="/login"
              className="text-[#f0c98e] underline decoration-[#D8A35B]/40 underline-offset-4 hover:text-white"
            >
              Sign in
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}

const optionClassName =
  "flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[#D8A35B]/30";
