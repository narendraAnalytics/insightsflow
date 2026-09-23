"use client";

import { FolderOpen, Plus } from "@phosphor-icons/react";

// No Projects backend model yet — honest empty state instead of the
// mockup's fabricated rows.
export function ProjectsTable() {
  return (
    <div className="glass-card flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-[15px] font-semibold text-(--flow-ink)">Your Projects</h3>
        <span className="text-[12.5px] font-semibold text-(--flow-ink)/30">View All</span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4 border-b border-(--flow-ink)/8 pb-2 text-[11.5px] font-semibold tracking-wide text-(--flow-ink)/40 uppercase">
        <span>Name</span>
        <span>Status</span>
        <span>Progress</span>
        <span>Last Updated</span>
      </div>

      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="glass-panel flex size-12 items-center justify-center rounded-full">
          <FolderOpen className="size-5 text-(--flow-ink)/40" />
        </span>
        <p className="text-[13.5px] font-medium text-(--flow-ink)/55">No projects yet</p>
        <p className="max-w-[260px] text-[12px] text-(--flow-ink)/40">
          Create your first project to start tracking status and progress here.
        </p>
        <button
          type="button"
          className="bg-gradient-flow mt-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-(--flow-cream) shadow-[0_10px_22px_-12px_rgba(224,90,143,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          <Plus weight="bold" className="size-3.5" />
          New Project
        </button>
      </div>
    </div>
  );
}
