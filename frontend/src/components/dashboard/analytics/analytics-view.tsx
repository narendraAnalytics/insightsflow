"use client";

import { useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChatsCircle,
  ChartLineUp,
  Coins,
  EnvelopeSimple,
  Lightning,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAnalytics, type Analytics, type RangeDays } from "@/hooks/use-analytics";
import { SheetsAnalytics } from "@/components/dashboard/analytics/sheets-analytics";
import { DeliveryAnalytics } from "@/components/dashboard/analytics/delivery-analytics";

const RANGES: { value: RangeDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const KPI_META: Record<string, { label: string; icon: typeof Coins; accent: string; unit?: string }> = {
  questions: { label: "Questions asked", icon: ChatsCircle, accent: "var(--flow-coral)" },
  credits_spent: { label: "Credits spent", icon: Coins, accent: "var(--flow-amber)" },
  automation_runs: { label: "Automation runs", icon: Lightning, accent: "var(--flow-magenta)" },
  scheduled_emails: { label: "Scheduled emails sent", icon: EnvelopeSimple, accent: "var(--flow-cyan)" },
};

const SPEND_LABELS: Record<string, string> = {
  question: "AI questions",
  automation_run: "Automation runs",
  connect_google_sheets: "Sheets tabs",
  connect_gmail: "Gmail accounts",
  connect_slack: "Slack workspaces",
  connect_notion: "Notion workspaces",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  completed: { label: "Completed", color: "var(--flow-mint)" },
  awaiting_approval: { label: "Awaiting approval", color: "var(--flow-amber)" },
  dismissed: { label: "Skipped", color: "var(--flow-lavender)" },
  running: { label: "Running", color: "var(--flow-cyan)" },
  failed: { label: "Failed", color: "var(--flow-coral)" },
};

const num = (n: number) => n.toLocaleString("en-IN");
// The API sends plain IST calendar dates; read them as UTC midnight so the browser's own
// timezone can never shift the day.
const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
const shortDate = (iso: string) =>
  dayOf(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card flex flex-col rounded-2xl p-5 sm:p-6", className)}>
      <h3 className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">{title}</h3>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--flow-ink)/12 px-4 py-8 text-center">
      <ChartLineUp className="size-5 text-(--flow-ink)/35" />
      <p className="max-w-xs text-sm text-(--flow-ink)/55">{text}</p>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-(--flow-ink)/8", className)} />;
}

function KpiCard({ kpi }: { kpi: Analytics["kpis"][number] }) {
  const meta = KPI_META[kpi.key];
  if (!meta) return null;
  const Icon = meta.icon;
  const up = (kpi.change_pct ?? 0) >= 0;
  return (
    <div className="glass-card relative overflow-hidden rounded-2xl p-5">
      <span
        aria-hidden
        className="absolute -top-8 -right-8 size-24 rounded-full opacity-25 blur-2xl"
        style={{ backgroundColor: meta.accent }}
      />
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklab, ${meta.accent} 28%, transparent)` }}
        >
          <Icon weight="duotone" className="size-5 text-(--flow-ink)" />
        </span>
        <p className="text-sm font-medium text-(--flow-ink)/70">{meta.label}</p>
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-(--flow-ink) tabular-nums">{num(kpi.value)}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-(--flow-ink)/60">
        {kpi.change_pct !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold",
              // Credits spent going up isn't "good" or "bad", so it stays neutral.
              kpi.key === "credits_spent"
                ? "bg-(--flow-ink)/8 text-(--flow-ink)/70"
                : up
                  ? "bg-emerald-500/15 text-emerald-700"
                  : "bg-rose-500/15 text-rose-700"
            )}
          >
            {up ? <ArrowUpRight weight="bold" className="size-3" /> : <ArrowDownRight weight="bold" className="size-3" />}
            {Math.abs(kpi.change_pct)}%
          </span>
        ) : kpi.value > 0 ? (
          <span className="rounded-full bg-(--flow-ink)/8 px-2 py-0.5 font-semibold text-(--flow-ink)/70">New</span>
        ) : null}
        <span>vs {num(kpi.previous)} before</span>
      </p>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; payload: { date: string } }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl px-3 py-2 text-xs text-(--flow-ink)">
      <p className="font-semibold">{shortDate(payload[0].payload.date)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="mt-0.5">
          {p.dataKey === "questions" ? "Questions" : "Credits spent"}: {num(p.value)}
        </p>
      ))}
    </div>
  );
}

function TrendChart({ data }: { data: Analytics["daily"] }) {
  const has = data.some((d) => d.questions + d.credits > 0);
  if (!has) return <Empty text="No questions or spending in this period yet. Ask a question in AI Insights to see the trend." />;
  const series = [
    { key: "questions", color: "var(--flow-coral)" },
    { key: "credits", color: "var(--flow-amber)" },
  ];
  return (
    <>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`an-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.03} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--flow-ink)" strokeOpacity={0.08} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--flow-ink)", opacity: 0.55 }}
              minTickGap={28}
              padding={{ left: 14, right: 14 }}
            />
            <YAxis hide domain={[0, (max: number) => Math.max(5, max)]} />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--flow-ink)", strokeOpacity: 0.15 }} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#an-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-(--flow-ink)/65">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-(--flow-coral)" /> Questions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-(--flow-amber)" /> Credits spent
        </span>
      </div>
    </>
  );
}

