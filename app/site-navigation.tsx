import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

const interactionClassName =
  "transition-colors hover:text-[#f0c98e] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]";
const brandSizeClassName = "text-base sm:text-lg";
const linkClassName =
  `inline-flex min-h-11 cursor-pointer items-center px-3 font-medium text-slate-200 ${interactionClassName}`;
const menuItemClassName =
  `flex min-h-11 w-full cursor-pointer items-center rounded-lg px-4 text-left font-medium text-slate-200 hover:bg-white/5 ${interactionClassName}`;

async function NavigationActions() {
  const user = await getCurrentUser();
  return (
    <>
      <div className="hidden items-center gap-2 sm:flex">
        {user ? (
          <>
            <Link href="/dashboard" className={`${linkClassName} ${brandSizeClassName}`}>
              My Legacy
            </Link>
            <form action={logoutAction}>
              <button type="submit" className={`${linkClassName} ${brandSizeClassName}`}>
                Sign Out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/signup" className={`${linkClassName} text-sm`}>
              Create Your Legacy
            </Link>
            <Link href="/login" className={`${linkClassName} text-sm`}>
              Sign In
            </Link>
          </>
        )}
      </div>
      <details className="relative sm:hidden">
        <summary className={`${linkClassName} cursor-pointer list-none text-sm`}>
          Menu
        </summary>
        <div className="absolute right-0 top-full mt-2 min-w-44 rounded-2xl border border-white/10 bg-[#111c31] p-2 shadow-xl">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={`${menuItemClassName} ${brandSizeClassName}`}
              >
                My Legacy
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className={`${menuItemClassName} ${brandSizeClassName}`}
                >
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/signup"
                className={`${menuItemClassName} text-sm`}
              >
                Create Your Legacy
              </Link>
              <Link
                href="/login"
                className={`${menuItemClassName} text-sm`}
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </details>
    </>
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
          className={`inline-flex min-h-11 items-center font-serif text-white ${brandSizeClassName} ${interactionClassName}`}
        >
          Never Say Goodbye
        </Link>
        <Suspense fallback={null}>
          <NavigationActions />
        </Suspense>
      </div>
    </nav>
  );
}
