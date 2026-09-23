"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

/** One spreadsheet tab the user can ask questions about. */
export type DataSource = {
  id: string;
  spreadsheet_id: string;
  name: string;
  tab_title: string;
  headers: string[];
  row_count: number;
  synced_at: string;
};

export type GoogleSheetsConnection = {
  provider: string;
  status: string;
  external_account_email: string | null;
  sources: DataSource[];
};

export type SpreadsheetTabs = { name: string; tabs: { id: number; title: string }[] };

export type SheetPreviewData = { headers: string[]; rows: string[][] };

const BASE = "/api/v1/connections/google";

/** "Sales — Q2", or just the name when the tab title isn't resolved yet. */
export const sourceLabel = (s: Pick<DataSource, "name" | "tab_title">) =>
  s.tab_title ? `${s.name} — ${s.tab_title}` : s.name;

export function useGoogleSheetsConnection() {
  const { isSignedIn, getToken } = useAuth();
  const [connection, setConnection] = useState<GoogleSheetsConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setConnection(null);
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const rows = await apiFetch<GoogleSheetsConnection[]>("/api/v1/connections", token);
      setConnection(rows[0] ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connection");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    const token = await getToken();
    const { url } = await apiFetch<{ url: string }>(`${BASE}/connect-url`, token);
    // OAuth consent needs a top-level navigation, not fetch().
    window.location.href = url;
  }, [getToken]);

  const getPickerToken = useCallback(async () => {
    const token = await getToken();
    return apiFetch<{ access_token: string; app_id: string }>(`${BASE}/picker-token`, token);
  }, [getToken]);

  const getTabs = useCallback(
    async (spreadsheetId: string) => {
      const token = await getToken();
      return apiFetch<SpreadsheetTabs>(`${BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/tabs`, token);
    },
    [getToken]
  );

  /** Adds a tab as a data source (first tab when `tabTitle` is omitted). */
  const addSource = useCallback(
    async (fileId: string, tabTitle?: string) => {
      const token = await getToken();
      const source = await apiFetch<DataSource>(`${BASE}/sources`, token, {
        method: "POST",
        body: { file_id: fileId, tab_title: tabTitle ?? null },
      });
      setConnection((prev) => {
        if (!prev) return prev;
        const rest = prev.sources.filter((s) => s.id !== source.id);
        return { ...prev, sources: [...rest, source] };
      });
      return source;
    },
    [getToken]
  );

  const removeSource = useCallback(
    async (sourceId: string) => {
      const token = await getToken();
      await apiFetch<void>(`${BASE}/sources/${sourceId}`, token, { method: "DELETE" });
      setConnection((prev) => (prev ? { ...prev, sources: prev.sources.filter((s) => s.id !== sourceId) } : prev));
    },
    [getToken]
  );

  const getSourcePreview = useCallback(
    async (sourceId: string) => {
      const token = await getToken();
      return apiFetch<SheetPreviewData>(`${BASE}/sources/${sourceId}/preview`, token);
    },
    [getToken]
  );

  const disconnect = useCallback(async () => {
    const token = await getToken();
    await apiFetch<void>(BASE, token, { method: "DELETE" });
    setConnection(null);
  }, [getToken]);

  return {
    connection,
    loading,
    error,
    refresh,
    connect,
    getPickerToken,
    getTabs,
    addSource,
    removeSource,
    getSourcePreview,
    disconnect,
  };
}
