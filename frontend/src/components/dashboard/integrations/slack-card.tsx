"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Hash, LinkSimple, XCircle } from "@phosphor-icons/react";
import { SlackGlyph } from "@/components/site/brand-icons";
import { useSlackConnection, type SlackChannel } from "@/hooks/use-slack-connection";
import { GlassSlab, StatusPill } from "@/components/dashboard/integrations/google-sheets-card";

const zeyada = "font-(family-name:--font-zeyada) font-normal";

export function SlackCard() {
  const { connection, loading, error, connect, disconnect, loadChannels, setChannel } = useSlackConnection();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [channels, setChannels] = useState<SlackChannel[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const selectId = useId();
  const denied = useSearchParams().get("slack_error") === "denied";

  const isConnected = connection?.status === "connected";
  const channelName = connection?.slack_channel_name ?? null;
  const needsChannel = isConnected && !channelName;
  const showPicker = isConnected && (needsChannel || changing);

  // Fetch the workspace's channels only when the picker is actually on screen.
  useEffect(() => {
    if (!showPicker || channels !== null) return;
    let cancelled = false;
    loadChannels()
      .then((list) => {
        if (!cancelled) setChannels(list);
      })
      .catch((err) => {
        if (!cancelled) setChannelsError(err instanceof Error ? err.message : "Couldn't load your channels.");
      });
    return () => {
      cancelled = true;
    };
  }, [showPicker, channels, loadChannels]);

  const run = async (action: () => Promise<void>) => {
    setActionError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const pick = (id: string) =>
    run(async () => {
      await setChannel(id);
      setChanging(false);
    });

  return (
    <GlassSlab>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex size-16 items-center justify-center rounded-[20px] border border-(--flow-cream) bg-linear-to-br from-(--flow-cream) to-(--flow-peach)"
            style={{
              boxShadow:
                "0 18px 26px -14px color-mix(in oklab, var(--flow-coral) 55%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.9)",
            }}
          >
            <SlackGlyph className="size-9" />
          </span>
          <div>
            <p className={`text-gradient-flow ${zeyada} text-[38px] leading-none`}>Slack</p>
            <p className={`mt-1 max-w-[26ch] ${zeyada} text-[22px] leading-snug text-(--flow-ink)/80`}>
              Post approved reports to your team
            </p>
          </div>
        </div>
        <StatusPill connected={isConnected} />
      </div>

      {loading ? (
        <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/70`}>Checking connection…</p>
      ) : !isConnected ? (
        <div className="flex flex-col gap-3">
          <p className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
            Lets InsightFlow post a message to a channel you choose. It can only post after you review and click Post —
            it never reads your messages.
          </p>
          <div>
            <button
              type="button"
              onClick={() => void run(connect)}
              disabled={busy}
              className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 ${zeyada} text-[24px] leading-none text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60`}
            >
              <LinkSimple weight="bold" className="size-4" />
              Connect Slack
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/80`}>
            Workspace <span className="text-(--flow-magenta)">{connection?.external_account_email}</span>
          </p>

          {showPicker ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={selectId} className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
                {needsChannel ? "Choose where approved posts go" : "Post to a different channel"}
              </label>
              <select
                id={selectId}
                value={connection?.slack_channel_id ?? ""}
                disabled={busy || channels === null}
                onChange={(e) => e.target.value && void pick(e.target.value)}
                className="w-full max-w-xs rounded-xl border border-(--flow-ink)/15 bg-(--flow-cream)/80 px-3 py-2 text-[14px] text-(--flow-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta) disabled:opacity-60"
              >
                <option value="" disabled>
                  {channels === null && !channelsError ? "Loading channels…" : "Select a channel"}
                </option>
                {(channels ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    # {c.name}
                  </option>
                ))}
              </select>
              {channels?.length === 0 && (
                <p className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/65`}>
                  No public channels found in this workspace.
                </p>
              )}
              {changing && (
                <button
                  type="button"
                  onClick={() => setChanging(false)}
                  className={`w-fit ${zeyada} text-[20px] leading-none text-(--flow-ink)/65 hover:text-(--flow-magenta)`}
                >
                  Keep #{channelName}
                </button>
              )}
              {channelsError && (
                <p role="alert" className={`${zeyada} text-[21px] leading-snug text-(--flow-coral)`}>
                  {channelsError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/80`}>
                Posts go to{" "}
                <span className="inline-flex items-center gap-0.5 text-(--flow-magenta)">
                  <Hash weight="bold" className="size-3.5" />
                  {channelName}
                </span>
              </p>
              <p className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
                In AI Insights, ask &ldquo;post this to Slack&rdquo; and review the draft before it goes out.
              </p>
              <button
                type="button"
                onClick={() => {
                  setChannelsError(null);
                  setChanging(true);
                }}
                className={`w-fit rounded-full bg-(--flow-cream) px-4 py-1.5 ${zeyada} text-[21px] leading-none text-(--flow-magenta) shadow-[0_14px_24px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97]`}
              >
                Change channel
              </button>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => void run(disconnect)}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 ${zeyada} text-[21px] leading-none text-(--flow-ink)/65 transition-colors hover:text-(--flow-coral) disabled:opacity-60`}
            >
              <XCircle weight="bold" className="size-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      )}

      {(error || actionError || denied) && !isConnected && (
        <p role="alert" className={`${zeyada} text-[22px] leading-snug text-(--flow-coral)`}>
          {actionError ?? error ?? "Slack access wasn't granted. Connect again to allow posting."}
        </p>
      )}
      {actionError && isConnected && (
        <p role="alert" className={`${zeyada} text-[22px] leading-snug text-(--flow-coral)`}>
          {actionError}
        </p>
      )}
    </GlassSlab>
  );
}
