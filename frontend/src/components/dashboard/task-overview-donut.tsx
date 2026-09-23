"use client";

import { ChartDonut } from "@phosphor-icons/react";

// Mirrors project-activity-chart.tsx's honest-empty approach — no real
// task data yet, so no fabricated Completed/In Progress/Pending split.
export function TaskOverviewDonut() {
  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <h3 className="font-heading text-[15px] font-semibold text-(--flow-ink)">Task Overview</h3>
      <div className="mt-6 flex min-h-[220px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--flow-ink)/12 py-10 text-center">
        <span className="glass-panel flex size-11 items-center justify-center rounded-full">
          <ChartDonut className="size-5 text-(--flow-ink)/40" />
        </span>
        <p className="text-[13.5px] font-medium text-(--flow-ink)/55">No tasks yet</p>
        <p className="max-w-[200px] text-[12px] text-(--flow-ink)/40">
          Task status breakdown will show up here once you have tasks.
        </p>
      </div>
    </div>
  );
}
