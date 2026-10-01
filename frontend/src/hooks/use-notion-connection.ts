"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type NotionConnection = {
  provider: string;
  status: string;
  /** For Notion this is the workspace name. */
  external_account_email: string | null;
  notion_page_id: string | null;
  notion_page_title: string | null;
};

export type NotionPage = { id: string; title: string };

const BASE = "/api/v1/connections/notion";

export function useNotionConnection() {
  const { isSignedIn, getToken } = useAuth();
  const [connection, setConnection] = useState<NotionConnection | null>(null);
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
      const rows = await apiFetch<NotionConnection[]>("/api/v1/connections", token);
      setConnection(rows.find((r) => r.provider === "notion") ?? null);
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
    // Notion's consent screen needs a top-level navigation, not fetch().
    window.location.href = url;
  }, [getToken]);

  const disconnect = useCallback(async () => {
    const token = await getToken();
    await apiFetch<void>(BASE, token, { method: "DELETE" });
    setConnection(null);
  }, [getToken]);

  /** Pages the user shared with the connection, optionally filtered by title. */
  const searchPages = useCallback(
    async (query: string) => {
      const token = await getToken();
      const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      return apiFetch<NotionPage[]>(`${BASE}/pages${q}`, token);
    },
    [getToken]
  );

  const setPage = useCallback(
    async (pageId: string) => {
      const token = await getToken();
      const res = await apiFetch<{ page_id: string; page_title: string }>(`${BASE}/page`, token, {
        method: "PUT",
        body: { page_id: pageId },
      });
      setConnection((c) => (c ? { ...c, notion_page_id: res.page_id, notion_page_title: res.page_title } : c));
    },
    [getToken]
  );

  return { connection, loading, error, connect, disconnect, searchPages, setPage };
}
