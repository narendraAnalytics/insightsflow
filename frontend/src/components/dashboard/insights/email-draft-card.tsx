"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowCounterClockwise,
  CalendarCheck,
  CaretDown,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  PaperPlaneTilt,
  WarningCircle,
} from "@phosphor-icons/react";
import type { DraftFields, EmailDraft } from "@/hooks/use-insights-chat";

const ADDRESS = /^[^@\s,;<>"']+@[^@\s,;<>"']+\.[^@\s,;<>"']+$/;

const cardShadow = "0 24px 36px -22px color-mix(in oklab, var(--flow-magenta) 50%, transparent)";
const label = "pt-2.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta)";
const field =
  "w-full min-w-0 bg-transparent py-2 text-[14px] text-(--flow-ink) outline-none placeholder:text-(--flow-ink)/35";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta)";

// ---- Scheduling is always in IST (Asia/Kolkata, UTC+5:30, no daylight saving), whatever
// timezone the browser is in. The server accepts 2 minutes to 7 days ahead; we keep a
// small safety margin on both ends so a click never lands just outside the window.
const IST_OFFSET_MIN = 330;
const MIN_LEAD_MS = 3 * 60_000;
const MAX_LEAD_MS = 7 * 86_400_000 - 5 * 60_000;

/** The IST wall-clock parts of an instant (read through UTC getters on a shifted date). */
function istParts(d: Date) {
  const s = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth(),
    d: s.getUTCDate(),
    h: s.getUTCHours(),
    min: s.getUTCMinutes(),
    dow: s.getUTCDay(),
  };
}

/** The instant for a given IST wall-clock time (day overflow is handled by Date.UTC). */
const fromIst = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(Date.UTC(y, m, d, h, min) - IST_OFFSET_MIN * 60_000);

const withinWindow = (at: Date, now: Date) => {
  const lead = at.getTime() - now.getTime();
  return lead >= MIN_LEAD_MS && lead <= MAX_LEAD_MS;
};

