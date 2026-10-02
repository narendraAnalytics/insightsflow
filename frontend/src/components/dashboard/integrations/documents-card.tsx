"use client";

import { useRef, useState } from "react";
import { CheckCircle, FileArrowUp, FileText, SpinnerGap, Table, Trash, WarningCircle } from "@phosphor-icons/react";
import { GlassSlab } from "@/components/dashboard/integrations/google-sheets-card";
import {
  useDocuments,
  type DocumentPreview,
  type DocumentTemplate,
  type UploadedDocument,
} from "@/hooks/use-documents";

const zeyada = "font-(family-name:--font-zeyada) font-normal";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg";

const TEMPLATES: { id: DocumentTemplate; label: string; hint: string }[] = [
  { id: "invoice", label: "Invoice", hint: "Line items, vendor, dates" },
  { id: "bank_statement", label: "Bank statement", hint: "Every transaction row" },
  { id: "receipt", label: "Receipt", hint: "Merchant and items" },
  { id: "custom", label: "Custom", hint: "Describe what you need" },
];

function DocumentRow({
  doc,
  onRemove,
  onPreview,
}: {
  doc: UploadedDocument;
  onRemove: (id: string) => Promise<void>;
  onPreview: (id: string) => Promise<DocumentPreview>;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DocumentPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const togglePreview = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (data) return;
    try {
      setData(await onPreview(doc.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load the preview");
    }
  };

  return (
    <li
      className="flex flex-col gap-2 rounded-2xl border border-(--flow-cream) bg-(--flow-cream)/70 px-4 py-3"
      style={{ boxShadow: "0 12px 22px -16px color-mix(in oklab, var(--flow-magenta) 40%, transparent)" }}
    >
      <div className="flex items-center gap-3">
        <FileText weight="duotone" className="size-6 shrink-0 text-(--flow-magenta)" />
        <div className="min-w-0 flex-1">
          <p className={`truncate ${zeyada} text-[23px] leading-none text-(--flow-ink)`}>{doc.filename}</p>
          {doc.status === "processing" && (
            <p className={`mt-1 flex items-center gap-1.5 ${zeyada} text-[20px] leading-none text-(--flow-ink)/70`}>
              <SpinnerGap weight="bold" className="size-3.5 animate-spin text-(--flow-magenta)" />
              Sarvam is reading it…
            </p>
          )}
          {doc.status === "ready" && (
            <p className={`mt-1 flex items-center gap-1.5 ${zeyada} text-[20px] leading-none text-(--flow-ink)/75`}>
              <CheckCircle weight="fill" className="size-3.5 text-[oklch(0.68_0.15_160)]" />
              Ready · {doc.row_count} row{doc.row_count === 1 ? "" : "s"}, {doc.headers.length} columns
            </p>
          )}
          {doc.status === "failed" && (
            <p role="alert" className={`mt-1 flex items-start gap-1.5 ${zeyada} text-[20px] leading-snug text-(--flow-coral)`}>
              <WarningCircle weight="fill" className="mt-0.5 size-3.5 shrink-0" />
              {doc.error ?? "Couldn't read this document."}
            </p>
          )}
        </div>
        {doc.status === "ready" && (
          <button
            type="button"
            onClick={() => void togglePreview()}
            className={`inline-flex items-center gap-1 rounded-full bg-(--flow-cream) px-3 py-1 ${zeyada} text-[19px] leading-none text-(--flow-magenta) shadow-[0_10px_18px_-12px_var(--flow-magenta)] transition-transform hover:scale-[1.04]`}
          >
            <Table weight="bold" className="size-3.5" />
            {open ? "Hide" : "Preview"}
          </button>
        )}
        <button
          type="button"
          aria-label={`Remove ${doc.filename}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRemove(doc.id);
            } catch {
              setBusy(false);
            }
          }}
          className="text-(--flow-ink)/55 transition-colors hover:text-(--flow-coral) disabled:opacity-50"
        >
          <Trash weight="bold" className="size-4" />
        </button>
      </div>

      {open && (
        <div className="overflow-x-auto rounded-xl bg-(--flow-cream)/80 p-2">
          {err ? (
            <p role="alert" className={`${zeyada} text-[20px] text-(--flow-coral)`}>
              {err}
            </p>
          ) : !data ? (
            <p className={`${zeyada} text-[20px] text-(--flow-ink)/70`}>Loading…</p>
          ) : (
            <table className="w-full text-left text-[12px] text-(--flow-ink)">
              <thead>
                <tr>
                  {data.headers.map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-1 font-semibold text-(--flow-magenta)">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-(--flow-ink)/10">
                    {r.map((c, j) => (
                      <td key={j} className="whitespace-nowrap px-2 py-1">
                        {c ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data && data.row_count > 8 && (
            <p className={`mt-1 px-2 ${zeyada} text-[19px] text-(--flow-ink)/65`}>
              Showing 8 of {data.row_count} rows
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function DocumentsCard() {
  const { documents, loading, error, upload, remove, preview } = useDocuments();
  const [template, setTemplate] = useState<DocumentTemplate>("invoice");
  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const send = async (file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    if (file.size > MAX_BYTES) return setFormError("Files can be up to 10 MB.");
    if (template === "custom" && !prompt.trim()) return setFormError("Describe what to extract first.");
    setUploading(true);
    try {
      await upload(file, template, prompt.trim());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const readyCount = documents.filter((d) => d.status === "ready").length;

  return (
    <GlassSlab>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex size-16 items-center justify-center rounded-[20px] border border-(--flow-cream) bg-linear-to-br from-(--flow-cream) to-(--flow-peach)"
            style={{
              boxShadow:
                "0 18px 26px -14px color-mix(in oklab, var(--flow-coral) 55%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.9)",
            }}
          >
            <FileArrowUp weight="duotone" className="size-9 text-(--flow-magenta)" />
          </span>
          <div>
            <p className={`text-gradient-flow ${zeyada} text-[38px] leading-none`}>Documents</p>
            <p className={`mt-1 max-w-[26ch] ${zeyada} text-[22px] leading-snug text-(--flow-ink)/80`}>
              Turn invoices and statements into data
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full bg-(--flow-cream) px-3 py-1.5 ${zeyada} text-[20px] leading-none text-(--flow-ink) shadow-[0_8px_18px_-10px_oklch(0.66_0.12_190)]`}
        >
          {readyCount} ready
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <p className={`${zeyada} text-[21px] leading-snug text-(--flow-ink)/75`}>
          Upload a PDF or image. Sarvam reads it into rows, and AI Insights can answer questions about it — even next to
          your sheets.
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is in the document">
          {TEMPLATES.map((t) => {
            const on = template === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                title={t.hint}
                onClick={() => setTemplate(t.id)}
                className={`rounded-full border px-3.5 py-1.5 ${zeyada} text-[21px] leading-none transition-transform hover:-translate-y-0.5 active:scale-[0.97] ${
                  on
                    ? "bg-gradient-flow border-transparent text-(--flow-cream)"
                    : "border-(--flow-cream) bg-(--flow-cream)/85 text-(--flow-ink)/85"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {template === "custom" && (
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. every line item with its quantity and amount, plus the invoice date"
            className="w-full resize-none rounded-xl border border-(--flow-ink)/15 bg-(--flow-cream)/80 px-3 py-2 text-[14px] text-(--flow-ink) placeholder:text-(--flow-ink)/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-magenta)"
          />
        )}

        <button
          type="button"
          disabled={uploading}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void send(e.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-5 transition-colors disabled:opacity-60 ${
            dragging ? "border-(--flow-magenta) bg-(--flow-peach)/60" : "border-(--flow-magenta)/40 bg-(--flow-cream)/50"
          }`}
        >
          {uploading ? (
            <SpinnerGap weight="bold" className="size-6 animate-spin text-(--flow-magenta)" />
          ) : (
            <FileArrowUp weight="duotone" className="size-6 text-(--flow-magenta)" />
          )}
          <span className={`${zeyada} text-[23px] leading-none text-(--flow-ink)`}>
            {uploading ? "Uploading…" : "Drop a file or click to choose"}
          </span>
          <span className={`${zeyada} text-[19px] leading-none text-(--flow-ink)/60`}>PDF, PNG or JPG · up to 10 MB · 10 pages</span>
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void send(e.target.files?.[0])}
        />
        {(formError || error) && (
          <p role="alert" className={`${zeyada} text-[22px] leading-snug text-(--flow-coral)`}>
            {formError ?? error}
          </p>
        )}
      </div>

      {loading ? (
        <p className={`${zeyada} text-[22px] leading-none text-(--flow-ink)/70`}>Loading documents…</p>
      ) : (
        documents.length > 0 && (
          <ul className="flex flex-col gap-3">
            {documents.map((d) => (
              <DocumentRow key={d.id} doc={d} onRemove={remove} onPreview={preview} />
            ))}
          </ul>
        )
      )}
    </GlassSlab>
  );
}
