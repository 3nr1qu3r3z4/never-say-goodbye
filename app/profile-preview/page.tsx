import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import FirstMessage from "./first-message";
import ProtectedMoment from "./protected-moment";

export const metadata: Metadata = {
  title: "John Michael Doe | Never Say Goodbye",
  description:
    "Explore John Michael Doe's moments, stories, and messages for the people he loves.",
};

const sharedMoments = [
  {
    title: "The Day I Met You",
    story: "Mary and I met at a neighborhood gathering. Whether at home or at the fair, she always made everyone around her feel welcome.",
    image: "/images/james-day-i-met-you.png",
    alt: "A joyful moment together at a state fair",
  },
  {
    title: "Lessons I've Learned",
    story: "Listen before you offer advice. The people you love usually need your time more than the perfect answer.",
    image: "/images/james-lessons-learned.png",
    alt: "A mechanic looking at an open car hood",
  },
  {
    title: "Meeting Mom",
    story: "I brought flowers to our first dinner together and spent the evening laughing with her family around the table.",
    image: "/images/james-meeting-mom.png",
    alt: "A family sharing a conversation in their living room",
  },
  {
    title: "Family Traditions I Carry On",
    story: "Sunday suppers were never fancy, but everyone had a place at the table and a story to share.",
    image: null,
    alt: "",
  },
];

const personalMoments = [
  "Open On Your Wedding Day",
  "When You Become A Parent",
  "On My First Grandchild's Birthday",
];

const lovedOnes = [
  {
    icon: "❤️",
    name: "Mary Elizabeth Doe",
    relationship: "Spouse",
    href: "/mary-doe",
  },
  {
    icon: "👦",
    name: "James Michael Doe",
    relationship: "Son",
    href: "/james-doe",
  },
  {
    icon: "🤝",
    name: "Emma Rose Doe",
    relationship: "Daughter",
    href: "/emma-doe",
  },
  {
    icon: "❤️",
    name: "Robert “Bobby” Hayes",
    relationship: "Lifelong Friend",
    href: "/bobby-hayes",
  },
  { icon: "❤️", name: "Sarah Doe", relationship: "Daughter-in-law", href: "#sarah-doe", id: "sarah-doe" },
  { icon: "👧", name: "Emma Doe", relationship: "Granddaughter", href: "#emma-doe-granddaughter", id: "emma-doe-granddaughter" },
  { icon: "👦", name: "Lucas Doe", relationship: "Grandson", href: "#lucas-doe-grandson", id: "lucas-doe-grandson" },
];

const treeGenerations = [
  [
    { icon: "🕊", name: "Eleanor Doe", relationship: "John's grandmother" },
  ],
  [
    { icon: "🕊", name: "Robert William Doe", relationship: "James's grandfather" },
    { icon: "🕊", name: "Margaret Doe", relationship: "James's grandmother" },
  ],
  [
    { icon: "👤", name: "John Michael Doe", relationship: "John" },
    { icon: "❤️", name: "Mary Elizabeth Doe", relationship: "Wife" },
  ],
  [
    { icon: "❤️", name: "James Michael Doe", relationship: "Son" },
    { icon: "❤️", name: "Sarah Doe", relationship: "Daughter-in-law" },
    { icon: "👧", name: "Emma Rose Doe", relationship: "Daughter" },
  ],
  [
    { icon: "👧", name: "Emma Doe", relationship: "Granddaughter" },
    { icon: "👦", name: "Lucas Doe", relationship: "Grandson" },
  ],
];

const mostVisited = [
  { icon: "❤️", name: "Sarah Doe", href: "#sarah-doe" },
  { icon: "👧", name: "Emma Doe", href: "#emma-doe-granddaughter" },
  { icon: "❤️", name: "James Michael Doe", href: "/james-doe" },
  { icon: "❤️", name: "Mary Elizabeth Doe", href: "/mary-doe" },
];

const familyEvents = [
  { icon: "🎂", title: "Emma Doe Birthday", date: "November 18" },
  { icon: "❤️", title: "James & Sarah Anniversary", date: "June 14" },
  { icon: "🎓", title: "Lucas Doe Graduation", date: "May 25" },
];

