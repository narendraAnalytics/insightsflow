"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

export function WelcomeHeroCard() {
  const { user } = useUser();
  const firstName = user?.firstName ?? user?.username ?? "there";
  const videoRef = useRef<HTMLVideoElement>(null);

  // Autoplay is off for people who ask their OS for reduced motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) videoRef.current?.pause();
  }, []);

  return (
    <div className="glass-panel relative isolate flex flex-col justify-center overflow-hidden rounded-3xl px-7 pt-20 pb-2.5 sm:px-9 sm:pt-24 sm:pb-2.5">
      <video
        ref={videoRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 size-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source
          src="https://res.cloudinary.com/dkqbzwicr/video/upload/v1790429805/dashbordvideo_dwb7z8.webm"
          type="video/webm"
        />
      </video>
      {/* soft cream scrim keeps the greeting readable over the video */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklab, var(--flow-cream) 92%, transparent) 0%, color-mix(in oklab, var(--flow-cream) 78%, transparent) 40%, color-mix(in oklab, var(--flow-cream) 25%, transparent) 72%, transparent 100%)",
        }}
      />

      <div className="max-w-md">
        <h1 className="text-[1.9rem] leading-tight font-semibold tracking-tight text-(--flow-ink) sm:text-4xl">
          Welcome back, {firstName}! <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-3 text-[15px] text-(--flow-ink)/70">
          Turn your ideas into impact with AI-powered workflows.
        </p>
        <p className="mt-4 text-[13.5px] font-medium text-(--flow-ink)/55 italic">
          &ldquo;Automate today. Achieve tomorrow.&rdquo;
        </p>
      </div>
    </div>
  );
}
