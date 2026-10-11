"use client";
import { useState } from "react";
import { downloadProposalPdf } from "@/lib/exports/download";

export function ProposalPdfButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        try { await downloadProposalPdf(token); setState("idle"); } catch { setState("error"); }
      }}
    >
      {state === "busy" ? "Preparing PDF…" : state === "error" ? "Download failed, retry" : "Download PDF"}
    </button>
  );
}
