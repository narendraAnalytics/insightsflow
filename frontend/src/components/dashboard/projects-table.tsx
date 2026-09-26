"use client";

import Link from "next/link";
import { FolderOpen, Plus } from "@phosphor-icons/react";
import { useDashboardSummary } from "@/hooks/use-dashboard-stats";

// There is no Projects model; this table lists the connected sheets/tabs,
// which is the real "thing you work on" today.
export function ProjectsTable() {
  const { summary } = useDashboardSummary();
  const sources = summary?.sources ?? [];

  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">Your Sheets</h3>
        <Link href="/dashboard/integrations" className="text-[20px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)/30">
          View All
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-b border-(--flow-ink)/8 pb-2 text-[11.5px] font-semibold tracking-wide text-(--flow-ink)/40 uppercase">
        <span>Name</span>
        <span>Rows</span>
        <span>Last Synced</span>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="glass-panel flex size-12 items-center justify-center rounded-full">
            <FolderOpen className="size-5 text-(--flow-ink)/40" />
          </span>
          <p className="text-[21px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)/55">No sheets yet</p>
          <p className="max-w-[260px] text-[18px] font-(family-name:--font-zeyada) leading-snug font-normal text-(--flow-ink)/40">
            Connect a Google Sheet to see it listed here.
          </p>
          <Link
            href="/dashboard/integrations"
            className="bg-gradient-flow mt-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[21px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-cream) shadow-[0_10px_22px_-12px_rgba(224,90,143,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <Plus weight="bold" className="size-3.5" />
            Connect a sheet
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col">
          {sources.map((s) => (
            <li
              key={s.id}
              className="grid grid-cols-3 items-center gap-4 border-b border-(--flow-ink)/5 py-3 text-[13px] last:border-0"
            >
              <span className="min-w-0 truncate font-semibold text-(--flow-ink)">
                {s.name}
                {s.tab_title && <span className="font-normal text-(--flow-ink)/50"> · {s.tab_title}</span>}
              </span>
              <span className="tabular-nums text-(--flow-ink)/70">{s.row_count}</span>
              <span className="text-(--flow-ink)/50">{new Date(s.synced_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
