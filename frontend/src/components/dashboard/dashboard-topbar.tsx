"use client";

import { Bell, MagnifyingGlass } from "@phosphor-icons/react";
import { useUser } from "@clerk/nextjs";

export function DashboardTopbar() {
  const { user } = useUser();
  const displayName = user?.fullName ?? user?.username ?? user?.firstName ?? "there";

  return (
    <header className="flex items-center gap-4 border-b border-(--flow-ink)/8 bg-(--flow-cream) px-5 py-3.5 sm:px-8">
      <div className="glass-panel flex max-w-md flex-1 items-center gap-2.5 rounded-full px-4 py-2.5">
        <MagnifyingGlass className="size-4 text-(--flow-ink)/45" />
        <input
          type="text"
          placeholder="Search anything…"
          disabled
          className="w-full bg-transparent text-[14px] text-(--flow-ink)/70 placeholder:text-(--flow-ink)/40 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          title="Notifications — coming soon"
          className="relative flex size-10 items-center justify-center rounded-full text-(--flow-ink)/70 transition-colors hover:bg-(--flow-ink)/6"
        >
          <Bell weight="bold" className="size-[19px]" />
        </button>

        <div className="flex flex-col items-end pl-1 leading-tight">
          <span className="text-[13.5px] font-semibold text-(--flow-ink)">{displayName}</span>
          <span className="text-[11px] font-medium text-(--flow-ink)/50">Free Plan</span>
        </div>
      </div>
    </header>
  );
}
