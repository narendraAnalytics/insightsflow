"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, LinkSimple, Plus, Stack, Trash, XCircle } from "@phosphor-icons/react";
import { GoogleSheetsGlyph } from "@/components/site/brand-icons";
import {
  sourceLabel,
  useGoogleSheetsConnection,
  type DataSource,
  type SpreadsheetTabs,
} from "@/hooks/use-google-sheets-connection";
import { openGoogleSheetsPicker } from "@/lib/google-picker";
import { SheetPreviewModal } from "@/components/dashboard/integrations/sheet-preview-modal";
import { TabPickerDialog } from "@/components/dashboard/integrations/tab-picker-dialog";

// Deep, bright accents (no blue/violet) so each tab reads clearly against the cream card.
const tabAccents = [
  "var(--flow-magenta)",
  "oklch(0.66 0.12 190)",
  "oklch(0.72 0.17 55)",
  "oklch(0.66 0.21 10)",
  "oklch(0.68 0.15 160)",
  "oklch(0.64 0.22 330)",
];

/**
 * A flat, crisp glass card with a cursor-following glow. (It used to be a 3D tilt
 * slab, but `perspective` + `preserve-3d` + `translateZ` makes the browser rasterise
 * text as a scaled texture, which is what made everything look slightly blurry.)
 */
