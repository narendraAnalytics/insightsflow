"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ChatCircleText, Check, CheckCircle, Hourglass, NotePencil, PaperPlaneTilt, PlugsConnected } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { GmailGlyph, GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { ScrubHeading } from "@/components/site/primitives";

const steps = [
  {
    key: "connect",
    icon: PlugsConnected,
    accent: "var(--flow-mint)",
    tint: "var(--flow-mint)",
    title: "Connect a sheet",
    body: "Sign in with Google and pick a spreadsheet in Google's own picker. Choose the tabs you care about. Add more sheets any time.",
  },
  {
    key: "ask",
    icon: ChatCircleText,
    accent: "var(--flow-magenta)",
    tint: "var(--flow-pink)",
    title: "Ask in plain words",
    body: "Sarvam-105B works out which steps answer your question. pandas runs each one on your real rows, and the answer streams back with the figures it used.",
  },
  {
    key: "draft",
    icon: NotePencil,
    accent: "var(--flow-coral)",
    tint: "var(--flow-aqua)",
    title: "Get a draft report",
    body: "The findings are written up as a short report with the key numbers spelled out, ready for a person to read.",
  },
  {
    key: "approve",
    icon: CheckCircle,
    accent: "var(--flow-coral-700)",
    tint: "var(--flow-lemon)",
    title: "Approve it",
    body: "Read the draft, then approve it or send it back. Until you approve, nothing is written or posted anywhere.",
  },
  {
    key: "deliver",
    icon: PaperPlaneTilt,
    accent: "var(--flow-magenta)",
    tint: "var(--flow-coral-300)",
    title: "Deliver to your team",
    body: "The approved report is saved to Notion, a summary goes to the right Slack channel, or it's emailed from your Gmail.",
  },
] as const;

type StepKey = (typeof steps)[number]["key"];
const N = steps.length;

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
          <motion.div {...pop(0)} className="flex items-center gap-2 rounded-2xl bg-(--flow-amber)/30 px-4 py-3 text-[14px] font-semibold text-(--flow-ink)">
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
        <div className="flex flex-col gap-2.5">
          <motion.div {...pop(0)} className="flex items-center gap-3 rounded-2xl bg-(--flow-shell) p-3.5 shadow-(--shadow-sm)">
            <NotionGlyph className="size-7 shrink-0" />
            <div>
              <p className="text-[14.5px] font-semibold text-(--flow-ink)">Saved to Reports</p>
              <p className="text-[12.5px] text-(--text-muted)">South, September review</p>
            </div>
          </motion.div>
          <motion.div {...pop(0.18)} className="flex gap-3 rounded-2xl bg-(--flow-shell) p-3.5 shadow-(--shadow-sm)">
            <SlackGlyph className="size-7 shrink-0" />
            <div>
              <p className="text-[14px] font-semibold text-(--flow-ink)">#south-sales</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-(--text-secondary)">
                South is up 18.4% to ₹3.12 crore. Three products missed target; details in Notion. Approved by Priya.
              </p>
            </div>
          </motion.div>
          <motion.div {...pop(0.36)} className="flex items-center gap-3 rounded-2xl bg-(--flow-shell) p-3.5 shadow-(--shadow-sm)">
            <GmailGlyph className="size-7 shrink-0" />
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold text-(--flow-ink)">Emailed to the regional heads</p>
              <p className="truncate text-[12.5px] text-(--text-muted)">Subject: South, September review</p>
            </div>
          </motion.div>
        </div>
      );
  }
}

/** Mounts the demo hidden, then remounts it (replaying its entrance) when the card reaches the screen. */
function PlayOnView({ step }: { step: StepKey }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();
  const live = inView || reduced;
  return (
    <div ref={ref} style={{ visibility: live ? "visible" : "hidden" }}>
      <StepVisual key={live ? "live" : "idle"} step={step} />
    </div>
  );
}

const tintBg = (tint: string) =>
  `linear-gradient(160deg, color-mix(in oklab, ${tint} 48%, var(--flow-shell)) 0%, color-mix(in oklab, ${tint} 20%, var(--flow-shell)) 75%)`;

