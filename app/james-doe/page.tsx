import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "James Michael Doe | Never Say Goodbye",
  description:
    "Explore James Michael Doe's moments, stories, and messages for the people he loves.",
};

const sharedMoments = [
  {
    title: "Growing Up With Mom & Dad",
    imageStyle: "from-[#5c4737] via-[#977553] to-[#263449]",
    symbol: "✦",
  },
  {
    title: "The Day I Became a Father",
    imageStyle: "from-[#293b4a] via-[#60736d] to-[#c2a678]",
    symbol: "✧",
  },
  {
    title: "Lessons From My Parents",
    imageStyle: "from-[#573c3b] via-[#ad806d] to-[#293744]",
    symbol: "♡",
  },
  {
    title: "Family Traditions I Carry On",
    imageStyle: "from-[#4a3e34] via-[#92805f] to-[#33423b]",
    symbol: "✦",
  },
];

const personalMoments = [
  "For My Children",
  "Open On Your Wedding Day",
  "A Letter to My Future Self",
];

const lovedOnes = [
  {
    icon: "❤️",
    name: "John Michael Doe",
    relationship: "Father",
    href: "/profile-preview",
  },
  {
    icon: "❤️",
    name: "Mary Elizabeth Doe",
    relationship: "Mother",
    href: "/mary-doe",
  },
  {
    icon: "👧",
    name: "Emma Doe",
    relationship: "Sister",
    href: "/emma-doe",
  },
];

