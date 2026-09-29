"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { ArrowCounterClockwise, Check, HandPointing, Hourglass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";

/*
 * The hero's interactive "agent run". It plays read → compute → draft on its own,
 * then stops and waits for the visitor to click Approve. That pause is the product:
 * nothing goes out until a person says yes. All figures are illustrative.
 */

const steps = ["Read", "Compute", "Draft", "Approve", "Alert"] as const;
const AUTO_MS = 2300;
const AUTO_APPROVE_MS = 4200;

const rows = [
  { region: "North", revenue: "2,41,10,200", growth: "+6.2%" },
  { region: "South", revenue: "3,12,45,600", growth: "+18.4%", hit: true },
  { region: "West", revenue: "2,88,02,900", growth: "+9.7%" },
  { region: "East", revenue: "1,96,77,300", growth: "+3.1%" },
];

function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    const controls = animate(0, to, { duration: 1.1, ease: EASE_OUT, onUpdate: setValue });
    return () => controls.stop();
  }, [to, reduced]);
  return <>{format(value)}</>;
}

const panel = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.25 } },
};

export function AgentDemo() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  // Reduced motion: skip the autoplay and open straight on the approval step.
  useEffect(() => {
    if (reduced) setStep(3);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    if (step < 3) {
      const id = setTimeout(() => setStep((s) => s + 1), step === 0 ? AUTO_MS + 600 : AUTO_MS);
      return () => clearTimeout(id);
    }
    // If the visitor doesn't click, the demo cursor "approves" for them so the run loops.
    if (step === 3) {
      const id = setTimeout(() => setStep(4), AUTO_APPROVE_MS);
      return () => clearTimeout(id);
    }
    if (step === 4) {
      const id = setTimeout(() => setStep(0), 5000);
      return () => clearTimeout(id);
    }
  }, [step, reduced]);

  return (
    <div className="lux-card w-full max-w-[440px] rounded-[28px] p-2.5">
      <div className="rounded-[22px] bg-(--flow-shell) p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-(--text-secondary)">Agent run</p>
          <span className="rounded-full bg-(--flow-magenta-100) px-2.5 py-1 text-[11px] font-semibold text-(--flow-magenta-700)">
            Illustrative
          </span>
        </div>
        <p className="mt-2 text-[17px] leading-snug font-semibold text-(--flow-ink)">Which region grew fastest in Q3?</p>

        {/* stepper */}
        <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Run progress">
          {steps.map((label, i) => (
            <li key={label} className="flex flex-col gap-1.5">
              <span className="relative h-1 overflow-hidden rounded-full bg-(--flow-ink)/8">
                <motion.span
                  className={cn("absolute inset-0 origin-left rounded-full", i === 3 ? "bg-(--flow-magenta)" : "bg-sunrise")}
                  initial={false}
                  animate={{ scaleX: i < step ? 1 : i === step ? (i === 3 && step === 3 ? 1 : 0.5) : 0 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                />
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold transition-colors",
                  i === step ? "text-(--flow-magenta-700)" : i < step ? "text-(--flow-ink)/70" : "text-(--flow-ink)/35"
                )}
                aria-current={i === step ? "step" : undefined}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        <div className="relative mt-4 h-[212px]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {step === 0 && (
              <motion.div key="read" {...panel} className="absolute inset-0">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-(--text-secondary)">
                  <GoogleSheetsGlyph className="size-4" /> Reading Sales 2026 › Regions
                </p>
                <div className="mt-2.5 overflow-hidden rounded-2xl border border-(--border-subtle)">
                  {rows.map((row, i) => (
                    <motion.div
                      key={row.region}
                      initial={reduced ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.18, duration: 0.4, ease: EASE_OUT }}
                      className="tabular grid grid-cols-[1fr_auto] gap-3 border-b border-(--border-subtle) px-3.5 py-2 text-[13px] last:border-0 odd:bg-(--flow-cream)/60"
                    >
                      <span className="font-medium text-(--flow-ink)">{row.region}</span>
                      <span className="text-(--text-secondary)">₹{row.revenue}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="compute" {...panel} className="absolute inset-0">
                <p className="text-[12.5px] font-semibold text-(--text-secondary)">Computed with pandas, not guessed</p>
                <code className="mt-2.5 block rounded-xl bg-(--flow-ink)/[0.045] px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-(--flow-ink)/80">
                  q3.groupby(&quot;region&quot;).revenue.sum()
                  <br />
                  growth = (q3 - q2) / q2
                </code>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-(--text-muted)">South, Q3 revenue</p>
                    <p className="font-display tabular text-[34px] leading-none text-(--flow-ink)">
                      ₹<CountUp to={31245600} format={(n) => Math.round(n).toLocaleString("en-IN")} />
                    </p>
                  </div>
                  <span className="rounded-full bg-(--flow-mint)/40 px-2.5 py-1 text-[13px] font-bold text-(--flow-ink)">+18.4%</span>
                </div>
                <p className="mt-2 text-[12.5px] text-(--text-muted)">In words: three crore twelve lakh forty-five thousand six hundred rupees</p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="draft" {...panel} className="absolute inset-0">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-(--text-secondary)">
                  <NotionGlyph className="size-4" /> Drafting the report
                </p>
                <div className="mt-2.5 rounded-2xl border border-(--border-subtle) p-3.5">
                  <p className="text-[14px] font-semibold text-(--flow-ink)">Q3 regional review</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--text-secondary)">
                    South led growth at 18.4%, reaching ₹3.12 crore. East grew slowest at 3.1%.
                  </p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {[92, 78, 64].map((w, i) => (
                      <motion.span
                        key={w}
                        className="block h-2 origin-left rounded-full bg-(--flow-ink)/8"
                        style={{ width: `${w}%` }}
                        initial={reduced ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.2 + i * 0.25, duration: 0.6, ease: EASE_OUT }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="approve" {...panel} className="absolute inset-0 flex flex-col">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-(--flow-magenta-700)">
                  <Hourglass weight="fill" className="size-4" /> Waiting for your approval
                </p>
                <div className="mt-2.5 rounded-2xl border border-(--flow-magenta)/25 bg-(--flow-magenta-100)/50 p-3.5">
                  <p className="text-[13.5px] leading-relaxed text-(--flow-ink)">
                    Post to <span className="font-semibold">#sales-updates</span>: “South grew 18.4% in Q3 to ₹3.12 crore.”
                  </p>
                  <p className="mt-1 text-[12px] text-(--text-muted)">Nothing is sent until you say so.</p>
                </div>
                <div className="relative mt-auto flex items-center gap-2.5">
                  {!reduced && (
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-[42%] z-10 drop-shadow-[0_4px_8px_rgba(80,20,40,0.35)]"
                      initial={{ x: 190, y: 80, opacity: 0 }}
                      animate={{ x: [190, 0, 0, 0], y: [80, 0, 0, 0], opacity: [0, 1, 1, 1], scale: [1, 1, 0.78, 1] }}
                      transition={{ duration: 2.6, delay: 1.3, times: [0, 0.55, 0.8, 1], ease: EASE_OUT }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24">
                        <path d="M4 2l15 8.5-6.6 1.6L9.6 19z" fill="#fff4ea" stroke="#4a1e1a" strokeWidth="1.6" strokeLinejoin="round" />
                      </svg>
                    </motion.span>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="bg-sunrise relative inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-[14.5px] font-semibold text-(--flow-shell) shadow-[0_12px_26px_-12px_color-mix(in_oklab,var(--flow-magenta)_80%,transparent)] transition-transform active:scale-[0.97]"
                  >
                    <span aria-hidden="true" className="animate-ping-soft absolute inset-0 rounded-full border-2 border-(--flow-magenta)/50" />
                    <Check weight="bold" className="size-4" />
                    Approve and send
                  </button>
                  <span className="hidden items-center gap-1 text-[12px] font-medium text-(--text-muted) sm:inline-flex">
                    <HandPointing weight="fill" className="size-4 text-(--flow-coral)" />
                    Click it, or watch
                  </span>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="alert" {...panel} className="absolute inset-0 flex flex-col">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-(--text-secondary)">
                  <SlackGlyph className="size-4" /> Sent to #sales-updates
                </p>
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
                  className="mt-2.5 flex gap-3 rounded-2xl border border-(--border-subtle) p-3.5"
                >
                  <span className="bg-sunrise flex size-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold text-(--flow-shell)">
                    IF
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-(--flow-ink)">
                      InsightFlow <span className="font-normal text-(--text-muted)">just now</span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-(--text-secondary)">
                      South grew 18.4% in Q3 to ₹3.12 crore. Approved by you.
                    </p>
                  </div>
                </motion.div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-(--flow-ink)">
                    <span className="flex size-5 items-center justify-center rounded-full bg-(--flow-mint)">
                      <Check weight="bold" className="size-3" />
                    </span>
                    Approved and delivered
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-(--text-secondary) hover:bg-(--flow-magenta-100)"
                  >
                    <ArrowCounterClockwise weight="bold" className="size-3.5" />
                    Replay
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
