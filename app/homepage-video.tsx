"use client";

import { useRef, useState } from "react";

export default function HomepageVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  async function playVideo() {
    const video = videoRef.current;
    if (!video) {
      setError("The video is unavailable. Please try again.");
      return;
    }
    setError("");
    try {
      await video.play();
    } catch (playbackError) {
      console.error("[homepage-video] Playback failed", playbackError);
      setError("The video could not be played. Please try again.");
    }
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl border border-[color:var(--nsg-accent)]/30 bg-slate-950 shadow-2xl shadow-black/30">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="none"
          poster="/images/family-traditions.jpg"
          aria-label="A Message For The Future promotional video"
          className="aspect-video w-full object-contain"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setError("The video could not be loaded. Please try again later.")}
        >
          <source src="/videos/never-say-goodbye-ad.mp4" type="video/mp4" />
          Your browser does not support video playback.
        </video>
        {!playing && (
          <button
            type="button"
            onClick={playVideo}
            aria-label="Play A Message For The Future"
            className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-[color:var(--nsg-background)]/90 text-3xl text-[color:var(--nsg-accent-light)] shadow-xl transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--nsg-accent)]"
          >
            <span aria-hidden="true" className="ml-1">▶</span>
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
