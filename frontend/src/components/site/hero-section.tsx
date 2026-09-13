"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, CaretDown, Lightning, Play, Shield, Sparkle, Users } from "@phosphor-icons/react";
import { GitHubGlyph, GoogleDriveGlyph, LinearGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";

const trustBadges = [
  { icon: Lightning, label: "No credit card required" },
  { icon: Shield, label: "Quick setup" },
  { icon: Users, label: "Free tier available" },
];

const trustLogos = [
  { icon: SlackGlyph, label: "Slack" },
  { icon: GitHubGlyph, label: "GitHub" },
  { icon: GoogleDriveGlyph, label: "Google Drive" },
  { icon: NotionGlyph, label: "Notion" },
  { icon: LinearGlyph, label: "Linear" },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export function HeroSection() {
  return (
    <section id="top" className="relative isolate overflow-hidden pt-28 pb-20 sm:pt-32 lg:pb-28">
      <div className="absolute inset-0 -z-20 overflow-hidden">
        <video
          className="h-full w-full object-cover opacity-100 brightness-[1.10]"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster=""
          aria-hidden="true"
        >
          <source
            src="https://res.cloudinary.com/dkqbzwicr/video/upload/v1789312214/herosecctionvideo_ehrosl.mp4"
            type="video/mp4"
          />
        </video>
      </div>
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 80% 15%, color-mix(in oklab, var(--flow-cyan) 55%, transparent) 0%, transparent 60%), radial-gradient(55% 50% at 12% 20%, color-mix(in oklab, var(--flow-lavender) 55%, transparent) 0%, transparent 60%), linear-gradient(180deg, color-mix(in oklab, var(--flow-cream) 88%, transparent) 0%, color-mix(in oklab, var(--flow-peach) 80%, transparent) 55%, color-mix(in oklab, var(--flow-cream) 92%, transparent) 100%)",
        }}
      />

      <div className="mx-auto flex max-w-6xl justify-start px-4 sm:px-6 lg:px-8 lg:pl-6 xl:pl-5">
        <motion.div variants={container} initial="hidden" animate="show" className="max-w-xl">
          <motion.span
            variants={item}
            className="glass-panel inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-(--flow-ink)/80"
          >
            <Sparkle weight="fill" className="size-3.5 text-(--flow-magenta)" />
            AI that connects your world
          </motion.span>

          <motion.h1
            variants={item}
            className="mt-6 text-[2.75rem] leading-[1.05] font-semibold tracking-tight text-(--flow-ink) sm:text-6xl"
          >
            Turn scattered information into <span className="text-gradient-flow">real progress.</span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-md text-[17px] leading-relaxed text-(--flow-ink)/70">
            Connect your tools. Let AI analyze, correlate, and act across Slack, GitHub, Google Drive and more —
            so you can focus on what really matters.
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/get-started"
              className="bg-gradient-flow group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-(--flow-cream) shadow-[0_16px_32px_-12px_rgba(224,90,143,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Start for Free
              <ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#how-it-works"
              className="glass-panel inline-flex items-center gap-2.5 rounded-full px-5 py-3.5 text-[15px] font-semibold text-(--flow-ink) transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-(--flow-ink)/8">
                <Play weight="fill" className="size-3 text-(--flow-magenta)" />
              </span>
              Watch Demo (2 min)
            </a>
          </motion.div>

          <motion.div
            variants={item}
            className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-(--flow-ink)/65"
          >
            {trustBadges.map((badge) => (
              <span key={badge.label} className="inline-flex items-center gap-1.5">
                <badge.icon weight="fill" className="size-3.5 text-(--flow-coral)" />
                {badge.label}
              </span>
            ))}
          </motion.div>

          <motion.div variants={item} className="mt-10">
            <p className="text-[11px] font-medium text-(--flow-ink)/45">TRUSTED BY BUILDERS, TEAMS AND CREATORS</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
              {trustLogos.map((logo) => (
                <span key={logo.label} className="flex items-center gap-1.5 text-(--flow-ink)/60">
                  <logo.icon className="size-5" />
                  <span className="text-sm font-semibold">{logo.label}</span>
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.2 }}
        className="mt-16 hidden flex-col items-center gap-1.5 text-[12px] font-medium text-(--flow-ink)/45 sm:flex"
      >
        <span>Scroll to explore</span>
        <CaretDown className="size-3.5 animate-bounce" />
      </motion.div>
    </section>
  );
}
