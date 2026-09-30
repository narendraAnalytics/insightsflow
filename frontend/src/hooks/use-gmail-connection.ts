"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type GmailConnection = {
  provider: string;
  status: string;
  external_account_email: string | null;
  can_read_mail: boolean;
};

const BASE = "/api/v1/connections/gmail";

export function useGmailConnection() {
  const { isSignedIn, getToken } = useAuth();
  const [connection, setConnection] = useState<GmailConnection | null>(null);
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
      const rows = await apiFetch<GmailConnection[]>("/api/v1/connections", token);
      setConnection(rows.find((r) => r.provider === "gmail") ?? null);
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

  const disconnect = useCallback(async () => {
    const token = await getToken();
    await apiFetch<void>(BASE, token, { method: "DELETE" });
    setConnection(null);
  }, [getToken]);

  return { connection, loading, error, connect, disconnect };
}
