import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Create Your Legacy | Never Say Goodbye",
  description:
    "Start building the moments, stories, and messages that matter most.",
};

const plans = [
  {
    name: "Free",
    description: "Start Your Legacy",
    price: "$0",
    detail: "No cost to begin",
    value: "free",
  },
  {
    name: "Monthly",
    description: "Build As You Go",
    price: "$14.99",
    detail: "per month",
    value: "monthly",
    popular: true,
  },
  {
    name: "Lifetime",
    description: "Build It Today. Leave It Forever.",
    price: "$599",
    detail: "One Time",
    value: "lifetime",
  },
];

const inputClassName =
  "min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

export default function SignupPage() {
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
            Become A Moment Maker
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Start building the moments, stories, and messages that matter most.
          </p>
        </header>

        <form className="mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-12 sm:p-9">
          <section aria-labelledby="account-heading">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8A35B]">
                Begin your legacy
              </p>
              <h2
                id="account-heading"
                className="mt-2 font-serif text-2xl text-white sm:text-3xl"
              >
                Your account
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
                  placeholder="Your first name"
                  required
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
                  placeholder="Your last name"
                  required
                  className={inputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="former-maiden-name"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Former / Maiden Name (Optional)
                </label>
                <input
                  id="former-maiden-name"
                  name="formerMaidenName"
                  type="text"
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
                  placeholder="Create a password"
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
                  placeholder="Enter your password again"
                  minLength={8}
                  required
                  className={inputClassName}
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="identity-markers"
                  className="mb-2 block text-sm text-slate-300"
                >
                  What defines your moments?{" "}
                  <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="identity-markers"
                  name="identityMarkers"
                  type="text"
                  placeholder="e.g. Parent, storyteller, friend"
                  className={inputClassName}
                />
              </div>
            </div>
          </section>

          <section
            aria-labelledby="plan-heading"
            className="mt-10 border-t border-white/10 pt-8 sm:mt-12 sm:pt-10"
          >
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8A35B]">
                Choose your beginning
              </p>
              <h2
                id="plan-heading"
                className="mt-2 font-serif text-2xl text-white sm:text-3xl"
              >
                A plan for your story
              </h2>
            </div>

            <fieldset className="grid gap-4 md:grid-cols-3">
              <legend className="sr-only">Select a membership plan</legend>
              {plans.map((plan) => (
                <label key={plan.value} className="block cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="plan"
                    value={plan.value}
                    defaultChecked={plan.popular}
                  />
                  <span className="relative flex h-full min-h-40 flex-col rounded-2xl border border-white/10 bg-slate-950/40 p-5 transition peer-checked:border-[#D8A35B]/70 peer-checked:bg-[#D8A35B]/[0.08] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#D8A35B]">
                    {plan.popular && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#D8A35B]/15 px-2.5 py-1 text-[0.6rem] font-semibold tracking-[0.14em] text-[#f0c98e]">
                        MOST POPULAR
                      </span>
                    )}
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8A35B]">
                      {plan.name}
                    </span>
                    <span className="mt-3 font-serif text-lg leading-snug text-white">
                      {plan.description}
                    </span>
                    <span className="mt-auto pt-5">
                      <span className="font-serif text-2xl text-white">
                        {plan.price}
                      </span>
                      {plan.value !== "free" && (
                        <span className="ml-1 text-sm text-slate-400">
                          {plan.value === "monthly" ? "/month" : plan.detail}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>

          <aside className="mt-8 flex gap-4 rounded-2xl border border-[#D8A35B]/25 bg-[#D8A35B]/[0.06] p-5 sm:mt-10 sm:p-6">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8A35B]/30 bg-[#D8A35B]/10 font-serif text-lg text-[#D8A35B]"
            >
              ✦
            </span>
            <div>
              <h2 className="font-serif text-lg text-white sm:text-xl">
                Legacy Successor
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                One designated successor can inherit a Lifetime Membership,
                keeping your legacy in trusted hands for generations to come.
              </p>
            </div>
          </aside>

          <button
            type="button"
            className="mt-8 min-h-14 w-full rounded-full bg-[#D8A35B] px-8 py-4 text-sm font-semibold tracking-wide text-[#0F172A] shadow-lg shadow-[#D8A35B]/10 transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] sm:mt-10"
          >
            Create My Legacy
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">
            Your memories are yours. Begin with the plan that feels right.
          </p>
        </form>

        <footer className="py-10 text-center">
          <p className="font-serif text-lg text-white">Never Say Goodbye</p>
          <p className="mt-2 text-sm text-slate-500">Connection Beyond Goodbye</p>
        </footer>
      </div>
    </main>
  );
}
