"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LockedCountdown({ unlockAt }: { unlockAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const deadline = Date.parse(unlockAt);
    if (!Number.isFinite(deadline)) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [unlockAt]);

  if (remaining === null) return null;
  if (remaining === 0) return <p className="mt-4 text-sm text-slate-300">
    The open time has arrived.{" "}
    <button type="button" onClick={() => router.refresh()} className="underline">Check availability</button>
  </p>;
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return <div className="mt-4 text-sm text-slate-300">
    <p>Opens in {days}d {hours}h {minutes}m {seconds}s</p>
    <p className="mt-1 text-xs text-slate-400">Countdown uses this device&apos;s clock. Access is checked by the server.</p>
    <button type="button" onClick={() => router.refresh()} className="mt-2 underline">Check for early release</button>
  </div>;
}
