import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAccessibleMoment } from "@/lib/moment-access";

export const metadata: Metadata = {
  title: "Shared Moment | Never Say Goodbye",
};
export const instant = false;

export default async function MomentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const moment = await getAccessibleMoment(user?.id ?? null, id);
  if (!moment) notFound();
  const attachments = [
    { label: "Photo", name: moment.photoData ? null : moment.photoName },
    { label: "Video", name: moment.hasVideo ? null : moment.videoName },
    { label: "Voice recording", name: moment.voiceName },
  ].filter((attachment) => attachment.name);

  return (
    <main className="min-h-screen bg-[#0F172A] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <article className="mx-auto max-w-3xl">
        {user ? (
          <>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/moments" className="text-sm font-semibold text-[#f0c98e] hover:underline">
              Shared Moments
            </a>
          </>
        ) : (
          <a href={`/moment-maker/${encodeURIComponent(moment.authorId)}`} className="text-sm font-semibold text-[#f0c98e] hover:underline">
            Moment Maker Profile
          </a>
        )}
        <h1 className="mt-8 break-words font-serif text-4xl text-white">{moment.title}</h1>
        <p className="mt-3 text-sm text-slate-400">By {moment.authorName}</p>
        {moment.story && (
          <p className="mt-8 whitespace-pre-wrap break-words leading-7 text-slate-300">{moment.story}</p>
        )}
        {moment.writtenMessage && (
          <p className="mt-6 whitespace-pre-wrap break-words leading-7 text-slate-300">{moment.writtenMessage}</p>
        )}
        {moment.photoData && (
          <Image
            src={moment.photoData}
            alt={`Photo for ${moment.title}`}
            width={1600}
            height={1600}
            unoptimized
            className="mt-8 max-h-[42rem] w-auto max-w-full rounded-2xl object-contain"
          />
        )}
        {moment.hasVideo && (
          <video
            controls
            playsInline
            preload="metadata"
            src={`/api/moments/${encodeURIComponent(moment.id)}/video`}
            aria-label={`Video for ${moment.title}`}
            className="mt-8 aspect-video w-full rounded-2xl bg-black"
          >
            Your browser does not support video playback.
          </video>
        )}
        {moment.tags && <p className="mt-6 break-words text-sm text-slate-400">Tags: {moment.tags}</p>}
        {attachments.length > 0 && (
          <section className="mt-8 text-sm text-slate-400">
            <h2 className="font-semibold text-slate-200">Selected media</h2>
            <p className="mt-2">Only file names were saved; these files were not uploaded with the moment.</p>
            <ul className="mt-2 space-y-1">
              {attachments.map((attachment) => (
                <li key={attachment.label} className="break-words">{attachment.label}: {attachment.name}</li>
              ))}
            </ul>
          </section>
        )}
        {user && (
          <Link href="/dashboard" className="mt-10 inline-block text-sm font-semibold text-[#f0c98e] hover:underline">
            My Legacy
          </Link>
        )}
      </article>
    </main>
  );
}
