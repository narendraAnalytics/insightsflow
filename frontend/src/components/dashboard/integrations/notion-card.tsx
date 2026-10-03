"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, LinkSimple, Plus, Star, XCircle } from "@phosphor-icons/react";
import { NotionGlyph } from "@/components/site/brand-icons";
import { useCredits } from "@/components/billing/credits-provider";
import { useNotionConnection, type NotionConnection, type NotionPage } from "@/hooks/use-notion-connection";
import { useGmailConnection } from "@/hooks/use-gmail-connection";
import { type GmailConnection } from "@/hooks/use-gmail-connection";
import { GmailLinkSelect } from "@/components/dashboard/integrations/gmail-link-select";
import { GlassSlab, StatusPill } from "@/components/dashboard/integrations/google-sheets-card";

const zeyada = "font-(family-name:--font-zeyada) font-normal";

/** What happens on Notion's page, so the user isn't surprised by it. Shown before connecting. */
function ConnectGuide({ cost }: { cost: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-(--flow-peach)/45 px-4 py-3">
      <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)`}>How connecting works</p>
      <ol className={`list-decimal space-y-0.5 pl-5 ${zeyada} text-[20px] leading-snug text-(--flow-ink)/80`}>
        <li>
          Notion opens using the account this browser is signed in to (to use a different email, log out of Notion
          first or use a private window). Choose{" "}
          <strong className="font-normal text-(--flow-magenta)">your workspace</strong> from the menu at the top.
        </li>
        <li>Pick the pages to share, then Allow. You&apos;ll come back here, and {cost} credits are used once it&apos;s saved.</li>
        <li>Choose the page reports are saved under.</li>
      </ol>
      <p className={`${zeyada} text-[19px] leading-snug text-(--flow-ink)/65`}>
        InsightFlow only creates a page after you review a draft, and only under pages you shared.
      </p>
    </div>
  );
}

/** One connected workspace: its parent page, plus Make default / Reconnect / Disconnect. */
function WorkspaceRow({
  account,
  several,
  busy,
  searchPages,
  setPage,
  gmailAccounts,
  onLinkGmail,
  onReconnect,
  onMakeDefault,
  onDisconnect,
  run,
}: {
  account: NotionConnection;
  gmailAccounts: GmailConnection[];
  onLinkGmail: (gmailId: string | null) => void;
  several: boolean;
  busy: boolean;
  searchPages: (id: string, query: string) => Promise<NotionPage[]>;
  setPage: (id: string, pageId: string) => Promise<void>;
  onReconnect: () => void;
  onMakeDefault: () => void;
  onDisconnect: () => void;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<NotionPage[] | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const inputId = useId();

  const live = account.status === "connected";
  const pageTitle = account.notion_page_title;
  const needsPage = live && !pageTitle;
  const showPicker = live && (needsPage || changing);

  // Load this workspace's shared pages while its picker is on screen; re-run (debounced) as the user types.
  useEffect(() => {
    if (!showPicker) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        searchPages(account.id, query)
          .then((list) => {
            if (cancelled) return;
            setPages(list);
            setPagesError(null);
          })
          .catch((err) => {
            if (!cancelled) setPagesError(err instanceof Error ? err.message : "Couldn't load your pages.");
          });
      },
      query ? 350 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showPicker, query, searchPages, account.id]);

  const pick = (id: string) =>
    run(async () => {
      await setPage(account.id, id);
      setChanging(false);
      setQuery("");
    });

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-(--flow-cream)/70 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${zeyada} text-[23px] leading-none text-(--flow-ink)`}>
          {account.external_account_email ?? "Notion workspace"}
        </span>
        {account.is_default && several && (
          <span className={`inline-flex items-center gap-1 rounded-full bg-(--flow-magenta)/15 px-2.5 py-0.5 ${zeyada} text-[18px] leading-none text-(--flow-magenta)`}>
            <Star weight="fill" className="size-3" />
            Default
          </span>
        )}
        {!live && (
          <span className={`rounded-full bg-(--flow-coral)/15 px-2.5 py-0.5 ${zeyada} text-[18px] leading-none text-(--flow-coral)`}>
            Not connected
          </span>
        )}
      </div>

      <GmailLinkSelect
        accounts={gmailAccounts}
        value={account.gmail_connection_id}
        onChange={onLinkGmail}
        disabled={busy}
      />

      {showPicker ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/75`}>
            {needsPage ? "Choose the page reports are saved under" : "Save under a different page"}
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your shared pages"
            autoComplete="off"
            className="w-full max-w-xs rounded-xl border border-(--flow-ink)/15 bg-(--flow-cream)/80 px-3 py-2 text-[14px] text-(--flow-ink) placeholder:text-(--flow-ink)/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta)"
          />
          <ul className="flex max-h-48 w-full max-w-xs flex-col gap-1 overflow-y-auto" aria-label="Notion pages">
            {pages === null && !pagesError && (
              <li className={`${zeyada} text-[20px] leading-none text-(--flow-ink)/60`}>Loading pages…</li>
            )}
            {(pages ?? []).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void pick(p.id)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-lg bg-(--flow-cream)/70 px-3 py-1.5 text-left text-[14px] text-(--flow-ink) transition-colors hover:bg-(--flow-peach)/70 focus-visible:outline-2 focus-visible:outline-(--flow-magenta) disabled:opacity-60"
                >
                  <FileText weight="duotone" className="size-4 shrink-0 text-(--flow-magenta)" />
                  <span className="truncate">{p.title}</span>
                </button>
              </li>
            ))}
          </ul>
          {pages?.length === 0 && (
            <p className={`${zeyada} text-[19px] leading-snug text-(--flow-ink)/65`}>
              {query
                ? "No shared page matches that."
                : "No pages shared yet. In Notion, open a page → … menu → Connections → add InsightFlow, then search again."}
            </p>
          )}
          {changing && (
            <button
              type="button"
              onClick={() => setChanging(false)}
              className={`w-fit ${zeyada} text-[19px] leading-none text-(--flow-ink)/65 hover:text-(--flow-magenta)`}
            >
              Keep &ldquo;{pageTitle}&rdquo;
            </button>
          )}
          {pagesError && (
            <p role="alert" className={`${zeyada} text-[20px] leading-snug text-(--flow-coral)`}>
              {pagesError}
            </p>
          )}
        </div>
      ) : (
        live && (
          <p className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/75`}>
            Reports are saved under <span className="text-(--flow-magenta)">{pageTitle}</span>
          </p>
        )
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {live && !showPicker && (
          <button
            type="button"
            onClick={() => {
              setPagesError(null);
              setPages(null);
              setChanging(true);
            }}
            className={`${zeyada} text-[20px] leading-none text-(--flow-magenta) hover:underline`}
          >
            Change page
          </button>
        )}
        {!live && (
          <button
            type="button"
            onClick={onReconnect}
            disabled={busy}
            className={`${zeyada} text-[20px] leading-none text-(--flow-magenta) hover:underline disabled:opacity-60`}
          >
            Reconnect
          </button>
        )}
        {several && !account.is_default && live && (
          <button
            type="button"
            onClick={onMakeDefault}
            disabled={busy}
            className={`${zeyada} text-[20px] leading-none text-(--flow-ink)/70 hover:text-(--flow-magenta) disabled:opacity-60`}
          >
            Make default
          </button>
        )}
        <button
          type="button"
          onClick={onDisconnect}
          disabled={busy}
          className={`inline-flex items-center gap-1 ${zeyada} text-[20px] leading-none text-(--flow-ink)/65 transition-colors hover:text-(--flow-coral) disabled:opacity-60`}
        >
          <XCircle weight="bold" className="size-3.5" />
          Disconnect
        </button>
      </div>
    </li>
  );
}

