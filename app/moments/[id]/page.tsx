import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
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
  const user = await requireUser();
  const { id } = await params;
  const moment = await getAccessibleMoment(user.id, id);
  if (!moment) notFound();

  return (
    <main className="min-h-screen bg-[#0F172A] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <article className="mx-auto max-w-3xl">
        {/* Full navigation rechecks relationships instead of using the client router cache. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/moments" className="text-sm font-semibold text-[#f0c98e] hover:underline">
          Connections and Family Moments
        </a>
        <h1 className="mt-8 break-words font-serif text-4xl text-white">{moment.title}</h1>
        <p className="mt-3 text-sm text-slate-400">By {moment.authorName}</p>
        {moment.story && (
          <p className="mt-8 whitespace-pre-wrap break-words leading-7 text-slate-300">{moment.story}</p>
        )}
        {moment.writtenMessage && (
          <p className="mt-6 whitespace-pre-wrap break-words leading-7 text-slate-300">{moment.writtenMessage}</p>
        )}
        <Link href="/dashboard" className="mt-10 inline-block text-sm font-semibold text-[#f0c98e] hover:underline">
          My Legacy
        </Link>
      </article>
    </main>
  );
}
