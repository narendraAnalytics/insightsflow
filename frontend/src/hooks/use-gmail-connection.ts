"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type GmailConnection = {
  id: string;
  provider: string;
  status: string;
  external_account_email: string | null;
  can_read_mail: boolean;
  /** Exactly one account is the default: drafts are sent from it unless the card picks another. */
  is_default: boolean;
};

const BASE = "/api/v1/connections/gmail";

/** A user can connect several Gmail accounts. `accounts` lists them (default first);
 * `connection` is the default one, kept for code that only needs "the" Gmail. */
export function useGmailConnection() {
  const { isSignedIn, getToken } = useAuth();
  const [accounts, setAccounts] = useState<GmailConnection[]>([]);
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
      const rows = await apiFetch<GmailConnection[]>("/api/v1/connections", token);
      const gmail = rows.filter((r) => r.provider === "gmail");
      setAccounts([...gmail].sort((a, b) => Number(b.is_default) - Number(a.is_default)));
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

  /** Starts the Google consent flow. By default it ADDS an account (50 credits, after it
   * saves); `reconnect: true` refreshes an account that is already connected, for free. */
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

  const connection = useMemo(() => accounts.find((a) => a.is_default) ?? accounts[0] ?? null, [accounts]);

  return { accounts, connection, loading, error, connect, disconnect, makeDefault };
}
