"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Plug, Robot, Sparkle, UploadSimple } from "@phosphor-icons/react";

const actions = [
  { label: "New Project", icon: Plus, accent: "var(--flow-coral)" },
  { label: "Connect App", icon: Plug, accent: "var(--flow-lavender)" },
  { label: "Upload Document", icon: UploadSimple, accent: "var(--flow-cyan)" },
  { label: "Ask AI", icon: Robot, accent: "var(--flow-magenta)" },
];

export function QuickActions() {
  const [toast, setToast] = useState<string | null>(null);

  const handleClick = (label: string) => {
    setToast(`${label} — coming soon`);
    window.setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="glass-card relative flex flex-col rounded-2xl p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-heading text-[15px] font-semibold text-(--flow-ink)">
        <Sparkle weight="fill" className="size-4 text-(--flow-magenta)" />
        Quick Actions
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => handleClick(action.label)}
            className="flex flex-col items-center gap-2 rounded-2xl py-4 text-center transition-transform hover:scale-[1.03] active:scale-[0.98]"
            style={{ backgroundColor: `color-mix(in oklab, ${action.accent} 14%, transparent)` }}
          >
            <span
              className="flex size-9 items-center justify-center rounded-full"
              style={{ backgroundColor: `color-mix(in oklab, ${action.accent} 30%, transparent)` }}
            >
              <action.icon weight="bold" className="size-4" style={{ color: action.accent }} />
            </span>
            <span className="text-[12.5px] font-semibold text-(--flow-ink)/80">{action.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="glass-panel absolute inset-x-5 bottom-3 rounded-full px-4 py-2 text-center text-[12.5px] font-medium text-(--flow-ink)"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
