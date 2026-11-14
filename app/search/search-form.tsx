"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function SearchForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = name.trim();
    if (!query) return;

    startTransition(() => {
      router.push(`/search?name=${encodeURIComponent(query)}`);
    });
  }

  return (
    <form
      action="/search"
      method="get"
      onSubmit={handleSubmit}
      className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-12 sm:p-8"
    >
      <label htmlFor="search-name" className="sr-only">
        Moment Maker name
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="search-name"
          name="name"
          type="search"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="Moment Maker name"
          autoComplete="name"
          maxLength={100}
          required
          className="min-h-14 min-w-0 flex-1 rounded-full border border-white/15 bg-slate-950/60 px-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20"
        />
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="min-h-14 rounded-full bg-[#D8A35B] px-8 text-sm font-semibold tracking-wide text-[#0F172A] transition hover:bg-[#e6b66f] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
        >
          {isPending ? "Searching…" : "Begin"}
        </button>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-center text-sm text-slate-400">
        {isPending ? "Searching Moment Maker profiles…" : ""}
      </p>
    </form>
  );
}
