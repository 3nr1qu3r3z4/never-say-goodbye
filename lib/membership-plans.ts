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
    profiles?: number;
    videos?: { public?: number; private?: number; total?: number };
    photos?: number | null;
    stories?: number | null;
    voiceMessages?: number | null;
    cannotOpenUntilMessages?: number;
    futureDeliveries?: number | null;
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
    limits: { profiles: 1, videos: { public: 3, private: 2 }, photos: 25, stories: 10, voiceMessages: 5, cannotOpenUntilMessages: 2 },
    features: [
      { text: "1 Moment Maker™ Profile" },
      { text: "Classic NSG Site Theme" },
      { text: "3 Public Videos" },
      { text: "2 Private Videos" },
      { text: "25 Photos" },
      { text: "10 Stories" },
      { text: "5 Audio Moments", planned: true },
      { text: "2 Cannot Open Until™ Messages", planned: true },
      { text: "Legacy Tree™ Preview" },
      { text: "Legacy Tree™ PDF Export" },
      { text: "Family Calendar™ with Shared Dates" },
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
      { text: "50 Audio Moments", planned: true },
      { text: "25 Cannot Open Until™ Messages", planned: true },
      { text: "Personal Never Forget™ Calendar", planned: true },
      { text: "Birthday, Anniversary, and Custom Reminders", planned: true },
      { text: "Scheduled Message Delivery", planned: true },
      { text: "Basic Legacy Tree™" },
      { text: "Private Family Sharing" },
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
    limits: { profiles: 5, videos: { total: 250 }, photos: null, stories: null, voiceMessages: null, futureDeliveries: null },
    features: [
      { text: "Everything in Legacy Plus plus:" },
      { text: "Up to 5 Family Profiles", planned: true },
      { text: "Connected Lives™" },
      { text: "Full Legacy Tree™" },
      { text: "250 Videos" },
      { text: "Unlimited Audio Moments", planned: true },
      { text: "Unlimited Future Deliveries", planned: true },
      { text: "Full Never Forget™ Family Calendar", planned: true },
      { text: "Shared Birthdays, Anniversaries, and Family Milestones" },
      { text: "Family Event Tracking" },
      { text: "Family Sharing & Management", planned: true },
      { text: "Legacy Vault Export", planned: true },
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
    limits: { profiles: 10, videos: { total: 1000 }, futureDeliveries: null },
    features: [
      { text: "Everything in Family Legacy plus:" },
      { text: "Up to 10 Family Profiles", planned: true },
      { text: "1,000 Videos" },
      { text: "Expanded Preservation Storage", planned: true },
      { text: "Future Theme Packs Included", planned: true },
      { text: "Successor Assignment", planned: true },
      { text: "Digital Executor Designation", planned: true },
      { text: "Permanent Family Stewardship Tools", planned: true },
      { text: "Complete Legacy Vault Export", planned: true },
      { text: "Early Access to Premium Features", planned: true },
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
