"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";

type Line = { text: string; className?: string };

/**
 * Headline whose words slide up out of a clipping mask, line by line.
 * `trigger="mount"` plays on load (hero); `"view"` plays once when scrolled in.
 * The full text is exposed to assistive tech via aria-label; the animated
 * word spans are aria-hidden.
 */
export function RevealHeading({
  lines,
  as = "h2",
  className,
  trigger = "view",
  delay = 0,
}: {
  lines: Line[];
  as?: "h1" | "h2" | "h3";
  className?: string;
  trigger?: "mount" | "view";
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  const label = lines.map((l) => l.text).join(" ");
  const playProps =
    trigger === "mount"
      ? { initial: "hidden", animate: "show" }
      : { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.6 } };

  let wordIndex = 0;
  return (
    <Tag aria-label={label} className={className} {...(reduced ? {} : playProps)}>
      {lines.map((line, li) => (
        <span key={li} aria-hidden="true" className="block">
          {line.text.split(" ").map((word, wi) => {
            const i = wordIndex++;
            return (
              <span key={wi} className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
                <motion.span
                  className={cn("inline-block", line.className)}
                  variants={{
                    hidden: { y: "105%" },
                    show: { y: "0%", transition: { duration: 0.85, ease: EASE_OUT, delay: delay + i * 0.055 } },
                  }}
                >
                  {word}
                </motion.span>
                {wi < line.text.split(" ").length - 1 && " "}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}

/** Pulls its child a few pixels toward the pointer (mouse only). */
export function Magnetic({ children, strength = 10, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 18, mass: 0.5 });
  const y = useSpring(0, { stiffness: 220, damping: 18, mass: 0.5 });

  return (
    <motion.span
      ref={ref}
      style={{ x, y }}
      className={cn("inline-flex", className)}
      onPointerMove={(event) => {
        if (reduced || event.pointerType !== "mouse" || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        x.set(((event.clientX - rect.left) / rect.width - 0.5) * strength);
        y.set(((event.clientY - rect.top) / rect.height - 0.5) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/** Small uppercase-free section kicker with a colored dot — used sparingly. */
export function Kicker({ children, color = "var(--flow-magenta)" }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-(--text-secondary)">
      <span className="size-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 0 4px color-mix(in oklab, ${color} 22%, transparent)` }} />
      {children}
    </span>
  );
}

/** Primary pill button styling, shared by Clerk-wrapped buttons and plain links. */
export const primaryButtonClass =
  "lux-shine bg-sunrise group relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3 text-[15px] font-semibold text-(--flow-shell) shadow-[0_14px_30px_-12px_color-mix(in_oklab,var(--flow-magenta)_70%,transparent),inset_0_1px_0_color-mix(in_oklab,var(--flow-shell)_45%,transparent)] transition-[transform,box-shadow] duration-200 hover:shadow-[0_20px_40px_-14px_color-mix(in_oklab,var(--flow-magenta)_80%,transparent)] active:scale-[0.98]";

export const secondaryButtonClass =
  "group relative inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-(--border-strong) bg-(--flow-shell)/70 px-5 py-3 text-[15px] font-semibold text-(--flow-ink) backdrop-blur-sm transition-[background-color,border-color,transform] duration-200 hover:border-(--flow-magenta)/40 hover:bg-(--flow-shell) active:scale-[0.98]";
