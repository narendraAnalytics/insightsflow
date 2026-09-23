"use client";

import { useEffect, useState } from "react";
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
  { label: "Dashboard", href: "/dashboard", icon: House, active: true },
  { label: "Projects", icon: FolderOpen, active: false },
  { label: "Integrations", icon: Plug, active: false },
  { label: "AI Insights", icon: Robot, active: false },
  { label: "Team", icon: UsersThree, active: false },
  { label: "Documents", icon: FileText, active: false },
  { label: "Automation", icon: Lightning, active: false },
  { label: "Analytics", icon: ChartBar, active: false },
  { label: "Settings", icon: Gear, active: false },
];

const STORAGE_KEY = "insightflow-dashboard-sidebar-collapsed";

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);

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
          item.active ? (
            <a
              key={item.label}
              href={item.href}
              title={item.label}
              className={cn(
                "bg-gradient-flow flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold whitespace-nowrap text-(--flow-cream) shadow-[0_10px_24px_-14px_rgba(224,90,143,0.6)]",
                collapsed && "justify-center px-0"
              )}
            >
              <item.icon weight="fill" className="size-[18px] shrink-0" />
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
