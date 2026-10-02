"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Check, CreditCard, Database, FilePdf, LockKey } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { GmailGlyph, GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { LogoVideo } from "@/components/site/logo-video";

/* ---------------------------------------------------------------------------
   Integrations motion graphic. One 15 s clock drives everything (see motion.txt):
   arrive -> gather -> work -> draft + approve gate -> deliver -> secure + settle.
   Every animated value is a pure function of the clock `t`, so the loop is
   seamless and pausing is just "stop advancing t".
   --------------------------------------------------------------------------- */

const LOOP = 15;
const W = 640;
const H = 520;

type Pt = readonly [number, number];
const HUB: Pt = [320, 255];
const GATE: Pt = [482, 255];
const CARD_WAIT: Pt = [408, 255];

const SHEETS: Pt = [105, 105];
const GMAIL_IN: Pt = [62, 258];
const DOCS: Pt = [120, 404];
const NEON: Pt = [268, 468];
const SLACK: Pt = [545, 98];
const NOTION: Pt = [588, 255];
const GMAIL_OUT: Pt = [528, 405];
const CLERK: Pt = [300, 46];
const RAZORPAY: Pt = [412, 470];

/* ---- tiny timeline maths ------------------------------------------------- */
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
/** 0 -> 1 between a..b, holds, 1 -> 0 between c..d. */
const trap = (x: number, a: number, b: number, c: number, d: number) => ramp(x, a, b) - ramp(x, c, d);
const round = (v: number) => Math.round(v * 1000) / 1000; // Node and browser sin/cos differ in the last digits
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
const TAU = Math.PI * 2;

function useT(t: MotionValue<number>, fn: (time: number) => number) {
  return useTransform(t, (time) => round(fn(time)));
}

/* ---- timeline constants -------------------------------------------------- */
const SOURCE_START = [1.7, 2.2, 2.7, 3.2]; // sheets, gmail, documents, database
const PARTICLES_PER_SOURCE = 4;
const PARTICLE_DUR = 0.95;
const particleStart = (src: number, j: number) => SOURCE_START[src] + 0.15 + j * 0.25;
const ARRIVALS = SOURCE_START.flatMap((_, s) =>
  Array.from({ length: PARTICLES_PER_SOURCE }, (_, j) => particleStart(s, j) + PARTICLE_DUR)
);
const DELIVER_START = [10.0, 10.15, 10.3]; // slack, notion, gmail
const DELIVER_DUR = 1.0;

const CAPTIONS: { text: string; win: [number, number] }[] = [
  { text: "Your tools, one flow.", win: [0, 1.6] },
  { text: "It reads your sheets, mail and documents.", win: [1.6, 5.0] },
  { text: "Every number is computed by code, not guessed.", win: [5.0, 7.5] },
  { text: "It waits for your yes.", win: [7.5, 10.0] },
  { text: "Then it reaches your team.", win: [10.0, 13.0] },
  { text: "Sign-in by Clerk. Secure payments by Razorpay.", win: [13.0, 14.8] },
];

/* ---- layout helper ------------------------------------------------------- */
function At({ pos, w, z = 10, children, className }: { pos: Pt; w: number; z?: number; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("absolute -translate-x-1/2 -translate-y-1/2", className)}
      style={{ left: pct(pos[0], W), top: pct(pos[1], H), width: pct(w, W), zIndex: z }}
    >
      {children}
    </div>
  );
}

/* ---- SVG parts ----------------------------------------------------------- */
function Spoke({ t, a, b, win, dashed }: { t: MotionValue<number>; a: Pt; b: Pt; win?: [number, number, number, number]; dashed?: boolean }) {
  const opacity = useT(t, (time) => 0.28 + (win ? 0.6 * trap(time, ...win) : 0));
  return (
    <motion.line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeDasharray={dashed ? "3 6" : undefined}
      style={{ stroke: "var(--flow-magenta)", opacity }}
    />
  );
}

