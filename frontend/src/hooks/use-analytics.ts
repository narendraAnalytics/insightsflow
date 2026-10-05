"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type RangeDays = 7 | 30 | 90;

export type Analytics = {
  range_days: RangeDays;
  start: string;
  end: string;
  kpis: { key: string; value: number; previous: number; change_pct: number | null }[];
  daily: { date: string; questions: number; credits: number }[];
  spend_by_reason: { reason: string; credits: number }[];
  runs: { total: number; by_status: Record<string, number>; success_rate: number | null };
  recent_runs: {
    id: string;
    automation: string;
    status: string;
    trigger: string;
    started_at: string;
    conversation_id: string | null;
  }[];
  sources: { name: string; tab_title: string; row_count: number }[];
};

export function useAnalytics(range: RangeDays) {
  const { isSignedIn, getToken } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [loadedFor, setLoadedFor] = useState<RangeDays | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<Analytics>(`/api/v1/analytics?range=${range}`, await getToken());
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setLoadedFor(range);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, range]);

  // Loading whenever the data on screen isn't for the selected range yet.
  return { data, error, isLoading: loadedFor !== range };
}
