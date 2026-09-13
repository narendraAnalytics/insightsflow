"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CaretDown, List, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { InsightFlowMark } from "@/components/site/brand-icons";

const primaryLinks = [
  { label: "Product", href: "#product" },
  { label: "Integrations", href: "#integrations" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const resourceLinks = [
  { label: "Guides", href: "/get-started" },
  { label: "Changelog", href: "/get-started" },
  { label: "Support", href: "/get-started" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel flex w-full max-w-6xl items-center justify-between gap-4 rounded-full px-4 py-2.5 sm:px-5"
      >
        <a href="#top" className="flex items-center gap-2.5">
          <InsightFlowMark className="h-9 w-9" />
          <span className="flex flex-col leading-none">
            <span className="text-[17px] font-semibold tracking-tight text-(--flow-ink)">InsightFlow</span>
            <span className="text-[10.5px] font-medium text-muted-foreground">Connect. Understand. Act.</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex">
          {primaryLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-(--flow-ink)/80 transition-colors hover:bg-white/50 hover:text-(--flow-ink)"
            >
              {link.label}
            </a>
          ))}
          <div
            className="relative"
            onMouseEnter={() => setResourcesOpen(true)}
            onMouseLeave={() => setResourcesOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium text-(--flow-ink)/80 transition-colors hover:bg-white/50 hover:text-(--flow-ink)"
              aria-expanded={resourcesOpen}
            >
              Resources
              <CaretDown weight="bold" className="size-3" />
            </button>
            <AnimatePresence>
              {resourcesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="glass-card absolute top-full left-1/2 mt-2 w-44 -translate-x-1/2 rounded-2xl p-1.5"
                >
                  {resourceLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="block rounded-xl px-3 py-2 text-sm font-medium text-(--flow-ink)/80 hover:bg-white/60 hover:text-(--flow-ink)"
                    >
                      {link.label}
                    </a>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href="/sign-in"
            className="rounded-full px-4 py-2 text-sm font-semibold text-(--flow-ink) transition-colors hover:bg-white/50"
          >
            Sign in
          </a>
          <a
            href="/get-started"
            className="bg-gradient-flow group inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-(--flow-cream) shadow-[0_8px_20px_-6px_rgba(224,90,143,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Get Started
            <ArrowRight weight="bold" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
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
            {[...primaryLinks, ...resourceLinks].map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-2.5 text-[15px] font-medium text-(--flow-ink)/85 hover:bg-white/50"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-1 flex flex-col gap-2 border-t border-white/60 pt-3">
              <a
                href="/sign-in"
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-2.5 text-center text-[15px] font-semibold text-(--flow-ink)"
              >
                Sign in
              </a>
              <a
                href="/get-started"
                onClick={() => setMobileOpen(false)}
                className="bg-gradient-flow inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-[15px] font-semibold text-(--flow-cream)"
              >
                Get Started
                <ArrowRight weight="bold" className="size-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
