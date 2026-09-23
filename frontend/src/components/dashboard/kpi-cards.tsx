"use client";

import { ClockCounterClockwise, FolderOpen, ListChecks, Plug } from "@phosphor-icons/react";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

const kpiConfig = [
  {
    key: "totalProjects" as const,
    deltaKey: "totalProjectsDeltaPct" as const,
    label: "Total Projects",
    icon: FolderOpen,
    accent: "var(--flow-magenta)",
    format: (n: number) => `${n}`,
  },
  {
    key: "activeIntegrations" as const,
    deltaKey: "activeIntegrationsDeltaPct" as const,
    label: "Active Integrations",
    icon: Plug,
    accent: "var(--flow-cyan)",
    format: (n: number) => `${n}`,
  },
  {
    key: "tasksCompleted" as const,
    deltaKey: "tasksCompletedDeltaPct" as const,
    label: "Tasks Completed",
    icon: ListChecks,
    accent: "var(--flow-coral)",
    format: (n: number) => `${n}`,
  },
  {
    key: "timeSavedHours" as const,
    deltaKey: "timeSavedDeltaPct" as const,
    label: "Time Saved",
    icon: ClockCounterClockwise,
    accent: "var(--flow-lavender)",
    format: (n: number) => `${n} hrs`,
  },
];

export function KpiCards() {
  const { stats } = useDashboardStats();

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpiConfig.map((kpi) => {
        const value = stats[kpi.key];
        const delta = stats[kpi.deltaKey];
        return (
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
                {kpi.format(value)}
              </p>
            </div>
            <p className="text-[11.5px] font-medium text-(--flow-ink)/40">
              {delta === null ? "No data yet" : `↑ ${delta}% from last month`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
