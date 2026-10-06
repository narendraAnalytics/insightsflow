"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, Database, Plug, ShieldCheck } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const Z = "font-(family-name:--font-zeyada)";

const sections = [
  { label: "Profile & security", href: "/dashboard/settings/account", icon: ShieldCheck, accent: "var(--flow-magenta)" },
  { label: "Credits & billing", href: "/dashboard/settings/billing", icon: Coins, accent: "oklch(0.72 0.17 55)" },
  { label: "Connected apps", href: "/dashboard/settings/apps", icon: Plug, accent: "oklch(0.66 0.12 190)" },
  { label: "Data & privacy", href: "/dashboard/settings/data", icon: Database, accent: "oklch(0.66 0.14 25)" },
];

/** Left sub-nav on desktop, a horizontally scrollable pill row on small screens. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings sections"
      className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-60 lg:flex-col lg:overflow-visible lg:pb-0"
    >
      {sections.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            style={
              active
                ? {
                    backgroundImage: `linear-gradient(120deg, ${s.accent}, color-mix(in oklab, ${s.accent} 55%, var(--flow-pink)))`,
                    boxShadow: `0 10px 24px -12px color-mix(in oklab, ${s.accent} 70%, transparent)`,
                  }
                : ({ "--acc": s.accent } as React.CSSProperties)
            }
            className={cn(
              `group flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2 ${Z} text-[22px] leading-none font-normal whitespace-nowrap transition-all duration-300`,
              active
                ? "text-(--flow-cream)"
                : "bg-(--flow-cream) text-(--flow-ink)/80 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--acc)_22%,transparent)] hover:text-(--flow-ink) hover:bg-[color-mix(in_oklab,var(--acc)_10%,var(--flow-cream))]"
            )}
          >
            <s.icon weight={active ? "fill" : "duotone"} className="size-5" style={{ color: active ? undefined : s.accent }} />
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