function StepCopy({ index, big }: { index: number; big?: boolean }) {
  const step = steps[index];
  const Icon = step.icon;
  return (
    <div>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "font-display leading-[0.8] text-transparent [-webkit-text-stroke:2px_color-mix(in_oklab,var(--flow-ink)_45%,transparent)]",
            big ? "text-[clamp(4.5rem,7vw,6.5rem)]" : "text-[4rem]"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex flex-col gap-1.5">
          <span className="tabular text-[13px] font-bold text-(--text-muted)">
            Step {index + 1} of {N}
          </span>
          <span className="w-fit rounded-full bg-(--flow-mint) px-2.5 py-0.5 text-[11.5px] font-bold text-(--flow-ink)">Live now</span>
        </span>
      </div>
      <h3 className="font-display mt-5 flex items-center gap-3 text-[clamp(2rem,3.2vw,2.8rem)] leading-none text-(--flow-ink)">
        <Icon weight="duotone" className="size-9 shrink-0" style={{ color: step.accent }} />
        {step.title}
      </h3>
      <p className="mt-4 max-w-[42ch] text-[16px] leading-relaxed text-(--text-secondary) sm:text-[17px]">{step.body}</p>
    </div>
  );
}

const STRIP = 76; // collapsed panel width, px
const GAP = 12;

/**
 * Desktop: five panels side by side, pinned while the track scrolls past. The active step's panel
 * widens (flex-grow) to show its copy and demo; the rest are slim strips with a big number and a
 * rotated title. Visual only (aria-hidden): the phone list below doubles as the screen-reader version.
 */
