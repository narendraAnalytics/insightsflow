"use client";

import { useState, type ReactElement, type SVGProps } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChatCircleText, FolderOpen, Plug, Plus, Stack } from "@phosphor-icons/react";
import { GmailGlyph, GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { useCredits } from "@/components/billing/credits-provider";
import { useGmailConnection } from "@/hooks/use-gmail-connection";
import { useNotionConnection } from "@/hooks/use-notion-connection";
import { useSlackConnection } from "@/hooks/use-slack-connection";
import { sourceLabel, useGoogleSheetsConnection, type DataSource, type GoogleSheetsConnection } from "@/hooks/use-google-sheets-connection";
import type { GmailConnection } from "@/hooks/use-gmail-connection";
import type { SlackConnection } from "@/hooks/use-slack-connection";
import type { NotionConnection } from "@/hooks/use-notion-connection";
import { forGmail } from "@/lib/gmail-link";

const Z = "font-(family-name:--font-zeyada)";

// One project = one spreadsheet (its tabs grouped together). Deep, bright
// accents (no blue/violet) so neighbouring project cards read apart at a glance.
const accents = [
  "var(--flow-magenta)",
  "oklch(0.66 0.12 190)",
  "oklch(0.72 0.17 55)",
  "oklch(0.66 0.21 10)",
  "oklch(0.68 0.15 160)",
  "oklch(0.64 0.22 330)",
];

type Project = {
  spreadsheetId: string;
  name: string;
  tabs: DataSource[];
  rowCount: number;
  syncedAt: string;
};

function groupProjects(sources: DataSource[]): Project[] {
  const bySheet = new Map<string, DataSource[]>();
  for (const s of sources) {
    const list = bySheet.get(s.spreadsheet_id) ?? [];
    list.push(s);
    bySheet.set(s.spreadsheet_id, list);
  }
  return [...bySheet.entries()].map(([spreadsheetId, tabs]) => ({
    spreadsheetId,
    name: tabs[0].name,
    tabs,
    rowCount: tabs.reduce((sum, t) => sum + t.row_count, 0),
    syncedAt: tabs.reduce((latest, t) => (t.synced_at > latest ? t.synced_at : latest), tabs[0].synced_at),
  }));
}

type AppChip = {
  key: string;
  label: string;
  live: boolean;
  Glyph: (props: SVGProps<SVGSVGElement>) => ReactElement;
  /** Account / workspace shown after the label, or "not linked" when not live. */
  note?: string;
};

/** The apps one project works with, from the Gmail profile its Sheets login belongs to:
 * that Gmail plus the Slack / Notion workspaces linked to it. Nothing here is invented.
 */
function buildChips(
  tabs: DataSource[],
  sheetsAccounts: GoogleSheetsConnection[],
  gmailAccounts: GmailConnection[],
  slackAccounts: SlackConnection[],
  notionAccounts: NotionConnection[]
): AppChip[] {
  const owner =
    sheetsAccounts.find((a) => a.id === tabs[0].connection_id) ??
    sheetsAccounts.find((a) => a.is_default) ??
    sheetsAccounts[0];
  const gmail = gmailAccounts.find((g) => g.id === owner?.gmail_connection_id);
  const slack = forGmail(slackAccounts, gmail?.id);
  const notion = forGmail(notionAccounts, gmail?.id);
  const chips: AppChip[] = [
    { key: "sheets", label: "Google Sheets", live: true, Glyph: GoogleSheetsGlyph, note: owner?.external_account_email ?? undefined },
    gmail
      ? { key: "gmail", label: "Gmail", live: true, Glyph: GmailGlyph, note: gmail.external_account_email ?? undefined }
      : { key: "gmail", label: "Gmail", live: false, Glyph: GmailGlyph, note: "not linked" },
  ];
  if (slack.length > 0) {
    for (const w of slack)
      chips.push({ key: `slack-${w.id}`, label: "Slack", live: true, Glyph: SlackGlyph, note: w.external_account_email ?? undefined });
  } else {
    chips.push({ key: "slack", label: "Slack", live: false, Glyph: SlackGlyph, note: "not linked" });
  }
  if (notion.length > 0) {
    for (const w of notion)
      chips.push({ key: `notion-${w.id}`, label: "Notion", live: true, Glyph: NotionGlyph, note: w.external_account_email ?? undefined });
  } else {
    chips.push({ key: "notion", label: "Notion", live: false, Glyph: NotionGlyph, note: "not linked" });
  }
  return chips;
}

function ConnectedAppsRow({ chips }: { chips: AppChip[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`${Z} text-[20px] leading-none font-normal text-(--flow-ink)/70`}>Connected apps</span>
      {chips.map((app) => (
        <span
          key={app.key}
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 ${Z} text-[19px] leading-none font-normal ${
            app.live ? "bg-(--flow-cyan)/20 text-(--flow-ink)" : "bg-(--flow-ink)/6 text-(--flow-ink)/40"
          }`}
        >
          <app.Glyph aria-hidden className={`size-4 shrink-0 ${app.live ? "" : "opacity-45 grayscale"}`} />
          {app.label}
          {app.note && <span className="truncate text-[15px]">· {app.note}</span>}
        </span>
      ))}
    </div>
  );
}

function ProjectCard({
  project,
  accent,
  index,
  chips,
}: {
  project: Project;
  accent: string;
  index: number;
  chips: AppChip[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
      className="relative isolate flex flex-col gap-4 overflow-hidden rounded-[26px] border border-(--flow-cream) bg-(--flow-cream) p-6"
      style={{
        boxShadow: `0 24px 40px -26px color-mix(in oklab, ${accent} 60%, transparent), inset 3px 0 0 ${accent}, inset 0 1px 0 rgb(255 255 255 / 0.8)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 -z-10 size-44 rounded-full blur-3xl"
        style={{ backgroundColor: `color-mix(in oklab, ${accent} 22%, transparent)` }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 items-center justify-center rounded-2xl bg-(--flow-cream)"
            style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 30%, transparent)` }}
          >
            <GoogleSheetsGlyph className="size-6" />
          </span>
          <div className="min-w-0">
            <p className={`truncate ${Z} text-[30px] leading-none font-normal text-(--flow-ink)`}>{project.name}</p>
            <p className={`mt-1 ${Z} text-[19px] leading-none font-normal`} style={{ color: accent }}>
              {project.tabs.length} tab{project.tabs.length === 1 ? "" : "s"} · updated{" "}
              {new Date(project.syncedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 ${Z} text-[22px] leading-none font-normal tabular-nums`}
          style={{ backgroundColor: `color-mix(in oklab, ${accent} 16%, transparent)`, color: accent }}
        >
          {project.rowCount.toLocaleString("en-IN")} rows
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {project.tabs.map((tab) => (
          <span
            key={tab.id}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${Z} text-[19px] leading-none font-normal`}
            style={{ backgroundColor: `color-mix(in oklab, ${accent} 14%, transparent)`, color: "var(--flow-ink)" }}
          >
            <Stack weight="duotone" className="size-3.5 shrink-0" style={{ color: accent }} />
            {tab.tab_title || sourceLabel(tab)}
          </span>
        ))}
      </div>

      <ConnectedAppsRow chips={chips} />

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/ai-insights"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${Z} text-[22px] leading-none font-normal text-(--flow-cream)`}
          style={{
            backgroundImage: `linear-gradient(120deg, ${accent}, color-mix(in oklab, ${accent} 55%, var(--flow-coral)))`,
            boxShadow: `0 12px 22px -12px color-mix(in oklab, ${accent} 65%, transparent)`,
          }}
        >
          <ChatCircleText weight="bold" className="size-4" />
          Ask AI
        </Link>
        <Link
          href="/dashboard/integrations"
          className={`inline-flex items-center gap-1.5 ${Z} text-[21px] leading-none font-normal text-(--flow-ink)/65 transition-colors hover:text-(--flow-ink)`}
        >
          <Plug weight="bold" className="size-3.5" />
          Manage in Integrations
        </Link>
      </div>
    </motion.div>
  );
}

type AppRow = {
  key: string;
  label: string;
  Glyph: (props: SVGProps<SVGSVGElement>) => ReactElement;
  connected: boolean;
  /** Sheets connect is free (each sheet tab added costs credits); the others charge on connect. */
  costsOnConnect: boolean;
  /** One line per connected account / workspace, e.g. "Acme · #general". */
  details: string[];
  connect: () => Promise<void>;
  /** Connected apps that allow several accounts get a "+ Connect new" button (costs credits). */
  addAnother?: () => Promise<void>;
};

/** Every app with its real state: connected (with the account) or a Connect button.
 * Connecting runs the same OAuth flow as Integrations; a 402 opens the buy-credits dialog. */
function AppsPanel({ apps }: { apps: AppRow[] }) {
  const { connectCost } = useCredits();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async (app: AppRow, run: () => Promise<void> = app.connect) => {
    setError(null);
    setBusyKey(app.key);
    try {
      await run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the connection. Try again.");
      setBusyKey(null);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-[26px] border border-(--flow-cream) bg-(--flow-cream) p-5"
      style={{ boxShadow: "0 24px 40px -28px color-mix(in oklab, var(--flow-magenta) 45%, transparent)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-gradient-flow ${Z} text-[30px] leading-none font-normal`}>Your apps</p>
        <Link
          href="/dashboard/integrations"
          className={`inline-flex items-center gap-1.5 ${Z} text-[21px] leading-none font-normal text-(--flow-ink)/65 transition-colors hover:text-(--flow-ink)`}
        >
          <Plug weight="bold" className="size-3.5" />
          Manage in Integrations
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {apps.map((app) => (
          <div
            key={app.key}
            className={`flex flex-col gap-2 rounded-2xl p-4 ${
              app.connected ? "bg-(--flow-cyan)/15" : "bg-(--flow-peach)/45"
            }`}
          >
            <div className="flex items-center gap-2">
              <app.Glyph aria-hidden className="size-6 shrink-0" />
              <span className={`${Z} text-[24px] leading-none font-normal text-(--flow-ink)`}>{app.label}</span>
              <span
                className={`ml-auto size-2 rounded-full ${app.connected ? "bg-(--flow-mint)" : "bg-(--flow-ink)/25"}`}
                aria-hidden
              />
            </div>
            {app.connected ? (
              <ul className="flex flex-col gap-0.5">
                {(app.details.length > 0 ? app.details : ["Connected"]).map((d, i) => (
                  <li key={i} className={`truncate ${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/80`} title={d}>
                    {d}
                  </li>
                ))}
              </ul>
            ) : null}
            {app.connected && app.addAnother && (
              <button
                type="button"
                onClick={() => void connect(app, app.addAnother)}
                disabled={busyKey !== null}
                className={`mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-(--flow-cream) px-3.5 py-1.5 ${Z} text-[20px] leading-none font-normal text-(--flow-magenta) shadow-[0_10px_18px_-12px_var(--flow-magenta)] disabled:opacity-60`}
              >
                <Plus weight="bold" className="size-3.5" />
                {busyKey === app.key ? "Opening…" : `Connect new · ${connectCost} credits`}
              </button>
            )}
            {app.connected ? null : (
              <>
                <p className={`${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/55`}>Not connected</p>
                <button
                  type="button"
                  onClick={() => void connect(app)}
                  disabled={busyKey !== null}
                  className={`bg-gradient-flow mt-auto inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-1.5 ${Z} text-[21px] leading-none font-normal text-(--flow-cream) disabled:opacity-60`}
                >
                  <Plus weight="bold" className="size-3.5" />
                  {busyKey === app.key ? "Opening…" : app.costsOnConnect ? `Connect · ${connectCost} credits` : "Connect"}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className={`${Z} text-[20px] leading-snug text-(--flow-coral)`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function ProjectsGrid() {
  const {
    accounts: sheetsAccounts,
    connection,
    sources,
    loading,
    connect: connectSheets,
  } = useGoogleSheetsConnection();
  const { accounts: gmailAccounts, connection: gmailConnection, connect: connectGmail } = useGmailConnection();
  const gmailConnected = gmailConnection?.status === "connected";
  const { accounts: slackAccounts, connection: slackConnection, connect: connectSlack } = useSlackConnection();
  const slackConnected = slackConnection?.status === "connected";
  const { accounts: notionAccounts, connection: notionConnection, connect: connectNotion } = useNotionConnection();
  const notionConnected = notionConnection?.status === "connected";
  const projects = groupProjects(sources);
  const linkedApps = [
    gmailConnected && { name: "Gmail", Glyph: GmailGlyph },
    slackConnected && { name: "Slack", Glyph: SlackGlyph },
    notionConnected && { name: "Notion", Glyph: NotionGlyph },
  ].filter((a) => a !== false);

  const gmailOf = (id: string | null) => gmailAccounts.find((g) => g.id === id)?.external_account_email;
  const tagged = (line: string, gmailId: string | null) => {
    const g = gmailOf(gmailId);
    return g ? `${line} (${g})` : line;
  };
  const tabsOf = (id: string) => sources.filter((s) => s.connection_id === id).length;

  const apps: AppRow[] = [
    {
      key: "sheets",
      label: "Google Sheets",
      Glyph: GoogleSheetsGlyph,
      connected: connection?.status === "connected",
      costsOnConnect: false,
      details: sheetsAccounts.map((a) => {
        const n = sheetsAccounts.length === 1 ? sources.length : tabsOf(a.id);
        return [a.external_account_email, `${n} tab${n === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
      }),
      connect: () => connectSheets(),
      addAnother: () => connectSheets(),
    },
    {
      key: "gmail",
      label: "Gmail",
      Glyph: GmailGlyph,
      connected: gmailConnected,
      costsOnConnect: true,
      details: gmailAccounts.map((g) => g.external_account_email ?? "Gmail"),
      connect: () => connectGmail(),
      addAnother: () => connectGmail(),
    },
    {
      key: "slack",
      label: "Slack",
      Glyph: SlackGlyph,
      connected: slackConnected,
      costsOnConnect: true,
      details: slackAccounts.map((w) =>
        tagged(
          [w.external_account_email, w.slack_channel_name && `#${w.slack_channel_name}`].filter(Boolean).join(" · "),
          w.gmail_connection_id
        )
      ),
      connect: () => connectSlack(),
      addAnother: () => connectSlack(),
    },
    {
      key: "notion",
      label: "Notion",
      Glyph: NotionGlyph,
      connected: notionConnected,
      costsOnConnect: true,
      details: notionAccounts.map((w) =>
        tagged([w.external_account_email, w.notion_page_title].filter(Boolean).join(" · "), w.gmail_connection_id)
      ),
      connect: () => connectNotion(),
      addAnother: () => connectNotion(),
    },
  ];

  if (loading) {
    return <p className={`${Z} px-2 text-[24px] leading-none text-(--flow-ink)/70`}>Loading…</p>;
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col gap-5">
      <AppsPanel apps={apps} />
      <div
        className="mx-auto mt-6 flex max-w-md flex-col items-center gap-4 rounded-[28px] border border-(--flow-cream) bg-(--flow-cream) p-8 text-center"
        style={{ boxShadow: "0 24px 40px -26px color-mix(in oklab, var(--flow-magenta) 45%, transparent)" }}
      >
        <span className="flex size-16 items-center justify-center rounded-[20px] bg-linear-to-br from-(--flow-cream) to-(--flow-peach)">
          <FolderOpen weight="duotone" className="size-8 text-(--flow-magenta)" />
        </span>
        <div>
          <p className={`text-gradient-flow ${Z} text-[36px] leading-none font-normal`}>
            {linkedApps.length > 0 ? "Your apps are ready" : "Start your first project"}
          </p>
          <p className={`mt-2 ${Z} text-[23px] leading-snug font-normal text-(--flow-ink)/80`}>
            {linkedApps.length > 0
              ? "Each Google Sheet you add becomes a project, with its tabs inside. Add one and your connected apps can work with it."
              : "Each Google Sheet you add becomes a project, with its tabs inside. Connect your apps to get going."}
          </p>
        </div>
        {linkedApps.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {linkedApps.map(({ name, Glyph }) => (
              <span
                key={name}
                className={`inline-flex items-center gap-1.5 rounded-full bg-(--flow-peach)/60 px-3 py-1 ${Z} text-[19px] leading-none font-normal text-(--flow-ink)`}
              >
                <Glyph className="size-4" />
                {name}
                <span className="size-1.5 rounded-full bg-(--flow-mint)" />
              </span>
            ))}
          </div>
        )}
        <Link
          href="/dashboard/integrations"
          className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 ${Z} text-[24px] leading-none font-normal text-(--flow-cream)`}
          style={{ boxShadow: "0 18px 30px -14px var(--flow-magenta)" }}
        >
          <Plus weight="bold" className="size-4" />
          {linkedApps.length > 0 ? "Add your first sheet" : "Connect your apps"}
        </Link>
      </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AppsPanel apps={apps} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, i) => (
        <ProjectCard
          key={project.spreadsheetId}
          project={project}
          accent={accents[i % accents.length]}
          index={i}
          chips={buildChips(project.tabs, sheetsAccounts, gmailAccounts, slackAccounts, notionAccounts)}
        />
      ))}
      </div>
    </div>
  );
}
