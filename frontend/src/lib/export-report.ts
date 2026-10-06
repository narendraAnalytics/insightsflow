import { reasonLabel } from "@/lib/credit-reasons";

/** Shape of `GET /api/v1/account/export` (see backend account_service.export_data). */
export type ExportData = {
  exported_at: string;
  note: string;
  profile: { email: string | null; name: string | null; username: string | null; created_at: string | null };
  connections: {
    provider: string;
    account: string | null;
    status: string;
    settings: Record<string, unknown> | null;
    connected_at: string | null;
  }[];
  data_sources: { name: string; tab: string; row_count: number; added_at: string | null }[];
  documents: { filename: string; template: string; status: string; pages: number; row_count: number; uploaded_at: string | null }[];
  chats: { title: string; created_at: string | null; messages: { role: string; content: string; at: string | null }[] }[];
  automations: {
    name: string;
    question: string;
    frequency: string;
    delivery: { email?: string | null; slack?: boolean; notion?: boolean } | null;
    enabled: boolean;
  }[];
  automation_runs: { status: string; trigger: string; summary: string | null; started_at: string | null }[];
  scheduled_emails: { to: string; subject: string; status: string; send_at: string | null }[];
  credit_history: { change: number; reason: string; at: string | null }[];
};

const PROVIDERS: Record<string, string> = {
  google_sheets: "Google Sheets",
  gmail: "Gmail",
  slack: "Slack",
  notion: "Notion",
};

/** Everything that reaches the HTML goes through this: chat text is user and model content. */
const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const when = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
    : "";

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "");

