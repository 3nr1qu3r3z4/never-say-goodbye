import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legacy Tree™ | Never Say Goodbye",
  description:
    "Explore the people who shaped a life of moments and the lives connected to them.",
};

const parents = [
  {
    name: "John Michael Doe",
    href: "/profile-preview",
    image: "/mature-man-portrait.jpg",
    imageAlt: "Portrait of John Michael Doe",
    unoptimized: false,
  },
  {
    name: "Mary Elizabeth Doe",
    href: "/mary-doe",
    image:
      "https://images.unsplash.com/photo-1747848214256-34a8cd21abac?w=1400&q=80",
    imageAlt: "Portrait of Mary Elizabeth Doe",
    unoptimized: true,
  },
];

const children = [
  {
    name: "James Michael Doe",
    href: "/james-doe",
    image: "/images/james-doe.jpg",
    imageAlt: "Portrait of James Michael Doe",
    unoptimized: false,
  },
  {
    name: "Emma Rose Doe",
    href: "/emma-doe",
    image:
      "https://images.unsplash.com/photo-1758613654538-5f353b10f93e?w=1400&q=80",
    imageAlt: "Portrait of Emma Rose Doe",
    unoptimized: true,
  },
];

const friend = {
  name: "Robert “Bobby” Hayes",
  href: "/bobby-hayes",
  image: "/images/bobby-hayes.jpg",
  imageAlt: "Portrait of Robert “Bobby” Hayes",
};

const currentViewer = { name: "John Michael Doe", tier: 2 };
const hasLegacyTreeAccess = currentViewer.tier >= 2;

function PersonCard({
  name,
  href,
  image,
  imageAlt,
  unoptimized = false,
}: {
  name: string;
  href: string;
  image: string;
  imageAlt: string;
  unoptimized?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-1 hover:border-[#D8A35B]/40 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] sm:p-6"
    >
      <Image
        src={image}
        alt={imageAlt}
        width={72}
        height={72}
        unoptimized={unoptimized}
        className="h-14 w-14 rounded-full border border-[#D8A35B]/40 object-cover object-[center_35%] shadow-md shadow-black/30 transition group-hover:border-[#D8A35B]/70 sm:h-[4.5rem] sm:w-[4.5rem]"
      />
      <span className="mt-3 break-words font-serif text-base leading-snug text-white transition group-hover:text-[#f0c98e] sm:text-lg">
        {name}
      </span>
    </Link>
  );
}

export default function LegacyTreePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <header className="relative px-6 pb-12 pt-16 text-center sm:px-8 sm:pb-16 sm:pt-24">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_68%)]"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
          Connected Lives™
        </p>
        <h1 className="mt-4 font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
          Legacy Tree™
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-serif text-lg leading-relaxed text-slate-300 sm:text-xl">
          The people who shaped a life of moments
        </p>
      </header>

      <section
        aria-label="Doe family and connected friend"
        className="mx-auto max-w-6xl px-4 pb-16 sm:px-8 sm:pb-20"
      >
        <div className="relative rounded-3xl border border-[#D8A35B]/25 bg-gradient-to-br from-slate-800/60 to-slate-950/70 p-5 shadow-2xl shadow-black/20 sm:p-10 lg:p-14">
          <div
            aria-hidden={!hasLegacyTreeAccess}
            inert={!hasLegacyTreeAccess}
            className={
              hasLegacyTreeAccess
                ? ""
                : "pointer-events-none select-none blur-[3px] opacity-40"
            }
          >
            <div className="mx-auto grid max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
              <PersonCard {...parents[0]} />
              <span
                aria-label="Connected partners"
                className="px-1 font-serif text-xl text-[#D8A35B] sm:px-2 sm:text-2xl"
              >
                ↔
              </span>
              <PersonCard {...parents[1]} />
            </div>

            <div
              aria-hidden="true"
              className="mx-auto h-8 w-px bg-gradient-to-b from-[#D8A35B]/70 to-[#D8A35B]/50"
            />

            <div className="relative mx-auto grid max-w-3xl grid-cols-2 gap-3 pt-8 before:absolute before:left-1/2 before:top-0 before:h-8 before:w-px before:bg-[#D8A35B]/60 after:absolute after:left-1/4 after:right-1/4 after:top-8 after:h-px after:bg-[#D8A35B]/60 sm:gap-8">
              {children.map((person) => (
                <div
                  key={person.href}
                  className="relative before:absolute before:-top-8 before:left-1/2 before:h-8 before:w-px before:-translate-x-1/2 before:bg-[#D8A35B]/60"
                >
                  <PersonCard {...person} />
                </div>
              ))}
            </div>

            <div className="mx-auto mt-12 max-w-md border-t border-dashed border-[#D8A35B]/30 pt-7 text-center sm:mt-16">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#D8A35B]">
                Friend Branch · Connected Lives™
              </p>
              <div className="mx-auto mt-5 max-w-xs">
                <PersonCard {...friend} />
              </div>
              <p className="mt-3 text-sm text-slate-400">Lifelong Friend</p>
            </div>
          </div>

          {!hasLegacyTreeAccess && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-[#0F172A]/55 p-5 backdrop-blur-[2px] sm:p-8">
              <div className="max-w-lg rounded-2xl border border-[#D8A35B]/40 bg-gradient-to-br from-slate-900/95 to-[#0F172A]/95 p-7 text-center shadow-2xl shadow-black/40 sm:p-10">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#D8A35B]">
                  Connected Lives™
                </p>
                <h2 className="mt-4 font-serif text-2xl leading-snug text-white sm:text-3xl">
                  Legacy Tree™ is available with Moment Maker Gold and Moment
                  Maker Legacy
                </h2>
                <p className="mt-4 leading-7 text-slate-300">
                  Upgrade to unlock the full family story and Connected Lives™
                  map.
                </p>
                <Link
                  href="/signup"
                  className="mt-7 inline-flex rounded-full bg-[#D8A35B] px-8 py-3.5 text-sm font-semibold tracking-wide text-[#0F172A] shadow-lg shadow-[#D8A35B]/10 transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
                >
                  Upgrade
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 bg-slate-950/30 px-6 py-12 text-center sm:px-8 sm:py-16">
        <p className="mx-auto max-w-2xl leading-7 text-slate-300 sm:text-lg">
          Every Moment Maker is part of a larger story. Explore the lives
          connected to them.
        </p>
        <Link
          href="/signup"
          className="mt-7 inline-flex rounded-full border border-[#D8A35B]/60 px-7 py-3.5 text-sm font-semibold text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          Become a Moment Maker
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
