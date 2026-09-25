"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type DashboardSummary = {
  stats: {
    active_integrations: number;
    connected_sheets: number;
    connected_tabs: number;
    questions_asked: number;
  };
  activity: { kind: "connection" | "source" | "chat"; title: string; detail: string | null; at: string }[];
  sources: { id: string; name: string; tab_title: string; row_count: number; synced_at: string }[];
};

// The KPI cards, activity feed and sources table all read the same summary;
// share one in-flight request instead of firing three.
let inflight: Promise<DashboardSummary> | null = null;

export function useDashboardSummary() {
  const { isSignedIn, getToken } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        if (!inflight) {
          inflight = getToken().then((t) => apiFetch<DashboardSummary>("/api/v1/dashboard/summary", t));
          void inflight.finally(() => setTimeout(() => (inflight = null), 1000)).catch(() => {});
        }
        const data = await inflight;
        if (!cancelled) setSummary(data);
      } catch (err) {
        inflight = null;
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  return { summary, isLoading, error };
}
