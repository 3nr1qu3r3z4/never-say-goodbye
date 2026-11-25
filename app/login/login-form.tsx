"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20";

export default function LoginForm() {
  const [formState, formAction, isPending] = useActionState(loginAction, {});

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[color:var(--nsg-background)] px-5 py-12 text-slate-100 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--nsg-accent)_12%,transparent),transparent_58%)]"
      />
      <div className="relative mx-auto w-full max-w-xl">
        <Link
          href="/"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[color:var(--nsg-accent-light)]"
        >
          Never Say Goodbye
        </Link>
        <section className="mt-10 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 sm:mt-14 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--nsg-accent)]">
            Welcome back
          </p>
          <h1 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
            Sign in to your story
          </h1>
          <p className="mt-3 leading-7 text-slate-400">
            Continue building the moments and connections that matter most.
          </p>

          <form action={formAction} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-identifier" className="block text-sm text-slate-300">
                Username
              </label>
              <input
                id="login-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                required
                className={inputClassName}
              />
              <p className="mt-2 text-xs text-slate-400">
                You can also sign in with your email address.
              </p>
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm text-slate-300"
              >
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClassName}
              />
            </div>
            {formState.error && (
              <p role="alert" className="text-sm text-rose-300">
                {formState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="min-h-12 w-full rounded-full bg-[color:var(--nsg-accent)] px-6 py-3 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-5 flex flex-col items-center gap-2 text-sm">
            <Link href="/forgot-username" className="text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 hover:text-white">
              Forgot Username?
            </Link>
            <Link href="/forgot-password" className="text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 hover:text-white">
              Forgot Password?
            </Link>
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            New to Never Say Goodbye?{" "}
            <Link
              href="/signup"
              className="text-[color:var(--nsg-accent-light)] underline decoration-[color:var(--nsg-accent)]/40 underline-offset-4 hover:text-white"
            >
              Become A Moment Maker™
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
