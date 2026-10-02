export type Chapter = {
  /** Short name, used for the rail's aria-labels. */
  name: string;
  /** Headline lines; `sunrise` paints the line with the brand gradient. */
  lines: { text: string; sunrise?: boolean }[];
  body: string;
  chips?: { label: string; state?: "live" | "soon" }[];
  /** Soft colour wash behind the copy, one per chapter. */
  glow: string;
};

export const CHAPTERS: Chapter[] = [
  {
    name: "Overview",
    lines: [{ text: "Ask your sheets." }, { text: "Approve the answer." }, { text: "Alert the team.", sunrise: true }],
    body: "InsightFlow reads your sheets and documents, computes every number with real code, drafts the report, and waits for your yes before anything reaches your team.",
    glow: "var(--flow-magenta)",
  },
  {
    name: "Connect",
    lines: [{ text: "Connect a sheet." }, { text: "Keep control.", sunrise: true }],
    body: "Sign in with Google, pick the spreadsheets you want and add any tab. InsightFlow only sees the files you choose.",
    chips: [
      { label: "Google Sheets", state: "live" },
      { label: "Gmail", state: "live" },
      { label: "Several tabs per question" },
    ],
    glow: "var(--flow-amber)",
  },
  {
    name: "Approve",
    lines: [{ text: "Draft the report." }, { text: "You approve it.", sunrise: true }],
    body: "Turn an answer into an email, a Slack message or a Notion page. You edit the draft, and nothing is sent until you click.",
    chips: [
      { label: "Gmail", state: "live" },
      { label: "Slack", state: "live" },
      { label: "Notion", state: "live" },
    ],
    glow: "var(--flow-coral)",
  },
  {
    name: "Documents",
    lines: [{ text: "Drop in a document." }, { text: "Get rows back.", sunrise: true }],
    body: "Upload an invoice, a bank statement or a contract. InsightFlow reads it into rows you can question like any sheet.",
    chips: [{ label: "PDF, PNG, JPG", state: "live" }, { label: "Invoices" }, { label: "Statements" }],
    glow: "var(--flow-mint)",
  },
  {
    name: "Ask",
    lines: [{ text: "Ask in plain words." }, { text: "Get answers, not guesses.", sunrise: true }],
    body: "Every number is computed by code over your data, never estimated by the model. Key amounts are spelled out in lakh and crore too.",
    chips: [{ label: "Joins across sheets" }, { label: "Lakh and crore in words" }, { label: "Numbers from code" }],
    glow: "var(--flow-pink)",
  },
  {
    name: "Dashboard",
    lines: [{ text: "Everything in" }, { text: "one dashboard.", sunrise: true }],
    body: "Connected sheets, questions asked and recent activity, all in one place. Open it and pick up where you left off.",
    glow: "var(--flow-magenta)",
  },
];
