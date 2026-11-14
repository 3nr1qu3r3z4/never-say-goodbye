import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

const linkClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[#D8A35B]/60 px-5 py-2.5 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]";

async function SignOutButton({ mobile = false }: { mobile?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;

  if (mobile) {
    return (
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center rounded-xl px-4 text-left text-sm font-semibold text-[#f0c98e] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#D8A35B]"
        >
          Sign Out
        </button>
      </form>
    );
  }

  return (
    <form action={logoutAction}>
      <button type="submit" className={linkClassName}>
        Sign Out
      </button>
    </form>
  );
}

export default function SiteNavigation() {
  return (
    <nav
      aria-label="Main navigation"
      className="relative z-40 border-b border-white/10 bg-[#0F172A] px-4 py-3 text-slate-100 sm:px-8"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link
          href="/"
          className="font-serif text-base text-white transition hover:text-[#f0c98e] sm:text-lg"
        >
          Never Say Goodbye
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/dashboard" className={linkClassName}>
            My Legacy
          </Link>
          <Suspense fallback={null}>
            <SignOutButton />
          </Suspense>
        </div>
        <details className="relative sm:hidden">
          <summary className={`${linkClassName} cursor-pointer list-none`}>
            Menu
          </summary>
          <div className="absolute right-0 top-full mt-2 min-w-44 rounded-2xl border border-white/10 bg-[#111c31] p-2 shadow-xl">
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-[#f0c98e] transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#D8A35B]"
            >
              My Legacy
            </Link>
            <Suspense fallback={null}>
              <SignOutButton mobile />
            </Suspense>
          </div>
        </details>
      </div>
    </nav>
  );
}
