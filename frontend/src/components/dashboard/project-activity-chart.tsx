"use client";

import { ChartLineUp } from "@phosphor-icons/react";

// No real activity data exists yet (no Projects/Tasks backend model) —
// show an honest empty state instead of a flat/fake chart line. Swap for
// a Recharts <LineChart> once /api/v1/analytics/activity exists.
export function ProjectActivityChart() {
  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-[15px] font-semibold text-(--flow-ink)">Project Activity</h3>
        <span className="rounded-full bg-(--flow-ink)/6 px-3 py-1 text-[11.5px] font-medium text-(--flow-ink)/45">
          Last 7 days
        </span>
      </div>
      <div className="mt-6 flex min-h-[220px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--flow-ink)/12 py-10 text-center">
        <span className="glass-panel flex size-11 items-center justify-center rounded-full">
          <ChartLineUp className="size-5 text-(--flow-ink)/40" />
        </span>
        <p className="text-[13.5px] font-medium text-(--flow-ink)/55">No activity yet</p>
        <p className="max-w-[220px] text-[12px] text-(--flow-ink)/40">
          Connect a project to start tracking tasks and automations here.
        </p>
      </div>
    </div>
  );
}
