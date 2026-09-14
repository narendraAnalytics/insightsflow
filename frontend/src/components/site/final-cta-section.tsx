"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react";
import { Show, SignUpButton } from "@clerk/nextjs";
import { sectionContainer, sectionItem, sectionViewport, useParallaxY } from "@/lib/motion";

export function FinalCtaSection() {
  const { ref, y: bgY } = useParallaxY([-20, 20]);
  const { ref: blobARef, y: blobAY } = useParallaxY([-50, 30]);
  const { ref: blobBRef, y: blobBY } = useParallaxY([30, -50]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden py-24 sm:py-32">
      <motion.div
        aria-hidden="true"
        style={{
          y: bgY,
          background:
            "radial-gradient(60% 60% at 20% 20%, color-mix(in oklab, var(--flow-lavender) 45%, transparent) 0%, transparent 65%), radial-gradient(55% 55% at 85% 80%, color-mix(in oklab, var(--flow-coral) 40%, transparent) 0%, transparent 65%), linear-gradient(180deg, color-mix(in oklab, var(--flow-peach) 70%, transparent) 0%, color-mix(in oklab, var(--flow-pink) 55%, transparent) 50%, color-mix(in oklab, var(--flow-peach) 70%, transparent) 100%)",
        }}
        className="absolute inset-0 -z-10"
      />
      <motion.div
        ref={blobARef}
        aria-hidden="true"
        style={{ y: blobAY }}
        className="pointer-events-none absolute -left-16 top-10 -z-10 h-56 w-56 rounded-full blur-3xl"
      >
        <div
          className="animate-pulse-glow h-full w-full rounded-full"
          style={{ backgroundImage: "radial-gradient(circle, var(--flow-magenta), transparent 70%)", opacity: 0.35 }}
        />
      </motion.div>
      <motion.div
        ref={blobBRef}
        aria-hidden="true"
        style={{ y: blobBY }}
        className="pointer-events-none absolute -right-16 bottom-4 -z-10 h-64 w-64 rounded-full blur-3xl"
      >
        <div
          className="animate-pulse-glow h-full w-full rounded-full"
          style={{ backgroundImage: "radial-gradient(circle, var(--flow-cyan), transparent 70%)", opacity: 0.35 }}
        />
      </motion.div>

      <motion.div
        variants={sectionContainer}
        initial="hidden"
        whileInView="show"
        viewport={sectionViewport}
        className="mx-auto max-w-2xl px-4 text-center sm:px-6"
      >
        <motion.h2
          variants={sectionItem}
          className="text-3xl font-semibold tracking-tight text-(--flow-ink) sm:text-5xl"
        >
          Ready to make <span className="text-gradient-flow">progress?</span>
        </motion.h2>
        <motion.p variants={sectionItem} className="mx-auto mt-4 max-w-md text-[16px] text-(--flow-ink)/70">
          Connect your tools and let AI do the rest.
        </motion.p>
        <motion.div variants={sectionItem} className="mt-8 flex justify-center">
          <Show when="signed-out">
            <SignUpButton mode="redirect" forceRedirectUrl="/">
              <button
                type="button"
                className="bg-gradient-flow group inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold text-(--flow-cream) shadow-[0_16px_32px_-12px_rgba(224,90,143,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                Get Started Free
                <ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <a
              href="#top"
              className="bg-gradient-flow group inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold text-(--flow-cream) shadow-[0_16px_32px_-12px_rgba(224,90,143,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Go to your workspace
              <ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Show>
        </motion.div>
      </motion.div>
    </section>
  );
}
