"use client";

import { startTransition, useEffect } from "react";
import { recordProfileVisit } from "@/app/actions/profile-visits";

export default function VisitTracker({ profileId }: { profileId: string }) {
  useEffect(() => {
    startTransition(() => {
      void recordProfileVisit(profileId).catch(() => {
        console.error("[frequently-visited] Could not record profile visit.");
      });
    });
  }, [profileId]);
  return null;
}
