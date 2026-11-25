"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function SearchForm({
  initialName,
  initialBirthYear,
  initialBirthLocation,
  initialHomeLocation,
}: {
  initialName: string;
  initialBirthYear: string;
  initialBirthLocation: string;
  initialHomeLocation: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [birthYear, setBirthYear] = useState(initialBirthYear);
  const [birthLocation, setBirthLocation] = useState(initialBirthLocation);
  const [homeLocation, setHomeLocation] = useState(initialHomeLocation);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    query.set("name", trimmedName);
    if (birthYear.trim()) query.set("birthYear", birthYear.trim());
    if (birthLocation.trim()) {
      query.set("birthLocation", birthLocation.trim());
    }
    if (homeLocation.trim()) {
      query.set("homeLocation", homeLocation.trim());
    }

    startTransition(() => {
      router.push(`/search?${query.toString()}`);
    });
  }

  return (
    <form
      action="/search"
      method="get"
      onSubmit={handleSubmit}
      className="mt-10 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-12 sm:p-8"
    >
      <label
        htmlFor="search-name"
        className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--nsg-accent)]"
      >
        Name
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="search-name"
          name="name"
          type="search"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="Moment Maker"
          autoComplete="name"
          maxLength={100}
          required
          className="min-h-14 min-w-0 flex-1 rounded-full border border-[color:var(--nsg-border)]/15 bg-slate-950/60 px-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[color:var(--nsg-accent)]/70 focus:ring-2 focus:ring-[color:var(--nsg-accent)]/20"
        />
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="min-h-14 rounded-full bg-[color:var(--nsg-accent)] px-8 text-sm font-semibold tracking-wide text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
        >
          {isPending ? "Searching…" : "Search"}
        </button>
      </div>
      <fieldset className="mt-7">
        <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Optional filters
        </legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="birth-year"
              className="mb-2 block text-xs text-slate-400"
            >
              Birth Year
            </label>
            <input
              id="birth-year"
              name="birthYear"
              type="number"
              inputMode="numeric"
              value={birthYear}
              onChange={(event) => setBirthYear(event.currentTarget.value)}
              placeholder="e.g. 1955"
              className="min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/60"
            />
          </div>
          <div>
            <label
              htmlFor="birth-location"
              className="mb-2 block text-xs text-slate-400"
            >
              Birth Location
            </label>
            <input
              id="birth-location"
              name="birthLocation"
              type="text"
              value={birthLocation}
              onChange={(event) =>
                setBirthLocation(event.currentTarget.value)
              }
              placeholder="City or region"
              maxLength={100}
              className="min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/60"
            />
          </div>
          <div>
            <label
              htmlFor="home-location"
              className="mb-2 block text-xs text-slate-400"
            >
              Home Location
            </label>
            <input
              id="home-location"
              name="homeLocation"
              type="text"
              value={homeLocation}
              onChange={(event) => setHomeLocation(event.currentTarget.value)}
              placeholder="City or region"
              maxLength={100}
              className="min-h-12 w-full rounded-xl border border-[color:var(--nsg-border)]/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[color:var(--nsg-accent)]/60"
            />
          </div>
        </div>
      </fieldset>
      <p aria-live="polite" className="mt-3 min-h-5 text-center text-sm text-slate-400">
        {isPending ? "Searching Moment Maker profiles…" : ""}
      </p>
    </form>
  );
}
