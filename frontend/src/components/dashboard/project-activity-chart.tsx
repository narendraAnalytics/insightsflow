"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ChartLineUp } from "@phosphor-icons/react";
import { useDashboardSummary } from "@/hooks/use-dashboard-stats";

const SERIES = [
  { key: "connections", label: "Connections", color: "var(--flow-cyan)" },
  { key: "sources", label: "Sheets & tabs", color: "var(--flow-coral)" },
  { key: "chats", label: "Questions", color: "var(--flow-magenta)" },
] as const;

function weekdayLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function TooltipCard({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl px-3 py-2 font-(family-name:--font-zeyada) text-[19px] leading-snug font-normal text-(--flow-ink)">
      <p className="text-[17px] text-(--flow-ink)/60">{label}</p>
      {SERIES.map((s) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        if (!entry || entry.value === 0) return null;
        return (
          <p key={s.key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}: {entry.value}
          </p>
        );
      })}
    </div>
  );
}

export function ProjectActivityChart() {
  const { summary, isLoading } = useDashboardSummary();
  const days = summary?.daily_activity ?? [];
  const hasActivity = days.some((d) => d.connections + d.sources + d.chats > 0);

  const data = days.map((d) => ({
    label: weekdayLabel(d.date),
    connections: d.connections,
    sources: d.sources,
    chats: d.chats,
  }));

  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">Project Activity</h3>
        <span className="rounded-full bg-(--flow-ink)/6 px-3 py-1 text-[18px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)/55">
          Last 7 days
        </span>
      </div>

      {isLoading ? (
        <div className="mt-6 flex min-h-[220px] flex-1 items-center justify-center">
          <p className="text-[21px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)/55">Loading…</p>
        </div>
      ) : !hasActivity ? (
        <div className="mt-6 flex min-h-[220px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--flow-ink)/12 py-10 text-center">
          <span className="glass-panel flex size-11 items-center justify-center rounded-full">
            <ChartLineUp className="size-5 text-(--flow-ink)/40" />
          </span>
          <p className="text-[21px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)/55">No activity yet</p>
          <p className="max-w-[220px] text-[18px] font-(family-name:--font-zeyada) leading-snug font-normal text-(--flow-ink)/40">
            Connect a project to start tracking tasks and automations here.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  {SERIES.map((s) => (
                    <linearGradient key={s.key} id={`activity-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.03} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--flow-ink)" strokeOpacity={0.08} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 15, fontFamily: "var(--font-zeyada)", fill: "var(--flow-ink)", opacity: 0.55 }}
                  dy={6}
                />
                <Tooltip content={<TooltipCard />} cursor={{ stroke: "var(--flow-ink)", strokeOpacity: 0.15 }} />
                {SERIES.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    // Connections is a running total, so it must not be stacked on the daily counts.
                    stackId={s.key === "connections" ? "connections" : "activity"}
                    stroke={s.color}
                    strokeWidth={2}
                    fill={`url(#activity-${s.key})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 font-(family-name:--font-zeyada) text-[19px] leading-none font-normal text-(--flow-ink)/60">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
