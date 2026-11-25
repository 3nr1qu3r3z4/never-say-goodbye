import type { Metadata } from "next";
import Link from "next/link";
import { membershipPlans, membershipPrice } from "@/lib/membership-plans";

export const metadata: Metadata = {
  title: "Help Center | Never Say Goodbye",
  description: "Guides, frequently asked questions, and support for Never Say Goodbye.",
};

const guides = [
  {
    id: "getting-started",
    title: "Getting Started",
    screenshot: "Account and profile settings",
    href: "/signup",
    link: "Create an account",
    questions: [
      {
        question: "How do I create an account?",
        steps: [
          "Choose Create Your Legacy, enter your account details, and choose a display name.",
          "Choose your profile visibility, select Free Legacy, accept the required agreements, and create your account.",
        ],
      },
      {
        question: "How do I complete my profile and choose visibility?",
        steps: [
          "From My Legacy, open My Profile and choose View Profile, then Edit Profile Setup. Add the details and photo you want and save. When uploading a profile photo, drag and zoom to choose the square crop shown on your profile.",
          "Open My Profile → Legacy Controls™ to change profile visibility and the information you share. Save your changes.",
        ],
      },
      {
        question: "What is the difference between searchable and hidden?",
        answer: "Searchable Only and Public profiles can appear in Search; the profile and content shown still depend on visibility settings. Private profiles are hidden from Search. You can change this choice later in Legacy Controls™.",
      },
    ],
  },
  {
    id: "connected-lives",
    title: "Connected Lives™",
    screenshot: "Finding and connecting with someone",
    href: "/connected-lives",
    link: "Open Connected Lives™",
    questions: [
      {
        question: "What are Connected Lives™?",
        answer: "Connected Lives™ are accepted connections with family, friends, and others who matter to you. Connecting does not automatically add someone to a Legacy Tree™.",
      },
      {
        question: "How do I send or accept a request?",
        steps: [
          "Use Find People to search by name, open a profile, and choose Add To Connected Lives™.",
          "To respond to a request, open Connected Lives™ and find Pending Connection Requests at the top. Choose a relationship before accepting, or decline the request.",
        ],
      },
      {
        question: "Why can't I find someone?",
        answer: "Check their display name and ask whether their profile is Searchable Only or Public. Private profiles do not appear in Search. A person must have an account to receive a connection request.",
      },
    ],
  },
  {
    id: "legacy-tree",
    title: "Legacy Tree™",
    screenshot: "Adding a family member to a tree",
    href: "/legacy-tree",
    link: "Open Legacy Tree™",
    questions: [
      {
        question: "How do I build a tree and add family?",
        steps: [
          "Open Legacy Tree™ from My Legacy. If you do not belong to a tree, choose Create My Legacy Tree.",
          "Choose Add Family Member, select the tree and member type, enter the relationship, and submit. Existing Moment Makers must be searchable when they are added.",
        ],
      },
      {
        question: "How are family relationships displayed?",
        answer: "Relationship labels are entered by the person adding a member and may reflect their perspective. The tree shows membership rather than automatically inferring generations or creating Connected Lives™ connections.",
      },
      {
        question: "Are Family Placeholders available?",
        answer: "Yes. You can add a Family Placeholder™ with a name and relationship, plus optional years and notes. Placeholders are not accounts: they cannot sign in or receive notifications. Additional placeholder capabilities may come later.",
      },
      {
        question: "How do family milestones appear on the calendar?",
        answer: "Add milestones within a Legacy Tree™. Saving shares them with that tree, and they appear in its Family Calendar™ automatically. Account holders manage their own milestones and can allow tree owners and admins to manage them; owners and admins can also manage placeholder and Honored Life™ milestones. Dates without a known day appear separately rather than on an invented day. Existing family-date sharing choices still apply.",
      },
    ],
  },
  {
    id: "honored-lives",
    title: "Honored Lives™",
    screenshot: "Creating an Honored Life",
    href: "/honored-lives",
    link: "Open Honored Lives™",
    questions: [
      {
        question: "What is an Honored Life™ and how do I create one?",
        steps: [
          "An Honored Life preserves a loved one's story within a Legacy Tree™ and is visible to that tree's members.",
          "A tree owner or administrator can open Honored Lives™, choose a tree and an existing placeholder or create a new one, then add a name, relationship, optional dates, short story, and photo.",
        ],
      },
      {
        question: "Can I add videos or invite family contributions?",
        answer: "An Honored Life currently supports one optional profile photo and a short story, not video uploads or contributor permissions. Family members can view it when they belong to the tree. Shared Moments are a separate way to share memories and videos with an authorized audience.",
      },
    ],
  },
  {
    id: "creating-moments",
    title: "Creating Moments",
    screenshot: "Creating and viewing a Shared Moment",
    href: "/create-moment",
    link: "Create a Moment",
    questions: [
      {
        question: "How do I create and publish a Shared Moment?",
        steps: [
          "From My Legacy, choose Create Moment → Shared Moment. Add a title and a story, written message, photo, or video.",
          "Select Photo or Video and choose a file if desired. Wait for it to be prepared or uploaded, then choose your audience and select Publish Moment. You can also save a draft.",
        ],
      },
      {
        question: "How do I view or delete a published Moment?",
        steps: [
          "Open Shared Moments from My Legacy or a visible Moment Maker profile and select a Moment's title or preview, or choose View Moment from its three-dot menu.",
          "To delete your own Shared Moment, open its three-dot menu, choose Delete Moment, and confirm. Deletion is permanent. Editing published Moments is not available yet.",
        ],
      },
      {
        question: "Can every Moment type be opened and shared?",
        answer: "The current viewing experience is for Shared Moments. Protected and Cannot Open Until™ unlocks and Future Moment Maker™ recipient access are not yet available.",
      },
    ],
  },
  {
    id: "photos-videos",
    title: "Photos & Videos",
    screenshot: "Selecting a photo or video",
    href: "/create-moment/shared",
    link: "Create a Shared Moment",
    questions: [
      {
        question: "Which photos and videos can I upload?",
        answer: "Shared Moment photos support JPG, JPEG, PNG, WEBP, HEIC, and HEIF, up to 20 MB before optimization. A Shared Moment can contain one MP4, MOV, or M4V video up to 100 MiB (104,857,600 bytes; approximately 100 MB). Video playback depends on the browser and the video's codec.",
      },
      {
        question: "Why might an upload or playback fail?",
        answer: "Check the format, file size, and internet connection, then try again. A supported video container can still use a codec your browser cannot play. Older filename-only selections were not uploaded; select the original file again in a draft. Previously published filename-only Moments must be recreated.",
      },
      {
        question: "Why can't a family member see my media?",
        answer: "Media follows the Shared Moment's audience. Connections Only requires an accepted connection; Family Only requires membership in the same Legacy Tree™. Private is author-only. Public viewing also depends on the author's profile and public Shared Moment visibility settings. Photos and videos inherit these same checks.",
      },
    ],
  },
  {
    id: "moments-in-the-making",
    title: "Moments in the Making ❤️",
    screenshot: "Recent activity on My Legacy",
    href: "/dashboard",
    link: "Open My Legacy",
    questions: [
      {
        question: "What is Moments in the Making?",
        answer: "This card on My Legacy shows up to five recent items: accessible Shared Moments from your accepted Connected Lives™ and people in a shared Legacy Tree™, and Family Shout-Outs from your trees. It identifies uploaded photos, videos, and written messages when present.",
      },
      {
        question: "How do I view an activity, and why might one be missing?",
        answer: "Choose View Moment or View Shout-Out on an item. Only items you are currently authorized to view appear; audience settings, relationship or tree membership, deletion, or the five-item limit can affect what you see. Drafts and other Moment types are not included.",
      },
      {
        question: "How do Family Shout-Outs work?",
        answer: "Open Family Calendar™, select a Legacy Tree™, and share a quick note of up to 300 characters in Family Shout-Outs. Current members of that tree can read and share shout-outs. Shout-out emails are not sent yet.",
      },
    ],
  },
];

