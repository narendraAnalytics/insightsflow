"use client";

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
];

export function TestimonialsSection() {
  const { ref, y } = useParallaxY([-25, 25]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden py-20 sm:py-28">
      <motion.div
        aria-hidden="true"
        style={{
          y,
          background:
            "radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--flow-peach) 55%, transparent) 0%, transparent 70%)",
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

        <motion.div
          variants={sectionItem}
          className="group relative mt-12 overflow-hidden mask-[linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          <div className="animate-marquee flex w-max gap-5 group-hover:paused">
            {[...testimonials, ...testimonials].map((testimonial, i) => (
              <div
                key={`${testimonial.name}-${i}`}
                className="glass-card relative flex w-[320px] shrink-0 flex-col items-start overflow-hidden rounded-3xl p-6 text-left transition-transform hover:-translate-y-1.5 sm:w-[360px]"
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
                  className="absolute inset-0 -z-10"
                  style={{
                    backgroundImage: `radial-gradient(120% 100% at 0% 0%, color-mix(in oklab, ${testimonial.accent} 16%, transparent) 0%, transparent 60%)`,
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
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
