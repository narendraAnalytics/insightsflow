"use client";

import { ChatsCircle, FileXls, Plug, Table } from "@phosphor-icons/react";
import { useDashboardSummary } from "@/hooks/use-dashboard-stats";

const kpiConfig = [
  {
    label: "Connected Sheets",
    icon: FileXls,
    accent: "var(--flow-magenta)",
    value: (s: NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>) => s.stats.connected_sheets,
    note: (s: NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>) =>
      s.stats.connected_tabs ? `${s.stats.connected_tabs} tab${s.stats.connected_tabs === 1 ? "" : "s"} in total` : "No data yet",
  },
  {
    label: "Active Integrations",
    icon: Plug,
    accent: "var(--flow-cyan)",
    value: (s: NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>) => s.stats.active_integrations,
    note: (s: NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>) =>
      s.stats.active_integrations ? "Google Sheets" : "No data yet",
  },
  {
    label: "Questions Asked",
    icon: ChatsCircle,
    accent: "var(--flow-coral)",
    value: (s: NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>) => s.stats.questions_asked,
    note: (s: NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>) =>
      s.stats.questions_asked ? "In AI Insights" : "No data yet",
  },
  {
    label: "Data Tabs",
    icon: Table,
    accent: "var(--flow-lavender)",
    value: (s: NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>) => s.stats.connected_tabs,
    note: (s: NonNullable<ReturnType<typeof useDashboardSummary>["summary"]>) =>
      s.stats.connected_tabs ? "Ready to analyse" : "No data yet",
  },
];

export function KpiCards() {
  const { summary, isLoading } = useDashboardSummary();

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpiConfig.map((kpi) => (
        <div key={kpi.label} className="glass-card flex flex-col gap-3 rounded-2xl p-5">
          <span
            className="flex size-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `color-mix(in oklab, ${kpi.accent} 16%, transparent)` }}
          >
            <kpi.icon weight="fill" className="size-5" style={{ color: kpi.accent }} />
          </span>
          <div>
            <p className="text-[13px] font-medium text-(--flow-ink)/60">{kpi.label}</p>
            <p className="mt-0.5 font-heading text-[26px] font-semibold tabular-nums tracking-tight text-(--flow-ink)">
              {summary ? kpi.value(summary) : isLoading ? "…" : 0}
            </p>
          </div>
          <p className="text-[11.5px] font-medium text-(--flow-ink)/40">
            {summary ? kpi.note(summary) : "No data yet"}
          </p>
        </div>
      ))}
    </div>
  );
}
