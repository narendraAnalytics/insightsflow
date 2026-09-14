"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react";
import { sectionContainer, sectionItem, sectionViewport, useParallaxY } from "@/lib/motion";

const CONNECT_VIDEO_URL =
  "https://res.cloudinary.com/dkqbzwicr/video/upload/v1789399423/connectthetools_owg9lj.webm";

export function IntegrationsSection() {
  const { ref, y } = useParallaxY([-25, 25]);

  return (
    <section ref={ref} id="integrations" className="relative isolate overflow-hidden py-20 sm:py-28">
      <motion.div
        aria-hidden="true"
        style={{
          y,
          background:
            "radial-gradient(50% 45% at 50% 50%, color-mix(in oklab, var(--flow-cyan) 25%, transparent) 0%, transparent 70%)",
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
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <motion.span
              variants={sectionItem}
              className="glass-panel inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-(--flow-magenta) uppercase"
            >
              Popular integrations
            </motion.span>
            <motion.h2
              variants={sectionItem}
              className="mt-4 text-3xl font-semibold tracking-tight text-(--flow-ink) sm:text-4xl"
            >
              Connect the tools you love
            </motion.h2>
            <motion.p variants={sectionItem} className="mt-3 max-w-md text-[15px] text-(--flow-ink)/65">
              Start with a few clicks. Add more anytime.
            </motion.p>
          </div>
          <motion.a
            variants={sectionItem}
            href="#integrations"
            className="glass-panel inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-(--flow-ink) transition-transform hover:scale-[1.02]"
          >
            View all integrations
            <ArrowRight weight="bold" className="size-3.5" />
          </motion.a>
        </div>

        <motion.div
          variants={sectionItem}
          className="glass-card relative mx-auto mt-16 h-[500px] max-w-15xl overflow-hidden rounded-3xl"
        >
          <video
            src={CONNECT_VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-100 backdrop-blur-lg"
            style={{
              maskImage: "linear-gradient(to top, black, transparent)",
              WebkitMaskImage: "linear-gradient(to top, black, transparent)",
              backgroundImage:
                "linear-gradient(to top, color-mix(in oklab, var(--flow-cream) 55%, transparent), transparent)",
            }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
