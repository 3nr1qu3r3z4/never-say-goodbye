"use client";

import { useActionState, useState } from "react";
import { saveSiteTheme } from "@/app/actions/appearance";
import { siteThemes, type SiteTheme } from "@/lib/site-themes";

export default function Appearance({ selectedTheme }: { selectedTheme: SiteTheme }) {
  const [state, action, pending] = useActionState(saveSiteTheme, {});
  const [selection, setSelection] = useState(selectedTheme);

  return (
    <section id="appearance" className="mt-9 scroll-mt-6 rounded-3xl border border-[color:var(--nsg-border)]/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-11 sm:p-9" aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className="font-serif text-2xl text-white">Appearance</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Choose your site theme. All themes are available during beta; plan labels show future availability.
      </p>
      <form action={action} className="mt-6">
        <fieldset disabled={pending}>
          <legend className="font-serif text-xl text-white">Site Theme</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {siteThemes.map((theme) => (
              <label key={theme.id} className="flex cursor-pointer flex-col rounded-2xl border border-[color:var(--nsg-border)]/20 p-4 transition hover:border-[color:var(--nsg-accent)]/60 has-[:checked]:border-[color:var(--nsg-accent)] has-[:checked]:bg-[color:var(--nsg-accent)]/[0.06]">
                <span className="flex items-start gap-3">
                  <input type="radio" name="theme" value={theme.id} checked={selection === theme.id} onChange={() => setSelection(theme.id)} className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--nsg-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nsg-accent)]" />
                  <span className="font-semibold text-white">{theme.icon} {theme.name}</span>
                </span>
                <span data-theme={theme.id} aria-hidden="true" className="mt-3 flex max-w-full flex-wrap items-center gap-2 self-start rounded-xl bg-[color:var(--nsg-background)] p-2">
                  <span className="h-6 w-6 rounded-full bg-[color:var(--nsg-background)] ring-1 ring-white/40" />
                  <span className="h-6 w-6 rounded-full bg-[color:var(--nsg-accent)]" />
                  <span className="h-6 w-6 rounded-full bg-[color:var(--nsg-neutral)]" />
                  <span className="rounded-full bg-[color:var(--nsg-accent)] px-3 py-1 text-xs font-semibold text-[color:var(--nsg-background)]">Preview</span>
                </span>
                <span className="mt-3 text-xs text-slate-300">
                  {selection === theme.id ? "Currently selected" : "Select theme"}
                  {theme.futurePlan && ` · 🔒 After beta: Available with ${theme.futurePlan} and above`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {state.error && <p role="alert" className="mt-4 text-sm text-red-300">{state.error}</p>}
        {state.success && state.savedTheme === selection && <p role="status" className="mt-4 text-sm text-emerald-300">{state.success}</p>}
        <button type="submit" disabled={pending} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--nsg-accent)] px-7 py-3 text-sm font-semibold text-[color:var(--nsg-background)] transition hover:bg-[color:var(--nsg-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)] disabled:opacity-60">
          {pending ? "Saving…" : "Save Site Theme"}
        </button>
      </form>
    </section>
  );
}
