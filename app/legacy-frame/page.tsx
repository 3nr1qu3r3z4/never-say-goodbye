import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LegacyFrameWaitlist from "./waitlist";

export const metadata: Metadata = {
  title: "Legacy Frame™ | Never Say Goodbye",
  description:
    "Display your family's moments, photos, videos, and audio at home with Legacy Frame™.",
};

const frameContents = [
  { icon: "❤️", label: "Messages From Family" },
  { icon: "📷", label: "Shared Photos" },
  { icon: "🎥", label: "Family Videos" },
  { icon: "🎤", label: "Audio Moments" },
  { icon: "⏳", label: "Cannot Open Until™ Moments" },
  { icon: "✨", label: "Future Moment Maker™ Milestones" },
];

export default function LegacyFramePage() {
  return (
    <main className="overflow-hidden bg-[color:var(--nsg-background)] text-slate-100">
      <header className="relative border-b border-[color:var(--nsg-border)]/10 px-6 py-10 sm:px-8 sm:py-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_65%)]"
        />
        <div className="relative mx-auto max-w-6xl">
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
          >
            Never Say Goodbye
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-20">
        <Link
          href="/legacy-frame"
          aria-label="Explore Legacy Frame™"
          className="group mx-auto block w-full max-w-md rounded-3xl border border-[color:var(--nsg-accent)]/30 bg-white/[0.03] p-3 shadow-2xl shadow-black/30 transition hover:border-[color:var(--nsg-accent)]/60 hover:shadow-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
            <Image
              src="/images/legacy-frame-upload.png"
              alt="Legacy Frame™ displaying a family portrait in a warm living room"
              fill
              priority
              sizes="(max-width: 1024px) 90vw, 512px"
              className="object-cover object-top transition duration-500 group-hover:scale-[1.02]"
            />
          </div>
        </Link>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
            Legacy Frame™
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            A Window Into Your Family&apos;s Story
          </h1>
          <p className="mt-6 max-w-xl leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Display your favorite moments, photos, videos, and audio
            from the people who matter most.
          </p>
          <p className="mt-5 font-serif text-xl leading-relaxed text-[color:var(--nsg-accent-light)]">
            Always connected.
            <br />
            Always close.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
            A home for the moments you share
          </p>
          <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
            What Appears On The Frame?
          </h2>
        </div>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {frameContents.map((item) => (
            <li
              key={item.label}
              className="flex min-h-20 items-center gap-4 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 transition hover:border-[color:var(--nsg-accent)]/35"
            >
              <span aria-hidden="true" className="text-2xl">
                {item.icon}
              </span>
              <span className="font-medium text-slate-200">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="availability"
        className="border-y border-[color:var(--nsg-accent)]/15 bg-gradient-to-br from-slate-900/80 to-slate-950 px-6 py-16 sm:px-8 sm:py-24"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
              Availability
            </p>
            <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
              Legacy Frame™
            </h2>
            <p className="mt-4 leading-7 text-slate-300">
              Available in multiple sizes and finishes.
            </p>
          </div>
          <LegacyFrameWaitlist />
        </div>
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
