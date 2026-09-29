"use client";

import { useReducedMotion } from "framer-motion";
import { Quotes, Sparkle } from "@phosphor-icons/react";
import { GoogleSheetsGlyph } from "@/components/site/brand-icons";
import { useCursorGlow } from "@/lib/motion";
import { RevealHeading } from "@/components/site/primitives";

/*
 * Example questions by role. These are illustrations of what the product is for,
 * not customer testimonials — no names, companies or ratings.
 */
/*
 * Each card has its own color identity. "solid" cards carry a full sunrise
 * gradient; "tint" cards a soft wash of their accent. `ink` picks the text color
 * that keeps contrast on that background (cream on magenta/coral, ink on amber).
 */
type Tone = { kind: "solid" | "tint"; accent: string; bg: string; ink: "cream" | "ink" };

const examples: { role: string; question: string; answer: string; sheets: string[]; tone: Tone }[] = [
  {
    role: "Finance lead",
    question: "What was revenue by region last quarter, in crore?",
    answer: "South led with ₹3.12 crore, 38% of the total.",
    sheets: ["Sales 2026"],
    tone: { kind: "solid", accent: "var(--flow-magenta)", bg: "linear-gradient(145deg, var(--flow-magenta) 0%, var(--flow-coral) 100%)", ink: "cream" },
  },
  {
    role: "Founder",
    question: "Which month had the highest burn, and what drove it?",
    answer: "August, at ₹42.6 lakh. Hiring was 61% of it.",
    sheets: ["Expenses"],
    tone: { kind: "tint", accent: "var(--flow-coral)", bg: "linear-gradient(150deg, var(--flow-coral-100) 0%, var(--flow-peach) 100%)", ink: "ink" },
  },
  {
    role: "Sales manager",
    question: "Who is furthest behind their target this month?",
    answer: "The West team, 34% short with 9 days left.",
    sheets: ["Deals", "Targets"],
    tone: { kind: "solid", accent: "var(--flow-amber)", bg: "linear-gradient(145deg, var(--flow-amber) 0%, var(--flow-coral) 100%)", ink: "ink" },
  },
  {
    role: "Ops lead",
    question: "Which SKUs have fewer than 10 days of stock left?",
    answer: "7 SKUs. Cold Brew 1L runs out in 4 days.",
    sheets: ["Inventory"],
    tone: { kind: "tint", accent: "var(--flow-mint)", bg: "linear-gradient(150deg, color-mix(in oklab, var(--flow-mint) 45%, var(--flow-shell)) 0%, var(--flow-shell) 100%)", ink: "ink" },
  },
  {
    role: "D2C marketer",
    question: "Which campaign brought the cheapest orders in Diwali week?",
    answer: "Instagram Reels, at ₹182 per order.",
    sheets: ["Ads", "Orders"],
    tone: { kind: "solid", accent: "var(--flow-magenta)", bg: "linear-gradient(145deg, var(--flow-magenta-700) 0%, var(--flow-magenta) 100%)", ink: "cream" },
  },
  {
    role: "Analyst",
    question: "Compare returns to orders by city and flag anything above 8%.",
    answer: "Pune (9.4%) and Jaipur (8.7%) are above 8%.",
    sheets: ["Orders", "Returns"],
    tone: { kind: "tint", accent: "var(--flow-amber)", bg: "linear-gradient(150deg, color-mix(in oklab, var(--flow-amber) 40%, var(--flow-shell)) 0%, var(--flow-peach) 100%)", ink: "ink" },
  },
];

const rowOne = examples.slice(0, 3);
const rowTwo = examples.slice(3);

