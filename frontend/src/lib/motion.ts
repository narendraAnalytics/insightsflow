import { useRef } from "react";
import { useScroll, useTransform, type Variants } from "framer-motion";

/** Shared scroll-reveal variants for below-the-fold sections — mirrors the
 *  hero's mount-in stagger but triggers via `whileInView` instead. */
export const sectionContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export const sectionItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
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
