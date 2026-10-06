"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ArrowBendDownLeft,
  ChartBar,
  Coins,
  Database,
  FileText,
  FolderOpen,
  Gear,
  House,
  Lightning,
  MagnifyingGlass,
  Plug,
  Robot,
  ShieldCheck,
  UploadSimple,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useCredits } from "@/components/billing/credits-provider";
import { cn } from "@/lib/utils";

const Z = "font-(family-name:--font-zeyada)";
const RECENTS_KEY = "insightflow:palette-recents";
const MAX_RECENTS = 4;

type Group = "Go to" | "Actions";
type Entry = {
  id: string;
  label: string;
  hint: string;
  group: Group;
  icon: Icon;
  accent: string;
  keywords: string;
  href?: string;
  run?: "buy";
};

const ENTRIES: Entry[] = [
  { id: "dashboard", label: "Dashboard", hint: "Overview and KPIs", group: "Go to", icon: House, accent: "var(--flow-magenta)", keywords: "home overview kpi", href: "/dashboard" },
  { id: "projects", label: "Projects", hint: "Your sheets and connected apps", group: "Go to", icon: FolderOpen, accent: "oklch(0.72 0.17 55)", keywords: "sheets spreadsheets apps", href: "/dashboard/projects" },
  { id: "integrations", label: "Integrations", hint: "Sheets, Gmail, Slack, Notion", group: "Go to", icon: Plug, accent: "oklch(0.66 0.12 190)", keywords: "connect google sheets gmail slack notion accounts", href: "/dashboard/integrations" },
  { id: "ai-insights", label: "AI Insights", hint: "Ask questions about your data", group: "Go to", icon: Robot, accent: "oklch(0.66 0.21 10)", keywords: "ask chat questions agent", href: "/dashboard/ai-insights" },
  { id: "documents", label: "Documents", hint: "Invoices, statements, contracts", group: "Go to", icon: FileText, accent: "var(--flow-coral)", keywords: "pdf invoice receipt statement upload", href: "/dashboard/documents" },
  { id: "automation", label: "Automation", hint: "Scheduled reports awaiting approval", group: "Go to", icon: Lightning, accent: "oklch(0.78 0.16 80)", keywords: "schedule reports approval runs", href: "/dashboard/automation" },
  { id: "analytics", label: "Analytics", hint: "Usage, sheets, Slack, Notion, Gmail", group: "Go to", icon: ChartBar, accent: "oklch(0.68 0.15 160)", keywords: "usage stats charts spending", href: "/dashboard/analytics" },
  { id: "settings", label: "Settings", hint: "Profile, billing, apps, privacy", group: "Go to", icon: Gear, accent: "oklch(0.66 0.14 25)", keywords: "account preferences", href: "/dashboard/settings" },
  { id: "ask-ai", label: "Ask AI a question", hint: "Open AI Insights", group: "Actions", icon: Robot, accent: "oklch(0.66 0.21 10)", keywords: "ask new chat question", href: "/dashboard/ai-insights" },
  { id: "upload-doc", label: "Upload a document", hint: "PDF, PNG or JPG", group: "Actions", icon: UploadSimple, accent: "var(--flow-coral)", keywords: "add invoice pdf file", href: "/dashboard/documents" },
  { id: "connect-app", label: "Connect an app", hint: "Add Gmail, Slack, Notion or Sheets", group: "Actions", icon: Plug, accent: "oklch(0.66 0.12 190)", keywords: "add account link integration", href: "/dashboard/integrations" },
  { id: "new-automation", label: "New automation", hint: "Schedule a report", group: "Actions", icon: Lightning, accent: "oklch(0.78 0.16 80)", keywords: "create schedule daily weekly", href: "/dashboard/automation" },
  { id: "buy-credits", label: "Buy credits", hint: "Top up your balance", group: "Actions", icon: Coins, accent: "oklch(0.72 0.17 55)", keywords: "pay razorpay top up balance", run: "buy" },
  { id: "billing", label: "Credits & billing history", hint: "Prices and your ledger", group: "Actions", icon: Coins, accent: "oklch(0.72 0.17 55)", keywords: "ledger payments invoices", href: "/dashboard/settings/billing" },
  { id: "export", label: "Download or delete my data", hint: "Data & privacy", group: "Actions", icon: Database, accent: "oklch(0.66 0.14 25)", keywords: "export privacy delete account gdpr", href: "/dashboard/settings/data" },
  { id: "security", label: "Profile & security", hint: "Clerk account settings", group: "Actions", icon: ShieldCheck, accent: "var(--flow-magenta)", keywords: "password email profile login", href: "/dashboard/settings/account" },
];

/** Every query word must appear in the label or keywords; label-prefix matches rank first. */
function rank(query: string, e: Entry): number {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const label = e.label.toLowerCase();
  const hay = `${label} ${e.hint.toLowerCase()} ${e.keywords}`;
  if (!words.every((w) => hay.includes(w))) return -1;
  let score = 1;
  if (label.startsWith(words[0])) score += 3;
  else if (label.includes(words[0])) score += 2;
  return score;
}

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeRecents(ids: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable: recents just won't persist */
  }
}

