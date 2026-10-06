"use client";

import Link from "next/link";
import type { ReactElement, SVGProps } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { GmailGlyph, GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { useGmailConnection } from "@/hooks/use-gmail-connection";
import { useGoogleSheetsConnection } from "@/hooks/use-google-sheets-connection";
import { useNotionConnection } from "@/hooks/use-notion-connection";
import { useSlackConnection } from "@/hooks/use-slack-connection";

const Z = "font-(family-name:--font-zeyada)";

type Account = { id: string; name: string; detail?: string; isDefault: boolean; ok: boolean };
type App = {
  key: string;
  label: string;
  Glyph: (props: SVGProps<SVGSVGElement>) => ReactElement;
  accounts: Account[];
};

type Row = { id: string; status: string; is_default?: boolean; external_account_email?: string | null };

function toAccounts<T extends Row>(rows: T[], detail?: (row: T) => string | undefined): Account[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.external_account_email ?? "Connected account",
    detail: detail?.(r),
    isDefault: !!r.is_default,
    ok: r.status === "connected",
  }));
}

/** Read-only overview. Connecting, disconnecting and choosing defaults stay on Integrations. */
export function AppsSettings() {
  const sheets = useGoogleSheetsConnection();
  const gmail = useGmailConnection();
  const slack = useSlackConnection();
  const notion = useNotionConnection();

  const apps: App[] = [
    {
      key: "sheets",
      label: "Google Sheets",
      Glyph: GoogleSheetsGlyph,
      accounts: toAccounts(sheets.accounts, (r) => {
        const n = sheets.sources.filter((s) => s.connection_id === r.id).length;
        return `${n} tab${n === 1 ? "" : "s"}`;
      }),
    },
    { key: "gmail", label: "Gmail", Glyph: GmailGlyph, accounts: toAccounts(gmail.accounts) },
    {
      key: "slack",
      label: "Slack",
      Glyph: SlackGlyph,
      accounts: toAccounts(slack.accounts, (r) =>
        r.slack_channel_name ? `Posts to #${r.slack_channel_name}` : "No channel chosen yet"
      ),
    },
    {
      key: "notion",
      label: "Notion",
      Glyph: NotionGlyph,
      accounts: toAccounts(notion.accounts, (r) =>
        r.notion_page_title ? `Reports go under ${r.notion_page_title}` : "No page chosen yet"
      ),
    },
  ];

  return (
    <section
      className="flex flex-col gap-4 rounded-[26px] border border-(--flow-cream) bg-(--flow-cream) p-5"
      style={{ boxShadow: "0 24px 40px -28px color-mix(in oklab, var(--flow-magenta) 45%, transparent)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-gradient-flow ${Z} text-[30px] leading-none font-normal`}>Connected apps</p>
          <p className={`mt-1 ${Z} text-[21px] leading-snug font-normal text-(--flow-ink)/65`}>
            Every account InsightFlow can reach for you. Changes happen on the Integrations page.
          </p>
        </div>
        <Link
          href="/dashboard/integrations"
          className={`bg-gradient-flow inline-flex items-center gap-1.5 rounded-full px-5 py-2 ${Z} text-[22px] leading-none font-normal text-(--flow-cream)`}
        >
          Manage integrations
          <ArrowUpRight weight="bold" className="size-4" />
        </Link>
      </div>

      {sheets.loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-(--flow-peach)/45" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {apps.map((app) => (
            <div
              key={app.key}
              className={`flex flex-col gap-2 rounded-2xl p-4 ${app.accounts.length ? "bg-(--flow-cyan)/15" : "bg-(--flow-peach)/45"}`}
            >
              <div className="flex items-center gap-2">
                <app.Glyph aria-hidden className="size-6 shrink-0" />
                <span className={`${Z} text-[24px] leading-none font-normal text-(--flow-ink)`}>{app.label}</span>
                <span
                  className={`ml-auto size-2 rounded-full ${app.accounts.length ? "bg-(--flow-mint)" : "bg-(--flow-ink)/25"}`}
                  aria-hidden
                />
              </div>
              {app.accounts.length === 0 ? (
                <p className={`${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/55`}>Not connected</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {app.accounts.map((a) => (
                    <li key={a.id} className="flex flex-col">
                      <span className={`flex items-center gap-2 ${Z} text-[21px] leading-snug font-normal text-(--flow-ink)/90`}>
                        <span className="truncate" title={a.name}>{a.name}</span>
                        {a.isDefault && app.accounts.length > 1 && (
                          <span className="shrink-0 rounded-full bg-(--flow-magenta)/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-(--flow-magenta) uppercase">
                            Default
                          </span>
                        )}
                        {!a.ok && (
                          <span className="shrink-0 rounded-full bg-(--flow-amber)/25 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-(--flow-ink) uppercase">
                            Reconnect
                          </span>
                        )}
                      </span>
                      {a.detail && (
                        <span className={`${Z} text-[18px] leading-snug font-normal text-(--flow-ink)/55`}>{a.detail}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