function Particle({ t, from, to, start, color }: { t: MotionValue<number>; from: Pt; to: Pt; start: number; color: string }) {
  const p = useT(t, (time) => ramp(time, start, start + PARTICLE_DUR));
  const cx = useT(t, (time) => from[0] + (to[0] - from[0]) * easeOut(ramp(time, start, start + PARTICLE_DUR)));
  const cy = useT(t, (time) => from[1] + (to[1] - from[1]) * easeOut(ramp(time, start, start + PARTICLE_DUR)));
  const r = useTransform(p, (v) => round(4.2 * (1 - 0.55 * v)));
  const halo = useTransform(p, (v) => round(9 * (1 - 0.4 * v)));
  const opacity = useTransform(p, (v) => (v <= 0 || v >= 1 ? 0 : round(Math.min(1, v * 10) * (v > 0.88 ? (1 - v) / 0.12 : 1))));
  return (
    <>
      <motion.circle cx={cx} cy={cy} r={halo} fill={color} style={{ opacity: useTransform(opacity, (o) => o * 0.25) }} />
      <motion.circle cx={cx} cy={cy} r={r} fill={color} style={{ opacity }} />
    </>
  );
}

function Rings({ t }: { t: MotionValue<number> }) {
  const opacity = useT(t, (time) => 0.5 + 0.35 * trap(time, 4.8, 5.4, 7.0, 7.6));
  return (
    <motion.g style={{ opacity, stroke: "var(--flow-magenta)" }} fill="none" strokeWidth={1.3}>
      <ellipse cx={HUB[0]} cy={HUB[1]} rx={292} ry={122} strokeDasharray="5 8" className="animate-dash-march" />
      <ellipse cx={HUB[0]} cy={HUB[1]} rx={172} ry={72} strokeDasharray="4 7" className="animate-dash-march-rev" />
    </motion.g>
  );
}

const ARC_R = 82;
const ARC_C = 2 * Math.PI * ARC_R;
function WorkArc({ t }: { t: MotionValue<number> }) {
  const offset = useT(t, (time) => ARC_C * (1 - easeOut(ramp(time, 5.0, 6.8))));
  const opacity = useT(t, (time) => trap(time, 5.0, 5.25, 6.9, 7.4));
  return (
    <motion.circle
      cx={HUB[0]}
      cy={HUB[1]}
      r={ARC_R}
      fill="none"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeDasharray={ARC_C}
      transform={`rotate(-90 ${HUB[0]} ${HUB[1]})`}
      style={{ stroke: "var(--flow-magenta)", strokeDashoffset: offset, opacity }}
    />
  );
}

/* ---- HTML parts ---------------------------------------------------------- */
function Tile({
  t,
  pos,
  accent,
  label,
  children,
  phase,
  glow,
  pop,
  badge,
}: {
  t: MotionValue<number>;
  pos: Pt;
  accent: string;
  label: string;
  children: ReactNode;
  phase: number;
  glow?: [number, number, number, number];
  pop?: number;
  badge?: { kind: "check" | "lock"; win: [number, number, number, number] };
}) {
  const y = useT(t, (time) => Math.sin((time / 7.5) * TAU + phase) * 4 - (glow ? 6 * trap(time, ...glow) : 0));
  const scale = useT(t, (time) => {
    if (pop === undefined) return 1;
    const dt = time - pop;
    return dt < 0 || dt > 0.5 ? 1 : 1 + 0.09 * Math.sin((Math.PI * dt) / 0.5);
  });
  const glowOpacity = useT(t, (time) => (glow ? trap(time, ...glow) : 0));
  const badgeOpacity = useT(t, (time) => (badge ? trap(time, ...badge.win) : 0));
  const badgeScale = useT(t, (time) => (badge ? 0.6 + 0.4 * easeOut(ramp(time, badge.win[0], badge.win[1])) : 1));

  return (
    <At pos={pos} w={74} z={14}>
      <motion.div style={{ y, scale }} className="relative">
        <motion.div
          aria-hidden="true"
          style={{ opacity: glowOpacity, boxShadow: `0 0 44px 8px color-mix(in oklab, ${accent} 60%, transparent)` }}
          className="absolute inset-0 rounded-[24%]"
        />
        <div
          className="relative flex aspect-square items-center justify-center rounded-[24%] bg-(--flow-cream)"
          style={{
            boxShadow: `0 14px 28px -14px color-mix(in oklab, ${accent} 70%, transparent), inset 0 0 0 1px color-mix(in oklab, ${accent} 35%, transparent)`,
          }}
        >
          <span className="flex size-[52%] items-center justify-center [&>svg]:size-full">{children}</span>
        </div>
        {badge && (
          <motion.span
            style={{ opacity: badgeOpacity, scale: badgeScale }}
            className="absolute -top-1.5 -right-1.5 flex size-[30%] items-center justify-center rounded-full bg-(--flow-mint) text-(--flow-ink) shadow-sm"
          >
            {badge.kind === "check" ? <Check weight="bold" className="size-[60%]" /> : <LockKey weight="fill" className="size-[58%]" />}
          </motion.span>
        )}
        <span className="absolute top-full left-1/2 mt-1.5 hidden -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-(--text-muted) sm:block">
          {label}
        </span>
      </motion.div>
    </At>
  );
}

function DocCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex aspect-[4/5] w-full flex-col justify-center gap-[9%] rounded-[16%] bg-(--flow-shell) px-[16%]", className)}
      style={{ boxShadow: "0 10px 24px -10px color-mix(in oklab, var(--flow-magenta) 60%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--flow-magenta) 25%, transparent)" }}
    >
      <span className="h-[7%] w-[88%] rounded-full bg-(--flow-magenta)/70" />
      <span className="h-[7%] w-[64%] rounded-full bg-(--flow-coral)/70" />
      <span className="h-[7%] w-[76%] rounded-full bg-(--flow-amber)/80" />
    </div>
  );
}

function DraftCard({ t }: { t: MotionValue<number> }) {
  const x = useT(t, (time) => {
    const a = easeOut(ramp(time, 7.6, 8.6));
    const b = easeOut(ramp(time, 9.55, 10.0));
    return HUB[0] + (CARD_WAIT[0] - HUB[0]) * a + (GATE[0] - CARD_WAIT[0]) * b;
  });
  const opacity = useT(t, (time) => ramp(time, 7.5, 7.9) - ramp(time, 10.0, 10.05));
  const bob = useT(t, (time) => Math.sin(time * 4) * 1.5 * trap(time, 8.6, 8.8, 9.4, 9.55));
  const left = useTransform(x, (v) => pct(v, W));
  return (
    <motion.div
      style={{ left, top: pct(HUB[1], H), width: pct(46, W), opacity, y: bob, zIndex: 12 }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      <DocCard />
    </motion.div>
  );
}

function FlyCard({ t, to, start }: { t: MotionValue<number>; to: Pt; start: number }) {
  const p = useT(t, (time) => ramp(time, start, start + DELIVER_DUR));
  const lx = useTransform(p, (v) => pct(GATE[0] + (to[0] - GATE[0]) * easeOut(v), W));
  const ly = useTransform(p, (v) => pct(GATE[1] + (to[1] - GATE[1]) * easeOut(v), H));
  const opacity = useTransform(p, (v) => (v <= 0 || v >= 1 ? 0 : round(v > 0.7 ? (1 - v) / 0.3 : 1)));
  const scale = useTransform(p, (v) => round(1 - 0.35 * v));
  return (
    <motion.div
      style={{ left: lx, top: ly, width: pct(44, W), opacity, scale, zIndex: 30 }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      <DocCard />
    </motion.div>
  );
}

function ApproveGate({ t }: { t: MotionValue<number> }) {
  const visible = useT(t, (time) => 0.55 + 0.45 * trap(time, 7.3, 7.7, 10.3, 10.9));
  const approved = useT(t, (time) => ramp(time, 9.3, 9.45));
  const wait = useT(t, (time) => trap(time, 7.5, 7.9, 9.3, 9.5) * (0.6 + 0.4 * Math.sin(time * 7.5)));
  const scale = useT(t, (time) => 1 - 0.06 * trap(time, 9.05, 9.15, 9.2, 9.3));
  return (
    <At pos={GATE} w={104} z={16}>
      <motion.div style={{ opacity: visible, scale }} className="relative">
        <motion.span
          aria-hidden="true"
          style={{ opacity: wait, boxShadow: "0 0 30px 6px color-mix(in oklab, var(--flow-magenta) 55%, transparent)" }}
          className="absolute inset-0 rounded-full"
        />
        <div className="relative flex h-[34px] items-center justify-center rounded-full border border-(--flow-magenta)/40 bg-(--flow-shell) text-[12px] font-bold text-(--flow-ink) sm:h-9 sm:text-[13px]">
          Approve
          <motion.span
            style={{ opacity: approved }}
            className="absolute inset-0 flex items-center justify-center gap-1 rounded-full bg-(--flow-mint) text-(--flow-ink)"
          >
            <Check weight="bold" className="size-3.5" />
            Approved
          </motion.span>
        </div>
      </motion.div>
    </At>
  );
}

function Cursor({ t }: { t: MotionValue<number> }) {
  const lx = useT(t, (time) => 588 + (492 - 588) * easeOut(ramp(time, 8.3, 9.0)));
  const ly = useT(t, (time) => 352 + (266 - 352) * easeOut(ramp(time, 8.3, 9.0)));
  const left = useTransform(lx, (v) => pct(v, W));
  const top = useTransform(ly, (v) => pct(v, H));
  const opacity = useT(t, (time) => trap(time, 8.2, 8.5, 9.4, 9.7));
  const scale = useT(t, (time) => 1 - 0.28 * trap(time, 9.05, 9.15, 9.2, 9.3));
  return (
    <motion.span
      aria-hidden="true"
      style={{ left, top, opacity, scale, zIndex: 40 }}
      className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--flow-magenta) bg-(--flow-shell)/80 shadow-md"
    />
  );
}

function Chip({ t, pos, start, label }: { t: MotionValue<number>; pos: Pt; start: number; label: string }) {
  const opacity = useT(t, (time) => trap(time, start, start + 0.3, start + 0.9, start + 1.3));
  const y = useT(t, (time) => -30 * easeOut(ramp(time, start, start + 1.3)));
  return (
    <At pos={pos} w={74} z={13} className="pointer-events-none">
      <motion.span
        style={{ opacity, y }}
        className="block rounded-full border border-(--border-subtle) bg-(--flow-shell)/85 py-0.5 text-center text-[11px] font-bold text-(--flow-ink) sm:text-[12px]"
      >
        {label}
      </motion.span>
    </At>
  );
}

function Hub({ t }: { t: MotionValue<number> }) {
  const scale = useT(t, (time) => {
    let s = 1 + 0.03 * Math.sin((time / 5) * TAU);
    for (const a of ARRIVALS) {
      const dt = time - a;
      if (dt >= 0 && dt < 0.3) s += 0.02 * Math.sin((Math.PI * dt) / 0.3);
    }
    return s;
  });
  const glow = useT(t, (time) => 0.25 + 0.5 * trap(time, 1.7, 2.2, 4.8, 5.4) + 0.4 * trap(time, 5.0, 5.4, 6.9, 7.4));
  return (
    <At pos={HUB} w={112} z={20}>
      <motion.div style={{ scale }} className="relative">
        <motion.span
          aria-hidden="true"
          style={{ opacity: glow, boxShadow: "0 0 70px 14px color-mix(in oklab, var(--flow-magenta) 45%, transparent)" }}
          className="absolute inset-0 rounded-[28%]"
        />
        <div className="lux-card relative flex aspect-square items-center justify-center rounded-[28%]">
          <LogoVideo className="size-[70%] rounded-[22%]" />
        </div>
      </motion.div>
    </At>
  );
}

function Caption({ t, text, win }: { t: MotionValue<number>; text: string; win: [number, number] }) {
  const opacity = useT(t, (time) => trap(time, win[0], win[0] + 0.5, win[1] - 0.4, win[1]));
  const y = useT(t, (time) => 8 * (1 - ramp(time, win[0], win[0] + 0.5)) - 6 * ramp(time, win[1] - 0.4, win[1]));
  return (
    <motion.p
      aria-hidden="true"
      style={{ opacity, y }}
      className="font-display col-start-1 row-start-1 text-center text-[clamp(1.25rem,2.4vw,1.75rem)] leading-tight text-(--flow-ink)"
    >
      {text}
    </motion.p>
  );
}

/* ---- the scene ----------------------------------------------------------- */
export function IntegrationsFlow() {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.25 });
  const t = useMotionValue(0);
  const clock = useRef(0);

  useAnimationFrame((_, delta) => {
    if (reduced || !inView) return;
    clock.current = (clock.current + delta / 1000) % LOOP;
    t.set(clock.current);
  });

  const sourceWin = (i: number): [number, number, number, number] => [
    SOURCE_START[i],
    SOURCE_START[i] + 0.4,
    SOURCE_START[i] + 1.9,
    SOURCE_START[i] + 2.5,
  ];
  const destWin = (i: number): [number, number, number, number] => {
    const s = DELIVER_START[i] + DELIVER_DUR;
    return [s, s + 0.35, 13.0, 13.4];
  };
  const clerkWin: [number, number, number, number] = [13.0, 13.4, 14.5, 14.9];
  const razorWin: [number, number, number, number] = [13.4, 13.8, 14.6, 14.95];

  const sources: { pos: Pt; color: string }[] = [
    { pos: SHEETS, color: "var(--flow-mint)" },
    { pos: GMAIL_IN, color: "var(--flow-coral)" },
    { pos: DOCS, color: "var(--flow-amber)" },
    { pos: NEON, color: "var(--flow-pink)" },
  ];

  return (
    <div ref={ref}>
      <div
        role="img"
        aria-label="Animated diagram: data from Google Sheets, Gmail, documents and your database flows into InsightFlow, which computes the answers with code, drafts a report, waits for your approval, then delivers it to Slack, Notion and Gmail."
        className="relative mx-auto w-full max-w-[640px]"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <div aria-hidden="true" className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--flow-peach)_75%,transparent)_0%,color-mix(in_oklab,var(--flow-mint)_30%,transparent)_60%,transparent_74%)] blur-xl" />

        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden="true">
          <path
            d={`M${HUB[0] - 70} ${HUB[1]} V${HUB[1] - 70} a44 44 0 0 1 44-44 h52 a44 44 0 0 1 44 44 V${HUB[1]} Z`}
            style={{ fill: "color-mix(in oklab, var(--flow-pink) 38%, transparent)" }}
          />
          <Rings t={t} />
          {sources.map((s, i) => (
            <Spoke key={i} t={t} a={s.pos} b={HUB} win={[SOURCE_START[i], SOURCE_START[i] + 0.4, SOURCE_START[i] + 2.2, SOURCE_START[i] + 2.8]} />
          ))}
          <Spoke t={t} a={HUB} b={GATE} win={[7.5, 7.9, 10.2, 10.8]} />
          <Spoke t={t} a={GATE} b={SLACK} win={[10.0, 10.4, 12.2, 12.8]} />
          <Spoke t={t} a={GATE} b={NOTION} win={[10.15, 10.55, 12.2, 12.8]} />
          <Spoke t={t} a={GATE} b={GMAIL_OUT} win={[10.3, 10.7, 12.2, 12.8]} />
          <Spoke t={t} a={HUB} b={CLERK} dashed win={clerkWin} />
          <Spoke t={t} a={HUB} b={RAZORPAY} dashed win={razorWin} />
          <WorkArc t={t} />
          {sources.map((s, si) =>
            Array.from({ length: PARTICLES_PER_SOURCE }, (_, j) => (
              <Particle key={`${si}-${j}`} t={t} from={s.pos} to={HUB} start={particleStart(si, j)} color={s.color} />
            ))
          )}
        </svg>

        <Tile t={t} pos={SHEETS} accent="var(--flow-mint)" label="Google Sheets" phase={0} glow={sourceWin(0)}>
          <GoogleSheetsGlyph />
        </Tile>
        <Tile t={t} pos={GMAIL_IN} accent="var(--flow-coral)" label="Gmail" phase={1.2} glow={sourceWin(1)}>
          <GmailGlyph />
        </Tile>
        <Tile t={t} pos={DOCS} accent="var(--flow-amber)" label="Documents" phase={2.4} glow={sourceWin(2)}>
          <FilePdf weight="duotone" className="text-(--flow-coral)" />
        </Tile>
        <Tile t={t} pos={NEON} accent="var(--flow-pink)" label="Your data" phase={3.6} glow={sourceWin(3)}>
          <Database weight="duotone" className="text-(--flow-magenta)" />
        </Tile>

        <Tile t={t} pos={SLACK} accent="var(--flow-pink)" label="Slack" phase={4.8} glow={destWin(0)} pop={DELIVER_START[0] + DELIVER_DUR} badge={{ kind: "check", win: destWin(0) }}>
          <SlackGlyph />
        </Tile>
        <Tile t={t} pos={NOTION} accent="var(--flow-amber)" label="Notion" phase={6} glow={destWin(1)} pop={DELIVER_START[1] + DELIVER_DUR} badge={{ kind: "check", win: destWin(1) }}>
          <NotionGlyph />
        </Tile>
        <Tile t={t} pos={GMAIL_OUT} accent="var(--flow-coral)" label="Gmail" phase={0.7} glow={destWin(2)} pop={DELIVER_START[2] + DELIVER_DUR} badge={{ kind: "check", win: destWin(2) }}>
          <GmailGlyph />
        </Tile>

        <Tile t={t} pos={CLERK} accent="var(--flow-magenta)" label="Clerk sign-in" phase={1.9} glow={clerkWin} badge={{ kind: "lock", win: clerkWin }}>
          <LockKey weight="duotone" className="text-(--flow-magenta)" />
        </Tile>
        <Tile t={t} pos={RAZORPAY} accent="var(--flow-coral)" label="Razorpay" phase={3.1} glow={razorWin} badge={{ kind: "lock", win: razorWin }}>
          <CreditCard weight="duotone" className="text-(--flow-coral)" />
        </Tile>

        <Hub t={t} />
        <Chip t={t} pos={[234, 176]} start={5.4} label="sum" />
        <Chip t={t} pos={[406, 176]} start={5.8} label="join" />
        <Chip t={t} pos={[320, 150]} start={6.2} label="average" />
        <DraftCard t={t} />
        <ApproveGate t={t} />
        <Cursor t={t} />
        <FlyCard t={t} to={SLACK} start={DELIVER_START[0]} />
        <FlyCard t={t} to={NOTION} start={DELIVER_START[1]} />
        <FlyCard t={t} to={GMAIL_OUT} start={DELIVER_START[2]} />
      </div>

      {reduced ? (
        <ol className="mx-auto mt-8 flex max-w-[34rem] list-decimal flex-col gap-1.5 pl-5 text-[16px] text-(--text-secondary)">
          {CAPTIONS.map((c) => (
            <li key={c.text}>{c.text}</li>
          ))}
        </ol>
      ) : (
        <div className="mx-auto mt-6 grid min-h-[3.4rem] max-w-[34rem] items-center">
          {CAPTIONS.map((c) => (
            <Caption key={c.text} t={t} text={c.text} win={c.win} />
          ))}
        </div>
      )}
    </div>
  );
}