export function CommandPalette() {
  const router = useRouter();
  const { openBuy } = useCredits();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [isMac, setIsMac] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Decided after mount so server and client markup match.
  useEffect(() => setIsMac(/mac|iphone|ipad/i.test(navigator.platform)), []);

  const show = useCallback(() => {
    setRecents(readRecents());
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  // Ctrl/Cmd+K toggles the palette from anywhere in the dashboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) {
            setRecents(readRecents());
            setQuery("");
            setActive(0);
          }
          return !o;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Flat, ordered list of what's visible: recents (empty query) then groups, or ranked matches.
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const recent = recents
        .map((id) => ENTRIES.find((e) => e.id === id))
        .filter((e): e is Entry => Boolean(e));
      const rest = ENTRIES.filter((e) => !recent.includes(e));
      return [
        ...recent.map((e) => ({ e, section: "Recent" as const })),
        ...rest.map((e) => ({ e, section: e.group })),
      ];
    }
    return ENTRIES.map((e) => ({ e, score: rank(q, e) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => ({ e: r.e, section: r.e.group }));
  }, [query, recents]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(e: Entry) {
    writeRecents([e.id, ...recents.filter((id) => id !== e.id)].slice(0, MAX_RECENTS));
    setOpen(false);
    if (e.run === "buy") openBuy();
    else if (e.href) router.push(e.href);
  }

  function onInputKey(ev: React.KeyboardEvent) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const hit = results[active];
      if (hit) choose(hit.e);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label="Search the dashboard"
        aria-keyshortcuts="Control+K Meta+K"
        className="glass-panel flex max-w-md flex-1 items-center gap-2.5 rounded-full px-4 py-2.5 text-left transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-(--flow-magenta)"
      >
        <MagnifyingGlass className="size-4 shrink-0 text-(--flow-ink)/45" />
        <span className="flex-1 truncate text-[14px] text-(--flow-ink)/45">Search anything…</span>
        <kbd className="hidden rounded-md border border-(--flow-ink)/12 bg-(--flow-cream)/70 px-1.5 py-0.5 text-[11px] font-medium text-(--flow-ink)/50 sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className="fixed inset-0 z-50 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
            style={{
              backgroundImage:
                "radial-gradient(60% 50% at 30% 20%, color-mix(in oklab, var(--flow-pink) 50%, transparent), transparent 70%)," +
                "color-mix(in oklab, var(--flow-ink) 20%, transparent)",
              backdropFilter: "blur(8px)",
            }}
          />
          <DialogPrimitive.Popup
            initialFocus={false}
            className="fixed top-[14vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0"
          >
            <DialogPrimitive.Title className="sr-only">Search the dashboard</DialogPrimitive.Title>
            <div
              className="overflow-hidden rounded-[26px] border border-(--flow-cream)"
              style={{
                boxShadow: "0 40px 80px -30px color-mix(in oklab, var(--flow-magenta) 50%, transparent)",
                backgroundImage:
                  "radial-gradient(110% 80% at 0% 0%, color-mix(in oklab, var(--flow-peach) 85%, transparent), transparent 60%)," +
                  "linear-gradient(160deg, var(--flow-cream), color-mix(in oklab, var(--flow-pink) 30%, var(--flow-cream)))",
              }}
            >
              <div className="flex items-center gap-3 border-b border-(--flow-ink)/8 px-5 py-4">
                <MagnifyingGlass className="size-5 shrink-0 text-(--flow-magenta)" />
                <input
                  autoFocus
                  type="text"
                  role="combobox"
                  aria-expanded
                  aria-controls="palette-list"
                  aria-activedescendant={results[active] ? `palette-opt-${results[active].e.id}` : undefined}
                  value={query}
                  onChange={(ev) => {
                    setQuery(ev.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onInputKey}
                  placeholder="Search pages and actions…"
                  className="w-full bg-transparent text-[16px] text-(--flow-ink) placeholder:text-(--flow-ink)/40 focus:outline-none"
                />
                <kbd className="rounded-md border border-(--flow-ink)/12 px-1.5 py-0.5 text-[11px] text-(--flow-ink)/45">Esc</kbd>
              </div>

              <div ref={listRef} id="palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto overscroll-contain p-2">
                {results.length === 0 ? (
                  <p className={cn(Z, "px-4 py-10 text-center text-[24px] leading-snug text-(--flow-ink)/55")}>
                    Nothing matches “{query.trim()}”
                  </p>
                ) : (
                  results.map((r, i) => {
                    const showHeading = i === 0 || results[i - 1].section !== r.section;
                    const Ico = r.e.icon;
                    const isActive = i === active;
                    return (
                      <div key={`${r.section}-${r.e.id}`}>
                        {showHeading && (
                          <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wider text-(--flow-ink)/45 uppercase">
                            {r.section}
                          </p>
                        )}
                        <button
                          type="button"
                          id={`palette-opt-${r.e.id}`}
                          role="option"
                          aria-selected={isActive}
                          data-index={i}
                          onMouseMove={() => setActive(i)}
                          onClick={() => choose(r.e)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors"
                          style={{
                            backgroundImage: isActive
                              ? `linear-gradient(90deg, color-mix(in oklab, ${r.e.accent} 22%, transparent), transparent)`
                              : undefined,
                          }}
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                            style={{ background: `color-mix(in oklab, ${r.e.accent} 18%, transparent)`, color: r.e.accent }}
                          >
                            <Ico weight="duotone" className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn(Z, "block truncate text-[24px] leading-none text-(--flow-ink)")}>{r.e.label}</span>
                            <span className="mt-0.5 block truncate text-[12.5px] text-(--flow-ink)/50">{r.e.hint}</span>
                          </span>
                          {isActive && <ArrowBendDownLeft className="size-4 shrink-0 text-(--flow-ink)/40" />}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-4 border-t border-(--flow-ink)/8 px-5 py-2.5 text-[11.5px] text-(--flow-ink)/45">
                <span>↑↓ to move</span>
                <span>↵ to open</span>
                <span className="ml-auto">{isMac ? "⌘" : "Ctrl"} K to toggle</span>
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
