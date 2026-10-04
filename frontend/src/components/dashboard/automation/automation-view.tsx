"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  ClockCountdown,
  Lightning,
  PencilSimple,
  Play,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { GmailGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { useGmailConnection } from "@/hooks/use-gmail-connection";
import { useNotionConnection } from "@/hooks/use-notion-connection";
import { useSlackConnection } from "@/hooks/use-slack-connection";
import { documentAsSource, useDocuments } from "@/hooks/use-documents";
import { sourceLabel, useGoogleSheetsConnection } from "@/hooks/use-google-sheets-connection";
import {
  useAutomations,
  type Automation,
  type AutomationInput,
  type AutomationRun,
  type RunStatus,
} from "@/hooks/use-automations";
import { AutomationForm, TEMPLATES, type FormContext } from "./automation-form";
import { cn } from "@/lib/utils";

const Z = "font-(family-name:--font-zeyada)";

const accents = [
  "var(--flow-magenta)",
  "oklch(0.66 0.12 190)",
  "oklch(0.72 0.17 55)",
  "oklch(0.66 0.21 10)",
  "oklch(0.68 0.15 160)",
  "oklch(0.64 0.22 330)",
];

const statusMeta: Record<RunStatus, { label: string; tone: string }> = {
  running: { label: "Running…", tone: "var(--flow-amber)" },
  awaiting_approval: { label: "Needs approval", tone: "var(--flow-magenta)" },
  completed: { label: "Done", tone: "oklch(0.68 0.15 160)" },
  failed: { label: "Failed", tone: "var(--flow-coral)" },
  dismissed: { label: "Skipped", tone: "oklch(0.6 0.03 30)" },
};

function StatusChip({ status }: { status: RunStatus }) {
  const m = statusMeta[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${Z} text-[18px] leading-none font-normal`}
      style={{ backgroundColor: `color-mix(in oklab, ${m.tone} 16%, transparent)`, color: m.tone }}
    >
      <span className={cn("size-1.5 rounded-full", status === "running" && "animate-pulse")} style={{ backgroundColor: m.tone }} />
      {m.label}
    </span>
  );
}

const ist = (iso: string | null, opts: Intl.DateTimeFormatOptions = {}) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        ...opts,
      })
    : "—";

function DraftChips({ run }: { run: AutomationRun }) {
  if (run.drafts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {run.drafts.map((d) => {
        const kind = d.draft.kind;
        const Glyph = kind === "slack" ? SlackGlyph : kind === "notion" ? NotionGlyph : GmailGlyph;
        const label =
          kind === "slack"
            ? `Slack${d.draft.channel_name ? ` #${d.draft.channel_name}` : ""}`
            : kind === "notion"
              ? `Notion${d.draft.page_title ? ` · ${d.draft.page_title}` : ""}`
              : `Email${d.draft.to ? ` to ${d.draft.to}` : ""}`;
        const done = d.draft.status === "sent";
        return (
          <span
            key={d.step_id}
            className={cn(
              `inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 ${Z} text-[18px] leading-none font-normal`,
              done ? "bg-(--flow-mint)/30 text-(--flow-ink)" : "bg-(--flow-peach)/70 text-(--flow-ink)"
            )}
          >
            <Glyph aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
            {done && <CheckCircle weight="fill" className="size-3.5 shrink-0 text-emerald-500" />}
          </span>
        );
      })}
    </div>
  );
}

function ApprovalInbox({ runs, onDismiss }: { runs: AutomationRun[]; onDismiss: (id: string) => Promise<void> }) {
  const pending = runs.filter((r) => r.status === "awaiting_approval");
  if (pending.length === 0) return null;
  return (
    <section
      className="rounded-[26px] border border-(--flow-cream) p-5"
      style={{
        backgroundImage:
          "radial-gradient(90% 120% at 0% 0%, color-mix(in oklab, var(--flow-pink) 45%, transparent), transparent 65%), linear-gradient(var(--flow-cream), var(--flow-cream))",
        boxShadow: "0 24px 40px -28px color-mix(in oklab, var(--flow-magenta) 55%, transparent)",
      }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-flow text-(--flow-cream)">
          <ClockCountdown weight="bold" className="size-4" />
        </span>
        <p className={`text-gradient-flow ${Z} text-[32px] leading-none font-normal`}>Needs your approval</p>
        <span className={`rounded-full bg-(--flow-magenta)/12 px-2.5 py-1 ${Z} text-[20px] leading-none text-(--flow-magenta)`}>
          {pending.length}
        </span>
      </div>
      <p className={`${Z} mb-3 text-[20px] leading-snug text-(--flow-ink)/65`}>
        Reports are drafted but nothing is sent until you review and approve it.
      </p>
      <ul className="flex flex-col gap-3">
        {pending.map((run) => (
          <motion.li
            layout
            key={run.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2.5 rounded-2xl bg-(--flow-cream)/90 p-4 shadow-[0_14px_26px_-20px_var(--flow-magenta)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={`${Z} text-[28px] leading-none font-normal text-(--flow-ink)`}>{run.automation_name ?? "Automation"}</p>
              <p className={`${Z} text-[19px] leading-none text-(--flow-ink)/55`}>
                {run.trigger === "manual" ? "Run manually" : "Scheduled"} · {ist(run.finished_at ?? run.started_at)} IST
              </p>
            </div>
            {run.summary && (
              <p className="line-clamp-3 text-[13.5px] leading-relaxed text-(--flow-ink)/75">{run.summary}</p>
            )}
            <DraftChips run={run} />
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {run.conversation_id && (
                <Link
                  href={`/dashboard/ai-insights?chat=${run.conversation_id}`}
                  className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-4 py-2 ${Z} text-[22px] leading-none text-(--flow-cream) shadow-[0_14px_24px_-12px_var(--flow-magenta)]`}
                >
                  Review &amp; send
                  <ArrowRight weight="bold" className="size-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => void onDismiss(run.id)}
                className={`${Z} text-[21px] leading-none text-(--flow-ink)/60 transition-colors hover:text-(--flow-ink)`}
              >
                Skip this report
              </button>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

function deliveryIcons(a: Automation) {
  const out: { key: string; Glyph: typeof GmailGlyph; label: string }[] = [];
  if (a.delivery.email) out.push({ key: "email", Glyph: GmailGlyph, label: a.delivery.email });
  if (a.delivery.slack) out.push({ key: "slack", Glyph: SlackGlyph, label: "Slack" });
  if (a.delivery.notion) out.push({ key: "notion", Glyph: NotionGlyph, label: "Notion" });
  return out;
}

function AutomationCard({
  a,
  accent,
  index,
  runs,
  sourceNames,
  onEdit,
  onToggle,
  onRun,
  onDelete,
}: {
  a: Automation;
  accent: string;
  index: number;
  runs: AutomationRun[];
  sourceNames: string[];
  onEdit: () => void;
  onToggle: (enabled: boolean) => Promise<void>;
  onRun: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"run" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = runs[0] ?? a.last_run;
  const running = runs.some((r) => r.status === "running");
  const delivery = deliveryIcons(a);

  const act = async (kind: "run" | "delete", fn: () => Promise<void>) => {
    setError(null);
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      className={cn(
        "relative isolate flex flex-col gap-3.5 overflow-hidden rounded-[26px] border border-(--flow-cream) bg-(--flow-cream) p-5 transition-opacity",
        !a.enabled && "opacity-75"
      )}
      style={{
        boxShadow: `0 24px 40px -26px color-mix(in oklab, ${accent} 60%, transparent), inset 3px 0 0 ${accent}, inset 0 1px 0 rgb(255 255 255 / 0.8)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 -z-10 size-40 rounded-full blur-3xl"
        style={{ backgroundColor: `color-mix(in oklab, ${accent} 20%, transparent)` }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate ${Z} text-[30px] leading-none font-normal text-(--flow-ink)`}>{a.name}</p>
          <p className={`mt-1 ${Z} text-[21px] leading-none font-normal`} style={{ color: accent }}>
            {a.schedule_text}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={a.enabled}
          aria-label={a.enabled ? "Pause automation" : "Resume automation"}
          onClick={() => void onToggle(!a.enabled)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            a.enabled ? "bg-gradient-flow" : "bg-(--flow-ink)/20"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 size-5 rounded-full bg-(--flow-cream) shadow transition-transform",
              a.enabled && "translate-x-5"
            )}
          />
        </button>
      </div>

      <p className="line-clamp-2 text-[13.5px] leading-relaxed text-(--flow-ink)/75">{a.question}</p>

      <div className="flex flex-wrap gap-1.5">
        {sourceNames.map((n) => (
          <span
            key={n}
            className={`rounded-full px-2.5 py-1 ${Z} text-[18px] leading-none text-(--flow-ink)`}
            style={{ backgroundColor: `color-mix(in oklab, ${accent} 14%, transparent)` }}
          >
            {n}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`${Z} text-[19px] leading-none text-(--flow-ink)/60`}>Delivers to</span>
        {delivery.length === 0 ? (
          <span className={`rounded-full bg-(--flow-ink)/6 px-2.5 py-1 ${Z} text-[18px] leading-none text-(--flow-ink)/60`}>
            In-app only
          </span>
        ) : (
          delivery.map(({ key, Glyph, label }) => (
            <span
              key={key}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full bg-(--flow-cyan)/20 px-2.5 py-1 ${Z} text-[18px] leading-none text-(--flow-ink)`}
            >
              <Glyph aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-(--flow-peach)/45 px-3.5 py-2.5">
        <div>
          <p className={`${Z} text-[18px] leading-none text-(--flow-ink)/55`}>Next run</p>
          <p className={`mt-0.5 ${Z} text-[22px] leading-none text-(--flow-ink)`}>
            {a.enabled ? ist(a.next_run_at) : "Paused"}
          </p>
        </div>
        <div className="text-right">
          <p className={`${Z} text-[18px] leading-none text-(--flow-ink)/55`}>Last run</p>
          <div className="mt-0.5 flex items-center justify-end gap-2">
            {last ? <StatusChip status={last.status} /> : <span className={`${Z} text-[20px] text-(--flow-ink)/55`}>Never</span>}
          </div>
        </div>
      </div>

      {last?.status === "failed" && last.error && (
        <p className={`flex items-start gap-1.5 ${Z} text-[19px] leading-snug text-(--flow-coral)`}>
          <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
          {last.error}
        </p>
      )}
      {error && (
        <p role="alert" className={`${Z} text-[19px] leading-snug text-(--flow-coral)`}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null || running}
          onClick={() => void act("run", onRun)}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 ${Z} text-[21px] leading-none text-(--flow-cream) disabled:opacity-60`}
          style={{
            backgroundImage: `linear-gradient(120deg, ${accent}, color-mix(in oklab, ${accent} 55%, var(--flow-coral)))`,
            boxShadow: `0 12px 22px -12px color-mix(in oklab, ${accent} 65%, transparent)`,
          }}
        >
          <Play weight="fill" className="size-3.5" />
          {running || busy === "run" ? "Running…" : "Run now"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-2 ${Z} text-[21px] leading-none text-(--flow-ink)/70 hover:bg-(--flow-peach)/60 hover:text-(--flow-ink)`}
        >
          <PencilSimple weight="bold" className="size-3.5" />
          Edit
        </button>
        {confirmDelete ? (
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => void act("delete", onDelete)}
              disabled={busy !== null}
              className={`rounded-full bg-(--flow-coral) px-3 py-2 ${Z} text-[20px] leading-none text-(--flow-cream)`}
            >
              {busy === "delete" ? "Deleting…" : "Delete for good"}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className={`${Z} text-[20px] leading-none text-(--flow-ink)/60`}>
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete automation"
            className="flex size-9 items-center justify-center rounded-full text-(--flow-ink)/45 hover:bg-(--flow-coral)/12 hover:text-(--flow-coral)"
          >
            <Trash weight="bold" className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          className={`ml-auto inline-flex items-center gap-1 ${Z} text-[20px] leading-none text-(--flow-ink)/65 hover:text-(--flow-ink)`}
        >
          History
          <CaretDown weight="bold" className={cn("size-3.5 transition-transform", historyOpen && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {historyOpen && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-1.5 overflow-hidden"
          >
            {runs.length === 0 ? (
              <li className={`${Z} text-[20px] text-(--flow-ink)/55`}>No runs yet.</li>
            ) : (
              runs.slice(0, 6).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-(--flow-peach)/35 px-3 py-2">
                  <span className={`${Z} text-[20px] leading-none text-(--flow-ink)/80`}>
                    {ist(r.started_at)} · {r.trigger === "manual" ? "manual" : "scheduled"}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusChip status={r.status} />
                    {r.conversation_id && r.status !== "running" && (
                      <Link
                        href={`/dashboard/ai-insights?chat=${r.conversation_id}`}
                        className={`${Z} text-[19px] leading-none text-(--flow-magenta) underline-offset-2 hover:underline`}
                      >
                        Open
                      </Link>
                    )}
                  </span>
                </li>
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div
      className="flex min-w-32 flex-col gap-1 rounded-2xl border border-(--flow-cream) bg-(--flow-cream) px-4 py-3"
      style={{ boxShadow: `0 18px 30px -24px color-mix(in oklab, ${tone} 60%, transparent)` }}
    >
      <span className={`${Z} text-[20px] leading-none text-(--flow-ink)/60`}>{label}</span>
      <span className={`${Z} text-[40px] leading-none tabular-nums`} style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

export function AutomationView() {
  const { automations, runs, loading, error, create, update, remove, setEnabled, runNow, dismiss, preview } =
    useAutomations();
  const { accounts: sheetsAccounts, sources: sheetSources } = useGoogleSheetsConnection();
  const { accounts: gmailAccounts } = useGmailConnection();
  const { accounts: slackAccounts } = useSlackConnection();
  const { accounts: notionAccounts } = useNotionConnection();
  const { documents } = useDocuments();

  const sources = useMemo(
    () => [...sheetSources, ...documents.filter((d) => d.status === "ready").map(documentAsSource)],
    [sheetSources, documents]
  );
  const ctx: FormContext = { sources, sheetsAccounts, gmailAccounts, slackAccounts, notionAccounts };
  const nameOf = useMemo(() => new Map(sources.map((s) => [s.id, sourceLabel(s)])), [sources]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [initial, setInitial] = useState<Partial<AutomationInput> | null>(null);

  const openNew = (template?: (typeof TEMPLATES)[number]) => {
    setEditing(null);
    setInitial(
      template
        ? {
            name: template.name,
            question: template.question,
            frequency: template.frequency,
            weekday: template.frequency === "weekly" ? (template.weekday ?? 0) : null,
            month_day: template.frequency === "monthly" ? 1 : null,
          }
        : null
    );
    setFormOpen(true);
  };

  const save = async (input: AutomationInput, id: string | null) => {
    if (id) await update(id, input);
    else await create(input);
  };

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const stats = {
    active: automations.filter((a) => a.enabled).length,
    waiting: runs.filter((r) => r.status === "awaiting_approval").length,
    week: runs.filter((r) => new Date(r.started_at).getTime() >= weekAgo && r.status !== "running").length,
  };
  const noSources = !loading && sources.length === 0;

  if (loading) {
    return <p className={`${Z} px-2 text-[24px] leading-none text-(--flow-ink)/70`}>Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <Stat label="Active" value={stats.active} tone="var(--flow-magenta)" />
          <Stat label="Waiting for approval" value={stats.waiting} tone="oklch(0.72 0.17 55)" />
          <Stat label="Ran this week" value={stats.week} tone="oklch(0.66 0.12 190)" />
        </div>
        <button
          type="button"
          onClick={() => openNew()}
          disabled={noSources}
          className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-3 ${Z} text-[25px] leading-none text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] disabled:opacity-50`}
        >
          <Plus weight="bold" className="size-4" />
          New automation
        </button>
      </div>

      {error && (
        <p role="alert" className={`${Z} text-[21px] leading-snug text-(--flow-coral)`}>
          {error}
        </p>
      )}

      <ApprovalInbox runs={runs} onDismiss={dismiss} />

      {automations.length === 0 ? (
        <div
          className="mx-auto mt-2 flex w-full max-w-2xl flex-col items-center gap-5 rounded-[28px] border border-(--flow-cream) bg-(--flow-cream) p-8 text-center"
          style={{ boxShadow: "0 24px 40px -26px color-mix(in oklab, var(--flow-magenta) 45%, transparent)" }}
        >
          <span className="flex size-16 items-center justify-center rounded-[20px] bg-linear-to-br from-(--flow-cream) to-(--flow-peach)">
            <Lightning weight="duotone" className="size-8 text-(--flow-magenta)" />
          </span>
          <div>
            <p className={`text-gradient-flow ${Z} text-[38px] leading-none font-normal`}>Put your reports on autopilot</p>
            <p className={`mt-2 ${Z} text-[23px] leading-snug text-(--flow-ink)/80`}>
              Pick a question and a schedule. The AI answers it from your sheets, drafts the email, Slack message or
              Notion page, and waits for your approval before anything goes out.
            </p>
          </div>
          {noSources ? (
            <Link
              href="/dashboard/integrations"
              className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 ${Z} text-[24px] leading-none text-(--flow-cream)`}
            >
              Connect a sheet first
              <ArrowRight weight="bold" className="size-4" />
            </Link>
          ) : (
            <div className="flex flex-wrap justify-center gap-2.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => openNew(t)}
                  className={`rounded-full bg-(--flow-peach)/70 px-4 py-2 ${Z} text-[22px] leading-none text-(--flow-ink) transition-colors hover:bg-(--flow-peach)`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {automations.map((a, i) => (
            <AutomationCard
              key={a.id}
              a={a}
              accent={accents[i % accents.length]}
              index={i}
              runs={runs.filter((r) => r.automation_id === a.id)}
              sourceNames={a.data_source_ids.map((id) => nameOf.get(id) ?? "Removed sheet")}
              onEdit={() => {
                setEditing(a);
                setFormOpen(true);
              }}
              onToggle={(enabled) => setEnabled(a.id, enabled)}
              onRun={() => runNow(a.id)}
              onDelete={() => remove(a.id)}
            />
          ))}
        </div>
      )}

      <AutomationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        initial={initial}
        ctx={ctx}
        onSave={save}
        onPreview={preview}
      />
    </div>
  );
}
