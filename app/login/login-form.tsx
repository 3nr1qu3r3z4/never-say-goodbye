"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20";

export default function LoginForm() {
  const [formState, formAction, isPending] = useActionState(loginAction, {});

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[#0F172A] px-5 py-12 text-slate-100 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
      />
      <div className="relative mx-auto w-full max-w-xl">
        <Link
          href="/"
          className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e]"
        >
          Never Say Goodbye
        </Link>
        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 sm:mt-14 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D8A35B]">
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
              <label htmlFor="login-email" className="block text-sm text-slate-300">
                Email Address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={inputClassName}
              />
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
              className="min-h-12 w-full rounded-full bg-[#D8A35B] px-6 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-[#e6b66f] disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            New to Never Say Goodbye?{" "}
            <Link
              href="/signup"
              className="text-[#f0c98e] underline decoration-[#D8A35B]/40 underline-offset-4 hover:text-white"
            >
              Become A Moment Maker™
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
