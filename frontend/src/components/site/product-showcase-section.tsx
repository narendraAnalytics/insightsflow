"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ActivityIcon as Activity,
  Bell,
  ChartLineUp,
  Gauge,
  Gear,
  House,
  MagnifyingGlass,
  Play,
  Plugs,
  Sparkle,
  TrendUp,
} from "@phosphor-icons/react";
import { GitHubGlyph, GoogleDriveGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { sectionContainer, sectionItem, sectionViewport, useParallaxY } from "@/lib/motion";

const navItems = [
  { icon: House, label: "Home", active: true },
  { icon: Sparkle, label: "Insights" },
  { icon: Plugs, label: "Integrations" },
  { icon: Activity, label: "Activity" },
  { icon: Gear, label: "Settings" },
];

const stats = [
  { icon: ChartLineUp, label: "New insights", value: "12", delta: "+20%" },
  { icon: Gauge, label: "Action items", value: "5", delta: "+2" },
  { icon: Plugs, label: "Connected apps", value: "8", delta: "All active" },
];

const insights = [
  { title: "Project X might be delayed", detail: "Detected from GitHub issues and Slack discussions", time: "2m ago" },
  { title: "New opportunity in customer feedback", detail: "Detected from Drive documents", time: "12m ago" },
];

const activity = [
  { icon: SlackGlyph, label: "Slack", detail: "12 new messages" },
  { icon: GitHubGlyph, label: "GitHub", detail: "3 new commits" },
  { icon: GoogleDriveGlyph, label: "Google Drive", detail: "2 documents updated" },
];

export function ProductShowcaseSection() {
  const { ref, y } = useParallaxY([-25, 25]);
  const mockupRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: mockupProgress } = useScroll({
    target: mockupRef,
    offset: ["start end", "start 0.4"],
  });
  const mockupScale = useTransform(mockupProgress, [0, 1], [0.92, 1]);
  const mockupY = useTransform(mockupProgress, [0, 1], [40, 0]);
  const mockupOpacity = useTransform(mockupProgress, [0, 1], [0, 1]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden py-20 sm:py-28">
      <motion.div
        aria-hidden="true"
        style={{
          y,
          background:
            "radial-gradient(55% 45% at 20% 20%, color-mix(in oklab, var(--flow-pink) 30%, transparent) 0%, transparent 65%), radial-gradient(45% 40% at 90% 80%, color-mix(in oklab, var(--flow-lavender) 30%, transparent) 0%, transparent 65%)",
        }}
        className="absolute inset-0 -z-10"
      />

      <motion.div
        variants={sectionContainer}
        initial="hidden"
        whileInView="show"
        viewport={sectionViewport}
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center">
          <motion.span
            variants={sectionItem}
            className="glass-panel inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-(--flow-magenta) uppercase"
          >
            See it in action
          </motion.span>
          <motion.h2
            variants={sectionItem}
            className="mt-4 text-3xl font-semibold tracking-tight text-(--flow-ink) sm:text-4xl"
          >
            A clearer picture of <span className="text-gradient-flow">your work.</span>
          </motion.h2>
          <motion.p variants={sectionItem} className="mx-auto mt-3 max-w-md text-[15px] text-(--flow-ink)/65">
            Beautiful insights, real-time updates, and a workspace that keeps you ahead.
          </motion.p>
          <motion.a
            variants={sectionItem}
            href="#top"
            className="glass-panel mt-6 inline-flex items-center gap-2.5 rounded-full px-5 py-3 text-[14px] font-semibold text-(--flow-ink) transition-transform hover:scale-[1.02]"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-(--flow-ink)/8">
              <Play weight="fill" className="size-3 text-(--flow-magenta)" />
            </span>
            Watch Demo (2 min)
          </motion.a>
        </div>

        <motion.div
          ref={mockupRef}
          style={{ scale: mockupScale, y: mockupY, opacity: mockupOpacity }}
          className="glass-card relative mx-auto mt-14 max-w-5xl overflow-hidden rounded-[2rem] p-2 sm:p-3"
        >
          <div className="flex flex-col overflow-hidden rounded-[1.5rem] bg-(--flow-cream)/70 sm:flex-row">
            <aside className="hidden w-48 shrink-0 flex-col gap-1 border-r border-(--flow-ink)/8 p-4 sm:flex">
              <div className="mb-4 flex items-center gap-2 px-2">
                <span className="bg-gradient-flow flex size-7 items-center justify-center rounded-lg text-[11px] font-bold text-(--flow-cream)">
                  IF
                </span>
                <span className="text-[13px] font-semibold text-(--flow-ink)">InsightFlow</span>
              </div>
              {navItems.map((navItem) => (
                <span
                  key={navItem.label}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium ${
                    navItem.active
                      ? "bg-gradient-flow text-(--flow-cream) shadow-[0_8px_18px_-8px_rgba(224,90,143,0.55)]"
                      : "text-(--flow-ink)/65"
                  }`}
                >
                  <navItem.icon weight={navItem.active ? "fill" : "regular"} className="size-4" />
                  {navItem.label}
                </span>
              ))}
            </aside>

            <div className="flex-1 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[17px] font-semibold text-(--flow-ink)">Good morning!</p>
                  <p className="text-[12.5px] text-(--flow-ink)/55">Here&apos;s what&apos;s happening across your workspace.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="glass-panel flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-(--flow-ink)/60">
                    <MagnifyingGlass className="size-3.5" />
                    Search anything…
                  </span>
                  <span className="glass-panel flex size-8 items-center justify-center rounded-full">
                    <Bell weight="fill" className="size-3.5 text-(--flow-coral)" />
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="glass-panel rounded-2xl p-3.5">
                    <stat.icon weight="fill" className="size-4 text-(--flow-magenta)" />
                    <p className="mt-2 text-[19px] font-bold text-(--flow-ink)">{stat.value}</p>
                    <p className="text-[11px] font-medium text-(--flow-ink)/55">{stat.label}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-(--flow-cyan)">
                      <TrendUp weight="bold" className="size-3" />
                      {stat.delta}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="glass-panel rounded-2xl p-4">
                  <p className="text-[12px] font-semibold text-(--flow-ink)/70">Recent insights</p>
                  <div className="mt-2.5 flex flex-col gap-2.5">
                    {insights.map((insight) => (
                      <div key={insight.title} className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[12.5px] font-semibold text-(--flow-ink)">{insight.title}</p>
                          <p className="text-[11px] text-(--flow-ink)/50">{insight.detail}</p>
                        </div>
                        <span className="shrink-0 text-[10.5px] text-(--flow-ink)/40">{insight.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-panel rounded-2xl p-4">
                  <p className="text-[12px] font-semibold text-(--flow-ink)/70">App activity</p>
                  <div className="mt-2.5 flex flex-col gap-2.5">
                    {activity.map((app) => (
                      <div key={app.label} className="flex items-center gap-2.5">
                        <app.icon className="size-5 shrink-0" />
                        <div>
                          <p className="text-[12.5px] font-semibold text-(--flow-ink)">{app.label}</p>
                          <p className="text-[11px] text-(--flow-ink)/50">{app.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
