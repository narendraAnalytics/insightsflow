"use client";

import { useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CheckCircle, Clock, PaperPlaneTilt, Percent } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { GmailGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { useDelivery, type DeliveryProvider, type ProviderDelivery, type RangeDays } from "@/hooks/use-analytics";

const RANGES: { value: RangeDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const META: Record<DeliveryProvider, { name: string; verb: string; sentLabel: string; destLabel: string; accent: string }> = {
  slack: {
    name: "Slack",
    verb: "posted",
    sentLabel: "Messages posted",
    destLabel: "Top channels",
    accent: "var(--flow-coral)",
  },
  gmail: {
    name: "Gmail",
    verb: "sent",
    sentLabel: "Emails sent",
    destLabel: "Top recipients",
    accent: "var(--flow-magenta)",
  },
  notion: {
    name: "Notion",
    verb: "saved",
    sentLabel: "Pages saved",
    destLabel: "Top parent pages",
    accent: "var(--flow-mint)",
  },
};

const num = (n: number) => n.toLocaleString("en-IN");
const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
const shortDate = (iso: string) =>
  dayOf(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

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

function BarList({ rows, color }: { rows: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-3 text-sm text-(--flow-ink)/80">
            <span className="truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{num(r.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-(--flow-ink)/8">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  change,
  note,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  change?: { pct: number | null; previous: number; isNew: boolean };
  note?: string;
}) {
  const up = (change?.pct ?? 0) >= 0;
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-(--flow-ink)/70">
        <Icon weight="duotone" className="size-5 shrink-0" />
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-(--flow-ink) tabular-nums">{value}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-(--flow-ink)/60">
        {change && change.pct !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold",
              up ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-700"
            )}
          >
            {up ? <ArrowUpRight weight="bold" className="size-3" /> : <ArrowDownRight weight="bold" className="size-3" />}
            {Math.abs(change.pct)}%
          </span>
        )}
        {change?.isNew && (
          <span className="rounded-full bg-(--flow-ink)/8 px-2 py-0.5 font-semibold text-(--flow-ink)/70">New</span>
        )}
        {change && <span>vs {num(change.previous)} before</span>}
        {note && <span>{note}</span>}
      </p>
    </div>
  );
}

function Tip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; payload: { date: string } }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl px-3 py-2 text-xs text-(--flow-ink)">
      <p className="font-semibold">{shortDate(payload[0].payload.date)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="mt-0.5">
          {p.dataKey === "sent" ? "Approved & sent" : "Drafted"}: {num(p.value)}
        </p>
      ))}
    </div>
  );
}

