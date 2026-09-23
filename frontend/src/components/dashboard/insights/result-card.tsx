"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import type { ResultTable } from "@/hooks/use-insights-chat";

const barAccents = [
  "var(--flow-magenta)",
  "var(--flow-coral)",
  "var(--flow-cyan)",
  "var(--flow-lavender)",
  "var(--flow-pink)",
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
      initial={{ opacity: 0, y: 12, rotateX: 14 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{ boxShadow: cardShadow, transformPerspective: 800 }}
      className="relative w-fit min-w-44 overflow-hidden rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/75 px-5 py-4"
    >
      <span
        aria-hidden="true"
        className="absolute -top-8 -right-8 size-24 rounded-full bg-(--flow-magenta)/25 blur-2xl"
      />
      <p className="text-gradient-flow relative font-heading text-[38px] leading-none font-bold tracking-tight tabular-nums">
        <CountUp value={value} />
      </p>
      <p className="relative mt-1.5 text-[12.5px] font-medium text-(--flow-ink)/55">{label}</p>
    </motion.div>
  );
}

/** Two-column label/number tables render as animated bars; anything else as a compact grid. */
export function TableCard({ table }: { table: ResultTable }) {
  const isBars =
    table.columns.length === 2 && table.rows.length > 0 && table.rows.every((r) => typeof r[1] === "number");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, rotateX: 14 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{ boxShadow: cardShadow, transformPerspective: 800 }}
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
      <p className="font-heading text-[13px] font-semibold text-(--flow-ink)/70">{table.columns[1]}</p>
      {table.rows.map((row, i) => {
        const value = row[1] as number;
        const accent = barAccents[i % barAccents.length];
        return (
          <div key={`${row[0]}-${i}`} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-medium text-(--flow-ink)">{String(row[0])}</span>
              <span className="font-heading font-bold tabular-nums text-(--flow-ink)">{fmt(value)}</span>
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
              <th key={c} className="px-3.5 py-2.5 font-heading font-semibold whitespace-nowrap text-(--flow-ink)">
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
