"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react";
import { EASE_OUT } from "@/lib/motion";

const INTRO_VIDEO =
  "https://res.cloudinary.com/dkqbzwicr/video/upload/v1791178080/introvideo_f8pzen.webm";

const SEEN_KEY = "insightflow:intro-seen";

/**
 * Shown once per browser-tab session (sessionStorage), not on every load.
 * Full-screen intro that sits over the landing page: the video loops silently until the
 * visitor clicks Enter (or presses Enter), then it fades away and the page underneath is
 * revealed. Rendered open on the server so the landing page never flashes before it.
 */
export function IntroGate() {
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotion();

  const enter = useCallback(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked: the intro just shows again next load */
    }
    setOpen(false);
  }, []);

  // Once per session: skip straight past the intro if this tab has already entered.
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) setOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  // Freeze the page behind the intro (and park it at the top) while it is showing.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") enter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, enter]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="intro"
          data-lenis-prevent
          role="dialog"
          aria-label="InsightFlow introduction"
          className="fixed inset-0 z-[100] bg-flow-ink"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 1.04 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={INTRO_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          />
          {/* Soft floor so the button reads over any frame. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/60 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
            <motion.button
              type="button"
              onClick={enter}
              autoFocus
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.7, ease: EASE_OUT }}
              whileHover={reduce ? undefined : { scale: 1.04 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className="group inline-flex items-center gap-2.5 rounded-full border border-white/30 bg-gradient-to-r from-flow-coral via-flow-magenta to-flow-magenta-700 px-10 py-4 text-lg font-bold tracking-wide text-white shadow-[0_0_0_6px_rgba(255,255,255,0.12),0_12px_48px_-6px_oklch(0.62_0.21_340/0.75)] [text-shadow:0_1px_8px_rgba(0,0,0,0.35)] transition-[filter,box-shadow] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Enter
              <ArrowRight
                weight="bold"
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </motion.button>
            <span className="text-xs text-white/70">or press Enter</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
