"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChatsCircle,
  Check,
  PaperPlaneRight,
  Robot,
  Sparkle,
  Plus,
  Stop,
  Table,
  TextAa,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useGoogleSheetsConnection } from "@/hooks/use-google-sheets-connection";
import {
  useInsightsChat,
  type ChatMessage,
  type ConversationSummary,
  type Headline,
  type Step,
} from "@/hooks/use-insights-chat";
import { TableCard, ValueCard } from "@/components/dashboard/insights/result-card";

const spring = { type: "spring", stiffness: 260, damping: 22 } as const;

const raised = (accent: string) =>
  `0 18px 28px -16px color-mix(in oklab, ${accent} 55%, transparent), 0 2px 0 var(--flow-cream) inset`;

/** Makes numbers in the answer stand out, grouped the Indian way (3,12,600)
 * to match the result cards. Only numbers the model already wrote with a
 * comma are regrouped, so years and IDs are left alone. */
function formatNumber(raw: string): string {
  if (!raw.includes(",")) return raw;
  const percent = raw.endsWith("%");
  const plain = raw.replace(/[,%]/g, "");
  const decimals = plain.includes(".") ? plain.split(".")[1].length : 0;
  const n = Number(plain);
  if (Number.isNaN(n)) return raw;
  const text = n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return percent ? `${text}%` : text;
}

function Highlight({ text }: { text: string }) {
  const parts = text.split(/(\d[\d,]*(?:\.\d+)?%?)/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-heading font-bold tabular-nums text-(--flow-magenta)">
            {formatNumber(part)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** The key figure spelled out — computed by the backend, never by the model. */
function InWords({ headline }: { headline: Headline }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15, ...spring }}
      className="flex items-start gap-3 rounded-2xl border border-(--flow-cream) bg-linear-to-br from-(--flow-peach)/60 to-(--flow-pink)/30 px-4 py-3"
      style={{ boxShadow: raised("var(--flow-coral)") }}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-(--flow-cream)/90 shadow-[0_8px_14px_-8px_var(--flow-magenta)]">
        <TextAa weight="bold" className="size-4 text-(--flow-magenta)" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-(--flow-ink)/50">
          In words{headline.label ? ` · ${headline.label}` : ""}
        </p>
        <p className="font-heading text-[16px] leading-snug font-semibold text-(--flow-ink)">{headline.words}</p>
      </div>
    </motion.div>
  );
}

function AgentAvatar() {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-(--flow-cream) bg-linear-to-br from-(--flow-cream) to-(--flow-peach)"
      style={{ boxShadow: raised("var(--flow-coral)") }}
    >
      <Robot weight="duotone" className="size-5 text-(--flow-magenta)" />
    </span>
  );
}

function StepChip({ step }: { step: Step }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={spring}
      className="inline-flex items-center gap-2 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-3 py-1.5 text-[12.5px] font-medium text-(--flow-ink)/75"
      style={{ boxShadow: raised(step.status === "failed" ? "var(--flow-coral)" : "var(--flow-cyan)") }}
    >
      {step.status === "running" ? (
        <span className="relative flex size-3.5 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--flow-magenta) opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-(--flow-magenta)" />
        </span>
      ) : step.status === "done" ? (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="flex size-3.5 items-center justify-center rounded-full bg-(--flow-cyan)"
        >
          <Check weight="bold" className="size-2.5 text-(--flow-cream)" />
        </motion.span>
      ) : (
        <WarningCircle weight="fill" className="size-3.5 text-(--flow-coral)" />
      )}
      {step.label}
    </motion.span>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const cards = message.steps.filter((s) => s.status === "done" && (s.table || typeof s.value === "number"));
  const lastStep = message.steps[message.steps.length - 1];
  const headline: Headline | null =
    [...message.steps].reverse().find((s) => s.status === "done" && s.headline)?.headline ?? null;
  const waiting = message.status === "thinking" || (message.status === "streaming" && !message.content);
  const waitingLabel = !lastStep
    ? "Reading your sheet…"
    : lastStep.status === "running"
      ? "Working on it…"
      : "Writing the answer…";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="flex gap-3"
    >
      <AgentAvatar />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        {message.steps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.steps.map((s) => (
              <StepChip key={s.id} step={s} />
            ))}
          </div>
        )}

        {cards.map((s) =>
          s.table ? (
            <TableCard key={s.id} table={s.table} />
          ) : (
            <ValueCard key={s.id} value={s.value as number} label={s.summary ?? ""} />
          )
        )}

        {waiting && message.status !== "error" && (
          <p className="shimmer-text font-heading text-[15px] font-semibold">{waitingLabel}</p>
        )}

        {message.content && (
          <div
            className="max-w-[46rem] rounded-3xl rounded-tl-md border border-(--flow-cream) bg-(--flow-cream)/70 px-5 py-4 text-[15px] leading-relaxed whitespace-pre-wrap text-(--flow-ink) backdrop-blur-md"
            style={{ boxShadow: raised("var(--flow-magenta)") }}
          >
            <Highlight text={message.content} />
            {message.status === "streaming" && (
              <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse rounded-full bg-(--flow-magenta)" />
            )}
          </div>
        )}

        {headline && message.content && <InWords headline={headline} />}

        {message.status === "error" && (
          <p className="flex items-center gap-2 rounded-2xl bg-(--flow-coral)/12 px-4 py-2.5 text-[13.5px] font-medium text-(--flow-ink)">
            <WarningCircle weight="fill" className="size-4 shrink-0 text-(--flow-coral)" />
            {message.error}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="flex justify-end"
    >
      <p
        className="bg-gradient-flow max-w-[85%] rounded-3xl rounded-br-md px-5 py-3 text-[15px] leading-relaxed font-medium text-(--flow-cream)"
        style={{ boxShadow: "0 20px 30px -16px var(--flow-magenta)" }}
      >
        {message.content}
      </p>
    </motion.div>
  );
}

function CenterCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-[28px] border border-(--flow-cream) bg-(--flow-cream)/70 p-8 text-center backdrop-blur-xl"
      style={{ boxShadow: raised("var(--flow-magenta)") }}
    >
      {children}
    </div>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function HistoryPanel({
  conversations,
  activeId,
  busy,
  onNew,
  onOpen,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  busy: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside
      className="flex flex-col gap-3 rounded-[26px] border border-(--flow-cream) bg-(--flow-cream)/70 p-3.5 backdrop-blur-xl lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)]"
      style={{ boxShadow: raised("var(--flow-magenta)") }}
    >
      <button
        type="button"
        onClick={onNew}
        disabled={busy}
        className="bg-gradient-flow flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[13.5px] font-semibold text-(--flow-cream) shadow-[0_14px_24px_-12px_var(--flow-magenta)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
      >
        <Plus weight="bold" className="size-4" />
        New chat
      </button>

      <p className="px-1.5 font-heading text-[13px] font-semibold text-(--flow-ink)/60">Your chats</p>

      <div
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "var(--flow-pink) transparent" }}
      >
        {conversations.length === 0 ? (
          <p className="px-1.5 py-3 text-[12.5px] leading-snug text-(--flow-ink)/45">
            Chats you start are saved here, so you can pick them up later.
          </p>
        ) : (
          conversations.map((c, i) => {
            const active = c.id === activeId;
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03, ...spring }}
                className={`group relative rounded-2xl border transition-colors ${
                  active
                    ? "border-(--flow-cream) bg-(--flow-cream)"
                    : "border-transparent hover:bg-(--flow-cream)/70"
                }`}
                style={active ? { boxShadow: raised("var(--flow-coral)") } : undefined}
              >
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  disabled={busy}
                  className="flex w-full flex-col items-start gap-0.5 rounded-2xl px-3 py-2.5 pr-9 text-left disabled:opacity-60"
                >
                  <span className="line-clamp-2 text-[13px] leading-snug font-medium text-(--flow-ink)">
                    {c.title}
                  </span>
                  <span className="text-[11.5px] text-(--flow-ink)/45">{timeAgo(c.updated_at)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  disabled={busy}
                  aria-label={`Delete chat: ${c.title}`}
                  className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-(--flow-ink)/35 opacity-0 transition hover:bg-(--flow-coral)/15 hover:text-(--flow-coral) focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0"
                >
                  <Trash weight="bold" className="size-3.5" />
                </button>
              </motion.div>
            );
          })
        )}
      </div>
    </aside>
  );
}

