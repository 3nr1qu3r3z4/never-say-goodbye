export const siteThemes = [
  { id: "classic", name: "Classic NSG", icon: "🌙", colors: "Deep Navy · Gold · Cream", description: "The familiar NSG experience.", futurePlan: null },
  { id: "evergreen", name: "Evergreen Legacy", icon: "🌲", colors: "Forest Green · Warm Gold · Soft Cream", description: "Inspired by family trees and legacy.", futurePlan: "Legacy Plus" },
  { id: "sunset", name: "Sunset Memories", icon: "🌅", colors: "Deep Burgundy · Soft Gold · Warm Ivory", description: "Warm and nostalgic.", futurePlan: "Family Legacy" },
  { id: "ocean", name: "Ocean Breeze", icon: "🌊", colors: "Deep Teal · Silver · Soft White", description: "Clean, calm, and modern.", futurePlan: "Legacy Plus" },
  { id: "lavender", name: "Lavender Fields", icon: "💜", colors: "Lavender · Deep Purple · Pearl White", description: "Soft and welcoming.", futurePlan: "Family Legacy" },
  { id: "cottage", name: "Country Cottage", icon: "🏡", colors: "Warm Brown · Sage Green · Soft Beige", description: "Comfortable and family-oriented.", futurePlan: "Family Legacy" },
] as const;

export type SiteTheme = (typeof siteThemes)[number]["id"];

export function isSiteTheme(value: unknown): value is SiteTheme {
  return typeof value === "string" && siteThemes.some((theme) => theme.id === value);
}