export function NotionCard() {
  const { accounts, loading, error, connect, disconnect, makeDefault, setGmailLink, searchPages, setPage } =
    useNotionConnection();
  const { accounts: gmailAccounts } = useGmailConnection();
  // Which Gmail a NEW workspace will belong to; defaults to the default Gmail account.
  const [newGmailId, setNewGmailId] = useState<string | null | undefined>(undefined);
  const gmailForNew = newGmailId === undefined ? (gmailAccounts.find((g) => g.is_default)?.id ?? null) : newGmailId;
  const { connectCost } = useCredits();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const flag = useSearchParams().get("notion_error");

  const hasAccounts = accounts.length > 0;

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

  return (
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
            <NotionGlyph className="size-9" />
          </span>
          <div>
            <p className={`text-gradient-flow ${zeyada} text-[38px] leading-none`}>Notion</p>
            <p className={`mt-1 max-w-[26ch] ${zeyada} text-[22px] leading-snug text-(--flow-ink)/80`}>
              Save approved reports as pages
            </p>
          </div>
        </div>
        <StatusPill connected={accounts.some((a) => a.status === "connected")} />
      </div>

      {loading ? (
        <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/70`}>Checking connection…</p>
      ) : !hasAccounts ? (
        <div className="flex flex-col gap-3">
          <p className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
            Lets InsightFlow save a report as a page under a Notion page you choose. You pick which pages to share, and
            nothing is saved until you review it and click Save.
          </p>
          <ConnectGuide cost={connectCost} />
          <GmailLinkSelect
            accounts={gmailAccounts}
            value={gmailForNew}
            onChange={setNewGmailId}
            label="This workspace belongs to"
          />
          <div>
            <button
              type="button"
              onClick={() => void run(() => connect({ gmailConnectionId: gmailForNew }))}
              disabled={busy}
              className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 ${zeyada} text-[24px] leading-none text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60`}
            >
              <LinkSimple weight="bold" className="size-4" />
              Connect Notion · {connectCost} credits
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2.5">
            {accounts.map((account) => (
              <WorkspaceRow
                key={account.id}
                account={account}
                several={accounts.length > 1}
                busy={busy}
                searchPages={searchPages}
                setPage={setPage}
                gmailAccounts={gmailAccounts}
                onLinkGmail={(gmailId) => void run(() => setGmailLink(account.id, gmailId))}
                run={run}
                onReconnect={() => void run(() => connect({ reconnect: true }))}
                onMakeDefault={() => void run(() => makeDefault(account.id))}
                onDisconnect={() => void run(() => disconnect(account.id))}
              />
            ))}
          </ul>
          <p className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/70`}>
            In AI Insights, ask &ldquo;save this to Notion&rdquo; and review the draft before it&apos;s saved. To add
            another workspace, pick it from the menu on Notion&apos;s page.
          </p>
          <p className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/70`}>
            Notion has no account chooser: it uses whichever Notion account this browser is already signed in to. To
            connect a workspace from a <strong className="font-normal text-(--flow-magenta)">different email</strong>,
            sign out of Notion first (notion.so → your name → Log out), or open InsightFlow in a private window, then
            click Connect another workspace.
          </p>
          <GmailLinkSelect
            accounts={gmailAccounts}
            value={gmailForNew}
            onChange={setNewGmailId}
            label="New workspace belongs to"
          />
          <div>
            <button
              type="button"
              onClick={() => void run(() => connect({ gmailConnectionId: gmailForNew }))}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--flow-cream) px-5 py-2 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal text-(--flow-magenta) shadow-[0_14px_24px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60"
            >
              <Plus weight="bold" className="size-4" />
              Connect another workspace · {connectCost} credits
            </button>
          </div>
        </div>
      )}

      {(error || actionError || flag === "denied" || flag === "limit") && (
        <p role="alert" className={`${zeyada} text-[22px] leading-snug text-(--flow-coral)`}>
          {actionError ??
            error ??
            (flag === "limit"
              ? "You've reached the limit of 5 Notion workspaces. Disconnect one first."
              : "Notion access wasn't granted. Connect again to allow saving. Nothing was charged.")}
        </p>
      )}
    </GlassSlab>
  );
}
