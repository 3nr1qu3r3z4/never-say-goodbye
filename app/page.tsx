export default function Page() {
  return (
    <main className="min-h-screen bg-[#0F172A] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] via-slate-900 to-[#0F172A]" />
        <div className="relative mx-auto flex min-h-[90vh] max-w-7xl flex-col items-center justify-center px-6 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#D8A35B]">Connection Beyond Goodbye</p>
          <h1 className="max-w-5xl text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl">Never Say Goodbye</h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-slate-300 md:text-2xl">Preserve your voice. Share your story. Leave messages for the people you love.</p>
          <div className="mt-12 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
            <button className="w-full rounded-xl bg-[#D8A35B] px-8 py-4 font-semibold text-slate-900 sm:w-auto">Create Your Legacy</button>
            <button className="w-full rounded-xl border border-[#D8A35B] px-8 py-4 font-semibold text-[#D8A35B] sm:w-auto">Search For A Loved One</button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-center text-4xl font-bold">How It Works</h2>
        <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['🎙️','Record Your Story','Capture your memories through video, audio, and written stories.'],
            ['💌','Leave Messages','Create personal messages for loved ones to discover in the future.'],
            ['🔒','Protect Private Memories','Secure memories with privacy controls and protected access.'],
            ['❤️','Deliver Comfort','Reconnect loved ones with your voice, guidance, and presence.'],
          ].map(([icon,title,desc]) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
              <div className="mb-4 text-3xl">{icon}</div>
              <h3 className="mb-3 text-xl font-semibold text-[#D8A35B]">{title}</h3>
              <p className="text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-y border-slate-800 bg-slate-950/30">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="text-4xl font-bold md:text-5xl">Cannot Open Until™</h2>
          <p className="mt-6 max-w-3xl text-lg text-slate-300">Create messages, videos, audio recordings, and memories that remain securely sealed until a future date you choose.</p>
        </div>
      </section>
    </main>
  );
}