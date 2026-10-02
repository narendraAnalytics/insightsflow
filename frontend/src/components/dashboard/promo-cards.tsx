"use client";

import { ArrowCircleRight, ArrowRight, Coins } from "@phosphor-icons/react";
import { useCredits } from "@/components/billing/credits-provider";

export function CreditsCard() {
  const { credits, questionCost, connectCost, openBuy } = useCredits();
  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5"
      style={{
        backgroundImage: "linear-gradient(150deg, var(--flow-peach), var(--flow-pink) 60%, var(--flow-lavender))",
      }}
    >
      <Coins weight="fill" className="size-5 text-(--flow-cream)" />
      <div>
        <p className="text-[26px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)">Your credits</p>
        <p
          className="mt-1 text-[56px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-magenta)"
          aria-live="polite"
        >
          {credits === null ? "–" : credits.toLocaleString("en-IN")}
        </p>
        <p className="mt-1 text-[19px] font-(family-name:--font-zeyada) leading-snug font-normal text-(--flow-ink)/70">
          1 ₹ = 1 credit. {connectCost} to connect an app, {questionCost} per AI question.
        </p>
        {credits !== null && credits < connectCost && (
          <p
            role="status"
            className="mt-2 rounded-xl bg-(--flow-amber)/45 px-3 py-1.5 text-[19px] font-(family-name:--font-zeyada) leading-snug font-normal text-(--flow-ink)"
          >
            {credits < questionCost
              ? "You're out of credits. Buy more to ask questions or connect apps."
              : `Low on credits. A new connection needs ${connectCost}; you can still ask ${Math.floor(credits / questionCost)} question${Math.floor(credits / questionCost) === 1 ? "" : "s"}.`}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={openBuy}
        className="glass-panel mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-[20px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)"
      >
        Buy credits
        <ArrowRight weight="bold" className="size-3.5" />
      </button>
    </div>
  );
}

export function MotivationCard() {
  return (
    <div className="group relative isolate flex min-h-80 flex-1 flex-col justify-between gap-4 overflow-hidden rounded-2xl p-5 shadow-[0_14px_30px_-16px_rgba(224,90,143,0.55)]">
      {/* full-bleed scene, cropped to the card; slow zoom on hover */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://res.cloudinary.com/dkqbzwicr/image/upload/v1790482377/growthimagesteps_yspjyt.png"
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute inset-0 -z-20 size-full object-cover object-[50%_50%] transition-transform duration-700 ease-out group-hover:scale-110"
      />
      {/* brand-tinted scrim keeps the cream text readable without dimming the whole scene */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(135deg, color-mix(in oklab, var(--flow-magenta) 78%, transparent) 0%, color-mix(in oklab, var(--flow-coral) 42%, transparent) 42%, transparent 75%)",
        }}
      />
      <p className="max-w-[220px] text-[26px] leading-tight font-normal font-(family-name:--font-zeyada) text-(--flow-cream) drop-shadow-[0_2px_8px_rgba(120,30,70,0.45)]">
        Big goals start with small steps.
      </p>
      <span className="glass-panel flex size-9 w-fit items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1">
        <ArrowCircleRight weight="fill" className="size-5 text-(--flow-cream)" />
      </span>
    </div>
  );
}
