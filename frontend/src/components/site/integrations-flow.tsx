"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowCounterClockwise, Check, CreditCard, Database, FilePdf, LockKey } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { GmailGlyph, GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { LogoVideo } from "@/components/site/logo-video";

/* ---------------------------------------------------------------------------
   Integrations motion graphic: a 16 s "video" in five shots that plays once when
   it scrolls into view and holds on the finished picture.
     1 Connect -> 2 Compute -> 3 Draft -> 4 Approve -> 5 Deliver
   Everything is a pure function of the scene clock `t`, so jumping to a step or
   replaying is just setting `t`. A camera (pan + zoom) glides between shots.
   `u` is a separate free-running clock for the idle drift so the end state stays alive.
   --------------------------------------------------------------------------- */

const END = 16;
const IDLE_LOOP = 15; // drift (7.5 s) and breathing (5 s) both divide this
const STAY = 99; // "never fades out" end of a window
const W = 640;
const H = 520;

type Pt = readonly [number, number];
const HUB: Pt = [320, 255];
const GATE: Pt = [482, 255];
const CARD_WAIT: Pt = [408, 255];

const SHEETS: Pt = [105, 105];
const GMAIL_IN: Pt = [62, 258];
const DOCS: Pt = [120, 396];
const NEON: Pt = [268, 454];
const SLACK: Pt = [545, 98];
const NOTION: Pt = [588, 255];
const GMAIL_OUT: Pt = [528, 405];
const CLERK: Pt = [300, 46];
const RAZORPAY: Pt = [412, 462];

/* ---- tiny timeline maths ------------------------------------------------- */
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const smooth = (x: number) => x * x * (3 - 2 * x);
/** 0 -> 1 between a..b, holds, 1 -> 0 between c..d. */
const trap = (x: number, a: number, b: number, c: number, d: number) => ramp(x, a, b) - ramp(x, c, d);
const round = (v: number) => Math.round(v * 1000) / 1000; // Node and browser sin/cos differ in the last digits
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
const TAU = Math.PI * 2;

type Win = [number, number, number, number];

function useT(t: MotionValue<number>, fn: (time: number) => number) {
  return useTransform(t, (time) => round(fn(time)));
}

/* ---- the five steps ------------------------------------------------------ */
const STEPS = [
  { name: "Connect", at: 0 },
  { name: "Compute", at: 4.2 },
  { name: "Draft", at: 7.2 },
  { name: "Approve", at: 9.2 },
  { name: "Deliver", at: 11.4 },
] as const;
const stepOf = (time: number) => STEPS.reduce((acc, s, i) => (time >= s.at ? i : acc), 0);

const CAPTIONS: { text: string; win: [number, number] }[] = [
  { text: "Connect the tools you already use.", win: [0, 4.2] },
  { text: "Every number is computed by code, not guessed.", win: [4.2, 7.2] },
  { text: "It drafts the report for you.", win: [7.2, 9.2] },
  { text: "Nothing goes out until you say yes.", win: [9.2, 11.4] },
  { text: "Then it reaches your team.", win: [11.4, 14.4] },
  { text: "Sign-in by Clerk. Secure payments by Razorpay.", win: [14.4, STAY] },
];

/* ---- timeline constants -------------------------------------------------- */
const SOURCE_START = [0.8, 1.25, 1.7, 2.15]; // sheets, gmail, documents, database
const PARTICLES_PER_SOURCE = 4;
const PARTICLE_DUR = 0.95;
const particleStart = (src: number, j: number) => SOURCE_START[src] + 0.15 + j * 0.25;
const ARRIVALS = SOURCE_START.flatMap((_, s) =>
  Array.from({ length: PARTICLES_PER_SOURCE }, (_, j) => particleStart(s, j) + PARTICLE_DUR)
);
const DELIVER_START = [11.4, 11.55, 11.7]; // slack, notion, gmail
const DELIVER_DUR = 1.0;

