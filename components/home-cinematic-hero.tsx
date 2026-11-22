"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const videoUrl = "https://svs.gsfc.nasa.gov/vis/a010000/a013800/a013846/13846_NEBULA_WIDE_MP4.webm";
const posterUrl = "https://svs.gsfc.nasa.gov/vis/a010000/a013800/a013846/13846_NEBULA_WIDE_THUMB.jpg";

export default function HomeCinematicHero({ hasLatestEdition }: { hasLatestEdition: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      if (preference.matches) {
        video.pause();
        setIsPlaying(false);
        return;
      }

      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };

    syncMotionPreference();
    preference.addEventListener("change", syncMotionPreference);

    return () => {
      preference.removeEventListener("change", syncMotionPreference);
      video.pause();
    };
  }, []);

  const toggleMotion = async () => {
    const video = videoRef.current;
    if (!video || !hasVideo) return;

    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <section className="home-cinematic-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-media" aria-hidden="true">
        {hasVideo && (
          <video
            ref={videoRef}
            className="home-hero-video"
            muted
            loop
            playsInline
            preload="none"
            poster={posterUrl}
            onCanPlay={() => setHasVideo(true)}
            onError={() => setHasVideo(false)}
            tabIndex={-1}
          >
            <source src={videoUrl} type="video/webm" />
          </video>
        )}
        <div className="home-hero-vignette" />
        <div className="home-hero-grain" />
      </div>

      <div className="home-hero-topline">
        <span>INDEPENDENT SCIENCE &amp; ASTRONOMY</span>
        <span>OPEN TO CURIOSITY · COMMITTED TO EVIDENCE</span>
      </div>

      <div className="home-hero-content">
        <div className="home-hero-copy">
          <p className="home-hero-kicker"><span /> A publication for the curious</p>
          <h1 id="home-hero-title">The Universe,<br /><em>in perspective.</em></h1>
          <p className="home-hero-deck">
            Astronomy, science and the frontiers of discovery—explored with intellectual
            curiosity, editorial care and a deep respect for evidence.
          </p>
          <div className="home-hero-actions">
            <Link className="home-hero-primary" href={hasLatestEdition ? "/latest" : "/issues"}>{hasLatestEdition ? "Enter the latest edition" : "Browse the issue archive"} <span>↗</span></Link>
            <Link className="home-hero-secondary" href="/sky-explorer">Explore the sky <span>↗</span></Link>
          </div>
        </div>

        <div className="home-hero-side-note">
          <span className="home-hero-side-rule" />
          <span>LOOK CLOSER.</span>
          <span>THINK BIGGER.</span>
          <span>STAY CURIOUS.</span>
        </div>
      </div>

      <div className="home-hero-bottom">
        <div className="home-hero-bottom-label">
          <span className="home-hero-index">01</span>
          <span>EXPLORING THE UNIVERSE<br />UNDERSTANDING OUR PLACE</span>
        </div>
        <div className="home-hero-media-credit">
          <a href="https://svs.gsfc.nasa.gov/13846" target="_blank" rel="noopener noreferrer">
            Background film: Hubble Science — Starbirth Nebulae · NASA Goddard ↗
          </a>
          <span>Muted visual · no soundtrack</span>
        </div>
        <button
          className="home-hero-motion-toggle"
          type="button"
          onClick={toggleMotion}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? "Pause the background space video" : "Play the background space video"}
        >
          <span className={isPlaying ? "home-motion-icon is-playing" : "home-motion-icon"} aria-hidden="true">
            {isPlaying ? "Ⅱ" : "▶"}
          </span>
          {isPlaying ? "PAUSE MOTION" : "PLAY MOTION"}
        </button>
      </div>
    </section>
  );
}