export function GlassSlab({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (reduceMotion || e.pointerType !== "mouse" || !el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className="group/slab relative isolate overflow-hidden rounded-[28px] border border-(--flow-cream)/90"
      style={{
        backgroundImage:
          "radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, var(--flow-peach) 85%, transparent), transparent 60%)," +
          "radial-gradient(90% 80% at 100% 100%, color-mix(in oklab, var(--flow-pink) 55%, transparent), transparent 65%)," +
          "linear-gradient(160deg, var(--flow-cream), color-mix(in oklab, var(--flow-peach) 60%, var(--flow-cream)))",
        boxShadow:
          "0 30px 60px -28px color-mix(in oklab, var(--flow-magenta) 45%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.8)",
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/slab:opacity-100"
        style={{
          background:
            "radial-gradient(300px circle at var(--mx, 50%) var(--my, 30%), color-mix(in oklab, var(--flow-magenta) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex flex-col gap-5 p-6 sm:p-7">{children}</div>
    </div>
  );
}

const raised = (accent: string) =>
  `0 14px 26px -18px color-mix(in oklab, ${accent} 65%, transparent), inset 3px 0 0 ${accent}, inset 0 1px 0 rgb(255 255 255 / 0.8)`;

export function StatusPill({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-2 rounded-full bg-(--flow-cream) px-3 py-1.5 font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-ink) shadow-[0_8px_18px_-10px_oklch(0.66_0.12_190)]">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[oklch(0.68_0.15_160)] opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-[oklch(0.68_0.15_160)]" />
      </span>
      Connected
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-(--flow-coral)/15 px-3 py-1.5 font-(family-name:--font-zeyada) text-[20px] leading-none font-normal text-(--flow-coral)">
      Not connected
    </span>
  );
}

function SourceTile({
  source,
  accent,
  busy,
  confirming,
  onView,
  onAddTab,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  source: DataSource;
  accent: string;
  busy: boolean;
  confirming: boolean;
  onView: () => void;
  onAddTab: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) {
  const columns = source.headers.length;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="relative overflow-hidden rounded-2xl border border-(--flow-cream) p-4 pl-5"
      style={{
        boxShadow: raised(accent),
        backgroundImage: `linear-gradient(100deg, color-mix(in oklab, ${accent} 13%, var(--flow-cream)), var(--flow-cream) 70%)`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-8 -right-8 size-24 rounded-full blur-2xl"
        style={{ backgroundColor: `color-mix(in oklab, ${accent} 30%, transparent)` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-(family-name:--font-zeyada) text-[28px] leading-none font-normal text-(--flow-ink)">
            {source.name}
          </p>
          <span
            className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 font-(family-name:--font-zeyada) text-[19px] leading-none font-normal"
            style={{ backgroundColor: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}
          >
            <Stack weight="duotone" className="size-3.5 shrink-0" />
            <span className="truncate">{source.tab_title || "First tab"}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onView}
          disabled={busy}
          title={`View ${sourceLabel(source)}`}
          style={{ backgroundImage: `linear-gradient(120deg, ${accent}, color-mix(in oklab, ${accent} 60%, var(--flow-coral)))`, "--acc": accent } as React.CSSProperties}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-cream) shadow-[0_12px_20px_-10px_var(--acc)] transition-transform hover:scale-[1.05] active:scale-[0.96] disabled:opacity-60"
        >
          <Eye weight="bold" className="size-3.5" />
          View
        </button>
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <p className="font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/80">
          <span className="text-[38px] leading-none tabular-nums" style={{ color: accent }}>
            {source.row_count.toLocaleString("en-IN")}
          </span>{" "}
          rows ·{" "}
          <span className="text-[26px] tabular-nums text-(--flow-ink)">{columns}</span> columns
        </p>

        {confirming ? (
          <span className="flex items-center gap-2 font-(family-name:--font-zeyada) text-[20px] leading-none font-normal">
            <span className="text-(--flow-ink)/80">Remove?</span>
            <button
              type="button"
              onClick={onConfirmRemove}
              disabled={busy}
              className="rounded-full bg-(--flow-coral) px-3 py-1 text-(--flow-cream) disabled:opacity-60"
            >
              Yes
            </button>
            <button type="button" onClick={onCancelRemove} className="text-(--flow-ink)/75 hover:text-(--flow-ink)">
              No
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={onAddTab}
              disabled={busy}
              title="Add another tab from this spreadsheet"
              style={{ color: accent, "--acc": accent } as React.CSSProperties}
              className="inline-flex items-center gap-1 rounded-full bg-(--flow-cream) px-3 py-1 font-(family-name:--font-zeyada) text-[20px] leading-none font-normal shadow-[0_8px_14px_-10px_var(--acc)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <Plus weight="bold" className="size-3" />
              Add another tab
            </button>
            <button
              type="button"
              onClick={onAskRemove}
              disabled={busy}
              aria-label={`Remove ${sourceLabel(source)}`}
              className="flex size-7 items-center justify-center rounded-full text-(--flow-ink)/50 transition-colors hover:bg-(--flow-coral)/15 hover:text-(--flow-coral) disabled:opacity-60"
            >
              <Trash weight="bold" className="size-3.5" />
            </button>
          </span>
        )}
      </div>
    </motion.li>
  );
}

type TabDialogState = {
  spreadsheetId: string;
  info: SpreadsheetTabs;
  takenTitles: string[];
};

export function GoogleSheetsCard() {
  const {
    connection,
    loading,
    error,
    connect,
    getPickerToken,
    getTabs,
    addSource,
    removeSource,
    getSourcePreview,
    disconnect,
  } = useGoogleSheetsConnection();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<DataSource | null>(null);
  const [tabDialog, setTabDialog] = useState<TabDialogState | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const isConnected = connection?.status === "connected";
  const sources = connection?.sources ?? [];

  // Stable per source so the preview modal's fetch effect doesn't re-run each render.
  const previewSourceId = previewSource?.id ?? null;
  const fetchPreview = useCallback(
    () => getSourcePreview(previewSourceId as string),
    [getSourcePreview, previewSourceId]
  );

  /** Runs an action with the shared busy flag and surfaces its error message. */
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

  const openTabsFor = async (spreadsheetId: string) => {
    const info = await getTabs(spreadsheetId);
    const takenTitles = sources.filter((s) => s.spreadsheet_id === spreadsheetId).map((s) => s.tab_title);
    setTabDialog({ spreadsheetId, info, takenTitles });
  };

  const handleAddSheet = () =>
    run(async () => {
      const { access_token, app_id } = await getPickerToken();
      await openGoogleSheetsPicker(access_token, app_id, (file) => {
        void run(async () => {
          const info = await getTabs(file.id);
          if (info.tabs.length > 1) {
            const takenTitles = sources.filter((s) => s.spreadsheet_id === file.id).map((s) => s.tab_title);
            setTabDialog({ spreadsheetId: file.id, info, takenTitles });
          } else {
            await addSource(file.id, info.tabs[0]?.title);
          }
        });
      });
    });

  const handleConfirmTabs = (titles: string[]) =>
    run(async () => {
      if (!tabDialog) return;
      for (const title of titles) {
        await addSource(tabDialog.spreadsheetId, title);
      }
      setTabDialog(null);
    });

  const handleRemove = (id: string) =>
    run(async () => {
      await removeSource(id);
      setConfirmingId(null);
    });

  return (
    <>
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
              <GoogleSheetsGlyph className="size-9" />
            </span>
            <div>
              <p className="text-gradient-flow font-(family-name:--font-zeyada) text-[38px] leading-none font-normal">
                Google Sheets
              </p>
              <p className="mt-1 max-w-[26ch] font-(family-name:--font-zeyada) text-[22px] leading-snug font-normal text-(--flow-ink)/80">
                Bring spreadsheet data in for analysis
              </p>
            </div>
          </div>
          <StatusPill connected={isConnected} />
        </div>

        {loading ? (
          <p className="font-(family-name:--font-zeyada) text-[22px] leading-none text-(--flow-ink)/70">Checking connection…</p>
        ) : !isConnected ? (
          <div>
            <button
              type="button"
              onClick={() => void run(connect)}
              disabled={busy}
              className="bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <LinkSimple weight="bold" className="size-4" />
              Connect Google Sheets
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-ink)/80">
              Signed in as{" "}
              <span className="text-(--flow-magenta)">{connection?.external_account_email}</span>
            </p>

            {sources.length > 0 && (
              <ul className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {sources.map((source, i) => (
                    <SourceTile
                      key={source.id}
                      source={source}
                      accent={tabAccents[i % tabAccents.length]}
                      busy={busy}
                      confirming={confirmingId === source.id}
                      onView={() => setPreviewSource(source)}
                      onAddTab={() => void run(() => openTabsFor(source.spreadsheet_id))}
                      onAskRemove={() => setConfirmingId(source.id)}
                      onCancelRemove={() => setConfirmingId(null)}
                      onConfirmRemove={() => void handleRemove(source.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => void handleAddSheet()}
                disabled={busy}
                className={
                  sources.length === 0
                    ? "bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-(family-name:--font-zeyada) text-[24px] leading-none font-normal text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
                    : "inline-flex items-center gap-2 rounded-full bg-(--flow-cream) px-5 py-2 font-(family-name:--font-zeyada) text-[23px] leading-none font-normal text-(--flow-magenta) shadow-[0_14px_24px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
                }
              >
                <Plus weight="bold" className="size-4" />
                {sources.length === 0 ? "Select spreadsheet" : "Add another sheet"}
              </button>

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

        {(error || actionError) && (
          <p role="alert" className="font-(family-name:--font-zeyada) text-[22px] leading-snug font-normal text-(--flow-coral)">
            {actionError ?? error}
          </p>
        )}
      </GlassSlab>

      <SheetPreviewModal
        open={previewSource !== null}
        onOpenChange={(open) => !open && setPreviewSource(null)}
        sheetName={previewSource ? sourceLabel(previewSource) : null}
        fetchPreview={fetchPreview}
      />

      <TabPickerDialog
        open={tabDialog !== null}
        onOpenChange={(open) => !open && setTabDialog(null)}
        spreadsheetName={tabDialog?.info.name ?? ""}
        tabs={tabDialog?.info.tabs ?? []}
        takenTitles={tabDialog?.takenTitles ?? []}
        busy={busy}
        onConfirm={(titles) => void handleConfirmTabs(titles)}
      />
    </>
  );
}
