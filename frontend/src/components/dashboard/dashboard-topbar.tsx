"use client";

import { useUser } from "@clerk/nextjs";
import { CreditsPill, LOW_CREDITS } from "@/components/billing/credits-pill";
import { useCredits } from "@/components/billing/credits-provider";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";

export function DashboardTopbar() {
  const { user } = useUser();
  const { credits, openBuy } = useCredits();
  const displayName = user?.fullName ?? user?.username ?? user?.firstName ?? "there";

  return (
    <header className="flex items-center gap-4 border-b border-(--flow-ink)/8 bg-(--flow-cream) px-5 py-3.5 sm:px-8">
      <CommandPalette />

      <div className="ml-auto flex items-center gap-3">
        <NotificationsBell />

        <button type="button" onClick={openBuy} title={credits !== null && credits < LOW_CREDITS ? "Low on credits — buy more" : "Buy credits"} className="rounded-full transition-transform hover:scale-[1.04] active:scale-[0.97]">
          <CreditsPill credits={credits} title={null} />
        </button>

        <span className="text-gradient-flow pl-1 font-(family-name:--font-zeyada) text-[30px] leading-none font-normal whitespace-nowrap">
          {displayName}
        </span>
      </div>
    </header>
  );
}
