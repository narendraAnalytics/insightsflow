"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import { CalendarBlank, Check, EnvelopeSimple, Lightning, Stack, X } from "@phosphor-icons/react";
import { GmailGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { useCredits } from "@/components/billing/credits-provider";
import {
  sourceLabel,
  type DataSource,
  type GoogleSheetsConnection,
} from "@/hooks/use-google-sheets-connection";
import type { GmailConnection } from "@/hooks/use-gmail-connection";
import type { SlackConnection } from "@/hooks/use-slack-connection";
import type { NotionConnection } from "@/hooks/use-notion-connection";
import type { Automation, AutomationInput, Frequency, SchedulePreview } from "@/hooks/use-automations";
import { forGmail } from "@/lib/gmail-link";
import { cn } from "@/lib/utils";

const Z = "font-(family-name:--font-zeyada)";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const TEMPLATES: { label: string; name: string; question: string; frequency: Frequency; weekday?: number }[] = [
  {
    label: "Weekly sales digest",
    name: "Weekly sales digest",
    question: "Show the total revenue by region and the top 5 products by revenue.",
    frequency: "weekly",
    weekday: 0,
  },
  {
    label: "Daily orders summary",
    name: "Daily orders summary",
    question: "How many orders do we have in total, and what is the total order value?",
    frequency: "daily",
  },
  {
    label: "Monthly performance report",
    name: "Monthly performance report",
    question: "Summarise total revenue by month and call out the best and worst performing segment.",
    frequency: "monthly",
  },
];

export type FormContext = {
  sources: DataSource[];
  sheetsAccounts: GoogleSheetsConnection[];
  gmailAccounts: GmailConnection[];
  slackAccounts: SlackConnection[];
  notionAccounts: NotionConnection[];
};

type Draft = AutomationInput;

function blank(ctx: FormContext): Draft {
  const gmail = ctx.gmailAccounts.find((g) => g.is_default) ?? ctx.gmailAccounts[0];
  return {
    name: "",
    question: "",
    data_source_ids: [],
    gmail_connection_id: gmail?.id ?? null,
    delivery: { email: null, slack: false, notion: false },
    frequency: "weekly",
    weekday: 0,
    month_day: null,
    hour: 9,
    minute: 0,
  };
}

function fromAutomation(a: Automation): Draft {
  return {
    name: a.name,
    question: a.question,
    data_source_ids: a.data_source_ids,
    gmail_connection_id: a.gmail_connection_id,
    delivery: { email: a.delivery.email ?? null, slack: !!a.delivery.slack, notion: !!a.delivery.notion },
    frequency: a.frequency,
    weekday: a.weekday,
    month_day: a.month_day,
    hour: a.hour,
    minute: a.minute,
  };
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-(--flow-cream) bg-(--flow-cream)/70 p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-flow ${Z} text-[22px] leading-none font-normal text-(--flow-cream)`}
        >
          {n}
        </span>
        <div>
          <p className={`${Z} text-[28px] leading-none font-normal text-(--flow-ink)`}>{title}</p>
          {hint && <p className={`${Z} mt-0.5 text-[19px] leading-none font-normal text-(--flow-ink)/55`}>{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-(--flow-pink)/60 bg-(--flow-cream) px-3.5 py-2.5 text-[14px] text-(--flow-ink) outline-none placeholder:text-(--flow-ink)/40 focus:border-(--flow-magenta)";

function Pill({
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ${Z} text-[21px] leading-none font-normal transition-colors disabled:opacity-45`,
        active ? "bg-gradient-flow text-(--flow-cream)" : "bg-(--flow-peach)/70 text-(--flow-ink) hover:bg-(--flow-peach)",
        className
      )}
    >
      {children}
    </button>
  );
}

