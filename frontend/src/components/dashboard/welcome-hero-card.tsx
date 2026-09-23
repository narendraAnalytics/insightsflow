"use client";

import { motion } from "framer-motion";
import { ChartLineUp, CloudCheck, UsersThree } from "@phosphor-icons/react";
import { useUser } from "@clerk/nextjs";

export function WelcomeHeroCard() {
  const { user } = useUser();
  const firstName = user?.firstName ?? user?.username ?? "there";

  return (
    <div className="glass-panel relative flex flex-col justify-center overflow-hidden rounded-3xl px-7 py-8 sm:px-9">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(55% 70% at 15% 30%, color-mix(in oklab, var(--flow-peach) 55%, transparent) 0%, transparent 65%), radial-gradient(45% 60% at 85% 70%, color-mix(in oklab, var(--flow-lavender) 42%, transparent) 0%, transparent 65%)",
        }}
      />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <h1 className="text-[1.9rem] leading-tight font-semibold tracking-tight text-(--flow-ink) sm:text-4xl">
            Welcome back, {firstName}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-3 text-[15px] text-(--flow-ink)/70">
            Turn your ideas into impact with AI-powered workflows.
          </p>
          <p className="mt-4 text-[13.5px] font-medium text-(--flow-ink)/55 italic">
            &ldquo;Automate today. Achieve tomorrow.&rdquo;
          </p>
        </div>

        <div className="relative mx-auto flex size-32 shrink-0 items-center justify-center sm:mx-0 sm:size-36">
          <span
            aria-hidden="true"
            className="animate-pulse-glow absolute inset-0 rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle, var(--flow-magenta), transparent 70%)" }}
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 14, ease: "linear", repeat: Infinity }}
            className="relative flex size-20 items-center justify-center rounded-3xl shadow-[0_16px_36px_-14px_rgba(224,90,143,0.55)] sm:size-24"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--flow-magenta), var(--flow-cyan), var(--flow-coral), var(--flow-lavender))",
            }}
          />
          <span className="glass-card absolute -top-1 -right-1 flex size-9 items-center justify-center rounded-full">
            <ChartLineUp weight="fill" className="size-4 text-(--flow-magenta)" />
          </span>
          <span className="glass-card absolute top-1/2 -right-5 flex size-8 items-center justify-center rounded-full">
            <UsersThree weight="fill" className="size-3.5 text-(--flow-coral)" />
          </span>
          <span className="glass-card absolute -bottom-1 -left-1 flex size-9 items-center justify-center rounded-full">
            <CloudCheck weight="fill" className="size-4 text-(--flow-cyan)" />
          </span>
        </div>
      </div>
    </div>
  );
}
