import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Why We Exist | Never Say Goodbye",
  description:
    "Learn about the purpose, values, and intentions behind Never Say Goodbye.",
};

const sections = [
  {
    title: "Why We Exist",
    paragraphs: [
      "Every life is made up of moments.",
      "Some are extraordinary.",
      "Most are wonderfully ordinary.",
      "A familiar laugh.\nA voice message.\nA family story.\nA photo tucked away for years.",
      "These moments help define who we are and how we remember the people we love.",
      "Never Say Goodbye exists to help preserve those moments and keep them connected across generations.",
    ],
  },
  {
    title: "What Makes Never Say Goodbye Different?",
    paragraphs: [
      "Social media is built around followers, attention, and algorithms.",
      "Never Say Goodbye is built around family, friendships, and meaningful connections.",
      "We call that Family Media™.",
      "A place where moments are preserved, stories remain connected, and future generations can experience the lives that helped shape their own.",
    ],
  },
  {
    title: "What We Provide",
    features: [
      {
        title: "❤️ Connected Lives™",
        description:
          "Meaningful connections between family members, close friends, mentors, and the people who matter most.",
      },
      {
        title: "🌳 Legacy Tree™",
        description:
          "Build and preserve family relationships across generations, including Future Moment Makers™ and Family Placeholders.",
      },
      {
        title: "✨ Future Moment Makers™",
        description:
          "Create moments today for people whose stories are still unfolding.",
      },
      {
        title: "⏳ Cannot Open Until™",
        description:
          "Save a moment with a future date or milestone. Timed unlocking and delivery are not yet available.",
      },
      {
        title: "🖼 Legacy Frame™",
        description:
          "Bring moments into the home through a dedicated display designed for family memories.",
      },
    ],
  },
  {
    title: "What We Believe",
    paragraphs: [
      "The most valuable moments are rarely the ones the world sees.",
      "They are the moments shared between people who matter to one another.",
      "Every person should have control over how their story is preserved, remembered, and shared.",
    ],
  },
  {
    title: "Privacy & Ownership",
    paragraphs: [
      "Your memories belong to you.",
      "You control what is shared, who may view it, and how it is preserved.",
      "Never Say Goodbye is built around choice, ownership, and respect for personal stories.",
    ],
  },
  {
    title: "Looking Ahead",
    paragraphs: [
      "We will continue building thoughtfully.",
      "Every feature should strengthen connections, preserve memories, and help families remain connected across generations.",
      "Technology changes.",
      "Families endure.",
      "Moments matter.",
    ],
  },
  {
    title: "Closing Statement",
    paragraphs: [
      "Build it today.",
      "Leave it forever.",
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-6 py-12 text-slate-100 sm:px-8 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm text-slate-400 underline decoration-white/20 underline-offset-4 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          Never Say Goodbye
        </Link>

        <header className="mt-10 border-b border-[color:var(--nsg-border)]/10 pb-8">
          <h1 className="font-serif text-3xl leading-tight text-white sm:text-4xl">
            Built for Family.
            <br />
            Not for Followers.
          </h1>
          <div className="mt-4 max-w-2xl space-y-3 leading-7 text-slate-400">
            <p>The First Family Media Platform™</p>
            <p>
              Never Say Goodbye was created because some moments are too
              important to disappear into a timeline.
            </p>
            <p>
              We believe stories, voices, photos, and memories deserve a
              permanent place in the lives of the people they matter to most.
            </p>
            <p>Not followers.</p>
            <p>Family.</p>
          </div>
        </header>

        <div className="divide-y divide-white/10">
          {sections.map((section) => (
            <section key={section.title} className="py-7 sm:py-8">
              <h2 className="font-serif text-xl text-white">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-slate-400 sm:text-base">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
                {section.features?.map((feature) => (
                  <div key={feature.title}>
                    <h3 className="font-medium text-slate-200">
                      {feature.title}
                    </h3>
                    <p className="mt-3">{feature.description}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
