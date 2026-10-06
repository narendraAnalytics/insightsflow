"use client";

import { useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { CheckCircle, DownloadSimple, FilePdf, Trash, UserMinus } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { buildReportHtml, printReport, type ExportData } from "@/lib/export-report";
import { ConfirmDeleteDialog } from "@/components/dashboard/settings/confirm-delete-dialog";

const Z = "font-(family-name:--font-zeyada)";
const CARD = "rounded-[26px] border border-(--flow-cream) bg-(--flow-cream) p-5";
const CARD_SHADOW = { boxShadow: "0 24px 40px -28px color-mix(in oklab, var(--flow-magenta) 45%, transparent)" };

type Deleted = Record<string, number>;

const LABELS: [string, string][] = [
  ["connections", "connected account"],
  ["data_sources", "sheet tab"],
  ["documents", "document"],
  ["chats", "chat"],
  ["automations", "automation"],
  ["scheduled_emails", "scheduled email"],
];

const summarise = (d: Deleted) =>
  LABELS.filter(([k]) => (d[k] ?? 0) > 0)
    .map(([k, label]) => `${d[k]} ${label}${d[k] === 1 ? "" : "s"}`)
    .join(", ") || "nothing (there was no data)";

export function DataSettings() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dataOpen, setDataOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [removed, setRemoved] = useState<Deleted | null>(null);

  const exportAs = async (kind: "pdf" | "json") => {
    setExporting(kind);
    setExportError(null);
    try {
      const data = await apiFetch<ExportData>("/api/v1/account/export", await getToken());
      if (kind === "pdf") {
        await printReport(buildReportHtml(data));
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `insightflow-data-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Couldn't prepare your download. Try again.");
    } finally {
      setExporting(null);
    }
  };

  const deleteData = async () => {
    const res = await apiFetch<{ deleted: Deleted }>("/api/v1/account/delete-data", await getToken(), {
      method: "POST",
      body: { confirm: "DELETE" },
    });
    setRemoved(res.deleted);
    setDataOpen(false);
  };

  const deleteAccount = async () => {
    await apiFetch<void>("/api/v1/account/delete", await getToken(), {
      method: "POST",
      body: { confirm: "DELETE" },
    });
    // The Clerk user is gone, so signing out can fail; either way we leave for the home page.
    try {
      await signOut({ redirectUrl: "/" });
    } catch {
      window.location.assign("/");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className={CARD} style={CARD_SHADOW}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <p className={`text-gradient-flow ${Z} text-[30px] leading-none font-normal`}>Download your data</p>
            <p className={`mt-1 ${Z} text-[21px] leading-snug font-normal text-(--flow-ink)/70`}>
              A readable report of your profile, connected accounts, sheets, chats, automations and credit
              history. Sign-in tokens are never included.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <button
              type="button"
              onClick={() => void exportAs("pdf")}
              disabled={exporting !== null}
              className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 ${Z} text-[23px] leading-none font-normal text-(--flow-cream) disabled:opacity-60`}
              style={{ boxShadow: "0 18px 30px -14px var(--flow-magenta)" }}
            >
              <FilePdf weight="bold" className="size-4" />
              {exporting === "pdf" ? "Preparing…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={() => void exportAs("json")}
              disabled={exporting !== null}
              title="The same data as a JSON file, for other tools"
              className={`inline-flex items-center gap-1.5 ${Z} text-[19px] leading-none font-normal text-(--flow-ink)/60 transition-colors hover:text-(--flow-magenta) disabled:opacity-50`}
            >
              <DownloadSimple weight="bold" className="size-3.5" />
              {exporting === "json" ? "Preparing…" : "Raw data (JSON)"}
            </button>
          </div>
        </div>
        <p className={`mt-2 ${Z} text-[18px] leading-snug font-normal text-(--flow-ink)/50`}>
          The PDF opens your browser&apos;s print window: choose &ldquo;Save as PDF&rdquo; as the destination.
        </p>
        {exportError && (
          <p role="alert" className={`mt-3 ${Z} text-[20px] leading-snug text-(--flow-coral)`}>{exportError}</p>
        )}
      </section>

      {removed && (
        <section
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-(--flow-mint)/50 bg-(--flow-mint)/20 p-5"
        >
          <div className="flex items-start gap-3">
            <CheckCircle weight="fill" className="mt-0.5 size-6 shrink-0 text-[oklch(0.55_0.15_160)]" />
            <p className={`${Z} text-[22px] leading-snug font-normal text-(--flow-ink)`}>
              Removed {summarise(removed)}. Your account and credits are untouched.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.assign("/dashboard")}
            className={`rounded-full bg-(--flow-cream) px-5 py-2 ${Z} text-[21px] leading-none font-normal text-(--flow-magenta)`}
          >
            Back to dashboard
          </button>
        </section>
      )}

      <section
        className="rounded-[26px] border border-(--flow-coral)/45 bg-(--flow-cream) p-5"
        style={{ boxShadow: "0 24px 40px -30px color-mix(in oklab, var(--flow-coral) 60%, transparent)" }}
      >
        <p className={`${Z} text-[30px] leading-none font-normal text-(--flow-coral)`}>Danger zone</p>
        <p className={`mt-1 ${Z} text-[21px] leading-snug font-normal text-(--flow-ink)/70`}>
          These can&apos;t be undone. Download your data first if you might want it.
        </p>

        <div className="mt-4 flex flex-col divide-y divide-(--flow-ink)/10">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
            <div className="max-w-xl">
              <p className={`${Z} text-[24px] leading-none font-normal text-(--flow-ink)`}>Delete my data</p>
              <p className={`mt-1 ${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/70`}>
                Disconnects every app and removes your sheets, documents, chats, automations and scheduled emails.
                Your account and credits stay.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDataOpen(true)}
              className={`inline-flex items-center gap-2 rounded-full border border-(--flow-coral) px-5 py-2 ${Z} text-[22px] leading-none font-normal text-(--flow-coral) transition-colors hover:bg-(--flow-coral)/10`}
            >
              <Trash weight="bold" className="size-4" />
              Delete data
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <div className="max-w-xl">
              <p className={`${Z} text-[24px] leading-none font-normal text-(--flow-ink)`}>Delete my account</p>
              <p className={`mt-1 ${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/70`}>
                Deletes your sign-in and everything above, plus your credit balance and payment history here.
                Unused credits are lost and not refunded.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className={`inline-flex items-center gap-2 rounded-full bg-(--flow-coral) px-5 py-2 ${Z} text-[22px] leading-none font-normal text-(--flow-cream) shadow-[0_14px_24px_-14px_var(--flow-coral)] transition-all hover:brightness-105`}
            >
              <UserMinus weight="bold" className="size-4" />
              Delete account
            </button>
          </div>
        </div>
      </section>

      <p className={`px-1 ${Z} text-[19px] leading-snug font-normal text-(--flow-ink)/55`}>
        Slack and Google access is revoked when you delete. Notion can&apos;t be revoked from here, so remove
        InsightFlow in Notion&apos;s Settings → Connections too.
      </p>

      <ConfirmDeleteDialog
        open={dataOpen}
        onOpenChange={setDataOpen}
        title="Delete all my data"
        removes={[
          "Every connected Gmail, Sheets, Slack and Notion account",
          "All sheets, documents and chats",
          "All automations and any emails still scheduled (they won't send)",
        ]}
        keeps={["Your account and sign-in", "Your credit balance and payment history"]}
        confirmLabel="Delete my data"
        onConfirm={deleteData}
      />
      <ConfirmDeleteDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        title="Delete my account"
        removes={[
          "Your sign-in and profile",
          "Everything listed under Delete my data",
          "Your credit balance (no refund) and payment history in InsightFlow",
        ]}
        confirmLabel="Delete my account"
        onConfirm={deleteAccount}
      />
    </div>
  );
}
