"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Warning, X } from "@phosphor-icons/react";

const Z = "font-(family-name:--font-zeyada)";
const WORD = "DELETE";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will go and what will stay: shown as two short lists. */
  removes: string[];
  keeps?: string[];
  confirmLabel: string;
  /** Throw (or reject) to show the message inline and keep the dialog open. */
  onConfirm: () => Promise<void>;
};

/** Type-DELETE-to-confirm dialog for irreversible actions. The server checks the word too. */
export function ConfirmDeleteDialog({ open, onOpenChange, title, removes, keeps, confirmLabel, onConfirm }: Props) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setError(null);
    }
  }, [open]);

  const ready = typed.trim() === WORD && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Nothing was changed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 30% 20%, color-mix(in oklab, var(--flow-coral) 40%, transparent), transparent 70%)," +
              "color-mix(in oklab, var(--flow-ink) 28%, transparent)",
            backdropFilter: "blur(10px)",
          }}
        />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
          <form
            onSubmit={submit}
            className="relative flex flex-col gap-4 rounded-3xl border border-(--flow-coral)/40 bg-(--flow-cream) p-6"
            style={{ boxShadow: "0 50px 90px -30px color-mix(in oklab, var(--flow-coral) 60%, transparent)" }}
          >
            <DialogPrimitive.Close
              type="button"
              aria-label="Close"
              disabled={busy}
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-(--flow-peach)/70 text-(--flow-ink) disabled:opacity-50"
            >
              <X weight="bold" className="size-4" />
            </DialogPrimitive.Close>

            <div className="flex items-center gap-2 pr-8">
              <Warning weight="fill" className="size-6 shrink-0 text-(--flow-coral)" />
              <DialogPrimitive.Title className={`${Z} text-[34px] leading-none font-normal text-(--flow-ink)`}>
                {title}
              </DialogPrimitive.Title>
            </div>

            <DialogPrimitive.Description render={<div />} className="flex flex-col gap-3">
              <div>
                <p className={`${Z} text-[22px] leading-none font-normal text-(--flow-coral)`}>This permanently removes</p>
                <ul className={`mt-1 list-disc pl-5 ${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/85`}>
                  {removes.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              {keeps && keeps.length > 0 && (
                <div>
                  <p className={`${Z} text-[22px] leading-none font-normal text-[oklch(0.55_0.15_160)]`}>This keeps</p>
                  <ul className={`mt-1 list-disc pl-5 ${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/85`}>
                    {keeps.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className={`${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/70`}>
                This can&apos;t be undone.
              </p>
            </DialogPrimitive.Description>

            <label className="flex flex-col gap-1.5">
              <span className={`${Z} text-[21px] leading-none font-normal text-(--flow-ink)/80`}>
                Type <strong className="font-normal text-(--flow-coral)">{WORD}</strong> to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={busy}
                aria-label={`Type ${WORD} to confirm`}
                className="rounded-2xl border border-(--flow-ink)/15 bg-(--flow-cream) px-4 py-2.5 text-base tracking-wider text-(--flow-ink) outline-none focus:border-(--flow-coral) focus:ring-2 focus:ring-(--flow-coral)/30"
              />
            </label>

            {error && (
              <p role="alert" className={`${Z} text-[20px] leading-snug text-(--flow-coral)`}>
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className={`rounded-full px-5 py-2 ${Z} text-[22px] leading-none font-normal text-(--flow-ink)/75 transition-colors hover:bg-(--flow-peach)/60 disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ready}
                className={`rounded-full bg-(--flow-coral) px-6 py-2.5 ${Z} text-[23px] leading-none font-normal text-(--flow-cream) shadow-[0_16px_28px_-14px_var(--flow-coral)] transition-all enabled:hover:brightness-105 enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45`}
              >
                {busy ? "Deleting…" : confirmLabel}
              </button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
