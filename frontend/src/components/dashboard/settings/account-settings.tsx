"use client";

import { UserProfile } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

// Clerk renders profile, email, password, 2FA and active sessions, so none of that is rebuilt
// here. Path routing needs the [[...rest]] catch-all this component is mounted under.
const appearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    rootBox: "w-full",
    cardBox: "w-full max-w-none shadow-[0_24px_40px_-28px_rgba(224,90,143,0.45)] rounded-[26px]",
    card: "shadow-none",
  },
};

export function AccountSettings() {
  return <UserProfile routing="path" path="/dashboard/settings/account" appearance={appearance} />;
}
