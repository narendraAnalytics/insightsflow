"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Quotes, Star } from "@phosphor-icons/react";
import { sectionContainer, sectionItem, sectionViewport, useParallaxY } from "@/lib/motion";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Manager",
    quote: "InsightFlow helps us see the bigger picture across all our tools. It's like having an AI teammate.",
    initials: "SC",
    accent: "var(--flow-magenta)",
    gradient: "linear-gradient(135deg, var(--flow-magenta), var(--flow-pink))",
  },
  {
    name: "Alex Rivera",
    role: "Founder",
    quote: "We save hours every week. The insights are surprisingly accurate and actually useful.",
    initials: "AR",
    accent: "var(--flow-coral)",
    gradient: "linear-gradient(135deg, var(--flow-coral), var(--flow-magenta))",
  },
  {
    name: "Priya Sharma",
    role: "Engineering Lead",
    quote: "Finally, all our tools make sense together. InsightFlow is a genuine game changer.",
    initials: "PS",
    accent: "var(--flow-cyan)",
    gradient: "linear-gradient(135deg, var(--flow-cyan), var(--flow-lavender))",
  },
  {
    name: "Diego Fernandez",
    role: "Ops Lead",
    quote: "Reports that used to take a full day now land in Notion before our standup even starts.",
    initials: "DF",
    accent: "var(--flow-lavender)",
    gradient: "linear-gradient(135deg, var(--flow-lavender), var(--flow-cyan))",
  },
  {
    name: "Maya Thompson",
    role: "Growth Marketer",
    quote: "The Slack alerts catch trend shifts we'd have otherwise found out about a week late.",
    initials: "MT",
    accent: "var(--flow-pink)",
    gradient: "linear-gradient(135deg, var(--flow-pink), var(--flow-coral))",
  },
  {
    name: "Ravi Menon",
    role: "Data Analyst",
    quote: "Deterministic numbers, human approval, then action. It's the agent workflow I actually trust.",
    initials: "RM",
    accent: "var(--flow-magenta)",
    gradient: "linear-gradient(135deg, var(--flow-magenta), var(--flow-cyan))",
  },
];

const rowOne = testimonials.slice(0, 3);
const rowTwo = testimonials.slice(3, 6);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}

function TestimonialCard({
  testimonial,
  reducedMotion,
}: {
  testimonial: (typeof testimonials)[number];
  reducedMotion: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 100;
    const my = ((event.clientY - rect.top) / rect.height) * 100;
    cardRef.current.style.setProperty("--mx", `${mx}%`);
    cardRef.current.style.setProperty("--my", `${my}%`);
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className="glass-card group relative flex w-[300px] shrink-0 flex-col items-start overflow-hidden rounded-3xl p-6 text-left transition-transform duration-300 hover:-translate-y-1.5 sm:w-[340px]"
      style={{
        boxShadow: `0 18px 40px -24px color-mix(in oklab, ${testimonial.accent} 55%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundImage: testimonial.gradient }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, ${testimonial.accent} 22%, transparent), transparent 70%)`,
        }}
      />

      <Quotes weight="fill" className="size-6" style={{ color: `color-mix(in oklab, ${testimonial.accent} 55%, transparent)` }} />
      <p className="mt-3 text-[14.5px] leading-relaxed text-(--flow-ink)/80">
        &ldquo;{testimonial.quote}&rdquo;
      </p>
      <div className="mt-5 flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-(--flow-cream)"
          style={{ backgroundImage: testimonial.gradient }}
        >
          {testimonial.initials}
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-(--flow-ink)">{testimonial.name}</p>
          <p className="text-[12px] text-(--flow-ink)/55">{testimonial.role}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, star) => (
          <Star key={star} weight="fill" className="size-3.5" style={{ color: testimonial.accent }} />
        ))}
      </div>
    </div>
  );
}

function MarqueeRow({
  row,
  reverse,
  reducedMotion,
}: {
  row: typeof testimonials;
  reverse: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div className="group relative overflow-hidden mask-[linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div
        className="animate-marquee flex w-max gap-5 group-hover:paused"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {[...row, ...row].map((testimonial, i) => (
          <TestimonialCard
            key={`${testimonial.name}-${i}`}
            testimonial={testimonial}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  const { ref, y } = useParallaxY([-25, 25]);
  const reducedMotion = useReducedMotion();

  return (
    <section ref={ref} className="relative isolate overflow-hidden py-20 sm:py-28">
      <motion.div
        aria-hidden="true"
        style={{
          y,
          background:
            "radial-gradient(45% 40% at 10% 15%, color-mix(in oklab, var(--flow-peach) 42%, transparent) 0%, transparent 65%), radial-gradient(40% 40% at 90% 10%, color-mix(in oklab, var(--flow-magenta) 26%, transparent) 0%, transparent 65%), radial-gradient(45% 45% at 85% 90%, color-mix(in oklab, var(--flow-coral) 28%, transparent) 0%, transparent 65%), radial-gradient(35% 35% at 15% 90%, color-mix(in oklab, var(--flow-cyan) 26%, transparent) 0%, transparent 65%)",
        }}
        className="absolute inset-0 -z-10"
      />
      <div
        aria-hidden="true"
        className="animate-float-slow absolute top-10 right-[8%] -z-10 size-56 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--flow-lavender), transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="animate-float-slower absolute bottom-0 left-[6%] -z-10 size-64 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--flow-pink), transparent 70%)" }}
      />

      <motion.div
        variants={sectionContainer}
        initial="hidden"
        whileInView="show"
        viewport={sectionViewport}
        className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8"
      >
        <motion.span
          variants={sectionItem}
          className="glass-panel inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-(--flow-magenta) uppercase"
        >
          Loved by users
        </motion.span>
        <motion.h2
          variants={sectionItem}
          className="mt-4 text-3xl font-semibold tracking-tight text-(--flow-ink) sm:text-4xl"
        >
          Teams are moving faster
        </motion.h2>
        <motion.p variants={sectionItem} className="mx-auto mt-3 max-w-md text-[15px] text-(--flow-ink)/65">
          See what builders, teams and creators say about InsightFlow.
        </motion.p>

        <motion.div variants={sectionItem} className="mt-12 flex flex-col gap-5">
          <MarqueeRow row={rowOne} reverse={false} reducedMotion={reducedMotion} />
          <MarqueeRow row={rowTwo} reverse={true} reducedMotion={reducedMotion} />
        </motion.div>
      </motion.div>
    </section>
  );
}
