"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import { Check, Stack, X } from "@phosphor-icons/react";

const raised = (accent: string) =>
  `0 16px 26px -16px color-mix(in oklab, ${accent} 55%, transparent), 0 2px 0 var(--flow-cream) inset`;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spreadsheetName: string;
  tabs: { id: number; title: string }[];
  /** Tab titles of this spreadsheet that are already connected. */
  takenTitles: string[];
  busy: boolean;
  onConfirm: (titles: string[]) => void;
};

/** Lets the user choose which tabs of a spreadsheet to connect. */
export function TabPickerDialog({ open, onOpenChange, spreadsheetName, tabs, takenTitles, busy, onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  // Preselect the first tab that isn't connected yet each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const first = tabs.find((t) => !takenTitles.includes(t.title));
    setSelected(first ? [first.title] : []);
  }, [open, tabs, takenTitles]);

  const toggle = (title: string) =>
    setSelected((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
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
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none duration-150 data-closed:animate-out data-closed:fade-out-0">
          <div className="[perspective:1200px]">
            <motion.div
              initial={{ opacity: 0, rotateX: 14, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 190, damping: 22 }}
              style={{
                transformOrigin: "50% 100%",
                boxShadow:
                  "0 50px 90px -30px color-mix(in oklab, var(--flow-magenta) 55%, transparent), 0 2px 0 color-mix(in oklab, var(--flow-cream) 90%, transparent) inset",
                backgroundImage:
                  "radial-gradient(110% 80% at 0% 0%, color-mix(in oklab, var(--flow-peach) 90%, transparent), transparent 60%)," +
                  "linear-gradient(160deg, var(--flow-cream), color-mix(in oklab, var(--flow-pink) 35%, var(--flow-cream)))",
              }}
              className="flex max-h-[80vh] flex-col overflow-hidden rounded-[28px] border border-(--flow-cream)"
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-3">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="font-heading text-[20px] leading-tight font-bold tracking-tight text-(--flow-ink)">
                    Choose tabs to connect
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-1 truncate text-[13px] text-(--flow-ink)/55">
                    {spreadsheetName} has {tabs.length} tabs. Each tab you pick becomes its own source.
                  </DialogPrimitive.Description>
                </div>
                <DialogPrimitive.Close
                  aria-label="Close"
                  disabled={busy}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 text-(--flow-ink)/60 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <X weight="bold" className="size-4" />
                </DialogPrimitive.Close>
              </div>

              <div
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pb-2"
                style={{ scrollbarWidth: "thin", scrollbarColor: "var(--flow-pink) transparent" }}
              >
                {tabs.map((tab) => {
                  const taken = takenTitles.includes(tab.title);
                  const checked = selected.includes(tab.title);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked || taken}
                      disabled={taken || busy}
                      onClick={() => toggle(tab.title)}
                      className="flex items-center gap-3 rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/80 px-4 py-3 text-left transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-60"
                      style={{ boxShadow: raised(checked ? "var(--flow-magenta)" : "var(--flow-peach)") }}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          checked || taken
                            ? "border-transparent bg-(--flow-magenta)"
                            : "border-(--flow-ink)/25 bg-(--flow-cream)"
                        }`}
                      >
                        {(checked || taken) && <Check weight="bold" className="size-3 text-(--flow-cream)" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-(--flow-ink)">
                        {tab.title}
                      </span>
                      {taken && <span className="text-[12px] text-(--flow-ink)/45">Already added</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 px-5 pt-3 pb-5">
                <button
                  type="button"
                  onClick={() => onConfirm(selected)}
                  disabled={busy || selected.length === 0}
                  className="bg-gradient-flow inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-(--flow-cream) shadow-[0_16px_28px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Stack weight="bold" className="size-4" />
                  {busy ? "Adding…" : selected.length > 1 ? `Add ${selected.length} tabs` : "Add tab"}
                </button>
              </div>
            </motion.div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
