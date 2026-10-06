"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Coins, Plus } from "@phosphor-icons/react";
import { useCredits } from "@/components/billing/credits-provider";
import { LOW_CREDITS } from "@/components/billing/credits-pill";
import { apiFetch } from "@/lib/api";
import { CREDITS_CHANGED_EVENT } from "@/lib/credits-events";

const Z = "font-(family-name:--font-zeyada)";
const CARD = "rounded-[26px] border border-(--flow-cream) bg-(--flow-cream) p-5";
const CARD_SHADOW = { boxShadow: "0 24px 40px -28px color-mix(in oklab, var(--flow-magenta) 45%, transparent)" };

type Entry = { delta: number; reason: string; created_at: string };

const REASONS: Record<string, string> = {
  topup: "Credits bought",
  connect_google_sheets: "Added a sheet tab",
  connect_gmail: "Connected Gmail",
  connect_slack: "Connected Slack",
  connect_notion: "Connected Notion",
  automation_run: "Automation run",
};

function reasonLabel(reason: string): string {
  if (REASONS[reason]) return REASONS[reason];
  if (reason.includes("question") || reason.includes("insight") || reason.includes("ask")) return "AI question";
  const text = reason.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export function BillingSettings() {
  const { credits, connectCost, questionCost, automationCost, testMode, openBuy } = useCredits();
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await apiFetch<{ entries: Entry[] }>("/api/v1/billing/balance", await getToken());
        if (live) {
          setEntries(res.entries);
          setError(null);
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Couldn't load your history.");
      }
    };
    void load();
    window.addEventListener(CREDITS_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(CREDITS_CHANGED_EVENT, load);
    };
  }, [getToken]);

  const low = credits !== null && credits < LOW_CREDITS;
  const prices = [
    { label: "Connect Gmail, Slack or Notion", cost: connectCost },
    { label: "Add a Google Sheets tab", cost: connectCost },
    { label: "Ask the AI a question", cost: questionCost },
    { label: "Scheduled automation run", cost: automationCost },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className={`${CARD} flex flex-wrap items-center justify-between gap-4`} style={CARD_SHADOW}>
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-linear-to-br from-(--flow-cream) to-(--flow-peach)">
            <Coins weight="duotone" className="size-7 text-(--flow-magenta)" />
          </span>
          <div>
            <p className={`${Z} text-[22px] leading-none font-normal text-(--flow-ink)/70`}>Credit balance</p>
            <p className={`text-gradient-flow ${Z} text-[56px] leading-none font-normal`}>
              {credits === null ? "–" : credits.toLocaleString("en-IN")}
            </p>
            <p className={`mt-1 ${Z} text-[21px] leading-snug font-normal ${low ? "text-(--flow-coral)" : "text-(--flow-ink)/65"}`}>
              {credits === null
                ? "Loading…"
                : credits < questionCost
                  ? "You're out of credits. Buy some to keep asking."
                  : low
                    ? `Running low: about ${Math.floor(credits / questionCost)} questions left.`
                    : `Enough for about ${Math.floor(credits / questionCost)} questions.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openBuy}
          className={`bg-gradient-flow inline-flex items-center gap-2 rounded-full px-6 py-2.5 ${Z} text-[24px] leading-none font-normal text-(--flow-cream)`}
          style={{ boxShadow: "0 18px 30px -14px var(--flow-magenta)" }}
        >
          <Plus weight="bold" className="size-4" />
          Buy credits
        </button>
        {testMode && (
          <p className={`w-full ${Z} text-[20px] leading-snug font-normal text-(--flow-ink)/65`}>
            Payments are in test mode, so no real money is charged.
          </p>
        )}
      </section>

      <section className={CARD} style={CARD_SHADOW}>
        <p className={`text-gradient-flow ${Z} text-[30px] leading-none font-normal`}>What things cost</p>
        <p className={`mt-1 ${Z} text-[21px] leading-snug font-normal text-(--flow-ink)/65`}>
          1 rupee buys 1 credit. Existing connections stay free, and you&apos;re only charged after a step succeeds.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {prices.map((p) => (
            <li key={p.label} className="flex items-center justify-between gap-3 rounded-2xl bg-(--flow-peach)/45 px-4 py-2.5">
              <span className={`${Z} text-[22px] leading-snug font-normal text-(--flow-ink)`}>{p.label}</span>
              <span className={`${Z} shrink-0 text-[24px] leading-none font-normal text-(--flow-magenta)`}>{p.cost}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={CARD} style={CARD_SHADOW}>
        <p className={`text-gradient-flow ${Z} text-[30px] leading-none font-normal`}>Recent activity</p>
        {error ? (
          <p role="alert" className={`mt-3 ${Z} text-[21px] leading-snug text-(--flow-coral)`}>{error}</p>
        ) : entries === null ? (
          <div className="mt-3 flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-2xl bg-(--flow-peach)/45" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className={`mt-3 ${Z} text-[22px] leading-snug font-normal text-(--flow-ink)/65`}>
            Nothing yet. Credits you buy or spend will show up here.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {entries.map((e, i) => (
              <li key={`${e.created_at}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl bg-(--flow-peach)/35 px-4 py-2.5">
                <div className="min-w-0">
                  <p className={`truncate ${Z} text-[22px] leading-none font-normal text-(--flow-ink)`}>{reasonLabel(e.reason)}</p>
                  <p className={`mt-1 ${Z} text-[18px] leading-none font-normal text-(--flow-ink)/55`}>{when(e.created_at)} IST</p>
                </div>
                <span
                  className={`${Z} shrink-0 text-[26px] leading-none font-normal ${e.delta > 0 ? "text-[oklch(0.55_0.15_160)]" : "text-(--flow-coral)"}`}
                >
                  {e.delta > 0 ? "+" : "−"}
                  {Math.abs(e.delta).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
        {entries && entries.length >= 20 && (
          <p className={`mt-3 ${Z} text-[19px] leading-none font-normal text-(--flow-ink)/55`}>Showing your latest 20 entries.</p>
        )}
      </section>
    </div>
  );
}
