"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowCounterClockwise, CheckCircle, Hash, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react";
import type { SlackDraft, SlackTarget } from "@/hooks/use-insights-chat";
import { useSlackConnection } from "@/hooks/use-slack-connection";

const zeyada = "font-(family-name:--font-zeyada) font-normal";
const cardShadow = "0 24px 36px -22px color-mix(in oklab, var(--flow-magenta) 50%, transparent)";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta)";

function postedWhen(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * A Slack message the AI drafted. The user can edit it; it only reaches Slack when they
 * click Post (the approval step) — the agent itself cannot post.
 */
export function SlackDraftCard({
  draft,
  onPost,
}: {
  draft: SlackDraft;
  onPost: (channelId: string, text: string, target?: SlackTarget) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  // With several workspaces the user picks where it goes; each posts to its own default channel.
  const { accounts } = useSlackConnection();
  const targets = accounts.filter((a) => a.status === "connected" && a.slack_channel_id);
  const [targetId, setTargetId] = useState<string | null>(null);
  const chosen =
    targets.find((a) => a.id === targetId) ??
    targets.find((a) => a.slack_channel_id === draft.channel_id) ??
    targets.find((a) => a.is_default) ??
    targets[0];
  const multi = targets.length > 1 && chosen !== undefined;
  const destination = multi ? `#${chosen.slack_channel_name}` : `#${draft.channel_name}`;
  const [text, setText] = useState(draft.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Grow the box to fit its text instead of scrolling inside it.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, discarded, draft.status]);

  const canPost = text.trim() !== "" && !busy;

  const post = async () => {
    if (!canPost) return;
    setError(null);
    setBusy(true);
    try {
      if (multi && chosen.slack_channel_id) {
        await onPost(chosen.slack_channel_id, text.trim(), {
          id: chosen.id,
          workspace: chosen.external_account_email ?? "",
        });
      } else {
        await onPost(draft.channel_id, text.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post to Slack. Try again.");
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode, key: string) => (
    <motion.div
      key={key}
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -6, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      style={{ boxShadow: cardShadow }}
      className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/80"
    >
      {key === "edit" && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-(--flow-magenta) via-(--flow-coral) to-(--flow-amber)"
        />
      )}
      {children}
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait" initial={false}>
      {draft.status === "sent" ? (
        shell(
          <div className="flex items-start gap-3 px-4 py-3.5">
            <motion.span
              initial={reduce ? false : { scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 14 }}
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-(--flow-mint)"
            >
              <CheckCircle weight="fill" className="size-6 text-(--flow-cream)" />
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className={`truncate ${zeyada} text-[26px] leading-none text-(--flow-ink)`}>
                Posted to #{draft.channel_name}
              </p>
              {draft.workspace && <p className="truncate text-[12.5px] text-(--flow-ink)/65">in {draft.workspace}</p>}
              <p className="mt-1.5 rounded-xl bg-(--flow-peach)/40 px-3 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-(--flow-ink)/85">
                {draft.text}
              </p>
              {postedWhen(draft.sent_at) && (
                <p className={`mt-1 ${zeyada} text-[20px] leading-none text-(--flow-ink)/60`}>
                  {postedWhen(draft.sent_at)}
                </p>
              )}
            </div>
          </div>,
          "sent"
        )
      ) : discarded ? (
        shell(
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/70`}>
              Draft discarded. Nothing was posted.
            </p>
            <button
              type="button"
              onClick={() => setDiscarded(false)}
              className={`inline-flex items-center gap-1.5 rounded-full ${zeyada} text-[22px] leading-none text-(--flow-magenta) ${focusRing}`}
            >
              <ArrowCounterClockwise weight="bold" className="size-3.5" />
              Restore
            </button>
          </div>,
          "discarded"
        )
      ) : (
        shell(
          <>
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-(--flow-magenta) to-(--flow-coral) shadow-[0_8px_14px_-8px_var(--flow-magenta)]">
                  <Hash weight="bold" className="size-4 text-(--flow-cream)" />
                </span>
                <p className={`${zeyada} text-[26px] leading-none text-(--flow-ink)`}>Slack message</p>
              </div>
              <span
                className={`rounded-full bg-(--flow-amber)/45 px-2.5 py-1 ${zeyada} text-[19px] leading-none text-(--flow-ink)`}
              >
                Not posted yet
              </span>
            </div>

            <div className="px-4 pt-1 pb-4">
              {multi ? (
                <div className="flex items-center gap-2 pt-1">
                  <label htmlFor={`${uid}-to`} className={`${zeyada} text-[22px] leading-none text-(--flow-magenta)`}>
                    To
                  </label>
                  <select
                    id={`${uid}-to`}
                    value={chosen.id}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="min-w-0 flex-1 cursor-pointer rounded-lg bg-transparent py-1 text-[14px] text-(--flow-ink) outline-none focus-visible:ring-2 focus-visible:ring-(--flow-magenta)/50"
                  >
                    {targets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.external_account_email} · #{a.slack_channel_name}
                        {a.is_default ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className={`pt-1 ${zeyada} text-[22px] leading-none text-(--flow-magenta)`}>
                  To <span className="text-(--flow-ink)">{destination}</span>
                </p>
              )}
              <label htmlFor={`${uid}-text`} className="sr-only">
                Message
              </label>
              <textarea
                id={`${uid}-text`}
                ref={textRef}
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={3000}
                className="mt-2 block max-h-80 w-full resize-none rounded-xl bg-(--flow-peach)/40 px-3.5 py-3 text-[14px] leading-relaxed text-(--flow-ink) outline-none placeholder:text-(--flow-ink)/35 focus-visible:ring-2 focus-visible:ring-(--flow-magenta)/50"
              />

              {error && (
                <p role="alert" className="mt-2.5 flex items-start gap-1.5 text-[13px] text-(--flow-coral-700)">
                  <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className={`${zeyada} text-[20px] leading-none text-(--flow-ink)/60`}>
                  Posts as InsightFlow when you click Post.
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDiscarded(true)}
                    disabled={busy}
                    className={`rounded-full px-3 py-1.5 ${zeyada} text-[22px] leading-none text-(--flow-ink)/70 transition-colors hover:bg-(--flow-pink)/40 disabled:opacity-40 ${focusRing}`}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={post}
                    disabled={!canPost}
                    className={`group inline-flex items-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-(--flow-magenta) to-(--flow-coral) px-5 py-2 ${zeyada} text-[24px] leading-none text-(--flow-cream) shadow-[0_14px_22px_-12px_var(--flow-magenta)] transition-[transform,opacity,box-shadow] hover:-translate-y-0.5 active:translate-y-0 disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none ${focusRing}`}
                  >
                    {busy ? "Posting" : "Post to Slack"}
                    <PaperPlaneTilt weight="fill" className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </>,
          "edit"
        )
      )}
    </AnimatePresence>
  );
}
