"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChatsCircle,
  Check,
  PaperPlaneRight,
  Robot,
  Sparkle,
  Link,
  LockSimple,
  Plus,
  Stop,
  Table,
  TextAa,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import NextLink from "next/link";
import { GmailGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { useGmailConnection, type GmailConnection } from "@/hooks/use-gmail-connection";
import { documentAsSource, useDocuments } from "@/hooks/use-documents";
import { useNotionConnection } from "@/hooks/use-notion-connection";
import { useSlackConnection } from "@/hooks/use-slack-connection";
import { sourceLabel, useGoogleSheetsConnection, type DataSource } from "@/hooks/use-google-sheets-connection";
import {
  isEmailDraft,
  isNotionDraft,
  isSlackDraft,
  useInsightsChat,
  type ChatMessage,
  type ConversationSummary,
  type Draft,
  type DraftActions,
  type Headline,
  type Step,
  MAX_SOURCES_PER_CHAT,
} from "@/hooks/use-insights-chat";
import { EmailCard, TableCard, ValueCard } from "@/components/dashboard/insights/result-card";
import { EmailDraftCard } from "@/components/dashboard/insights/email-draft-card";
import { SlackDraftCard } from "@/components/dashboard/insights/slack-draft-card";
import { NotionDraftCard } from "@/components/dashboard/insights/notion-draft-card";

// Deep, bright accents (no blue/violet) — used to tell suggestion chips apart.
const chipAccents = [
  "var(--flow-magenta)",
  "oklch(0.66 0.12 190)",
  "oklch(0.72 0.17 55)",
  "oklch(0.66 0.21 10)",
];

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
          <span key={i} className="text-[1.15em] tabular-nums text-(--flow-magenta)">
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
        <p className="font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-magenta)">
          In words{headline.label ? ` · ${headline.label}` : ""}
        </p>
        <p className="mt-1 font-(family-name:--font-zeyada) text-[28px] leading-none font-normal text-(--flow-ink)">{headline.words}</p>
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
      className="inline-flex items-center gap-2 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-3 py-1.5 font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-ink)/85"
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

const scheduledIdOf = (d: Draft | null | undefined) => (d && isEmailDraft(d) ? (d.scheduled_id ?? "") : "");

function AssistantMessage({
  message,
  draftActions,
  gmailAccount,
}: {
  message: ChatMessage;
  draftActions: DraftActions;
  /** Which Gmail the chat reads, shown on the emails card when the user has several. */
  gmailAccount?: string | null;
}) {
  const cards = message.steps.filter(
    (s) => s.status === "done" && (s.draft || s.table || s.emails?.length || typeof s.value === "number")
  );
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
          s.draft && isNotionDraft(s.draft) ? (
            <NotionDraftCard
              key={s.id}
              draft={s.draft}
              onSave={(title, body, target) => draftActions.saveNotion(s.id, title, body, target)}
            />
          ) : s.draft && isSlackDraft(s.draft) ? (
            <SlackDraftCard
              key={s.id}
              draft={s.draft}
              onPost={(channelId, text, target) => draftActions.postSlack(s.id, channelId, text, target)}
            />
          ) : s.draft ? (
            <EmailDraftCard
              key={s.id}
              draft={s.draft}
              onSend={(fields, sender) => draftActions.send(s.id, fields, sender)}
              onSchedule={(fields, sendAtIso, sender) => draftActions.schedule(s.id, fields, sendAtIso, sender)}
              onCancelSchedule={() => draftActions.cancel(s.id, scheduledIdOf(s.draft))}
            />
          ) : s.emails?.length ? (
            <EmailCard key={s.id} emails={s.emails} account={gmailAccount} />
          ) : s.table ? (
            <TableCard key={s.id} table={s.table} />
          ) : (
            <ValueCard key={s.id} value={s.value as number} label={s.summary ?? ""} />
          )
        )}

        {waiting && message.status !== "error" && (
          <p className="shimmer-text font-(family-name:--font-zeyada) text-[26px] leading-none font-normal">{waitingLabel}</p>
        )}

        {message.content && (
          <div
            className="max-w-[46rem] rounded-3xl rounded-tl-md border border-(--flow-cream) bg-(--flow-cream)/70 px-5 py-4 font-(family-name:--font-zeyada) text-[24px] leading-snug font-normal whitespace-pre-wrap text-(--flow-ink)"
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
          <p className="flex items-center gap-2 rounded-2xl bg-(--flow-coral)/12 px-4 py-2.5 font-(family-name:--font-zeyada) text-[23px] leading-snug font-normal text-(--flow-ink)">
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
        className="bg-gradient-flow max-w-[85%] rounded-3xl rounded-br-md px-5 py-3 font-(family-name:--font-zeyada) text-[25px] leading-snug font-normal text-(--flow-cream)"
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
        className="bg-gradient-flow flex items-center justify-center gap-2 rounded-2xl px-4 py-2 font-(family-name:--font-zeyada) text-[25px] leading-none font-normal text-(--flow-cream) shadow-[0_14px_24px_-12px_var(--flow-magenta)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
      >
        <Plus weight="bold" className="size-4" />
        New chat
      </button>

      <p className="px-1.5 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-magenta)">Your chats</p>

      <div
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "var(--flow-pink) transparent" }}
      >
        {conversations.length === 0 ? (
          <p className="px-1.5 py-3 font-(family-name:--font-zeyada) text-[21px] leading-snug text-(--flow-ink)/75">
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
                  <span className="line-clamp-2 font-(family-name:--font-zeyada) text-[22px] leading-tight font-normal text-(--flow-ink)">
                    {c.title}
                  </span>
                  <span className="font-(family-name:--font-zeyada) text-[19px] leading-none text-(--flow-coral)">{timeAgo(c.updated_at)}</span>
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

function SourcePicker({
  sources,
  selected,
  gmailReady,
  gmailOn,
  gmailAccounts,
  gmailAccountId,
  gmailAccountLabel,
  onGmailAccountChange,
  locked,
  removed,
  disabled,
  onChange,
  onGmailChange,
}: {
  sources: DataSource[];
  selected: string[];
  gmailReady: boolean;
  gmailOn: boolean;
  /** Connected Gmail accounts that can be read (the choice only shows with 2 or more). */
  gmailAccounts: GmailConnection[];
  gmailAccountId: string | null;
  /** The account's address, set only when the user has several (shown on the locked chip). */
  gmailAccountLabel: string | null;
  onGmailAccountChange: (id: string) => void;
  locked: boolean;
  removed: boolean;
  disabled: boolean;
  onChange: (ids: string[]) => void;
  onGmailChange: (on: boolean) => void;
}) {
  // Once a chat has started it keeps its sheets — show them, don't offer a switch.
  if (locked) {
    const used = sources.filter((s) => selected.includes(s.id));
    return (
      <div
        className="mb-5 flex flex-wrap items-center gap-2 self-start"
        title="A chat keeps the sheets it started with. Start a new chat to use different ones."
      >
        <LockSimple weight="bold" className="size-3.5 shrink-0 text-(--flow-magenta)" />
        {(removed || used.length === 0) && !gmailOn ? (
          <span className="font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/75">Sheets removed</span>
        ) : (
          used.map((s) => (
            <span
              key={s.id}
              className="max-w-full truncate rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-3.5 py-1.5 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-ink)/85"
              style={{ boxShadow: raised("var(--flow-peach)") }}
            >
              {sourceLabel(s)}
            </span>
          ))
        )}
        {gmailOn && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-3.5 py-1.5 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-ink)/85"
            style={{ boxShadow: raised("var(--flow-peach)") }}
          >
            <GmailGlyph className="size-4 shrink-0" />
            Gmail{gmailAccountLabel ? ` · ${gmailAccountLabel}` : ""}
          </span>
        )}
      </div>
    );
  }

  const atLimit = selected.length >= MAX_SOURCES_PER_CHAT;
  // A chat needs at least one thing to ask about: a sheet or Gmail.
  const total = selected.length + (gmailOn ? 1 : 0);
  const optionCount = sources.length + (gmailReady ? 1 : 0);
  const toggle = (id: string) => {
    const on = selected.includes(id);
    if (on && total === 1) return;
    onChange(on ? selected.filter((x) => x !== id) : sources.filter((s) => s.id === id || selected.includes(s.id)).map((s) => s.id));
  };

  return (
    <div className="mb-5 flex max-w-full flex-col gap-2 self-start" role="group" aria-label="Sheets to ask about">
      <span className="px-1 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta)">
        {optionCount > 1 ? "Asking about (pick one or more)" : "Asking about"}
      </span>
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => {
          const on = selected.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={disabled || optionCount < 2 || (!on && atLimit)}
              onClick={() => toggle(s.id)}
              className={`inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-1.5 font-(family-name:--font-zeyada) text-[23px] leading-none font-normal transition-transform enabled:hover:-translate-y-0.5 enabled:active:scale-[0.97] disabled:cursor-default ${
                on
                  ? "bg-gradient-flow border-transparent text-(--flow-cream)"
                  : "border-(--flow-cream) bg-(--flow-cream)/85 text-(--flow-ink)/85 disabled:opacity-50"
              }`}
              style={{ boxShadow: raised("var(--flow-magenta)") }}
            >
              {on && <Check weight="bold" className="size-3.5 shrink-0" />}
              <span className="truncate">{sourceLabel(s)}</span>
            </button>
          );
        })}
        {gmailReady && (
          <button
            type="button"
            role="checkbox"
            aria-checked={gmailOn}
            disabled={disabled || optionCount < 2}
            onClick={() => {
              if (gmailOn && total === 1) return;
              onGmailChange(!gmailOn);
            }}
            className={`inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-1.5 font-(family-name:--font-zeyada) text-[23px] leading-none font-normal transition-transform enabled:hover:-translate-y-0.5 enabled:active:scale-[0.97] disabled:cursor-default ${
              gmailOn
                ? "bg-gradient-flow border-transparent text-(--flow-cream)"
                : "border-(--flow-cream) bg-(--flow-cream)/85 text-(--flow-ink)/85 disabled:opacity-50"
            }`}
            style={{ boxShadow: raised("var(--flow-magenta)") }}
          >
            {gmailOn ? <Check weight="bold" className="size-3.5 shrink-0" /> : <GmailGlyph className="size-4 shrink-0" />}
            <span className="truncate">Gmail (latest emails)</span>
          </button>
        )}
      </div>
      {gmailOn && gmailAccounts.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 px-1 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-ink)/80">
          Read emails from
          <select
            value={gmailAccountId ?? ""}
            disabled={disabled}
            onChange={(e) => onGmailAccountChange(e.target.value)}
            className="max-w-full cursor-pointer rounded-xl border border-(--flow-ink)/15 bg-(--flow-cream)/80 px-3 py-1.5 font-sans text-[14px] text-(--flow-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta) disabled:opacity-60"
          >
            {gmailAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.external_account_email}
                {a.is_default ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected.length > 1 && (
        <p className="flex items-center gap-1.5 px-1 font-(family-name:--font-zeyada) text-[21px] leading-none text-(--flow-ink)/80">
          <Link weight="bold" className="size-3.5 shrink-0 text-(--flow-magenta)" />
          Answers can combine these sheets — they&apos;re matched on shared columns like a name or ID.
        </p>
      )}
    </div>
  );
}

