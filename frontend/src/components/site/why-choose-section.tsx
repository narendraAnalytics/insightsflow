"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ClockCountdown, PlugsConnected, Sparkle, Target } from "@phosphor-icons/react";
import { sectionContainer, sectionItem, sectionViewport, useParallaxY } from "@/lib/motion";

const benefits = [
  {
    icon: PlugsConnected,
    gradient: "linear-gradient(135deg, var(--flow-magenta), var(--flow-pink))",
    title: "All your tools in one place",
    description: "Connect Slack, GitHub, Drive, Notion and more in minutes — no more tab-hopping to find the truth.",
  },
  {
    icon: Sparkle,
    gradient: "linear-gradient(135deg, var(--flow-lavender), var(--flow-cyan))",
    title: "AI-powered analysis",
    description: "Sarvam reads across every connected app and surfaces patterns, risks and opportunities instantly.",
  },
  {
    icon: Target,
    gradient: "linear-gradient(135deg, var(--flow-coral), var(--flow-magenta))",
    title: "Insights turned into action",
    description: "Every insight ships with a clear next step — approve it once, and InsightFlow carries it through.",
  },
  {
    icon: ClockCountdown,
    gradient: "linear-gradient(135deg, var(--flow-cyan), var(--flow-lavender))",
    title: "Save time, stay focused",
    description: "Let AI handle the noise and the busywork, so your team spends time on what actually matters.",
  },
];

export function WhyChooseSection() {
  const { ref, y } = useParallaxY([-30, 30]);

  return (
    <section ref={ref} id="product" className="relative isolate overflow-hidden py-20 sm:py-28">
      <motion.div
        aria-hidden="true"
        style={{
          y,
          background:
            "radial-gradient(45% 40% at 8% 10%, color-mix(in oklab, var(--flow-pink) 35%, transparent) 0%, transparent 65%), radial-gradient(40% 35% at 95% 30%, color-mix(in oklab, var(--flow-cyan) 35%, transparent) 0%, transparent 65%)",
        }}
        className="absolute inset-0 -z-10"
      />

      <motion.div
        variants={sectionContainer}
        initial="hidden"
        whileInView="show"
        viewport={sectionViewport}
        className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8"
      >
        <motion.h2
          variants={sectionItem}
          className="text-3xl font-semibold tracking-tight text-(--flow-ink) sm:text-4xl"
        >
          Why teams choose <span className="text-gradient-flow">InsightFlow</span>
        </motion.h2>
        <motion.p variants={sectionItem} className="mx-auto mt-3 max-w-md text-[15px] text-(--flow-ink)/65">
          More context. Deeper insights. Real action.
        </motion.p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <motion.div
              key={benefit.title}
              variants={sectionItem}
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="glass-card group flex flex-col items-start rounded-3xl p-6 text-left"
            >
              <span
                className="flex size-11 items-center justify-center rounded-2xl shadow-[0_10px_24px_-10px_rgba(224,90,143,0.5)]"
                style={{ backgroundImage: benefit.gradient }}
              >
                <benefit.icon weight="fill" className="size-5 text-(--flow-cream)" />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold text-(--flow-ink)">{benefit.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-(--flow-ink)/65">{benefit.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-(--flow-magenta) opacity-0 transition-opacity group-hover:opacity-100">
                Learn more
                <ArrowUpRight weight="bold" className="size-3.5" />
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
