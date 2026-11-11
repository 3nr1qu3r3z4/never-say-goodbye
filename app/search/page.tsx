import Link from "next/link";

export default function SearchPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0F172A] text-slate-100">
      <section className="relative isolate px-6 py-16 sm:px-8 sm:py-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,163,91,0.12),transparent_58%)]"
        />
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#f0c98e]"
          >
            Never Say Goodbye
          </Link>

          <header className="mt-12 text-center sm:mt-16">
            <h1 className="mt-4 font-serif text-4xl tracking-tight text-white sm:text-5xl md:text-6xl">
              Find A Moment Maker
            </h1>
            <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400 sm:text-lg">
              Search for people, stories, and the moments they chose to share.
            </p>
          </header>

          <form
            action="/search"
            method="get"
            className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:mt-12 sm:p-8"
          >
            <label
              htmlFor="search-name"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8A35B]"
            >
              Name
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="search-name"
                name="name"
                type="search"
                placeholder="Moment Maker"
                className="min-h-14 min-w-0 flex-1 rounded-full border border-white/15 bg-slate-950/60 px-5 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[#D8A35B]/70 focus:ring-2 focus:ring-[#D8A35B]/20"
              />
              <button
                type="submit"
                className="min-h-14 rounded-full bg-[#D8A35B] px-8 text-sm font-semibold tracking-wide text-[#0F172A] transition hover:bg-[#e6b66f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
              >
                Search
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
                    placeholder="e.g. 1955"
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/60"
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
                    placeholder="City or region"
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/60"
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
                    placeholder="City or region"
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#D8A35B]/60"
                  />
                </div>
              </div>
            </fieldset>
          </form>

          <section aria-labelledby="sample-result-heading" className="mt-12">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2
                id="sample-result-heading"
                className="font-serif text-2xl text-white sm:text-3xl"
              >
                Featured Moment Maker
              </h2>
            </div>

            <article className="relative overflow-hidden rounded-3xl border border-[#D8A35B]/25 bg-gradient-to-br from-slate-800/80 to-slate-900 p-6 shadow-2xl shadow-black/20 sm:p-8">
              <div
                aria-hidden="true"
                className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#D8A35B]/10 blur-3xl"
              />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#D8A35B]">
                    My Moments
                  </p>
                  <h3 className="mt-2 font-serif text-2xl text-white sm:text-3xl">
                    John Michael Doe
                  </h3>
                  <p className="mt-3 text-sm tracking-wide text-slate-300">
                    Father <span className="px-1 text-[#D8A35B]">•</span>{" "}
                    Veteran <span className="px-1 text-[#D8A35B]">•</span>{" "}
                    Musician
                  </p>
                  <p className="mt-4 text-sm text-slate-400">
                    <span className="block">
                      <span className="text-slate-500">Born:</span>{" "}
                      San Diego, California
                    </span>
                    <span className="mt-1 block">
                      <span className="text-slate-500">Called Home:</span>{" "}
                      Nashville, Tennessee
                    </span>
                  </p>
                </div>
                <Link
                  href="/profile-preview"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#D8A35B]/60 px-7 py-3 text-sm font-semibold text-[#f0c98e] transition hover:bg-[#D8A35B]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8A35B]"
                >
                  ❤️ View Moments
                </Link>
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
