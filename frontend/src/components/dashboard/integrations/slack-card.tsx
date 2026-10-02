"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Hash, LinkSimple, Plus, Star, XCircle } from "@phosphor-icons/react";
import { SlackGlyph } from "@/components/site/brand-icons";
import { useCredits } from "@/components/billing/credits-provider";
import { useSlackConnection, type SlackChannel, type SlackConnection } from "@/hooks/use-slack-connection";
import { GlassSlab, StatusPill } from "@/components/dashboard/integrations/google-sheets-card";

const zeyada = "font-(family-name:--font-zeyada) font-normal";

/** What happens on Slack's page, so the user isn't surprised by it. Shown before connecting. */
function ConnectGuide({ cost }: { cost: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-(--flow-peach)/45 px-4 py-3">
      <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)`}>How connecting works</p>
      <ol className={`list-decimal space-y-0.5 pl-5 ${zeyada} text-[20px] leading-snug text-(--flow-ink)/80`}>
        <li>Slack opens. Choose <strong className="font-normal text-(--flow-magenta)">your workspace</strong> from the menu at its top right.</li>
        <li>Click Allow. You&apos;ll come back here, and {cost} credits are used once it&apos;s saved.</li>
        <li>Pick a channel, then send a test message to see it work.</li>
      </ol>
      <p className={`${zeyada} text-[19px] leading-snug text-(--flow-ink)/65`}>
        Slack asks for an admin&apos;s approval in some workspaces. If you see &ldquo;request to install&rdquo;,
        send the request and connect again once it&apos;s approved. Nothing is charged until then. InsightFlow only
        posts after you review a draft, and never reads your messages.
      </p>
    </div>
  );
}

/** One connected workspace: its default channel, plus Make default / Reconnect / Disconnect. */
function WorkspaceRow({
  account,
  several,
  busy,
  loadChannels,
  setChannel,
  sendTest,
  onReconnect,
  onMakeDefault,
  onDisconnect,
  run,
}: {
  account: SlackConnection;
  several: boolean;
  busy: boolean;
  loadChannels: (id: string) => Promise<SlackChannel[]>;
  setChannel: (id: string, channelId: string) => Promise<void>;
  sendTest: (id: string) => Promise<{ channel_name: string }>;
  onReconnect: () => void;
  onMakeDefault: () => void;
  onDisconnect: () => void;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [channels, setChannels] = useState<SlackChannel[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const selectId = useId();

  const live = account.status === "connected";
  const channelName = account.slack_channel_name;
  const needsChannel = live && !channelName;
  const showPicker = live && (needsChannel || changing);

  // Fetch this workspace's channels only when its picker is actually on screen.
  useEffect(() => {
    if (!showPicker || channels !== null) return;
    let cancelled = false;
    loadChannels(account.id)
      .then((list) => {
        if (!cancelled) setChannels(list);
      })
      .catch((err) => {
        if (!cancelled) setChannelsError(err instanceof Error ? err.message : "Couldn't load your channels.");
      });
    return () => {
      cancelled = true;
    };
  }, [showPicker, channels, loadChannels, account.id]);

  const pick = (id: string) =>
    run(async () => {
      await setChannel(account.id, id);
      setChanging(false);
    });

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-(--flow-cream)/70 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${zeyada} text-[23px] leading-none text-(--flow-ink)`}>
          {account.external_account_email ?? "Slack workspace"}
        </span>
        {account.is_default && several && (
          <span className={`inline-flex items-center gap-1 rounded-full bg-(--flow-magenta)/15 px-2.5 py-0.5 ${zeyada} text-[18px] leading-none text-(--flow-magenta)`}>
            <Star weight="fill" className="size-3" />
            Default
          </span>
        )}
        {!live && (
          <span className={`rounded-full bg-(--flow-coral)/15 px-2.5 py-0.5 ${zeyada} text-[18px] leading-none text-(--flow-coral)`}>
            Not connected
          </span>
        )}
      </div>

      {showPicker ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={selectId} className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/75`}>
            {needsChannel ? "Choose where approved posts go" : "Post to a different channel"}
          </label>
          <select
            id={selectId}
            value={account.slack_channel_id ?? ""}
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
            <p className={`${zeyada} text-[19px] leading-snug text-(--flow-ink)/65`}>
              No public channels found in this workspace.
            </p>
          )}
          {changing && (
            <button
              type="button"
              onClick={() => setChanging(false)}
              className={`w-fit ${zeyada} text-[19px] leading-none text-(--flow-ink)/65 hover:text-(--flow-magenta)`}
            >
              Keep #{channelName}
            </button>
          )}
          {channelsError && (
            <p role="alert" className={`${zeyada} text-[20px] leading-snug text-(--flow-coral)`}>
              {channelsError}
            </p>
          )}
        </div>
      ) : (
        live && (
          <p className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/75`}>
            Posts go to{" "}
            <span className="inline-flex items-center gap-0.5 text-(--flow-magenta)">
              <Hash weight="bold" className="size-3.5" />
              {channelName}
            </span>
          </p>
        )
      )}

      {testResult && (
        <p role="status" className={`${zeyada} text-[20px] leading-snug text-(--flow-magenta)`}>
          {testResult}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {live && channelName && !showPicker && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setTestResult(null);
              void run(async () => {
                const res = await sendTest(account.id);
                setTestResult(`Test message sent to #${res.channel_name}. Check Slack.`);
              });
            }}
            className={`${zeyada} text-[20px] leading-none text-(--flow-magenta) hover:underline disabled:opacity-60`}
          >
            Send a test message
          </button>
        )}
        {live && !showPicker && (
          <button
            type="button"
            onClick={() => {
              setChannelsError(null);
              setChanging(true);
            }}
            className={`${zeyada} text-[20px] leading-none text-(--flow-magenta) hover:underline`}
          >
            Change channel
          </button>
        )}
        {!live && (
          <button
            type="button"
            onClick={onReconnect}
            disabled={busy}
            className={`${zeyada} text-[20px] leading-none text-(--flow-magenta) hover:underline disabled:opacity-60`}
          >
            Reconnect
          </button>
        )}
        {several && !account.is_default && live && (
          <button
            type="button"
            onClick={onMakeDefault}
            disabled={busy}
            className={`${zeyada} text-[20px] leading-none text-(--flow-ink)/70 hover:text-(--flow-magenta) disabled:opacity-60`}
          >
            Make default
          </button>
        )}
        <button
          type="button"
          onClick={onDisconnect}
          disabled={busy}
          className={`inline-flex items-center gap-1 ${zeyada} text-[20px] leading-none text-(--flow-ink)/65 transition-colors hover:text-(--flow-coral) disabled:opacity-60`}
        >
          <XCircle weight="bold" className="size-3.5" />
          Disconnect
        </button>
      </div>
    </li>
  );
}

