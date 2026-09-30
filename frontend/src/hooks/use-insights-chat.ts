"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import type { DataSource } from "@/hooks/use-google-sheets-connection";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ResultTable = { columns: string[]; rows: (string | number | null)[][] };

/** One inbox message, parsed by the backend for display. */
export type EmailItem = {
  name: string;
  address: string;
  subject: string;
  date: string | null;
  snippet: string;
  unread: boolean;
};

export type Headline = { label: string | null; value: number; words: string };

export type Step = {
  id: string;
  label: string;
  status: "running" | "done" | "failed";
  summary?: string;
  value?: number | null;
  table?: ResultTable | null;
  headline?: Headline | null;
  emails?: EmailItem[] | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: Step[];
  status: "thinking" | "streaming" | "done" | "error";
  error?: string;
};

type Suggestions = { sheet_name: string; questions: string[] };

export type ConversationSummary = {
  id: string;
  title: string;
  data_source_ids: string[];
  uses_gmail: boolean;
  updated_at: string;
};

type ConversationDetail = {
  id: string;
  title: string;
  data_source_ids: string[];
  uses_gmail: boolean;
  messages: ChatMessage[];
};

/** Most sheets/tabs one chat may use at once (matches the backend limit). */
export const MAX_SOURCES_PER_CHAT = 5;

/** Keeps the still-existing part of a selection; falls back to the first source. */
function pruneSelection(current: string[], sources: DataSource[]): string[] {
  const kept = sources.filter((s) => current.includes(s.id)).map((s) => s.id);
  return kept.length > 0 ? kept : sources[0] ? [sources[0].id] : [];
}

let counter = 0;
const nextId = () => `m${Date.now()}-${counter++}`;

/** Parses one SSE block ("event: x\ndata: {...}") into its parts. */
function parseBlock(block: string): { event: string; data: Record<string, unknown> } | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

