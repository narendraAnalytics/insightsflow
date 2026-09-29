"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Check, ChatCircleText, CheckCircle, House, Plugs, SquaresFour } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { RevealHeading } from "@/components/site/primitives";

const tabs = [
  { key: "dashboard", label: "Dashboard", icon: House },
  { key: "insights", label: "AI Insights", icon: ChatCircleText },
  { key: "approval", label: "Approval", icon: CheckCircle },
] as const;
type TabKey = (typeof tabs)[number]["key"];

const CYCLE_MS = 5200;
// Which mock-sidebar icon (Home, Integrations, Insights, Approval) lights up per tab.
const SIDEBAR_INDEX: Record<TabKey, number> = { dashboard: 0, insights: 2, approval: 3 };

function CountUp({ to, run }: { to: number; run: boolean }) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!run || reduced) return;
    const c = animate(0, to, { duration: 1.3, ease: EASE_OUT, onUpdate: setV });
    return () => c.stop();
  }, [run, to, reduced]);
  return <>{Math.round(v).toLocaleString("en-IN")}</>;
}

function DashboardView() {
  const kpis = [
    { label: "Connected sheets", value: "3", tint: "var(--flow-mint)" },
    { label: "Data tabs", value: "7", tint: "var(--flow-amber)" },
    { label: "Questions asked", value: "24", tint: "var(--flow-magenta)" },
  ];
  const pts = [18, 26, 22, 38, 34, 52, 61];
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (pts.length - 1)) * 300},${80 - p}`).join(" ");
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-(--flow-shell) p-3.5 shadow-(--shadow-sm) sm:p-4">
            <span className="block h-1.5 w-8 rounded-full" style={{ background: k.tint }} />
            <p className="font-display tabular mt-3 text-[30px] leading-none text-(--flow-ink) sm:text-[38px]">{k.value}</p>
            <p className="mt-1 text-[12px] font-medium text-(--text-muted) sm:text-[13px]">{k.label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
          <p className="text-[13px] font-semibold text-(--flow-ink)">Activity this week</p>
          <svg viewBox="0 0 300 84" className="mt-3 h-24 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sc-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--flow-magenta)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--flow-magenta)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path} L300,84 L0,84 Z`} fill="url(#sc-area)" />
            <path d={path} fill="none" stroke="var(--flow-magenta)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className="rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
          <p className="text-[13px] font-semibold text-(--flow-ink)">Your sheets</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {["Sales 2026", "Targets FY27", "Returns"].map((s) => (
              <li key={s} className="flex items-center gap-2 text-[13px] text-(--flow-ink)">
                <GoogleSheetsGlyph className="size-4" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function InsightsView({ run }: { run: boolean }) {
  const bars = [
    { r: "South", v: 100 },
    { r: "West", v: 92 },
    { r: "North", v: 77 },
    { r: "East", v: 63 },
  ];
  return (
    <div className="grid gap-3">
      <p className="bg-sunrise ml-auto max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] font-medium text-(--flow-shell)">
        What was South&apos;s revenue in Q3, and how does it rank?
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
          <p className="text-[12.5px] font-semibold text-(--text-muted)">South, Q3 revenue</p>
          <p className="font-display tabular mt-2 text-[36px] leading-none text-(--flow-ink)">
            ₹<CountUp to={31245600} run={run} />
          </p>
          <p className="mt-2 text-[13px] font-medium text-(--flow-magenta-700)">Three crore twelve lakh forty-five thousand six hundred</p>
        </div>
        <div className="rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
          <p className="text-[12.5px] font-semibold text-(--text-muted)">Revenue by region</p>
          <ul className="mt-3 flex flex-col gap-2">
            {bars.map((b, i) => (
              <li key={b.r} className="grid grid-cols-[3.2rem_1fr] items-center gap-2 text-[12.5px] text-(--flow-ink)">
                {b.r}
                <span className="h-3 overflow-hidden rounded-full bg-(--flow-ink)/[0.06]">
                  <motion.span
                    className={cn("block h-full origin-left rounded-full", i === 0 ? "bg-sunrise" : "bg-(--flow-coral-300)")}
                    style={{ width: `${b.v}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: run ? 1 : 0 }}
                    transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 + i * 0.08 }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ApprovalView() {
  return (
    <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
      <div className="rounded-2xl bg-(--flow-shell) p-5 shadow-(--shadow-sm)">
        <p className="text-[12.5px] font-semibold text-(--text-muted)">Draft report</p>
        <p className="font-display mt-2 text-[26px] leading-none text-(--flow-ink)">Q3 regional review</p>
        <p className="mt-3 text-[14px] leading-relaxed text-(--text-secondary)">
          South led growth at 18.4%, reaching ₹3.12 crore. East grew slowest at 3.1% and is 12% under target.
        </p>
        <div className="mt-5 flex gap-2">
          <span className="bg-sunrise inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[14px] font-semibold text-(--flow-shell)">
            <Check weight="bold" className="size-4" /> Approve
          </span>
          <span className="inline-flex flex-1 items-center justify-center rounded-full border border-(--border-strong) py-2.5 text-[14px] font-semibold text-(--flow-ink)">
            Request changes
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {[
          { icon: NotionGlyph, t: "Notion", d: "Reports › Q3" },
          { icon: SlackGlyph, t: "Slack", d: "#leadership" },
        ].map((x) => (
          <div key={x.t} className="flex items-center gap-3 rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
            <x.icon className="size-6" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-(--flow-ink)">{x.t}</p>
              <p className="truncate text-[12.5px] text-(--text-muted)">{x.d}</p>
            </div>
            <span className="rounded-full bg-(--flow-amber)/30 px-2 py-0.5 text-[11px] font-bold text-(--flow-ink)">After approval</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductShowcaseSection() {
  const reduced = useReducedMotion() ?? false;
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { amount: 0.4 });
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [paused, setPaused] = useState(false);

  // Tilt up from a 3D angle as it scrolls in, then land on a plain (non-3D)
  // transform so text inside is rendered crisply at rest.
  const { scrollYProgress } = useScroll({ target: frameRef, offset: ["start end", "start 0.3"] });
  const transform = useTransform(scrollYProgress, (p) => {
    if (reduced || p >= 0.995) return "none";
    const k = 1 - p;
    return `perspective(1600px) translateY(${k * 70}px) rotateX(${k * 26}deg) scale(${0.9 + p * 0.1})`;
  });

  useEffect(() => {
    if (reduced || paused || !inView) return;
    const id = setInterval(() => {
      setTab((t) => tabs[(tabs.findIndex((x) => x.key === t) + 1) % tabs.length].key);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [reduced, paused, inView]);

  return (
    <section className="relative isolate overflow-hidden py-[clamp(5rem,10vw,9rem)]">
      <div aria-hidden="true" className="absolute inset-x-0 top-[30%] -z-10 mx-auto h-[70%] max-w-5xl rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--flow-magenta)_30%,transparent),color-mix(in_oklab,var(--flow-amber)_18%,transparent)_55%,transparent)] blur-2xl" />

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <RevealHeading
            className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] text-(--flow-ink)"
            lines={[{ text: "One workspace for" }, { text: "every answer.", className: "text-sunrise" }]}
          />
          <p className="mx-auto mt-5 max-w-[46ch] text-[17px] leading-relaxed text-(--text-secondary)">
            See your sheets, ask questions, and sign off on reports without switching tabs. Figures shown are
            illustrative.
          </p>
        </div>

        <div
          className="mt-12 flex justify-center"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div role="tablist" aria-label="Product views" className="lux-card inline-flex gap-1 rounded-full p-1.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls="showcase-panel"
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative isolate inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors sm:px-5",
                  tab === t.key ? "text-(--flow-shell)" : "text-(--text-secondary) hover:text-(--flow-ink)"
                )}
              >
                {tab === t.key && (
                  <motion.span layoutId="showcase-tab" className="bg-sunrise absolute inset-0 -z-10 rounded-full" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                )}
                <t.icon weight={tab === t.key ? "fill" : "regular"} className="size-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          ref={frameRef}
          style={{ transform, transformOrigin: "50% 100%" }}
          className="lux-card mx-auto mt-8 max-w-5xl rounded-[30px] p-2 shadow-(--shadow-lg) sm:p-2.5"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
        >
          <div className="overflow-hidden rounded-[24px] bg-(--flow-cream)">
            {/* browser chrome */}
            <div className="flex items-center gap-3 border-b border-(--border-subtle) bg-(--flow-shell) px-4 py-3">
              <div className="flex gap-1.5">
                {["var(--flow-coral)", "var(--flow-amber)", "var(--flow-mint)"].map((c) => (
                  <span key={c} className="size-3 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <span className="mx-auto rounded-full bg-(--flow-cream) px-4 py-1 text-[12px] font-medium text-(--text-muted)">
                insightsflow.vercel.app/dashboard
              </span>
              <span className="w-10" />
            </div>
            <div className="flex">
              <aside className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-(--border-subtle) py-5 sm:flex">
                {[SquaresFour, Plugs, ChatCircleText, CheckCircle].map((Icon, i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      i === SIDEBAR_INDEX[tab] ? "bg-sunrise text-(--flow-shell)" : "text-(--text-muted)"
                    )}
                  >
                    <Icon weight="duotone" className="size-5" />
                  </span>
                ))}
              </aside>
              <div id="showcase-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="relative min-h-[380px] flex-1 p-4 sm:min-h-[340px] sm:p-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={reduced ? false : { opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? undefined : { opacity: 0, x: -24 }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                  >
                    {tab === "dashboard" && <DashboardView />}
                    {tab === "insights" && <InsightsView run={inView} />}
                    {tab === "approval" && <ApprovalView />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
