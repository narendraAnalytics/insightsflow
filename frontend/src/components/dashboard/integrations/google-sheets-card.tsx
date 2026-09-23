"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
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

const tabAccents = [
  "var(--flow-magenta)",
  "var(--flow-cyan)",
  "var(--flow-coral)",
  "var(--flow-lavender)",
  "var(--flow-pink)",
];

const spring = { stiffness: 170, damping: 18, mass: 0.6 };

/**
 * A slab that tilts toward the pointer. Children opt into depth with
 * `translateZ` (see `depth`). The frosted face lives in its own layer because
 * `backdrop-filter` on the tilting element itself would flatten `preserve-3d`.
 */
function TiltSlab({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, spring);
  const sy = useSpring(py, spring);

  const rotateY = useTransform(sx, [0, 1], [-8, 8]);
  const rotateX = useTransform(sy, [0, 1], [7, -7]);
  const glareX = useTransform(sx, [0, 1], [0, 100]);
  const glareY = useTransform(sy, [0, 1], [0, 100]);
  const shadowX = useTransform(sx, [0, 1], [26, -26]);
  const shadowY = useTransform(sy, [0, 1], [46, 22]);

  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX}% ${glareY}%, color-mix(in oklab, var(--flow-cream) 85%, transparent), transparent 62%)`;
  const shadow = useMotionTemplate`${shadowX}px ${shadowY}px 60px -22px color-mix(in oklab, var(--flow-magenta) 42%, transparent), 0 2px 0 color-mix(in oklab, var(--flow-cream) 90%, transparent) inset`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div className="[perspective:1100px]" onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        ref={ref}
        style={{
          rotateX: reduceMotion ? 0 : rotateX,
          rotateY: reduceMotion ? 0 : rotateY,
          boxShadow: shadow,
          transformStyle: "preserve-3d",
        }}
        className="relative rounded-[28px]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden rounded-[28px] border border-(--flow-cream)/90 backdrop-blur-xl"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, var(--flow-peach) 85%, transparent), transparent 60%)," +
              "radial-gradient(90% 80% at 100% 100%, color-mix(in oklab, var(--flow-lavender) 70%, transparent), transparent 65%)," +
              "linear-gradient(160deg, color-mix(in oklab, var(--flow-cream) 88%, transparent), color-mix(in oklab, var(--flow-pink) 30%, transparent))",
          }}
        >
          <motion.div className="absolute inset-0 opacity-70 mix-blend-soft-light" style={{ backgroundImage: glare }} />
        </div>
        <div className="relative flex flex-col gap-5 p-6 sm:p-7" style={{ transformStyle: "preserve-3d" }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

const depth = (z: number) => ({ transform: `translateZ(${z}px)` });

const raised = (accent: string) =>
  `0 16px 26px -16px color-mix(in oklab, ${accent} 55%, transparent), 0 2px 0 var(--flow-cream) inset`;

function StatusPill({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-2 rounded-full bg-(--flow-cream)/80 px-3 py-1.5 text-[12px] font-semibold text-(--flow-ink) shadow-[0_8px_18px_-10px_var(--flow-cyan)]">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--flow-cyan) opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-(--flow-cyan)" />
      </span>
      Connected
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-(--flow-ink)/6 px-3 py-1.5 text-[12px] font-medium text-(--flow-ink)/50">
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
      className="relative overflow-hidden rounded-2xl border border-(--flow-cream)/90 bg-(--flow-cream)/75 p-4"
      style={{ boxShadow: raised(accent) }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-8 -right-8 size-24 rounded-full blur-2xl"
        style={{ backgroundColor: `color-mix(in oklab, ${accent} 30%, transparent)` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-[16px] leading-tight font-semibold tracking-tight text-(--flow-ink)">
            {source.name}
          </p>
          <span
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-(--flow-cream) px-2.5 py-0.5 text-[12px] font-medium text-(--flow-ink)/75"
            style={{ backgroundColor: `color-mix(in oklab, ${accent} 24%, var(--flow-cream))` }}
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
          className="bg-gradient-flow flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-(--flow-cream) shadow-[0_12px_20px_-10px_var(--flow-magenta)] transition-transform hover:scale-[1.05] active:scale-[0.96] disabled:opacity-60"
        >
          <Eye weight="bold" className="size-3.5" />
          View
        </button>
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-3">
        <p className="text-[13px] text-(--flow-ink)/55">
          <span className="font-heading text-[22px] font-bold tabular-nums text-(--flow-ink)">
            {source.row_count.toLocaleString("en-IN")}
          </span>{" "}
          rows ·{" "}
          <span className="font-semibold tabular-nums text-(--flow-ink)/75">{columns}</span> columns
        </p>

        {confirming ? (
          <span className="flex items-center gap-2 text-[12.5px] font-medium">
            <span className="text-(--flow-ink)/60">Remove?</span>
            <button
              type="button"
              onClick={onConfirmRemove}
              disabled={busy}
              className="rounded-full bg-(--flow-coral) px-2.5 py-1 font-semibold text-(--flow-cream) disabled:opacity-60"
            >
              Yes
            </button>
            <button type="button" onClick={onCancelRemove} className="text-(--flow-ink)/55 hover:text-(--flow-ink)">
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
              className="inline-flex items-center gap-1 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-3 py-1 text-[12px] font-semibold text-(--flow-ink)/75 shadow-[0_8px_14px_-10px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <Plus weight="bold" className="size-3" />
              Add another tab
            </button>
            <button
              type="button"
              onClick={onAskRemove}
              disabled={busy}
              aria-label={`Remove ${sourceLabel(source)}`}
              className="flex size-7 items-center justify-center rounded-full text-(--flow-ink)/35 transition-colors hover:bg-(--flow-coral)/15 hover:text-(--flow-coral) disabled:opacity-60"
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
      <TiltSlab>
        <div className="flex items-start justify-between gap-4" style={depth(36)}>
          <div className="flex items-center gap-4">
            <span
              className="flex size-16 items-center justify-center rounded-[20px] border border-(--flow-cream) bg-linear-to-br from-(--flow-cream) to-(--flow-peach)"
              style={{
                boxShadow:
                  "0 22px 30px -14px color-mix(in oklab, var(--flow-coral) 60%, transparent), 0 2px 0 var(--flow-cream) inset",
              }}
            >
              <GoogleSheetsGlyph className="size-9" />
            </span>
            <div>
              <p className="font-heading text-[22px] leading-tight font-bold tracking-tight text-(--flow-ink)">
                Google Sheets
              </p>
              <p className="mt-0.5 max-w-[22ch] text-[13px] leading-snug text-(--flow-ink)/55">
                Bring spreadsheet data in for analysis
              </p>
            </div>
          </div>
          <StatusPill connected={isConnected} />
        </div>

        {loading ? (
          <p className="text-[13px] text-(--flow-ink)/45">Checking connection…</p>
        ) : !isConnected ? (
          <div style={depth(24)}>
            <button
              type="button"
              onClick={() => void run(connect)}
              disabled={busy}
              className="bg-gradient-flow inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <LinkSimple weight="bold" className="size-4" />
              Connect Google Sheets
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4" style={{ transformStyle: "preserve-3d" }}>
            <p className="text-[13px] text-(--flow-ink)/55" style={depth(14)}>
              Signed in as{" "}
              <span className="font-semibold text-(--flow-ink)/80">{connection?.external_account_email}</span>
            </p>

            {sources.length > 0 && (
              <ul className="flex flex-col gap-3" style={depth(22)}>
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

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2" style={depth(24)}>
              <button
                type="button"
                onClick={() => void handleAddSheet()}
                disabled={busy}
                className={
                  sources.length === 0
                    ? "bg-gradient-flow inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
                    : "inline-flex items-center gap-2 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-4 py-2.5 text-[13.5px] font-semibold text-(--flow-ink) shadow-[0_14px_24px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
                }
              >
                <Plus weight="bold" className="size-4" />
                {sources.length === 0 ? "Select spreadsheet" : "Add another sheet"}
              </button>

              <button
                type="button"
                onClick={() => void run(disconnect)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-(--flow-ink)/45 transition-colors hover:text-(--flow-coral) disabled:opacity-60"
              >
                <XCircle weight="bold" className="size-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        )}

        {(error || actionError) && (
          <p role="alert" className="text-[12.5px] font-medium text-(--flow-coral)">
            {actionError ?? error}
          </p>
        )}
      </TiltSlab>

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