export function useInsightsChat(enabled: boolean, sources: DataSource[], gmailReady: boolean) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  // The sheets/tabs the current chat asks about (1-5). Chosen before the first
  // question, then locked to the conversation (empty on an opened chat whose
  // sheets were all removed).
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const sourceKey = sourceIds.join(",");
  // Whether the chat may also read the user's recent emails. Like the sheets, it's
  // chosen before the first question, then locked to the conversation.
  const [useGmail, setUseGmail] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [opening, setOpening] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    if (conversationIdRef.current) return;
    setSourceIds((current) => {
      const next = pruneSelection(current, sources);
      return next.join(",") === current.join(",") ? current : next;
    });
  }, [sources]);

  useEffect(() => {
    if (conversationIdRef.current) return;
    // Nothing else to ask about → default to Gmail; never keep it on once unreadable.
    setUseGmail((on) => (gmailReady ? on || sources.length === 0 : false));
  }, [gmailReady, sources.length]);

  useEffect(() => {
    if (!enabled || (!sourceKey && !useGmail)) return;
    let cancelled = false;
    setSuggestions(null);
    (async () => {
      try {
        const token = await getToken();
        const params = [
          ...sourceKey.split(",").filter(Boolean).map((id) => `source_ids=${id}`),
          ...(useGmail ? ["gmail=true"] : []),
        ];
        const res = await apiFetch<Suggestions>(`/api/v1/insights/suggestions?${params.join("&")}`, token);
        if (!cancelled) setSuggestions(res);
      } catch {
        /* suggestions are a nicety — the chat works without them */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, sourceKey, useGmail, getToken]);

  const refreshConversations = useCallback(async () => {
    try {
      const token = await getToken();
      setConversations(await apiFetch<ConversationSummary[]>("/api/v1/insights/conversations", token));
    } catch {
      /* history is a nicety — chatting still works without it */
    }
  }, [getToken]);

  useEffect(() => {
    if (enabled) void refreshConversations();
  }, [enabled, refreshConversations]);

  const patchAssistant = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;

      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: text, steps: [], status: "done" },
        { id: assistantId, role: "assistant", content: "", steps: [], status: "thinking" },
      ]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // Tokens arrive a few characters at a time; batch them per frame so we
      // re-render at display rate instead of once per token.
      let buffer = "";
      let frame = 0;
      const flush = () => {
        frame = 0;
        if (!buffer) return;
        const chunk = buffer;
        buffer = "";
        patchAssistant(assistantId, (m) => ({
          ...m,
          status: "streaming",
          content: (m.content + chunk).replace(/^\s+/, ""),
        }));
      };

      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/v1/insights/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            question: text,
            conversation_id: conversationIdRef.current,
            // Only a new chat picks its sheet; an existing one keeps its own.
            data_source_ids: conversationIdRef.current ? undefined : sourceIds,
            use_gmail: conversationIdRef.current ? undefined : useGmail,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const message =
            res.status === 404
              ? "Connect a Google Sheet and pick a spreadsheet first."
              : res.status === 503
                ? "The AI model isn't configured yet."
                : "Couldn't reach the assistant. Try again.";
          throw new Error(message);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const blocks = pending.split("\n\n");
          pending = blocks.pop() ?? "";

          for (const block of blocks) {
            const evt = parseBlock(block);
            if (!evt) continue;
            const d = evt.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

            if (evt.event === "conversation") {
              setConversationId(String(d.id));
              conversationIdRef.current = String(d.id);
            } else if (evt.event === "token") {
              buffer += String(d.text ?? "");
              if (!frame) frame = requestAnimationFrame(flush);
            } else if (evt.event === "tool_start") {
              patchAssistant(assistantId, (m) => ({
                ...m,
                steps: [...m.steps, { id: d.id, label: d.label, status: "running" }],
              }));
            } else if (evt.event === "tool_result") {
              patchAssistant(assistantId, (m) => ({
                ...m,
                steps: m.steps.map((s) =>
                  s.id === d.id
                    ? {
                        ...s,
                        status: d.ok ? "done" : "failed",
                        summary: d.summary,
                        value: d.value,
                        table: d.table,
                        headline: d.headline,
                        emails: d.emails,
                      }
                    : s
                ),
              }));
            } else if (evt.event === "error") {
              throw new Error(String(d.message ?? "Something went wrong."));
            }
          }
        }

        if (frame) cancelAnimationFrame(frame);
        flush();
        patchAssistant(assistantId, (m) => ({ ...m, status: "done" }));
      } catch (err) {
        if (frame) cancelAnimationFrame(frame);
        flush();
        const aborted = err instanceof DOMException && err.name === "AbortError";
        patchAssistant(assistantId, (m) =>
          aborted
            ? { ...m, status: "done", content: m.content || "Stopped." }
            : {
                ...m,
                status: "error",
                error: err instanceof Error ? err.message : "Something went wrong.",
              }
        );
      } finally {
        abortRef.current = null;
        setBusy(false);
        void refreshConversations();
      }
    },
    [busy, sourceIds, useGmail, getToken, patchAssistant, refreshConversations]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const newChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
    setSourceIds((current) => pruneSelection(current, sources));
    setUseGmail(gmailReady && sources.length === 0);
  }, [sources, gmailReady]);

  const openConversation = useCallback(
    async (id: string) => {
      if (busy || id === conversationIdRef.current) return;
      setOpening(true);
      try {
        const token = await getToken();
        const detail = await apiFetch<ConversationDetail>(`/api/v1/insights/conversations/${id}`, token);
        setMessages(detail.messages);
        setConversationId(detail.id);
        setSourceIds(detail.data_source_ids);
        setUseGmail(detail.uses_gmail);
      } catch {
        void refreshConversations();
      } finally {
        setOpening(false);
      }
    },
    [busy, getToken, refreshConversations]
  );

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        const token = await getToken();
        await apiFetch<void>(`/api/v1/insights/conversations/${id}`, token, { method: "DELETE" });
        if (conversationIdRef.current === id) newChat();
      } finally {
        void refreshConversations();
      }
    },
    [getToken, newChat, refreshConversations]
  );

  return {
    messages,
    suggestions,
    busy,
    opening,
    conversationId,
    conversations,
    sourceIds,
    setSourceIds,
    useGmail,
    setUseGmail,
    sourceRemoved: conversationId !== null && sourceIds.length === 0 && !useGmail,
    send,
    stop,
    newChat,
    openConversation,
    removeConversation,
  };
}
