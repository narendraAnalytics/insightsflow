"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ResultTable = { columns: string[]; rows: (string | number | null)[][] };

export type Headline = { label: string | null; value: number; words: string };

export type Step = {
  id: string;
  label: string;
  status: "running" | "done" | "failed";
  summary?: string;
  value?: number | null;
  table?: ResultTable | null;
  headline?: Headline | null;
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

export type ConversationSummary = { id: string; title: string; updated_at: string };

type ConversationDetail = { id: string; title: string; messages: ChatMessage[] };

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

export function useInsightsChat(enabled: boolean) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [opening, setOpening] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await apiFetch<Suggestions>("/api/v1/insights/suggestions", token);
        if (!cancelled) setSuggestions(res);
      } catch {
        /* suggestions are a nicety — the chat works without them */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, getToken]);

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
          body: JSON.stringify({ question: text, conversation_id: conversationIdRef.current }),
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
    [busy, getToken, patchAssistant, refreshConversations]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const newChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      if (busy || id === conversationIdRef.current) return;
      setOpening(true);
      try {
        const token = await getToken();
        const detail = await apiFetch<ConversationDetail>(`/api/v1/insights/conversations/${id}`, token);
        setMessages(detail.messages);
        setConversationId(detail.id);
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
    send,
    stop,
    newChat,
    openConversation,
    removeConversation,
  };
}
