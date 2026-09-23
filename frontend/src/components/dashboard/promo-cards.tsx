"use client";

import { ArrowCircleRight, ArrowRight, Sparkle } from "@phosphor-icons/react";

export function UpgradeCard() {
  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5"
      style={{
        backgroundImage: "linear-gradient(150deg, var(--flow-peach), var(--flow-pink) 60%, var(--flow-lavender))",
      }}
    >
      <Sparkle weight="fill" className="size-5 text-(--flow-cream)" />
      <div>
        <p className="text-[15px] font-semibold text-(--flow-ink)">Upgrade to Pro</p>
        <p className="mt-1 text-[12.5px] text-(--flow-ink)/70">Unlock more power with advanced AI features.</p>
      </div>
      <button
        type="button"
        className="glass-panel mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-(--flow-ink)"
      >
        Upgrade Now
        <ArrowRight weight="bold" className="size-3.5" />
      </button>
    </div>
  );
}

export function MotivationCard() {
  return (
    <div
      className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl p-5"
      style={{
        backgroundImage: "linear-gradient(150deg, var(--flow-coral), var(--flow-magenta) 65%, var(--flow-lavender))",
      }}
    >
      <p className="max-w-[220px] text-[16px] leading-snug font-semibold text-(--flow-cream)">
        Big goals start with small steps.
      </p>
      <span className="glass-panel flex size-9 w-fit items-center justify-center rounded-full">
        <ArrowCircleRight weight="fill" className="size-5 text-(--flow-cream)" />
      </span>
    </div>
  );
}
