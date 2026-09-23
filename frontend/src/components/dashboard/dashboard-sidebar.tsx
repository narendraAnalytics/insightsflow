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

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: House },
  { label: "Projects", href: null, icon: FolderOpen },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { label: "AI Insights", href: null, icon: Robot },
  { label: "Team", href: null, icon: UsersThree },
  { label: "Documents", href: null, icon: FileText },
  { label: "Automation", href: null, icon: Lightning },
  { label: "Analytics", href: null, icon: ChartBar },
  { label: "Settings", href: null, icon: Gear },
];

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
      className="relative hidden shrink-0 flex-col gap-1 border-r border-(--flow-ink)/8 bg-(--flow-cream) px-3 py-5 lg:flex"
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
          <span className="text-[16px] font-semibold tracking-tight whitespace-nowrap text-(--flow-ink)">
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
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold whitespace-nowrap transition-colors",
                collapsed && "justify-center px-0",
                pathname === item.href
                  ? "bg-gradient-flow text-(--flow-cream) shadow-[0_10px_24px_-14px_rgba(224,90,143,0.6)]"
                  : "text-(--flow-ink)/70 hover:bg-(--flow-ink)/6"
              )}
            >
              <item.icon weight={pathname === item.href ? "fill" : "regular"} className="size-[18px] shrink-0" />
              {!collapsed && item.label}
            </a>
          ) : (
            <span
              key={item.label}
              aria-disabled="true"
              title={`${item.label} — coming soon`}
              className={cn(
                "group flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-medium whitespace-nowrap text-(--flow-ink)/45",
                collapsed && "justify-center px-0"
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="size-[18px] shrink-0" />
                {!collapsed && item.label}
              </span>
              {!collapsed && (
                <span className="rounded-full bg-(--flow-ink)/6 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-(--flow-ink)/40 uppercase opacity-0 transition-opacity group-hover:opacity-100">
                  Soon
                </span>
              )}
            </span>
          )
        )}
      </nav>
    </motion.aside>
  );
}
