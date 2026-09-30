"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import type { EmailItem, ResultTable } from "@/hooks/use-insights-chat";

const barAccents = [
  "var(--flow-magenta)",
  "var(--flow-coral)",
  "oklch(0.66 0.12 190)",
  "oklch(0.72 0.17 55)",
  "oklch(0.68 0.15 160)",
  "oklch(0.64 0.22 330)",
];

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown,
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <>{fmt(shown)}</>;
}

const cardShadow = "0 24px 36px -22px color-mix(in oklab, var(--flow-magenta) 50%, transparent)";

/** A single computed number, shown large. */
export function ValueCard({ value, label }: { value: number; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{ boxShadow: cardShadow }}
      className="relative w-fit min-w-44 overflow-hidden rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/75 px-5 py-4"
    >
      <span
        aria-hidden="true"
        className="absolute -top-8 -right-8 size-24 rounded-full bg-(--flow-magenta)/25 blur-2xl"
      />
      <p className="text-gradient-flow relative font-(family-name:--font-zeyada) text-[56px] leading-none font-normal tabular-nums">
        <CountUp value={value} />
      </p>
      <p className="relative mt-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/80">{label}</p>
    </motion.div>
  );
}

/** Two-column label/number tables render as animated bars; anything else as a compact grid. */
export function TableCard({ table }: { table: ResultTable }) {
  const isBars =
    table.columns.length === 2 && table.rows.length > 0 && table.rows.every((r) => typeof r[1] === "number");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{ boxShadow: cardShadow }}
      className="w-full max-w-xl overflow-hidden rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/75"
    >
      {isBars ? <Bars table={table} /> : <Grid table={table} />}
    </motion.div>
  );
}

function Bars({ table }: { table: ResultTable }) {
  const max = Math.max(...table.rows.map((r) => Math.abs(r[1] as number)), 1);
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-magenta)">{table.columns[1]}</p>
      {table.rows.map((row, i) => {
        const value = row[1] as number;
        const accent = barAccents[i % barAccents.length];
        return (
          <div key={`${row[0]}-${i}`} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-(family-name:--font-zeyada) text-[23px] leading-none font-normal text-(--flow-ink)">{String(row[0])}</span>
              <span className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal tabular-nums" style={{ color: accent }}>{fmt(value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-(--flow-ink)/6">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max((Math.abs(value) / max) * 100, 2)}%` }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 6px 12px -6px ${accent}`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Grid({ table }: { table: ResultTable }) {
  return (
    <div className="max-h-72 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--flow-pink) transparent" }}>
      <table className="w-full border-separate border-spacing-0 text-left text-[12.5px]">
        <thead className="sticky top-0 bg-(--flow-cream)">
          <tr>
            {table.columns.map((c) => (
              <th key={c} className="px-3.5 py-2 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal whitespace-nowrap text-(--flow-magenta)">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="odd:bg-(--flow-peach)/25">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border-t border-(--flow-cream)/80 px-3.5 py-2 whitespace-nowrap text-(--flow-ink)/80 tabular-nums"
                >
                  {cell === null ? <span className="text-(--flow-ink)/25">—</span> : typeof cell === "number" ? fmt(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "6:30 AM" today, "Yesterday", else "28 Sep" — in the viewer's own timezone. */
function emailWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** The user's latest emails as a readable list: who, what, and when. */
export function EmailCard({ emails }: { emails: EmailItem[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{ boxShadow: cardShadow }}
      className="w-full max-w-xl overflow-hidden rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/75"
    >
      <p className="px-4 pt-3.5 pb-1 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-magenta)">
        Your latest emails
      </p>
      <ul>
        {emails.map((mail, i) => {
          const accent = barAccents[i % barAccents.length];
          return (
            <motion.li
              key={`${mail.date}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 + i * 0.06, duration: 0.35 }}
              className="flex items-start gap-3 border-t border-(--flow-cream)/80 px-4 py-3 first:border-t-0"
              title={mail.address || undefined}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-cream)"
                style={{ backgroundImage: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 55%, var(--flow-coral)))` }}
              >
                {(mail.name.trim()[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {mail.unread && (
                      <span
                        role="img"
                        aria-label="Unread"
                        title="Unread"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                    )}
                    <span className="truncate font-(family-name:--font-zeyada) text-[25px] leading-none font-normal text-(--flow-ink)">
                      {mail.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal" style={{ color: accent }}>
                    {emailWhen(mail.date)}
                  </span>
                </div>
                <p className={`mt-1 line-clamp-2 text-[13.5px] leading-snug text-(--flow-ink) ${mail.unread ? "font-semibold" : "font-medium"}`}>
                  {mail.subject}
                </p>
                {mail.snippet && (
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-(--flow-ink)/60">{mail.snippet}</p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}