const sectionClassName = "scroll-mt-6 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 sm:p-7";
const linkClassName = "inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]";

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">Here for your family</p>
          <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">Help Center</h1>
          <p className="mt-5 text-lg text-slate-300">Everything you need to know about Never Say Goodbye.</p>
          <p className="mt-2 font-serif text-xl text-[color:var(--nsg-accent-light)]">Life gets busy. Family shouldn&apos;t have to wait.</p>
        </header>

        <nav aria-label="Help Center topics" className="mt-8 flex flex-wrap gap-2">
          {[...guides, { id: "membership", title: "Membership Plans" }, { id: "support", title: "Support & Account Help" }, { id: "ideas", title: "Have an Idea?" }].map((section) => (
            <a key={section.id} href={`#${section.id}`} className="inline-flex min-h-11 items-center rounded-full border border-[color:var(--nsg-border)]/10 px-4 text-sm text-slate-300 hover:border-[color:var(--nsg-accent)]/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]">
              {section.title}
            </a>
          ))}
        </nav>

        <div className="mt-10 space-y-5">
          {guides.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className={sectionClassName}>
              <h2 id={`${section.id}-heading`} className="font-serif text-2xl text-white">{section.title}</h2>
              {section.id === "getting-started" && (
                <p className="mt-4 rounded-xl border border-[color:var(--nsg-accent)]/30 bg-[color:var(--nsg-accent)]/[0.06] p-4 text-sm leading-6 text-slate-200">
                  <strong className="text-[color:var(--nsg-accent-light)]">Important:</strong> To be found in Search or added as an existing member of a Legacy Tree™, set your profile to Searchable Only or Public. After connecting and being added to the tree, you can return it to Private. Public Moment visibility also depends on this setting.
                </p>
              )}
              <div className="mt-4 divide-y divide-white/10">
                {section.questions.map((item) => (
                  <details key={item.question} className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-slate-200 hover:text-[color:var(--nsg-accent-light)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] [&::-webkit-details-marker]:hidden">
                      {item.question}<span aria-hidden="true" className="text-[color:var(--nsg-accent)] group-open:rotate-45">+</span>
                    </summary>
                    {"answer" in item && item.answer && <p className="pb-4 text-sm leading-6 text-slate-400">{item.answer}</p>}
                    {"steps" in item && item.steps && (
                      <ol className="list-decimal space-y-2 pb-4 pl-5 text-sm leading-6 text-slate-400">
                        {item.steps.map((step) => <li key={step}>{step}</li>)}
                      </ol>
                    )}
                  </details>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-[color:var(--nsg-border)]/20 px-4 py-5 text-sm text-slate-500">
                📷 Screenshot Coming Soon: {section.screenshot}
              </div>
              <Link href={section.href} className={`mt-3 ${linkClassName}`}>{section.link} <span aria-hidden="true" className="ml-2">→</span></Link>
            </section>
          ))}

          <section id="membership" aria-labelledby="membership-heading" className={sectionClassName}>
            <h2 id="membership-heading" className="font-serif text-2xl text-white">Membership Plans</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Free Legacy is the only membership available for new accounts. Paid plans are coming soon, and plan limits are not enforced during beta.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {membershipPlans.map((plan) => (
                <div key={plan.id} className={`rounded-xl border p-4 ${plan.mostPopular ? "border-[color:var(--nsg-accent)]/60" : "border-[color:var(--nsg-border)]/10"}`}>
                  <h3 className="font-semibold text-white">{plan.name}{plan.mostPopular && <span className="ml-2 text-xs text-[color:var(--nsg-accent-light)]">⭐ Most Popular</span>}</h3>
                  <p className="mt-1 font-serif text-[color:var(--nsg-accent-light)]">{membershipPrice(plan)}</p>
                  <p className="mt-2 text-sm text-slate-400">{plan.available ? "Available now" : "Coming Soon"}</p>
                </div>
              ))}
            </div>
            <Link href="/pricing" className={`mt-4 ${linkClassName}`}>Compare plans and planned features <span aria-hidden="true" className="ml-2">→</span></Link>
          </section>

          <section id="support" aria-labelledby="support-heading" className={sectionClassName}>
            <h2 id="support-heading" className="font-serif text-2xl text-white">Support &amp; Account Help</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">For bugs, account problems, or media issues, contact <a className={linkClassName} href="mailto:NeverSayGoodbye.life@yahoo.com">NeverSayGoodbye.life@yahoo.com</a>.</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">When contacting support, include your email address, device type, a description of the issue, and screenshots if available. Do not send your password.</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">Forgot your password? Use <Link href="/forgot-password" className={linkClassName}>Forgot Password</Link> to request a reset. For other account issues, contact support.</p>
          </section>

          <section id="ideas" aria-labelledby="ideas-heading" className={sectionClassName}>
            <h2 id="ideas-heading" className="font-serif text-2xl text-white">Have an Idea?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Many of Never Say Goodbye&apos;s best improvements come directly from families using the platform every day.</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">Share ideas for Moments, Connected Lives™, Legacy Tree™, Honored Lives™, Future Moment Makers™, photos, or videos with <a className={linkClassName} href="mailto:NeverSayGoodbye.life@yahoo.com">NeverSayGoodbye.life@yahoo.com</a>.</p>
            <p className="mt-4 font-serif text-lg text-slate-200">Never Say Goodbye is being built with families, not just for families.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
