"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  CaretLeft,
  CaretRight,
  ChartBar,
  FileText,
  FolderOpen,
  Gear,
  House,
  Lightning,
  Plug,
  Robot,
  UsersThree,
} from "@phosphor-icons/react";
import { LogoVideo } from "@/components/site/logo-video";
import { cn } from "@/lib/utils";

// Each item owns a bright accent (warm/teal family — no blue/violet). It tints
// the icon tile at rest and becomes the gradient when the item is active.
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: House, accent: "var(--flow-magenta)" },
  { label: "Projects", href: "/dashboard/projects", icon: FolderOpen, accent: "oklch(0.72 0.17 55)" },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug, accent: "oklch(0.66 0.12 190)" },
  { label: "AI Insights", href: "/dashboard/ai-insights", icon: Robot, accent: "oklch(0.66 0.21 10)" },
  { label: "Team", href: null, icon: UsersThree, accent: "oklch(0.64 0.22 330)" },
  { label: "Documents", href: "/dashboard/documents", icon: FileText, accent: "var(--flow-coral)" },
  { label: "Automation", href: "/dashboard/automation", icon: Lightning, accent: "oklch(0.78 0.16 80)" },
  { label: "Analytics", href: null, icon: ChartBar, accent: "oklch(0.68 0.15 160)" },
  { label: "Settings", href: null, icon: Gear, accent: "oklch(0.66 0.14 25)" },
];

/** Colored duotone icon in a soft tinted tile; filled + translucent white when active. */
function IconTile({ item, active, muted = false }: { item: (typeof navItems)[number]; active: boolean; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-300",
        !muted && "group-hover:scale-110 group-hover:-rotate-6",
        muted && "opacity-55"
      )}
      style={{
        backgroundColor: active ? "rgb(255 255 255 / 0.25)" : `color-mix(in oklab, ${item.accent} 16%, transparent)`,
        boxShadow: active ? undefined : `inset 0 0 0 1px color-mix(in oklab, ${item.accent} 28%, transparent)`,
        color: active ? "var(--flow-cream)" : item.accent,
      }}
    >
      <item.icon weight={active ? "fill" : "duotone"} className="size-[18px]" />
    </span>
  );
}

/** Themed tooltip for the icon-only (collapsed) sidebar — replaces the native black/white `title` bubble. */
function NavTooltip({ label, accent, note }: { label: string; accent: string; note?: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-x-1 -translate-y-1/2 rounded-xl px-3 py-1.5 font-(family-name:--font-zeyada) text-[20px] leading-none whitespace-nowrap text-(--flow-cream) opacity-0 shadow-lg transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
      style={{
        backgroundImage: `linear-gradient(120deg, ${accent}, color-mix(in oklab, ${accent} 55%, var(--flow-pink)))`,
        boxShadow: `0 10px 24px -10px color-mix(in oklab, ${accent} 75%, transparent)`,
      }}
    >
      {label}
      {note && <span className="ml-1.5 text-[16px] opacity-80">· {note}</span>}
    </span>
  );
}

const STORAGE_KEY = "insightflow-dashboard-sidebar-collapsed";

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore — private mode / blocked storage
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 240 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-30 hidden shrink-0 flex-col gap-1 border-r border-(--flow-ink)/8 bg-(--flow-cream) px-3 py-5 lg:flex"
    >
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-9 -right-4 z-10 flex size-9 items-center justify-center rounded-full border border-(--flow-ink)/10 bg-(--flow-cream) text-(--flow-ink)/70 shadow-[0_6px_16px_-4px_rgba(224,90,143,0.35)] transition-colors hover:text-(--flow-ink)"
      >
        {collapsed ? (
          <CaretRight weight="bold" className="size-4" />
        ) : (
          <CaretLeft weight="bold" className="size-4" />
        )}
      </button>

      <a
        href="/"
        title="Back to InsightFlow home"
        className={cn("flex items-center gap-2.5 px-2 pb-6", collapsed && "justify-center px-0")}
      >
        <LogoVideo className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <span className="font-(family-name:--font-zeyada) text-[30px] leading-none whitespace-nowrap text-(--flow-ink)">
            InsightFlow
          </span>
        )}
      </a>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) =>
          item.href ? (
            <a
              key={item.label}
              href={item.href}
              aria-label={item.label}
              style={
                pathname === item.href
                  ? {
                      backgroundImage: `linear-gradient(120deg, ${item.accent}, color-mix(in oklab, ${item.accent} 55%, var(--flow-pink)))`,
                      boxShadow: `0 10px 24px -12px color-mix(in oklab, ${item.accent} 70%, transparent)`,
                    }
                  : ({ "--acc": item.accent } as React.CSSProperties)
              }
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl px-2 py-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal whitespace-nowrap transition-all duration-300",
                collapsed && "justify-center px-0",
                pathname === item.href
                  ? "text-(--flow-cream)"
                  : "text-(--flow-ink)/80 hover:translate-x-0.5 hover:text-(--flow-ink) hover:bg-[linear-gradient(90deg,color-mix(in_oklab,var(--acc)_18%,transparent),color-mix(in_oklab,var(--acc)_3%,transparent))] hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--acc)_22%,transparent)]"
              )}
            >
              <IconTile item={item} active={pathname === item.href} />
              {!collapsed && item.label}
              {collapsed && <NavTooltip label={item.label} accent={item.accent} />}
            </a>
          ) : (
            <span
              key={item.label}
              aria-disabled="true"
              aria-label={`${item.label} — coming soon`}
              style={{ "--acc": item.accent } as React.CSSProperties}
              className={cn(
                "group relative flex items-center justify-between gap-3 rounded-2xl px-2 py-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none font-normal whitespace-nowrap text-(--flow-ink)/45 transition-colors hover:bg-[color-mix(in_oklab,var(--acc)_7%,transparent)]",
                collapsed && "justify-center px-0"
              )}
            >
              <span className="flex items-center gap-3">
                <IconTile item={item} active={false} muted />
                {!collapsed && item.label}
              </span>
              {!collapsed && (
                <span className="rounded-full bg-(--acc)/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-(--acc) uppercase opacity-0 transition-opacity group-hover:opacity-100">
                  Soon
                </span>
              )}
              {collapsed && <NavTooltip label={item.label} accent={item.accent} note="soon" />}
            </span>
          )
        )}
      </nav>
    </motion.aside>
  );
}
