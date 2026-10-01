"use client";

import { useEffect, useRef, useState, type ReactElement, type SVGProps } from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChatsCircle, FileXls, Plug, Table } from "@phosphor-icons/react";
import { GmailGlyph, GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { useDashboardSummary } from "@/hooks/use-dashboard-stats";

type Summary = NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>;

/** Brand icon + name for each provider a connection can have. Unknown ones fall back to a plug. */
const PROVIDER_ICONS: Record<string, { label: string; Glyph: (props: SVGProps<SVGSVGElement>) => ReactElement }> = {
  google_sheets: { label: "Google Sheets", Glyph: GoogleSheetsGlyph },
  gmail: { label: "Gmail", Glyph: GmailGlyph },
  slack: { label: "Slack", Glyph: SlackGlyph },
  notion: { label: "Notion", Glyph: NotionGlyph },
};

type KpiConfig = {
  label: string;
  icon: typeof Plug;
  image: string;
  accent: string;
  href: string;
  value: (s: Summary) => number;
  note: (s: Summary) => string;
  /** When set and non-empty, the pill shows these providers' icons instead of `note`. */
  providers?: (s: Summary) => string[];
};

const kpiConfig: KpiConfig[] = [
  {
    label: "Connected Sheets",
    icon: FileXls,
    image: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790443280/googlesheet_gdwkfb.png",
    accent: "var(--flow-magenta)",
    href: "/dashboard/integrations",
    value: (s: Summary) => s.stats.connected_sheets,
    note: (s: Summary) =>
      s.stats.connected_tabs ? `${s.stats.connected_tabs} tab${s.stats.connected_tabs === 1 ? "" : "s"} in total` : "Connect a sheet →",
  },
  {
    label: "Active Integrations",
    icon: Plug,
    image: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790443462/activeintrgrations_uoycu0.png",
    accent: "var(--flow-cyan)",
    href: "/dashboard/integrations",
    value: (s: Summary) => s.stats.active_integrations,
    // Shown as brand icons (see `providers`) when anything is connected.
    note: () => "Connect Google →",
    providers: (s: Summary) => s.stats.connected_providers,
  },
  {
    label: "Questions Asked",
    icon: ChatsCircle,
    image: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790480582/askquestions_l6sde7.png",
    accent: "var(--flow-coral)",
    href: "/dashboard/ai-insights",
    value: (s: Summary) => s.stats.questions_asked,
    note: (s: Summary) => (s.stats.questions_asked ? "In AI Insights" : "Ask your first →"),
  },
  {
    label: "Data Tabs",
    icon: Table,
    image: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790480735/datatabs_xio7th.png",
    accent: "var(--flow-lavender)",
    href: "/dashboard/integrations",
    value: (s: Summary) => s.stats.connected_tabs,
    note: (s: Summary) => (s.stats.connected_tabs ? "Ready to analyse" : "Add a tab →"),
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
  kpi: KpiConfig;
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
  const providers = summary && kpi.providers ? kpi.providers(summary) : [];

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
        className="glass-card group relative isolate flex h-full flex-col gap-4 overflow-hidden rounded-2xl p-5 outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-(--flow-magenta) active:scale-[0.98]"
        style={{
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${kpi.accent} 20%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.65), 0 10px 28px -14px color-mix(in oklab, ${kpi.accent} 55%, transparent)`,
        }}
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
          {/* transparent 3D icon sitting directly on the card */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={kpi.image}
            alt=""
            aria-hidden
            draggable={false}
            className="-mt-1 -ml-1 size-16 object-contain drop-shadow-[0_8px_10px_rgba(120,60,80,0.22)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-110 group-hover:-rotate-3"
          />
          <span
            className="flex size-7 items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 -translate-x-1"
            style={{ backgroundColor: `color-mix(in oklab, ${kpi.accent} 20%, transparent)`, color: kpi.accent }}
          >
            <ArrowUpRight weight="bold" className="size-3.5" />
          </span>
        </div>

        <div>
          <p className="font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/85">{kpi.label}</p>
          <p className="mt-1.5 font-(family-name:--font-zeyada) text-[52px] leading-none font-normal tabular-nums text-(--flow-ink)">
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
          {providers.length > 0 ? (
            <span className="flex items-center gap-1.5">
              {providers.map((p) => {
                const known = PROVIDER_ICONS[p];
                return known ? (
                  <known.Glyph key={p} role="img" aria-label={known.label} className="size-5 drop-shadow-sm" />
                ) : (
                  <Plug key={p} role="img" aria-label={p} weight="duotone" className="size-5 text-(--flow-ink)/70" />
                );
              })}
            </span>
          ) : (
            <span className="font-(family-name:--font-zeyada) text-[18px] leading-none font-normal text-(--flow-ink)/90">
              {summary ? kpi.note(summary) : "Loading…"}
            </span>
          )}
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
