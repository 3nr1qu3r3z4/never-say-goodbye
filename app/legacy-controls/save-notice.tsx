"use client";

import { useEffect, useState } from "react";

export default function LegacyControlsSaveNotice() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const fadeTimeout = window.setTimeout(() => setVisible(false), 3500);
    const removeTimeout = window.setTimeout(() => setMounted(false), 4100);
    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(removeTimeout);
    };
  }, []);

  if (!mounted) return null;

  return (
    <p
      role="status"
      className={`rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-200 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      Legacy Controls™ saved successfully.
    </p>
  );
}
