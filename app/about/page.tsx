import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Why We Exist | Never Say Goodbye",
  description:
    "Learn about the purpose, values, and intentions behind Never Say Goodbye.",
};

const sections = [
  {
    title: "Our Purpose",
    paragraphs: [
      "Never Say Goodbye exists to help people preserve the stories, voices, and everyday moments that make a life their own.",
      "We create a place to hold those memories close and share them with the people who matter, today and in the years ahead.",
    ],
  },
  {
    title: "What We Believe",
    paragraphs: [
      "A life is made of more than milestones. The small details, familiar words, and stories passed between people are worth keeping.",
      "Everyone should be able to shape how their story is remembered and choose what they share, with whom, and when.",
    ],
  },
  {
    title: "What We Provide",
    paragraphs: [
      "Never Say Goodbye offers tools to record moments, build a personal profile, connect with family and friends, and leave messages for future dates or milestones.",
      "These tools are meant to make it easier to preserve and share what feels meaningful to you.",
    ],
  },
  {
    title: "Who It's For",
    paragraphs: [
      "It is for people who want to tell their stories in their own words, and for families and friends who want to keep those stories connected across generations.",
      "You can begin with a single memory or build something over time, at your own pace.",
    ],
  },
  {
    title: "What We Are Not",
    paragraphs: [
      "We are not a replacement for being present with one another, and we are not a public feed that asks you to share everything.",
      "A digital memory should not be your only copy of something irreplaceable. Keep your own backups of important photos, recordings, and writing.",
    ],
  },
  {
    title: "Privacy and Ownership",
    paragraphs: [
      "Your memories are personal. Use the available audience and privacy settings to decide what you share and who can see it.",
      "Only add content you have the right to share, and take a moment to review the audience before making a memory or profile available to others.",
    ],
  },
  {
    title: "Looking Ahead",
    paragraphs: [
      "We want Never Say Goodbye to grow thoughtfully, with care for the people and stories entrusted to it.",
      "We will keep working to make it easier to preserve a presence, share meaningful moments, and stay connected across time.",
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0F172A] px-6 py-12 text-slate-100 sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm text-slate-400 underline decoration-white/20 underline-offset-4 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          Never Say Goodbye
        </Link>

        <header className="mt-10 border-b border-white/10 pb-8">
          <h1 className="font-serif text-3xl leading-tight text-white sm:text-4xl">
            Why We Exist
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            A little about the purpose and care behind Never Say Goodbye.
          </p>
        </header>

        <div className="divide-y divide-white/10">
          {sections.map((section) => (
            <section key={section.title} className="py-7 sm:py-8">
              <h2 className="font-serif text-xl text-white">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-slate-400 sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
