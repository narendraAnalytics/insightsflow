import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fraunces, Geist, Geist_Mono, JetBrains_Mono, Plus_Jakarta_Sans, Zeyada } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Variable width axis powers the landing page's condensed `.font-display` headlines.
const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

// Landing-only editorial accent (italic, soft/wonky variable axes) — see `.font-editorial`.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});

// Dashboard-only UI font (see `body:has(.dashboard-root)` in globals.css).
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Handwritten wordmark in the dashboard sidebar only (single weight, too thin for body text).
const zeyada = Zeyada({
  variable: "--font-zeyada",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InsightFlow — Ask your sheets. Approve the answer. Alert the team.",
  description:
    "InsightFlow is an AI analyst for your Google Sheets. Every number is computed by code, amounts read in lakh and crore, and nothing reaches your team until you approve it.",
  applicationName: "InsightFlow",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "InsightFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbeee4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        bricolageGrotesque.variable,
        fraunces.variable,
        plusJakarta.variable,
        zeyada.variable,
        "font-sans",
        jetbrainsMono.variable
      )}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
