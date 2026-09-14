"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

type Me = {
  user_id: string;
  session_id: string | null;
  org_id: string | null;
  org_role: string | null;
};

// Proves the frontend -> backend authenticated call actually works
// (roadmap.txt Phase 1: "Frontend calls backend with Authorization:
// Bearer <session token>"), by calling GET /api/v1/me once signed in.
export function useBackendMe() {
  const { isSignedIn, getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch<Me>("/api/v1/me", token);
        if (!cancelled) setMe(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  return { me, error };
}
