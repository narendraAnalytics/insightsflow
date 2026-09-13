import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InsightFlow — Connect. Understand. Act.",
    short_name: "InsightFlow",
    description:
      "Connect your tools and let AI analyze, correlate, and act across Slack, GitHub, Google Drive, Notion and more.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbeee4",
    theme_color: "#fbeee4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
