"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { emitCreditsChanged } from "@/lib/credits-events";

/** One spreadsheet tab the user can ask questions about. */
export type DataSource = {
  id: string;
  /** The Google login (connection) this tab belongs to. */
  connection_id?: string;
  spreadsheet_id: string;
  name: string;
  tab_title: string;
  headers: string[];
  row_count: number;
  synced_at: string;
};

/** One Google login used for Sheets. A user can connect several (one per Google address). */
export type GoogleSheetsConnection = {
  id: string;
  provider: string;
  status: string;
  external_account_email: string | null;
  /** The Gmail account (connection id) this login belongs to, if any. */
  gmail_connection_id: string | null;
  /** Exactly one login is the default (used when nothing else is chosen). */
  is_default: boolean;
  sources: DataSource[];
};

export type SpreadsheetTabs = { name: string; tabs: { id: number; title: string }[] };

export type SheetPreviewData = { headers: string[]; rows: string[][] };

const BASE = "/api/v1/connections/google";

/** "Sales — Q2", or just the name when the tab title isn't resolved yet. */
export const sourceLabel = (s: Pick<DataSource, "name" | "tab_title">) =>
  s.tab_title ? `${s.name} — ${s.tab_title}` : s.name;

const withLogin = (connectionId?: string) =>
  connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : "";

/** `accounts` lists the Google logins (default first). `connection` is the default one, kept for
 * code that needs just one; `sources` is every tab across all logins. */
export function useGoogleSheetsConnection() {
  const { isSignedIn, getToken } = useAuth();
  const [accounts, setAccounts] = useState<GoogleSheetsConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const rows = await apiFetch<GoogleSheetsConnection[]>("/api/v1/connections", token);
      const sheets = rows.filter((r) => r.provider === "google_sheets");
      setAccounts([...sheets].sort((a, b) => Number(b.is_default) - Number(a.is_default)));
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

  /** Starts Google sign-in. By default it ADDS a login (Google shows its account chooser);
   * `reconnect: true` refreshes one that is already connected. Both are free. */
  const connect = useCallback(
    async (opts?: { reconnect?: boolean }) => {
      const token = await getToken();
      const { url } = await apiFetch<{ url: string }>(
        `${BASE}/connect-url${opts?.reconnect ? "?reconnect=true" : ""}`,
        token
      );
      // OAuth consent needs a top-level navigation, not fetch().
      window.location.href = url;
    },
    [getToken]
  );

  const getPickerToken = useCallback(
    async (connectionId?: string) => {
      const token = await getToken();
      return apiFetch<{ access_token: string; app_id: string }>(
        `${BASE}/picker-token${withLogin(connectionId)}`,
        token
      );
    },
    [getToken]
  );

  const getTabs = useCallback(
    async (spreadsheetId: string, connectionId?: string) => {
      const token = await getToken();
      return apiFetch<SpreadsheetTabs>(
        `${BASE}/spreadsheets/${encodeURIComponent(spreadsheetId)}/tabs${withLogin(connectionId)}`,
        token
      );
    },
    [getToken]
  );

  /** Adds a tab as a data source (first tab when `tabTitle` is omitted) under one Google login. */
  const addSource = useCallback(
    async (fileId: string, tabTitle?: string, connectionId?: string) => {
      const token = await getToken();
      const source = await apiFetch<DataSource>(`${BASE}/sources`, token, {
        method: "POST",
        body: { file_id: fileId, tab_title: tabTitle ?? null, connection_id: connectionId ?? null },
      });
      emitCreditsChanged(); // a new sheet/tab costs credits (re-adding an existing one is free)
      setAccounts((rows) =>
        rows.map((a) =>
          a.id === source.connection_id || (!source.connection_id && a.is_default)
            ? { ...a, sources: [...a.sources.filter((s) => s.id !== source.id), source] }
            : a
        )
      );
      return source;
    },
    [getToken]
  );

  const removeSource = useCallback(
    async (sourceId: string) => {
      const token = await getToken();
      await apiFetch<void>(`${BASE}/sources/${sourceId}`, token, { method: "DELETE" });
      setAccounts((rows) => rows.map((a) => ({ ...a, sources: a.sources.filter((s) => s.id !== sourceId) })));
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

  /** Disconnects one Google login (and its tabs); the next one becomes the default. */
  const disconnect = useCallback(
    async (id: string) => {
      const token = await getToken();
      await apiFetch<void>(`${BASE}/${id}`, token, { method: "DELETE" });
      await refresh();
    },
    [getToken, refresh]
  );

  const makeDefault = useCallback(
    async (id: string) => {
      const token = await getToken();
      await apiFetch<void>(`${BASE}/${id}/default`, token, { method: "POST" });
      await refresh();
    },
    [getToken, refresh]
  );

  /** Moves a Google login to another Gmail account, or to none (null). */
  const setGmailLink = useCallback(
    async (id: string, gmailConnectionId: string | null) => {
      const token = await getToken();
      await apiFetch<void>(`${BASE}/${id}/gmail`, token, {
        method: "PUT",
        body: { gmail_connection_id: gmailConnectionId },
      });
      setAccounts((rows) => rows.map((a) => (a.id === id ? { ...a, gmail_connection_id: gmailConnectionId } : a)));
    },
    [getToken]
  );

  const connection = useMemo(() => accounts.find((a) => a.is_default) ?? accounts[0] ?? null, [accounts]);
  const sources = useMemo(() => accounts.flatMap((a) => a.sources), [accounts]);

  return {
    accounts,
    connection,
    sources,
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
    makeDefault,
    setGmailLink,
  };
}
