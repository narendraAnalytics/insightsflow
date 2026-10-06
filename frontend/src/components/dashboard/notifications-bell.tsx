"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  BellSlash,
  ChatCircleText,
  CheckCircle,
  Coins,
  FileXls,
  Lightning,
  WarningCircle,
} from "@phosphor-icons/react";
import { GmailGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { useNotifications, type Notification } from "@/hooks/use-notifications";

const Z = "font-(family-name:--font-zeyada)";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function Icon({ n }: { n: Notification }) {
  const tile = "flex size-10 shrink-0 items-center justify-center rounded-xl";
  if (n.kind === "connection") {
    if (n.provider === "gmail")
      return <span className={`${tile} bg-[#ea4335]/10`}><GmailGlyph aria-hidden className="size-6" /></span>;
    if (n.provider === "slack")
      return <span className={`${tile} bg-[#e01e5a]/10`}><SlackGlyph aria-hidden className="size-6" /></span>;
    if (n.provider === "notion")
      return <span className={`${tile} bg-(--flow-peach)/70`}><NotionGlyph aria-hidden className="size-6" /></span>;
    return <span className={`${tile} bg-[#0f9d58]/12`}><FileXls weight="fill" className="size-5 text-[#0f9d58]" /></span>;
  }
  switch (n.kind) {
    case "approval":
      return <span className={`${tile} bg-(--flow-magenta)/15`}><CheckCircle weight="duotone" className="size-6 text-(--flow-magenta)" /></span>;
    case "failed":
      return <span className={`${tile} bg-(--flow-coral)/18`}><WarningCircle weight="duotone" className="size-6 text-(--flow-coral)" /></span>;
    case "low_credits":
    case "topup":
      return <span className={`${tile} bg-(--flow-amber)/25`}><Coins weight="duotone" className="size-6 text-[oklch(0.62_0.15_70)]" /></span>;
    case "chat":
      return <span className={`${tile} bg-(--flow-cyan)/20`}><ChatCircleText weight="duotone" className="size-6 text-[oklch(0.55_0.12_190)]" /></span>;
    default:
      return <span className={`${tile} bg-(--flow-mint)/25`}><Lightning weight="duotone" className="size-6 text-[oklch(0.55_0.15_160)]" /></span>;
  }
}

const ACTION: Partial<Record<Notification["kind"], string>> = {
  approval: "Review & send",
  low_credits: "Buy credits",
};

export function NotificationsBell() {
  const { items, unread, isUnread, loading, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        title="Notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} need attention` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-10 items-center justify-center rounded-full text-(--flow-ink)/70 transition-colors hover:bg-(--flow-ink)/6"
      >
        <Bell weight={open ? "fill" : "bold"} className="size-[19px]" />
        {unread > 0 && (
          <span
            className="absolute top-1 right-0.5 flex min-w-[17px] items-center justify-center rounded-full bg-(--flow-magenta) px-1 py-px text-[10px] leading-none font-semibold text-(--flow-cream) ring-2 ring-(--flow-cream)"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top right", boxShadow: "0 30px 60px -24px color-mix(in oklab, var(--flow-magenta) 55%, transparent)" }}
            className="fixed inset-x-3 top-[68px] z-[120] flex max-h-[min(540px,calc(100dvh-90px))] flex-col overflow-hidden rounded-[26px] border border-(--flow-ink)/8 bg-(--flow-cream) sm:absolute sm:inset-x-auto sm:top-[calc(100%+10px)] sm:right-0 sm:w-[400px]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-(--flow-ink)/8 px-5 py-3.5">
              <p className={`text-gradient-flow ${Z} text-[30px] leading-none font-normal`}>Notifications</p>
              {items.some(isUnread) && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className={`${Z} text-[20px] leading-none font-normal text-(--flow-magenta) transition-opacity hover:opacity-70`}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-2">
              {loading ? (
                <div className="flex flex-col gap-2 p-2" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-2xl bg-(--flow-peach)/45" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-(--flow-peach)/60">
                    <BellSlash weight="duotone" className="size-6 text-(--flow-magenta)" />
                  </span>
                  <p className={`${Z} text-[26px] leading-none font-normal text-(--flow-ink)`}>All quiet</p>
                  <p className={`${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/60`}>
                    Connect an app or ask a question and what happens will show up here.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {items.map((n) => {
                    const action = ACTION[n.kind];
                    const body = (
                      <>
                        <Icon n={n} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`${Z} text-[22px] leading-tight font-normal text-(--flow-ink)`}>{n.title}</p>
                            <span className={`${Z} shrink-0 pt-0.5 text-[17px] leading-none font-normal text-(--flow-ink)/50`}>
                              {timeAgo(n.at)}
                            </span>
                          </div>
                          {n.detail && (
                            <p className={`mt-0.5 line-clamp-2 ${Z} text-[19px] leading-snug font-normal text-(--flow-ink)/65`}>
                              {n.detail}
                            </p>
                          )}
                          {action && (
                            <span
                              className={`bg-gradient-flow mt-1.5 inline-flex rounded-full px-3 py-1 ${Z} text-[19px] leading-none font-normal text-(--flow-cream)`}
                            >
                              {action}
                            </span>
                          )}
                        </div>
                        {isUnread(n) && (
                          <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-(--flow-magenta)" />
                        )}
                      </>
                    );
                    const cls = `flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-(--flow-peach)/45 ${
                      isUnread(n) ? "bg-(--flow-peach)/25" : ""
                    }`;
                    return (
                      <li key={n.id}>
                        {n.href ? (
                          <Link href={n.href} onClick={() => setOpen(false)} className={cls}>
                            {body}
                          </Link>
                        ) : (
                          <div className={cls}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
