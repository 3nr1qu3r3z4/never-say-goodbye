import Image from "next/image";

const howItWorks = [
  {
    number: "01",
    title: "Record Your Story",
    description:
      "Capture the stories, wisdom, and little moments that make a life uniquely yours.",
  },
  {
    number: "02",
    title: "Leave Messages",
    description:
      "Share your voice and words with the people you love, whenever they may need them.",
  },
  {
    number: "03",
    title: "Protect Private Memories",
    description:
      "Keep personal memories thoughtfully preserved and shared on your terms.",
  },
  {
    number: "04",
    title: "Deliver Comfort",
    description:
      "Let a familiar voice and a heartfelt message bring closeness to meaningful days.",
  },
];

const sealedMessages = [
  { icon: "🎂", title: "Birthday Messages" },
  { icon: "💍", title: "Wedding Day Messages" },
  { icon: "⏳", title: "Future Release Messages" },
];

export default function Page() {
  return (
    <main className="overflow-hidden bg-[#0F172A] text-slate-100">
      <section className="relative isolate flex min-h-[92svh] flex-col items-center justify-center px-6 pt-8 pb-32 text-center sm:px-8 sm:pt-8 sm:pb-32">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_35%,rgba(216,163,91,0.12),transparent_58%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#D8A35B]/40 to-transparent"
        />

        <Image
          src="/logo.png"
          alt="Never Say Goodbye"
          width={768}
          height={768}
          priority
          className="mb-0 h-[15.25rem] w-[15.25rem] object-contain sm:h-[19rem] sm:w-[19rem]"
        />
        <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.24em] text-[#D8A35B] sm:text-xs">
          Build it today. Leave it forever.
        </p>
        <h1 className="mt-1 max-w-4xl font-serif text-5xl leading-[1.08] tracking-tight text-white sm:text-6xl md:text-7xl">
          Never Say Goodbye
        </h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 font-serif text-xl leading-relaxed text-slate-200 sm:text-2xl md:text-3xl">
          <span>Preserve your presence.</span>
          <span aria-hidden="true" className="text-[#D8A35B]">
            •
          </span>
          <span>Share your moments.</span>
        </div>
        <div className="mt-6 flex w-full max-w-xl flex-col justify-center gap-4 sm:flex-row">
          <a
            href="#legacy-profile"
            className="rounded-full bg-[#D8A35B] px-8 py-4 text-sm font-semibold tracking-wide text-[#0F172A] transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
          >
            Create Your Legacy
          </a>
          <a
            href="#legacy-profile"
            className="rounded-full border border-[#D8A35B]/60 px-8 py-4 text-sm font-semibold tracking-wide text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
          >
            Search For A Loved One
          </a>
        </div>
        <p className="mt-16 text-xs uppercase tracking-[0.24em] text-slate-500">
          A place for the moments that remain
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            A legacy made with love
          </p>
          <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
            How It Works
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {howItWorks.map((item) => (
            <article
              key={item.number}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-7"
            >
              <span className="font-serif text-sm tracking-[0.2em] text-[#D8A35B]">
                {item.number}
              </span>
              <h3 className="mt-6 font-serif text-xl text-white">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="legacy-profile"
        className="border-y border-white/10 bg-slate-950/30 px-6 py-20 sm:px-8 sm:py-28"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              A life remembered
            </p>
            <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
              Legacy Profile Preview
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-slate-400">
              Every life holds a thousand moments worth keeping close. A legacy
              profile brings those stories together in one meaningful place.
            </p>
          </div>

          <article className="relative overflow-hidden rounded-3xl border border-[#D8A35B]/30 bg-gradient-to-br from-slate-800/80 to-slate-900 p-7 shadow-2xl shadow-black/20 sm:p-10">
            <div
              aria-hidden="true"
              className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#D8A35B]/10 blur-3xl"
            />
            <div className="relative">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[#D8A35B]/40 bg-[#D8A35B]/10 font-serif text-2xl text-[#D8A35B]">
                J
              </div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#D8A35B]">
                Remembering
              </p>
              <h3 className="mt-2 font-serif text-3xl text-white">
                John Michael Doe
              </h3>
              <p className="mt-3 text-sm tracking-wide text-slate-300">
                Father <span className="text-[#D8A35B]">•</span> Veteran{" "}
                <span className="text-[#D8A35B]">•</span> Musician
              </p>
              <div className="my-7 h-px bg-white/10" />
              <dl className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Born
                  </dt>
                  <dd className="mt-2 text-sm text-slate-200">
                    San Diego, California
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Called Home
                  </dt>
                  <dd className="mt-2 text-sm text-slate-200">
                    Nashville, Tennessee
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="mt-8 w-full rounded-full border border-[#D8A35B]/50 px-6 py-4 text-sm font-medium text-[#f0c98e] transition hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
              >
                ❤️ Watch My First Message
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 text-center sm:px-8 sm:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
          For the days still to come
        </p>
        <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
          Cannot Open Until™
        </h2>
        <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400">
          Leave something meaningful for the moments that matter most.
        </p>
        <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
          {sealedMessages.map((message) => (
            <article
              key={message.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:border-[#D8A35B]/40 sm:p-8"
            >
              <span aria-hidden="true" className="text-3xl">
                {message.icon}
              </span>
              <h3 className="mt-5 font-serif text-xl text-white">
                {message.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                A message from the heart, saved for just the right time.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-gradient-to-r from-slate-950/60 via-slate-900/60 to-slate-950/60 px-6 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="order-2 flex justify-center lg:order-1">
            <div className="relative w-full max-w-sm rounded-[2rem] border border-[#D8A35B]/40 bg-[#111c31] p-4 shadow-2xl shadow-black/30">
              <div className="rounded-[1.5rem] border border-white/10 p-8">
                <div className="flex aspect-[4/5] flex-col items-center justify-center rounded-xl border border-dashed border-[#D8A35B]/40 bg-gradient-to-br from-[#D8A35B]/10 via-transparent to-slate-800/60 text-center">
                  <span className="font-serif text-5xl text-[#D8A35B]/80">
                    ✦
                  </span>
                  <span className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">
                    Your memories,
                  </span>
                  <span className="mt-2 font-serif text-2xl text-white">
                    kept close
                  </span>
                </div>
                <p className="mt-5 text-center text-xs uppercase tracking-[0.22em] text-[#D8A35B]">
                  Legacy Frame™
                </p>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              A tangible way to remember
            </p>
            <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
              Keep Memories Close
            </h2>
            <p className="mt-5 leading-7 text-slate-300">
              Transform cherished photos, videos, and voice recordings into a
              beautifully prepared Legacy Frame™.
            </p>
            <p className="mt-4 leading-7 text-slate-400">
              A timeless way to keep important moments nearby.
            </p>
            <a
              href="#coming-soon"
              className="mt-8 inline-flex rounded-full border border-[#D8A35B]/60 px-7 py-3.5 text-sm font-semibold text-[#f0c98e] transition hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      <section
        id="coming-soon"
        className="mx-auto max-w-7xl px-6 py-20 text-center sm:px-8 sm:py-28"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
          More ways to stay connected
        </p>
        <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
          Coming Soon
        </h2>
        <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400">
          Preserve not only memories, but the relationships that shaped them.
        </p>
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {["Connected Lives™", "Legacy Tree™"].map((feature) => (
            <article
              key={feature}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-9"
            >
              <span className="text-xs uppercase tracking-[0.22em] text-[#D8A35B]">
                Coming soon
              </span>
              <h3 className="mt-4 font-serif text-2xl text-white">{feature}</h3>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center sm:px-8">
        <p className="font-serif text-lg text-white">Never Say Goodbye</p>
        <p className="mt-2 text-sm text-slate-400">Connection Beyond Goodbye</p>
        <p className="mt-4 text-xs tracking-wide text-slate-500">
          NeverSayGoodbye.life
        </p>
      </footer>
    </main>
  );
}
