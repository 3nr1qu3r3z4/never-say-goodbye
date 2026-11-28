import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

async function HomepageAccountActions() {
  const user = await getCurrentUser();
  return (
    <div className="mt-6 flex w-full max-w-xl flex-col justify-center gap-4 sm:flex-row">
      {!user && (
        <Link
          href="/signup"
          className="rounded-full bg-[color:var(--nsg-accent)] px-8 py-4 text-sm font-semibold tracking-wide text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          Create Your Legacy
        </Link>
      )}
      <Link
        href="/search"
        className={user
          ? "rounded-full bg-[color:var(--nsg-accent)] px-8 py-4 text-sm font-semibold tracking-wide text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
          : "rounded-full border border-[color:var(--nsg-accent)]/60 px-8 py-4 text-sm font-semibold tracking-wide text-[color:var(--nsg-accent-light)] transition hover:border-[color:var(--nsg-accent)] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"}
      >
        Find A Moment Maker
      </Link>
    </div>
  );
}

export default function Page() {
  return (
    <main className="overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <section className="relative isolate flex min-h-[92svh] flex-col items-center justify-center px-6 pt-8 pb-32 text-center sm:px-8 sm:pt-8 sm:pb-32">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_35%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-[color:var(--nsg-accent)]/40 to-transparent"
        />

        <Image
          src="/logo.png"
          alt="Never Say Goodbye"
          width={768}
          height={768}
          priority
          className="mb-0 h-[15.25rem] w-[15.25rem] object-contain sm:h-[19rem] sm:w-[19rem]"
        />
        <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-[color:var(--nsg-accent)] sm:text-xs">
          Build it today. Leave it forever.
        </p>
        <h1 className="mt-1 max-w-4xl font-serif text-5xl leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl">
          Never Say Goodbye
        </h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 font-serif text-xl leading-relaxed text-slate-200 sm:text-2xl md:text-3xl">
          <span>Preserve your presence.</span>
          <span aria-hidden="true" className="text-[color:var(--nsg-accent)]">
            •
          </span>
          <span>Share your moments.</span>
        </div>
        <Suspense fallback={null}>
          <HomepageAccountActions />
        </Suspense>
        <p className="mt-4 text-sm text-slate-400">
          Not quite ready?<br />
          <Link
            href="/about"
            className="font-medium text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 transition hover:text-white"
          >
            Learn why Never Say Goodbye exists.
          </Link>
        </p>
        <p className="mt-5 text-sm text-slate-400">
          What NSG Offers<br />
          <Link
            href="/what-nsg-offers"
            className="font-medium text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 transition hover:text-white"
          >
            See all our features here.
          </Link>
        </p>
        <p className="mt-16 text-xs uppercase tracking-[0.24em] text-slate-500">
          Where moments become legacy
        </p>
      </section>

      <footer className="border-t border-[color:var(--nsg-border)]/10 px-6 py-8 text-center sm:px-8">
        <p className="font-serif text-lg text-white"><Link href="/" className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">Never Say Goodbye</Link></p>
        <p className="mt-2 text-sm text-slate-400">Connection Beyond Goodbye</p>
        <p className="mt-4 text-xs tracking-wide text-slate-500">
          NeverSayGoodbye.life
        </p>
      </footer>
    </main>
  );
}