/** Slack isn't something you ask about — it's where results go. So it's a status pill, not a
 * checkbox: lit with the channel when posting is ready, a nudge to finish setup otherwise. */
function SlackStatus({ channelName, connected }: { channelName: string | null; connected: boolean }) {
  if (!connected) return null;
  const base =
    "inline-flex items-center gap-2 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-3.5 py-1.5 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-ink)/85";
  return (
    <>
      {channelName ? (
        <span
          className={base}
          style={{ boxShadow: raised("var(--flow-peach)") }}
          title="Ask AI Insights to post an answer to Slack. You review the draft before anything is posted."
        >
          <SlackGlyph aria-hidden className="size-4 shrink-0" />
          Slack ready · #{channelName}
        </span>
      ) : (
        <NextLink href="/dashboard/integrations" className={`${base} hover:-translate-y-0.5 transition-transform`}>
          <SlackGlyph aria-hidden className="size-4 shrink-0" />
          Slack connected — choose a channel to post to →
        </NextLink>
      )}
    </>
  );
}

/** Same idea for Notion: where reports can be saved, and which page they go under. */
function NotionStatus({ pageTitle, connected }: { pageTitle: string | null; connected: boolean }) {
  if (!connected) return null;
  const base =
    "inline-flex items-center gap-2 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-3.5 py-1.5 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-ink)/85";
  return pageTitle ? (
    <span
      className={base}
      style={{ boxShadow: raised("var(--flow-peach)") }}
      title="Ask AI Insights to save an answer to Notion. You review the draft before anything is saved."
    >
      <NotionGlyph aria-hidden className="size-4 shrink-0" />
      Notion ready · {pageTitle}
    </span>
  ) : (
    <NextLink href="/dashboard/integrations" className={`${base} hover:-translate-y-0.5 transition-transform`}>
      <NotionGlyph aria-hidden className="size-4 shrink-0" />
      Notion connected — choose a page to save under →
    </NextLink>
  );
}