/* ---- camera: pan + zoom between shots ----------------------------------- */
const SHOTS: { at: number; cx: number; cy: number; z: number }[] = [
  { at: 0, cx: 320, cy: 260, z: 1 },
  { at: 0.6, cx: 320, cy: 260, z: 1 },
  { at: 1.5, cx: 280, cy: 268, z: 1.15 }, // connect
  { at: 3.9, cx: 285, cy: 266, z: 1.2 },
  { at: 4.9, cx: 320, cy: 242, z: 1.7 }, // compute
  { at: 7.0, cx: 325, cy: 245, z: 1.8 },
  { at: 8.0, cx: 400, cy: 255, z: 1.5 }, // draft
  { at: 9.3, cx: 405, cy: 258, z: 1.55 },
  { at: 10.0, cx: 460, cy: 265, z: 1.8 }, // approve
  { at: 11.2, cx: 462, cy: 264, z: 1.8 },
  { at: 12.3, cx: 345, cy: 262, z: 1.1 }, // deliver
  { at: 14.2, cx: 345, cy: 262, z: 1.1 },
  { at: 15.3, cx: 320, cy: 260, z: 1 }, // final wide
  { at: END, cx: 320, cy: 260, z: 1 },
];
function camera(time: number) {
  let i = SHOTS.length - 2;
  for (let k = 0; k < SHOTS.length - 1; k++) {
    if (time < SHOTS[k + 1].at) {
      i = k;
      break;
    }
  }
  const a = SHOTS[i];
  const b = SHOTS[i + 1];
  const u = smooth(ramp(time, a.at, b.at));
  const z = a.z + (b.z - a.z) * u;
  const cx = a.cx + (b.cx - a.cx) * u;
  const cy = a.cy + (b.cy - a.cy) * u;
  // keep the view inside the scene: the picture never shows an empty edge
  const x = Math.min(Math.max(cx, W / (2 * z)), W - W / (2 * z));
  const y = Math.min(Math.max(cy, H / (2 * z)), H - H / (2 * z));
  return `translate(${(50 - (x / W) * 100 * z).toFixed(3)}%, ${(50 - (y / H) * 100 * z).toFixed(3)}%) scale(${z.toFixed(4)})`;
}

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
function Spoke({ t, a, b, win, dashed }: { t: MotionValue<number>; a: Pt; b: Pt; win?: Win; dashed?: boolean }) {
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
  const haloOpacity = useTransform(opacity, (o) => round(o * 0.25));
  return (
    <>
      <motion.circle cx={cx} cy={cy} r={halo} fill={color} style={{ opacity: haloOpacity }} />
      <motion.circle cx={cx} cy={cy} r={r} fill={color} style={{ opacity }} />
    </>
  );
}

function Rings({ t }: { t: MotionValue<number> }) {
  const opacity = useT(t, (time) => 0.5 + 0.35 * trap(time, 4.2, 4.8, 6.8, 7.4));
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
  const offset = useT(t, (time) => ARC_C * (1 - easeOut(ramp(time, 4.4, 6.4))));
  const opacity = useT(t, (time) => trap(time, 4.4, 4.65, 6.5, 7.0));
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
  u,
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
  u: MotionValue<number>;
  pos: Pt;
  accent: string;
  label: string;
  children: ReactNode;
  phase: number;
  glow?: Win;
  pop?: number;
  badge?: { kind: "check" | "lock"; win: Win };
}) {
  const drift = useT(u, (idle) => Math.sin((idle / 7.5) * TAU + phase) * 4);
  const lift = useT(t, (time) => (glow ? -6 * trap(time, ...glow) : 0));
  const y = useTransform([drift, lift], ([d, l]: number[]) => round(d + l));
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
        <span className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap text-(--text-muted) sm:text-[11px]">
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
    const a = easeOut(ramp(time, 7.4, 8.6));
    const b = easeOut(ramp(time, 10.7, 11.2));
    return HUB[0] + (CARD_WAIT[0] - HUB[0]) * a + (GATE[0] - CARD_WAIT[0]) * b;
  });
  const opacity = useT(t, (time) => ramp(time, 7.3, 7.7) - ramp(time, 11.4, 11.45));
  const bob = useT(t, (time) => Math.sin(time * 4) * 1.5 * trap(time, 8.6, 8.8, 10.5, 10.7));
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
  const visible = useT(t, (time) => 0.55 + 0.45 * ramp(time, 7.3, 7.7));
  const approved = useT(t, (time) => ramp(time, 10.3, 10.45));
  const wait = useT(t, (time) => trap(time, 7.6, 8.0, 10.3, 10.5) * (0.6 + 0.4 * Math.sin(time * 7.5)));
  const scale = useT(t, (time) => 1 - 0.06 * trap(time, 10.05, 10.15, 10.2, 10.3));
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
  const lx = useT(t, (time) => 588 + (492 - 588) * easeOut(ramp(time, 9.4, 10.0)));
  const ly = useT(t, (time) => 352 + (266 - 352) * easeOut(ramp(time, 9.4, 10.0)));
  const left = useTransform(lx, (v) => pct(v, W));
  const top = useTransform(ly, (v) => pct(v, H));
  const opacity = useT(t, (time) => trap(time, 9.3, 9.6, 10.4, 10.7));
  const scale = useT(t, (time) => 1 - 0.28 * trap(time, 10.05, 10.15, 10.2, 10.3));
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

