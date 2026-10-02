"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import Lenis from "lenis";
import { ArrowDown, ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import { Show, SignUpButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { HeroCanvas } from "@/components/site/hero-canvas";
import { CHAPTERS, type Chapter } from "@/components/site/hero-chapters";
import { Magnetic, primaryButtonClass, secondaryButtonClass } from "@/components/site/primitives";

const worksWith = [
  { icon: GoogleSheetsGlyph, label: "Google Sheets", live: true },
  { icon: NotionGlyph, label: "Notion", live: true },
  { icon: SlackGlyph, label: "Slack", live: true },
];

const LAST = CHAPTERS.length - 1;

/* Words slide up out of a mask on enter and up again on exit; the parent staggers them. */
const block: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
};
const word: Variants = {
  hidden: { y: "108%" },
  show: { y: "0%", transition: { duration: 0.8, ease: EASE_OUT } },
  exit: { y: "-108%", transition: { duration: 0.35, ease: [0.5, 0, 0.9, 0.4] } },
};
const fade: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: EASE_OUT } },
  exit: { opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.25 } },
};

/** Smooth wheel scrolling, active only while the hero stage is on screen. */
function useStageLenis(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const lenisRef = useRef<Lenis | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let raf = 0;
    const start = () => {
      if (lenisRef.current) return;
      const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
      lenisRef.current = lenis;
      const loop = (time: number) => {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    io.observe(el);
    return () => {
      io.disconnect();
      stop();
    };
  }, [ref, enabled]);
  return lenisRef;
}

function HeroCtas({ displayName }: { displayName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Show when="signed-out">
        <Magnetic>
          <SignUpButton mode="redirect" forceRedirectUrl="/">
            <button type="button" className={cn(primaryButtonClass, "px-7 py-3.5 text-[16px]")}>
              Connect my business
              <ArrowRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </SignUpButton>
        </Magnetic>
      </Show>
      <Show when="signed-in">
        <Magnetic>
          <a href="/dashboard" className={cn(primaryButtonClass, "px-7 py-3.5 text-[16px]")}>
            Welcome back, {displayName}
            <ArrowUpRight weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </Magnetic>
      </Show>
      <a href="#how-it-works" className={cn(secondaryButtonClass, "px-6 py-3.5 text-[16px]")}>
        See how it works
        <ArrowDown weight="bold" className="size-4 transition-transform duration-200 group-hover:translate-y-0.5" />
      </a>
    </div>
  );
}

function ChapterCopy({ chapter, index, displayName }: { chapter: Chapter; index: number; displayName: string }) {
  const first = index === 0;
  const showCtas = first || index === LAST;
  return (
    <div className="pointer-events-auto relative max-w-[38rem]">
      <div
        aria-hidden="true"
        className="absolute -top-10 -left-16 -z-10 size-[26rem] rounded-full opacity-30 blur-[90px]"
        style={{ background: chapter.glow }}
      />
      {first && (
        <motion.p
          variants={fade}
          className="inline-flex items-center gap-2 rounded-full border border-(--border-subtle) bg-(--flow-shell)/70 py-1.5 pr-3.5 pl-1.5 text-[13px] font-semibold text-(--text-secondary) backdrop-blur-sm"
        >
          <span className="bg-sunrise rounded-full px-2 py-0.5 text-[11px] font-bold text-(--flow-shell)">New</span>
          An AI analyst for all your business data
        </motion.p>
      )}

      <motion.h2
        variants={block}
        aria-label={chapter.lines.map((l) => l.text).join(" ")}
        className={cn(
          "font-display text-(--flow-ink)",
          first ? "mt-5 text-[clamp(2.75rem,6.4vw,6rem)] leading-[0.94]" : "text-[clamp(2.5rem,5.4vw,5rem)] leading-[0.96]"
        )}
      >
        {chapter.lines.map((line, li) => (
          <span key={li} aria-hidden="true" className="block">
            {line.text.split(" ").map((w, wi, all) => (
              <span key={wi} className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
                <motion.span variants={word} className={cn("inline-block", line.sunrise && "text-sunrise")}>
                  {w}
                </motion.span>
                {wi < all.length - 1 && " "}
              </span>
            ))}
          </span>
        ))}
      </motion.h2>

      <motion.p variants={fade} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-(--text-secondary) sm:text-[18px]">
        {chapter.body}
      </motion.p>

      {chapter.chips && (
        <motion.ul variants={fade} className="mt-6 flex flex-wrap gap-2">
          {chapter.chips.map((chip) => (
            <li
              key={chip.label}
              className="inline-flex items-center gap-2 rounded-full border border-(--border-subtle) bg-(--flow-shell)/75 px-3.5 py-1.5 text-[13.5px] font-semibold text-(--flow-ink) shadow-(--shadow-sm) backdrop-blur-sm"
            >
              {chip.label}
              {chip.state && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    chip.state === "live" ? "bg-(--flow-mint)/45 text-(--flow-ink)" : "bg-(--flow-ink)/[0.06] text-(--text-muted)"
                  )}
                >
                  {chip.state === "live" ? "Live" : "Soon"}
                </span>
              )}
            </li>
          ))}
        </motion.ul>
      )}

      {showCtas && (
        <motion.div variants={fade} className="mt-8">
          <HeroCtas displayName={displayName} />
        </motion.div>
      )}

      {first && (
        <motion.div variants={fade} className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="text-[13px] font-medium text-(--text-muted)">Works with</span>
          {worksWith.map((app) => (
            <span key={app.label} className="inline-flex items-center gap-2 text-[14px] font-semibold text-(--flow-ink)">
              <app.icon className="size-5" />
              {app.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  app.live ? "bg-(--flow-mint)/45 text-(--flow-ink)" : "bg-(--flow-ink)/[0.06] text-(--text-muted)"
                )}
              >
                {app.live ? "Live" : "Soon"}
              </span>
            </span>
          ))}
        </motion.div>
      )}
    </div>
  );
}

