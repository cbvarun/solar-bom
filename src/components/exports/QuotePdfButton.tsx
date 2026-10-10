"use client";
import { useState } from "react";
import { downloadQuotationPdf } from "@/lib/exports/download";

/**
 * Quotation PDF download. Quotations are rebuilt in the browser from their
 * stored snapshot; older ones (storedPdf) have a PDF file served by the API.
 */
export function QuotePdfButton({ quotationId, storedPdf, label = "PDF" }: { quotationId: string; storedPdf: boolean; label?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  if (storedPdf) return <a href={`/api/quotations/${quotationId}/pdf`}>{label}</a>;
  return (
    <button
      type="button"
      className="text-brand-700 hover:underline disabled:opacity-60"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        try {
          await downloadQuotationPdf(quotationId);
          setState("idle");
        } catch {
          setState("error");
        }
      }}
    >
      {state === "busy" ? "Preparing…" : state === "error" ? "Failed, retry" : label}
    </button>
  );
}
