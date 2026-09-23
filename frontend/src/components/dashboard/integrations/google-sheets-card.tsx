"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Eye, Hash, LinkSimple, Rows, Table, XCircle } from "@phosphor-icons/react";
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

  const rotateY = useTransform(sx, [0, 1], [-10, 10]);
  const rotateX = useTransform(sy, [0, 1], [9, -9]);
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
        {/* frosted face */}
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

function StatTile({
  icon,
  value,
  label,
  accent,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-(--flow-cream)/90 bg-(--flow-cream)/70 px-4 py-3.5"
      style={{
        boxShadow: `0 18px 28px -16px color-mix(in oklab, ${accent} 55%, transparent), 0 1px 0 var(--flow-cream) inset`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-6 -right-6 size-20 rounded-full blur-2xl"
        style={{ backgroundColor: `color-mix(in oklab, ${accent} 35%, transparent)` }}
      />
      <div className="relative flex items-end justify-between gap-3">
        <div>
          <p className="font-heading text-[34px] leading-none font-bold tracking-tight tabular-nums text-(--flow-ink)">
            {value.toLocaleString()}
          </p>
          <p className="mt-1.5 text-[12.5px] font-medium text-(--flow-ink)/55">{label}</p>
        </div>
        <span style={{ color: accent }} className="mb-0.5">
          {icon}
        </span>
      </div>
    </div>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="flex items-center gap-3" style={depth(28)}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[17px] font-semibold tracking-tight text-(--flow-ink)">
            {connection.google_sheet_name}
          </p>
          <p className="text-[12.5px] font-medium text-(--flow-ink)/50">Synced and ready to analyze</p>
        </div>
        <button
          type="button"
          onClick={onView}
          title="View sheet"
          className="bg-gradient-flow flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-(--flow-cream) shadow-[0_14px_24px_-12px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97]"
        >
          <Eye weight="bold" className="size-3.5" />
          View
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3" style={depth(20)}>
        <StatTile
          icon={<Rows weight="duotone" className="size-6" />}
          value={connection.google_sheet_row_count ?? 0}
          label="Rows"
          accent="var(--flow-magenta)"
        />
        <StatTile
          icon={<Hash weight="duotone" className="size-6" />}
          value={headers.length}
          label="Columns"
          accent="var(--flow-coral)"
        />
      </div>

      {headers.length > 0 && (
        <div className="flex flex-wrap gap-2" style={depth(10)}>
          {headers.map((header, i) => (
            <span
              key={`${header}-${i}`}
              className="rounded-full border border-(--flow-cream)/80 px-3 py-1 text-[12px] font-medium text-(--flow-ink)/75"
              style={{ backgroundColor: `color-mix(in oklab, ${chipAccents[i % chipAccents.length]} 22%, var(--flow-cream))` }}
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
              onClick={handleConnect}
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

            {hasSheet && connection ? (
              <SheetLoadedState connection={connection} onView={() => setPreviewOpen(true)} />
            ) : (
              <div style={depth(24)}>
                <button
                  type="button"
                  onClick={handlePickSheet}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 px-5 py-3 text-[14px] font-semibold text-(--flow-ink) shadow-[0_16px_26px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
                >
                  <Table weight="bold" className="size-4 text-(--flow-magenta)" />
                  Select spreadsheet
                </button>
              </div>
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
      </TiltSlab>

      <SheetPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        sheetName={connection?.google_sheet_name ?? null}
        fetchPreview={getSheetPreview}
      />
    </>
  );
}
