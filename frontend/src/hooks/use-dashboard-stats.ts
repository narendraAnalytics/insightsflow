"use client";

// Backend has no Projects/Integrations/Tasks/Analytics data model yet
// (see roadmap.txt) — this hook returns the honest zero/empty shape so
// the dashboard UI never shows invented numbers. Swap the body for a
// real fetch once those backend endpoints exist; consumers already
// handle the loading/empty states.
export type DashboardStats = {
  totalProjects: number;
  totalProjectsDeltaPct: number | null;
  activeIntegrations: number;
  activeIntegrationsDeltaPct: number | null;
  tasksCompleted: number;
  tasksCompletedDeltaPct: number | null;
  timeSavedHours: number;
  timeSavedDeltaPct: number | null;
};

const emptyStats: DashboardStats = {
  totalProjects: 0,
  totalProjectsDeltaPct: null,
  activeIntegrations: 0,
  activeIntegrationsDeltaPct: null,
  tasksCompleted: 0,
  tasksCompletedDeltaPct: null,
  timeSavedHours: 0,
  timeSavedDeltaPct: null,
};

export function useDashboardStats() {
  return { stats: emptyStats, isLoading: false };
}
