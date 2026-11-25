"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction } from "@/app/actions/auth";
import SearchabilityWarning from "@/app/searchability-warning";
import { membershipPlans, membershipPrice } from "@/lib/membership-plans";

const inputClassName =
  "min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20";

const displayOptions = [
  { value: "full-name", label: "Full Name" },
  { value: "first-last", label: "First & Last Name" },
  { value: "custom", label: "Custom Display Name" },
] as const;

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return (
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
        d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z"
      />
      <circle cx="12" cy="12" r="2.5" />
      {!visible && (
        <path strokeLinecap="round" d="m4 4 16 16" />
      )}
    </svg>
  );
}

export default function SignupForm() {
  const [formState, formAction, isPending] = useActionState(signupAction, {});
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customDisplayName, setCustomDisplayName] = useState("");
  const [displayStyle, setDisplayStyle] =
    useState<(typeof displayOptions)[number]["value"]>("full-name");
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [discoverability, setDiscoverability] = useState<"private" | "searchable" | "public">("searchable");
  const [showSearchWarning, setShowSearchWarning] = useState(false);

  const accountName = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");
  const fullName = [firstName.trim(), middleName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");
  const profileName =
    displayStyle === "custom"
      ? customDisplayName.trim() || accountName || "Your Name"
      : displayStyle === "full-name"
        ? fullName || "Your Name"
        : accountName || "Your Name";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]"
      />

      <div className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          Never Say Goodbye
        </Link>

        <header className="mx-auto mt-12 max-w-2xl text-center sm:mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
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
          className="mx-auto mt-10 max-w-3xl space-y-8 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-12 sm:space-y-10 sm:p-9"
        >
          <section aria-labelledby="account-heading">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--nsg-accent)]">
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
                  htmlFor="username"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  minLength={3}
                  maxLength={40}
                  pattern="[A-Za-z0-9_]{3,40}"
                  required
                  className={inputClassName}
                />
                <p className="mt-2 text-xs text-slate-400">
                  Use 3 to 40 letters, numbers, or underscores.
                </p>
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
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className={`${inputClassName} pr-14`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide Password" : "Show Password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-2 my-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-[color:var(--nsg-accent)]"
                  >
                    <PasswordVisibilityIcon visible={showPassword} />
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className={`${inputClassName} pr-14`}
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmPassword ? "Hide Password" : "Show Password"
                    }
                    aria-pressed={showConfirmPassword}
                    onClick={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                    className="absolute inset-y-0 right-2 my-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-[color:var(--nsg-accent)]"
                  >
                    <PasswordVisibilityIcon visible={showConfirmPassword} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="display-name-heading"
            className="border-t border-[color:var(--nsg-border)]/10 pt-7"
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
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4 text-sm text-slate-200 transition hover:border-[color:var(--nsg-accent)]/30"
                >
                  <input
                    type="radio"
                    name="displayStyle"
                    value={option.value}
                    checked={displayStyle === option.value}
                    onChange={() => setDisplayStyle(option.value)}
                    className="h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
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
              className="mt-4 rounded-xl border border-[color:var(--nsg-accent)]/20 bg-[color:var(--nsg-accent)]/[0.05] p-4"
            >
              <p className="text-sm text-slate-400">
                Your profile will appear as:
              </p>
              <p className="mt-1 font-serif text-xl text-[color:var(--nsg-accent-light)]">
                {profileName}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="discoverability-heading"
            className="border-t border-[color:var(--nsg-border)]/10 pt-7"
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
                  checked={discoverability === "private"}
                  onChange={() => { setDiscoverability("private"); setShowSearchWarning(true); }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
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
                  checked={discoverability === "searchable"}
                  onChange={() => setDiscoverability("searchable")}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
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
                  checked={discoverability === "public"}
                  onChange={() => setDiscoverability("public")}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
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
            <SearchabilityWarning open={showSearchWarning} onChoose={(choice) => { setDiscoverability(choice); setShowSearchWarning(false); }} />
            <div className="mt-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked
                  className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
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
            className="border-t border-[color:var(--nsg-border)]/10 pt-7"
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--nsg-accent)]">
                Find the beginning that feels right
              </p>
              <h2
                id="membership-heading"
                className="mt-2 font-serif text-2xl text-white sm:text-3xl"
              >
                Membership Options
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Free Legacy is available now. Paid plans are coming soon; beta access remains unchanged and plan limits are not enforced.{" "}
                <Link href="/pricing" className="font-semibold text-[color:var(--nsg-accent-light)] underline underline-offset-4">Compare plans and planned features</Link>
              </p>
            </div>
            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="sr-only">Select a membership option</legend>
              {membershipPlans.map((plan) => (
                <div
                  key={plan.id}
                  aria-disabled={!plan.available || undefined}
                  className={`relative flex flex-col rounded-2xl border bg-slate-950/40 p-5 transition ${
                    plan.mostPopular
                      ? "border-[color:var(--nsg-accent)]/70 shadow-lg shadow-[color:var(--nsg-accent)]/10"
                      : "border-[color:var(--nsg-border)]/10"
                  } ${selectedPlan === plan.id ? "bg-[color:var(--nsg-accent)]/[0.08]" : ""} ${
                    !plan.available ? "opacity-70" : ""
                  }`}
                >
                  <div className="mb-3 flex flex-wrap gap-2">
                    {plan.mostPopular && <span className="rounded-full bg-[color:var(--nsg-accent)]/15 px-3 py-1 text-xs font-semibold text-[color:var(--nsg-accent-light)]">⭐ Most Popular</span>}
                    {!plan.available && <span className="rounded-full border border-[color:var(--nsg-border)]/15 px-3 py-1 text-xs font-semibold text-slate-300">Coming Soon</span>}
                  </div>
                  <label
                    className={`flex items-center gap-3 ${
                      !plan.available ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="membership"
                      value={plan.id}
                      checked={selectedPlan === plan.id}
                      onChange={() => setSelectedPlan(plan.id)}
                      disabled={!plan.available}
                      className="h-4 w-4 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
                    />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--nsg-accent)]">
                      {plan.name}
                    </span>
                  </label>
                  <p className="mt-3 font-semibold text-[color:var(--nsg-accent-light)]">{membershipPrice(plan)}</p>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">{plan.tagline}</p>
                  <button
                    type="button"
                    aria-pressed={selectedPlan === plan.id}
                    disabled={!plan.available}
                    onClick={() => {
                      if (!plan.available) return;
                      setSelectedPlan(plan.id);
                      document
                        .getElementById("terms-and-conditions")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`mt-5 min-h-11 w-full rounded-full border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] disabled:cursor-not-allowed disabled:border-[color:var(--nsg-border)]/10 disabled:text-slate-500 disabled:hover:border-[color:var(--nsg-border)]/10 disabled:hover:text-slate-500 ${
                      selectedPlan === plan.id
                        ? "border-[color:var(--nsg-accent)] bg-[color:var(--nsg-accent)]/15 text-[color:var(--nsg-accent-light)]"
                        : "border-[color:var(--nsg-border)]/15 text-slate-300 hover:border-[color:var(--nsg-accent)]/60 hover:text-[color:var(--nsg-accent-light)]"
                    }`}
                  >
                    {plan.available ? "Start Free" : "Coming Soon"}
                  </button>
                </div>
              ))}
            </fieldset>
          </section>

          <section
            id="terms-and-conditions"
            aria-labelledby="agreements-heading"
            className="scroll-mt-24 border-t border-[color:var(--nsg-border)]/10 pt-7"
          >
            <h2 id="agreements-heading" className="sr-only">
              Agreements
            </h2>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-300">
                <input
                  type="checkbox"
                  name="terms"
                  required
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
                />
                <span>I agree to the Terms and Conditions.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-300">
                <input
                  type="checkbox"
                  name="visibilityAcknowledgment"
                  required
                  className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]"
                />
                <span>
                  I understand that I control who can discover and view my
                  profile through Legacy Controls™.
                </span>
              </label>
            </div>
          </section>

          <p id="terms-requirement" aria-live="polite" className="text-center text-sm text-slate-400">
            {termsAccepted
              ? "Terms and Conditions accepted."
              : "Accept the Terms and Conditions to create your account."}
          </p>
          <button
            type="submit"
            disabled={isPending || !termsAccepted}
            aria-describedby="terms-requirement"
            className="min-h-14 w-full rounded-full bg-[color:var(--nsg-accent)] px-8 py-4 text-sm font-semibold tracking-wide text-[color:var(--nsg-background)] shadow-lg shadow-[color:var(--nsg-accent)]/10 transition hover:bg-[color:var(--nsg-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] sm:text-base"
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
          <p className="font-serif text-lg text-white"><Link href="/" className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">Never Say Goodbye</Link></p>
          <p className="mt-2 text-sm text-slate-500">
            Connection Beyond Goodbye
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Already a Moment Maker?{" "}
            <Link
              href="/login"
              className="text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 hover:text-white"
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
  "flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--nsg-border)]/10 bg-white/[0.02] p-4 text-sm text-white transition hover:border-[color:var(--nsg-accent)]/30";
