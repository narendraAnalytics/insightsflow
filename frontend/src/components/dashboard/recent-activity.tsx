"use client";

import Link from "next/link";
import { FileXls, Plug } from "@phosphor-icons/react";
import { useDashboardSummary } from "@/hooks/use-dashboard-stats";

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Shows only what's connected (one row per integration). Google Sheets is the
// only provider today; other apps will appear here once they can be connected.
export function RecentActivity() {
  const { summary } = useDashboardSummary();
  const connected = (summary?.activity ?? []).filter((e) => e.kind === "connection");

  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">Connected Apps</h3>
        <Link href="/dashboard/integrations" className="text-[20px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-magenta)">
          View All
        </Link>
      </div>
      {connected.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 py-6 text-center">
          <span className="glass-panel flex size-11 items-center justify-center rounded-full">
            <Plug className="size-5 text-(--flow-ink)/40" />
          </span>
          <p className="text-[21px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)/55">Nothing connected yet</p>
          <p className="max-w-[220px] text-[18px] font-(family-name:--font-zeyada) leading-snug font-normal text-(--flow-ink)/40">
            Connect an app from Integrations and it will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {connected.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0f9d58]/12">
                <FileXls weight="fill" className="size-5 text-[#0f9d58]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[21px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)">{e.title}</p>
                <p className="truncate text-[18px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)/50">
                  {timeAgo(e.at)}
                  {e.detail ? ` · ${e.detail}` : ""}
                </p>
              </div>
              <span title="Connected" className="size-2.5 shrink-0 rounded-full bg-[#22c55e]" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
