/** Slack and Notion workspaces can belong to one of the user's Gmail accounts. When the chat
 * works as a Gmail account, only that account's workspaces are offered. If nothing is linked
 * anywhere (workspaces connected before linking existed) everything stays visible. */
export function forGmail<T extends { gmail_connection_id: string | null }>(
  accounts: T[],
  gmailId: string | null | undefined
): T[] {
  if (!accounts.some((a) => a.gmail_connection_id)) return accounts;
  return accounts.filter((a) => gmailId != null && a.gmail_connection_id === gmailId);
}

/** Same idea for Google Sheets logins, but never empty: if the chosen Gmail owns none of them,
 * every login stays available, so the user's existing sheets can't disappear. */
export function forGmailOrAll<T extends { gmail_connection_id: string | null }>(
  accounts: T[],
  gmailId: string | null | undefined
): T[] {
  const mine = forGmail(accounts, gmailId);
  return mine.length > 0 ? mine : accounts;
}
