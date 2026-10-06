"use client";

import Link from "next/link";
import { ChartDonut } from "@phosphor-icons/react";
import { useDashboardSummary } from "@/hooks/use-dashboard-stats";

const Z = "font-(family-name:--font-zeyada)";

// Every status an automation run can have, in the order the legend lists them.
const STATUSES = [
  { key: "completed", label: "Completed", color: "var(--flow-mint)" },
  { key: "awaiting_approval", label: "Waiting for approval", color: "var(--flow-amber)" },
  { key: "running", label: "Running", color: "var(--flow-magenta)" },
  { key: "failed", label: "Failed", color: "var(--flow-coral)" },
  { key: "dismissed", label: "Skipped", color: "var(--flow-lavender)" },
] as const;

const R = 42;
const CIRC = 2 * Math.PI * R;

function EmptyState({ title, hint, cta }: { title: string; hint: string; cta: string }) {
  return (
    <div className="mt-6 flex min-h-[220px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--flow-ink)/12 py-10 text-center">
      <span className="glass-panel flex size-11 items-center justify-center rounded-full">
        <ChartDonut className="size-5 text-(--flow-ink)/40" />
      </span>
      <p className={`${Z} text-[21px] leading-none font-normal text-(--flow-ink)/55`}>{title}</p>
      <p className={`${Z} max-w-[210px] text-[18px] leading-snug font-normal text-(--flow-ink)/40`}>{hint}</p>
      <Link href="/dashboard/automation" className={`${Z} mt-1 text-[20px] leading-none text-(--flow-magenta) hover:underline`}>
        {cta} →
      </Link>
    </div>
  );
}

// Real data: the user's automation runs from the last 30 days, counted by status
// (GET /dashboard/summary -> run_overview). Nothing is invented for an empty account.
export function TaskOverviewDonut() {
  const { summary, isLoading } = useDashboardSummary();
  const overview = summary?.run_overview;
  const parts = overview ? STATUSES.map((s) => ({ ...s, n: overview.by_status[s.key] ?? 0 })) : [];
  const total = parts.reduce((sum, p) => sum + p.n, 0);

  let offset = 0;
  const arcs = parts
    .filter((p) => p.n > 0)
    .map((p) => {
      const len = (p.n / total) * CIRC;
      const arc = { ...p, len, offset };
      offset += len;
      return arc;
    });

  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={`${Z} text-[26px] leading-none font-normal text-(--flow-ink)`}>Automation runs</h3>
        {overview && total > 0 && (
          <span className={`${Z} text-[18px] leading-none text-(--flow-ink)/45`}>last {overview.window_days} days</span>
        )}
      </div>

      {isLoading || !overview ? (
        <div className="mt-6 min-h-[220px] flex-1 animate-pulse rounded-xl bg-(--flow-ink)/5" />
      ) : overview.automations === 0 ? (
        <EmptyState title="No automations yet" hint="Schedule a report and its runs will be counted here." cta="Create an automation" />
      ) : total === 0 ? (
        <EmptyState title="No runs yet" hint={`Nothing has run in the last ${overview.window_days} days.`} cta="Open Automation" />
      ) : (
        <Link href="/dashboard/automation" className="mt-5 flex flex-1 flex-col items-center gap-5 sm:flex-row sm:justify-center">
          <div className="relative size-[150px] shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${total} automation runs in the last ${overview.window_days} days`}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="color-mix(in oklab, var(--flow-ink) 8%, transparent)" strokeWidth="13" />
              {arcs.map((a) => (
                <circle
                  key={a.key}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="13"
                  strokeDasharray={`${Math.max(a.len - (arcs.length > 1 ? 1.5 : 0), 0.5)} ${CIRC}`}
                  strokeDashoffset={-a.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`${Z} text-[44px] leading-none text-(--flow-ink)`}>{total}</span>
              <span className={`${Z} text-[17px] leading-none text-(--flow-ink)/50`}>{total === 1 ? "run" : "runs"}</span>
            </div>
          </div>

          <ul className="flex w-full max-w-[220px] flex-col gap-2">
            {parts.map((p) => (
              <li key={p.key} className={`flex items-center gap-2.5 ${p.n === 0 ? "opacity-40" : ""}`}>
                <span className="size-3 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className={`${Z} flex-1 text-[21px] leading-none text-(--flow-ink)/75`}>{p.label}</span>
                <span className={`${Z} text-[22px] leading-none text-(--flow-ink)`}>{p.n}</span>
              </li>
            ))}
          </ul>
        </Link>
      )}
    </div>
  );
}
