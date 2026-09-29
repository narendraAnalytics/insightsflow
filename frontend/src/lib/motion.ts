import { useCallback, useRef } from "react";
import { useScroll, useTransform, type Variants } from "framer-motion";

/** The landing page's single easing curve for entrances (matches `--ease-out-expo`). */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Spring used for interactive (pointer-driven) motion on the landing page. */
export const SPRING = { type: "spring", stiffness: 160, damping: 22, mass: 0.6 } as const;

/** Shared scroll-reveal variants for below-the-fold sections — mirrors the
 *  hero's mount-in stagger but triggers via `whileInView` instead. */
export const sectionContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export const sectionItem: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: EASE_OUT } },
};

export const sectionViewport = { once: true, amount: 0.25 } as const;

/** Scroll-scrubbed parallax drift for a section's background blobs — moves the
 *  attached element between `range` as its section passes through the viewport. */
export function useParallaxY(range: [number, number] = [-40, 40]) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], range);
  return { ref, y };
}

/** Cursor-following glow: writes `--mx`/`--my` (percent) onto the element via a
 *  ref, no React state, so pointer moves never re-render. Pair with a layer using
 *  `radial-gradient(... at var(--mx, 50%) var(--my, 50%), ...)`. */
export function useCursorGlow<T extends HTMLElement>(disabled = false) {
  const ref = useRef<T>(null);
  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      const el = ref.current;
      if (disabled || !el || event.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      el.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    },
    [disabled]
  );
  return { ref, onPointerMove };
}
