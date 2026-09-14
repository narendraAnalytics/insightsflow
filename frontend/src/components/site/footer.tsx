"use client";

import { motion } from "framer-motion";
import { ArrowRight, DiscordLogo, GithubLogo, LinkedinLogo, XLogo } from "@phosphor-icons/react";
import { LogoVideo } from "@/components/site/logo-video";
import { sectionContainer, sectionItem, sectionViewport } from "@/lib/motion";

const columns = [
  {
    heading: "Product",
    links: ["Overview", "How it works", "Product showcase", "Changelog"],
  },
  {
    heading: "Integrations",
    links: ["Slack", "GitHub", "Google Drive", "Notion", "View all"],
  },
  {
    heading: "Use Cases",
    links: ["Product teams", "Engineering", "Founders", "Operations"],
  },
  {
    heading: "Resources",
    links: ["Guides", "Docs", "Help Center", "Community"],
  },
  {
    heading: "Company",
    links: ["About", "Careers", "Privacy", "Terms"],
  },
];

const socials = [
  { icon: XLogo, label: "X" },
  { icon: GithubLogo, label: "GitHub" },
  { icon: LinkedinLogo, label: "LinkedIn" },
  { icon: DiscordLogo, label: "Discord" },
];

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden pt-20 pb-8">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--flow-peach) 55%, transparent) 0%, color-mix(in oklab, var(--flow-cream) 90%, transparent) 100%)",
        }}
      />

      <motion.div
        variants={sectionContainer}
        initial="hidden"
        whileInView="show"
        viewport={sectionViewport}
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
      >
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <motion.div variants={sectionItem}>
            <a href="#top" className="flex items-center gap-2.5">
              <LogoVideo className="h-9 w-9" />
              <span className="text-[17px] font-semibold tracking-tight text-(--flow-ink)">InsightFlow</span>
            </a>
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-(--flow-ink)/60">
              Turn scattered information into real progress.
            </p>

            <div className="mt-6">
              <p className="text-[12px] font-semibold text-(--flow-ink)/70">Stay in the loop</p>
              <p className="mt-1 text-[12px] text-(--flow-ink)/50">Get product updates, new features and more.</p>
              <form
                onSubmit={(event) => event.preventDefault()}
                className="glass-panel mt-3 flex items-center gap-1.5 rounded-full p-1.5"
              >
                <input
                  type="email"
                  placeholder="Enter your email"
                  aria-label="Email address"
                  className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-[13px] text-(--flow-ink) placeholder:text-(--flow-ink)/40 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Subscribe"
                  className="bg-gradient-flow flex size-8 shrink-0 items-center justify-center rounded-full text-(--flow-cream) transition-transform hover:scale-[1.05] active:scale-[0.98]"
                >
                  <ArrowRight weight="bold" className="size-3.5" />
                </button>
              </form>
            </div>
          </motion.div>

          <motion.div variants={sectionItem} className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.heading}>
                <p className="text-[12.5px] font-semibold text-(--flow-ink)">{column.heading}</p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#top"
                        className="text-[13px] text-(--flow-ink)/60 transition-colors hover:text-(--flow-magenta)"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          variants={sectionItem}
          className="mt-14 flex flex-col items-center gap-4 border-t border-(--flow-ink)/10 pt-6 sm:flex-row sm:justify-between"
        >
          <p className="text-[12px] text-(--flow-ink)/50">© 2026 InsightFlow. All rights reserved.</p>
          <div className="flex items-center gap-3">
            {socials.map((social) => (
              <a
                key={social.label}
                href="#top"
                aria-label={social.label}
                className="glass-panel flex size-8 items-center justify-center rounded-full text-(--flow-ink)/70 transition-colors hover:text-(--flow-magenta)"
              >
                <social.icon weight="fill" className="size-3.5" />
              </a>
            ))}
          </div>
          <p className="text-[12px] font-medium text-(--flow-ink)/50">Built for a more connected tomorrow.</p>
        </motion.div>
      </motion.div>
    </footer>
  );
}
