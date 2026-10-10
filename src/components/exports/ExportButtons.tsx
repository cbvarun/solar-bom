"use client";
import { useState } from "react";
import { downloadBomExport, type ExportFormat } from "@/lib/exports/download";

const OPTIONS: { fmt: ExportFormat; title: string; text: string }[] = [
  { fmt: "pdf", title: "PDF quotation document", text: "Branding, project details, assumptions, detailed BOM, specifications, cost summary, taxes and exclusions, compliance notes, validity and terms." },
  { fmt: "xlsx", title: "Excel workbook (.xlsx)", text: "Editable BOM with live price and GST formulas, products & quantities, supplier comparison, technical compliance, assumptions & exclusions." },
  { fmt: "csv", title: "CSV for ERP import", text: "Flat, procurement-ready BOM, one row per line with stable column names." },
];

/** Export cards. Files are generated in this browser from the project's current BOM. */
export function ExportButtons({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(fmt: ExportFormat) {
    setBusy(fmt);
    setError(null);
    try {
      await downloadBomExport(projectId, fmt);
    } catch (e) {
      setError(`Could not create the ${fmt.toUpperCase()} file. ${e instanceof Error ? e.message : ""}`.trim());
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <button key={o.fmt} type="button" onClick={() => run(o.fmt)} disabled={busy !== null} aria-busy={busy === o.fmt} className="card block p-4 text-left hover:border-brand-300 disabled:opacity-60">
            <span className="block font-semibold text-ink">{busy === o.fmt ? "Preparing…" : o.title}</span>
            <span className="mt-1 block text-xs text-ink-muted">{o.text}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </>
  );
}
