"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function SignupWelcome() {
  const searchParams = useSearchParams();

  if (searchParams.get("welcome") !== "1") {
    return null;
  }

  return (
    <section
      aria-labelledby="signup-welcome-heading"
      className="mx-auto mt-8 flex max-w-6xl flex-col gap-5 rounded-2xl border border-[color:var(--nsg-accent)]/30 bg-white/[0.04] px-6 py-5 shadow-lg shadow-black/10 sm:mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-7"
    >
      <div>
        <h2
          id="signup-welcome-heading"
          className="font-serif text-xl text-white sm:text-2xl"
        >
          Welcome to Never Say Goodbye.
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Your first moment is waiting to be created.
        </p>
      </div>
      <Link
        href="#moment-making-menu"
        className="inline-flex min-h-12 items-center justify-center self-start rounded-full bg-[color:var(--nsg-accent)] px-6 py-3 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] sm:self-auto"
      >
        ➕ Create A Moment
      </Link>
    </section>
  );
}
