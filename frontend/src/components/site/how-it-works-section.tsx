"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
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

// Icon centers within the inset line track (grid of 4 equal columns).
const stepPositions = [12.5, 37.5, 62.5, 87.5];
const STEP_DURATION_MS = 1800;

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: bgProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(bgProgress, [0, 1], [-25, 25]);

  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isInView || reducedMotion) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % steps.length);
    }, STEP_DURATION_MS);
    return () => clearInterval(id);
  }, [isInView, reducedMotion]);

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
            <div
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--flow-magenta), var(--flow-lavender) 35%, var(--flow-cyan) 65%, var(--flow-coral))",
                opacity: reducedMotion ? 1 : 0.25,
              }}
              className="h-full w-full rounded-full"
            />
            {!reducedMotion && (
              <motion.div
                aria-hidden="true"
                className="absolute top-1/2 h-6 w-20 -translate-y-1/2 rounded-full"
                style={{
                  translateX: "-50%",
                  backgroundImage:
                    "linear-gradient(90deg, transparent, var(--flow-magenta), var(--flow-cyan), transparent)",
                  filter: "blur(6px)",
                }}
                animate={{ left: `${stepPositions[activeIndex]}%` }}
                transition={{ duration: (STEP_DURATION_MS / 1000) * 0.75, ease: "easeInOut" }}
              />
            )}
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, index) => {
              const isActive = !reducedMotion && index === activeIndex;
              return (
                <motion.div
                  key={step.label}
                  variants={sectionItem}
                  animate={
                    reducedMotion
                      ? undefined
                      : { scale: isActive ? 1.08 : 1, opacity: isActive ? 1 : 0.55 }
                  }
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-full blur-xl"
                      style={{
                        backgroundImage: "radial-gradient(circle, var(--flow-magenta), transparent 70%)",
                        opacity: isActive ? 0.6 : 0.25,
                      }}
                    />
                    {isActive && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute -inset-2 rounded-full"
                        style={{
                          backgroundImage:
                            "conic-gradient(from 0deg, var(--flow-magenta), var(--flow-lavender), var(--flow-cyan), var(--flow-coral), var(--flow-magenta))",
                          WebkitMask:
                            "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                          filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--flow-magenta) 60%, transparent))",
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
                      />
                    )}
                    <motion.span
                      className="glass-card relative flex size-16 items-center justify-center rounded-full"
                      animate={
                        reducedMotion
                          ? undefined
                          : {
                              rotate: isActive ? [18, -10, 0] : 0,
                              boxShadow: isActive
                                ? "0 0 0 6px color-mix(in oklab, var(--flow-magenta) 35%, transparent)"
                                : "0 0 0 0px transparent",
                            }
                      }
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      <step.icon weight="fill" className="size-6 text-(--flow-magenta)" />
                    </motion.span>
                    <span
                      className={`bg-gradient-flow absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-(--flow-cream) shadow-[0_6px_14px_-4px_rgba(224,90,143,0.6)] ${
                        isActive ? "animate-pulse-glow scale-110" : ""
                      }`}
                    >
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-[16px] font-semibold text-(--flow-ink)">{step.label}</h3>
                  <p className="mt-1.5 max-w-[15rem] text-[13.5px] leading-relaxed text-(--flow-ink)/65">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
