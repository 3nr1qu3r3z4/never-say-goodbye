import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import WeeklyMomentMakers from "./weekly-moment-makers";
import HomepageVideo from "./homepage-video";

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
  {
    number: "05",
    title: "❤️ Connected, Even When You're Not",
    description:
      "Schedules, school, time zones, and responsibilities make conversations difficult.",
    additionalDescription: "Life gets busy.",
    closingDescription: "Family shouldn't have to wait.",
  },
  {
    number: "06",
    title: "🎂 Stop Making Notes",
    description:
      "Birthdays, anniversaries, and milestones are important, but shouldn't be another thing to remember.",
    additionalDescription:
      "Never Say Goodbye helps you remember the moments that matter.",
  },
];

const sealedMessages = [
  { icon: "🎂", title: "Birthday Messages" },
  { icon: "💍", title: "Wedding Day Messages" },
  { icon: "⏳", title: "Future Release Messages" },
];

async function HomepageAccountActions() {
  const user = await getCurrentUser();
  return (
    <>
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
      <p className="mt-4 text-sm text-slate-400">
        Not quite ready?{" "}
        <Link
          href="/about"
          className="font-medium text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 transition hover:text-white"
        >
          Learn why Never Say Goodbye exists.
        </Link>
      </p>
    </>
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
        <Link
          href="/legacy-tree"
          className="mt-5 inline-flex text-sm font-medium text-[color:var(--nsg-accent-light)] transition hover:text-[color:var(--nsg-accent)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          🌳 Explore Legacy Tree™
        </Link>
        <p className="mt-16 text-xs uppercase tracking-[0.24em] text-slate-500">
          Where moments become legacy
        </p>
      </section>

      <section aria-labelledby="message-for-the-future" className="border-y border-[color:var(--nsg-border)]/10 bg-slate-950/30 px-6 py-16 text-center sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 id="message-for-the-future" className="font-serif text-3xl text-white sm:text-4xl">❤️ A Message For The Future</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">
            Imagine recording a message today that your child won&apos;t open until they turn 18.
          </p>
          <div className="mt-8">
            <HomepageVideo />
          </div>
          <h3 className="mt-7 font-serif text-2xl text-white">Cannot Open Until™</h3>
          <p className="mt-1 text-sm font-semibold text-[color:var(--nsg-accent-light)]">(NSG Time Capsule)</p>
          <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-400">
            Preserve messages, stories, videos, and memories for the moments that matter most.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
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
              className={`rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-6 sm:p-7 ${item.number === "05" || item.number === "06" ? "sm:col-span-2" : ""}`}
            >
              <span className="font-serif text-sm tracking-[0.2em] text-[color:var(--nsg-accent)]">
                {item.number}
              </span>
              <h3 className="mt-6 font-serif text-xl text-white">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                {item.description}
              </p>
              {item.additionalDescription && (
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {item.additionalDescription}
                </p>
              )}
              {item.closingDescription && (
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {item.closingDescription}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section
        id="legacy-profile"
        aria-labelledby="meet-moment-makers"
        className="border-y border-[color:var(--nsg-border)]/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <h2 id="meet-moment-makers" className="font-serif text-3xl text-white sm:text-4xl">
              ❤️ Meet Our Moment Makers™
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Discover the stories, memories, and legacies being preserved by families in the Never Say Goodbye™ community.
            </p>
          </div>

          <h3 className="mt-10 font-serif text-2xl text-white">Featured Moment Maker</h3>
          <article className="mt-4 flex flex-col gap-6 rounded-3xl border border-[color:var(--nsg-accent)]/30 bg-gradient-to-br from-slate-800/80 to-slate-900 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--nsg-accent)]/30">
              <Image src="/mature-man-portrait.jpg" alt="Portrait of John Michael Doe" fill sizes="128px" className="object-cover object-[center_35%]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--nsg-accent)]">Example profile</p>
              <h4 className="mt-2 font-serif text-2xl text-white">John Michael Doe</h4>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                A veteran and lifelong musician, John finds joy in family dinners, old songs, and sharing the stories behind them.
              </p>
              <Link
                href="/profile-preview"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--nsg-accent)]/50 px-6 py-2 text-sm font-semibold text-[color:var(--nsg-accent-light)] transition hover:bg-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
              >
                View Profile
              </Link>
            </div>
          </article>
          <h3 id="weekly-moment-makers-heading" className="mt-10 font-serif text-2xl text-white">Featured This Week</h3>
          <Suspense fallback={<p className="mt-4 text-sm text-slate-400">Loading this week&apos;s Moment Makers™…</p>}>
            <WeeklyMomentMakers />
          </Suspense>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 text-center sm:px-8 sm:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
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
              className="rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-7 transition hover:border-[color:var(--nsg-accent)]/40 sm:p-8"
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

      <section className="border-y border-[color:var(--nsg-border)]/10 bg-gradient-to-r from-slate-950/60 via-slate-900/60 to-slate-950/60 px-6 py-20 sm:px-8 sm:py-28">
        <Link
          href="/legacy-frame"
          aria-label="Learn more about Legacy Frame™"
          className="group mx-auto grid max-w-6xl items-center gap-12 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[color:var(--nsg-accent)] lg:grid-cols-2 lg:gap-20"
        >
          <div className="order-2 flex justify-center lg:order-1">
            <div className="w-full max-w-sm">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[18rem] overflow-hidden rounded-xl shadow-2xl shadow-black/30 transition group-hover:shadow-[color:var(--nsg-accent)]/15">
                <Image
                  src="/images/legacy-frame-upload.png"
                  alt="A framed portrait resting on a side table in a warm living room"
                  fill
                  sizes="(max-width: 640px) 80vw, 288px"
                  className="object-cover object-top"
                />
              </div>
              <p className="mt-5 text-center text-xs uppercase tracking-[0.22em] text-[color:var(--nsg-accent)]">
                Legacy Frame™
              </p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
              LEGACY FRAME™
            </p>
            <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
              A Window Into Your Family&apos;s Story
            </h2>
            <p className="mt-5 leading-7 text-slate-300">
              Display your favorite moments, photos, videos, and voice messages
              from the people who matter most.
              <br />
              Always connected.
              <br />
              Always close.
            </p>
            <span
              className="mt-8 inline-flex rounded-full border border-[color:var(--nsg-accent)]/60 px-7 py-3.5 text-sm font-semibold text-[color:var(--nsg-accent-light)] transition group-hover:border-[color:var(--nsg-accent)] group-hover:bg-[color:var(--nsg-accent)]/10"
            >
              Learn More
            </span>
          </div>
        </Link>
      </section>

      <section
        id="features"
        className="mx-auto max-w-7xl px-6 py-20 text-center sm:px-8 sm:py-28"
      >
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
          {[
            {
              name: "Connected Lives™",
              href: "/connected-lives",
              description: "Build meaningful connections with family, friends, mentors, and the people who matter most.",
            },
            {
              name: "Legacy Tree™",
              href: "/legacy-tree",
              description: "Preserve family relationships across generations and keep your story connected.",
            },
            {
              name: "Future Moment Makers™",
              href: "/future-moment-maker",
              description: "Create moments today for children, grandchildren, and family members whose stories are still unfolding.",
            },
            {
              name: "Cannot Open Until™",
              href: "/create-moment/cannot-open-until",
              description: "Deliver memories, letters, photos, videos, and messages on a future date or life milestone.",
            },
          ].map((feature) => (
            <Link
              key={feature.name}
              href={feature.href}
              className="cursor-pointer rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] px-6 py-10 transition duration-200 hover:-translate-y-1 hover:border-[color:var(--nsg-accent)]/40 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-[color:var(--nsg-accent)]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] sm:px-10"
            >
              <h3 className="font-serif text-2xl text-white">
                {feature.name}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-400">
                {feature.description}
              </p>
            </Link>
          ))}
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
