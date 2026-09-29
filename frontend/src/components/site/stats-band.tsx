"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

/** Facts about how the product works — no customer counts or invented metrics. */
const stats = [
  { value: 0, label: "numbers the language model works out by itself", note: "all maths runs in pandas" },
  { value: 5, label: "sheets or tabs you can ask about in one question", note: "joined for you when needed" },
  { value: 1, label: "person who signs off before anything is sent", note: "that person is you" },
];

function Stat({ value, label, note, index }: (typeof stats)[number] & { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [n, setN] = useState(value === 0 || reduced ? value : 0);

  useEffect(() => {
    if (!inView || reduced || value === 0) return;
    const c = animate(0, value, { duration: 1.2, ease: EASE_OUT, delay: index * 0.12, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, reduced, value, index]);

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay: index * 0.12 }}
      className="flex flex-col gap-4 border-t-2 border-(--flow-ink)/10 pt-6 sm:flex-row sm:items-end sm:gap-6 lg:flex-col lg:items-start lg:gap-3"
    >
      <span className="font-display tabular text-sunrise text-[clamp(6rem,14vw,11rem)] leading-[0.8]">{n}</span>
      <span>
        <span className="block max-w-[22ch] text-[19px] leading-snug font-semibold text-(--flow-ink)">{label}</span>
        <span className="mt-1 block text-[15px] text-(--text-muted)">{note}</span>
      </span>
    </motion.div>
  );
}

export function StatsBand() {
  return (
    <section aria-label="How InsightFlow works, in numbers" className="relative py-[clamp(4rem,8vw,7rem)]">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 sm:px-6 lg:grid-cols-3 lg:gap-12 lg:px-8">
        {stats.map((s, i) => (
          <Stat key={s.label} {...s} index={i} />
        ))}
      </div>
    </section>
  );
}