function ExampleCard({ example }: { example: (typeof examples)[number] }) {
  const reduced = useReducedMotion() ?? false;
  const glow = useCursorGlow<HTMLElement>(reduced);
  const { tone } = example;
  const solid = tone.kind === "solid";
  const text = tone.ink === "cream" ? "var(--flow-shell)" : "var(--flow-ink)";

  return (
    <figure
      ref={glow.ref}
      onPointerMove={glow.onPointerMove}
      className="group relative isolate flex min-h-[250px] w-[300px] shrink-0 flex-col overflow-hidden rounded-[28px] p-6 text-left transition-transform duration-300 hover:-translate-y-1.5 hover:rotate-[-0.6deg] sm:w-[380px] sm:p-7"
      style={{
        background: tone.bg,
        color: text,
        boxShadow: solid
          ? `0 22px 44px -22px color-mix(in oklab, ${tone.accent} 85%, transparent), inset 0 1px 0 color-mix(in oklab, var(--flow-shell) 45%, transparent)`
          : `0 18px 40px -24px color-mix(in oklab, ${tone.accent} 70%, transparent), inset 0 0 0 1px color-mix(in oklab, ${tone.accent} 40%, transparent)`,
      }}
    >
      {/* cursor glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--flow-shell) ${solid ? 30 : 70}%, transparent), transparent 70%)`,
        }}
      />
      {/* soft corner bloom */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -bottom-16 -z-10 size-48 rounded-full blur-2xl"
        style={{ background: solid ? "color-mix(in oklab, var(--flow-amber) 55%, transparent)" : `color-mix(in oklab, ${tone.accent} 45%, transparent)` }}
      />
      {/* big quote mark watermark */}
      <Quotes
        aria-hidden="true"
        weight="fill"
        className="pointer-events-none absolute -top-3 right-4 -z-10 size-28 transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-6"
        style={{ color: solid ? "color-mix(in oklab, var(--flow-shell) 22%, transparent)" : `color-mix(in oklab, ${tone.accent} 35%, transparent)` }}
      />

      <figcaption>
        <span
          className="inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-[13px] font-bold"
          style={
            solid
              ? { background: "color-mix(in oklab, var(--flow-shell) 22%, transparent)", color: text }
              : { background: tone.accent, color: "var(--flow-ink)" }
          }
        >
          <span
            className="flex size-6 items-center justify-center rounded-full"
            style={{ background: solid ? "var(--flow-shell)" : "color-mix(in oklab, var(--flow-shell) 70%, transparent)" }}
          >
            <Quotes weight="fill" className="size-3" style={{ color: solid ? tone.accent : "var(--flow-ink)" }} />
          </span>
          {example.role}
        </span>
      </figcaption>

      <blockquote className="font-display mt-6 flex-1 text-[26px] leading-[1.08] sm:text-[29px]" style={{ color: text }}>
        {example.question}
      </blockquote>

      {/* the outcome: what InsightFlow answers (illustrative) */}
      <p
        className="mt-5 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug font-semibold"
        style={{
          background: solid ? "color-mix(in oklab, var(--flow-shell) 92%, transparent)" : "color-mix(in oklab, var(--flow-shell) 80%, transparent)",
          color: "var(--flow-ink)",
        }}
      >
        <Sparkle weight="fill" className="mt-0.5 size-4 shrink-0" style={{ color: tone.accent === "var(--flow-amber)" ? "var(--flow-coral-700)" : tone.accent }} />
        {example.answer}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {example.sheets.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
            style={{
              background: solid ? "color-mix(in oklab, var(--flow-shell) 88%, transparent)" : "color-mix(in oklab, var(--flow-shell) 75%, transparent)",
              color: "var(--flow-ink)",
            }}
          >
            <GoogleSheetsGlyph className="size-3.5" />
            {s}
          </span>
        ))}
      </div>
    </figure>
  );
}

function MarqueeRow({ row, reverse }: { row: typeof examples; reverse?: boolean }) {
  return (
    <div className="group overflow-hidden py-3 mask-[linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div
        className="animate-marquee flex w-max gap-5 group-hover:paused"
        style={{ animationDuration: "46s", ...(reverse ? { animationDirection: "reverse" } : {}) }}
      >
        {[...row, ...row, ...row, ...row].map((example, i) => (
          <div key={`${example.role}-${i}`} aria-hidden={i >= row.length}>
            <ExampleCard example={example} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section id="use-cases" className="relative isolate overflow-hidden py-[clamp(5rem,10vw,9rem)]">
      <div aria-hidden="true" className="animate-aurora-a absolute top-0 left-1/4 -z-10 size-[34rem] rounded-full bg-(--flow-amber)/25 blur-[120px]" />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-6 lg:grid-cols-[1.3fr_1fr]">
          <RevealHeading
            className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] text-(--flow-ink)"
            lines={[{ text: "Built for the questions" }, { text: "you ask every week.", className: "text-sunrise" }]}
          />
          <p className="max-w-[40ch] text-[17px] leading-relaxed text-(--text-secondary) lg:pb-2">
            Find your team below. Type the question the way you would say it; answers shown are illustrative.
          </p>
        </div>
      </div>
      <div className="mt-12 flex flex-col gap-2">
        <MarqueeRow row={rowOne} />
        <MarqueeRow row={rowTwo} reverse />
      </div>
    </section>
  );
}