function BarList({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between text-sm text-(--flow-ink)/80">
            <span>{r.label}</span>
            <span className="font-semibold tabular-nums">{num(r.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-(--flow-ink)/8">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const SPEND_COLORS = ["var(--flow-coral)", "var(--flow-magenta)", "var(--flow-amber)", "var(--flow-cyan)", "var(--flow-mint)"];

function SpendCard({ data }: { data: Analytics }) {
  const rows = data.spend_by_reason.map((s, i) => ({
    label: SPEND_LABELS[s.reason] ?? s.reason.replaceAll("_", " "),
    value: s.credits,
    color: SPEND_COLORS[i % SPEND_COLORS.length],
  }));
  return (
    <Card title="Where credits went">
      {rows.length ? <BarList rows={rows} /> : <Empty text="No credits spent in this period." />}
    </Card>
  );
}

function AutomationCard({ data }: { data: Analytics }) {
  const { runs, recent_runs } = data;
  const rows = Object.entries(runs.by_status).map(([status, n]) => ({
    label: STATUS_META[status]?.label ?? status,
    value: n,
    color: STATUS_META[status]?.color ?? "var(--flow-ink)",
  }));
  return (
    <Card title="Automation health">
      {runs.total === 0 && recent_runs.length === 0 ? (
        <Empty text="No automation runs yet. Create one on the Automation page." />
      ) : (
        <div className="flex flex-col gap-5">
          {runs.total > 0 && (
            <div>
              <p className="mb-3 text-sm text-(--flow-ink)/70">
                {runs.success_rate !== null && (
                  <>
                    <span className="text-2xl font-semibold text-(--flow-ink)">{runs.success_rate}%</span> of {runs.total} run
                    {runs.total === 1 ? "" : "s"} succeeded
                  </>
                )}
              </p>
              <BarList rows={rows} />
            </div>
          )}
          {recent_runs.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-(--flow-ink)/50 uppercase">Latest runs</p>
              <ul className="flex flex-col divide-y divide-(--flow-ink)/8">
                {recent_runs.map((r) => {
                  const meta = STATUS_META[r.status];
                  const inner = (
                    <>
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta?.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm text-(--flow-ink)">{r.automation}</span>
                      <span className="shrink-0 text-xs text-(--flow-ink)/55">{meta?.label ?? r.status}</span>
                      <span className="shrink-0 text-xs text-(--flow-ink)/45">
                        {new Date(r.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </>
                  );
                  return (
                    <li key={r.id}>
                      {r.conversation_id ? (
                        <Link
                          href={`/dashboard/ai-insights?chat=${r.conversation_id}`}
                          className="flex items-center gap-2.5 py-2 hover:opacity-80"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2.5 py-2">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SourcesCard({ data }: { data: Analytics }) {
  const rows = data.sources.map((s) => ({
    label: s.tab_title ? `${s.name} — ${s.tab_title}` : s.name,
    value: s.row_count,
    color: "var(--flow-lavender)",
  }));
  return (
    <Card title="Biggest data sources">
      {rows.length ? <BarList rows={rows} /> : <Empty text="No sheets or documents connected yet." />}
      {rows.length > 0 && <p className="mt-3 text-xs text-(--flow-ink)/50">Rows per connected tab.</p>}
    </Card>
  );
}

function UsageView() {
  const [range, setRange] = useState<RangeDays>(30);
  const { data, error, isLoading } = useAnalytics(range);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--flow-ink)/60">
          {data ? `${shortDate(data.start)} – ${shortDate(data.end)} (IST), compared with the ${range} days before.` : " "}
        </p>
        <div role="group" aria-label="Date range" className="glass-panel inline-flex rounded-full p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                range === r.value ? "bg-(--flow-ink) text-white" : "text-(--flow-ink)/65 hover:text-(--flow-ink)"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && !data ? (
        <div className="glass-card rounded-2xl p-6 text-sm text-(--flow-ink)/70">
          Couldn&apos;t load analytics: {error}
        </div>
      ) : !data ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[148px]" />
            ))}
          </div>
          <Skeleton className="h-[340px]" />
        </div>
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity", isLoading && "opacity-60")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((k) => (
              <KpiCard key={k.key} kpi={k} />
            ))}
          </div>
          <Card title="Activity over time">
            <TrendChart data={data.daily} />
          </Card>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SpendCard data={data} />
            <AutomationCard data={data} />
          </div>
          <SourcesCard data={data} />
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "usage", label: "Usage" },
  { id: "sheets", label: "Connected sheets" },
  { id: "slack", label: "Slack" },
  { id: "notion", label: "Notion" },
  { id: "gmail", label: "Gmail" },
] as const;

export function AnalyticsView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("usage");
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Analytics" className="glass-panel inline-flex max-w-full self-start overflow-x-auto rounded-full p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-5 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-(--flow-ink) text-white" : "text-(--flow-ink)/65 hover:text-(--flow-ink)"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "usage" ? (
        <UsageView />
      ) : tab === "sheets" ? (
        <SheetsAnalytics />
      ) : (
        <DeliveryAnalytics provider={tab} />
      )}
    </div>
  );
}
