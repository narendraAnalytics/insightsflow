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

      <div className="max-w-2xl">
        <h1 className="font-(family-name:--font-zeyada) text-[2.75rem] leading-none font-normal sm:text-[3.5rem]">
          <span
            style={{
              backgroundImage: "linear-gradient(100deg, var(--flow-magenta) 0%, oklch(0.66 0.21 10) 55%, var(--flow-coral) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 2px 10px rgb(255 255 255 / 0.55))",
            }}
          >
            Welcome back, {firstName}!
          </span>
          {/* emoji lives outside the clipped span so it keeps its own colours, and stays on the same line */}
          <span aria-hidden="true" className="ml-2 inline-block align-middle text-[0.8em]">
            👋
          </span>
        </h1>
        <p className="mt-3 font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-magenta)">
          Turn your ideas into impact with AI-powered workflows.
        </p>
        <p className="mt-3 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-coral)">
          &ldquo;Automate today. Achieve tomorrow.&rdquo;
        </p>
      </div>
    </div>
  );
}
