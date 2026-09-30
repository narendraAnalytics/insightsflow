"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LinkSimple, XCircle } from "@phosphor-icons/react";
import { GmailGlyph } from "@/components/site/brand-icons";
import { useGmailConnection } from "@/hooks/use-gmail-connection";
import { GlassSlab, StatusPill } from "@/components/dashboard/integrations/google-sheets-card";

export function GmailCard() {
  const { connection, loading, error, connect, disconnect } = useGmailConnection();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const denied = useSearchParams().get("gmail_error") === "denied";

  const isConnected = connection?.status === "connected";

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
        <StatusPill connected={isConnected} />
      </div>

      {loading ? (
        <p className="font-(family-name:--font-zeyada) text-[22px] leading-none text-(--flow-ink)/70">Checking connection…</p>
      ) : !isConnected ? (
        <div className="flex flex-col gap-3">
          <p className="font-(family-name:--font-zeyada) text-[21px] leading-snug font-normal text-(--flow-ink)/75">
            Lets InsightFlow send approved reports and read your latest email headers (sender, subject, date). Nothing is sent without your approval.
          </p>
          <div>
            <button
              type="button"
              onClick={() => void run(connect)}
              disabled={busy}
              className="bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <LinkSimple weight="bold" className="size-4" />
              Connect Gmail
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/80">
            Sending as <span className="text-(--flow-magenta)">{connection?.external_account_email}</span>
          </p>
          {connection?.can_read_mail ? (
            <p className="font-(family-name:--font-zeyada) text-[21px] leading-snug font-normal text-(--flow-ink)/75">
              AI Insights can read your latest emails (sender, subject and date only). Try asking &ldquo;Show me my 5 most recent emails&rdquo;.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void run(connect)}
              disabled={busy}
              className="w-fit rounded-full bg-(--flow-cream) px-5 py-2 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta) shadow-[0_14px_24px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              Reconnect to let AI Insights read emails
            </button>
          )}
          <div>
            <button
              type="button"
              onClick={() => void run(disconnect)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 font-(family-name:--font-zeyada) text-[21px] leading-none font-normal text-(--flow-ink)/65 transition-colors hover:text-(--flow-coral) disabled:opacity-60"
            >
              <XCircle weight="bold" className="size-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      )}

      {(error || actionError || denied) && !isConnected && (
        <p role="alert" className="font-(family-name:--font-zeyada) text-[22px] leading-snug font-normal text-(--flow-coral)">
          {actionError ?? error ?? "Gmail access wasn't granted. Connect again to allow sending."}
        </p>
      )}
    </GlassSlab>
  );
}
