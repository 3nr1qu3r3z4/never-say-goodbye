import Link from "next/link";
import type { ReactNode } from "react";

export default function RecoveryShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[color:var(--nsg-background)] px-5 py-12 text-slate-100 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]"
      />
      <div className="relative mx-auto w-full max-w-xl">
        <Link href="/" className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[color:var(--nsg-accent-light)]">
          Never Say Goodbye
        </Link>
        <section className="mt-10 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 sm:mt-14 sm:p-10">
          <h1 className="font-serif text-3xl text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 leading-7 text-slate-400">{description}</p>
          {children}
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 hover:text-white">
              Return to Sign In
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
