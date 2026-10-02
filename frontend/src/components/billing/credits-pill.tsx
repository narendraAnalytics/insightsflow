import { Coins } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** Below this the user can't add a new connection (it costs 50), so the pill warns. */
export const LOW_CREDITS = 50;

/** Small "N credits" badge. `credits` null = still loading (shows a dash). Turns amber
 * when low, so the user sees it before a blocked action. */
export function CreditsPill({ credits, className }: { credits: number | null; className?: string }) {
  const low = credits !== null && credits < LOW_CREDITS;
  return (
    <span
      title={low ? "Low on credits — buy more" : "Your credits"}
      aria-label={
        credits === null ? "Credits loading" : low ? `${credits} credits, low` : `${credits} credits`
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] leading-none font-semibold whitespace-nowrap text-(--flow-ink)",
        low
          ? "border-(--flow-amber) bg-linear-to-br from-(--flow-amber)/70 to-(--flow-peach) shadow-[0_8px_16px_-10px_var(--flow-coral)]"
          : "border-(--flow-cream) bg-linear-to-br from-(--flow-peach) to-(--flow-pink) shadow-[0_8px_16px_-10px_var(--flow-magenta)]",
        className
      )}
    >
      <Coins weight="fill" className={cn("size-4", low ? "text-(--flow-coral)" : "text-(--flow-magenta)")} />
      <span className="tabular-nums">{credits === null ? "–" : credits.toLocaleString("en-IN")}</span>
      <span className="font-medium text-(--flow-ink)/70">{low ? "credits · low" : "credits"}</span>
    </span>
  );
}
