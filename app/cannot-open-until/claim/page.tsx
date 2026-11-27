import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { cannotOpenUntilEnabled } from "@/lib/cannot-open-until";
import ClaimForm from "./claim-form";

export const instant = false;

export default async function ClaimPage() {
  if (!cannotOpenUntilEnabled()) notFound();
  const user = await getCurrentUser();
  return <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-12 text-slate-100">
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-4xl text-white">Claim a Cannot Open Until™ Moment</h1>
      <ClaimForm signedIn={Boolean(user)} />
    </div>
  </main>;
}
