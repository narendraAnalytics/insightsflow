"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export type GoogleSheetsConnection = {
  provider: string;
  status: string;
  external_account_email: string | null;
  google_sheet_id: string | null;
  google_sheet_name: string | null;
  google_sheet_headers: string[] | null;
  google_sheet_row_count: number | null;
};

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
    setLoading(true);
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
    refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    const token = await getToken();
    const { url } = await apiFetch<{ url: string }>("/api/v1/connections/google/connect-url", token);
    window.location.href = url;
  }, [getToken]);

  const getPickerToken = useCallback(async () => {
    const token = await getToken();
    return apiFetch<{ access_token: string; app_id: string }>(
      "/api/v1/connections/google/picker-token",
      token
    );
  }, [getToken]);

  const selectSheet = useCallback(
    async (fileId: string, fileName: string) => {
      const token = await getToken();
      const updated = await apiFetch<GoogleSheetsConnection>("/api/v1/connections/google/select-sheet", token, {
        method: "POST",
        body: { file_id: fileId, file_name: fileName },
      });
      setConnection(updated);
      return updated;
    },
    [getToken]
  );

  const disconnect = useCallback(async () => {
    const token = await getToken();
    await apiFetch<void>("/api/v1/connections/google", token, { method: "DELETE" });
    setConnection(null);
  }, [getToken]);

  const getSheetPreview = useCallback(async () => {
    const token = await getToken();
    return apiFetch<{ headers: string[]; rows: string[][] }>(
      "/api/v1/connections/google/sheet-preview",
      token
    );
  }, [getToken]);

  return {
    connection,
    loading,
    error,
    refresh,
    connect,
    getPickerToken,
    selectSheet,
    disconnect,
    getSheetPreview,
  };
}
