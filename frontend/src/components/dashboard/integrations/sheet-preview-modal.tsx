"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import { Table, X } from "@phosphor-icons/react";

const chipAccents = [
  "var(--flow-magenta)",
  "var(--flow-cyan)",
  "var(--flow-coral)",
  "var(--flow-lavender)",
  "var(--flow-pink)",
];

export function SheetPreviewModal({
  open,
  onOpenChange,
  sheetName,
  fetchPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetName: string | null;
  fetchPreview: () => Promise<{ headers: string[]; rows: string[][] }>;
}) {
  const [data, setData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetchPreview()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load sheet data"))
      .finally(() => setLoading(false));
  }, [open, fetchPreview]);

  const summary =
    data && data.headers.length > 0
      ? `${data.rows.length.toLocaleString()} rows shown · ${data.headers.length} columns`
      : "Live preview from Google Sheets";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 30% 20%, color-mix(in oklab, var(--flow-pink) 55%, transparent), transparent 70%)," +
              "radial-gradient(55% 50% at 75% 80%, color-mix(in oklab, var(--flow-lavender) 55%, transparent), transparent 70%)," +
              "color-mix(in oklab, var(--flow-ink) 22%, transparent)",
            backdropFilter: "blur(10px)",
          }}
        />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 outline-none duration-150 data-closed:animate-out data-closed:fade-out-0">
          <div className="[perspective:1400px]">
            <motion.div
              initial={{ opacity: 0, rotateX: 16, y: 40, scale: 0.94 }}
              animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 190, damping: 22 }}
              style={{
                transformOrigin: "50% 100%",
                boxShadow:
                  "0 50px 90px -30px color-mix(in oklab, var(--flow-magenta) 55%, transparent), 0 2px 0 color-mix(in oklab, var(--flow-cream) 90%, transparent) inset",
                backgroundImage:
                  "radial-gradient(110% 80% at 0% 0%, color-mix(in oklab, var(--flow-peach) 90%, transparent), transparent 60%)," +
                  "radial-gradient(90% 80% at 100% 100%, color-mix(in oklab, var(--flow-lavender) 75%, transparent), transparent 65%)," +
                  "linear-gradient(160deg, var(--flow-cream), color-mix(in oklab, var(--flow-pink) 35%, var(--flow-cream)))",
              }}
              className="flex max-h-[82vh] flex-col overflow-hidden rounded-[30px] border border-(--flow-cream)"
            >
              <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-6 pb-4">
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className="flex size-14 shrink-0 items-center justify-center rounded-[18px] border border-(--flow-cream) bg-linear-to-br from-(--flow-cream) to-(--flow-peach)"
                    style={{
                      boxShadow:
                        "0 20px 28px -14px color-mix(in oklab, var(--flow-coral) 60%, transparent), 0 2px 0 var(--flow-cream) inset",
                    }}
                  >
                    <Table weight="duotone" className="size-7 text-(--flow-magenta)" />
                  </span>
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="truncate font-heading text-[21px] leading-tight font-bold tracking-tight text-(--flow-ink)">
                      {sheetName}
                    </DialogPrimitive.Title>
                    <p className="mt-0.5 text-[13px] text-(--flow-ink)/55">{summary}</p>
                  </div>
                </div>
                <DialogPrimitive.Close
                  aria-label="Close preview"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 text-(--flow-ink)/60 shadow-[0_12px_20px_-10px_var(--flow-magenta)] transition-transform hover:scale-105 hover:text-(--flow-ink) active:scale-95"
                >
                  <X weight="bold" className="size-4" />
                </DialogPrimitive.Close>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
                <div
                  className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-[22px] border border-(--flow-cream)/90 bg-(--flow-cream)/65"
                  style={{
                    boxShadow: "0 24px 40px -26px color-mix(in oklab, var(--flow-magenta) 45%, transparent)",
                    scrollbarWidth: "thin",
                    scrollbarColor: "var(--flow-pink) transparent",
                  }}
                >
                  {loading ? (
                    <p className="p-8 text-center text-[13.5px] text-(--flow-ink)/50">Loading sheet…</p>
                  ) : error ? (
                    <p className="p-8 text-center text-[13.5px] font-medium text-(--flow-coral)">{error}</p>
                  ) : data && data.headers.length > 0 ? (
                    <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
                      <thead className="sticky top-0 z-10 bg-(--flow-cream)/95 backdrop-blur-md">
                        <tr>
                          {data.headers.map((header, i) => (
                            <th key={`${header}-${i}`} className="px-3.5 py-3 font-semibold whitespace-nowrap">
                              <span
                                className="inline-block rounded-full border border-(--flow-cream) px-3 py-1 font-heading text-[12.5px] text-(--flow-ink)"
                                style={{
                                  backgroundColor: `color-mix(in oklab, ${chipAccents[i % chipAccents.length]} 26%, var(--flow-cream))`,
                                  boxShadow: `0 10px 16px -10px ${chipAccents[i % chipAccents.length]}`,
                                }}
                              >
                                {header}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row, ri) => (
                          <tr key={ri} className="transition-colors odd:bg-(--flow-peach)/25 hover:bg-(--flow-pink)/30">
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className="border-t border-(--flow-cream)/80 px-3.5 py-2.5 whitespace-nowrap text-(--flow-ink)/80 tabular-nums"
                              >
                                {cell || <span className="text-(--flow-ink)/25">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-8 text-center text-[13.5px] text-(--flow-ink)/50">No data in this sheet yet.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
