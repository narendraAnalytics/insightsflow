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
import { sourceLabel, useGoogleSheetsConnection, type DataSource } from "@/hooks/use-google-sheets-connection";

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
  label: string;
  live: boolean;
  Glyph?: (props: SVGProps<SVGSVGElement>) => ReactElement;
  /** Shown after the label when not live ("not connected"). */
  note?: string;
};

/** The apps shown on a project. Google Sheets (the project's own source), Gmail, Slack and
 * Notion reflect the real connection state; nothing here is placeholder or invented.
 */
function appChips(gmailConnected: boolean, slackConnected: boolean, notionConnected: boolean): AppChip[] {
  return [
    { label: "Google Sheets", live: true, Glyph: GoogleSheetsGlyph },
    { label: "Gmail", live: gmailConnected, Glyph: GmailGlyph, note: "not connected" },
    { label: "Slack", live: slackConnected, Glyph: SlackGlyph, note: "not connected" },
    { label: "Notion", live: notionConnected, Glyph: NotionGlyph, note: "not connected" },
  ];
}

function ConnectedAppsRow({
  gmailConnected,
  slackConnected,
  notionConnected,
}: {
  gmailConnected: boolean;
  slackConnected: boolean;
  notionConnected: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`${Z} text-[20px] leading-none font-normal text-(--flow-ink)/70`}>Connected apps</span>
      {appChips(gmailConnected, slackConnected, notionConnected).map((app) => (
        <span
          key={app.label}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${Z} text-[19px] leading-none font-normal ${
            app.live
              ? "bg-(--flow-cyan)/20 text-(--flow-ink)"
              : "bg-(--flow-ink)/6 text-(--flow-ink)/40"
          }`}
        >
          {app.Glyph ? (
            <app.Glyph aria-hidden className={`size-4 shrink-0 ${app.live ? "" : "opacity-45 grayscale"}`} />
          ) : (
            app.live && <span className="size-1.5 rounded-full bg-(--flow-cyan)" />
          )}
          {app.label}
          {!app.live && app.note && <span className="text-[15px]">· {app.note}</span>}
        </span>
      ))}
    </div>
  );
}

function ProjectCard({
  project,
  accent,
  index,
  gmailConnected,
  slackConnected,
  notionConnected,
}: {
  project: Project;
  accent: string;
  index: number;
  gmailConnected: boolean;
  slackConnected: boolean;
  notionConnected: boolean;
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

      <ConnectedAppsRow gmailConnected={gmailConnected} slackConnected={slackConnected} notionConnected={notionConnected} />

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
  /** Account / workspace plus what it is set up to use, e.g. "Acme · #general". */
  detail: string | null;
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
              <p className={`truncate ${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/80`} title={app.detail ?? undefined}>
                {app.detail ?? "Connected"}
              </p>
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
  const { connection, loading, connect: connectSheets } = useGoogleSheetsConnection();
  const { accounts: gmailAccounts, connection: gmailConnection, connect: connectGmail } = useGmailConnection();
  const gmailConnected = gmailConnection?.status === "connected";
  const { connection: slackConnection, connect: connectSlack } = useSlackConnection();
  const slackConnected = slackConnection?.status === "connected";
  const { connection: notionConnection, connect: connectNotion } = useNotionConnection();
  const notionConnected = notionConnection?.status === "connected";
  const sources = connection?.sources ?? [];
  const projects = groupProjects(sources);
  const linkedApps = [
    gmailConnected && { name: "Gmail", Glyph: GmailGlyph },
    slackConnected && { name: "Slack", Glyph: SlackGlyph },
    notionConnected && { name: "Notion", Glyph: NotionGlyph },
  ].filter((a) => a !== false);

  const apps: AppRow[] = [
    {
      key: "sheets",
      label: "Google Sheets",
      Glyph: GoogleSheetsGlyph,
      connected: connection?.status === "connected",
      costsOnConnect: false,
      detail: [
        connection?.external_account_email,
        sources.length > 0 ? `${sources.length} tab${sources.length === 1 ? "" : "s"}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      connect: connectSheets,
    },
    {
      key: "gmail",
      label: "Gmail",
      Glyph: GmailGlyph,
      connected: gmailConnected,
      costsOnConnect: true,
      detail: gmailConnection
        ? `${gmailConnection.external_account_email ?? "Gmail"}${
            gmailAccounts.length > 1 ? ` · +${gmailAccounts.length - 1} more` : ""
          }`
        : null,
      connect: () => connectGmail(),
      addAnother: () => connectGmail(),
    },
    {
      key: "slack",
      label: "Slack",
      Glyph: SlackGlyph,
      connected: slackConnected,
      costsOnConnect: true,
      detail: [slackConnection?.external_account_email, slackConnection?.slack_channel_name && `#${slackConnection.slack_channel_name}`]
        .filter(Boolean)
        .join(" · "),
      connect: connectSlack,
    },
    {
      key: "notion",
      label: "Notion",
      Glyph: NotionGlyph,
      connected: notionConnected,
      costsOnConnect: true,
      detail: [notionConnection?.external_account_email, notionConnection?.notion_page_title].filter(Boolean).join(" · "),
      connect: connectNotion,
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
          gmailConnected={gmailConnected}
          slackConnected={slackConnected}
          notionConnected={notionConnected}
        />
      ))}
      </div>
    </div>
  );
}