function PanelDeck({ reduced }: { reduced: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const i = Math.max(0, Math.min(N - 1, Math.floor(v * N)));
    setActive((a) => (a === i ? a : i));
  });
  // 0..1 progress inside the active step
  const fill = useTransform(scrollYProgress, (v) => {
    const x = v * N;
    return Math.max(0, Math.min(1, x - Math.min(N - 1, Math.floor(x))));
  });

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // the open panel's final width; content is laid out at this width from the start so text never re-wraps mid-animation
  const openWidth = Math.max(0, rowWidth - (N - 1) * (STRIP + GAP));

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((i + 0.5) / N) * (el.offsetHeight - window.innerHeight), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div ref={trackRef} aria-hidden="true" className="relative mt-14 hidden h-[460svh] lg:block">
      <div className="sticky top-0 flex h-svh items-center">
        <ol ref={rowRef} className="flex h-[min(78svh,38rem)] w-full" style={{ gap: GAP }}>
          {steps.map((step, i) => {
            const on = i === active;
            const Icon = step.icon;
            return (
              <motion.li
                key={step.key}
                initial={false}
                animate={{ flexGrow: on ? 1 : 0 }}
                transition={reduced ? { duration: 0 } : { duration: 0.8, ease: EASE_OUT }}
                style={{ flexBasis: STRIP, flexShrink: 0 }}
                className="lux-card relative isolate min-w-0 overflow-hidden rounded-[28px]"
              >
                <span className="absolute inset-0 -z-10" style={{ background: tintBg(step.tint) }} />
                <span className="absolute -right-20 -bottom-24 -z-10 size-72 rounded-full opacity-60 blur-3xl" style={{ background: step.tint }} />

                {/* collapsed face: number, rotated title, icon. Clicking jumps the scroll to that step. */}
                <motion.button
                  type="button"
                  tabIndex={-1}
                  onClick={() => goTo(i)}
                  animate={{ opacity: on ? 0 : 1 }}
                  transition={{ duration: on ? 0.15 : 0.4, delay: on ? 0 : 0.35 }}
                  style={{ width: STRIP, pointerEvents: on ? "none" : "auto" }}
                  className="group absolute inset-y-0 left-0 flex flex-col items-center justify-between py-6"
                >
                  <span className="font-display text-[30px] leading-none text-(--flow-ink)">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-display rotate-180 text-[22px] leading-none whitespace-nowrap text-(--flow-ink)/80 transition-colors [writing-mode:vertical-rl] group-hover:text-(--flow-ink)">
                    {step.title}
                  </span>
                  <Icon weight="duotone" className="size-6 transition-transform duration-300 group-hover:scale-110" style={{ color: step.accent }} />
                </motion.button>

                {/* open face */}
                <AnimatePresence>
                  {on && (
                    <motion.div
                      key="open"
                      initial={reduced ? false : { opacity: 0, x: 28 }}
                      animate={{ opacity: 1, x: 0, transition: { delay: reduced ? 0 : 0.3, duration: 0.55, ease: EASE_OUT } }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      style={{ width: openWidth }}
                      className="absolute inset-y-0 left-0 flex flex-col p-8 xl:p-10"
                    >
                      <span className="absolute inset-x-0 top-0 h-1.5 bg-(--flow-ink)/[0.06]">
                        <motion.span style={reduced ? { scaleX: 1 } : { scaleX: fill }} className="bg-sunrise absolute inset-0 origin-left" />
                      </span>
                      <div className="grid flex-1 grid-cols-[1fr_1.05fr] items-center gap-10">
                        <StepCopy index={i} big />
                        <div className="rounded-[24px] bg-(--flow-shell)/60 p-5">
                          <StepVisual step={step.key} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Phones: a plain list of tinted cards that rise in; each demo plays when its card arrives. On desktop it
 *  stays in the accessibility tree (sr-only) as the readable version of the deck. */
function StepList({ reduced }: { reduced: boolean }) {
  return (
    <ol className="mt-12 flex flex-col gap-4 lg:sr-only">
      {steps.map((step, i) => (
        <motion.li
          key={step.key}
          initial={reduced ? false : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="lux-card relative isolate overflow-hidden rounded-[28px] p-6 sm:p-8"
        >
          <span aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: tintBg(step.tint) }} />
          <StepCopy index={i} />
          <div className="mt-6 rounded-[22px] bg-(--flow-shell)/60 p-4" aria-hidden="true">
            <PlayOnView step={step.key} />
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

export function HowItWorksSection() {
  const reduced = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);

  // the mango panel slides up over the previous section like a new sheet on the pile
  const { scrollYProgress: enter } = useScroll({ target: sectionRef, offset: ["start end", "start 0.3"] });
  const panelY = useTransform(enter, [0, 1], [180, 0]);

  return (
    <section ref={sectionRef} id="how-it-works" className="relative isolate -mt-16 pt-[clamp(6rem,11vw,10rem)] pb-[clamp(5rem,10vw,9rem)]">
      <motion.div
        aria-hidden="true"
        style={reduced ? undefined : { y: panelY }}
        className="absolute inset-0 -z-10 overflow-hidden rounded-t-[48px] will-change-transform bg-[linear-gradient(175deg,var(--flow-lemon)_0%,var(--flow-mango)_28%,var(--flow-tangerine)_100%)]"
      >
        <div className="animate-aurora-a absolute -top-24 right-[-8rem] size-[34rem] rounded-full bg-(--flow-lemon)/80 blur-[120px]" />
        <div className="animate-aurora-b absolute top-1/2 -left-40 size-[36rem] rounded-full bg-(--flow-pink)/55 blur-[130px]" />
        <div className="animate-aurora-a absolute right-1/4 bottom-0 size-[30rem] rounded-full bg-(--flow-coral)/40 blur-[120px]" style={{ animationDelay: "-5s" }} />
        <div className="lux-dots absolute inset-0 opacity-50" />
      </motion.div>

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <ScrubHeading
            className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] text-(--flow-ink)"
            lines={[{ text: "From a question" }, { text: "to a decision", className: "text-sunrise" }, { text: "in five steps." }]}
          />
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-(--text-secondary)">
            All five steps work today. Every email, Slack post and Notion page waits for your approval before it goes anywhere.
          </p>
        </div>

        <PanelDeck reduced={reduced} />
        <StepList reduced={reduced} />
      </div>
    </section>
  );
}
