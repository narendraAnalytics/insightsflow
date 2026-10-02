"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import type { DataSource } from "@/hooks/use-google-sheets-connection";

export type DocumentTemplate = "invoice" | "bank_statement" | "receipt" | "text" | "custom";

export type UploadedDocument = {
  id: string;
  filename: string;
  template: DocumentTemplate;
  /** table = extracted rows (Extract); text = searchable passages with page numbers (Digitise). */
  kind: "table" | "text";
  status: "processing" | "ready" | "failed";
  error: string | null;
  page_count: number;
  headers: string[];
  row_count: number;
  created_at: string;
};

export type DocumentPreview = {
  filename: string;
  headers: string[];
  rows: (string | number | null)[][];
  row_count: number;
};

const POLL_MS = 3000;

/** Lets AI Insights treat a ready document like a sheet tab (same chips, same chat sources). */
export function documentAsSource(d: UploadedDocument): DataSource {
  return {
    id: d.id,
    spreadsheet_id: d.id,
    name: d.filename.replace(/\.[^.]+$/, "") || d.filename,
    tab_title: "",
    headers: d.headers,
    row_count: d.row_count,
    synced_at: d.created_at,
  };
}

export function useDocuments() {
  const { isSignedIn, getToken } = useAuth();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      setDocuments(await apiFetch<UploadedDocument[]>("/api/v1/documents", token));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your documents");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Sarvam reads a document in the background — poll only while something is in progress.
  const processing = documents.some((d) => d.status === "processing");
  useEffect(() => {
    if (!processing) return;
    timer.current = setTimeout(() => void refresh(), POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [processing, documents, refresh]);

  const upload = useCallback(
    async (file: File, template: DocumentTemplate, prompt: string) => {
      const token = await getToken();
      const form = new FormData();
      form.append("file", file);
      form.append("template", template);
      if (template === "custom") form.append("prompt", prompt);
      const doc = await apiFetch<UploadedDocument>("/api/v1/documents", token, { method: "POST", body: form });
      setDocuments((list) => [doc, ...list]);
    },
    [getToken]
  );

  const remove = useCallback(
    async (id: string) => {
      const token = await getToken();
      await apiFetch<void>(`/api/v1/documents/${id}`, token, { method: "DELETE" });
      setDocuments((list) => list.filter((d) => d.id !== id));
    },
    [getToken]
  );

  const preview = useCallback(
    async (id: string) => {
      const token = await getToken();
      return apiFetch<DocumentPreview>(`/api/v1/documents/${id}/preview`, token);
    },
    [getToken]
  );

  return { documents, loading, error, upload, remove, preview, refresh };
}