function table(headers: string[], rows: (string | number)[][], empty: string): string {
  if (rows.length === 0) return `<p class="empty">${esc(empty)}</p>`;
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

const section = (title: string, body: string): string => `<section><h2>${esc(title)}</h2>${body}</section>`;

function deliverySummary(d: ExportData["automations"][number]["delivery"]): string {
  const parts = [d?.email ? `Email ${d.email}` : "", d?.slack ? "Slack" : "", d?.notion ? "Notion" : ""].filter(Boolean);
  return parts.length ? `In-app, ${parts.join(", ")}` : "In-app only";
}

const CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #4a2a2a; font: 11pt/1.5 "Segoe UI", "Noto Sans", "Nirmala UI", "Noto Sans Devanagari", system-ui, sans-serif; }
  .cover { padding: 22px 24px; border-radius: 16px; color: #fff; background: linear-gradient(120deg, #d6409f, #ff7a59 70%, #ffb24d); }
  .cover h1 { margin: 0 0 4px; font-size: 24pt; line-height: 1.1; }
  .cover p { margin: 2px 0; font-size: 11pt; opacity: .95; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
  .stat { flex: 1 1 90px; padding: 8px 12px; border-radius: 12px; background: #fdeef3; }
  .stat b { display: block; font-size: 16pt; color: #d6409f; line-height: 1.1; }
  .stat span { font-size: 9pt; color: #7a4a4a; }
  .note { margin: 12px 0 0; padding: 8px 12px; border-left: 3px solid #ffb24d; background: #fff6e6; font-size: 9.5pt; }
  h2 { margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #f3c9d9; color: #d6409f; font-size: 14pt; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; padding: 6px 8px; background: #fdeef3; color: #7a2a52; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3dde6; vertical-align: top; word-break: break-word; }
  tr { break-inside: avoid; }
  .empty { margin: 0; color: #9a7a7a; font-style: italic; }
  .chat { margin: 0 0 14px; }
  .chat h3 { margin: 0 0 2px; font-size: 11.5pt; break-after: avoid; }
  .chat .meta { margin: 0 0 6px; color: #9a7a7a; font-size: 9pt; }
  .msg { margin: 0 0 6px; padding: 7px 10px; border-radius: 10px; break-inside: avoid; white-space: pre-wrap; word-break: break-word; font-size: 10pt; }
  .msg .who { display: block; margin-bottom: 2px; font-size: 8.5pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .user { background: #fff0e0; } .user .who { color: #d9742b; }
  .assistant { background: #f4ecf9; } .assistant .who { color: #8b3fa3; }
  footer { margin-top: 24px; color: #9a7a7a; font-size: 8.5pt; text-align: center; }
`;

/** A complete, self-contained HTML document: the printable "my data" report. */
export function buildReportHtml(d: ExportData): string {
  const name = d.profile.name || d.profile.username || "Your";
  const stat = (n: number, label: string) => `<div class="stat"><b>${n}</b><span>${esc(label)}</span></div>`;
  const messageCount = d.chats.reduce((n, c) => n + c.messages.length, 0);

  const chats = d.chats.length
    ? d.chats
        .map(
          (c) => `<div class="chat"><h3>${esc(c.title)}</h3><p class="meta">${esc(when(c.created_at))}</p>${c.messages
            .map(
              (m) =>
                `<div class="msg ${m.role === "user" ? "user" : "assistant"}"><span class="who">${
                  m.role === "user" ? "You" : "InsightFlow"
                }${m.at ? ` · ${esc(when(m.at))}` : ""}</span>${esc(m.content)}</div>`
            )
            .join("")}</div>`
        )
        .join("")
    : `<p class="empty">No chats.</p>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>InsightFlow data - ${esc(name)}</title><style>${CSS}</style></head><body>
<div class="cover"><h1>${esc(name === "Your" ? "Your InsightFlow data" : `${name}'s InsightFlow data`)}</h1>
<p>${esc(d.profile.email ?? "")}</p><p>Exported ${esc(when(d.exported_at))} IST${
    d.profile.created_at ? ` · Member since ${esc(when(d.profile.created_at))}` : ""
  }</p></div>
<div class="stats">${stat(d.connections.length, "Connected accounts")}${stat(d.data_sources.length, "Sheet tabs")}${stat(
    d.documents.length,
    "Documents"
  )}${stat(d.chats.length, "Chats")}${stat(messageCount, "Messages")}${stat(d.automations.length, "Automations")}</div>
<p class="note">${esc(d.note)}</p>
${section(
  "Connected accounts",
  table(
    ["App", "Account", "Status", "Connected"],
    d.connections.map((c) => [PROVIDERS[c.provider] ?? cap(c.provider), c.account ?? "", cap(c.status), when(c.connected_at)]),
    "No connected accounts."
  )
)}
${section(
  "Sheets",
  table(
    ["Sheet", "Tab", "Rows", "Added"],
    d.data_sources.map((s) => [s.name, s.tab, s.row_count, when(s.added_at)]),
    "No sheets connected."
  )
)}
${section(
  "Documents",
  table(
    ["File", "Type", "Pages", "Rows", "Uploaded"],
    d.documents.map((x) => [x.filename, cap(x.template), x.pages, x.row_count, when(x.uploaded_at)]),
    "No documents uploaded."
  )
)}
${section("Chats", chats)}
${section(
  "Automations",
  table(
    ["Name", "Question", "Repeats", "Delivery", "Status"],
    d.automations.map((a) => [a.name, a.question, cap(a.frequency), deliverySummary(a.delivery), a.enabled ? "On" : "Paused"]),
    "No automations."
  )
)}
${section(
  "Automation runs",
  table(
    ["Started", "Result", "How", "Summary"],
    d.automation_runs.map((r) => [when(r.started_at), cap(r.status), cap(r.trigger), r.summary ?? ""]),
    "No automation runs."
  )
)}
${section(
  "Scheduled emails",
  table(
    ["To", "Subject", "Status", "Send at"],
    d.scheduled_emails.map((e) => [e.to, e.subject, cap(e.status), when(e.send_at)]),
    "No scheduled emails."
  )
)}
${section(
  "Credit history",
  table(
    ["When", "What", "Credits"],
    d.credit_history.map((e) => [when(e.at), reasonLabel(e.reason), `${e.change > 0 ? "+" : ""}${e.change}`]),
    "No credit activity."
  )
)}
<footer>Generated by InsightFlow</footer></body></html>`;
}

/**
 * Prints the report from a hidden iframe so the browser's own text engine draws it (every
 * script and font works, text stays selectable) and "Save as PDF" is one click away. The page
 * title is swapped for the duration because Chrome names the PDF after it.
 */
export function printReport(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    const previousTitle = document.title;
    let done = false;

    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      document.title = previousTitle;
      setTimeout(() => frame.remove(), 500);
      if (err) reject(err);
      else resolve();
    };

    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return finish(new Error("Couldn't open the print view."));
      try {
        document.title = frame.contentDocument?.title || previousTitle;
        win.addEventListener("afterprint", () => finish());
        win.focus();
        win.print();
        // Some browsers never fire afterprint; don't leave the button spinning.
        setTimeout(() => finish(), 4000);
      } catch {
        finish(new Error("Couldn't open the print view. Try the raw data download instead."));
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
