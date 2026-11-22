"use client";

import { useEffect, useRef, useState } from "react";

export default function VideoPreview({ momentId }: { momentId: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const frameId = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frameId);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-slate-800 sm:w-32">
      {visible && (
        <video
          src={`/api/moments/${encodeURIComponent(momentId)}/video#t=0.001`}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="pointer-events-none h-full w-full object-cover"
        />
      )}
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/20 text-3xl text-white">▶</span>
    </div>
  );
}
