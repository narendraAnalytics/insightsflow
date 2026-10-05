"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { animate, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Check, LockKey, LockKeyOpen, Table, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT, useCursorGlow } from "@/lib/motion";
import { GmailGlyph, GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/* ---------- scroll-scrubbed headline: words fill from faint to solid as you scroll ---------- */

function FillWord({ progress, range, className, children }: { progress: MotionValue<number>; range: [number, number]; className?: string; children: string }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className={cn("inline-block", className)}>
      {children}
    </motion.span>
  );
}

function ScrubHeading({ lines, className }: { lines: { text: string; className?: string }[]; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.92", "start 0.4"] });
  const words = lines.flatMap((line, li) => line.text.split(" ").map((w) => ({ w, li, className: line.className })));
  const n = words.length;
  return (
    <h2 ref={ref} aria-label={lines.map((l) => l.text).join(" ")} className={className}>
      {lines.map((_, li) => (
        <span key={li} aria-hidden="true" className="block">
          {words.map((word, i) =>
            word.li !== li ? null : (
              <span key={i}>
                {reduced ? (
                  <span className={cn("inline-block", word.className)}>{word.w}</span>
                ) : (
                  <FillWord progress={scrollYProgress} range={[i / n, Math.min(1, (i + 1.6) / n)]} className={word.className}>
                    {word.w}
                  </FillWord>
                )}{" "}
              </span>
            )
          )}
        </span>
      ))}
    </h2>
  );
}

/* ---------- bento card: rises from depth, tied to its own scroll position ---------- */

function BentoCard({
  title,
  body,
  accent,
  order,
  className,
  children,
}: {
  title: string;
  body: string;
  accent: string;
  /** small stagger so the grid assembles card by card */
  order: number;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  const glow = useCursorGlow<HTMLDivElement>(reduced);
  const { scrollYProgress } = useScroll({ target: glow.ref, offset: ["start 1", `start ${0.72 - order * 0.035}`] });
  const y = useTransform(scrollYProgress, [0, 1], [110, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.55], [0, 1]);

  return (
    <motion.div
      ref={glow.ref}
      onPointerMove={glow.onPointerMove}
      // ends at y 0 / scale 1, where Framer writes `transform: none`, so text stays crisp at rest
      style={reduced ? undefined : { y, scale, opacity }}
      className={cn(
        "lux-card group isolate flex flex-col overflow-hidden rounded-[28px] p-6 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-(--shadow-lg) sm:p-7",
        className
      )}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${accent}, color-mix(in oklab, ${accent} 30%, var(--flow-lemon)))` }} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(360px circle at var(--mx, 50%) var(--my, 30%), color-mix(in oklab, ${accent} 24%, transparent), transparent 70%)` }}
      />
      <span aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 -z-10 size-56 rounded-full opacity-70 blur-3xl" style={{ background: accent }} />
      <div className="relative flex-1">{children}</div>
      <div className="relative mt-6">
        <h3 className="font-display text-[26px] leading-[1.05] text-(--flow-ink) sm:text-[28px]">{title}</h3>
        <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-(--text-secondary)">{body}</p>
      </div>
    </motion.div>
  );
}

/* ---------- mini demos ---------- */

const RUPEES = new Intl.NumberFormat("en-IN");

/** Counts up once when scrolled into view; shows the final value under reduced motion. */
function CountUpRupees({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, value, { duration: 1.6, ease: EASE_OUT, onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduced, value]);
  return (
    <p ref={ref} className={className} aria-label={`₹${RUPEES.format(value)}`}>
      ₹{RUPEES.format(shown)}
    </p>
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
      <div className="rounded-2xl border border-(--flow-lagoon) bg-(--flow-mint)/25 p-4">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-(--flow-ink)">
          <Check weight="bold" className="size-3.5" /> InsightFlow
        </p>
        <CountUpRupees value={31245600} className="font-display tabular mt-3 text-[34px] leading-none text-(--flow-ink)" />
        <code className="mt-2 block truncate font-mono text-[12px] text-(--text-secondary)">df[df.region == &quot;South&quot;].revenue.sum()</code>
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-(--flow-ink)/[0.035] px-4 py-3 text-[13px] text-(--text-secondary) sm:col-span-2">
        <GoogleSheetsGlyph className="size-4 shrink-0" />
        Every figure traces back to a sheet, a tab, and the exact rows it came from.
        <Table weight="duotone" className="ml-auto hidden size-4 shrink-0 text-(--flow-magenta) sm:block" />
      </div>
    </div>
  );
}

