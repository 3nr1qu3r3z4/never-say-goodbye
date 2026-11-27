export type MembershipPlan = {
  id: "free" | "legacy-plus" | "family-legacy" | "legacy-forever";
  name: string;
  priceCents: number;
  billing: "free" | "monthly" | "one-time";
  tagline: string;
  mostPopular?: boolean;
  available: boolean;
  inherits?: MembershipPlan["id"];
  limits: {
    videos?: { public?: number; private?: number; total?: number };
    photos?: number | null;
    stories?: number | null;
    voiceMessages?: number | null;
    cannotOpenUntilMessages?: number;
  };
  features: { text: string; planned?: boolean }[];
};

export const membershipPlans: readonly MembershipPlan[] = [
  {
    id: "free",
    name: "Free Legacy",
    priceCents: 0,
    billing: "free",
    tagline: "Start preserving memories, stories, and milestones at your own pace.",
    available: true,
    limits: { videos: { public: 3, private: 2 }, photos: 25, stories: 10, voiceMessages: 5, cannotOpenUntilMessages: 2 },
    features: [
      { text: "1 Moment Maker™ Profile" },
      { text: "Classic NSG Site Theme" },
      { text: "3 Public and 2 Private Videos" },
      { text: "25 Photos" },
      { text: "10 Stories" },
      { text: "5 Audio Moments" },
      { text: "2 Cannot Open Until™ Messages", planned: true },
      { text: "Build and grow your Legacy Tree™" },
      { text: "Printable Legacy Tree™ PDF Export" },
      { text: "Stay connected through Connected Lives™" },
      { text: "Share Moments with family only" },
      { text: "Track family dates and events with Family Calendar™" },
    ],
  },
  {
    id: "legacy-plus",
    name: "Legacy Plus",
    priceCents: 499,
    billing: "monthly",
    tagline: "A must-have for individuals actively preserving their own story and memories.",
    available: false,
    inherits: "free",
    limits: { videos: { total: 50 }, photos: null, stories: null, voiceMessages: 50, cannotOpenUntilMessages: 25 },
    features: [
      { text: "Everything in Free Legacy plus:" },
      { text: "Evergreen Legacy and Ocean Breeze Themes" },
      { text: "50 Total Videos" },
      { text: "Unlimited Photos" },
      { text: "Unlimited Stories" },
      { text: "50 Audio Moments" },
      { text: "25 Cannot Open Until™ Messages", planned: true },
      { text: "Automatic Family Reminders", planned: true },
      { text: "Scheduled Message Delivery", planned: true },
    ],
  },
  {
    id: "family-legacy",
    name: "Family Legacy",
    priceCents: 799,
    billing: "monthly",
    tagline: "Built for families who want to stay connected through every milestone, memory, and generation.",
    mostPopular: true,
    available: false,
    inherits: "legacy-plus",
    limits: { videos: { total: 250 }, photos: null, stories: null, voiceMessages: null },
    features: [
      { text: "Everything in Legacy Plus plus:" },
      { text: "250 Videos" },
      { text: "Unlimited Audio Moments" },
    ],
  },
  {
    id: "legacy-forever",
    name: "Legacy Forever",
    priceCents: 29900,
    billing: "one-time",
    tagline: "A one-time investment in preserving your family's story for future generations.",
    available: false,
    inherits: "family-legacy",
    limits: { videos: { total: 1000 } },
    features: [
      { text: "Everything in Family Legacy plus:" },
      { text: "1,000 Videos" },
      { text: "Successor Assignment" },
    ],
  },
];

export function membershipPrice(plan: MembershipPlan): string {
  if (plan.billing === "free") return "Free Forever";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: plan.billing === "monthly" ? 2 : 0,
  }).format(plan.priceCents / 100);
  return plan.billing === "monthly" ? `${amount}/month` : `${amount} One-Time`;
}
