import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create A Moment | Never Say Goodbye",
  description: "Choose how you would like to preserve this moment.",
};
export const instant = false;

const momentTypes = [
  {
    href: "/create-moment/shared",
    icon: "❤️",
    title: "Shared Moment",
    description:
      "Keep a story close and share it with the people you choose.",
  },
  {
    href: "/create-moment/personal",
    icon: "🔒",
    title: "Personal Moment",
    description:
      "Create a private message, protected by your access preferences.",
  },
  {
    href: "/create-moment/cannot-open-until",
    icon: "⏳",
    title: "Cannot Open Until™",
    description: "Save a moment for a future date or meaningful milestone.",
  },
  {
    href: "/create-moment/future-moment-maker",
    icon: "✨",
    title: "Future Moment Maker™",
    description:
      "Begin a collection for someone whose story is still unfolding.",
  },
];

export default async function CreateMomentPage() {
  await requireUser();
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
      />
      <div className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          My Legacy
        </Link>

        <header className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
            A story worth keeping
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-white sm:text-5xl">
            Create A Moment
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-serif text-lg leading-7 text-slate-300 sm:text-xl">
            Every story begins with a moment.
          </p>
          <p className="mt-6 text-sm text-slate-400">
            Choose the kind of story you would like to create.
          </p>
        </header>

        <section
          aria-label="Choose a moment type"
          className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2"
        >
          {momentTypes.map((type) => (
            <Link
              key={type.href}
              href={type.href}
              className="group flex min-h-44 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-200 hover:-translate-y-1 hover:border-[#D8A35B]/45 hover:bg-white/[0.06] hover:shadow-xl hover:shadow-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
            >
              <span aria-hidden="true" className="text-3xl">
                {type.icon}
              </span>
              <h2 className="mt-4 font-serif text-xl text-white transition group-hover:text-[#f0c98e]">
                {type.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {type.description}
              </p>
            </Link>
          ))}
        </section>

        <footer className="py-12 text-center">
          <p className="font-serif text-xl leading-relaxed text-white">
            Build it today.
            <br />
            Leave it forever.
          </p>
        </footer>
      </div>
    </main>
  );
}