function ApprovalGate() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.7 });
  const reduced = useReducedMotion();
  const [approved, setApproved] = useState(false);
  const touched = useRef(false);

  // Flip to "Approved" once by itself so the idea lands without a click; a user's own toggle wins.
  useEffect(() => {
    if (!inView || reduced) return;
    const t = window.setTimeout(() => {
      if (!touched.current) setApproved(true);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [inView, reduced]);

  const targets: { icon: Glyph; label: string }[] = [
    { icon: GmailGlyph, label: "Gmail email" },
    { icon: SlackGlyph, label: "Slack alert" },
    { icon: NotionGlyph, label: "Notion report" },
  ];
  return (
    <div ref={ref} className="flex flex-col gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={approved}
        onClick={() => {
          touched.current = true;
          setApproved((v) => !v);
        }}
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
        <div key={t.label} className="flex items-center justify-between rounded-2xl bg-(--flow-ink)/[0.035] px-4 py-2">
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
          <GoogleSheetsGlyph className="size-3.5" />
          <span className="size-2 rounded-full bg-(--flow-coral)" /> Actuals sheet
        </span>
        <span className="text-(--text-muted)">joined on region with</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--flow-magenta)/12 px-3 py-1 text-(--flow-ink)">
          <GoogleSheetsGlyph className="size-3.5" />
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
          <GoogleSheetsGlyph className={cn("size-4 shrink-0", !f.picked && "opacity-50")} />
          <span className="truncate">{f.name}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- the four live apps, floating under the intro ---------- */

const apps: { icon: Glyph; name: string; does: string; tint: string }[] = [
  { icon: GoogleSheetsGlyph, name: "Google Sheets", does: "reads your tabs", tint: "var(--flow-mint)" },
  { icon: GmailGlyph, name: "Gmail", does: "sends your reports", tint: "var(--flow-coral-300)" },
  { icon: SlackGlyph, name: "Slack", does: "posts to a channel", tint: "var(--flow-amber)" },
  { icon: NotionGlyph, name: "Notion", does: "saves a report page", tint: "var(--flow-pink)" },
];

function AppChips() {
  return (
    <ul className="mt-10 flex flex-wrap gap-3" aria-label="Works with">
      {apps.map((app, i) => (
        <motion.li
          key={app.name}
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 + i * 0.09 }}
        >
          <span
            className="animate-float-slow flex items-center gap-3 rounded-2xl border border-(--flow-shell)/70 bg-(--flow-shell)/80 py-2 pr-4 pl-2 shadow-[0_14px_34px_-18px_color-mix(in_oklab,var(--flow-ink)_45%,transparent)] backdrop-blur-sm"
            style={{ animationDelay: `${i * -1.7}s` }}
          >
            <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${app.tint} 45%, var(--flow-shell))` }}>
              <app.icon className="size-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="flex items-center gap-1.5 text-[14px] font-bold text-(--flow-ink)">
                {app.name}
                <span className="rounded-full bg-(--flow-mint) px-1.5 py-px text-[10px] font-bold">Live</span>
              </span>
              <span className="text-[12.5px] font-medium text-(--text-secondary)">{app.does}</span>
            </span>
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

/* ---------- section ---------- */

export function WhyChooseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion() ?? false;
  // the lagoon panel grows from an inset card to full width as the section scrolls in
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "start 0.2"] });
  const panelScale = useTransform(scrollYProgress, [0, 1], [0.88, 1]);
  const panelRadius = useTransform(scrollYProgress, [0, 1], [96, 44]);
  const introOpacity = useTransform(scrollYProgress, [0.55, 1], [0, 1]);
  const introY = useTransform(scrollYProgress, [0.55, 1], [24, 0]);

  return (
    <section ref={sectionRef} id="product" className="relative isolate py-[clamp(5rem,10vw,9rem)]">
      {/* lagoon panel: background only, so scaling it never blurs text */}
      <motion.div
        aria-hidden="true"
        style={reduced ? { borderRadius: 44 } : { scale: panelScale, borderRadius: panelRadius }}
        className="absolute inset-0 -z-10 origin-top overflow-hidden will-change-transform bg-[linear-gradient(165deg,var(--flow-aqua)_0%,var(--flow-lagoon)_45%,var(--flow-mint)_100%)]"
      >
        <div className="animate-aurora-a absolute -top-32 -left-24 size-[34rem] rounded-full bg-(--flow-lemon)/70 blur-[110px]" />
        <div className="animate-aurora-b absolute top-1/3 -right-40 size-[36rem] rounded-full bg-(--flow-aqua)/80 blur-[120px]" />
        <div className="animate-aurora-a absolute -bottom-40 left-1/4 size-[30rem] rounded-full bg-(--flow-pink)/45 blur-[120px]" style={{ animationDelay: "-6s" }} />
        <div className="lux-dots absolute inset-0 opacity-60" />
      </motion.div>

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-6 lg:grid-cols-[1.3fr_1fr]">
          <ScrubHeading
            className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] text-(--flow-ink)"
            lines={[{ text: "Answers you can check," }, { text: "sent only when you say so.", className: "text-sunrise" }]}
          />
          <motion.p
            style={reduced ? undefined : { opacity: introOpacity, y: introY }}
            className="max-w-[40ch] text-[17px] leading-relaxed text-(--text-secondary) lg:pb-2"
          >
            The model plans the analysis and writes the summary. The maths runs in code, and a person signs off before
            anything leaves.
          </motion.p>
        </div>

        <AppChips />

        <div className="mt-12 grid gap-4 sm:gap-5 lg:grid-cols-6">
          <BentoCard
            order={0}
            className="lg:col-span-4 lg:row-span-2"
            accent="var(--flow-mint)"
            title="Numbers come from code, not guesses"
            body="Every total, average and growth rate is computed with pandas on your real rows. The language model never does the arithmetic."
          >
            <GuessVsCode />
          </BentoCard>
          <BentoCard
            order={1}
            className="lg:col-span-2"
            accent="var(--flow-magenta)"
            title="You approve every send"
            body="Emails, Slack posts and Notion pages wait for a person. Watch the switch, or flip it yourself."
          >
            <ApprovalGate />
          </BentoCard>
          <BentoCard
            order={2}
            className="lg:col-span-2"
            accent="var(--flow-amber)"
            title="Lakh and crore, in words"
            body="Amounts are grouped the Indian way and spelled out, so nobody miscounts a zero."
          >
            <InWords />
          </BentoCard>
          <BentoCard
            order={3}
            className="lg:col-span-3"
            accent="var(--flow-coral)"
            title="Ask across two sheets"
            body="Compare actuals with targets, or orders with returns, in one question."
          >
            <CrossSheet />
          </BentoCard>
          <BentoCard
            order={4}
            className="lg:col-span-3"
            accent="var(--flow-pink)"
            title="It only sees the files you pick"
            body="You choose sheets one by one with Google's own picker. Access tokens are encrypted before they're stored."
          >
            <FilePicker />
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
