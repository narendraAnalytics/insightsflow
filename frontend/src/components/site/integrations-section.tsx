"use client";

import type { ComponentType, SVGProps } from "react";
import { motion } from "framer-motion";
import { CreditCard, LockKey } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT, sectionContainer, sectionItem, sectionViewport } from "@/lib/motion";
import { GmailGlyph, GoogleSheetsGlyph, NotionGlyph, SlackGlyph } from "@/components/site/brand-icons";
import { IntegrationsFlow } from "@/components/site/integrations-flow";
import { RevealHeading } from "@/components/site/primitives";

const legend: { icon: ComponentType<SVGProps<SVGSVGElement>>; name: string; role: string; live: boolean }[] = [
  { icon: GoogleSheetsGlyph, name: "Google Sheets", role: "Reads the spreadsheets and tabs you pick", live: true },
  { icon: GmailGlyph, name: "Gmail", role: "Reads recent mail and sends the emails you approve", live: true },
  { icon: NotionGlyph, name: "Notion", role: "Keeps every approved report in one place", live: true },
  { icon: SlackGlyph, name: "Slack", role: "Posts approved summaries to the right channel", live: true },
  { icon: (props) => <LockKey weight="duotone" className="text-(--flow-magenta)" {...props} />, name: "Clerk", role: "Keeps sign-in and accounts secure", live: true },
  { icon: (props) => <CreditCard weight="duotone" className="text-(--flow-coral)" {...props} />, name: "Razorpay", role: "Handles secure credit top-ups", live: true },
];

export function IntegrationsSection() {
  return (
    <section id="integrations" className="relative isolate overflow-hidden py-[clamp(5rem,10vw,9rem)]">
      <div aria-hidden="true" className="animate-aurora-a absolute top-1/4 right-[-12rem] -z-10 size-[36rem] rounded-full bg-(--flow-mint)/30 blur-[120px]" />
      <div aria-hidden="true" className="animate-aurora-b absolute bottom-0 left-[-10rem] -z-10 size-[30rem] rounded-full bg-(--flow-pink)/45 blur-[110px]" />

      <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:px-8">
        <div>
          <RevealHeading
            className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] text-(--flow-ink)"
            lines={[{ text: "Your data comes in." }, { text: "Your team hears about it.", className: "text-sunrise" }]}
          />
          <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-(--text-secondary)">
            InsightFlow sits between the sheets, mail and documents you already keep and the places your team already reads.
          </p>

          <motion.ul
            variants={sectionContainer}
            initial="hidden"
            whileInView="show"
            viewport={sectionViewport}
            className="mt-10 flex flex-col gap-3"
          >
            {legend.map((row) => (
              <motion.li
                key={row.name}
                variants={sectionItem}
                className="lux-card flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-transform duration-300 hover:translate-x-1"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-(--flow-cream)">
                  <row.icon className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-(--flow-ink)">{row.name}</span>
                  <span className="block text-[14px] text-(--text-muted)">{row.role}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold",
                    row.live ? "bg-(--flow-mint) text-(--flow-ink)" : "bg-(--flow-ink)/[0.06] text-(--text-muted)"
                  )}
                >
                  {row.live ? "Live" : "Coming soon"}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.1, ease: EASE_OUT }}
        >
          <IntegrationsFlow />
        </motion.div>
      </div>
    </section>
  );
}
