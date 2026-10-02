import { Coins } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** Small "🪙 120 credits" badge. `credits` null = still loading (shows a dash). */
export function CreditsPill({ credits, className }: { credits: number | null; className?: string }) {
  return (
    <span
      title="Your credits"
      aria-label={credits === null ? "Credits loading" : `${credits} credits`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-(--flow-cream) bg-linear-to-br from-(--flow-peach) to-(--flow-pink) px-3 py-1.5 text-[13px] leading-none font-semibold whitespace-nowrap text-(--flow-ink) shadow-[0_8px_16px_-10px_var(--flow-magenta)]",
        className
      )}
    >
      <Coins weight="fill" className="size-4 text-(--flow-magenta)" />
      <span className="tabular-nums">{credits === null ? "–" : credits.toLocaleString("en-IN")}</span>
      <span className="font-medium text-(--flow-ink)/70">credits</span>
    </span>
  );
}