export function SlackCard() {
  const { accounts, loading, error, connect, disconnect, makeDefault, loadChannels, setChannel, sendTest } =
    useSlackConnection();
  const { connectCost } = useCredits();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const flag = useSearchParams().get("slack_error");

  const hasAccounts = accounts.length > 0;

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
        <StatusPill connected={accounts.some((a) => a.status === "connected")} />
      </div>

      {loading ? (
        <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/70`}>Checking connection…</p>
      ) : !hasAccounts ? (
        <div className="flex flex-col gap-3">
          <p className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
            Lets InsightFlow post a message to a channel you choose. It can only post after you review and click Post —
            it never reads your messages.
          </p>
          <ConnectGuide cost={connectCost} />
          <div>
            <button
              type="button"
              onClick={() => void run(() => connect())}
              disabled={busy}
              className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 ${zeyada} text-[24px] leading-none text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60`}
            >
              <LinkSimple weight="bold" className="size-4" />
              Connect Slack · {connectCost} credits
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2.5">
            {accounts.map((account) => (
              <WorkspaceRow
                key={account.id}
                account={account}
                several={accounts.length > 1}
                busy={busy}
                loadChannels={loadChannels}
                setChannel={setChannel}
                sendTest={sendTest}
                run={run}
                onReconnect={() => void run(() => connect({ reconnect: true }))}
                onMakeDefault={() => void run(() => makeDefault(account.id))}
                onDisconnect={() => void run(() => disconnect(account.id))}
              />
            ))}
          </ul>
          <p className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/70`}>
            In AI Insights, ask &ldquo;post this to Slack&rdquo; and review the draft before it goes out. To add another
            workspace, choose it from the menu at the top right of Slack&apos;s page (it must be one you belong to).
          </p>
          <div>
            <button
              type="button"
              onClick={() => void run(() => connect())}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--flow-cream) px-5 py-2 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta) shadow-[0_14px_24px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <Plus weight="bold" className="size-4" />
              Connect another workspace · {connectCost} credits
            </button>
          </div>
        </div>
      )}

      {(error || actionError || flag === "denied" || flag === "limit") && (
        <p role="alert" className={`${zeyada} text-[22px] leading-snug text-(--flow-coral)`}>
          {actionError ??
            error ??
            (flag === "limit"
              ? "You've reached the limit of 5 Slack workspaces. Disconnect one first."
              : "Slack didn't finish connecting. If your workspace needs an admin to approve apps, send the request and connect again once it's approved. Nothing was charged.")}
        </p>
      )}
    </GlassSlab>
  );
}
