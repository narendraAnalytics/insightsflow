"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { emitCreditsChanged } from "@/lib/credits-events";

export type Frequency = "daily" | "weekly" | "monthly";
export type RunStatus = "running" | "awaiting_approval" | "completed" | "failed" | "dismissed";

export type Delivery = { email: string | null; slack: boolean; notion: boolean };

export type AutomationInput = {
  name: string;
  question: string;
  data_source_ids: string[];
  gmail_connection_id: string | null;
  delivery: Delivery;
  frequency: Frequency;
  weekday: number | null;
  month_day: number | null;
  hour: number;
  minute: number;
};

export type RunDraft = {
  step_id: string;
  draft: {
    kind?: "slack" | "notion";
    status?: string;
    // email
    to?: string;
    subject?: string;
    body?: string;
    // slack
    channel_name?: string;
    text?: string;
    // notion
    page_title?: string;
    title?: string;
  };
};

export type AutomationRun = {
  id: string;
  automation_id: string;
  automation_name: string | null;
  conversation_id: string | null;
  status: RunStatus;
  trigger: "schedule" | "manual";
  summary: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  drafts: RunDraft[];
};

export type Automation = AutomationInput & {
  id: string;
  schedule_text: string;
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run: AutomationRun | null;
};

export type SchedulePreview = { schedule_text: string; next_runs: string[] };

const POLL_MS = 4000;

export function useAutomations() {
  const { isSignedIn, getToken } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      const [list, recent] = await Promise.all([
        apiFetch<Automation[]>("/api/v1/automations", token),
        apiFetch<AutomationRun[]>("/api/v1/automations/runs?limit=40", token),
      ]);
      if (!mounted.current) return;
      setAutomations(list);
      setRuns(recent);
      setError(null);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Couldn't load automations");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    mounted.current = true;
    if (isSignedIn) void refresh();
    return () => {
      mounted.current = false;
    };
  }, [isSignedIn, refresh]);

  // A run happens on the server in the background: poll only while one is in flight.
  const running = runs.some((r) => r.status === "running");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void refresh().then(() => emitCreditsChanged());
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, refresh]);

  const call = useCallback(
    async <T,>(path: string, method: string, body?: unknown): Promise<T> => {
      const token = await getToken();
      return apiFetch<T>(path, token, { method, body });
    },
    [getToken]
  );

  const create = useCallback(
    async (input: AutomationInput) => {
      await call<Automation>("/api/v1/automations", "POST", input);
      await refresh();
    },
    [call, refresh]
  );

  const update = useCallback(
    async (id: string, input: AutomationInput) => {
      await call<Automation>(`/api/v1/automations/${id}`, "PUT", input);
      await refresh();
    },
    [call, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await call<void>(`/api/v1/automations/${id}`, "DELETE");
      await refresh();
    },
    [call, refresh]
  );

  const setEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      setAutomations((rows) => rows.map((a) => (a.id === id ? { ...a, enabled } : a)));
      try {
        await call<Automation>(`/api/v1/automations/${id}/enabled`, "POST", { enabled });
      } finally {
        await refresh();
      }
    },
    [call, refresh]
  );

  const runNow = useCallback(
    async (id: string) => {
      await call<AutomationRun>(`/api/v1/automations/${id}/run`, "POST");
      await refresh();
    },
    [call, refresh]
  );

  const dismiss = useCallback(
    async (runId: string) => {
      await call<void>(`/api/v1/automations/runs/${runId}/dismiss`, "POST");
      await refresh();
    },
    [call, refresh]
  );

  const preview = useCallback(
    (input: AutomationInput) => call<SchedulePreview>("/api/v1/automations/preview", "POST", input),
    [call]
  );

  return { automations, runs, loading, error, refresh, create, update, remove, setEnabled, runNow, dismiss, preview };
}
