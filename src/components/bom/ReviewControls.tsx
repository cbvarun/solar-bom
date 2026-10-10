"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewControls({ revisionId }: { revisionId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function decide(decision: "APPROVED" | "REJECTED") {
    const res = await fetch(`/api/revisions/${revisionId}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, notes: notes || null }) });
    const j = await res.json();
    if (!res.ok) setErr(j.error ?? Object.values(j.errors ?? {}).join(" "));
    else router.refresh();
  }
  return (
    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <label className="sr-only" htmlFor={`n-${revisionId}`}>Review notes</label>
      <textarea id={`n-${revisionId}`} className="input text-xs" rows={2} placeholder="Review notes (required to reject)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" onClick={() => decide("APPROVED")}>Approve</button>
        <button className="btn-danger btn-sm" onClick={() => decide("REJECTED")}>Reject</button>
      </div>
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
    </div>
  );
}
