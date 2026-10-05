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

// --- Connected sheets ---------------------------------------------------------------

export type SheetSource = { id: string; name: string; tab_title: string; row_count: number };

export type SheetProfile = {
  source: SheetSource;
  truncated: boolean;
  rows: number;
  columns: number;
  missing_pct: number;
  duplicate_rows: number;
  column_profiles: {
    name: string;
    type: "number" | "text" | "date";
    missing: number;
    distinct: number;
    sum: number | null;
    mean: number | null;
    min: number | null;
    max: number | null;
    top: { value: string; count: number }[];
  }[];
  measures: string[];
  dimensions: string[];
  dates: string[];
  selected: {
    measure: string | null;
    agg: "sum" | "mean" | "count";
    group_by: string | null;
    date_column: string | null;
  };
  total: number | null;
  total_words: string | null;
  breakdown: { label: string; value: number }[];
  trend: { label: string; value: number }[];
};

export type SheetQuery = {
  measure?: string;
  agg?: "sum" | "mean" | "count";
  group_by?: string;
  date_column?: string;
};

export function useSheetSources() {
  const { isSignedIn, getToken } = useAuth();
  const [sources, setSources] = useState<SheetSource[] | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<SheetSource[]>("/api/v1/analytics/sheets", await getToken());
        if (!cancelled) setSources(res);
      } catch {
        if (!cancelled) setSources([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);
  return sources;
}

export function useSheetProfile(sourceId: string | null, query: SheetQuery) {
  const { isSignedIn, getToken } = useAuth();
  const [profile, setProfile] = useState<SheetProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneFor, setDoneFor] = useState<string | null>(null);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) qs.set(k, v);
  const wanted = sourceId ? `${sourceId}?${qs.toString()}` : null;

  useEffect(() => {
    if (!isSignedIn || !wanted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<SheetProfile>(`/api/v1/analytics/sheets/${wanted}`, await getToken());
        if (cancelled) return;
        setProfile(res);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setProfile(null);
        setError(err instanceof Error ? err.message : "Failed to analyse this sheet");
      } finally {
        if (!cancelled) setDoneFor(wanted);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, wanted]);

  return { profile, error, isLoading: wanted !== null && doneFor !== wanted };
}

// --- Slack and Notion delivery ------------------------------------------------------

export type DeliveryProvider = "slack" | "notion";

export type ProviderDelivery = {
  connected: boolean;
  workspaces: { name: string; destination: string | null; is_default: boolean }[];
  kpis: { key: string; value: number; previous: number; change_pct: number | null }[];
  approval_rate: number | null;
  waiting: number;
  daily: { date: string; drafted: number; sent: number }[];
  by_destination: { label: string; value: number }[];
  by_workspace: { label: string; value: number }[];
  recent: {
    preview: string;
    destination: string;
    workspace: string;
    sent_at: string;
    url: string | null;
    conversation_id: string;
  }[];
};

export type Delivery = { range_days: RangeDays; slack: ProviderDelivery; notion: ProviderDelivery };

export function useDelivery(range: RangeDays) {
  const { isSignedIn, getToken } = useAuth();
  const [data, setData] = useState<Delivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<RangeDays | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<Delivery>(`/api/v1/analytics/delivery?range=${range}`, await getToken());
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load delivery analytics");
      } finally {
        if (!cancelled) setLoadedFor(range);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, range]);

  return { data, error, isLoading: loadedFor !== range };
}
