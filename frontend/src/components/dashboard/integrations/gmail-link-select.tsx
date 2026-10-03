"use client";

import { useId } from "react";
import type { GmailConnection } from "@/hooks/use-gmail-connection";

const zeyada = "font-(family-name:--font-zeyada) font-normal";

/** Which connected Gmail account a Slack or Notion workspace belongs to. Hidden when the user
 * has no Gmail connected (there is nothing to choose). `null` means "not linked". */
export function GmailLinkSelect({
  accounts,
  value,
  onChange,
  disabled,
  label = "Belongs to Gmail",
}: {
  accounts: GmailConnection[];
  value: string | null;
  onChange: (gmailId: string | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const live = accounts.filter((a) => a.status === "connected");
  if (live.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className={`${zeyada} text-[20px] leading-none text-(--flow-ink)/75`}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className="min-w-0 max-w-full rounded-xl border border-(--flow-ink)/15 bg-(--flow-cream)/80 px-3 py-1.5 text-[14px] text-(--flow-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta) disabled:opacity-60"
      >
        <option value="">No Gmail account</option>
        {live.map((g) => (
          <option key={g.id} value={g.id}>
            {g.external_account_email}
          </option>
        ))}
      </select>
    </div>
  );
}
