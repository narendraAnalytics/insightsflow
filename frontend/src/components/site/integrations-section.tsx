"use client";

import type { ComponentType, CSSProperties, ReactNode, SVGProps } from "react";
import { motion } from "framer-motion";
import { Brain, ChartBar, CreditCard, Database, LockKey } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT, sectionContainer, sectionItem, sectionViewport } from "@/lib/motion";
import { GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { LogoVideo } from "@/components/site/logo-video";
import { RevealHeading } from "@/components/site/primitives";

const TILT = 60; // degrees the orbit plane leans back

type OrbitItem = { key: string; node: ReactNode; tint: string };

const inner: OrbitItem[] = [
  { key: "sheets", node: <GoogleSheetsGlyph className="size-8" />, tint: "var(--flow-mint)" },
  { key: "sarvam", node: <Brain weight="duotone" className="size-8 text-(--flow-magenta)" />, tint: "var(--flow-magenta)" },
  { key: "pandas", node: <ChartBar weight="duotone" className="size-8 text-(--flow-coral)" />, tint: "var(--flow-amber)" },
];

const outer: OrbitItem[] = [
  { key: "notion", node: <NotionGlyph className="size-8" />, tint: "var(--flow-pink)" },
  { key: "slack", node: <SlackGlyph className="size-8" />, tint: "var(--flow-coral)" },
  { key: "clerk", node: <LockKey weight="duotone" className="size-7 text-(--flow-magenta)" />, tint: "var(--flow-magenta)" },
  { key: "neon", node: <Database weight="duotone" className="size-7 text-(--flow-mint)" />, tint: "var(--flow-mint)" },
  { key: "razorpay", node: <CreditCard weight="duotone" className="size-7 text-(--flow-coral)" />, tint: "var(--flow-amber)" },
];

const legend: { icon: ComponentType<SVGProps<SVGSVGElement>>; name: string; role: string; live: boolean }[] = [
  { icon: GoogleSheetsGlyph, name: "Google Sheets", role: "Reads the spreadsheets and tabs you pick", live: true },
  { icon: NotionGlyph, name: "Notion", role: "Keeps every approved report in one place", live: false },
  { icon: SlackGlyph, name: "Slack", role: "Posts approved summaries to the right channel", live: false },
];

const preserve: CSSProperties = { transformStyle: "preserve-3d" };

function Ring({ items, radius, duration, reverse }: { items: OrbitItem[]; radius: number; duration: number; reverse?: boolean }) {
  const spin = `${reverse ? "spin-slow-reverse" : "spin-slow"} ${duration}s linear infinite`;
  const counter = `${reverse ? "spin-slow" : "spin-slow-reverse"} ${duration}s linear infinite`;
  return (
    <>
      {/* the ring line itself */}
      <div
        className="absolute top-1/2 left-1/2 rounded-full border-2 border-dashed border-(--flow-magenta)/25"
        style={{ width: `${radius * 2}%`, height: `${radius * 2}%`, transform: "translate(-50%, -50%)" }}
      />
      <div className="absolute inset-0" style={{ ...preserve, animation: spin }}>
        {items.map((item, i) => {
          const angle = (360 / items.length) * i;
          const rad = (angle * Math.PI) / 180;
          return (
            <div key={item.key} style={preserve}>
              {/* spoke with a pulse travelling to the hub */}
              <div
                className="absolute top-1/2 left-1/2 h-[2px] origin-left overflow-hidden"
                style={{ width: `${radius}%`, transform: `rotate(${angle}deg)` }}
              >
                <div className="h-full w-full bg-[linear-gradient(90deg,color-mix(in_oklab,var(--flow-magenta)_35%,transparent),transparent)]" />
                <span
                  className="absolute top-0 h-full w-8 rounded-full bg-(--flow-magenta)"
                  style={{ animation: `spoke-pulse 2.8s ${i * 0.5}s ease-in-out infinite` }}
                />
              </div>
              <div
                className="absolute"
                style={{
                  ...preserve,
                  // Rounded: server (Node) and browser Math.cos/sin can differ in the
                  // last digits, which made the style strings mismatch on hydration.
                  left: `${(50 + radius * Math.cos(rad)).toFixed(3)}%`,
                  top: `${(50 + radius * Math.sin(rad)).toFixed(3)}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div style={{ ...preserve, animation: counter }}>
                  <div
                    className="flex size-16 items-center justify-center rounded-2xl bg-(--flow-shell) sm:size-[72px]"
                    style={{
                      transform: `rotateX(-${TILT}deg) translateY(-50%)`,
                      boxShadow: `0 14px 30px -12px color-mix(in oklab, ${item.tint} 70%, transparent), inset 0 0 0 1px color-mix(in oklab, ${item.tint} 35%, transparent)`,
                    }}
                  >
                    {item.node}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Orbit() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]" style={{ perspective: "1400px" }} aria-hidden="true">
      <div className="absolute inset-[8%] rounded-full bg-(--flow-magenta)/15 blur-3xl" />
      <div className="absolute inset-0" style={{ ...preserve, transform: `rotateX(${TILT}deg)` }}>
        <div className="absolute inset-[4%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--flow-shell)_85%,transparent)_0%,color-mix(in_oklab,var(--flow-peach)_60%,transparent)_60%,transparent_72%)]" />
        <Ring items={inner} radius={25} duration={30} reverse />
        <Ring items={outer} radius={44} duration={48} />
        {/* hub stands upright in the middle of the plane */}
        <div className="absolute top-1/2 left-1/2" style={{ ...preserve, transform: "translate(-50%, -50%)" }}>
          <div style={{ transform: `rotateX(-${TILT}deg) translateY(-50%)` }} className="relative">
            <span className="animate-ping-soft absolute inset-0 rounded-[28px] bg-(--flow-magenta)/30" />
            <div className="lux-card relative flex size-24 items-center justify-center rounded-[28px] sm:size-28">
              <LogoVideo className="size-16 rounded-2xl sm:size-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  return (
    <section id="integrations" className="relative isolate overflow-hidden py-[clamp(5rem,10vw,9rem)]">
      <div aria-hidden="true" className="animate-aurora-a absolute top-1/4 right-[-12rem] -z-10 size-[36rem] rounded-full bg-(--flow-mint)/30 blur-[120px]" />
      <div aria-hidden="true" className="animate-aurora-b absolute bottom-0 left-[-10rem] -z-10 size-[30rem] rounded-full bg-(--flow-pink)/45 blur-[110px]" />

      <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
        <div>
          <RevealHeading
            className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] text-(--flow-ink)"
            lines={[{ text: "Your data comes in." }, { text: "Your team hears about it.", className: "text-sunrise" }]}
          />
          <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-(--text-secondary)">
            InsightFlow sits between the sheets you already keep and the places your team already reads.
          </p>

          <motion.ul
            variants={sectionContainer}
            initial="hidden"
            whileInView="show"
            viewport={sectionViewport}
            className="mt-10 flex flex-col gap-3"
          >
            {legend.map((row) => (
              <motion.li
                key={row.name}
                variants={sectionItem}
                className="lux-card flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-transform duration-300 hover:translate-x-1"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-(--flow-cream)">
                  <row.icon className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-(--flow-ink)">{row.name}</span>
                  <span className="block text-[14px] text-(--text-muted)">{row.role}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold",
                    row.live ? "bg-(--flow-mint) text-(--flow-ink)" : "bg-(--flow-ink)/[0.06] text-(--text-muted)"
                  )}
                >
                  {row.live ? "Live" : "Coming soon"}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.1, ease: EASE_OUT }}
        >
          <Orbit />
        </motion.div>
      </div>
    </section>
  );
}
