const REASONS: Record<string, string> = {
  topup: "Credits bought",
  connect_google_sheets: "Added a sheet tab",
  connect_gmail: "Connected Gmail",
  connect_slack: "Connected Slack",
  connect_notion: "Connected Notion",
  automation_run: "Automation run",
};

/** A ledger `reason` as a sentence a person would write. */
export function reasonLabel(reason: string): string {
  if (REASONS[reason]) return REASONS[reason];
  if (reason.includes("question") || reason.includes("insight") || reason.includes("ask")) return "AI question";
  const text = reason.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
