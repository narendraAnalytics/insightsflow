"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Sparkle } from "@phosphor-icons/react";

const actions = [
  {
    label: "New Project",
    hint: "Start fresh",
    icon: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790426376/projecticon_ebiw8k.png",
    accent: "var(--flow-coral)",
    href: null,
  },
  {
    label: "Connect App",
    hint: "Link your tools",
    icon: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790427217/coneect_app_hei5qw.png",
    accent: "var(--flow-lavender)",
    href: "/dashboard/integrations",
  },
  {
    label: "Upload Document",
    hint: "Add a file",
    icon: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790427712/DocumentUpload_lslobk.png",
    accent: "var(--flow-cyan)",
    href: null,
  },
  {
    label: "Ask AI",
    hint: "Chat with your data",
    icon: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790427868/askai_mnmri2.png",
    accent: "var(--flow-magenta)",
    href: "/dashboard/ai-insights",
  },
];

type Action = (typeof actions)[number];

const tileClass =
  "group relative isolate flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl px-2 pb-3.5 pt-3 text-center outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-(--flow-magenta)";

function Tile({ action, index, onSoon }: { action: Action; index: number; onSoon: (label: string) => void }) {
  const ref = useRef<HTMLElement | null>(null);

  // Pointer position goes straight to CSS vars — no re-render per mouse move.
  const track = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const style = {
    backgroundColor: `color-mix(in oklab, ${action.accent} 16%, var(--flow-cream))`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${action.accent} 22%, transparent)`,
    ["--tile-accent" as string]: action.accent,
  } as React.CSSProperties;

  const inner = (
    <>
      {/* cursor-following glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(130px circle at var(--mx, 50%) var(--my, 40%), color-mix(in oklab, ${action.accent} 38%, transparent), transparent 70%)`,
        }}
      />
      {/* soft accent halo behind the icon */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-2 -z-10 size-16 -translate-x-1/2 rounded-full blur-2xl animate-pulse-glow"
        style={{ backgroundColor: `color-mix(in oklab, ${action.accent} 45%, transparent)` }}
      />
      {/* one-shot shine sweep on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 -z-10 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:animate-[qa-shine_0.9s_ease-out]"
      />
      <ArrowUpRight
        weight="bold"
        className="absolute right-2.5 top-2.5 size-3.5 -translate-x-1 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
        style={{ color: action.accent }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={action.icon}
        alt=""
        width={56}
        height={56}
        loading="lazy"
        draggable={false}
        className="size-14 object-contain drop-shadow-[0_8px_10px_rgba(120,40,80,0.22)] animate-float-slow transition-transform duration-300 group-hover:scale-115 group-hover:-rotate-6"
        style={{ animationDelay: `${index * -1.4}s` }}
      />
      <span className="mt-0.5 text-[12.5px] font-semibold leading-tight text-(--flow-ink)">{action.label}</span>
      <span className="text-[10.5px] leading-none text-(--flow-ink)/55">{action.hint}</span>
    </>
  );

  const motionProps = {
    initial: { opacity: 0, y: 14, scale: 0.94 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay: 0.1 + index * 0.08, type: "spring" as const, stiffness: 260, damping: 22 },
  };

  return action.href ? (
    <motion.a
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={action.href}
      onPointerMove={track}
      className={tileClass}
      style={style}
      {...motionProps}
    >
      {inner}
    </motion.a>
  ) : (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={() => onSoon(action.label)}
      onPointerMove={track}
      className={tileClass}
      style={style}
      {...motionProps}
    >
      {inner}
    </motion.button>
  );
}

export function QuickActions() {
  const [toast, setToast] = useState<string | null>(null);

  const handleSoon = (label: string) => {
    setToast(`${label} — coming soon`);
    window.setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="glass-card relative flex flex-col overflow-hidden rounded-2xl p-5 sm:p-6">
      {/* slow aurora backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 0% 0%, color-mix(in oklab, var(--flow-coral) 22%, transparent), transparent 70%), radial-gradient(55% 45% at 100% 10%, color-mix(in oklab, var(--flow-lavender) 26%, transparent), transparent 70%), radial-gradient(60% 50% at 0% 100%, color-mix(in oklab, var(--flow-cyan) 20%, transparent), transparent 70%), radial-gradient(55% 45% at 100% 100%, color-mix(in oklab, var(--flow-magenta) 18%, transparent), transparent 70%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 top-8 size-28 rounded-full bg-(--flow-pink)/40 blur-3xl animate-float-slow"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-8 bottom-6 size-28 rounded-full bg-(--flow-cyan)/30 blur-3xl animate-float-slower"
      />

      <h3 className="relative flex items-center gap-2 font-heading text-[15px] font-semibold text-(--flow-ink)">
        <Sparkle weight="fill" className="size-4 text-(--flow-magenta) animate-sparkle" />
        Quick Actions
      </h3>
      <div className="relative mt-4 grid grid-cols-2 gap-3">
        {actions.map((action, i) => (
          <Tile key={action.label} action={action} index={i} onSoon={handleSoon} />
        ))}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="glass-panel absolute inset-x-5 bottom-3 rounded-full px-4 py-2 text-center text-[12.5px] font-medium text-(--flow-ink)"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
