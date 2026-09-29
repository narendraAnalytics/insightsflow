"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, FileText, LockKey, LockKeyOpen, Table, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT, sectionContainer, sectionItem, sectionViewport, useCursorGlow } from "@/lib/motion";
import { NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { RevealHeading } from "@/components/site/primitives";

function BentoCard({
  title,
  body,
  accent,
  className,
  children,
}: {
  title: string;
  body: string;
  accent: string;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const glow = useCursorGlow<HTMLDivElement>(reduced);
  return (
    <motion.div
      ref={glow.ref}
      onPointerMove={glow.onPointerMove}
      variants={sectionItem}
      className={cn(
        "lux-card group isolate flex flex-col overflow-hidden rounded-[28px] p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-(--shadow-lg) sm:p-7",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(360px circle at var(--mx, 50%) var(--my, 30%), color-mix(in oklab, ${accent} 20%, transparent), transparent 70%)` }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 -z-10 size-56 rounded-full opacity-50 blur-3xl"
        style={{ background: accent }}
      />
      <div className="relative flex-1">{children}</div>
      <div className="relative mt-6">
        <h3 className="font-display text-[26px] leading-[1.05] text-(--flow-ink) sm:text-[28px]">{title}</h3>
        <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-(--text-secondary)">{body}</p>
      </div>
    </motion.div>
  );
}

function GuessVsCode() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-dashed border-(--flow-coral)/45 bg-(--flow-coral-100)/40 p-4">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-(--flow-coral-700)">
          <X weight="bold" className="size-3.5" /> A chatbot&apos;s guess
        </p>
        <p className="font-display tabular mt-3 text-[34px] leading-none text-(--flow-ink)/35 line-through decoration-(--flow-coral) decoration-2">
          ~₹3 crore
        </p>
        <p className="mt-2 text-[13px] text-(--text-muted)">“Roughly, based on the rows I saw.”</p>
      </div>
      <div className="rounded-2xl border border-(--flow-mint) bg-(--flow-mint)/20 p-4">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-(--flow-ink)">
          <Check weight="bold" className="size-3.5" /> InsightFlow
        </p>
        <p className="font-display tabular mt-3 text-[34px] leading-none text-(--flow-ink)">₹3,12,45,600</p>
        <code className="mt-2 block truncate font-mono text-[12px] text-(--text-secondary)">df[df.region == &quot;South&quot;].revenue.sum()</code>
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-(--flow-ink)/[0.035] px-4 py-3 text-[13px] text-(--text-secondary) sm:col-span-2">
        <Table weight="duotone" className="size-4 shrink-0 text-(--flow-magenta)" />
        Every figure traces back to a sheet, a tab, and the exact rows it came from.
      </div>
    </div>
  );
}

function ApprovalGate() {
  const [approved, setApproved] = useState(false);
  const targets = [
    { icon: NotionGlyph, label: "Notion report" },
    { icon: SlackGlyph, label: "Slack alert" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={approved}
        onClick={() => setApproved((v) => !v)}
        className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-(--border-subtle) bg-(--flow-shell) px-4 py-2.5 text-left"
      >
        <span className="text-[14px] font-semibold text-(--flow-ink)">{approved ? "Approved" : "Approve draft"}</span>
        <span className={cn("relative h-7 w-12 rounded-full transition-colors duration-300", approved ? "bg-sunrise" : "bg-(--flow-ink)/12")}>
          <motion.span
            className="absolute top-1 left-1 size-5 rounded-full bg-(--flow-shell) shadow-(--shadow-sm)"
            animate={{ x: approved ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </span>
      </button>
      {targets.map((t, i) => (
        <div key={t.label} className="flex items-center justify-between rounded-2xl bg-(--flow-ink)/[0.035] px-4 py-2.5">
          <span className="flex items-center gap-2 text-[13.5px] font-medium text-(--flow-ink)">
            <t.icon className="size-4" />
            {t.label}
          </span>
          <motion.span
            key={String(approved)}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 400, damping: 20 }}
            className={cn("flex items-center gap-1 text-[12px] font-semibold", approved ? "text-(--flow-ink)" : "text-(--text-muted)")}
          >
            {approved ? <LockKeyOpen weight="bold" className="size-3.5 text-(--flow-magenta)" /> : <LockKey weight="bold" className="size-3.5" />}
            {approved ? "Ready" : "Locked"}
          </motion.span>
        </div>
      ))}
    </div>
  );
}

function InWords() {
  return (
    <div className="rounded-2xl bg-(--flow-shell) p-4 shadow-(--shadow-sm)">
      <p className="font-display tabular text-[36px] leading-none text-(--flow-ink)">₹4,05,00,000</p>
      <p className="mt-2.5 text-[14px] leading-snug font-medium text-(--flow-magenta-700)">Four crore five lakh rupees</p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-semibold">
        {["1,00,000 = 1 lakh", "1,00,00,000 = 1 crore"].map((s) => (
          <span key={s} className="rounded-full bg-(--flow-amber)/25 px-2.5 py-1 text-(--flow-ink)">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

const joinBars = [
  { region: "North", target: 70, actual: 62 },
  { region: "South", target: 72, actual: 92 },
  { region: "West", target: 80, actual: 74 },
  { region: "East", target: 60, actual: 48 },
];

function CrossSheet() {
  const reduced = useReducedMotion();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--flow-coral)/15 px-3 py-1 text-(--flow-ink)">
          <span className="size-2 rounded-full bg-(--flow-coral)" /> Actuals sheet
        </span>
        <span className="text-(--text-muted)">joined on region with</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--flow-magenta)/12 px-3 py-1 text-(--flow-ink)">
          <span className="size-2 rounded-full bg-(--flow-magenta-300)" /> Targets sheet
        </span>
      </div>
      <div className="mt-5 flex h-32 items-end gap-4 sm:gap-6" role="img" aria-label="Illustrative bar chart of actuals against targets by region; South beats target.">
        {joinBars.map((b, i) => (
          <div key={b.region} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-24 w-full items-end justify-center gap-1">
              {[
                { h: b.target, c: "bg-(--flow-magenta-300)" },
                { h: b.actual, c: "bg-(--flow-coral)" },
              ].map((bar, j) => (
                <motion.span
                  key={j}
                  className={cn("w-1/2 max-w-5 origin-bottom rounded-t-md", bar.c)}
                  style={{ height: `${bar.h}%` }}
                  initial={reduced ? false : { scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 + i * 0.1 + j * 0.05 }}
                />
              ))}
            </div>
            <span className="text-[12px] font-medium text-(--text-muted)">{b.region}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilePicker() {
  const files = [
    { name: "Sales 2026", picked: true },
    { name: "Targets FY27", picked: true },
    { name: "Payroll", picked: false },
    { name: "Board notes", picked: false },
  ];
  return (
    <ul className="grid grid-cols-2 gap-2">
      {files.map((f) => (
        <li
          key={f.name}
          className={cn(
            "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[13px] font-medium",
            f.picked ? "bg-(--flow-shell) text-(--flow-ink) shadow-(--shadow-sm)" : "bg-(--flow-ink)/[0.035] text-(--text-muted)"
          )}
        >
          {f.picked ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-(--flow-mint)">
              <Check weight="bold" className="size-3" />
            </span>
          ) : (
            <LockKey weight="bold" className="size-4" />
          )}
          <FileText weight="duotone" className="size-4 shrink-0" />
          <span className="truncate">{f.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function WhyChooseSection() {
  return (
    <section id="product" className="relative isolate overflow-hidden py-[clamp(5rem,10vw,9rem)]">
      <div aria-hidden="true" className="animate-aurora-b absolute top-10 -left-40 -z-10 size-[30rem] rounded-full bg-(--flow-pink)/40 blur-[110px]" />
      <div aria-hidden="true" className="animate-aurora-a absolute right-[-10rem] bottom-0 -z-10 size-[32rem] rounded-full bg-(--flow-amber)/25 blur-[110px]" />

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-6 lg:grid-cols-[1.3fr_1fr]">
          <RevealHeading
            className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] text-(--flow-ink)"
            lines={[{ text: "Answers you can check," }, { text: "sent only when you say so.", className: "text-sunrise" }]}
          />
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={sectionViewport}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.2 }}
            className="max-w-[40ch] text-[17px] leading-relaxed text-(--text-secondary) lg:pb-2"
          >
            The model plans the analysis and writes the summary. The maths runs in code, and a person signs off before
            anything leaves.
          </motion.p>
        </div>

        <motion.div
          variants={sectionContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          className="mt-14 grid gap-4 sm:gap-5 lg:grid-cols-6"
        >
          <BentoCard
            className="lg:col-span-4 lg:row-span-2"
            accent="var(--flow-mint)"
            title="Numbers come from code, not guesses"
            body="Every total, average and growth rate is computed with pandas on your real rows. The language model never does the arithmetic."
          >
            <GuessVsCode />
          </BentoCard>
          <BentoCard
            className="lg:col-span-2"
            accent="var(--flow-magenta)"
            title="You approve every send"
            body="Reports and alerts wait for a person. Flip the switch to see it."
          >
            <ApprovalGate />
          </BentoCard>
          <BentoCard
            className="lg:col-span-2"
            accent="var(--flow-amber)"
            title="Lakh and crore, in words"
            body="Amounts are grouped the Indian way and spelled out, so nobody miscounts a zero."
          >
            <InWords />
          </BentoCard>
          <BentoCard
            className="lg:col-span-3"
            accent="var(--flow-coral)"
            title="Ask across two sheets"
            body="Compare actuals with targets, or orders with returns, in one question."
          >
            <CrossSheet />
          </BentoCard>
          <BentoCard
            className="lg:col-span-3"
            accent="var(--flow-pink)"
            title="It only sees the files you pick"
            body="You choose sheets one by one with Google's own picker. Access tokens are encrypted before they're stored."
          >
            <FilePicker />
          </BentoCard>
        </motion.div>
      </div>
    </section>
  );
}