export function InsightsChat() {
  const reduce = useReducedMotion();
  const { connection: slackConnection } = useSlackConnection();
  const { connection: notionConnection } = useNotionConnection();
  const { connection, loading } = useGoogleSheetsConnection();
  const { accounts: gmailAccounts, loading: gmailLoading } = useGmailConnection();
  const { documents, loading: documentsLoading } = useDocuments();
  // Ready documents are offered next to sheet tabs: same chips, same chat sources (the
  // backend resolves each id to a sheet tab or a document).
  const sources = useMemo(
    () => [
      ...(connection?.sources ?? []),
      ...documents.filter((d) => d.status === "ready").map(documentAsSource),
    ],
    [connection, documents]
  );
  // Accounts the agent can read mail from (connected, with the read permission).
  const readableGmail = useMemo(
    () => gmailAccounts.filter((a) => a.status === "connected" && a.can_read_mail),
    [gmailAccounts]
  );
  const gmailReady = readableGmail.length > 0;
  const ready = sources.length > 0 || gmailReady;
  const {
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
    gmailConnectionId,
    setGmailConnectionId,
    sourceRemoved,
    send,
    draftActions,
    stop,
    newChat,
    openConversation,
    removeConversation,
  } = useInsightsChat(ready, sources, gmailReady);

  // A new chat reads one specific account: keep the choice valid, defaulting to the user's
  // default account when it can be read, else the first readable one.
  useEffect(() => {
    if (conversationId !== null || readableGmail.length === 0) return;
    if (gmailConnectionId && readableGmail.some((a) => a.id === gmailConnectionId)) return;
    setGmailConnectionId((readableGmail.find((a) => a.is_default) ?? readableGmail[0]).id);
  }, [conversationId, readableGmail, gmailConnectionId, setGmailConnectionId]);

  // The account a chat reads, for labels. A saved chat with no stored account used the default.
  const chatGmail =
    gmailAccounts.find((a) => a.id === gmailConnectionId) ??
    gmailAccounts.find((a) => a.is_default) ??
    gmailAccounts[0];
  const gmailAccountLabel = gmailAccounts.length > 1 ? (chatGmail?.external_account_email ?? null) : null;
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

  if (loading || gmailLoading || documentsLoading) {
    return <p className="px-8 py-10 font-(family-name:--font-zeyada) text-[26px] leading-none text-(--flow-ink)/70">Loading…</p>;
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
          <p className="text-gradient-flow font-(family-name:--font-zeyada) text-[36px] leading-none font-normal">
            Add something to ask about
          </p>
          <p className="mt-2 font-(family-name:--font-zeyada) text-[23px] leading-snug font-normal text-(--flow-ink)/80">
            Connect a Google Sheet or Gmail, or upload an invoice or statement on the Integrations page, then ask
            questions about it here.
          </p>
        </div>
        <a
          href="/dashboard/integrations"
          className="bg-gradient-flow rounded-full px-6 py-2 font-(family-name:--font-zeyada) text-[25px] leading-none font-normal text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97]"
        >
          Add a data source
        </a>
      </CenterCard>
    );
  }

  const selectedSources = sources.filter((s) => sourceIds.includes(s.id));
  const sheetName =
    suggestions?.sheet_name ||
    [...selectedSources.map(sourceLabel), ...(useGmail ? ["Gmail"] : [])].join(" + ") ||
    "your sheet";

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
          className="inline-flex items-center gap-2 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-4 py-1.5 font-(family-name:--font-zeyada) text-[23px] leading-none font-normal text-(--flow-ink)/85"
          style={{ boxShadow: raised("var(--flow-magenta)") }}
        >
          <ChatsCircle weight="duotone" className="size-4 text-(--flow-magenta)" />
          Your chats{conversations.length > 0 ? ` (${conversations.length})` : ""}
        </button>
        {historyOpen && <div className="mt-3">{historyPanel}</div>}
      </div>
      <div className="hidden lg:block">{historyPanel}</div>

      <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-3xl min-w-0 flex-col">
      <SourcePicker
        sources={sources}
        selected={sourceIds}
        gmailReady={gmailReady}
        gmailOn={useGmail}
        onGmailChange={setUseGmail}
        gmailAccounts={readableGmail}
        gmailAccountId={gmailConnectionId}
        gmailAccountLabel={gmailAccountLabel}
        onGmailAccountChange={setGmailConnectionId}
        locked={conversationId !== null}
        removed={sourceRemoved}
        disabled={busy}
        onChange={setSourceIds}
      />
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2 self-start">
        <SlackStatus
          connected={slackConnection?.status === "connected"}
          channelName={slackConnection?.slack_channel_name ?? null}
        />
        <NotionStatus
          connected={notionConnection?.status === "connected"}
          pageTitle={notionConnection?.notion_page_title ?? null}
        />
      </div>
      {sourceRemoved && (
        <p
          role="status"
          className="mb-5 flex items-start gap-2 rounded-2xl bg-(--flow-coral)/12 px-4 py-3 font-(family-name:--font-zeyada) text-[23px] leading-snug font-normal text-(--flow-ink)"
        >
          <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-(--flow-coral)" />
          This chat&apos;s sheet was removed, so you can read it but not ask new questions. Start a new chat to ask about
          another sheet.
        </p>
      )}
      <div className="flex flex-1 flex-col gap-6 pb-6">
        {opening ? (
          <p className="shimmer-text pt-16 text-center font-(family-name:--font-zeyada) text-[28px] leading-none font-normal">Opening chat…</p>
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
              <h2 className="text-gradient-flow font-(family-name:--font-zeyada) text-[52px] leading-none font-normal">
                Ask anything about {sheetName}
              </h2>
              <p className="mx-auto mt-3 max-w-md font-(family-name:--font-zeyada) text-[26px] leading-snug font-normal text-(--flow-ink)/80">
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
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      boxShadow: raised(chipAccents[i % chipAccents.length]),
                      backgroundColor: `color-mix(in oklab, ${chipAccents[i % chipAccents.length]} 12%, var(--flow-cream))`,
                      color: chipAccents[i % chipAccents.length],
                    }}
                    className="rounded-2xl border border-(--flow-cream) px-4 py-2 font-(family-name:--font-zeyada) text-[23px] leading-none font-normal"
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
              m.role === "user" ? <UserMessage key={m.id} message={m} /> : <AssistantMessage key={m.id} message={m} draftActions={draftActions} gmailAccount={gmailAccountLabel} />
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
            disabled={sourceRemoved}
            placeholder={
              sourceRemoved
                ? "This chat's sheet was removed"
                : sourceIds.length === 0 && useGmail
                  ? "Show me my 5 most recent emails"
                  : "Which region has the highest revenue?"
            }
            aria-label="Ask a question about your sheets or email"
            className="max-h-33 min-h-10 flex-1 resize-none bg-transparent py-2 font-(family-name:--font-zeyada) text-[25px] leading-snug font-normal text-(--flow-ink) outline-none placeholder:text-(--flow-ink)/55"
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
              disabled={!draft.trim() || sourceRemoved}
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
