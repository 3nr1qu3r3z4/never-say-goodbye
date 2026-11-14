import Link from "next/link";

const linkClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-[#D8A35B]/60 px-5 py-2.5 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]";

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
        <Link href="/dashboard" className={`hidden sm:inline-flex ${linkClassName}`}>
          My Legacy
        </Link>
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
          </div>
        </details>
      </div>
    </nav>
  );
}
