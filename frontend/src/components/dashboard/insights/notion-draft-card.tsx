"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  CheckCircle,
  FileText,
  FloppyDisk,
  WarningCircle,
} from "@phosphor-icons/react";
import type { NotionDraft } from "@/hooks/use-insights-chat";

const zeyada = "font-(family-name:--font-zeyada) font-normal";
const cardShadow = "0 24px 36px -22px color-mix(in oklab, var(--flow-magenta) 50%, transparent)";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta)";

function savedWhen(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * A Notion page the AI drafted. The user can edit the title and content; nothing reaches
 * Notion until they click Save (the approval step) — the agent itself cannot save.
 */
export function NotionDraftCard({
  draft,
  onSave,
}: {
  draft: NotionDraft;
  onSave: (title: string, body: string) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const [showText, setShowText] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Grow the box to fit its text instead of scrolling inside it.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body, discarded, draft.status]);

  const canSave = title.trim() !== "" && body.trim() !== "" && !busy;

  const save = async () => {
    if (!canSave) return;
    setError(null);
    setBusy(true);
    try {
      await onSave(title.trim(), body.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save to Notion. Try again.");
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode, key: string) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -6, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{ boxShadow: cardShadow }}
      className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/80"
    >
      {key === "edit" && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-(--flow-magenta) via-(--flow-coral) to-(--flow-amber)"
        />
      )}
      {children}
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait" initial={false}>
      {draft.status === "sent" ? (
        shell(
          <div className="flex items-start gap-3 px-4 py-3.5">
            <motion.span
              initial={reduce ? false : { scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 14 }}
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-(--flow-mint)"
            >
              <CheckCircle weight="fill" className="size-6 text-(--flow-cream)" />
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className={`truncate ${zeyada} text-[26px] leading-none text-(--flow-ink)`}>
                Saved to Notion
              </p>
              <p className="mt-1 truncate text-[13.5px] font-semibold text-(--flow-ink)">{draft.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className={`${zeyada} text-[20px] leading-none text-(--flow-ink)/60`}>
                  Under {draft.page_title || "your page"}
                  {savedWhen(draft.sent_at) ? ` · ${savedWhen(draft.sent_at)}` : ""}
                </span>
                {draft.url && (
                  <a
                    href={draft.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 rounded-full ${zeyada} text-[21px] leading-none text-(--flow-magenta) underline-offset-2 hover:underline ${focusRing}`}
                  >
                    Open in Notion
                    <ArrowSquareOut weight="bold" className="size-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setShowText((v) => !v)}
                  aria-expanded={showText}
                  className={`rounded-full ${zeyada} text-[20px] leading-none text-(--flow-magenta) ${focusRing}`}
                >
                  {showText ? "Hide page" : "Show page"}
                </button>
              </div>
              {showText && (
                <p className="mt-2.5 rounded-xl bg-(--flow-peach)/40 px-3 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-(--flow-ink)/85">
                  {draft.body}
                </p>
              )}
            </div>
          </div>,
          "sent"
        )
      ) : discarded ? (
        shell(
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/70`}>
              Draft discarded. Nothing was saved.
            </p>
            <button
              type="button"
              onClick={() => setDiscarded(false)}
              className={`inline-flex items-center gap-1.5 rounded-full ${zeyada} text-[22px] leading-none text-(--flow-magenta) ${focusRing}`}
            >
              <ArrowCounterClockwise weight="bold" className="size-3.5" />
              Restore
            </button>
          </div>,
          "discarded"
        )
      ) : (
        shell(
          <>
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-(--flow-magenta) to-(--flow-coral) shadow-[0_8px_14px_-8px_var(--flow-magenta)]">
                  <FileText weight="fill" className="size-4 text-(--flow-cream)" />
                </span>
                <p className={`${zeyada} text-[26px] leading-none text-(--flow-ink)`}>Notion page</p>
              </div>
              <span
                className={`rounded-full bg-(--flow-amber)/45 px-2.5 py-1 ${zeyada} text-[19px] leading-none text-(--flow-ink)`}
              >
                Not saved yet
              </span>
            </div>

            <div className="px-4 pt-1 pb-4">
              <p className={`pt-1 ${zeyada} text-[22px] leading-none text-(--flow-magenta)`}>
                Under <span className="text-(--flow-ink)">{draft.page_title || "your chosen page"}</span>
              </p>
              <label htmlFor={`${uid}-title`} className="sr-only">
                Page title
              </label>
              <input
                id={`${uid}-title`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="mt-2 w-full min-w-0 border-b border-(--flow-ink)/10 bg-transparent py-2 text-[15px] font-semibold text-(--flow-ink) outline-none focus:border-(--flow-magenta)/60"
              />
              <label htmlFor={`${uid}-body`} className="sr-only">
                Page content
              </label>
              <textarea
                id={`${uid}-body`}
                ref={bodyRef}
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={20000}
                className="mt-3 block max-h-96 w-full resize-none rounded-xl bg-(--flow-peach)/40 px-3.5 py-3 text-[14px] leading-relaxed text-(--flow-ink) outline-none placeholder:text-(--flow-ink)/35 focus-visible:ring-2 focus-visible:ring-(--flow-magenta)/50"
              />

              {error && (
                <p role="alert" className="mt-2.5 flex items-start gap-1.5 text-[13px] text-(--flow-coral-700)">
                  <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className={`${zeyada} text-[20px] leading-none text-(--flow-ink)/60`}>
                  Created in your Notion when you click Save.
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDiscarded(true)}
                    disabled={busy}
                    className={`rounded-full px-3 py-1.5 ${zeyada} text-[22px] leading-none text-(--flow-ink)/70 transition-colors hover:bg-(--flow-pink)/40 disabled:opacity-40 ${focusRing}`}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!canSave}
                    className={`inline-flex items-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-(--flow-magenta) to-(--flow-coral) px-5 py-2 ${zeyada} text-[24px] leading-none text-(--flow-cream) shadow-[0_14px_22px_-12px_var(--flow-magenta)] transition-[transform,opacity,box-shadow] hover:-translate-y-0.5 active:translate-y-0 disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none ${focusRing}`}
                  >
                    {busy ? "Saving" : "Save to Notion"}
                    <FloppyDisk weight="fill" className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </>,
          "edit"
        )
      )}
    </AnimatePresence>
  );
}
