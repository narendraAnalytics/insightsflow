"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CREDITS_CHANGED_EVENT, CREDITS_NEEDED_EVENT } from "@/lib/credits-events";
import { BuyCreditsDialog } from "@/components/billing/buy-credits-dialog";

type Balance = {
  credits: number;
  connect_cost: number;
  question_cost: number;
  automation_cost: number;
  test_mode: boolean;
};

type CreditsContextValue = {
  /** null until the first load finishes. */
  credits: number | null;
  connectCost: number;
  questionCost: number;
  automationCost: number;
  testMode: boolean;
  refresh: () => Promise<void>;
  openBuy: () => void;
};

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function useCredits(): CreditsContextValue {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits must be used inside <CreditsProvider>");
  return ctx;
}

/** The OAuth callbacks redirect here with ?billing=insufficient when the balance ran out mid-flow. */
function BillingRedirectWatcher({ onNeeded }: { onNeeded: () => void }) {
  const flagged = useSearchParams().get("billing") === "insufficient";
  useEffect(() => {
    if (flagged) onNeeded();
  }, [flagged, onNeeded]);
  return null;
}

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      setBalance(await apiFetch<Balance>("/api/v1/billing/balance", await getToken()));
    } catch {
      /* keep the last known balance; the card shows a dash until one loads */
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openBuy = useCallback(() => setBuyOpen(true), []);

  useEffect(() => {
    const onNeeded = () => setBuyOpen(true);
    const onChanged = () => void refresh();
    window.addEventListener(CREDITS_NEEDED_EVENT, onNeeded);
    window.addEventListener(CREDITS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(CREDITS_NEEDED_EVENT, onNeeded);
      window.removeEventListener(CREDITS_CHANGED_EVENT, onChanged);
    };
  }, [refresh]);

  const value = useMemo<CreditsContextValue>(
    () => ({
      credits: balance?.credits ?? null,
      connectCost: balance?.connect_cost ?? 50,
      questionCost: balance?.question_cost ?? 2,
      automationCost: balance?.automation_cost ?? 5,
      testMode: balance?.test_mode ?? false,
      refresh,
      openBuy,
    }),
    [balance, refresh, openBuy]
  );

  return (
    <CreditsContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <BillingRedirectWatcher onNeeded={openBuy} />
      </Suspense>
      <BuyCreditsDialog open={buyOpen} onOpenChange={setBuyOpen} onPaid={refresh} />
    </CreditsContext.Provider>
  );
}
