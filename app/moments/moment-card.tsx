import Image from "next/image";
import type { AccessibleMoment } from "@/lib/moment-access";
import MomentActionsMenu from "./moment-actions-menu";
import VideoPreview from "./video-preview";

type CardMoment = Pick<AccessibleMoment,
  "id" | "title" | "story" | "writtenMessage" | "hasVideo" | "hasAudio" | "hasPhoto" | "authorName" | "isAuthor"
>;

export default function MomentCard({ moment }: { moment: CardMoment }) {
  const text = moment.story.trim() || moment.writtenMessage?.trim();
  return (
    <li className="relative rounded-2xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03]">
      <MomentActionsMenu momentId={moment.id} title={moment.title} isAuthor={moment.isAuthor} />
      <a
        href={`/moments/${encodeURIComponent(moment.id)}`}
        className="flex min-h-28 items-start gap-4 rounded-2xl p-4 pr-16 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] sm:p-5 sm:pr-16"
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
          {moment.hasAudio && <span className="mt-2 block text-sm text-slate-300">🎵 Audio</span>}
          {moment.hasVideo ? (
            <span className="mt-2 block text-sm text-slate-300">Video Moment</span>
          ) : !moment.hasPhoto && text ? (
            <span className="mt-2 line-clamp-2 block break-words text-sm leading-6 text-slate-300">{text}</span>
          ) : null}
        </span>
      </a>
    </li>
  );
}
