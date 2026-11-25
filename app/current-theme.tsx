import { getCurrentUser } from "@/lib/auth";
import { isSiteTheme } from "@/lib/site-themes";
import ThemeSync from "./theme-sync";

export default async function CurrentTheme() {
  const user = await getCurrentUser();
  const theme = user?.siteTheme ?? "classic";
  if (!isSiteTheme(theme)) {
    console.error("[appearance] Unrecognized saved site theme:", theme);
    throw new Error("Your saved site theme is not recognized.");
  }
  return <ThemeSync theme={theme} />;
}
