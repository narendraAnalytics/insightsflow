"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { ChatCircleText, Check, CheckCircle, Hourglass, NotePencil, PaperPlaneTilt, PlugsConnected } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { RevealHeading } from "@/components/site/primitives";

const steps = [
  {
    key: "connect",
    icon: PlugsConnected,
    accent: "var(--flow-mint)",
    title: "Connect a sheet",
    body: "Sign in with Google and pick a spreadsheet in Google's own picker. Choose the tabs you care about. Add more sheets any time.",
    live: true,
  },
  {
    key: "ask",
    icon: ChatCircleText,
    accent: "var(--flow-magenta)",
    title: "Ask in plain words",
    body: "Sarvam-105B works out which steps answer your question. pandas runs each one on your real rows, and the answer streams back with the figures it used.",
    live: true,
  },
  {
    key: "draft",
    icon: NotePencil,
    accent: "var(--flow-coral)",
    title: "Get a draft report",
    body: "The findings are written up as a short report with the key numbers spelled out, ready for a person to read.",
    live: false,
  },
  {
    key: "approve",
    icon: CheckCircle,
    accent: "var(--flow-amber)",
    title: "Approve it",
    body: "Read the draft, then approve it or send it back. Until you approve, nothing is written or posted anywhere.",
    live: false,
  },
  {
    key: "deliver",
    icon: PaperPlaneTilt,
    accent: "var(--flow-pink)",
    title: "Deliver to your team",
    body: "The approved report is saved to Notion and a summary goes to the right Slack channel.",
    live: false,
  },
] as const;

type StepKey = (typeof steps)[number]["key"];