function ProviderView({ provider, d }: { provider: DeliveryProvider; d: ProviderDelivery }) {
  const m = META[provider];
  const sent = d.kpis.find((k) => k.key === "sent");
  const drafted = d.kpis.find((k) => k.key === "drafted");
  const hasActivity = d.daily.some((x) => x.drafted + x.sent > 0);

  if (!d.connected && !hasActivity) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
        <p className="text-sm text-(--flow-ink)/65">Connect {m.name} to see what you send there.</p>
        <Link href="/dashboard/integrations" className="rounded-full bg-(--flow-ink) px-5 py-2 text-sm font-medium text-white">
          Connect {m.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sent && (
          <Stat
            icon={PaperPlaneTilt}
            label={m.sentLabel}
            value={num(sent.value)}
            change={{ pct: sent.change_pct, previous: sent.previous, isNew: sent.change_pct === null && sent.value > 0 }}
          />
        )}
        {drafted && (
          <Stat
            icon={CheckCircle}
            label="Drafts by AI"
            value={num(drafted.value)}
            change={{ pct: drafted.change_pct, previous: drafted.previous, isNew: drafted.change_pct === null && drafted.value > 0 }}
          />
        )}
        <Stat
          icon={Percent}
          label="Approval rate"
          value={d.approval_rate === null ? "—" : `${d.approval_rate}%`}
          note={d.approval_rate === null ? "No drafts yet" : "of drafts you approved"}
        />
        <Stat
          icon={Clock}
          label="Waiting for you"
          value={num(d.waiting)}
          note={
            d.scheduled > 0
              ? `${d.scheduled} scheduled to send`
              : d.waiting === 0
                ? "Nothing pending"
                : "drafts not yet approved"
          }
        />
      </div>

      <Card title="Drafted vs approved over time">
        {!hasActivity ? (
          <Hint text={`No ${m.name} drafts in this period. Ask AI Insights to draft one from an answer.`} />
        ) : (
          <>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.daily} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    {[
                      ["drafted", "var(--flow-amber)"],
                      ["sent", m.accent],
                    ].map(([k, c]) => (
                      <linearGradient key={k} id={`dl-${provider}-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.03} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--flow-ink)" strokeOpacity={0.08} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--flow-ink)", opacity: 0.55 }}
                    minTickGap={28}
                    padding={{ left: 14, right: 14 }}
                  />
                  <YAxis hide domain={[0, (max: number) => Math.max(3, max)]} />
                  <Tooltip content={<Tip />} cursor={{ stroke: "var(--flow-ink)", strokeOpacity: 0.15 }} />
                  <Area type="monotone" dataKey="drafted" stroke="var(--flow-amber)" strokeWidth={2} fill={`url(#dl-${provider}-drafted)`} />
                  <Area type="monotone" dataKey="sent" stroke={m.accent} strokeWidth={2} fill={`url(#dl-${provider}-sent)`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-(--flow-ink)/65">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-(--flow-amber)" /> Drafted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: m.accent }} /> Approved &amp; sent
              </span>
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={m.destLabel}>
          {d.by_destination.length ? (
            <BarList rows={d.by_destination} color={m.accent} />
          ) : (
            <Hint text={`Nothing ${m.verb} in this period.`} />
          )}
        </Card>
        <Card title={provider === "gmail" ? "Connected accounts" : "Connected workspaces"}>
          {d.workspaces.length ? (
            <ul className="flex flex-col divide-y divide-(--flow-ink)/8">
              {d.workspaces.map((w) => {
                const count = d.by_workspace.find((x) => x.label === w.name)?.value ?? 0;
                return (
                  <li key={w.name} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-(--flow-ink)">
                        {w.name}
                        {w.is_default && (
                          <span className="ml-2 rounded-full bg-(--flow-ink)/8 px-2 py-0.5 text-[11px] font-semibold text-(--flow-ink)/65">
                            Default
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-(--flow-ink)/55">
                        {w.destination ?? (provider === "slack" ? "No channel chosen" : provider === "notion" ? "No page chosen" : "Connected")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-(--flow-ink)/65 tabular-nums">
                      {num(count)} {m.verb}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Hint text={`No ${m.name} ${provider === "gmail" ? "account" : "workspace"} is connected right now.`} />
          )}
        </Card>
      </div>

      <Card title={`Recently ${m.verb}`}>
        {d.recent.length === 0 ? (
          <Hint text={`Approved ${m.name} drafts will be listed here.`} />
        ) : (
          <ul className="flex flex-col divide-y divide-(--flow-ink)/8">
            {d.recent.map((r) => (
              <li key={`${r.conversation_id}-${r.sent_at}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 basis-60 truncate text-sm text-(--flow-ink)">{r.preview || "(no text)"}</span>
                <span className="shrink-0 text-xs text-(--flow-ink)/55">
                  {r.destination} · {r.workspace}
                </span>
                <span className="shrink-0 text-xs text-(--flow-ink)/45">
                  {new Date(r.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium underline">
                    Open
                  </a>
                ) : (
                  <Link
                    href={`/dashboard/ai-insights?chat=${r.conversation_id}`}
                    className="shrink-0 text-xs font-medium underline"
                  >
                    Chat
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function DeliveryAnalytics({ provider }: { provider: DeliveryProvider }) {
  const [range, setRange] = useState<RangeDays>(30);
  const { data, error, isLoading } = useDelivery(range);
  const Glyph = { slack: SlackGlyph, notion: NotionGlyph, gmail: GmailGlyph }[provider];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-(--flow-ink)/60">
          <Glyph className="size-4" />
          {META[provider].name} activity from approved drafts, compared with the {range} days before.
        </p>
        <div role="group" aria-label="Date range" className="glass-panel inline-flex rounded-full p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                range === r.value ? "bg-(--flow-ink) text-white" : "text-(--flow-ink)/65 hover:text-(--flow-ink)"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && !data ? (
        <div className="glass-card rounded-2xl p-6 text-sm text-(--flow-ink)/70">Couldn&apos;t load analytics: {error}</div>
      ) : !data ? (
        <div className="h-[320px] animate-pulse rounded-2xl bg-(--flow-ink)/8" />
      ) : (
        <div className={cn("transition-opacity", isLoading && "opacity-60")}>
          <ProviderView provider={provider} d={data[provider]} />
        </div>
      )}
    </div>
  );
}
