import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { cannotOpenUntilEnabled, getAccessibleTimeCapsule, getReceivedTimeCapsule } from "@/lib/cannot-open-until";
import { formatTimeCapsuleInstant } from "@/lib/time-capsule-schedule";
import LockedCountdown from "./locked-countdown";

export const instant = false;

export default async function ReceivedTimeCapsulePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!cannotOpenUntilEnabled(user.id)) notFound();
  const { id } = await params;
  const listing = await getReceivedTimeCapsule(user.id, id);
  if (!listing) notFound();
  const moment = listing.released ? await getAccessibleTimeCapsule(user.id, id) : null;
  if (listing.released && !moment) notFound();
  return <main className="min-h-screen bg-[color:var(--nsg-background)] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
    <article className="mx-auto max-w-3xl">
      <Link href="/cannot-open-until/inbox" className="text-sm font-semibold text-[color:var(--nsg-accent-light)] hover:underline">Received Moments</Link>
      <h1 className="mt-8 break-words font-serif text-4xl text-white">{listing.title}</h1>
      <p className="mt-3 text-sm text-slate-400">From {listing.sender}</p>
      <p className="mt-2 text-sm text-slate-400">Opens: {formatTimeCapsuleInstant(listing.unlockAt, listing.releaseTimezone) ?? "Open time unavailable"} ({listing.releaseTimezone})</p>
      {!moment ? <section className="mt-8 rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-6">
        <h2 className="font-serif text-2xl text-white">Locked until release</h2>
        <p className="mt-3 leading-7 text-slate-300">This Moment will be available when it is released. The sender may also release it earlier.</p>
        <LockedCountdown unlockAt={listing.unlockAt} />
      </section> : <>
        <p className="mt-8 text-sm font-semibold text-[color:var(--nsg-accent-light)]">Released</p>
        {moment.story && <p className="mt-5 whitespace-pre-wrap break-words leading-7 text-slate-300">{moment.story}</p>}
        {moment.writtenMessage && <p className="mt-5 whitespace-pre-wrap break-words leading-7 text-slate-300">{moment.writtenMessage}</p>}
        {moment.hasPhoto && <Image src={`/api/moments/${encodeURIComponent(moment.id)}/photo`} alt={`Photo for ${moment.title}`} width={1600} height={1600} unoptimized className="mt-8 max-h-[42rem] w-auto max-w-full rounded-2xl object-contain" />}
        {moment.hasVideo && <video controls playsInline preload="metadata" src={`/api/moments/${encodeURIComponent(moment.id)}/video`} aria-label={`Video for ${moment.title}`} className="mt-8 aspect-video w-full rounded-2xl bg-black">Your browser does not support video playback.</video>}
        {moment.hasAudio && <audio controls preload="metadata" src={`/api/moments/${encodeURIComponent(moment.id)}/audio`} aria-label={`Audio for ${moment.title}`} className="mt-8 w-full">Your browser does not support audio playback.</audio>}
        {moment.tags && <p className="mt-6 break-words text-sm text-slate-400">Tags: {moment.tags}</p>}
      </>}
    </article>
  </main>;
}
