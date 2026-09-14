// Brand-matched Clerk theme — this project's palette forbids black/white/navy
// neutrals (see frontend/CLAUDE.md), so the default shadcn/Clerk theme isn't
// used; colors are pinned directly to the --flow-* custom properties instead.
export const clerkAppearance = {
  variables: {
    colorPrimary: "oklch(0.62 0.21 340)", // --flow-magenta
    colorBackground: "oklch(0.97 0.02 75)", // --flow-cream
    colorText: "oklch(0.32 0.09 27)", // --flow-ink
    colorTextSecondary: "color-mix(in oklab, oklch(0.32 0.09 27) 65%, transparent)",
    colorInputBackground: "oklch(0.97 0.02 75)",
    colorInputText: "oklch(0.32 0.09 27)",
    borderRadius: "1rem",
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    card: "shadow-[0_20px_40px_-20px_rgba(224,90,143,0.25)] border border-(--flow-cream)",
    formButtonPrimary:
      "bg-gradient-flow normal-case shadow-[0_8px_20px_-6px_rgba(224,90,143,0.55)] hover:opacity-95",
    footerActionLink: "text-(--flow-magenta) hover:text-(--flow-coral)",
    socialButtonsIconButton: "border-(--flow-ink)/15",
  },
};
