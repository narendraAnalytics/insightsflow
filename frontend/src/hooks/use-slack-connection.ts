"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type SlackConnection = {
  provider: string;
  status: string;
  /** For Slack this is the workspace name. */
  external_account_email: string | null;
  slack_channel_id: string | null;
  slack_channel_name: string | null;
};

export type SlackChannel = { id: string; name: string };

const BASE = "/api/v1/connections/slack";

export function useSlackConnection() {
  const { isSignedIn, getToken } = useAuth();
  const [connection, setConnection] = useState<SlackConnection | null>(null);
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
      const rows = await apiFetch<SlackConnection[]>("/api/v1/connections", token);
      setConnection(rows.find((r) => r.provider === "slack") ?? null);
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
    // Slack's install screen needs a top-level navigation, not fetch().
    window.location.href = url;
  }, [getToken]);

  const disconnect = useCallback(async () => {
    const token = await getToken();
    await apiFetch<void>(BASE, token, { method: "DELETE" });
    setConnection(null);
  }, [getToken]);

  /** Public channels of the connected workspace (alphabetical). */
  const loadChannels = useCallback(async () => {
    const token = await getToken();
    return apiFetch<SlackChannel[]>(`${BASE}/channels`, token);
  }, [getToken]);

  const setChannel = useCallback(
    async (channelId: string) => {
      const token = await getToken();
      const res = await apiFetch<{ channel_id: string; channel_name: string }>(`${BASE}/channel`, token, {
        method: "PUT",
        body: { channel_id: channelId },
      });
      setConnection((c) =>
        c ? { ...c, slack_channel_id: res.channel_id, slack_channel_name: res.channel_name } : c
      );
    },
    [getToken]
  );

  return { connection, loading, error, connect, disconnect, loadChannels, setChannel };
}