export function AutomationForm({
  open,
  onOpenChange,
  editing,
  initial,
  ctx,
  onSave,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Automation | null;
  initial?: Partial<Draft> | null;
  ctx: FormContext;
  onSave: (input: AutomationInput, id: string | null) => Promise<void>;
  onPreview: (input: AutomationInput) => Promise<SchedulePreview>;
}) {
  const { questionCost } = useCredits();
  const [draft, setDraft] = useState<Draft>(() => blank(ctx));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);

  // Reset whenever the dialog opens (fresh, editing, or from a template).
  useEffect(() => {
    if (!open) return;
    setError(null);
    setPreview(null);
    setDraft(editing ? fromAutomation(editing) : { ...blank(ctx), ...(initial ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, initial]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // The chosen Gmail profile decides which sheets / Slack / Notion workspaces are offered.
  const gmail = ctx.gmailAccounts.find((g) => g.id === draft.gmail_connection_id);
  const offeredSources = useMemo(() => {
    const logins = new Set(forGmail(ctx.sheetsAccounts, gmail?.id).map((a) => a.id));
    return ctx.sources.filter((s) => !s.connection_id || logins.has(s.connection_id));
  }, [ctx.sources, ctx.sheetsAccounts, gmail?.id]);
  const slack = forGmail(ctx.slackAccounts, gmail?.id).filter((w) => w.status === "connected");
  const notion = forGmail(ctx.notionAccounts, gmail?.id).filter((w) => w.status === "connected");
  const canEmail = !!gmail && gmail.status === "connected";

  // Switching profile drops sheets that are no longer offered, and channels that don't exist there.
  useEffect(() => {
    if (!open) return;
    setDraft((d) => {
      const offered = new Set(offeredSources.map((s) => s.id));
      const ids = d.data_source_ids.filter((id) => offered.has(id) || !ctx.sources.some((s) => s.id === id));
      const delivery = { ...d.delivery, slack: d.delivery.slack && slack.length > 0, notion: d.delivery.notion && notion.length > 0 };
      return ids.length === d.data_source_ids.length &&
        delivery.slack === d.delivery.slack &&
        delivery.notion === d.delivery.notion
        ? d
        : { ...d, data_source_ids: ids, delivery };
    });
  }, [open, offeredSources, slack.length, notion.length, ctx.sources]);

  // Live "next runs" under the schedule (debounced; ignored while the form is incomplete).
  const complete =
    draft.name.trim().length > 0 && draft.question.trim().length >= 3 && draft.data_source_ids.length > 0;
  const scheduleKey = `${draft.frequency}|${draft.weekday}|${draft.month_day}|${draft.hour}|${draft.minute}`;
  useEffect(() => {
    if (!open) return;
    if (
      (draft.frequency === "weekly" && draft.weekday === null) ||
      (draft.frequency === "monthly" && draft.month_day === null)
    ) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      // The preview endpoint validates the whole form, so send placeholder text when incomplete.
      const probe: Draft = {
        ...draft,
        name: draft.name.trim() || "Preview",
        question: draft.question.trim().length >= 3 ? draft.question : "Preview question",
        data_source_ids: draft.data_source_ids.length ? draft.data_source_ids : ["00000000-0000-4000-8000-000000000000"],
        delivery: { ...draft.delivery, email: null },
      };
      onPreview(probe)
        .then((p) => !cancelled && setPreview(p))
        .catch(() => !cancelled && setPreview(null));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scheduleKey]);

  const submit = async () => {
    setError(null);
    if (!complete) {
      setError("Add a name, a question and at least one sheet.");
      return;
    }
    setSaving(true);
    try {
      await onSave(
        { ...draft, name: draft.name.trim(), question: draft.question.trim(), delivery: { ...draft.delivery, email: draft.delivery.email?.trim() || null } },
        editing?.id ?? null
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the automation.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = (id: string) =>
    set(
      "data_source_ids",
      draft.data_source_ids.includes(id) ? draft.data_source_ids.filter((x) => x !== id) : [...draft.data_source_ids, id].slice(0, 5)
    );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 30% 20%, color-mix(in oklab, var(--flow-pink) 55%, transparent), transparent 70%)," +
              "radial-gradient(55% 50% at 75% 80%, color-mix(in oklab, var(--flow-lavender) 55%, transparent), transparent 70%)," +
              "color-mix(in oklab, var(--flow-ink) 22%, transparent)",
            backdropFilter: "blur(10px)",
          }}
        />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 outline-none">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 210, damping: 24 }}
            style={{
              boxShadow: "0 50px 90px -30px color-mix(in oklab, var(--flow-magenta) 55%, transparent)",
              backgroundImage:
                "radial-gradient(110% 80% at 0% 0%, color-mix(in oklab, var(--flow-peach) 90%, transparent), transparent 60%)," +
                "linear-gradient(160deg, var(--flow-cream), color-mix(in oklab, var(--flow-pink) 30%, var(--flow-cream)))",
            }}
            className="flex max-h-[88vh] flex-col overflow-hidden rounded-[30px] border border-(--flow-cream)"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
              <div>
                <DialogPrimitive.Title className={`text-gradient-flow ${Z} text-[38px] leading-none font-normal`}>
                  {editing ? "Edit automation" : "New automation"}
                </DialogPrimitive.Title>
                <p className={`${Z} mt-1 text-[21px] leading-none font-normal text-(--flow-ink)/60`}>
                  Runs on a schedule, then waits for your approval before anything is sent.
                </p>
              </div>
              <DialogPrimitive.Close
                aria-label="Close"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-(--flow-cream) bg-(--flow-cream)/80 text-(--flow-ink)/60 shadow-[0_12px_20px_-10px_var(--flow-magenta)] transition-transform hover:scale-105 active:scale-95"
              >
                <X weight="bold" className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <div
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3"
              style={{ scrollbarWidth: "thin", scrollbarColor: "var(--flow-pink) transparent" }}
            >
              {!editing && !draft.name && !draft.question && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${Z} text-[20px] leading-none text-(--flow-ink)/60`}>Start from</span>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          name: t.name,
                          question: t.question,
                          frequency: t.frequency,
                          weekday: t.frequency === "weekly" ? (t.weekday ?? 0) : null,
                          month_day: t.frequency === "monthly" ? 1 : null,
                        }))
                      }
                      className={`rounded-full bg-(--flow-peach)/70 px-3 py-1 ${Z} text-[20px] leading-none text-(--flow-ink) hover:bg-(--flow-peach)`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              <Section n={1} title="What to ask">
                <input
                  className={fieldClass}
                  placeholder="Name, e.g. Weekly sales digest"
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                />
                <textarea
                  className={cn(fieldClass, "min-h-20 resize-y")}
                  placeholder="The question the AI answers each run, e.g. Show total revenue by region"
                  maxLength={1000}
                  value={draft.question}
                  onChange={(e) => set("question", e.target.value)}
                />
              </Section>

              <Section n={2} title="Which data" hint="Pick up to 5 sheets or documents.">
                {ctx.gmailAccounts.length > 1 && (
                  <label className="flex items-center gap-2">
                    <span className={`${Z} text-[21px] leading-none text-(--flow-ink)/70`}>Work as</span>
                    <select
                      className={cn(fieldClass, "w-auto min-w-0 flex-1")}
                      value={draft.gmail_connection_id ?? ""}
                      onChange={(e) => set("gmail_connection_id", e.target.value || null)}
                    >
                      {ctx.gmailAccounts.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.external_account_email ?? "Gmail"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {offeredSources.length === 0 ? (
                  <p className={`${Z} text-[21px] leading-snug text-(--flow-ink)/60`}>
                    No sheets for this account yet. Add one on the Integrations page.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {offeredSources.map((s) => {
                      const on = draft.data_source_ids.includes(s.id);
                      return (
                        <Pill key={s.id} active={on} onClick={() => toggleSource(s.id)}>
                          {on ? <Check weight="bold" className="size-3.5" /> : <Stack weight="duotone" className="size-3.5" />}
                          {sourceLabel(s)}
                        </Pill>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section n={3} title="Where to send it" hint="Always saved in the app. Others are drafts you approve.">
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-(--flow-magenta)"
                        disabled={!canEmail}
                        checked={draft.delivery.email !== null}
                        onChange={(e) => set("delivery", { ...draft.delivery, email: e.target.checked ? "" : null })}
                      />
                      <GmailGlyph aria-hidden className="size-5" />
                      <span className={`${Z} text-[23px] leading-none text-(--flow-ink)`}>Email</span>
                      {!canEmail && <span className={`${Z} text-[18px] text-(--flow-ink)/50`}>connect Gmail first</span>}
                    </label>
                    {draft.delivery.email !== null && (
                      <div className="flex items-center gap-2 pl-7">
                        <EnvelopeSimple weight="duotone" className="size-4 text-(--flow-magenta)" />
                        <input
                          className={fieldClass}
                          type="email"
                          placeholder="Send the report to (one address)"
                          value={draft.delivery.email}
                          onChange={(e) => set("delivery", { ...draft.delivery, email: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-(--flow-magenta)"
                      disabled={slack.length === 0}
                      checked={draft.delivery.slack}
                      onChange={(e) => set("delivery", { ...draft.delivery, slack: e.target.checked })}
                    />
                    <SlackGlyph aria-hidden className="size-5" />
                    <span className={`${Z} text-[23px] leading-none text-(--flow-ink)`}>Slack</span>
                    <span className={`${Z} truncate text-[18px] text-(--flow-ink)/50`}>
                      {slack.length === 0
                        ? "no workspace for this account"
                        : `posts to ${slack[0].external_account_email ?? "your workspace"}${slack[0].slack_channel_name ? ` #${slack[0].slack_channel_name}` : ""}`}
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-(--flow-magenta)"
                      disabled={notion.length === 0}
                      checked={draft.delivery.notion}
                      onChange={(e) => set("delivery", { ...draft.delivery, notion: e.target.checked })}
                    />
                    <NotionGlyph aria-hidden className="size-5" />
                    <span className={`${Z} text-[23px] leading-none text-(--flow-ink)`}>Notion</span>
                    <span className={`${Z} truncate text-[18px] text-(--flow-ink)/50`}>
                      {notion.length === 0
                        ? "no workspace for this account"
                        : `saves under ${notion[0].notion_page_title ?? notion[0].external_account_email ?? "your page"}`}
                    </span>
                  </label>
                </div>
              </Section>

              <Section n={4} title="When" hint="Times are in IST.">
                <div className="flex flex-wrap gap-2">
                  {(["daily", "weekly", "monthly"] as Frequency[]).map((f) => (
                    <Pill
                      key={f}
                      active={draft.frequency === f}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          frequency: f,
                          weekday: f === "weekly" ? (d.weekday ?? 0) : null,
                          month_day: f === "monthly" ? (d.month_day ?? 1) : null,
                        }))
                      }
                    >
                      {f === "daily" ? "Daily" : f === "weekly" ? "Weekly" : "Monthly"}
                    </Pill>
                  ))}
                </div>
                {draft.frequency === "weekly" && (
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((d, i) => (
                      <Pill key={d} active={draft.weekday === i} onClick={() => set("weekday", i)} className="px-3">
                        {d}
                      </Pill>
                    ))}
                  </div>
                )}
                {draft.frequency === "monthly" && (
                  <label className="flex items-center gap-2">
                    <span className={`${Z} text-[21px] leading-none text-(--flow-ink)/70`}>On day</span>
                    <select
                      className={cn(fieldClass, "w-24")}
                      value={draft.month_day ?? 1}
                      onChange={(e) => set("month_day", Number(e.target.value))}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <span className={`${Z} text-[19px] leading-none text-(--flow-ink)/50`}>(1 to 28)</span>
                  </label>
                )}
                <div className="flex items-center gap-2">
                  <span className={`${Z} text-[21px] leading-none text-(--flow-ink)/70`}>At</span>
                  <select
                    className={cn(fieldClass, "w-20")}
                    value={draft.hour}
                    onChange={(e) => set("hour", Number(e.target.value))}
                    aria-label="Hour"
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span className="text-(--flow-ink)/60">:</span>
                  <select
                    className={cn(fieldClass, "w-20")}
                    value={draft.minute}
                    onChange={(e) => set("minute", Number(e.target.value))}
                    aria-label="Minute"
                  >
                    {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span className={`${Z} text-[19px] leading-none text-(--flow-ink)/50`}>24-hour, IST</span>
                </div>
                {preview && (
                  <div className="rounded-2xl bg-(--flow-peach)/50 px-3.5 py-2.5">
                    <p className={`${Z} flex items-center gap-1.5 text-[22px] leading-none text-(--flow-ink)`}>
                      <CalendarBlank weight="duotone" className="size-4 text-(--flow-magenta)" />
                      {preview.schedule_text}
                    </p>
                    <p className={`${Z} mt-1 text-[19px] leading-snug text-(--flow-ink)/65`}>
                      Next:{" "}
                      {preview.next_runs
                        .map((t) =>
                          new Date(t).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        )
                        .join("  ·  ")}
                    </p>
                  </div>
                )}
              </Section>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-(--flow-cream)/80 px-6 py-4">
              <p className={`${Z} flex items-center gap-1.5 text-[20px] leading-none text-(--flow-ink)/65`}>
                <Lightning weight="fill" className="size-4 text-(--flow-coral)" />
                Each run uses {questionCost} credits
              </p>
              <div className="flex items-center gap-3">
                {error && (
                  <p role="alert" className={`${Z} max-w-64 text-[19px] leading-snug text-(--flow-coral)`}>
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={saving}
                  className={`bg-gradient-flow rounded-full px-6 py-2.5 ${Z} text-[24px] leading-none font-normal text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] disabled:opacity-60`}
                >
                  {saving ? "Saving…" : editing ? "Save changes" : "Create automation"}
                </button>
              </div>
            </div>
          </motion.div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
