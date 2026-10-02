import type { ComponentType, SVGProps } from "react";
import type { Icon } from "@phosphor-icons/react";
import { Brain, ChartBar, CreditCard, Database, Graph, LockKey } from "@phosphor-icons/react/dist/ssr";
import { GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";

type Item =
  | { label: string; brand: ComponentType<SVGProps<SVGSVGElement>>; note?: string }
  | { label: string; icon: Icon; color: string; note?: string };

/** What InsightFlow is actually built on and connects to — no customer logos we don't have. */
const stack: Item[] = [
  { brand: GoogleSheetsGlyph, label: "Google Sheets", note: "live" },
  { icon: Brain, label: "Sarvam-105B", color: "var(--flow-magenta)" },
  { icon: Graph, label: "LangGraph", color: "var(--flow-coral)" },
  { icon: ChartBar, label: "pandas", color: "var(--flow-amber)" },
  { icon: Database, label: "Neon Postgres", color: "var(--flow-mint)" },
  { icon: LockKey, label: "Clerk", color: "var(--flow-magenta)" },
  { icon: CreditCard, label: "Razorpay", color: "var(--flow-coral)" },
  { brand: NotionGlyph, label: "Notion", note: "live" },
  { brand: SlackGlyph, label: "Slack", note: "live" },
];

export function StackStrip() {
  return (
    <section aria-label="Built on" className="relative border-y border-(--border-subtle) bg-(--flow-shell)/60 py-6">
      <div className="group overflow-hidden mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="animate-marquee flex w-max group-hover:paused" style={{ animationDuration: "42s" }}>
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-12 pr-12">
              {stack.map((item) => (
                <li key={item.label} className="flex shrink-0 items-center gap-2.5">
                  {"brand" in item ? (
                    <item.brand className="size-6" />
                  ) : (
                    <item.icon className="size-6" weight="duotone" style={{ color: item.color }} />
                  )}
                  <span className="font-display text-[22px] leading-none text-(--flow-ink)/80">{item.label}</span>
                  {item.note && (
                    <span className="rounded-full bg-(--flow-ink)/[0.06] px-2 py-0.5 text-[11px] font-semibold text-(--text-muted)">
                      {item.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
