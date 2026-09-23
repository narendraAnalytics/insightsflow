"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
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

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-(--flow-ink)/25 backdrop-blur-sm duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="glass-panel fixed top-1/2 left-1/2 z-50 flex max-h-[80vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-(--flow-ink)/8 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-(--flow-magenta)/12">
                <Table weight="fill" className="size-4 text-(--flow-magenta)" />
              </span>
              <div>
                <p className="font-heading text-[14.5px] font-semibold text-(--flow-ink)">{sheetName}</p>
                <p className="text-[11.5px] text-(--flow-ink)/50">Live preview from Google Sheets</p>
              </div>
            </div>
            <DialogPrimitive.Close className="flex size-8 items-center justify-center rounded-full text-(--flow-ink)/50 transition-colors hover:bg-(--flow-ink)/6 hover:text-(--flow-ink)">
              <X weight="bold" className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <p className="p-6 text-center text-[13px] text-(--flow-ink)/45">Loading sheet…</p>
            ) : error ? (
              <p className="p-6 text-center text-[13px] font-medium text-(--flow-coral)">{error}</p>
            ) : data && data.headers.length > 0 ? (
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead className="sticky top-0 z-10 bg-(--flow-cream)">
                  <tr>
                    {data.headers.map((header, i) => (
                      <th
                        key={`${header}-${i}`}
                        className="border-b border-(--flow-ink)/8 px-3.5 py-2.5 font-semibold whitespace-nowrap text-(--flow-ink)"
                      >
                        <span
                          className="inline-block rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: `color-mix(in oklab, ${chipAccents[i % chipAccents.length]} 16%, transparent)`,
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
                    <tr key={ri} className="odd:bg-(--flow-ink)/[0.02]">
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="border-b border-(--flow-ink)/6 px-3.5 py-2 whitespace-nowrap text-(--flow-ink)/75"
                        >
                          {cell || <span className="text-(--flow-ink)/25">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-center text-[13px] text-(--flow-ink)/45">No data in this sheet yet.</p>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