export default function ProfilePreviewPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <header className="border-b border-[#D8A35B]/20 bg-[#D8A35B]/[0.05] px-6 py-5 text-center sm:px-8">
        <p className="text-sm font-semibold text-[#f0c98e]">
          Featured Example Profile
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          Explore what a completed Never Say Goodbye profile can become.
        </p>
      </header>
      <section className="px-4 pt-4 sm:px-8 sm:pt-8">
        <figure
          aria-label="Portrait of a mature man for the John Michael Doe legacy profile"
          className="relative mx-auto h-[55svh] min-h-[24rem] max-h-[46rem] max-w-6xl overflow-hidden rounded-[1.75rem] border border-[#D8A35B]/25 bg-gradient-to-br from-[#344255] via-[#172437] to-[#101827] shadow-2xl shadow-black/30 sm:rounded-[2rem]"
        >
          <Image
            src="/mature-man-portrait.jpg"
            alt="Warm portrait of a smiling mature man"
            fill
            priority
            sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1280px) calc(100vw - 4rem), 1152px"
            className="object-cover object-[center_35%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(216,163,91,0.2),transparent_58%)]"
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
            John Michael Doe
          </h1>
          <p className="mt-4 font-serif text-base text-slate-300 sm:text-lg">
            Father <span className="px-1 text-[#D8A35B]">•</span> Veteran{" "}
            <span className="px-1 text-[#D8A35B]">•</span> Musician
          </p>
          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left">
            <div className="border-r border-white/10 p-5 sm:p-7">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                Born In
              </p>
              <p className="mt-2 font-serif text-base text-white sm:text-lg">
                San Diego, California
              </p>
            </div>
            <div className="p-5 sm:p-7">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
                Lives In
              </p>
              <p className="mt-2 font-serif text-base text-white sm:text-lg">
                Nashville, Tennessee
              </p>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-2xl text-left">
            <h2 className="font-serif text-xl text-white sm:text-2xl">
              A Little About John
            </h2>
            <p className="mt-4 leading-7 text-slate-300">
              John grew up in San Diego and made a home in Nashville with Mary.
              A veteran and lifelong musician, he finds joy in family dinners,
              old songs, and passing along the stories behind them. He hopes
              James, Emma, and the generations after them will always know how
              much the ordinary days mattered.
            </p>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]">
              Personal Motto
            </p>
            <p className="mt-2 font-serif text-lg italic text-[#f0c98e]">
              “Be present for the moments that matter.”
            </p>
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
                  June 6, 1955
                </dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Married
                </dt>
                <dd className="mt-2 text-sm text-slate-200 sm:text-base">
                  August 12, 1979
                </dd>
              </div>
            </dl>
          </div>

          <FirstMessage />
          <Link
            href="/legacy-tree"
            className="mt-3 inline-flex w-full max-w-2xl justify-center rounded-full border border-[#D8A35B]/60 bg-transparent px-7 py-3.5 text-sm font-semibold tracking-wide text-[#f0c98e] transition hover:border-[#D8A35B] hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
          >
            🌳 View Legacy Tree™
          </Link>
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
              Stories in his own words
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
                <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br from-[#4a3e34] via-[#92805f] to-[#33423b]">
                  {moment.image ? (
                    <Image src={moment.image} alt={moment.alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover" />
                  ) : (
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">Photo coming soon</span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-lg text-white">{moment.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{moment.story}</p>
                </div>
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
            Cannot Open Until™ &amp; Privacy
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            These fictional examples illustrate private and scheduled moments.
            Try the sample code JOHN2026 to see the demonstration. It unlocks
            sample text only and is not a real access control.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personalMoments.map((moment) => (
            <ProtectedMoment key={moment} title={moment} />
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

      <section aria-labelledby="family-tree-heading" className="px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            A place for every generation
          </p>
          <h2 id="family-tree-heading" className="mt-3 font-serif text-3xl text-white sm:text-4xl">
            John&apos;s Legacy Tree™
          </h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-400">
            The people who shaped John&apos;s story and the generations still to come.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Lines indicate generations, not specific parentage. Relationships are relative to John unless otherwise noted.
          </p>
          <ol className="mt-8">
            {treeGenerations.map((generation, index) => (
              <li key={generation[0].name}>
                {index > 0 && <div aria-hidden="true" className="mx-auto h-6 w-px bg-[#D8A35B]/40" />}
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                  {generation.map((person) => (
                    <li key={person.name} className="rounded-2xl border border-[#D8A35B]/20 bg-white/[0.03] p-4 text-center sm:p-5">
                      <span aria-hidden="true" className="text-xl">{person.icon}</span>
                      <p className="mt-2 font-serif text-base text-white sm:text-lg">{person.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{person.relationship}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="future-makers-heading" className="px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">For generations to come</p>
          <h2 id="future-makers-heading" className="mt-3 font-serif text-3xl text-white sm:text-4xl">Future Moment Makers™</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-400">These example moments are being preserved for people whose stories are still unfolding.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {["Future Grandchild", "Future Grandchild", "Godchild"].map((name, index) => (
              <li key={`${name}-${index}`} className="rounded-2xl border border-[#D8A35B]/25 bg-[#D8A35B]/[0.04] p-5 sm:p-6">
                <span aria-hidden="true" className="text-xl">✨</span>
                <p className="mt-3 font-serif text-lg text-white">{name}</p>
                <p className="mt-1 text-sm text-slate-400">Future Moment Maker™</p>
              </li>
            ))}
            <li className="rounded-2xl border border-[#D8A35B]/25 bg-[#D8A35B]/[0.04] p-5 sm:p-6">
              <span aria-hidden="true" className="text-xl">✨</span>
              <p className="mt-3 font-serif text-lg text-white">Debbie Doe</p>
              <p className="mt-1 text-sm text-slate-400">James has reserved a place for his daughter.</p>
              <Link href="/future-moment-maker" className="mt-3 inline-block text-sm text-[#f0c98e] underline decoration-[#D8A35B]/40 underline-offset-4 hover:text-white">Explore Debbie&apos;s example</Link>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="placeholders-heading" className="border-y border-white/10 bg-slate-950/30 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">Remembering family</p>
          <h2 id="placeholders-heading" className="mt-3 font-serif text-3xl text-white sm:text-4xl">Family Placeholders</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-400">Family members can appear in the tree even if they never had an account.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...treeGenerations[0], ...treeGenerations[1]].map((person) => (
              <li key={person.name} className="rounded-2xl border border-[#D8A35B]/25 bg-[#D8A35B]/[0.04] p-5 sm:p-6">
                <span aria-hidden="true" className="text-xl">🕊</span>
                <p className="mt-3 font-serif text-lg text-white">{person.name}</p>
                <p className="mt-1 text-sm text-slate-400">{person.relationship}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="calendar-heading" className="px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">Family Calendar™ Preview</p>
          <h2 id="calendar-heading" className="mt-3 font-serif text-3xl text-white sm:text-4xl">Upcoming Family Events</h2>
          <p className="mt-4 text-sm leading-6 text-slate-400">Example dates for this showcase, not a live calendar.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {familyEvents.map((event) => (
              <li key={event.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <span aria-hidden="true" className="text-xl">{event.icon}</span>
                <p className="mt-3 font-serif text-lg text-white">{event.title}</p>
                <p className="mt-1 text-sm text-slate-400">{event.date}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="most-visited-heading" className="px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">Close at hand</p>
          <h2 id="most-visited-heading" className="mt-3 font-serif text-3xl text-white sm:text-4xl">Most Visited Moment Makers™</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-400">A showcase of a possible future shortcut to the people John visits most.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mostVisited.map((person) => (
              <li key={person.name}>
                <Link href={person.href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-medium text-slate-200 transition hover:border-[#D8A35B]/40 hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]">
                  <span aria-hidden="true">{person.icon}</span>{person.name}
                </Link>
              </li>
            ))}
          </ul>
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
                id={"id" in person ? person.id : undefined}
                className="scroll-mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D8A35B]/30 bg-[#D8A35B]/10 text-xl"
                >
                  {person.icon}
                </span>
                <div>
                  <h3 className="font-serif text-lg text-white">
                    {"id" in person ? person.name : <Link
                      href={person.href}
                      className="transition hover:text-[#f0c98e] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                    >
                      {person.name}
                    </Link>}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {person.relationship}
                  </p>
                  {person.name === "Mary Elizabeth Doe" && (
                    <Link
                      href="/mary-doe"
                      className="mt-2 inline-flex text-sm font-medium text-[#f0c98e] transition hover:text-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                    >
                      View Mary&apos;s Moments
                    </Link>
                  )}
                  {person.name === "Robert “Bobby” Hayes" && (
                    <Link
                      href="/bobby-hayes"
                      className="mt-2 inline-flex text-sm font-medium text-[#f0c98e] transition hover:text-[#D8A35B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8A35B]"
                    >
                      View Bobby&apos;s Moments
                    </Link>
                  )}
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
              beautifully prepared Legacy Frame™. Display moments from the people
              who matter most.
              <br />
              Always connected.
              <br />
              Always close.
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
