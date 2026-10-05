"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Copy, Rows, Sigma, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useSheetProfile, useSheetSources, type SheetProfile, type SheetQuery } from "@/hooks/use-analytics";

const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const COLORS = [
  "var(--flow-coral)",
  "var(--flow-magenta)",
  "var(--flow-amber)",
  "var(--flow-cyan)",
  "var(--flow-mint)",
  "var(--flow-lavender)",
];

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card flex flex-col rounded-2xl p-5 sm:p-6", className)}>
      <h3 className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">{title}</h3>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-(--flow-ink)/12 px-4 py-8 text-center text-sm text-(--flow-ink)/55">
      {text}
    </p>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  allowAuto,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowAuto?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-(--flow-ink)/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-panel min-w-[150px] rounded-xl px-3 py-2 text-sm font-normal text-(--flow-ink) outline-none focus-visible:ring-2 focus-visible:ring-(--flow-magenta)/40"
      >
        {allowAuto && <option value="">Auto</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Rows;
  label: string;
  value: string;
  note?: string | null;
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-(--flow-ink)/70">
        <Icon weight="duotone" className="size-5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-(--flow-ink) tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-(--flow-ink)/60 first-letter:uppercase">{note}</p>}
    </div>
  );
}

function Tip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { label: string } }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl px-3 py-2 text-xs text-(--flow-ink)">
      <p className="font-semibold">{payload[0].payload.label}</p>
      <p>{num(payload[0].value)}</p>
    </div>
  );
}

