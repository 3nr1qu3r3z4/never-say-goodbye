"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  sendConnectedLivesRequest,
  type ConnectionStatus,
} from "@/app/actions/connected-lives";

const buttonClassName =
  "inline-flex min-h-14 w-full max-w-2xl items-center justify-center rounded-full bg-[color:var(--nsg-accent)] px-8 py-4 text-sm font-semibold tracking-wide text-[color:var(--nsg-background)] shadow-lg shadow-[color:var(--nsg-accent)]/10 transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] disabled:cursor-wait disabled:opacity-70";

export default function ConnectionRequestButton({
  profileUserId,
  initialStatus,
}: {
  profileUserId: string;
  initialStatus: ConnectionStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function requestConnection() {
    setMessage("");
    startTransition(async () => {
      const result = await sendConnectedLivesRequest(profileUserId);
      if (result.status) setStatus(result.status);
      setMessage(result.error ?? result.message ?? "");
    });
  }

  if (status === "connected") {
    return (
      <div className="mt-8">
        <Link href="/connected-lives" className={buttonClassName}>
          ❤️ Connected
        </Link>
      </div>
    );
  }
  if (status === "sent") {
    return (
      <div className="mt-8">
        <button type="button" disabled className={buttonClassName}>
          ❤️ Request Sent
        </button>
        <p aria-live="polite" className="mt-3 text-center text-sm text-slate-300">
          {message || "Connected Lives™ request sent."}
        </p>
      </div>
    );
  }
  if (status === "received") {
    return (
      <div className="mt-8">
        <Link href="/connected-lives" className={buttonClassName}>
          ❤️ Request Received · Review
        </Link>
        <p aria-live="polite" className="mt-3 text-center text-sm text-slate-300">
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={isPending}
        onClick={requestConnection}
        className={buttonClassName}
      >
        {isPending ? "Sending Request…" : "❤️ Add To Connected Lives™"}
      </button>
      <p
        aria-live="polite"
        className="mt-3 min-h-5 text-center text-sm text-rose-300"
      >
        {message}
      </p>
    </div>
  );
}
