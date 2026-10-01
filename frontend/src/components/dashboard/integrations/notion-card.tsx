"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, LinkSimple, XCircle } from "@phosphor-icons/react";
import { NotionGlyph } from "@/components/site/brand-icons";
import { useNotionConnection, type NotionPage } from "@/hooks/use-notion-connection";
import { GlassSlab, StatusPill } from "@/components/dashboard/integrations/google-sheets-card";

const zeyada = "font-(family-name:--font-zeyada) font-normal";

export function NotionCard() {
  const { connection, loading, error, connect, disconnect, searchPages, setPage } = useNotionConnection();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<NotionPage[] | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const inputId = useId();
  const denied = useSearchParams().get("notion_error") === "denied";

  const isConnected = connection?.status === "connected";
  const pageTitle = connection?.notion_page_title ?? null;
  const needsPage = isConnected && !pageTitle;
  const showPicker = isConnected && (needsPage || changing);

  // Load the shared pages while the picker is on screen; re-run (debounced) as the user types.
  useEffect(() => {
    if (!showPicker) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        searchPages(query)
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
  }, [showPicker, query, searchPages]);

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

  const pick = (id: string) =>
    run(async () => {
      await setPage(id);
      setChanging(false);
      setQuery("");
    });

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
        <StatusPill connected={isConnected} />
      </div>

      {loading ? (
        <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/70`}>Checking connection…</p>
      ) : !isConnected ? (
        <div className="flex flex-col gap-3">
          <p className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
            Lets InsightFlow save a report as a page under a Notion page you choose. You pick which pages to share, and
            nothing is saved until you review it and click Save.
          </p>
          <div>
            <button
              type="button"
              onClick={() => void run(connect)}
              disabled={busy}
              className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 ${zeyada} text-[24px] leading-none text-(--flow-cream) shadow-[0_18px_30px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60`}
            >
              <LinkSimple weight="bold" className="size-4" />
              Connect Notion
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/80`}>
            Workspace <span className="text-(--flow-magenta)">{connection?.external_account_email}</span>
          </p>

          {showPicker ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={inputId} className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
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
                <p className={`${zeyada} text-[20px] leading-snug text-(--flow-ink)/65`}>
                  {query
                    ? "No shared page matches that."
                    : "No pages shared yet. In Notion, open a page → … menu → Connections → add InsightFlow, then search again."}
                </p>
              )}
              {changing && (
                <button
                  type="button"
                  onClick={() => setChanging(false)}
                  className={`w-fit ${zeyada} text-[20px] leading-none text-(--flow-ink)/65 hover:text-(--flow-magenta)`}
                >
                  Keep &ldquo;{pageTitle}&rdquo;
                </button>
              )}
              {pagesError && (
                <p role="alert" className={`${zeyada} text-[21px] leading-snug text-(--flow-coral)`}>
                  {pagesError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/80`}>
                Reports are saved under <span className="text-(--flow-magenta)">{pageTitle}</span>
              </p>
              <p className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
                In AI Insights, ask &ldquo;save this to Notion&rdquo; and review the draft before it&apos;s saved.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPagesError(null);
                  setPages(null);
                  setChanging(true);
                }}
                className={`w-fit rounded-full bg-(--flow-cream) px-4 py-1.5 ${zeyada} text-[21px] leading-none text-(--flow-magenta) shadow-[0_14px_24px_-14px_var(--flow-magenta)] transition-transform hover:scale-[1.04] active:scale-[0.97]`}
              >
                Change page
              </button>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => void run(disconnect)}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 ${zeyada} text-[21px] leading-none text-(--flow-ink)/65 transition-colors hover:text-(--flow-coral) disabled:opacity-60`}
            >
              <XCircle weight="bold" className="size-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      )}

      {(error || actionError || denied) && !isConnected && (
        <p role="alert" className={`${zeyada} text-[22px] leading-snug text-(--flow-coral)`}>
          {actionError ?? error ?? "Notion access wasn't granted. Connect again to allow saving."}
        </p>
      )}
      {actionError && isConnected && (
        <p role="alert" className={`${zeyada} text-[22px] leading-snug text-(--flow-coral)`}>
          {actionError}
        </p>
      )}
    </GlassSlab>
  );
}
