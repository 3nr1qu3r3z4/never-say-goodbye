"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function SiteVisitTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    fetch("/api/site-visit", {
      method: "POST",
      headers: { "X-NSG-Analytics": "1" },
      keepalive: true,
    }).then((response) => {
      if (!response.ok) console.error("[site-analytics] Visit recording failed.");
    }).catch((error: unknown) => {
      console.error("[site-analytics] Visit recording failed.", error);
    });
  }, [pathname]);

  return null;
}