function StepVisual({ step }: { step: StepKey }) {
  const reduced = useReducedMotion();
  const pop = (delay: number) =>
    reduced
      ? {}
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5, ease: EASE_OUT } };

  switch (step) {
    case "connect":
      return (
        <div className="flex flex-col gap-3">
          {[
            { name: "Sales 2026", tabs: ["Regions", "Monthly"], on: true },
            { name: "Targets FY27", tabs: ["Regions"], on: true },
            { name: "Inventory", tabs: ["Stock", "Returns", "Vendors"], on: false },
          ].map((s, i) => (
            <motion.div key={s.name} {...pop(0.08 * i)} className="flex items-center gap-3 rounded-2xl bg-(--flow-shell) p-3.5 shadow-(--shadow-sm)">
              <GoogleSheetsGlyph className="size-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-(--flow-ink)">{s.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.tabs.map((t) => (
                    <span key={t} className="rounded-full bg-(--flow-mint)/30 px-2 py-0.5 text-[11.5px] font-semibold text-(--flow-ink)">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-bold", s.on ? "bg-(--flow-mint) text-(--flow-ink)" : "bg-(--flow-ink)/[0.06] text-(--text-muted)")}>
                {s.on ? "Connected" : "Add"}
              </span>
            </motion.div>
          ))}
        </div>
      );
    case "ask":
      return (
        <div className="flex flex-col gap-3">
          <motion.p {...pop(0)} className="bg-sunrise ml-auto max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-[14.5px] font-medium text-(--flow-shell)">
            Which products missed target in the South last month?
          </motion.p>
          <div className="flex flex-wrap gap-1.5">
            {["read Sales › Monthly", "read Targets › Regions", "join on region", "compare to target"].map((t, i) => (
              <motion.span key={t} {...pop(0.25 + i * 0.15)} className="inline-flex items-center gap-1 rounded-full bg-(--flow-shell) px-2.5 py-1 font-mono text-[11.5px] text-(--text-secondary) shadow-(--shadow-sm)">
                <Check weight="bold" className="size-3 text-(--flow-magenta)" />
                {t}
              </motion.span>
            ))}
          </div>
          <motion.div {...pop(0.9)} className="rounded-2xl rounded-bl-md bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
            <p className="text-[14.5px] leading-relaxed text-(--flow-ink)">
              Three products missed. The biggest gap is <span className="font-semibold">Cold Brew 1L</span>, at{" "}
              <span className="font-semibold text-(--flow-magenta-700)">₹8,40,000</span> under target.
            </p>
            <p className="mt-1.5 text-[12.5px] text-(--text-muted)">In words: eight lakh forty thousand rupees</p>
          </motion.div>
        </div>
      );
    case "draft":
      return (
        <motion.div {...pop(0)} className="rounded-2xl bg-(--flow-shell) p-5 shadow-(--shadow-sm)">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-(--text-muted)">
            <NotionGlyph className="size-4" /> Draft
          </p>
          <p className="font-display mt-2 text-[26px] leading-none text-(--flow-ink)">South, September review</p>
          <ul className="mt-4 flex flex-col gap-2 text-[14px] text-(--text-secondary)">
            {["Revenue ₹3.12 crore, up 18.4%", "3 products under target", "Cold Brew 1L gap: ₹8.4 lakh"].map((l, i) => (
              <motion.li key={l} {...pop(0.2 + i * 0.12)} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-(--flow-coral)" />
                {l}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      );
    case "approve":
      return (
        <div className="flex flex-col gap-3">
          <motion.div {...pop(0)} className="flex items-center gap-2 rounded-2xl bg-(--flow-amber)/25 px-4 py-3 text-[14px] font-semibold text-(--flow-ink)">
            <Hourglass weight="fill" className="size-4 text-(--flow-coral-700)" />
            Waiting for Priya (Finance) to approve
          </motion.div>
          <motion.div {...pop(0.15)} className="rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
            <p className="text-[14.5px] font-semibold text-(--flow-ink)">South, September review</p>
            <p className="mt-1 text-[13px] text-(--text-muted)">Goes to Notion › Reports and Slack #south-sales</p>
            <div className="mt-4 flex gap-2">
              <span className="bg-sunrise inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[14px] font-semibold text-(--flow-shell)">
                <Check weight="bold" className="size-4" /> Approve
              </span>
              <span className="inline-flex flex-1 items-center justify-center rounded-full border border-(--border-strong) py-2.5 text-[14px] font-semibold text-(--flow-ink)">
                Request changes
              </span>
            </div>
          </motion.div>
        </div>
      );
    case "deliver":
      return (
        <div className="flex flex-col gap-3">
          <motion.div {...pop(0)} className="flex items-center gap-3 rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
            <NotionGlyph className="size-7" />
            <div>
              <p className="text-[14.5px] font-semibold text-(--flow-ink)">Saved to Reports</p>
              <p className="text-[12.5px] text-(--text-muted)">South, September review</p>
            </div>
          </motion.div>
          <motion.div {...pop(0.2)} className="flex gap-3 rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
            <SlackGlyph className="size-7 shrink-0" />
            <div>
              <p className="text-[14px] font-semibold text-(--flow-ink)">#south-sales</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-(--text-secondary)">
                South is up 18.4% to ₹3.12 crore. Three products missed target; details in Notion. Approved by Priya.
              </p>
            </div>
          </motion.div>
        </div>
      );
  }
}

/** Wavy rail drawn in pixel space (so particles stay round), with travelling particles. */
function FlowRail({ progress, reduced }: { progress: ReturnType<typeof useSpring>; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const segs = 8;
  let d = "M12,0";
  for (let i = 0; i < segs; i++) {
    const y0 = (h / segs) * i;
    const y1 = (h / segs) * (i + 1);
    const dx = i % 2 === 0 ? 20 : 4;
    d += ` C${dx},${y0 + (y1 - y0) * 0.35} ${dx},${y0 + (y1 - y0) * 0.65} 12,${y1}`;
  }

  return (
    <div ref={ref} aria-hidden="true" className="absolute top-0 bottom-0 left-0 w-6">
      {h > 0 && (
        <svg width="24" height={h} className="absolute inset-0 overflow-visible">
          <defs>
            <linearGradient id="rail-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--flow-mint)" />
              <stop offset="35%" stopColor="var(--flow-magenta)" />
              <stop offset="70%" stopColor="var(--flow-coral)" />
              <stop offset="100%" stopColor="var(--flow-amber)" />
            </linearGradient>
          </defs>
          <path d={d} fill="none" stroke="var(--flow-ink)" strokeOpacity={0.1} strokeWidth={2} />
          {!reduced && (
            <>
              <circle r="4" fill="var(--flow-magenta)" style={{ filter: "drop-shadow(0 0 6px var(--flow-magenta))" }}>
                <animateMotion dur="7s" repeatCount="indefinite" path={d} />
              </circle>
              <circle r="3" fill="var(--flow-amber)">
                <animateMotion dur="7s" begin="-3.5s" repeatCount="indefinite" path={d} />
              </circle>
            </>
          )}
        </svg>
      )}
      {/* scroll-scrubbed fill: scaleY overlay (pathLength bound to scroll is unreliable in this repo) */}
      <motion.div
        style={{ scaleY: progress }}
        className="absolute top-0 left-[11px] h-full w-[2px] origin-top rounded-full bg-[linear-gradient(var(--flow-mint),var(--flow-magenta),var(--flow-coral),var(--flow-amber))]"
      />
    </div>
  );
}

export function HowItWorksSection() {
  const reduced = useReducedMotion() ?? false;
  const listRef = useRef<HTMLOListElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 60%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = steps[active];

  return (
    <section id="how-it-works" className="relative isolate py-[clamp(5rem,10vw,9rem)]">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--flow-peach)_70%,transparent)_30%,color-mix(in_oklab,var(--flow-peach)_70%,transparent)_70%,transparent)]" />

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <RevealHeading
            className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] text-(--flow-ink)"
            lines={[{ text: "From a question" }, { text: "to a decision", className: "text-sunrise" }, { text: "in five steps." }]}
          />
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-(--text-secondary)">
            Steps one and two work today. Drafting, approval and delivery to Notion and Slack are being built now.
          </p>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <ol ref={listRef} className="relative pl-12">
            <FlowRail progress={progress} reduced={reduced} />
            {steps.map((step, i) => {
              const on = i === active;
              return (
                <li
                  key={step.key}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  data-index={i}
                  className="relative flex min-h-[46vh] flex-col justify-center py-8 lg:min-h-[62vh]"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-1/2 -left-12 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-all duration-500",
                      on ? "scale-110 border-transparent" : "border-(--border-strong) bg-(--flow-cream)"
                    )}
                    style={on ? { background: step.accent, boxShadow: `0 0 0 6px color-mix(in oklab, ${step.accent} 30%, transparent)` } : undefined}
                  />
                  <div className={cn("transition-opacity duration-500", on ? "opacity-100" : "opacity-40 max-lg:opacity-100")}>
                    <div className="flex items-center gap-3">
                      <span className="tabular text-[14px] font-bold text-(--text-muted)">Step {i + 1}</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11.5px] font-bold",
                          step.live ? "bg-(--flow-mint)/45 text-(--flow-ink)" : "bg-(--flow-ink)/[0.06] text-(--text-muted)"
                        )}
                      >
                        {step.live ? "Live now" : "Coming soon"}
                      </span>
                    </div>
                    <h3 className="font-display mt-3 flex items-center gap-3 text-[clamp(2rem,3.4vw,2.9rem)] leading-none text-(--flow-ink)">
                      <step.icon weight="duotone" className="size-9 shrink-0" style={{ color: step.accent }} />
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-[44ch] text-[17px] leading-relaxed text-(--text-secondary)">{step.body}</p>
                  </div>
                  {/* inline visual on small screens (no sticky panel there) */}
                  <div className="lux-card mt-6 rounded-[24px] bg-(--flow-cream) p-4 lg:hidden">
                    <StepVisual step={step.key} />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="hidden lg:block">
            <div className="sticky top-[calc(50vh-15rem)]">
              <div className="lux-card lux-grain relative isolate h-[30rem] overflow-hidden rounded-[32px] p-8">
                <motion.div
                  aria-hidden="true"
                  className="absolute -top-24 -right-24 -z-10 size-80 rounded-full blur-3xl"
                  animate={{ background: current.accent }}
                  transition={{ duration: 0.8 }}
                  style={{ opacity: 0.45 }}
                />
                <div aria-hidden="true" className="lux-dots absolute inset-0 -z-10 opacity-60" />
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-(--text-muted)">
                    Step {active + 1} of {steps.length}
                  </p>
                  <div className="flex gap-1.5">
                    {steps.map((s, i) => (
                      <span
                        key={s.key}
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: i === active ? 28 : 8, background: i <= active ? s.accent : "color-mix(in oklab, var(--flow-ink) 12%, transparent)" }}
                      />
                    ))}
                  </div>
                </div>
                <div className="relative z-[2] mt-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current.key}
                      initial={reduced ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduced ? undefined : { opacity: 0, y: -16, filter: "blur(8px)" }}
                      transition={{ duration: 0.5, ease: EASE_OUT }}
                    >
                      <StepVisual step={current.key} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
