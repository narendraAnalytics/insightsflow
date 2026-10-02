"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LinkSimple, Plus, Star, XCircle } from "@phosphor-icons/react";
import { GmailGlyph } from "@/components/site/brand-icons";
import { useCredits } from "@/components/billing/credits-provider";
import { useGmailConnection, type GmailConnection } from "@/hooks/use-gmail-connection";
import { GlassSlab, StatusPill } from "@/components/dashboard/integrations/google-sheets-card";

const Z = "font-(family-name:--font-zeyada)";

function AccountRow({
  account,
  several,
  busy,
  onReconnect,
  onMakeDefault,
  onDisconnect,
}: {
  account: GmailConnection;
  several: boolean;
  busy: boolean;
  onReconnect: () => void;
  onMakeDefault: () => void;
  onDisconnect: () => void;
}) {
  const live = account.status === "connected";
  return (
    <li className="flex flex-col gap-1.5 rounded-2xl bg-(--flow-cream)/70 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${Z} text-[23px] leading-none font-normal text-(--flow-ink)`}>
          {account.external_account_email ?? "Gmail account"}
        </span>
        {account.is_default && several && (
          <span className={`inline-flex items-center gap-1 rounded-full bg-(--flow-magenta)/15 px-2.5 py-0.5 ${Z} text-[18px] leading-none text-(--flow-magenta)`}>
            <Star weight="fill" className="size-3" />
            Default
          </span>
        )}
        {!live && (
          <span className={`rounded-full bg-(--flow-coral)/15 px-2.5 py-0.5 ${Z} text-[18px] leading-none text-(--flow-coral)`}>
            Expired
          </span>
        )}
      </div>
      <p className={`${Z} text-[19px] leading-snug font-normal text-(--flow-ink)/70`}>
        {account.can_read_mail ? "Sends approved email and reads recent headers" : "Sends approved email"}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {(!live || !account.can_read_mail) && (
          <button
            type="button"
            onClick={onReconnect}
            disabled={busy}
            className={`${Z} text-[20px] leading-none font-normal text-(--flow-magenta) hover:underline disabled:opacity-60`}
          >
            {live ? "Reconnect to read emails" : "Reconnect"}
          </button>
        )}
        {several && !account.is_default && live && (
          <button
            type="button"
            onClick={onMakeDefault}
            disabled={busy}
            className={`${Z} text-[20px] leading-none font-normal text-(--flow-ink)/70 hover:text-(--flow-magenta) disabled:opacity-60`}
          >
            Make default
          </button>
        )}
        <button
          type="button"
          onClick={onDisconnect}
          disabled={busy}
          className={`inline-flex items-center gap-1 ${Z} text-[20px] leading-none font-normal text-(--flow-ink)/65 transition-colors hover:text-(--flow-coral) disabled:opacity-60`}
        >
          <XCircle weight="bold" className="size-3.5" />
          Disconnect
        </button>
      </div>
    </li>
  );
}

export function GmailCard() {
  const { accounts, loading, error, connect, disconnect, makeDefault } = useGmailConnection();
  const { connectCost } = useCredits();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const flag = useSearchParams().get("gmail_error");

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
            <GmailGlyph className="size-9" />
          </span>
          <div>
            <p className="text-gradient-flow font-(family-name:--font-zeyada) text-[38px] leading-none font-normal">
              Gmail
            </p>
            <p className="mt-1 max-w-[26ch] font-(family-name:--font-zeyada) text-[22px] leading-snug font-normal text-(--flow-ink)/80">
              Send reports and read recent emails
            </p>
          </div>
        </div>
        <StatusPill connected={hasAccounts && accounts.some((a) => a.status === "connected")} />
      </div>

      {loading ? (
        <p className="font-(family-name:--font-zeyada) text-[22px] leading-none text-(--flow-ink)/70">Checking connection…</p>
      ) : !hasAccounts ? (
        <div className="flex flex-col gap-3">
          <p className="font-(family-name:--font-zeyada) text-[21px] leading-snug font-normal text-(--flow-ink)/75">
            Lets InsightFlow send approved reports and read your latest email headers (sender, subject, date). Nothing is sent without your approval.
          </p>
          <div>
            <button
              type="button"
              onClick={() => void run(() => connect())}
              disabled={busy}
              className="bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <LinkSimple weight="bold" className="size-4" />
              Connect Gmail · {connectCost} credits
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2.5">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                several={accounts.length > 1}
                busy={busy}
                onReconnect={() => void run(() => connect({ reconnect: true }))}
                onMakeDefault={() => void run(() => makeDefault(account.id))}
                onDisconnect={() => void run(() => disconnect(account.id))}
              />
            ))}
          </ul>
          <div>
            <button
              type="button"
              onClick={() => void run(() => connect())}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--flow-cream) px-5 py-2 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta) shadow-[0_14px_24px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <Plus weight="bold" className="size-4" />
              Connect another Gmail · {connectCost} credits
            </button>
          </div>
        </div>
      )}

      {(error || actionError || flag === "denied" || flag === "limit") && (
        <p role="alert" className="font-(family-name:--font-zeyada) text-[22px] leading-snug font-normal text-(--flow-coral)">
          {actionError ??
            error ??
            (flag === "limit"
              ? "You've reached the limit of 5 Gmail accounts. Disconnect one first."
              : "Gmail access wasn't granted. Connect again to allow sending.")}
        </p>
      )}
    </GlassSlab>
  );
}
