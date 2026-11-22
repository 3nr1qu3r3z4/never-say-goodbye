import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccessibleMoments } from "@/lib/moment-access";
import MomentActionsMenu from "./moment-actions-menu";
import VideoPreview from "./video-preview";

export const metadata: Metadata = {
  title: "Shared Moments | Never Say Goodbye",
};
export const instant = false;

export default async function MomentsPage() {
  const user = await requireUser();
  const moments = await getAccessibleMoments(user.id);

  return (
    <main className="min-h-screen bg-[#0F172A] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm font-semibold text-[#f0c98e] hover:underline">
          My Legacy
        </Link>
        <h1 className="mt-8 font-serif text-4xl text-white">Shared Moments</h1>
        <p className="mt-4 leading-7 text-slate-400">
          Your Shared Moments and moments shared with your Connected Lives™ or Family audience appear here.
        </p>
        {moments.length ? (
          <ul className="mt-8 space-y-3">
            {moments.map((moment) => {
              const text = moment.story.trim() || moment.writtenMessage?.trim();
              return (
                <li key={moment.id} className="relative rounded-2xl border border-white/10 bg-white/[0.03]">
                  <MomentActionsMenu momentId={moment.id} title={moment.title} isAuthor={moment.isAuthor} />
                  <a
                    href={`/moments/${encodeURIComponent(moment.id)}`}
                    className="flex min-h-28 items-start gap-4 rounded-2xl p-4 pr-16 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B] sm:p-5 sm:pr-16"
                  >
                    {moment.hasVideo ? (
                      <VideoPreview momentId={moment.id} />
                    ) : moment.hasPhoto ? (
                      <Image
                        src={`/api/moments/${encodeURIComponent(moment.id)}/photo`}
                        alt=""
                        width={128}
                        height={128}
                        unoptimized
                        className="aspect-square w-24 shrink-0 rounded-xl object-cover sm:w-32"
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block min-h-11 break-words font-serif text-xl leading-7 text-white">{moment.title}</span>
                      <span className="mt-1 block text-sm text-slate-400">By {moment.authorName}</span>
                      {moment.hasVideo ? (
                        <span className="mt-2 block text-sm text-slate-300">Video Moment</span>
                      ) : !moment.hasPhoto && text ? (
                        <span className="mt-2 line-clamp-2 block break-words text-sm leading-6 text-slate-300">{text}</span>
                      ) : null}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
            No Shared Moments are available yet.
          </p>
        )}
      </div>
    </main>
  );
}