export default function JamesDoePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <section className="px-4 pt-4 sm:px-8 sm:pt-8">
        <figure
          aria-label="Profile portrait area for James Michael Doe"
          className="relative mx-auto h-[55svh] min-h-[24rem] max-h-[46rem] max-w-6xl overflow-hidden rounded-[1.75rem] border border-[#D8A35B]/25 bg-gradient-to-br from-[#5c4737] via-[#293744] to-[#101827] shadow-2xl shadow-black/30 sm:rounded-[2rem]"
        >
          <Image
            src="/images/james-doe.jpg"
            alt="Portrait of James Michael Doe"
            fill
            priority
            sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1280px) calc(100vw - 4rem), 1152px"
            className="object-cover object-[center_35%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(216,163,91,0.28),transparent_58%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-[#0F172A]/10"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 sm:p-8">
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.24em] text-[#f0c98e]/80">
              My Moments
            </span>
          </div>
        </figure>

        <div className="mx-auto max-w-4xl px-2 pb-12 pt-8 text-center sm:pb-16 sm:pt-10">
          <h1 className="font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
            James Michael Doe
          </h1>
          <p className="mt-4 text-sm tracking-wide text-slate-300 sm:text-base">
            Husband <span className="px-1 text-[#D8A35B]">•</span> Father{" "}
            <span className="px-1 text-[#D8A35B]">•</span> Fire Fighter
          </p>
          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left">
            <div className="border-r border-white/10 p-5 sm:p-7">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                Born In
              </p>
              <p className="mt-2 font-serif text-base text-white sm:text-lg">
                Nashville, Tennessee
              </p>
            </div>
            <div className="p-5 sm:p-7">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                Called Home
              </p>
              <p className="mt-2 font-serif text-base text-white sm:text-lg">
                Austin, Texas
              </p>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-2xl text-left">
            <h2 className="font-serif text-xl text-white sm:text-2xl">
              Life Milestones
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Born
                </dt>
                <dd className="mt-2 text-sm text-slate-200 sm:text-base">
                  May 3, 1982
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Married
                </dt>
                <dd className="mt-2 text-sm text-slate-200 sm:text-base">
                  June 14, 2008
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  First Child
                </dt>
                <dd className="mt-2 text-sm text-slate-200 sm:text-base">
                  March 22, 2011
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            className="mt-8 w-full max-w-2xl rounded-full bg-[#D8A35B] px-8 py-4 text-sm font-semibold tracking-wide text-[#0F172A] shadow-lg shadow-[#D8A35B]/10 transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
          >
            ❤️ A Message From Dad
          </button>
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              Moments in his own words
            </p>
            <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
              Shared Moments
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sharedMoments.map((moment) => (
              <article
                key={moment.title}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <div
                  aria-label={`Video placeholder for ${moment.title}`}
                  className={`relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br ${moment.imageStyle}`}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/70 to-transparent"
                  />
                  <span
                    aria-hidden="true"
                    className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-[#0F172A]/40 pl-0.5 text-lg text-white backdrop-blur-sm"
                  >
                    ▶
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute right-4 top-3 font-serif text-2xl text-white/60"
                  >
                    {moment.symbol}
                  </span>
                  <span className="absolute bottom-3 left-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/65">
                    Video placeholder
                  </span>
                </div>
                <h3 className="px-5 py-4 font-serif text-lg text-white">
                  {moment.title}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            For the moments still to come
          </p>
          <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
            Personal Moments
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personalMoments.map((moment) => (
            <article
              key={moment}
              className="overflow-hidden rounded-2xl border border-[#D8A35B]/20 bg-slate-900"
            >
              <div className="relative h-36 overflow-hidden">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 scale-110 bg-gradient-to-br from-[#D8A35B]/25 via-slate-700 to-[#0F172A] blur-xl"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center text-3xl text-white/70"
                >
                  🔒
                </span>
                <span className="absolute bottom-3 right-4 text-xs uppercase tracking-[0.18em] text-[#f0c98e]">
                  Sealed
                </span>
              </div>
              <h3 className="flex items-center gap-2 px-5 py-4 font-serif text-lg text-white">
                <span aria-hidden="true">🔒</span>
                {moment}
              </h3>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#D8A35B]">
            Cannot Open Until™
          </p>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">
            These moments are reserved for the people and milestones they were
            created for.
          </p>
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            Always connected
          </p>
          <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
            Connected Lives™
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lovedOnes.map((person) => (
              <article
                key={person.name}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D8A35B]/30 bg-[#D8A35B]/10 text-xl"
                >
                  {person.icon}
                </span>
                <div>
                  <h3 className="font-serif text-lg text-white">
                    <Link
                      href={person.href}
                      className="transition hover:text-[#f0c98e] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                    >
                      {person.name}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {person.relationship}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-8 sm:py-20">
        <Link
          href="/legacy-frame"
          aria-label="Learn more about Legacy Frame™"
          className="group mx-auto grid max-w-6xl items-center gap-10 rounded-3xl border border-[#D8A35B]/20 bg-gradient-to-br from-slate-900 to-slate-950 p-7 transition hover:border-[#D8A35B]/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] sm:p-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:p-14"
        >
          <div className="flex justify-center">
            <div className="w-full max-w-xs rounded-[1.75rem] border border-[#D8A35B]/35 bg-[#111c31] p-3 shadow-2xl shadow-black/30">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem]">
                <Image
                  src="/images/legacy-frame-upload.png"
                  alt="Legacy Frame™ displaying a family photo in a warm living room"
                  fill
                  sizes="(max-width: 640px) 80vw, 288px"
                  className="object-cover object-top"
                />
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              Legacy Frame™
            </p>
            <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
              Keep Memories Close
            </h2>
            <p className="mt-5 leading-7 text-slate-300">
              Transform cherished photos, videos, and voice recordings into a
              beautifully prepared Legacy Frame™.
            </p>
            <span
              className="mt-7 inline-flex rounded-full border border-[#D8A35B]/60 px-7 py-3.5 text-sm font-semibold text-[#f0c98e] transition group-hover:border-[#D8A35B] group-hover:bg-[#D8A35B]/10"
            >
              Learn More
            </span>
          </div>
        </Link>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center">
        <p className="font-serif text-lg text-white">Never Say Goodbye</p>
        <p className="mt-2 text-sm text-slate-400">Connection Beyond Goodbye</p>
        <p className="mt-4 text-xs tracking-wide text-slate-500">
          NeverSayGoodbye.life
        </p>
      </footer>
    </main>
  );
}
