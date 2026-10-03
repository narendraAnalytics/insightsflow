"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type NotionConnection = {
  id: string;
  provider: string;
  status: string;
  /** For Notion this is the workspace name. */
  external_account_email: string | null;
  notion_page_id: string | null;
  notion_page_title: string | null;
  /** Exactly one workspace is the default: drafts go there unless the card picks another. */
  is_default: boolean;
};

export type NotionPage = { id: string; title: string };

const BASE = "/api/v1/connections/notion";

/** A user can connect several Notion workspaces. `accounts` lists them (default first);
 * `connection` is the default one, kept for code that only needs "the" Notion. */
export function useNotionConnection() {
  const { isSignedIn, getToken } = useAuth();
  const [accounts, setAccounts] = useState<NotionConnection[]>([]);
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
      const rows = await apiFetch<NotionConnection[]>("/api/v1/connections", token);
      const notion = rows.filter((r) => r.provider === "notion");
      setAccounts([...notion].sort((a, b) => Number(b.is_default) - Number(a.is_default)));
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

  /** Starts Notion's consent flow. By default it ADDS a workspace (50 credits, after it
   * saves); `reconnect: true` refreshes one that is already connected, for free. */
  const connect = useCallback(
    async (opts?: { reconnect?: boolean }) => {
      const token = await getToken();
      const { url } = await apiFetch<{ url: string }>(
        `${BASE}/connect-url${opts?.reconnect ? "?reconnect=true" : ""}`,
        token
      );
      // Notion's consent screen needs a top-level navigation, not fetch().
      window.location.href = url;
    },
    [getToken]
  );

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

  /** Pages one workspace shared with the connection, optionally filtered by title. */
  const searchPages = useCallback(
    async (id: string, query: string) => {
      const token = await getToken();
      const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      return apiFetch<NotionPage[]>(`${BASE}/${id}/pages${q}`, token);
    },
    [getToken]
  );

  const setPage = useCallback(
    async (id: string, pageId: string) => {
      const token = await getToken();
      const res = await apiFetch<{ page_id: string; page_title: string }>(`${BASE}/${id}/page`, token, {
        method: "PUT",
        body: { page_id: pageId },
      });
      setAccounts((rows) =>
        rows.map((c) => (c.id === id ? { ...c, notion_page_id: res.page_id, notion_page_title: res.page_title } : c))
      );
    },
    [getToken]
  );

  const connection = useMemo(() => accounts.find((a) => a.is_default) ?? accounts[0] ?? null, [accounts]);

  return { accounts, connection, loading, error, connect, disconnect, makeDefault, searchPages, setPage };
}