export function InsightsChat() {
  const reduce = useReducedMotion();
  const { connection, loading } = useGoogleSheetsConnection();
  const ready = connection?.status === "connected" && Boolean(connection.google_sheet_id);
  const {
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
  } = useInsightsChat(ready);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce || busy ? "auto" : "smooth", block: "end" });
  }, [messages, busy, reduce]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    setDraft("");
    void send(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  };

  if (loading) {
    return <p className="px-8 py-10 text-[13.5px] text-(--flow-ink)/45">Loading…</p>;
  }

  if (!ready) {
    return (
      <CenterCard>
        <span
          className="flex size-16 items-center justify-center rounded-[20px] border border-(--flow-cream) bg-linear-to-br from-(--flow-cream) to-(--flow-peach)"
          style={{ boxShadow: raised("var(--flow-coral)") }}
        >
          <Table weight="duotone" className="size-8 text-(--flow-magenta)" />
        </span>
        <div>
          <p className="font-heading text-[20px] font-bold tracking-tight text-(--flow-ink)">
            Connect a sheet to start
          </p>
          <p className="mt-1 text-[13.5px] text-(--flow-ink)/55">
            Pick a Google Sheet on the Integrations page, then ask questions about it here.
          </p>
        </div>
        <a
          href="/dashboard/integrations"
          className="bg-gradient-flow rounded-full px-5 py-2.5 text-[14px] font-semibold text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97]"
        >
          Go to Integrations
        </a>
      </CenterCard>
    );
  }

  const sheetName = suggestions?.sheet_name ?? connection?.google_sheet_name ?? "your sheet";

  const historyPanel = (
    <HistoryPanel
      conversations={conversations}
      activeId={conversationId}
      busy={busy}
      onNew={() => {
        newChat();
        setHistoryOpen(false);
      }}
      onOpen={(id) => {
        void openConversation(id);
        setHistoryOpen(false);
      }}
      onDelete={(id) => void removeConversation(id)}
    />
  );

  return (
    <div className="mx-auto w-full max-w-5xl lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:gap-7">
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          className="inline-flex items-center gap-2 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-4 py-2 text-[13px] font-semibold text-(--flow-ink)/75"
          style={{ boxShadow: raised("var(--flow-magenta)") }}
        >
          <ChatsCircle weight="duotone" className="size-4 text-(--flow-magenta)" />
          Your chats{conversations.length > 0 ? ` (${conversations.length})` : ""}
        </button>
        {historyOpen && <div className="mt-3">{historyPanel}</div>}
      </div>
      <div className="hidden lg:block">{historyPanel}</div>

      <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-3xl min-w-0 flex-col">
      <div className="flex flex-1 flex-col gap-6 pb-6">
        {opening ? (
          <p className="shimmer-text pt-16 text-center font-heading text-[15px] font-semibold">Opening chat…</p>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-6 pt-8 text-center"
          >
            <span
              className="flex size-16 items-center justify-center rounded-[22px] border border-(--flow-cream) bg-linear-to-br from-(--flow-cream) to-(--flow-peach)"
              style={{ boxShadow: raised("var(--flow-coral)") }}
            >
              <Sparkle weight="duotone" className="size-8 text-(--flow-magenta)" />
            </span>
            <div>
              <h2 className="font-heading text-[30px] leading-tight font-bold tracking-tight text-(--flow-ink)">
                Ask anything about {sheetName}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[14.5px] text-(--flow-ink)/55">
                Every number comes from your real rows — the assistant explains, it never guesses.
              </p>
            </div>
            {suggestions && (
              <div className="flex flex-wrap justify-center gap-2.5">
                {suggestions.questions.map((q, i) => (
                  <motion.button
                    key={q}
                    type="button"
                    onClick={() => submit(q)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.07, ...spring }}
                    whileHover={{ y: -3, rotateX: 6 }}
                    whileTap={{ scale: 0.97 }}
                    style={{ boxShadow: raised("var(--flow-magenta)"), transformPerspective: 600 }}
                    className="rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/80 px-4 py-2.5 text-[13.5px] font-medium text-(--flow-ink)/80"
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <>
            {messages.map((m) =>
              m.role === "user" ? <UserMessage key={m.id} message={m} /> : <AssistantMessage key={m.id} message={m} />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-4 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
          className="flex items-end gap-2 rounded-[28px] border border-(--flow-cream) bg-(--flow-cream)/85 p-2.5 pl-5 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 30px 50px -24px color-mix(in oklab, var(--flow-magenta) 55%, transparent), 0 2px 0 var(--flow-cream) inset",
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={1000}
            placeholder="Which region has the highest revenue?"
            aria-label="Ask a question about your sheet"
            className="max-h-33 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-(--flow-ink) outline-none placeholder:text-(--flow-ink)/35"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--flow-ink)/10 text-(--flow-ink) transition-transform hover:scale-105 active:scale-95"
            >
              <Stop weight="fill" className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send"
              className="bg-gradient-flow flex size-11 shrink-0 items-center justify-center rounded-full text-(--flow-cream) shadow-[0_14px_24px_-10px_var(--flow-magenta)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-45 disabled:hover:scale-100"
            >
              <PaperPlaneRight weight="fill" className="size-[18px]" />
            </button>
          )}
        </form>
      </div>
      </div>
    </div>
  );
}
