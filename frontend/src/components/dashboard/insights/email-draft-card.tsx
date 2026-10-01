"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowCounterClockwise,
  CaretDown,
  CheckCircle,
  EnvelopeSimple,
  PaperPlaneTilt,
  WarningCircle,
} from "@phosphor-icons/react";
import type { EmailDraft } from "@/hooks/use-insights-chat";

type Fields = Pick<EmailDraft, "to" | "subject" | "body">;

const ADDRESS = /^[^@\s,;<>"']+@[^@\s,;<>"']+\.[^@\s,;<>"']+$/;

const cardShadow = "0 24px 36px -22px color-mix(in oklab, var(--flow-magenta) 50%, transparent)";
const label = "pt-2.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta)";
const field =
  "w-full min-w-0 bg-transparent py-2 text-[14px] text-(--flow-ink) outline-none placeholder:text-(--flow-ink)/35";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta)";

function sentWhen(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * An email the AI drafted. The user can edit every field; mail only leaves their
 * Gmail when they click Send (the approval step) — the agent itself cannot send.
 */
export function EmailDraftCard({
  draft,
  onSend,
}: {
  draft: EmailDraft;
  onSend: (fields: Fields) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [toTouched, setToTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const [showSent, setShowSent] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Grow the message box to fit its text instead of scrolling inside it.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body, discarded, draft.status]);

  const address = to.trim();
  const addressOk = ADDRESS.test(address);
  const canSend = addressOk && subject.trim() !== "" && body.trim() !== "" && !sending;

  const send = async () => {
    if (!canSend) return;
    setError(null);
    setSending(true);
    try {
      await onSend({ to: address, subject: subject.trim(), body: body.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the email. Try again.");
      setSending(false);
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
              <p className="truncate font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">
                Sent to {draft.to}
              </p>
              <p className="mt-1 truncate text-[13.5px] font-semibold text-(--flow-ink)">{draft.subject}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-ink)/60">
                  {sentWhen(draft.sent_at) || "From your Gmail"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSent((v) => !v)}
                  aria-expanded={showSent}
                  className={`inline-flex items-center gap-1 rounded-full font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-magenta) ${focusRing}`}
                >
                  {showSent ? "Hide message" : "Show message"}
                  <CaretDown
                    weight="bold"
                    className={`size-3 transition-transform ${showSent ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
              {showSent && (
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
            <p className="font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/70">
              Draft discarded. Nothing was sent.
            </p>
            <button
              type="button"
              onClick={() => setDiscarded(false)}
              className={`inline-flex items-center gap-1.5 rounded-full font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta) ${focusRing}`}
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
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-(--flow-magenta) via-(--flow-coral) to-(--flow-amber)"
            />
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-(--flow-magenta) to-(--flow-coral) shadow-[0_8px_14px_-8px_var(--flow-magenta)]">
                  <EnvelopeSimple weight="fill" className="size-4 text-(--flow-cream)" />
                </span>
                <p className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">
                  Email draft
                </p>
              </div>
              <span className="rounded-full bg-(--flow-amber)/45 px-2.5 py-1 font-(family-name:--font-zeyada) text-[19px] leading-none font-normal text-(--flow-ink)">
                Not sent yet
              </span>
            </div>

            <div className="px-4 pt-1 pb-4">
              <div className="grid grid-cols-[3.5rem_1fr] items-start border-b border-(--flow-ink)/10 focus-within:border-(--flow-magenta)/60">
                <label htmlFor={`${uid}-to`} className={label}>
                  To
                </label>
                <input
                  id={`${uid}-to`}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  onBlur={() => setToTouched(true)}
                  placeholder="name@example.com"
                  aria-invalid={toTouched && !addressOk}
                  aria-describedby={toTouched && !addressOk ? `${uid}-to-err` : undefined}
                  className={field}
                />
              </div>
              {toTouched && !addressOk && (
                <p id={`${uid}-to-err`} role="alert" className="pt-1 text-[12.5px] text-(--flow-coral-700)">
                  {address ? "Enter one valid email address." : "Add who this email is for."}
                </p>
              )}
              <div className="grid grid-cols-[3.5rem_1fr] items-start border-b border-(--flow-ink)/10 focus-within:border-(--flow-magenta)/60">
                <label htmlFor={`${uid}-subject`} className={label}>
                  Subject
                </label>
                <input
                  id={`${uid}-subject`}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={150}
                  className={`${field} font-semibold`}
                />
              </div>

              <label htmlFor={`${uid}-body`} className="sr-only">
                Message
              </label>
              <textarea
                id={`${uid}-body`}
                ref={bodyRef}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
                className="mt-3 block max-h-80 w-full resize-none rounded-xl bg-(--flow-peach)/40 px-3.5 py-3 text-[14px] leading-relaxed text-(--flow-ink) outline-none placeholder:text-(--flow-ink)/35 focus-visible:ring-2 focus-visible:ring-(--flow-magenta)/50"
              />

              {error && (
                <p role="alert" className="mt-2.5 flex items-start gap-1.5 text-[13px] text-(--flow-coral-700)">
                  <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-ink)/60">
                  Goes out from your Gmail when you click Send.
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDiscarded(true)}
                    disabled={sending}
                    className={`rounded-full px-3.5 py-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/70 transition-colors hover:bg-(--flow-pink)/40 disabled:opacity-40 ${focusRing}`}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={!canSend}
                    className={`group inline-flex items-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-(--flow-magenta) to-(--flow-coral) px-5 py-2 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-cream) shadow-[0_14px_22px_-12px_var(--flow-magenta)] transition-[transform,opacity,box-shadow] hover:-translate-y-0.5 active:translate-y-0 disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none ${focusRing}`}
                  >
                    {sending ? "Sending" : "Send email"}
                    <motion.span
                      aria-hidden="true"
                      className="flex"
                      animate={
                        sending && !reduce
                          ? { x: [0, 26], y: [0, -9], opacity: [1, 0] }
                          : { x: 0, y: 0, opacity: 1 }
                      }
                      transition={sending ? { duration: 0.7, repeat: Infinity, ease: "easeIn" } : { duration: 0.2 }}
                    >
                      <PaperPlaneTilt weight="fill" className="size-4" />
                    </motion.span>
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