function Body({ p, query, setQuery }: { p: SheetProfile; query: SheetQuery; setQuery: (q: SheetQuery) => void }) {
  const sel = p.selected;
  const measureLabel = sel.agg === "count" ? "Rows" : `${sel.agg === "sum" ? "Total" : "Average"} ${sel.measure}`;
  const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

  return (
    <div className="flex flex-col gap-5">
      <div className="glass-card flex flex-wrap items-end gap-4 rounded-2xl p-4 sm:p-5">
        {p.measures.length > 0 && (
          <Select
            label="Measure"
            value={sel.measure ?? ""}
            onChange={(v) => setQuery({ ...query, measure: v || undefined })}
            options={toOpts(p.measures)}
          />
        )}
        <Select
          label="Calculation"
          value={sel.agg}
          onChange={(v) => setQuery({ ...query, agg: v as SheetQuery["agg"] })}
          options={[
            { value: "sum", label: "Sum" },
            { value: "mean", label: "Average" },
            { value: "count", label: "Row count" },
          ]}
        />
        {p.dimensions.length > 0 && (
          <Select
            label="Group by"
            value={sel.group_by ?? ""}
            onChange={(v) => setQuery({ ...query, group_by: v || undefined })}
            options={toOpts(p.dimensions)}
          />
        )}
        {p.dates.length > 0 && (
          <Select
            label="Date column"
            value={sel.date_column ?? ""}
            onChange={(v) => setQuery({ ...query, date_column: v || undefined })}
            options={toOpts(p.dates)}
          />
        )}
      </div>

      {p.truncated && (
        <p className="flex items-center gap-2 rounded-xl bg-(--flow-amber)/25 px-4 py-2 text-sm text-(--flow-ink)">
          <WarningCircle weight="fill" className="size-4 shrink-0" />
          Only the first 5,000 rows are analysed, so totals may be lower than the full sheet.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Sigma} label={measureLabel} value={p.total === null ? "—" : num(p.total)} note={p.total_words} />
        <Stat icon={Rows} label="Rows × columns" value={`${num(p.rows)} × ${p.columns}`} />
        <Stat
          icon={WarningCircle}
          label="Missing cells"
          value={`${p.missing_pct}%`}
          note={p.missing_pct === 0 ? "Complete" : null}
        />
        <Stat
          icon={Copy}
          label="Duplicate rows"
          value={num(p.duplicate_rows)}
          note={p.duplicate_rows === 0 ? "None found" : null}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={sel.group_by ? `${measureLabel} by ${sel.group_by}` : "Breakdown"}>
          {p.breakdown.length === 0 ? (
            <Hint text="No column with repeating values to group by in this sheet." />
          ) : (
            <div style={{ height: Math.max(180, p.breakdown.length * 34) }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={p.breakdown} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--flow-ink)" strokeOpacity={0.08} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={96}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--flow-ink)", opacity: 0.7 }}
                    tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                  />
                  <Tooltip content={<Tip />} cursor={{ fill: "var(--flow-ink)", fillOpacity: 0.05 }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {p.breakdown.map((b, i) => (
                      <Cell key={b.label} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title={sel.date_column ? `${measureLabel} by month` : "Trend"}>
          {p.trend.length < 2 ? (
            <Hint
              text={
                sel.date_column
                  ? "Needs at least two months of dates to draw a trend."
                  : "No date column found in this sheet."
              }
            />
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={p.trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sheet-trend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--flow-magenta)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--flow-magenta)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--flow-ink)" strokeOpacity={0.08} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--flow-ink)", opacity: 0.55 }}
                    minTickGap={24}
                    padding={{ left: 14, right: 14 }}
                  />
                  <YAxis hide />
                  <Tooltip content={<Tip />} cursor={{ stroke: "var(--flow-ink)", strokeOpacity: 0.15 }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--flow-magenta)"
                    strokeWidth={2}
                    fill="url(#sheet-trend)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card title="Columns">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs tracking-wide text-(--flow-ink)/50 uppercase">
              <tr>
                <th className="py-2 pr-4 font-semibold">Column</th>
                <th className="py-2 pr-4 font-semibold">Type</th>
                <th className="py-2 pr-4 text-right font-semibold">Missing</th>
                <th className="py-2 pr-4 text-right font-semibold">Distinct</th>
                <th className="py-2 font-semibold">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--flow-ink)/8 text-(--flow-ink)/85">
              {p.column_profiles.map((c) => (
                <tr key={c.name}>
                  <td className="py-2 pr-4 font-medium text-(--flow-ink)">{c.name}</td>
                  <td className="py-2 pr-4 capitalize">{c.type}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{c.missing}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{c.distinct}</td>
                  <td className="py-2 text-xs text-(--flow-ink)/70">
                    {c.type === "number" && c.sum !== null
                      ? `min ${num(c.min ?? 0)} · avg ${num(c.mean ?? 0)} · max ${num(c.max ?? 0)} · sum ${num(c.sum)}`
                      : c.top.map((t) => `${t.value} (${t.count})`).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-(--flow-ink)/50">All numbers are computed in code from your sheet, not by the AI.</p>
      </Card>
    </div>
  );
}

export function SheetsAnalytics() {
  const sources = useSheetSources();
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState<SheetQuery>({});
  const sourceId = picked ?? sources?.[0]?.id ?? null;
  const { profile, error, isLoading } = useSheetProfile(sourceId, query);

  if (sources === null) return <div className="h-[200px] animate-pulse rounded-2xl bg-(--flow-ink)/8" />;
  if (sources.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
        <p className="text-sm text-(--flow-ink)/65">Connect a Google Sheet to see its analytics here.</p>
        <Link href="/dashboard/integrations" className="rounded-full bg-(--flow-ink) px-5 py-2 text-sm font-medium text-white">
          Connect a sheet
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-xs font-medium text-(--flow-ink)/60 sm:max-w-md">
        Sheet
        <select
          value={sourceId ?? ""}
          onChange={(e) => {
            setPicked(e.target.value);
            setQuery({});
          }}
          className="glass-panel rounded-xl px-3 py-2.5 text-sm font-normal text-(--flow-ink) outline-none focus-visible:ring-2 focus-visible:ring-(--flow-magenta)/40"
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.tab_title ? `${s.name} — ${s.tab_title}` : s.name}
            </option>
          ))}
        </select>
      </label>

      {error && !profile ? (
        <div className="glass-card rounded-2xl p-6 text-sm text-(--flow-ink)/70">
          {error}{" "}
          <Link href="/dashboard/integrations" className="font-medium underline">
            Check Integrations
          </Link>
        </div>
      ) : !profile ? (
        <div className="h-[320px] animate-pulse rounded-2xl bg-(--flow-ink)/8" />
      ) : (
        <div className={cn("transition-opacity", isLoading && "opacity-60")}>
          <Body p={profile} query={query} setQuery={setQuery} />
        </div>
      )}
    </div>
  );
}
