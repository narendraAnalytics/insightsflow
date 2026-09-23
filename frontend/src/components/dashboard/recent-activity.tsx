"use client";

import { ClockCounterClockwise } from "@phosphor-icons/react";

// No real events yet (no activity-log backend model) — honest empty
// state rather than the mockup's fabricated Slack/Drive/Notion entries.
export function RecentActivity() {
  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-[15px] font-semibold text-(--flow-ink)">Recent Activity</h3>
        <span className="text-[12.5px] font-semibold text-(--flow-ink)/30">View All</span>
      </div>
      <div className="mt-5 flex flex-col items-center gap-2 py-6 text-center">
        <span className="glass-panel flex size-11 items-center justify-center rounded-full">
          <ClockCounterClockwise className="size-5 text-(--flow-ink)/40" />
        </span>
        <p className="text-[13.5px] font-medium text-(--flow-ink)/55">No activity yet</p>
        <p className="max-w-[220px] text-[12px] text-(--flow-ink)/40">
          Connect an app to see activity from your workspace here.
        </p>
      </div>
    </div>
  );
}
