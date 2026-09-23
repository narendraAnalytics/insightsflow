"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Eye, Hash, LinkSimple, Rows, Table, XCircle } from "@phosphor-icons/react";
import { GoogleSheetsGlyph } from "@/components/site/brand-icons";
import { useGoogleSheetsConnection, type GoogleSheetsConnection } from "@/hooks/use-google-sheets-connection";
import { openGoogleSheetsPicker } from "@/lib/google-picker";
import { SheetPreviewModal } from "@/components/dashboard/integrations/sheet-preview-modal";

const chipAccents = [
  "var(--flow-magenta)",
  "var(--flow-cyan)",
  "var(--flow-coral)",
  "var(--flow-lavender)",
  "var(--flow-pink)",
];

function SyncedCheckBadge() {
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center">
      <motion.span
        aria-hidden="true"
        initial={{ scale: 0.4, opacity: 0.7 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute inset-0 rounded-full bg-(--flow-cyan)/40"
      />
      <motion.span
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.1 }}
        className="relative flex size-9 items-center justify-center rounded-full bg-(--flow-cyan)"
      >
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="var(--flow-cream)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
          />
        </motion.svg>
      </motion.span>
    </span>
  );
}

function SheetLoadedState({
  connection,
  onView,
}: {
  connection: GoogleSheetsConnection;
  onView: () => void;
}) {
  const headers = connection.google_sheet_headers ?? [];

  return (
    <motion.div
      key={connection.google_sheet_id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel flex flex-col gap-4 rounded-xl p-4"
    >
      <div className="flex items-center gap-3">
        <SyncedCheckBadge />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-(--flow-ink)">
            {connection.google_sheet_name}
          </p>
          <p className="text-[11.5px] font-medium text-(--flow-cyan)">Synced successfully</p>
        </div>
        <button
          type="button"
          onClick={onView}
          title="View sheet"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-(--flow-ink)/6 px-3 py-1.5 text-[11.5px] font-semibold text-(--flow-ink)/70 transition-colors hover:bg-(--flow-ink)/10"
        >
          <Eye weight="bold" className="size-3.5" />
          View
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-2.5 rounded-lg bg-(--flow-ink)/4 px-3 py-2.5">
          <Rows weight="fill" className="size-4 text-(--flow-magenta)" />
          <div>
            <p className="font-heading text-[17px] leading-none font-semibold tabular-nums text-(--flow-ink)">
              {connection.google_sheet_row_count ?? 0}
            </p>
            <p className="text-[10.5px] font-medium text-(--flow-ink)/45">Rows</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg bg-(--flow-ink)/4 px-3 py-2.5">
          <Hash weight="bold" className="size-4 text-(--flow-coral)" />
          <div>
            <p className="font-heading text-[17px] leading-none font-semibold tabular-nums text-(--flow-ink)">
              {headers.length}
            </p>
            <p className="text-[10.5px] font-medium text-(--flow-ink)/45">Columns</p>
          </div>
        </div>
      </div>

      {headers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {headers.map((header, i) => (
            <span
              key={`${header}-${i}`}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-(--flow-ink)/70"
              style={{ backgroundColor: `color-mix(in oklab, ${chipAccents[i % chipAccents.length]} 16%, transparent)` }}
            >
              {header}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function GoogleSheetsCard() {
  const { connection, loading, error, connect, getPickerToken, selectSheet, disconnect, getSheetPreview } =
    useGoogleSheetsConnection();
  const [busy, setBusy] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isConnected = connection?.status === "connected";
  const hasSheet = Boolean(connection?.google_sheet_id);

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connect();
    } finally {
      setBusy(false);
    }
  };

  const handlePickSheet = async () => {
    setPickerError(null);
    setBusy(true);
    try {
      const { access_token, app_id } = await getPickerToken();
      await openGoogleSheetsPicker(access_token, app_id, async (file) => {
        setBusy(true);
        try {
          await selectSheet(file.id, file.name);
        } finally {
          setBusy(false);
        }
      });
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : "Couldn't open the file picker");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnect();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card flex flex-col gap-4 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="glass-panel flex size-11 items-center justify-center rounded-2xl">
            <GoogleSheetsGlyph className="size-6" />
          </span>
          <div>
            <p className="font-heading text-[15px] font-semibold text-(--flow-ink)">Google Sheets</p>
            <p className="text-[12.5px] text-(--flow-ink)/55">Import and analyze spreadsheet data</p>
          </div>
        </div>

        {isConnected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-(--flow-cyan)/15 px-2.5 py-1 text-[11.5px] font-semibold text-(--flow-ink)/70">
            <CheckCircle weight="fill" className="size-3.5 text-(--flow-cyan)" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-(--flow-ink)/6 px-2.5 py-1 text-[11.5px] font-medium text-(--flow-ink)/45">
            Not connected
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-[13px] text-(--flow-ink)/45">Checking connection…</p>
      ) : !isConnected ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy}
          className="bg-gradient-flow inline-flex w-fit items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-(--flow-cream) shadow-[0_10px_24px_-14px_rgba(224,90,143,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          <LinkSimple weight="bold" className="size-4" />
          Connect Google Sheets
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-(--flow-ink)/55">
            Connected as <span className="font-medium text-(--flow-ink)/75">{connection?.external_account_email}</span>
          </p>

          {hasSheet && connection ? (
            <SheetLoadedState connection={connection} onView={() => setPreviewOpen(true)} />
          ) : (
            <button
              type="button"
              onClick={handlePickSheet}
              disabled={busy}
              className="glass-panel inline-flex w-fit items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-(--flow-ink) transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              <Table weight="bold" className="size-4 text-(--flow-magenta)" />
              Select spreadsheet
            </button>
          )}

          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busy}
            className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-(--flow-ink)/45 transition-colors hover:text-(--flow-coral) disabled:opacity-60"
          >
            <XCircle weight="bold" className="size-3.5" />
            Disconnect
          </button>
        </div>
      )}

      {(error || pickerError) && (
        <p className="text-[12px] font-medium text-(--flow-coral)">{error ?? pickerError}</p>
      )}

      <SheetPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        sheetName={connection?.google_sheet_name ?? null}
        fetchPreview={getSheetPreview}
      />
    </div>
  );
}
