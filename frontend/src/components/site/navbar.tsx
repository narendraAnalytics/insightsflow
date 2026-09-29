"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { ArrowRight, ArrowUpRight, List, X } from "@phosphor-icons/react";
import { Show, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { LogoVideo } from "@/components/site/logo-video";
import { Magnetic, primaryButtonClass } from "@/components/site/primitives";
import { useBackendMe } from "@/hooks/use-backend-me";

const links = [
  { label: "Product", id: "product" },
  { label: "How it works", id: "how-it-works" },
  { label: "Integrations", id: "integrations" },
  { label: "Use cases", id: "use-cases" },
];

/** Which section is centered in the viewport, for scroll-based active-link highlighting. */
function useActiveSection() {
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    const targets = links
      .map((link) => document.getElementById(link.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return activeId;
}

function BackendDot() {
  const { me, error } = useBackendMe();
  return (
    <span
      className={cn(
        "size-1.5 rounded-full",
        me ? "bg-(--flow-mint)" : error ? "bg-(--flow-coral)" : "bg-(--flow-ink)/20"
      )}
      title={me ? `Backend connected (user_id: ${me.user_id})` : error ? `Backend call failed: ${error}` : "Connecting to backend…"}
    />
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const activeId = useActiveSection();
  const { user } = useUser();
  const displayName = user?.username ?? user?.firstName ?? "there";
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 48));

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const highlighted = hovered ?? activeId;

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-6 sm:pt-4">
      <motion.nav
        aria-label="Main"
        initial={reduced ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0, maxWidth: scrolled ? 860 : 1180 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className={cn(
          "relative flex w-full items-center justify-between gap-3 rounded-full border py-2 pr-2 pl-3 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500",
          scrolled
            ? "border-(--border-subtle) bg-(--flow-shell)/78 shadow-(--shadow-md) backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-(--flow-shell)/40 backdrop-blur-md"
        )}
      >
        <a href="#top" className="flex items-center gap-2.5 rounded-full pr-2" aria-label="InsightFlow home">
          <LogoVideo className="size-9" />
          <span className="font-display text-[21px] leading-none tracking-[-0.03em] text-(--flow-ink)">InsightFlow</span>
        </a>

        <ul className="hidden items-center lg:flex" onPointerLeave={() => setHovered(null)}>
          {links.map((link) => {
            const isOn = highlighted === link.id;
            return (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  onPointerEnter={() => setHovered(link.id)}
                  aria-current={activeId === link.id ? "true" : undefined}
                  className={cn(
                    "relative isolate block rounded-full px-4 py-2 text-[14px] font-semibold transition-colors duration-200",
                    isOn ? "text-(--flow-ink)" : "text-(--text-muted) hover:text-(--flow-ink)"
                  )}
                >
                  {isOn && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-(--flow-magenta-100) shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--flow-magenta)_18%,transparent)]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center gap-1.5 lg:flex">
          <Show when="signed-out">
            <SignInButton mode="redirect">
              <button
                type="button"
                className="min-h-10 rounded-full px-4 text-[14px] font-semibold text-(--flow-ink) transition-colors hover:bg-(--flow-magenta-100)"
              >
                Sign in
              </button>
            </SignInButton>
            <Magnetic strength={8}>
              <SignUpButton mode="redirect" forceRedirectUrl="/">
                <button type="button" className={cn(primaryButtonClass, "min-h-10 px-5 py-2 text-[14px]")}>
                  Start free
                  <ArrowRight weight="bold" className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </SignUpButton>
            </Magnetic>
          </Show>
          <Show when="signed-in">
            <span className="flex items-center gap-1.5 px-2 text-[14px] font-semibold text-(--flow-ink)">
              {displayName}
              <BackendDot />
            </span>
            <a href="/dashboard" className={cn(primaryButtonClass, "min-h-10 px-5 py-2 text-[14px]")}>
              Dashboard
              <ArrowUpRight weight="bold" className="size-3.5" />
            </a>
            <span className="pl-1">
              <UserButton />
            </span>
          </Show>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="relative z-10 flex size-11 items-center justify-center rounded-full bg-(--flow-magenta-100) text-(--flow-ink) lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
        >
          {mobileOpen ? <X weight="bold" className="size-5" /> : <List weight="bold" className="size-5" />}
        </button>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, clipPath: "circle(0% at 92% 4%)" }}
            animate={{ opacity: 1, clipPath: "circle(150% at 92% 4%)" }}
            exit={{ opacity: 0, clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: 0.55, ease: EASE_OUT }}
            className="lux-grain fixed inset-0 -z-10 flex flex-col justify-between overflow-hidden bg-(--flow-cream) px-6 pt-28 pb-10 lg:hidden"
          >
            <div aria-hidden="true" className="animate-aurora-a absolute -top-24 -right-24 size-80 rounded-full bg-(--flow-magenta)/30 blur-3xl" />
            <div aria-hidden="true" className="animate-aurora-b absolute bottom-10 -left-24 size-80 rounded-full bg-(--flow-amber)/35 blur-3xl" />
            <ul className="relative z-10 flex flex-col gap-1">
              {links.map((link, i) => (
                <motion.li
                  key={link.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.06, duration: 0.6, ease: EASE_OUT }}
                >
                  <a
                    href={`#${link.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="font-display flex items-baseline justify-between py-2 text-[44px] leading-none text-(--flow-ink)"
                  >
                    {link.label}
                    <ArrowUpRight weight="bold" className="size-6 text-(--flow-magenta)" />
                  </a>
                </motion.li>
              ))}
            </ul>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: EASE_OUT }}
              className="relative z-10 flex flex-col gap-3"
            >
              <Show when="signed-out">
                <SignUpButton mode="redirect" forceRedirectUrl="/">
                  <button type="button" onClick={() => setMobileOpen(false)} className={cn(primaryButtonClass, "w-full py-4 text-[16px]")}>
                    Start free
                    <ArrowRight weight="bold" className="size-4" />
                  </button>
                </SignUpButton>
                <SignInButton mode="redirect">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="min-h-12 rounded-full border border-(--border-strong) text-[16px] font-semibold text-(--flow-ink)"
                  >
                    Sign in
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <a href="/dashboard" className={cn(primaryButtonClass, "w-full py-4 text-[16px]")}>
                  Open your dashboard, {displayName}
                  <ArrowUpRight weight="bold" className="size-4" />
                </a>
              </Show>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
