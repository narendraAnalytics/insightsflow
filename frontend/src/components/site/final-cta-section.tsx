"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, Sparkle } from "@phosphor-icons/react";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { GoogleSheetsGlyph } from "@/components/site/brand-icons";
import { Magnetic, RevealHeading, primaryButtonClass } from "@/components/site/primitives";

/** Small product chips floating around the headline (desktop only, decorative). */
const chips = [
  {
    className: "left-[5%] top-[18%] -rotate-6",
    delay: "0s",
    content: (
      <>
        <GoogleSheetsGlyph className="size-5" />
        Sales 2026 connected
      </>
    ),
  },
  {
    className: "right-[6%] top-[22%] rotate-3",
    delay: "-2.5s",
    content: (
      <>
        <Sparkle weight="fill" className="size-4 text-(--flow-magenta)" />
        ₹3.12 crore, up 18.4%
      </>
    ),
  },
  {
    className: "right-[12%] bottom-[16%] -rotate-2",
    delay: "-4s",
    content: (
      <>
        <span className="flex size-5 items-center justify-center rounded-full bg-(--flow-mint)">
          <Check weight="bold" className="size-3" />
        </span>
        Approved by you
      </>
    ),
  },
];

export function FinalCtaSection() {
  const reduced = useReducedMotion();
  return (
    <section className="px-3 py-[clamp(4rem,8vw,7rem)] sm:px-6">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 40, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1, ease: EASE_OUT }}
        className="lux-card lux-grain relative isolate mx-auto max-w-[1240px] overflow-hidden rounded-[36px] px-6 py-20 text-center sm:rounded-[48px] sm:py-28"
        style={{ background: "linear-gradient(160deg, var(--flow-shell) 0%, var(--flow-peach) 55%, var(--flow-coral-100) 100%)" }}
      >
        {/* bright pastel mesh: saturated color at the edges, calm in the middle where the text sits */}
        <div aria-hidden="true" className="animate-aurora-a absolute -top-40 -left-32 -z-10 size-[30rem] rounded-full bg-(--flow-magenta)/35 blur-[100px]" />
        <div aria-hidden="true" className="animate-aurora-b absolute -top-32 -right-24 -z-10 size-[26rem] rounded-full bg-(--flow-mint)/45 blur-[100px]" />
        <div aria-hidden="true" className="animate-aurora-b absolute -bottom-44 -left-20 -z-10 size-[28rem] rounded-full bg-(--flow-pink)/70 blur-[100px]" />
        <div aria-hidden="true" className="animate-aurora-a absolute -right-28 -bottom-40 -z-10 size-[30rem] rounded-full bg-(--flow-amber)/50 blur-[100px]" />
        <div aria-hidden="true" className="lux-dots absolute inset-0 -z-10 opacity-60" />

        {chips.map((chip, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn("pointer-events-none absolute z-[2] hidden lg:block", chip.className)}
          >
            <div
              className="animate-float-slow inline-flex items-center gap-2 rounded-full bg-(--flow-shell)/90 px-4 py-2.5 text-[14px] font-semibold text-(--flow-ink) shadow-(--shadow-md) backdrop-blur-sm"
              style={{ animationDelay: chip.delay }}
            >
              {chip.content}
            </div>
          </div>
        ))}

        <div className="relative z-[2]">
          <RevealHeading
            className="font-display mx-auto max-w-4xl text-[clamp(3rem,7.4vw,6.6rem)] leading-[0.95] text-(--flow-ink)"
            lines={[
              { text: "Ask your first" },
              { text: "question today.", className: "font-editorial text-sunrise pr-[0.1em]" },
            ]}
          />
          <p className="mx-auto mt-7 max-w-[40ch] text-[18px] leading-relaxed text-(--text-secondary)">
            Connect a Google Sheet and get your first answer in minutes.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Show when="signed-out">
              <Magnetic strength={12}>
                <SignUpButton mode="redirect" forceRedirectUrl="/">
                  <button type="button" className={cn(primaryButtonClass, "min-h-13 px-8 py-4 text-[16px]")}>
                    Start free
                    <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </SignUpButton>
              </Magnetic>
              <SignInButton mode="redirect">
                <button
                  type="button"
                  className="min-h-12 rounded-full px-5 text-[16px] font-semibold text-(--flow-ink) underline decoration-(--flow-magenta)/40 decoration-2 underline-offset-[6px] transition-colors hover:decoration-(--flow-magenta)"
                >
                  I already have an account
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Magnetic strength={12}>
                <a href="/dashboard" className={cn(primaryButtonClass, "min-h-13 px-8 py-4 text-[16px]")}>
                  Open your dashboard
                  <ArrowUpRight weight="bold" className="size-4" />
                </a>
              </Magnetic>
            </Show>
          </div>
          <p className="mt-6 text-[14px] font-medium text-(--text-muted)">Free to start. No credit card needed.</p>
        </div>
      </motion.div>
    </section>
  );
}