const scrimClass =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,var(--flow-cream)_0%,color-mix(in_oklab,var(--flow-cream)_92%,transparent)_38%,transparent_66%)] lg:bg-[linear-gradient(95deg,color-mix(in_oklab,var(--flow-cream)_90%,transparent)_0%,color-mix(in_oklab,var(--flow-cream)_62%,transparent)_34%,transparent_62%)]";

export function HeroSection() {
  const reduced = useReducedMotion() ?? false;
  const { user } = useUser();
  const displayName = user?.username ?? user?.firstName ?? "there";

  const sectionRef = useRef<HTMLElement>(null);
  const lenisRef = useStageLenis(sectionRef, !reduced);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const frameProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4, restDelta: 0.0005 });

  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const i = Math.max(0, Math.min(LAST, Math.floor(v * CHAPTERS.length)));
    setActive((a) => (a === i ? a : i));
  });

  const hintOpacity = useTransform(scrollYProgress, [0, 0.04], [1, 0]);
  const wrapScale = useTransform(scrollYProgress, [0.93, 1], [1, 0.95]);
  const wrapRadius = useTransform(scrollYProgress, [0.93, 1], [0, 36]);

  const goTo = useCallback((i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const target = top + ((i + 0.5) / CHAPTERS.length) * (el.offsetHeight - window.innerHeight);
    if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.4 });
    else window.scrollTo({ top: target, behavior: "smooth" });
  }, [lenisRef]);

  /* Reduced motion: one still frame, every chapter stacked as ordinary content. */
  if (reduced) {
    return (
      <section id="top" className="lux-grain relative isolate overflow-hidden pt-28 pb-16 sm:pt-36">
        <HeroCanvas className="absolute inset-x-0 top-0 -z-20 h-full w-full" />
        <div aria-hidden="true" className={cn(scrimClass, "-z-10")} />
        <h1 className="sr-only">Ask your sheets. Approve the answer. Alert the team.</h1>
        <div className="relative z-[2] mx-auto flex max-w-[1240px] flex-col gap-20 px-4 sm:px-6 lg:px-8">
          {CHAPTERS.map((chapter, i) => (
            <motion.div key={chapter.name} initial="show" animate="show">
              <ChapterCopy chapter={chapter} index={i} displayName={displayName} />
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="top" ref={sectionRef} className="relative h-[420svh] lg:h-[560svh]">
      <h1 className="sr-only">Ask your sheets. Approve the answer. Alert the team.</h1>
      <div className="sticky top-0 h-svh overflow-hidden bg-(--flow-cream)">
        <motion.div
          style={{ scale: wrapScale, borderBottomLeftRadius: wrapRadius, borderBottomRightRadius: wrapRadius }}
          className="lux-grain absolute inset-0 isolate origin-bottom overflow-hidden"
        >
          <HeroCanvas progress={frameProgress} className="absolute inset-0 -z-20 h-full w-full" />
          <div aria-hidden="true" className={cn(scrimClass, "-z-10")} />

          {/* copy: one chapter at a time, swapped by scroll position */}
          <div className="absolute inset-0 z-[2]">
            <AnimatePresence>
              <motion.div
                key={active}
                initial="hidden"
                animate="show"
                exit="exit"
                className="pointer-events-none absolute inset-x-0 bottom-0 lg:inset-y-0 lg:flex lg:items-center"
              >
                <div className="mx-auto w-full max-w-[1240px] px-4 pb-14 sm:px-6 lg:px-8 lg:pt-20 lg:pb-0">
                  <ChapterCopy chapter={CHAPTERS[active]} index={active} displayName={displayName} />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* chapter rail */}
          <nav aria-label="Product tour" className="absolute top-1/2 right-3 z-[3] flex -translate-y-1/2 flex-col gap-1 sm:right-5">
            {CHAPTERS.map((chapter, i) => (
              <button
                key={chapter.name}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to ${chapter.name}`}
                aria-current={i === active ? "step" : undefined}
                className="group flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "block w-1.5 rounded-full transition-[height,background-color] duration-300",
                    i === active ? "bg-sunrise h-7" : "h-1.5 bg-(--flow-ink)/25 group-hover:bg-(--flow-ink)/50"
                  )}
                />
              </button>
            ))}
          </nav>

          <motion.div
            aria-hidden="true"
            style={{ opacity: hintOpacity }}
            className="pointer-events-none absolute bottom-6 left-1/2 z-[3] hidden -translate-x-1/2 flex-col items-center gap-2 text-[12px] font-semibold text-(--text-secondary) lg:flex"
          >
            Scroll
            <span className="relative h-9 w-px overflow-hidden bg-(--flow-ink)/15">
              <span className="animate-ping-soft absolute inset-x-0 top-0 h-3 bg-(--flow-magenta)" />
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
