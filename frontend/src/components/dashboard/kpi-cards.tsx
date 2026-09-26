"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChatsCircle, FileXls, Plug, Table } from "@phosphor-icons/react";
import { useDashboardSummary } from "@/hooks/use-dashboard-stats";

type Summary = NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>;

const kpiConfig = [
  {
    label: "Connected Sheets",
    icon: FileXls,
    accent: "var(--flow-magenta)",
    href: "/dashboard/integrations",
    value: (s: Summary) => s.stats.connected_sheets,
    note: (s: Summary) =>
      s.stats.connected_tabs ? `${s.stats.connected_tabs} tab${s.stats.connected_tabs === 1 ? "" : "s"} in total` : "No data yet",
  },
  {
    label: "Active Integrations",
    icon: Plug,
    accent: "var(--flow-cyan)",
    href: "/dashboard/integrations",
    value: (s: Summary) => s.stats.active_integrations,
    note: (s: Summary) => (s.stats.active_integrations ? "Google Sheets" : "No data yet"),
  },
  {
    label: "Questions Asked",
    icon: ChatsCircle,
    accent: "var(--flow-coral)",
    href: "/dashboard/ai-insights",
    value: (s: Summary) => s.stats.questions_asked,
    note: (s: Summary) => (s.stats.questions_asked ? "In AI Insights" : "No data yet"),
  },
  {
    label: "Data Tabs",
    icon: Table,
    accent: "var(--flow-lavender)",
    href: "/dashboard/integrations",
    value: (s: Summary) => s.stats.connected_tabs,
    note: (s: Summary) => (s.stats.connected_tabs ? "Ready to analyse" : "No data yet"),
  },
];

/** Counts up to `value` (snaps under reduced motion). */
function CountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <>{shown.toLocaleString("en-IN")}</>;
}

function KpiCard({
  kpi,
  index,
  summary,
  isLoading,
  reduce,
}: {
  kpi: (typeof kpiConfig)[number];
  index: number;
  summary: Summary | null | undefined;
  isLoading: boolean;
  reduce: boolean;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);

  // Pointer position goes straight to CSS vars — no re-render per mouse move.
  const track = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || reduce) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const value = summary ? kpi.value(summary) : 0;
  const live = value > 0;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: "easeOut" }}
    >
      <Link
        ref={ref}
        href={kpi.href}
        onPointerMove={track}
        className="glass-card group relative isolate flex h-full flex-col gap-4 overflow-hidden rounded-2xl p-5 outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-(--flow-magenta) active:scale-[0.98]"
        style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${kpi.accent} 20%, transparent)` }}
      >
        {/* aurora corner glow */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 -z-10 size-40 rounded-full blur-3xl"
          style={{ backgroundColor: `color-mix(in oklab, ${kpi.accent} 30%, transparent)` }}
        />
        {/* cursor-following glow */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(180px circle at var(--mx, 50%) var(--my, 40%), color-mix(in oklab, ${kpi.accent} 22%, transparent), transparent 70%)`,
          }}
        />
        {/* oversized watermark icon */}
        <kpi.icon
          aria-hidden
          weight="duotone"
          className="pointer-events-none absolute -bottom-5 -right-4 -z-10 size-28 -rotate-12 opacity-[0.09] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
          style={{ color: kpi.accent }}
        />

        <div className="flex items-start justify-between">
          <span
            className="relative flex size-11 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `color-mix(in oklab, ${kpi.accent} 18%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${kpi.accent} 30%, transparent)`,
            }}
          >
            <kpi.icon weight="fill" className="size-5" style={{ color: kpi.accent }} />
          </span>
          <span
            className="flex size-7 items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 -translate-x-1"
            style={{ backgroundColor: `color-mix(in oklab, ${kpi.accent} 20%, transparent)`, color: kpi.accent }}
          >
            <ArrowUpRight weight="bold" className="size-3.5" />
          </span>
        </div>

        <div>
          <p className="font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/70">{kpi.label}</p>
          <p className="mt-1.5 font-(family-name:--font-zeyada) text-[44px] leading-none font-normal tabular-nums text-(--flow-ink)">
            {summary ? <CountUp value={value} reduce={reduce} /> : isLoading ? "…" : 0}
          </p>
        </div>

        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ backgroundColor: `color-mix(in oklab, ${kpi.accent} ${live ? 16 : 8}%, transparent)` }}
        >
          <span className="relative flex size-1.5">
            {live && (
              <span
                className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: kpi.accent }}
              />
            )}
            <span
              className="relative inline-flex size-1.5 rounded-full"
              style={{ backgroundColor: kpi.accent, opacity: live ? 1 : 0.4 }}
            />
          </span>
          <span className="font-(family-name:--font-zeyada) text-[18px] leading-none font-normal text-(--flow-ink)/65">
            {summary ? kpi.note(summary) : "No data yet"}
          </span>
        </span>

        {/* accent line that grows on hover */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-[0.18] transition-transform duration-500 group-hover:scale-x-100"
          style={{ backgroundImage: `linear-gradient(to right, ${kpi.accent}, transparent)` }}
        />
      </Link>
    </motion.div>
  );
}

export function KpiCards() {
  const { summary, isLoading } = useDashboardSummary();
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpiConfig.map((kpi, i) => (
        <KpiCard key={kpi.label} kpi={kpi} index={i} summary={summary} isLoading={isLoading} reduce={reduce} />
      ))}
    </div>
  );
}
