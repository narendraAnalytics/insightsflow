"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { LogoVideo } from "@/components/site/logo-video";
import { Magnetic } from "@/components/site/primitives";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Only links that go somewhere real.
const columns = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#product" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Integrations", href: "#integrations" },
      { label: "Use cases", href: "#use-cases" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/sign-in" },
      { label: "Create an account", href: "/sign-up" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
];

const builtWith = ["Google Sheets", "Sarvam-105B", "LangGraph", "Neon Postgres"];

const WORDMARK = "InsightFlow";

type Status = "checking" | "online" | "unreachable";

/** Live API status from the backend's liveness probe. The free Render instance can
 *  take a while to wake, so a slow reply reads as "waking up", not as an outage. */
function useApiStatus() {
  const [status, setStatus] = useState<Status>("checking");
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    fetch(`${API_URL}/api/v1/healthz`, { signal: controller.signal, cache: "no-store" })
      .then((res) => setStatus(res.ok ? "online" : "unreachable"))
      .catch(() => setStatus("unreachable"))
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  return status;
}

function StatusPill() {
  const status = useApiStatus();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== "checking") return;
    const id = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(id);
  }, [status]);

  const label = status === "online" ? "API online" : status === "unreachable" ? "API unreachable" : slow ? "API waking up" : "Checking API";
  const dot = status === "online" ? "var(--flow-mint)" : status === "unreachable" ? "var(--flow-coral)" : "var(--flow-amber)";

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-(--border-subtle) bg-(--flow-shell)/80 px-3 py-1.5 text-[13px] font-semibold text-(--flow-ink)"
      role="status"
    >
      <span className="relative flex size-2">
        {status !== "unreachable" && (
          <span className="animate-ping-soft absolute inset-0 rounded-full" style={{ background: dot }} />
        )}
        <span className="relative size-2 rounded-full" style={{ background: dot }} />
      </span>
      {label}
    </span>
  );
}

/** Giant wordmark: rises into view as the footer scrolls in; each letter carries its
 *  own slice of the sunrise gradient so it can lift independently on hover. */
function Wordmark() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["45%", "0%"]);
  const letters = WORDMARK.split("");

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="overflow-hidden"
      style={{
        maskImage: "linear-gradient(to bottom, #000 30%, transparent 96%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 30%, transparent 96%)",
      }}
    >
      <motion.p
        style={{ y }}
        className="font-display flex justify-center text-[clamp(3.5rem,15.5vw,14rem)] leading-[0.8] select-none"
      >
        {letters.map((ch, i) => (
          <span
            key={i}
            className="inline-block pb-[0.08em] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[0.1em]"
            style={{
              backgroundImage: "var(--sunrise)",
              backgroundSize: `${letters.length * 100}% 100%`,
              backgroundPosition: `${(i / (letters.length - 1)) * 100}% 0`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {ch}
          </span>
        ))}
      </motion.p>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="px-3 pb-3 sm:px-6 sm:pb-6">
      <div
        className="lux-card lux-grain relative isolate mx-auto max-w-[1240px] overflow-hidden rounded-[36px] sm:rounded-[44px]"
        style={{ background: "linear-gradient(180deg, var(--flow-shell) 0%, var(--flow-peach) 100%)" }}
      >
        <div aria-hidden="true" className="absolute -top-32 -right-24 -z-10 size-[26rem] rounded-full bg-(--flow-pink)/50 blur-[100px]" />
        <div aria-hidden="true" className="absolute bottom-0 -left-24 -z-10 size-[24rem] rounded-full bg-(--flow-amber)/30 blur-[100px]" />

        <div className="relative z-[2] px-6 pt-12 sm:px-10 sm:pt-14 lg:px-14">
          {/* top: brand + live status + back to top */}
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <a href="#top" className="inline-flex items-center gap-2.5">
                <LogoVideo className="size-10" />
                <span className="font-display text-[26px] leading-none text-(--flow-ink)">InsightFlow</span>
              </a>
              <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-(--text-secondary)">
                An AI analyst for all your business data, with a{" "}
                <span className="font-editorial text-sunrise pr-[0.05em] text-[1.1em]">person in charge</span> of what gets sent.
              </p>
              <div className="mt-5">
                <StatusPill />
              </div>
            </div>
            <Magnetic strength={14}>
              <a
                href="#top"
                aria-label="Back to top"
                className="group bg-sunrise flex size-14 items-center justify-center rounded-full text-(--flow-shell) shadow-[0_14px_30px_-12px_color-mix(in_oklab,var(--flow-magenta)_70%,transparent)] transition-transform duration-200 active:scale-95"
              >
                <ArrowUp weight="bold" className="size-5 transition-transform duration-300 group-hover:-translate-y-1" />
              </a>
            </Magnetic>
          </div>

          {/* link columns */}
          <div className="mt-12 grid grid-cols-2 gap-10 border-t border-(--border-subtle) pt-10 sm:grid-cols-3">
            {columns.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <p className="text-[14px] font-semibold text-(--flow-ink)">{col.heading}</p>
                <ul className="mt-4 flex flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="bg-[linear-gradient(var(--flow-magenta),var(--flow-magenta))] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat pb-0.5 text-[15px] text-(--text-secondary) transition-[background-size,color] duration-300 hover:bg-[length:100%_1.5px] hover:text-(--flow-ink)"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[14px] font-semibold text-(--flow-ink)">Built with</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {builtWith.map((b) => (
                  <li
                    key={b}
                    className={cn("rounded-full bg-(--flow-shell)/80 px-3 py-1.5 text-[13px] font-semibold text-(--text-secondary)")}
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-2 text-[13.5px] text-(--text-muted) sm:flex-row sm:justify-between">
            <p>© 2026 InsightFlow</p>
            <p>Made in India, for teams that run on spreadsheets.</p>
          </div>
        </div>

        <div className="relative z-[2] mt-6">
          <Wordmark />
        </div>
      </div>
    </footer>
  );
}
