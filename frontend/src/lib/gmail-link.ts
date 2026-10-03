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
