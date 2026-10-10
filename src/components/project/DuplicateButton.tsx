"use client";
import { useState } from "react";

export function DuplicateButton({ projectId, primary }: { projectId: string; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function dup() {
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/duplicate`, { method: "POST" });
    const j = await res.json();
    if (res.ok) window.location.href = `/projects/${j.id}/configure`;
    else setBusy(false);
  }
  return <button onClick={dup} disabled={busy} className={primary ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{busy ? "Copying…" : primary ? "Duplicate to edit" : "Duplicate project"}</button>;
}
