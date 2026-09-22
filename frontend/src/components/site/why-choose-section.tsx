"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { sectionContainer, sectionItem, sectionViewport, useParallaxY } from "@/lib/motion";

const benefits = [
  {
    image: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790078430/allurtoolsinoneplace_dpg5yd.png",
    glow: "var(--flow-magenta)",
    title: "All your tools in one place",
  },
  {
    image: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790078430/aipoweredanalysis_s0svwq.png",
    glow: "var(--flow-lavender)",
    title: "AI-powered analysis",
  },
  {
    image: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790078430/insightsseenaction_yghv9c.png",
    glow: "var(--flow-coral)",
    title: "Insights turned into action",
  },
  {
    image: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790078430/savetimeandfocused_k4kvwz.png",
    glow: "var(--flow-cyan)",
    title: "Save time, stay focused",
  },
];

// Resting fan position for each card, arranged as a shallow ring facing the viewer.
const fanPose = [
  { rotateY: -24, z: -50, y: 26 },
  { rotateY: -8, z: 20, y: 0 },
  { rotateY: 8, z: 20, y: 0 },
  { rotateY: 24, z: -50, y: 26 },
];

// Where each card scatters from before it "arranges" into place as you scroll it into view.
const scatterFrom = [
  { x: -260, y: -50, rotate: -22 },
  { x: -110, y: 80, rotate: 16 },
  { x: 110, y: -80, rotate: -16 },
  { x: 260, y: 50, rotate: 22 },
];

const SWAP_INTERVAL_MS = 3400;

function useIsRingLayout() {
  const [isRing, setIsRing] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setIsRing(mql.matches && !reduceMotion.matches);
    update();
    mql.addEventListener("change", update);
    reduceMotion.addEventListener("change", update);
    return () => {
      mql.removeEventListener("change", update);
      reduceMotion.removeEventListener("change", update);
    };
  }, []);
  return isRing;
}

function BenefitCard({
  benefit,
  pose,
  scatter,
  isRing,
  arrangeProgress,
}: {
  benefit: (typeof benefits)[number];
  pose: (typeof fanPose)[number];
  scatter: (typeof scatterFrom)[number];
  isRing: boolean;
  arrangeProgress: MotionValue<number>;
}) {
  const settle = useSpring(arrangeProgress, { stiffness: 120, damping: 22, mass: 0.6 });

  const x = useTransform(settle, [0, 1], [scatter.x, 0]);
  const rotate = useTransform(settle, [0, 1], [scatter.rotate, 0]);
  const opacity = useTransform(settle, [0, 0.65], [0, 1]);
  const y = useTransform(settle, (progress) => scatter.y * (1 - progress) + (isRing ? pose.y : 0));

  return (
    <motion.div
      style={{
        x,
        y,
        rotate,
        opacity,
        rotateY: isRing ? pose.rotateY : 0,
        z: isRing ? pose.z : 0,
      }}
      whileHover={
        isRing
          ? { rotateY: pose.rotateY * 0.25, z: pose.z + 90, scale: 1.05 }
          : { scale: 1.02 }
      }
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="group relative aspect-square w-full overflow-hidden rounded-3xl shadow-[0_24px_50px_-22px_rgba(224,90,143,0.45)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 -z-10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-70"
        style={{ background: `radial-gradient(65% 65% at 25% 15%, ${benefit.glow}, transparent 70%)` }}
      />
      <img src={benefit.image} alt={benefit.title} className="h-full w-full object-cover" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/60 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[220%] group-hover:opacity-100"
      />
    </motion.div>
  );
}

export function WhyChooseSection() {
  const { ref, y } = useParallaxY([-30, 30]);
  const isRing = useIsRingLayout();
  const gridRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: arrangeProgress } = useScroll({
    target: gridRef,
    offset: ["start 0.92", "start 0.42"],
  });

  const [order, setOrder] = useState([0, 1, 2, 3]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!isRing || paused) return;
    const id = setInterval(() => {
      setOrder((prev) => [...prev.slice(1), prev[0]]);
    }, SWAP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isRing, paused]);

  return (
    <section ref={ref} id="product" className="relative isolate overflow-hidden py-20 sm:py-28">
      <motion.div
        aria-hidden="true"
        style={{
          y,
          background:
            "radial-gradient(50% 45% at 8% 8%, color-mix(in oklab, var(--flow-magenta) 32%, transparent) 0%, transparent 65%), radial-gradient(45% 40% at 95% 22%, color-mix(in oklab, var(--flow-cyan) 38%, transparent) 0%, transparent 65%), radial-gradient(40% 40% at 50% 100%, color-mix(in oklab, var(--flow-coral) 30%, transparent) 0%, transparent 68%), radial-gradient(35% 35% at 80% 85%, color-mix(in oklab, var(--flow-lavender) 32%, transparent) 0%, transparent 65%)",
        }}
        className="absolute inset-0 -z-10"
      />
      <div
        aria-hidden="true"
        className="animate-float-slow absolute -top-16 left-[6%] -z-10 size-64 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--flow-pink), transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="animate-float-slower absolute right-[4%] bottom-0 -z-10 size-72 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--flow-cyan), transparent 70%)" }}
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

        <motion.div
          ref={gridRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          animate={isRing ? { rotateY: [-4, 4, -4] } : undefined}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          style={{ perspective: 1600, transformStyle: "preserve-3d" }}
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {order.map((benefitIndex, slot) => {
            const benefit = benefits[benefitIndex];
            return (
              <motion.div
                key={benefit.title}
                layout
                transition={{ layout: { type: "spring", stiffness: 260, damping: 26 } }}
                className="h-full"
              >
                <BenefitCard
                  benefit={benefit}
                  pose={fanPose[slot]}
                  scatter={scatterFrom[slot]}
                  isRing={isRing}
                  arrangeProgress={arrangeProgress}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
}
