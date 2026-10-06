"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { CREDITS_CHANGED_EVENT } from "@/lib/credits-events";
import type { AutomationRun } from "@/hooks/use-automations";
import type { DashboardSummary } from "@/hooks/use-dashboard-stats";
import { LOW_CREDITS } from "@/components/billing/credits-pill";

export type NotificationKind = "approval" | "failed" | "low_credits" | "connection" | "source" | "chat" | "topup";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string | null;
  /** ISO time; null for a standing alert (low credits) that has no moment of its own. */
  at: string | null;
  provider?: string | null;
  /** Where clicking goes. */
  href: string | null;
  /** Needs the user to act, so it counts as unread until the underlying state changes. */
  actionable: boolean;
};

type Balance = { credits: number; entries: { delta: number; reason: string; created_at: string }[] };

const SEEN_KEY = "insightflow:notifications-seen";
const REFRESH_MS = 60_000;
const MAX_ITEMS = 25;
const RECENT_FAILURE_MS = 7 * 24 * 60 * 60 * 1000;

const readSeen = (): number => {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};

/**
 * One feed built from what the dashboard already knows: reports waiting for approval, failed
 * automation runs, low credits, top-ups, and what the user connected/added/asked. No backend of
 * its own — three existing endpoints, merged newest first.
 */
export function useNotifications() {
  const { isSignedIn, getToken } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState(0);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    const token = await getToken();
    const [s, r, b] = await Promise.allSettled([
      apiFetch<DashboardSummary>("/api/v1/dashboard/summary", token),
      apiFetch<AutomationRun[]>("/api/v1/automations/runs?limit=20", token),
      apiFetch<Balance>("/api/v1/billing/balance", token),
    ]);
    if (s.status === "fulfilled") setSummary(s.value);
    if (r.status === "fulfilled") setRuns(r.value);
    if (b.status === "fulfilled") setBalance(b.value);
    setLoading(false);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onChanged = () => void refresh();
    window.addEventListener(CREDITS_CHANGED_EVENT, onChanged);
    return () => {
      clearInterval(timer);
      window.removeEventListener(CREDITS_CHANGED_EVENT, onChanged);
    };
  }, [refresh]);

  const items = useMemo<Notification[]>(() => {
    const out: Notification[] = [];

    for (const run of runs) {
      const name = run.automation_name ?? "Your automation";
      if (run.status === "awaiting_approval") {
        out.push({
          id: `run-${run.id}`,
          kind: "approval",
          title: `${name}: report ready to review`,
          detail: run.summary,
          at: run.finished_at ?? run.started_at,
          href: run.conversation_id ? `/dashboard/ai-insights?chat=${run.conversation_id}` : "/dashboard/automation",
          actionable: true,
        });
      } else if (run.status === "failed" && Date.now() - new Date(run.started_at).getTime() < RECENT_FAILURE_MS) {
        out.push({
          id: `run-${run.id}`,
          kind: "failed",
          title: `${name} didn't finish`,
          detail: run.error,
          at: run.finished_at ?? run.started_at,
          href: "/dashboard/automation",
          actionable: false,
        });
      }
    }

    if (balance && balance.credits < LOW_CREDITS) {
      out.push({
        id: "low-credits",
        kind: "low_credits",
        title: balance.credits <= 0 ? "You're out of credits" : "Credits are running low",
        detail: `${balance.credits} left. Buy more to keep asking and connecting.`,
        at: null,
        href: "/dashboard/settings/billing",
        actionable: true,
      });
    }

    for (const e of balance?.entries ?? []) {
      if (e.reason !== "topup" || e.delta <= 0) continue;
      out.push({
        id: `topup-${e.created_at}`,
        kind: "topup",
        title: `${e.delta.toLocaleString("en-IN")} credits added`,
        detail: null,
        at: e.created_at,
        href: "/dashboard/settings/billing",
        actionable: false,
      });
    }

    (summary?.activity ?? []).forEach((a, i) => {
      out.push({
        id: `${a.kind}-${a.at}-${i}`,
        kind: a.kind,
        title: a.title,
        detail: a.detail,
        at: a.at,
        provider: a.provider,
        href: a.kind === "chat" ? "/dashboard/ai-insights" : "/dashboard/integrations",
        actionable: false,
      });
    });

    // Standing alerts first, then everything else newest first.
    return out
      .sort((a, b) => {
        if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
        return new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime();
      })
      .slice(0, MAX_ITEMS);
  }, [runs, balance, summary]);

  const isUnread = useCallback(
    (n: Notification) => n.actionable || (n.at !== null && new Date(n.at).getTime() > seen),
    [seen]
  );
  const unread = items.filter(isUnread).length;

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setSeen(now);
    try {
      window.localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      /* private mode: the dot just comes back next visit */
    }
  }, []);

  return { items, unread, isUnread, loading, refresh, markAllRead };
}
