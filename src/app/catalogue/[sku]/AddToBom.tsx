"use client";
import Link from "next/link";
import { useState } from "react";

export function AddToBom({ productId, unit, projects, disabled }: { productId: string; unit: string; projects: { id: string; name: string; reference: string }[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!projects.length) {
    return <Link href={`/configure?add=${productId}`} className="btn-primary" aria-disabled={disabled}>Add to BOM</Link>;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${projectId}/bom/items`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, procurementQty: qty, reason: "Added from catalogue" }),
    });
    const j = await res.json();
    setMsg(res.ok ? { ok: true, text: "Added to the BOM as a manual line." } : { ok: false, text: Object.values(j.errors ?? { e: j.error ?? "Failed" }).join(" ") });
  }
  return (
    <div>
      {!open ? (
        <button className="btn-primary w-full" disabled={disabled} onClick={() => setOpen(true)}>Add to BOM</button>
      ) : (
        <form onSubmit={add} className="card space-y-2 p-3">
          <label className="label" htmlFor="atb-project">Project</label>
          <select id="atb-project" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.name}</option>)}
          </select>
          <label className="label" htmlFor="atb-qty">Quantity ({unit})</label>
          <input id="atb-qty" className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          <div className="flex gap-2"><button className="btn-primary btn-sm">Add</button><button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button></div>
          {msg && <p role="status" className={msg.ok ? "text-xs text-brand-800" : "text-xs text-red-700"}>{msg.text} {msg.ok && <Link href={`/projects/${projectId}/bom`}>Open BOM</Link>}</p>}
        </form>
      )}
    </div>
  );
}
