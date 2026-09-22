"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { Lightning, MagicWand, PlugsConnected, Stack } from "@phosphor-icons/react";
import { sectionContainer, sectionItem, sectionViewport } from "@/lib/motion";

const steps = [
  {
    icon: PlugsConnected,
    accent: "var(--flow-magenta)",
    label: "Connect",
    description: "Link your tools in a few clicks.",
  },
  {
    icon: MagicWand,
    accent: "var(--flow-lavender)",
    label: "Analyze",
    description: "AI reads and understands your data.",
  },
  {
    icon: Stack,
    accent: "var(--flow-cyan)",
    label: "Correlate",
    description: "Finds patterns across every app.",
  },
  {
    icon: Lightning,
    accent: "var(--flow-coral)",
    label: "Act",
    description: "Get clear insights and recommended actions.",
  },
];

const STEP_DURATION_MS = 1800;

// Wavy connector threading through the 4 icon centers (x: 12.5/37.5/62.5/87.5, baseline y: 12)
// — an agentic-flow style curve instead of a straight timeline.
const FLOW_PATH = "M12.5,12 C20,22 30,2 37.5,12 C45,2 55,22 62.5,12 C70,22 80,2 87.5,12";

// Alternating top/bottom converge, so steps zigzag into place on the line as you scroll in.
const scatterFrom = [
  { x: -50, y: -90, rotate: -12 },
  { x: 50, y: 90, rotate: 12 },
  { x: -50, y: -90, rotate: -12 },
  { x: 50, y: 90, rotate: 12 },
];

function StepScatter({
  index,
  arrangeProgress,
  children,
}: {
  index: number;
  arrangeProgress: MotionValue<number>;
  children: React.ReactNode;
}) {
  const settle = useSpring(arrangeProgress, { stiffness: 130, damping: 22, mass: 0.6 });
  const scatter = scatterFrom[index];
  const x = useTransform(settle, [0, 1], [scatter.x, 0]);
  const y = useTransform(settle, [0, 1], [scatter.y, 0]);
  const rotate = useTransform(settle, [0, 1], [scatter.rotate, 0]);
  const opacity = useTransform(settle, [0, 0.6], [0, 1]);

  return <motion.div style={{ x, y, rotate, opacity }}>{children}</motion.div>;
}

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRowRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: bgProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(bgProgress, [0, 1], [-25, 25]);
  const { scrollYProgress: arrangeProgress } = useScroll({
    target: stepsRowRef,
    offset: ["start 0.92", "start 0.42"],
  });

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
            "radial-gradient(48% 42% at 12% 6%, color-mix(in oklab, var(--flow-lavender) 34%, transparent) 0%, transparent 65%), radial-gradient(42% 38% at 92% 18%, color-mix(in oklab, var(--flow-cyan) 34%, transparent) 0%, transparent 65%), radial-gradient(40% 40% at 50% 100%, color-mix(in oklab, var(--flow-magenta) 26%, transparent) 0%, transparent 68%), radial-gradient(36% 36% at 82% 88%, color-mix(in oklab, var(--flow-coral) 28%, transparent) 0%, transparent 65%)",
        }}
        className="absolute inset-0 -z-10"
      />
      <div
        aria-hidden="true"
        className="animate-float-slower absolute top-0 right-[8%] -z-10 size-60 rounded-full opacity-55 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--flow-lavender), transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="animate-float-slow absolute bottom-0 left-[6%] -z-10 size-72 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--flow-coral), transparent 70%)" }}
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

        <div ref={stepsRowRef} className="relative mt-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-8 right-8 left-8 hidden -translate-y-1/2 lg:block"
            style={{ height: 80 }}
          >
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="agentic-flow-gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--flow-magenta)" />
                  <stop offset="35%" stopColor="var(--flow-lavender)" />
                  <stop offset="65%" stopColor="var(--flow-cyan)" />
                  <stop offset="100%" stopColor="var(--flow-coral)" />
                </linearGradient>
              </defs>
              <path
                d={FLOW_PATH}
                fill="none"
                stroke="var(--flow-ink)"
                strokeOpacity={0.08}
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
              <motion.path
                d={FLOW_PATH}
                fill="none"
                stroke="url(#agentic-flow-gradient)"
                strokeWidth={1.1}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                strokeDasharray={1}
                animate={{ strokeDashoffset: reducedMotion ? 0 : 1 - (activeIndex + 1) / steps.length }}
                initial={false}
                transition={{ duration: (STEP_DURATION_MS / 1000) * 0.6, ease: "easeInOut" }}
              />
              {!reducedMotion && (
                <>
                  <circle r="1.6" fill="var(--flow-cream)" style={{ filter: "drop-shadow(0 0 3px var(--flow-magenta))" }}>
                    <animateMotion dur="4.5s" repeatCount="indefinite" path={FLOW_PATH} />
                  </circle>
                  <circle r="1.2" fill="var(--flow-cyan)" opacity={0.85}>
                    <animateMotion dur="4.5s" begin="-2.25s" repeatCount="indefinite" path={FLOW_PATH} />
                  </circle>
                </>
              )}
            </svg>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, index) => {
              const isActive = !reducedMotion && index === activeIndex;
              return (
                <StepScatter key={step.label} index={index} arrangeProgress={arrangeProgress}>
                  <motion.div
                    variants={sectionItem}
                    animate={
                      reducedMotion
                        ? undefined
                        : { scale: isActive ? 1.08 : 1, opacity: isActive ? 1 : 0.55 }
                    }
                    whileHover={{ scale: isActive ? 1.12 : 1.05, y: -4 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="relative flex flex-col items-center text-center"
                  >
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 rounded-full blur-xl transition-opacity duration-500"
                        style={{
                          backgroundImage: `radial-gradient(circle, ${step.accent}, transparent 70%)`,
                          opacity: isActive ? 0.65 : 0.25,
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
                            filter: `drop-shadow(0 0 6px color-mix(in oklab, ${step.accent} 60%, transparent))`,
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
                                  ? `0 0 0 6px color-mix(in oklab, ${step.accent} 35%, transparent)`
                                  : "0 0 0 0px transparent",
                              }
                        }
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      >
                        <step.icon weight="fill" className="size-6" style={{ color: step.accent }} />
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
                </StepScatter>
              );
            })}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
