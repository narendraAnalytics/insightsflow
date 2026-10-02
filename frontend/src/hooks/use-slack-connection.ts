"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type SlackConnection = {
  id: string;
  provider: string;
  status: string;
  /** For Slack this is the workspace name. */
  external_account_email: string | null;
  slack_channel_id: string | null;
  slack_channel_name: string | null;
  /** Exactly one workspace is the default: drafts go there unless the card picks another. */
  is_default: boolean;
};

export type SlackChannel = { id: string; name: string };

const BASE = "/api/v1/connections/slack";

/** A user can connect several Slack workspaces. `accounts` lists them (default first);
 * `connection` is the default one, kept for code that only needs "the" Slack. */
export function useSlackConnection() {
  const { isSignedIn, getToken } = useAuth();
  const [accounts, setAccounts] = useState<SlackConnection[]>([]);
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
      const rows = await apiFetch<SlackConnection[]>("/api/v1/connections", token);
      const slack = rows.filter((r) => r.provider === "slack");
      setAccounts([...slack].sort((a, b) => Number(b.is_default) - Number(a.is_default)));
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

  /** Starts Slack's install flow. By default it ADDS a workspace (50 credits, after it
   * saves); `reconnect: true` refreshes one that is already connected, for free. */
  const connect = useCallback(
    async (opts?: { reconnect?: boolean }) => {
      const token = await getToken();
      const { url } = await apiFetch<{ url: string }>(
        `${BASE}/connect-url${opts?.reconnect ? "?reconnect=true" : ""}`,
        token
      );
      // Slack's install screen needs a top-level navigation, not fetch().
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

  /** Public channels of one connected workspace (alphabetical). */
  const loadChannels = useCallback(
    async (id: string) => {
      const token = await getToken();
      return apiFetch<SlackChannel[]>(`${BASE}/${id}/channels`, token);
    },
    [getToken]
  );

  const setChannel = useCallback(
    async (id: string, channelId: string) => {
      const token = await getToken();
      const res = await apiFetch<{ channel_id: string; channel_name: string }>(`${BASE}/${id}/channel`, token, {
        method: "PUT",
        body: { channel_id: channelId },
      });
      setAccounts((rows) =>
        rows.map((c) =>
          c.id === id ? { ...c, slack_channel_id: res.channel_id, slack_channel_name: res.channel_name } : c
        )
      );
    },
    [getToken]
  );

  /** Posts a fixed "connected" message to the workspace's chosen channel (the user's click). */
  const sendTest = useCallback(
    async (id: string) => {
      const token = await getToken();
      return apiFetch<{ channel_name: string }>(`${BASE}/${id}/test`, token, { method: "POST" });
    },
    [getToken]
  );

  const connection = useMemo(() => accounts.find((a) => a.is_default) ?? accounts[0] ?? null, [accounts]);

  return {
    accounts,
    connection,
    loading,
    error,
    connect,
    disconnect,
    makeDefault,
    loadChannels,
    setChannel,
    sendTest,
  };
}