/** "YYYY-MM-DDTHH:mm" in IST — the format a datetime-local input uses. */
function toInputValue(d: Date): string {
  const p = istParts(d);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.m + 1)}-${z(p.d)}T${z(p.h)}:${z(p.min)}`;
}

/** Parses a datetime-local value as an IST wall time. */
function fromInputValue(v: string): Date | null {
  if (!v) return null;
  const d = new Date(`${v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatIst(d: Date): string {
  return `${d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })} IST`;
}

function presetsFor(now: Date): { label: string; at: Date }[] {
  const p = istParts(now);
  const list = [
    { label: "In 1 hour", at: new Date(now.getTime() + 3_600_000) },
    { label: "Tomorrow 9:00 AM", at: fromIst(p.y, p.m, p.d + 1, 9, 0) },
    { label: "Tomorrow 6:00 PM", at: fromIst(p.y, p.m, p.d + 1, 18, 0) },
  ];
  const daysToMonday = (8 - p.dow) % 7 || 7;
  if (daysToMonday > 1) list.push({ label: "Monday 9:00 AM", at: fromIst(p.y, p.m, p.d + daysToMonday, 9, 0) });
  return list.filter((x) => withinWindow(x.at, now));
}

function sentWhen(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * An email the AI drafted. The user can edit every field; mail only leaves their Gmail
 * when they click Send or Schedule (the approval step) — the agent itself cannot do either.
 */
export function EmailDraftCard({
  draft,
  onSend,
  onSchedule,
  onCancelSchedule,
}: {
  draft: EmailDraft;
  onSend: (fields: DraftFields) => Promise<void>;
  onSchedule: (fields: DraftFields, sendAtIso: string) => Promise<void>;
  onCancelSchedule: () => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [toTouched, setToTouched] = useState(false);
  const [busy, setBusy] = useState<"send" | "schedule" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(
    draft.status === "failed" ? `The scheduled send failed. ${draft.error ?? ""}`.trim() : null
  );
  const [discarded, setDiscarded] = useState(false);
  const [showText, setShowText] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pick, setPick] = useState<Date | null>(null);
  const [custom, setCustom] = useState("");
  const [now, setNow] = useState(() => new Date());
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
  const contentOk = addressOk && subject.trim() !== "" && body.trim() !== "";
  const canSend = contentOk && busy === null;
  const pickOk = pick !== null && withinWindow(pick, now);
  const canSchedule = contentOk && pickOk && busy === null;
  const fields = (): DraftFields => ({ to: address, subject: subject.trim(), body: body.trim() });
  const fail = (err: unknown, fallback: string) => {
    setError(err instanceof Error ? err.message : fallback);
    setBusy(null);
  };

  const send = async () => {
    if (!canSend) return;
    setError(null);
    setBusy("send");
    try {
      await onSend(fields());
    } catch (err) {
      fail(err, "Couldn't send the email. Try again.");
    }
  };

  const schedule = async () => {
    if (!canSchedule || !pick) return;
    setError(null);
    setBusy("schedule");
    try {
      // "…+05:30" so the server stores the right instant whatever this browser's timezone is.
      await onSchedule(fields(), `${toInputValue(pick)}:00+05:30`);
      setPanelOpen(false);
      setBusy(null);
    } catch (err) {
      fail(err, "Couldn't schedule the email. Try again.");
    }
  };

  const cancelSchedule = async () => {
    setError(null);
    setBusy("cancel");
    try {
      await onCancelSchedule();
      setBusy(null);
    } catch (err) {
      fail(err, "Couldn't cancel. Try again.");
    }
  };

  const openPanel = () => {
    const t = new Date();
    setNow(t);
    setPanelOpen((open) => !open);
  };

  const shell = (children: React.ReactNode, key: string, strip = "from-(--flow-magenta) via-(--flow-coral) to-(--flow-amber)") => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -6, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{ boxShadow: cardShadow }}
      className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/80"
    >
      {key !== "discarded" && key !== "sent" && (
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${strip}`} />
      )}
      {children}
    </motion.div>
  );

  const messageToggle = (
    <button
      type="button"
      onClick={() => setShowText((v) => !v)}
      aria-expanded={showText}
      className={`inline-flex items-center gap-1 rounded-full font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-magenta) ${focusRing}`}
    >
      {showText ? "Hide message" : "Show message"}
      <CaretDown weight="bold" className={`size-3 transition-transform ${showText ? "rotate-180" : ""}`} />
    </button>
  );

  const messageText = showText && (
    <p className="mt-2.5 rounded-xl bg-(--flow-peach)/40 px-3 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-(--flow-ink)/85">
      {draft.body}
    </p>
  );

  const sendAt = draft.send_at ? new Date(draft.send_at) : null;

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
                {messageToggle}
              </div>
              {messageText}
            </div>
          </div>,
          "sent"
        )
      ) : draft.status === "scheduled" ? (
        shell(
          <div className="flex items-start gap-3 px-4 pt-4.5 pb-3.5">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-(--flow-amber)/60">
              <Clock weight="fill" className="size-5 text-(--flow-ink)/80" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">
                Scheduled for {sendAt ? formatIst(sendAt) : "later"}
              </p>
              <p className="mt-1 truncate text-[13.5px] text-(--flow-ink)/80">
                To {draft.to} · <span className="font-semibold text-(--flow-ink)">{draft.subject}</span>
              </p>
              <p className="mt-0.5 font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-ink)/60">
                Goes out around then from your Gmail, a few minutes either way.
              </p>
              {error && (
                <p role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] text-(--flow-coral-700)">
                  <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={cancelSchedule}
                  disabled={busy !== null}
                  className={`rounded-full border border-(--flow-coral)/60 px-3.5 py-1 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-coral-700) transition-colors hover:bg-(--flow-pink)/40 disabled:opacity-50 ${focusRing}`}
                >
                  {busy === "cancel" ? "Cancelling" : "Cancel schedule"}
                </button>
                {messageToggle}
              </div>
              {messageText}
            </div>
          </div>,
          "scheduled",
          "from-(--flow-amber) via-(--flow-coral) to-(--flow-magenta)"
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
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-(--flow-magenta) to-(--flow-coral) shadow-[0_8px_14px_-8px_var(--flow-magenta)]">
                  <EnvelopeSimple weight="fill" className="size-4 text-(--flow-cream)" />
                </span>
                <p className="font-(family-name:--font-zeyada) text-[26px] leading-none font-normal text-(--flow-ink)">
                  Email draft
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 font-(family-name:--font-zeyada) text-[19px] leading-none font-normal text-(--flow-ink) ${
                  draft.status === "failed" ? "bg-(--flow-coral)/35" : "bg-(--flow-amber)/45"
                }`}
              >
                {draft.status === "failed" ? "Didn't send" : "Not sent yet"}
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

              <AnimatePresence initial={false}>
                {panelOpen && (
                  <motion.div
                    key="schedule-panel"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-xl border border-(--flow-pink)/60 bg-(--flow-pink)/20 p-3">
                      <p className="font-(family-name:--font-zeyada) text-[23px] leading-none font-normal text-(--flow-magenta)">
                        Send later · India time
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {presetsFor(now).map((p) => {
                          const active = pick?.getTime() === p.at.getTime();
                          return (
                            <button
                              key={p.label}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                setPick(p.at);
                                setCustom(toInputValue(p.at));
                              }}
                              className={`rounded-full border px-3 py-1 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal transition-colors ${focusRing} ${
                                active
                                  ? "border-transparent bg-linear-to-r from-(--flow-magenta) to-(--flow-coral) text-(--flow-cream)"
                                  : "border-(--flow-ink)/15 bg-(--flow-cream)/80 text-(--flow-ink) hover:bg-(--flow-peach)/60"
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <label htmlFor={`${uid}-when`} className="font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-ink)/80">
                          Or pick a time
                        </label>
                        <input
                          id={`${uid}-when`}
                          type="datetime-local"
                          step={60}
                          value={custom}
                          min={toInputValue(new Date(now.getTime() + MIN_LEAD_MS))}
                          max={toInputValue(new Date(now.getTime() + MAX_LEAD_MS))}
                          onChange={(e) => {
                            setCustom(e.target.value);
                            setPick(fromInputValue(e.target.value));
                          }}
                          className={`rounded-lg border border-(--flow-ink)/15 bg-(--flow-cream)/80 px-2.5 py-1.5 text-[13.5px] text-(--flow-ink) ${focusRing}`}
                        />
                      </div>
                      {pick && !pickOk && (
                        <p role="alert" className="mt-2 text-[12.5px] text-(--flow-coral-700)">
                          Pick a time from a few minutes to 7 days from now.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-ink)/60">
                          Up to 7 days ahead. Sent from your Gmail, a few minutes either way.
                        </p>
                        <button
                          type="button"
                          onClick={schedule}
                          disabled={!canSchedule}
                          className={`inline-flex items-center gap-2 rounded-full bg-(--flow-magenta) px-4 py-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-cream) transition-[opacity,transform] hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 ${focusRing}`}
                        >
                          <CalendarCheck weight="fill" className="size-4" />
                          {busy === "schedule" ? "Scheduling" : pickOk && pick ? `Schedule for ${formatIst(pick)}` : "Schedule"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDiscarded(true)}
                    disabled={busy !== null}
                    className={`rounded-full px-3 py-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/70 transition-colors hover:bg-(--flow-pink)/40 disabled:opacity-40 ${focusRing}`}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={openPanel}
                    disabled={busy !== null}
                    aria-expanded={panelOpen}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-(--flow-magenta)/50 px-3.5 py-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta) transition-colors hover:bg-(--flow-pink)/40 disabled:opacity-40 ${focusRing}`}
                  >
                    <Clock weight="bold" className="size-4" />
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={!canSend}
                    className={`group inline-flex items-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-(--flow-magenta) to-(--flow-coral) px-5 py-2 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-cream) shadow-[0_14px_22px_-12px_var(--flow-magenta)] transition-[transform,opacity,box-shadow] hover:-translate-y-0.5 active:translate-y-0 disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none ${focusRing}`}
                  >
                    {busy === "send" ? "Sending" : "Send email"}
                    <motion.span
                      aria-hidden="true"
                      className="flex"
                      animate={
                        busy === "send" && !reduce
                          ? { x: [0, 26], y: [0, -9], opacity: [1, 0] }
                          : { x: 0, y: 0, opacity: 1 }
                      }
                      transition={busy === "send" ? { duration: 0.7, repeat: Infinity, ease: "easeIn" } : { duration: 0.2 }}
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
