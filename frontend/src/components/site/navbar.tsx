"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from "framer-motion";
import { ArrowRight, List, X } from "@phosphor-icons/react";
import { Show, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { LogoVideo } from "@/components/site/logo-video";
import { useBackendMe } from "@/hooks/use-backend-me";

const primaryLinks = [
  {
    label: "Product",
    id: "product",
    href: "#product",
    icon: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790157450/product_iwldx8.png",
    accent: "var(--flow-magenta)",
  },
  {
    label: "Integrations",
    id: "integrations",
    href: "#integrations",
    icon: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790157451/integrations_c8ukub.png",
    accent: "var(--flow-cyan)",
  },
  {
    label: "How It Works",
    id: "how-it-works",
    href: "#how-it-works",
    icon: "https://res.cloudinary.com/dkqbzwicr/image/upload/v1790157450/howitworks_kluwvt.png",
    accent: "var(--flow-coral)",
  },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Tracks which primary section is currently centered in the viewport, for
 *  scroll-based active-link highlighting (vs. hover-only). */
function useActiveSection() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const targets = primaryLinks
      .map((link) => document.getElementById(link.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return activeId;
}

function NavIcon({
  link,
  isActive,
  reducedMotion,
}: {
  link: (typeof primaryLinks)[number];
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const pullX = useSpring(0, { stiffness: 300, damping: 18, mass: 0.4 });
  const pullY = useSpring(0, { stiffness: 300, damping: 18, mass: 0.4 });

  const handleMouseMove = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (reducedMotion || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    pullX.set(((event.clientX - cx) / (rect.width / 2)) * 4);
    pullY.set(((event.clientY - cy) / (rect.height / 2)) * 4);
  };

  const handleMouseLeave = () => {
    pullX.set(0);
    pullY.set(0);
  };

  return (
    <a
      href={link.href}
      title={link.label}
      aria-label={link.label}
      aria-current={isActive ? "true" : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col items-center"
    >
      <motion.span ref={wrapRef} style={{ x: pullX, y: pullY }} className="relative flex size-11 items-center justify-center">
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              "conic-gradient(from 0deg, var(--flow-magenta), var(--flow-lavender), var(--flow-cyan), var(--flow-coral), var(--flow-magenta))",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
          }}
          animate={reducedMotion ? undefined : { rotate: 360 }}
          transition={{ duration: isActive ? 2.2 : 5, ease: "linear", repeat: Infinity }}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 -z-10 rounded-full blur-lg transition-opacity duration-300",
            isActive ? "opacity-70" : "opacity-0 group-hover:opacity-70"
          )}
          style={{ backgroundImage: `radial-gradient(circle, ${link.accent}, transparent 70%)` }}
        />
        <span className="relative block size-8 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-105">
          <img src={link.icon} alt="" aria-hidden="true" className="size-full object-cover" />
        </span>
      </motion.span>
      <span className="glass-card pointer-events-none absolute top-[calc(100%+0.4rem)] left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap text-(--flow-ink) opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {link.label}
      </span>
    </a>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reducedMotion = useReducedMotion();
  const activeId = useActiveSection();
  const { user } = useUser();
  const displayName = user?.username ?? user?.firstName ?? "there";
  const { me, error: backendError } = useBackendMe();

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 40);
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "glass-panel flex w-full max-w-6xl items-center justify-between gap-4 rounded-full transition-[padding,box-shadow] duration-300",
          scrolled ? "px-3.5 py-1.5 shadow-[0_16px_36px_-20px_rgba(224,90,143,0.35)] sm:px-4" : "px-4 py-2.5 sm:px-5"
        )}
      >
        <a href="#top" className="flex items-center gap-2.5">
          <LogoVideo className="h-9 w-9" />
          <span className="flex flex-col leading-none">
            <span className="text-[17px] font-semibold tracking-tight text-(--flow-ink)">InsightFlow</span>
            <span className="text-[10.5px] font-medium text-muted-foreground">Connect. Understand. Act.</span>
          </span>
        </a>

        <nav className="hidden items-center gap-6 lg:flex">
          {primaryLinks.map((link) => (
            <NavIcon key={link.label} link={link} isActive={activeId === link.id} reducedMotion={reducedMotion} />
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Show when="signed-out">
            <SignInButton mode="redirect">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold text-(--flow-ink) transition-colors hover:bg-white/50"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="redirect" forceRedirectUrl="/">
              <button
                type="button"
                className="bg-gradient-flow group inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-(--flow-cream) shadow-[0_8px_20px_-6px_rgba(224,90,143,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                Get Started
                <ArrowRight weight="bold" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <span className="flex items-center gap-1.5 px-2 text-sm font-semibold text-(--flow-ink)">
              Welcome, <span className="text-gradient-flow">{displayName}</span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  me ? "bg-(--flow-cyan)" : backendError ? "bg-(--flow-coral)" : "bg-(--flow-ink)/20"
                )}
                title={
                  me
                    ? `Backend connected (user_id: ${me.user_id})`
                    : backendError
                      ? `Backend call failed: ${backendError}`
                      : "Connecting to backend…"
                }
              />
            </span>
            <UserButton />
          </Show>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex size-10 items-center justify-center rounded-full text-(--flow-ink) hover:bg-white/50 lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X weight="bold" className="size-5" /> : <List weight="bold" className="size-5" />}
        </button>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "glass-card absolute top-[calc(100%+0.5rem)] left-4 right-4 flex flex-col gap-1 rounded-3xl p-3 lg:hidden"
            )}
          >
            {primaryLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[15px] font-medium text-(--flow-ink)/85 hover:bg-white/50"
              >
                <img src={link.icon} alt="" aria-hidden="true" className="size-6 object-contain" />
                {link.label}
              </a>
            ))}
            <div className="mt-1 flex flex-col gap-2 border-t border-white/60 pt-3">
              <Show when="signed-out">
                <SignInButton mode="redirect">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl px-4 py-2.5 text-center text-[15px] font-semibold text-(--flow-ink)"
                  >
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="redirect" forceRedirectUrl="/">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="bg-gradient-flow inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-[15px] font-semibold text-(--flow-cream)"
                  >
                    Get Started
                    <ArrowRight weight="bold" className="size-4" />
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <span className="text-center text-[15px] font-semibold text-(--flow-ink)">
                  Welcome, <span className="text-gradient-flow">{displayName}</span>
                </span>
              </Show>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
