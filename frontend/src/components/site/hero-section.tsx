"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import { Show, SignUpButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { EASE_OUT, useCursorGlow } from "@/lib/motion";
import { AgentDemo } from "@/components/site/agent-demo";
import { GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { Magnetic, RevealHeading, primaryButtonClass, secondaryButtonClass } from "@/components/site/primitives";

const HeroScene = dynamic(() => import("@/components/site/hero-scene"), { ssr: false });

const worksWith = [
  { icon: GoogleSheetsGlyph, label: "Google Sheets", live: true },
  { icon: NotionGlyph, label: "Notion", live: false },
  { icon: SlackGlyph, label: "Slack", live: false },
];

const item: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE_OUT, delay } }),
};

export function HeroSection() {
  const reduced = useReducedMotion() ?? false;
  const { user } = useUser();
  const displayName = user?.username ?? user?.firstName ?? "there";
  const glow = useCursorGlow<HTMLElement>(reduced);

  const { scrollYProgress } = useScroll({ target: glow.ref, offset: ["start start", "end start"] });
  const visualY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 90]);
  const auroraY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 160]);

  const play = reduced ? {} : { initial: "hidden", animate: "show" };

  return (
    <section
      ref={glow.ref}
      onPointerMove={glow.onPointerMove}
      id="top"
      className="lux-grain relative isolate overflow-hidden pt-28 pb-16 sm:pt-36 lg:min-h-[100svh] lg:pb-24"
    >
      {/* aurora mesh */}
      <motion.div aria-hidden="true" style={{ y: auroraY }} className="absolute inset-0 -z-20">
        <div className="animate-aurora-a absolute -top-40 right-[-10%] size-[44rem] rounded-full bg-(--flow-magenta)/28 blur-[110px]" />
        <div className="animate-aurora-b absolute top-[20%] right-[18%] size-[30rem] rounded-full bg-(--flow-amber)/40 blur-[100px]" />
        <div className="animate-aurora-b absolute -top-24 -left-40 size-[34rem] rounded-full bg-(--flow-pink)/60 blur-[100px]" />
        <div className="animate-aurora-a absolute bottom-[-12rem] left-[30%] size-[28rem] rounded-full bg-(--flow-mint)/35 blur-[110px]" />
      </motion.div>
      <div aria-hidden="true" className="lux-dots absolute inset-0 -z-10 opacity-70" />
      {/* cursor spotlight (mouse only) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden [@media(pointer:fine)]:block"
        style={{
          background:
            "radial-gradient(520px circle at var(--mx, 70%) var(--my, 30%), color-mix(in oklab, var(--flow-shell) 70%, transparent), transparent 65%)",
        }}
      />

      <div className="relative z-[2] mx-auto grid max-w-[1240px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.08fr_1fr] lg:gap-6 lg:px-8">
        <div>
          <motion.p
            {...play}
            variants={item}
            custom={0.05}
            className="inline-flex items-center gap-2 rounded-full border border-(--border-subtle) bg-(--flow-shell)/70 py-1.5 pr-3.5 pl-1.5 text-[13px] font-semibold text-(--text-secondary) backdrop-blur-sm"
          >
            <span className="bg-sunrise rounded-full px-2 py-0.5 text-[11px] font-bold text-(--flow-shell)">New</span>
            An AI analyst for your Google Sheets
          </motion.p>

          <RevealHeading
            as="h1"
            trigger="mount"
            delay={0.15}
            className="font-display mt-6 text-[clamp(3rem,6.8vw,6.4rem)] leading-[0.94] text-(--flow-ink)"
            lines={[
              { text: "Ask your sheets." },
              { text: "Approve the answer." },
              { text: "Alert the team.", className: "text-sunrise" },
            ]}
          />

          <motion.p
            {...play}
            variants={item}
            custom={0.75}
            className="mt-7 max-w-[34rem] text-[17px] leading-relaxed text-(--text-secondary) sm:text-[18px]"
          >
            InsightFlow reads your spreadsheets, computes every number with real code, drafts the report, and waits for
            your yes before anything reaches your team.
          </motion.p>

          <motion.div {...play} variants={item} custom={0.9} className="mt-9 flex flex-wrap items-center gap-3">
            <Show when="signed-out">
              <Magnetic>
                <SignUpButton mode="redirect" forceRedirectUrl="/">
                  <button type="button" className={cn(primaryButtonClass, "px-7 py-3.5 text-[16px]")}>
                    Start free
                    <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </SignUpButton>
              </Magnetic>
            </Show>
            <Show when="signed-in">
              <Magnetic>
                <a href="/dashboard" className={cn(primaryButtonClass, "px-7 py-3.5 text-[16px]")}>
                  Welcome back, {displayName}
                  <ArrowUpRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </Magnetic>
            </Show>
            <a href="#how-it-works" className={cn(secondaryButtonClass, "px-6 py-3.5 text-[16px]")}>
              See how it works
              <ArrowDown weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-y-0.5" />
            </a>
          </motion.div>

          <motion.div {...play} variants={item} custom={1.05} className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
            <span className="text-[13px] font-medium text-(--text-muted)">Works with</span>
            {worksWith.map((app) => (
              <span key={app.label} className="inline-flex items-center gap-2 text-[14px] font-semibold text-(--flow-ink)">
                <app.icon className="size-5" />
                {app.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    app.live ? "bg-(--flow-mint)/45 text-(--flow-ink)" : "bg-(--flow-ink)/[0.06] text-(--text-muted)"
                  )}
                >
                  {app.live ? "Live" : "Soon"}
                </span>
              </span>
            ))}
          </motion.div>
        </div>

        {/* 3D data field + interactive agent run */}
        <motion.div style={{ y: visualY }} className="relative flex flex-col items-center">
          {/* stage: the 3D object gets its own, uncovered space */}
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.2 }}
            className="relative h-[330px] w-[calc(100%+2rem)] sm:h-[420px] lg:h-[470px] lg:w-[calc(100%+8rem)]"
          >
            <div aria-hidden="true" className="absolute inset-x-[15%] top-[10%] bottom-[5%] rounded-full bg-(--flow-shell)/60 blur-3xl" />
            <HeroScene reduced={reduced} />
          </motion.div>
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.55 }}
            className="relative z-[3] -mt-10 flex w-full justify-center sm:-mt-14"
          >
            <AgentDemo />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
