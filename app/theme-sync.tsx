"use client";

import { useEffect } from "react";
import type { SiteTheme } from "@/lib/site-themes";

export default function ThemeSync({ theme }: { theme: SiteTheme }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}
