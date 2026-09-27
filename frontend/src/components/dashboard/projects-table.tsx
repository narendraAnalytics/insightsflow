"use client";

import Link from "next/link";
import { FileXls, FolderOpen, Plus } from "@phosphor-icons/react";
import { useDashboardSummary } from "@/hooks/use-dashboard-stats";

// Each row cycles through these accents so neighbouring sheets are easy to tell apart.
const ROW_ACCENTS = [
  "var(--flow-magenta)",
  "oklch(0.66 0.12 190)",
  "oklch(0.72 0.17 55)",
  "oklch(0.66 0.21 10)",
  "oklch(0.68 0.15 160)",
  "oklch(0.64 0.22 330)",
];

// There is no Projects model; this table lists the connected sheets/tabs,
// which is the real "thing you work on" today.
export function ProjectsTable() {
  const { summary } = useDashboardSummary();
  const sources = summary?.sources ?? [];

  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">Your Sheets</h3>
        <Link href="/dashboard/integrations" className="text-[22px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-magenta) transition-opacity hover:opacity-70">
          View All →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-[1.6fr_1fr_1fr] gap-4 px-3 pb-1 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal">
        <span className="text-(--flow-magenta)">Name</span>
        <span style={{ color: "oklch(0.62 0.13 190)" }}>Rows</span>
        <span className="text-(--flow-coral)">Last Synced</span>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="glass-panel flex size-12 items-center justify-center rounded-full">
            <FolderOpen className="size-5 text-(--flow-ink)/40" />
          </span>
          <p className="text-[21px] font-(family-name:--font-zeyada) leading-none font-normal text-(--flow-ink)/80">No sheets yet</p>
          <p className="max-w-[260px] text-[18px] font-(family-name:--font-zeyada) leading-snug font-normal text-(--flow-ink)/70">
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
        <ul className="mt-1 flex flex-col gap-2">
          {sources.map((s, i) => {
            const accent = ROW_ACCENTS[i % ROW_ACCENTS.length];
            return (
              <li
                key={s.id}
                className="group grid grid-cols-[1.6fr_1fr_1fr] items-center gap-4 rounded-2xl px-3 py-2.5 transition-transform duration-300 hover:translate-x-0.5"
                style={{
                  backgroundImage: `linear-gradient(90deg, color-mix(in oklab, ${accent} 14%, transparent), color-mix(in oklab, ${accent} 3%, transparent))`,
                  boxShadow: `inset 3px 0 0 ${accent}, inset 0 0 0 1px color-mix(in oklab, ${accent} 16%, transparent)`,
                }}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `color-mix(in oklab, ${accent} 20%, transparent)`, color: accent }}
                  >
                    <FileXls weight="duotone" className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-ink)">
                      {s.name}
                    </span>
                    {s.tab_title && (
                      <span
                        className="mt-1 inline-block max-w-full truncate rounded-full px-2 py-0.5 font-(family-name:--font-zeyada) text-[17px] leading-none font-normal"
                        style={{ backgroundColor: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}
                      >
                        {s.tab_title}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className="w-fit rounded-full px-3 py-1 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal tabular-nums"
                  style={{ backgroundColor: `color-mix(in oklab, ${accent} 16%, transparent)`, color: accent }}
                >
                  {s.row_count.toLocaleString("en-IN")}
                </span>
                <span className="font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/85">
                  {new Date(s.synced_at).toLocaleDateString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
