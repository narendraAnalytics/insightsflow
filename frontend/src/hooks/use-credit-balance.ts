"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { CREDITS_CHANGED_EVENT } from "@/lib/credits-events";

/** The signed-in user's credit balance (null while loading or on error). For pages
 * outside the dashboard's CreditsProvider, such as the landing navbar. */
export function useCreditBalance(): number | null {
  const { isSignedIn, getToken } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const res = await apiFetch<{ credits: number }>("/api/v1/billing/balance", await getToken());
      setCredits(res.credits);
    } catch {
      /* keep the last value; the pill shows a dash */
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    void load();
    window.addEventListener(CREDITS_CHANGED_EVENT, load);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, load);
  }, [load]);

  return credits;
}
