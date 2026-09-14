"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Plus } from "@phosphor-icons/react";
import {
  GitHubGlyph,
  GmailGlyph,
  GoogleCalendarGlyph,
  GoogleDriveGlyph,
  GoogleSheetsGlyph,
  LinearGlyph,
  NotionGlyph,
  SlackGlyph,
} from "@/components/site/brand-icons";
import { sectionContainer, sectionItem, sectionViewport, useParallaxY } from "@/lib/motion";

const tiles = [
  { icon: SlackGlyph, label: "Slack", pos: "left-[4%] top-[6%]" },
  { icon: GitHubGlyph, label: "GitHub", pos: "left-[24%] top-[0%]" },
  { icon: GoogleDriveGlyph, label: "Google Drive", pos: "right-[22%] top-[2%]" },
  { icon: NotionGlyph, label: "Notion", pos: "right-[3%] top-[10%]" },
  { icon: GmailGlyph, label: "Gmail", pos: "left-[0%] top-[62%]" },
  { icon: GoogleCalendarGlyph, label: "Google Calendar", pos: "left-[22%] top-[80%]" },
  { icon: GoogleSheetsGlyph, label: "Google Sheets", pos: "right-[22%] top-[80%]" },
  { icon: LinearGlyph, label: "Linear", pos: "right-[1%] top-[60%]" },
];

export function IntegrationsSection() {
  const { ref, y } = useParallaxY([-25, 25]);
  const constellationRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: constellationProgress } = useScroll({
    target: constellationRef,
    offset: ["start end", "end start"],
  });
  const driftX = useTransform(constellationProgress, [0, 1], [-18, 18]);

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
          ref={constellationRef}
          variants={sectionItem}
          style={{ x: driftX }}
          className="relative mx-auto mt-16 hidden h-[420px] max-w-3xl lg:block"
        >
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id="trail-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--flow-magenta)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--flow-cyan)" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {tiles.map((tile) => (
              <line
                key={tile.label}
                x1="50%"
                y1="50%"
                x2={tile.pos.includes("right") ? "82%" : "18%"}
                y2={tile.pos.includes("top-[0%]") || tile.pos.includes("top-[2%]") ? "8%" : tile.pos.includes("80%") ? "88%" : "50%"}
                stroke="url(#trail-gradient)"
                strokeWidth="1.5"
                strokeDasharray="1 8"
                strokeLinecap="round"
              />
            ))}
          </svg>

          {tiles.map((tile) => (
            <motion.div
              key={tile.label}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: tile.label.length * 0.15 }}
              className={`glass-card absolute flex w-32 items-center gap-2 rounded-2xl px-3 py-2.5 ${tile.pos}`}
            >
              <tile.icon className="size-7 shrink-0" />
              <span className="text-[12.5px] font-semibold text-(--flow-ink)">{tile.label}</span>
            </motion.div>
          ))}

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
            className="glass-card absolute bottom-[0%] left-1/2 flex w-24 -translate-x-1/2 items-center justify-center gap-2 rounded-2xl px-3 py-2.5"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-(--flow-ink)/8">
              <Plus weight="bold" className="size-4 text-(--flow-magenta)" />
            </span>
            <span className="text-[12.5px] font-semibold text-(--flow-ink)">More</span>
          </motion.div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <span
              aria-hidden="true"
              className="animate-pulse-glow absolute inset-0 -z-10 rounded-full blur-2xl"
              style={{ backgroundImage: "radial-gradient(circle, var(--flow-magenta), transparent 70%)", opacity: 0.4 }}
            />
            <span className="bg-gradient-flow flex size-24 items-center justify-center rounded-full text-[13px] font-bold text-(--flow-cream) shadow-[0_20px_40px_-16px_rgba(224,90,143,0.6)]">
              InsightFlow
            </span>
          </div>
        </motion.div>

        <motion.div variants={sectionItem} className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:hidden">
          {tiles.map((tile) => (
            <div key={tile.label} className="glass-card flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5">
              <tile.icon className="size-7" />
              <span className="text-center text-[10.5px] font-semibold text-(--flow-ink)/75">{tile.label}</span>
            </div>
          ))}
          <div className="glass-card flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-(--flow-ink)/8">
              <Plus weight="bold" className="size-4 text-(--flow-magenta)" />
            </span>
            <span className="text-center text-[10.5px] font-semibold text-(--flow-ink)/75">More</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
