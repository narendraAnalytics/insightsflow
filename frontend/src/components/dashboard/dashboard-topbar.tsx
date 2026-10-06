"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useUser } from "@clerk/nextjs";
import { CreditsPill } from "@/components/billing/credits-pill";
import { useCredits } from "@/components/billing/credits-provider";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";

export function DashboardTopbar() {
  const { user } = useUser();
  const { credits, openBuy } = useCredits();
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
        <NotificationsBell />

        <button type="button" onClick={openBuy} title="Buy credits" className="rounded-full transition-transform hover:scale-[1.04] active:scale-[0.97]">
          <CreditsPill credits={credits} />
        </button>

        <span className="text-gradient-flow pl-1 font-(family-name:--font-zeyada) text-[30px] leading-none font-normal whitespace-nowrap">
          {displayName}
        </span>
      </div>
    </header>
  );
}
