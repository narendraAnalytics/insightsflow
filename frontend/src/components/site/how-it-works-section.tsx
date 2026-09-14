"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Lightning, MagicWand, PlugsConnected, Stack } from "@phosphor-icons/react";
import { sectionContainer, sectionItem, sectionViewport } from "@/lib/motion";

const steps = [
  {
    icon: PlugsConnected,
    label: "Connect",
    description: "Link your tools in a few clicks.",
  },
  {
    icon: MagicWand,
    label: "Analyze",
    description: "AI reads and understands your data.",
  },
  {
    icon: Stack,
    label: "Correlate",
    description: "Finds patterns across every app.",
  },
  {
    icon: Lightning,
    label: "Act",
    description: "Get clear insights and recommended actions.",
  },
];

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: bgProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(bgProgress, [0, 1], [-25, 25]);
  const { scrollYProgress: lineProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.85", "start 0.05"],
  });

  return (
    <section ref={sectionRef} id="how-it-works" className="relative isolate overflow-hidden py-20 sm:py-28">
      <motion.div
        aria-hidden="true"
        style={{
          y,
          background:
            "radial-gradient(50% 45% at 50% 0%, color-mix(in oklab, var(--flow-lavender) 30%, transparent) 0%, transparent 65%)",
        }}
        className="absolute inset-0 -z-10"
      />

      <motion.div
        variants={sectionContainer}
        initial="hidden"
        whileInView="show"
        viewport={sectionViewport}
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center">
          <motion.span
            variants={sectionItem}
            className="glass-panel inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-(--flow-magenta) uppercase"
          >
            Simple process
          </motion.span>
          <motion.h2
            variants={sectionItem}
            className="mt-4 text-3xl font-semibold tracking-tight text-(--flow-ink) sm:text-4xl"
          >
            How it works
          </motion.h2>
          <motion.p variants={sectionItem} className="mx-auto mt-3 max-w-md text-[15px] text-(--flow-ink)/65">
            Get from connection to real insight in minutes.
          </motion.p>
        </div>

        <div className="relative mt-16">
          <div
            aria-hidden="true"
            className="absolute top-8 right-8 left-8 hidden h-[2.5px] overflow-hidden rounded-full bg-(--flow-ink)/8 lg:block"
          >
            <motion.div
              style={{
                scaleX: lineProgress,
                transformOrigin: "0% 50%",
                backgroundImage:
                  "linear-gradient(90deg, var(--flow-magenta), var(--flow-lavender) 35%, var(--flow-cyan) 65%, var(--flow-coral))",
              }}
              className="h-full w-full rounded-full"
            />
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, index) => (
              <motion.div
                key={step.label}
                variants={sectionItem}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-full blur-xl"
                    style={{
                      backgroundImage: "radial-gradient(circle, var(--flow-magenta), transparent 70%)",
                      opacity: 0.35,
                    }}
                  />
                  <span className="glass-card animate-pulse-glow relative flex size-16 items-center justify-center rounded-full">
                    <step.icon weight="fill" className="size-6 text-(--flow-magenta)" />
                  </span>
                  <span className="bg-gradient-flow absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-(--flow-cream) shadow-[0_6px_14px_-4px_rgba(224,90,143,0.6)]">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-[16px] font-semibold text-(--flow-ink)">{step.label}</h3>
                <p className="mt-1.5 max-w-[15rem] text-[13.5px] leading-relaxed text-(--flow-ink)/65">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
