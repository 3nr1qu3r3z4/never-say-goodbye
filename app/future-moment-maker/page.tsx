import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Future Moment Maker™ | Never Say Goodbye",
  description:
    "A reserved place for Debbie Doe, created through a Cannot Open Until™ message.",
};

const profileDetails = [
  { label: "Reserved By", value: "James Michael Doe", href: "/james-doe" },
  { label: "Connected Through", value: "Father" },
  { label: "Reserved Moments", value: "1" },
  { label: "First Moment Opens", value: "June 12, 2041" },
];

export default function FutureMomentMakerPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <header className="relative px-6 pb-12 pt-16 text-center sm:px-8 sm:pb-16 sm:pt-24">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_68%)]"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
          Never Say Goodbye
        </p>
        <h1 className="mt-4 font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
          Future Moment Maker™
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-serif text-lg leading-relaxed text-slate-300 sm:text-xl">
          A place reserved for a moment still to come
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-8 sm:pb-20">
        <article className="relative overflow-hidden rounded-3xl border border-[#D8A35B]/30 bg-gradient-to-br from-slate-800/80 to-slate-950 p-6 shadow-2xl shadow-black/25 sm:p-10 lg:p-14">
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#D8A35B]/10 blur-3xl"
          />
          <div className="relative">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#D8A35B]/40 bg-[#D8A35B]/10 font-serif text-2xl text-[#f0c98e]">
                D
              </div>
              <h2 className="mt-5 font-serif text-3xl text-white sm:text-4xl">
                Debbie Doe
              </h2>
              <span className="mt-4 inline-flex rounded-full border border-[#D8A35B]/40 bg-[#D8A35B]/10 px-4 py-1.5 text-xs font-semibold tracking-[0.12em] text-[#f0c98e]">
                Future Moment Maker™
              </span>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[#D8A35B]"
                />
                Awaiting Claim
              </span>
            </div>

            <dl className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2 sm:gap-4">
              {profileDetails.map((detail) => (
                <div
                  key={detail.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                >
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                    {detail.label}
                  </dt>
                  <dd className="mt-2 font-serif text-lg text-white">
                    {detail.href ? (
                      <Link
                        href={detail.href}
                        className="transition hover:text-[#f0c98e] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                      >
                        {detail.value}
                      </Link>
                    ) : (
                      detail.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </article>
      </section>

      <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            A place held for you
          </p>
          <h2 className="mt-3 font-serif text-2xl text-white sm:text-3xl">
            A moment is waiting for you.
          </h2>
          <p className="mt-5 leading-7 text-slate-300 sm:text-lg sm:leading-8">
            When a Moment Maker creates a Cannot Open Until™ message for someone
            without an account, Never Say Goodbye creates a Future Moment
            Maker™ profile to reserve their place until they are ready to claim
            it.
          </p>
        </div>
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
