"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** India-first: a bare 10-digit mobile number gets the +91 country code for wa.me. */
function waNumber(phone: string | null): string {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) return `91${d}`;
  return d.length >= 11 && d.length <= 15 ? d : "";
}

/**
 * Staff controls for a quotation's web proposal link: create, copy, send by
 * WhatsApp or email (both open the staff member's own app; nothing is sent
 * by the server), and revoke.
 */
export function SharePanel({ quotationId, number, initialToken, accepted, customerName, customerEmail, customerPhone }: {
  quotationId: string; number: string; initialToken: string | null; accepted: boolean;
  customerName: string | null; customerEmail: string | null; customerPhone: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function call(action: "share" | "revoke") {
    if (action === "revoke" && !confirm("Revoke this link? The customer will no longer be able to open the proposal.")) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/share`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await res.json().catch(() => null);
      if (!res.ok) setMsg(j?.error ?? "Could not update the link.");
      else { setToken(j.shareToken); router.refresh(); }
    } catch { setMsg("Network error."); } finally { setBusy(false); }
  }
  if (!token) return (
    <div>
      <button type="button" className="text-brand-700 hover:underline disabled:opacity-60" disabled={busy} onClick={() => call("share")}>{busy ? "Creating…" : "Share link"}</button>
      {msg && <p className="text-xs text-red-700">{msg}</p>}
    </div>
  );
  const url = `${typeof window === "undefined" ? "" : window.location.origin}/proposal/${token}`;
  const text = `Hello${customerName ? ` ${customerName}` : ""}, here is your solar proposal ${number}: ${url}`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <a href={`/proposal/${token}`} target="_blank" rel="noreferrer">Open</a>
      <button type="button" className="text-brand-700 hover:underline" onClick={async () => { try { await navigator.clipboard.writeText(url); setMsg("Link copied."); } catch { setMsg(url); } }}>Copy link</button>
      <a href={`https://wa.me/${waNumber(customerPhone)}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      <a href={`mailto:${customerEmail ?? ""}?subject=${encodeURIComponent(`Your solar proposal ${number}`)}&body=${encodeURIComponent(text)}`}>Email</a>
      {!accepted && <button type="button" className="text-red-700 hover:underline disabled:opacity-60" disabled={busy} onClick={() => call("revoke")}>Revoke</button>}
      {msg && <p className="w-full break-all text-xs text-ink-muted">{msg}</p>}
    </div>
  );
}