function Hub({ t, u }: { t: MotionValue<number>; u: MotionValue<number> }) {
  const breathe = useT(u, (idle) => 0.03 * Math.sin((idle / 5) * TAU));
  const bump = useT(t, (time) => {
    let s = 0;
    for (const a of ARRIVALS) {
      const dt = time - a;
      if (dt >= 0 && dt < 0.3) s += 0.02 * Math.sin((Math.PI * dt) / 0.3);
    }
    return s;
  });
  const scale = useTransform([breathe, bump], ([b, p]: number[]) => round(1 + b + p));
  const glow = useT(t, (time) => 0.25 + 0.5 * trap(time, 0.8, 1.3, 4.1, 4.7) + 0.4 * trap(time, 4.4, 4.8, 6.6, 7.1));
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
  const y = useT(t, (time) => 10 * (1 - ramp(time, win[0], win[0] + 0.5)) - 8 * ramp(time, win[1] - 0.4, win[1]));
  return (
    <motion.p
      aria-hidden="true"
      style={{ opacity, y }}
      className="font-display col-start-1 row-start-1 text-center text-[clamp(1.4rem,2.8vw,2rem)] leading-tight text-(--flow-ink)"
    >
      {text}
    </motion.p>
  );
}

function StepDot({ t, index, active, onSelect }: { t: MotionValue<number>; index: number; active: boolean; onSelect: () => void }) {
  const end = index < STEPS.length - 1 ? STEPS[index + 1].at : END;
  const fill = useT(t, (time) => ramp(time, STEPS[index].at, end));
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Step ${index + 1}: ${STEPS[index].name}`}
      aria-current={active ? "step" : undefined}
      className="group flex min-w-0 flex-1 flex-col gap-2 text-left"
    >
      <span className="relative block h-1.5 overflow-hidden rounded-full bg-(--flow-ink)/10 transition-[height] group-hover:h-2">
        <motion.span style={{ scaleX: fill }} className="bg-sunrise absolute inset-0 origin-left" />
      </span>
      <span
        className={cn(
          "truncate text-[12.5px] font-semibold transition-colors sm:text-[13.5px]",
          active ? "text-(--flow-ink)" : "text-(--text-muted) group-hover:text-(--flow-ink)"
        )}
      >
        {index + 1}
        <span className="hidden sm:inline"> {STEPS[index].name}</span>
      </span>
    </button>
  );
}

/* ---- the scene ----------------------------------------------------------- */
export function IntegrationsFlow() {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const t = useMotionValue(0); // scene time, 0..END, plays once
  const u = useMotionValue(0); // free-running idle clock
  const clock = useRef({ time: 0, idle: 0, playing: false });
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  // reduced motion: show the finished picture, no playback
  useEffect(() => {
    if (!reduced) return;
    t.set(END);
    setStep(STEPS.length - 1);
    setDone(true);
  }, [reduced, t]);

  // autoplay once, the first time it is mostly on screen
  const started = useRef(false);
  useEffect(() => {
    if (reduced || !inView || started.current) return;
    started.current = true;
    clock.current.playing = true;
  }, [inView, reduced]);

  useAnimationFrame((_, delta) => {
    if (reduced || !inView) return;
    const c = clock.current;
    const dt = Math.min(delta, 100) / 1000;
    c.idle = (c.idle + dt) % IDLE_LOOP;
    u.set(c.idle);
    if (!c.playing) return;
    c.time = Math.min(END, c.time + dt);
    t.set(c.time);
    if (c.time >= END) {
      c.playing = false;
      setDone(true);
    }
  });

  useMotionValueEvent(t, "change", (v) => setStep((s) => (stepOf(v) === s ? s : stepOf(v))));

  const seek = (i: number) => {
    started.current = true;
    clock.current.time = STEPS[i].at;
    clock.current.playing = true;
    t.set(STEPS[i].at);
    setDone(false);
  };

  const cameraTransform = useTransform(t, camera);

  const dest = (i: number): Win => [DELIVER_START[i] + DELIVER_DUR, DELIVER_START[i] + DELIVER_DUR + 0.35, STAY, STAY + 1];
  const clerkWin: Win = [14.4, 14.8, STAY, STAY + 1];
  const razorWin: Win = [14.8, 15.2, STAY, STAY + 1];
  const sourceWin = (i: number): Win => [SOURCE_START[i], SOURCE_START[i] + 0.4, SOURCE_START[i] + 1.9, SOURCE_START[i] + 2.5];

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
        aria-label="Animated walkthrough: data from Google Sheets, Gmail, documents and your database flows into InsightFlow, which computes the answers with code, drafts a report, waits for your approval, then delivers it to Slack, Notion and Gmail."
        className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[28px] border border-(--border-subtle) bg-(--flow-shell)/45 shadow-(--shadow-md)"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <motion.div className="absolute inset-0" style={{ transform: cameraTransform, transformOrigin: "0 0" }}>
          <div aria-hidden="true" className="absolute inset-[4%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--flow-peach)_75%,transparent)_0%,color-mix(in_oklab,var(--flow-mint)_30%,transparent)_60%,transparent_74%)] blur-xl" />

          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden="true">
            <path
              d={`M${HUB[0] - 70} ${HUB[1]} V${HUB[1] - 70} a44 44 0 0 1 44-44 h52 a44 44 0 0 1 44 44 V${HUB[1]} Z`}
              style={{ fill: "color-mix(in oklab, var(--flow-pink) 38%, transparent)" }}
            />
            <Rings t={t} />
            {sources.map((s, i) => (
              <Spoke key={i} t={t} a={s.pos} b={HUB} win={[SOURCE_START[i], SOURCE_START[i] + 0.4, SOURCE_START[i] + 2.2, SOURCE_START[i] + 2.8]} />
            ))}
            <Spoke t={t} a={HUB} b={GATE} win={[7.3, 7.7, STAY, STAY + 1]} />
            <Spoke t={t} a={GATE} b={SLACK} win={[DELIVER_START[0], DELIVER_START[0] + 0.4, STAY, STAY + 1]} />
            <Spoke t={t} a={GATE} b={NOTION} win={[DELIVER_START[1], DELIVER_START[1] + 0.4, STAY, STAY + 1]} />
            <Spoke t={t} a={GATE} b={GMAIL_OUT} win={[DELIVER_START[2], DELIVER_START[2] + 0.4, STAY, STAY + 1]} />
            <Spoke t={t} a={HUB} b={CLERK} dashed win={clerkWin} />
            <Spoke t={t} a={HUB} b={RAZORPAY} dashed win={razorWin} />
            <WorkArc t={t} />
            {sources.map((s, si) =>
              Array.from({ length: PARTICLES_PER_SOURCE }, (_, j) => (
                <Particle key={`${si}-${j}`} t={t} from={s.pos} to={HUB} start={particleStart(si, j)} color={s.color} />
              ))
            )}
          </svg>

          <Tile t={t} u={u} pos={SHEETS} accent="var(--flow-mint)" label="Google Sheets" phase={0} glow={sourceWin(0)}>
            <GoogleSheetsGlyph />
          </Tile>
          <Tile t={t} u={u} pos={GMAIL_IN} accent="var(--flow-coral)" label="Gmail" phase={1.2} glow={sourceWin(1)}>
            <GmailGlyph />
          </Tile>
          <Tile t={t} u={u} pos={DOCS} accent="var(--flow-amber)" label="Documents" phase={2.4} glow={sourceWin(2)}>
            <FilePdf weight="duotone" className="text-(--flow-coral)" />
          </Tile>
          <Tile t={t} u={u} pos={NEON} accent="var(--flow-pink)" label="Your data" phase={3.6} glow={sourceWin(3)}>
            <Database weight="duotone" className="text-(--flow-magenta)" />
          </Tile>

          <Tile t={t} u={u} pos={SLACK} accent="var(--flow-pink)" label="Slack" phase={4.8} glow={dest(0)} pop={DELIVER_START[0] + DELIVER_DUR} badge={{ kind: "check", win: dest(0) }}>
            <SlackGlyph />
          </Tile>
          <Tile t={t} u={u} pos={NOTION} accent="var(--flow-amber)" label="Notion" phase={6} glow={dest(1)} pop={DELIVER_START[1] + DELIVER_DUR} badge={{ kind: "check", win: dest(1) }}>
            <NotionGlyph />
          </Tile>
          <Tile t={t} u={u} pos={GMAIL_OUT} accent="var(--flow-coral)" label="Gmail" phase={0.7} glow={dest(2)} pop={DELIVER_START[2] + DELIVER_DUR} badge={{ kind: "check", win: dest(2) }}>
            <GmailGlyph />
          </Tile>

          <Tile t={t} u={u} pos={CLERK} accent="var(--flow-magenta)" label="Clerk sign-in" phase={1.9} glow={clerkWin} badge={{ kind: "lock", win: clerkWin }}>
            <LockKey weight="duotone" className="text-(--flow-magenta)" />
          </Tile>
          <Tile t={t} u={u} pos={RAZORPAY} accent="var(--flow-coral)" label="Razorpay" phase={3.1} glow={razorWin} badge={{ kind: "lock", win: razorWin }}>
            <CreditCard weight="duotone" className="text-(--flow-coral)" />
          </Tile>

          <Hub t={t} u={u} />
          <Chip t={t} pos={[234, 176]} start={4.8} label="sum" />
          <Chip t={t} pos={[406, 176]} start={5.3} label="join" />
          <Chip t={t} pos={[320, 150]} start={5.8} label="average" />
          <DraftCard t={t} />
          <ApproveGate t={t} />
          <Cursor t={t} />
          <FlyCard t={t} to={SLACK} start={DELIVER_START[0]} />
          <FlyCard t={t} to={NOTION} start={DELIVER_START[1]} />
          <FlyCard t={t} to={GMAIL_OUT} start={DELIVER_START[2]} />
        </motion.div>
      </div>

      {reduced ? (
        <ol className="mx-auto mt-8 flex max-w-[34rem] list-decimal flex-col gap-1.5 pl-5 text-[16px] text-(--text-secondary)">
          {CAPTIONS.map((c) => (
            <li key={c.text}>{c.text}</li>
          ))}
        </ol>
      ) : (
        <>
          <div className="mx-auto mt-6 grid min-h-[4.2rem] max-w-[34rem] items-center">
            {CAPTIONS.map((c) => (
              <Caption key={c.text} t={t} text={c.text} win={c.win} />
            ))}
          </div>
          <div className="mx-auto mt-4 flex max-w-[640px] items-start gap-2 sm:gap-3">
            {STEPS.map((_, i) => (
              <StepDot key={i} t={t} index={i} active={i === step} onSelect={() => seek(i)} />
            ))}
            <button
              type="button"
              onClick={() => seek(0)}
              aria-label="Replay"
              tabIndex={done ? 0 : -1}
              className={cn(
                "-mt-2 flex size-9 shrink-0 items-center justify-center rounded-full border border-(--border-strong) bg-(--flow-shell)/80 text-(--flow-ink) transition-[opacity,transform,background-color] duration-300 hover:bg-(--flow-shell) active:scale-95",
                done ? "opacity-100" : "pointer-events-none scale-90 opacity-0"
              )}
            >
              <ArrowCounterClockwise weight="bold" className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
