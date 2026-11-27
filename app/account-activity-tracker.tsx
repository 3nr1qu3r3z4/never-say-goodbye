"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AccountActivityTracker() {
  const pathname = usePathname();
  const authenticated = useRef(false);
  const lastSent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recordActivity = useCallback(() => {
    lastSent.current = Date.now();
    fetch("/api/account-activity", { method: "POST", keepalive: true }).then((response) => {
      if (response.status === 401) {
        authenticated.current = false;
      } else if (response.ok) {
        authenticated.current = true;
      } else {
        console.error("[account-activity] Activity recording failed.");
      }
    }).catch((error: unknown) => {
      console.error("[account-activity] Activity recording failed.", error);
    });
  }, []);

  useEffect(() => {
    if (pathname) recordActivity();
  }, [pathname, recordActivity]);

  useEffect(() => {
    function activity() {
      if (!authenticated.current) return;
      const delay = 30_000 - (Date.now() - lastSent.current);
      if (delay <= 0) {
        if (pending.current) clearTimeout(pending.current);
        pending.current = null;
        recordActivity();
      } else if (!pending.current) {
        pending.current = setTimeout(() => {
          pending.current = null;
          recordActivity();
        }, delay);
      }
    }
    function flush() {
      if (pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
        recordActivity();
      }
    }
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [recordActivity]);
  return null;
}
