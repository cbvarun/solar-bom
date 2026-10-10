"use client";
import { useState } from "react";
import clsx from "clsx";

export function QuoteRequestForm({ projectId, defaultName, defaultEmail }: { projectId: string; defaultName: string; defaultEmail: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ number: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(action: "request-quote" | "email-sales", form: HTMLFormElement) {
    const fd = Object.fromEntries(new FormData(form).entries());
    const errs: Record<string, string> = {};
    if (String(fd.contactName ?? "").trim().length < 2) errs.contactName = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(String(fd.contactEmail ?? ""))) errs.contactEmail = "Enter a valid email";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/quote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...fd, action }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setErrors(j.errors ?? { form: j.error ?? "Could not submit" });
    else setResult({ number: j.number, message: j.delivery.message });
  }
  if (result) return (
    <div role="status" className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
      <p className="font-semibold">Quotation {result.number} created.</p>
      <p className="mt-1">{result.message}</p>
    </div>
  );
  return (
    <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); send("request-quote", e.currentTarget); }}>
      {(["contactName", "contactEmail", "phone"] as const).map((k) => (
        <div key={k}>
          <label className="label" htmlFor={`q-${k}`}>{{ contactName: "Your name", contactEmail: "Email", phone: "Phone" }[k]}{k !== "phone" && <span className="text-red-600"> *</span>}</label>
          <input id={`q-${k}`} name={k} type={k === "contactEmail" ? "email" : "text"} defaultValue={k === "contactName" ? defaultName : k === "contactEmail" ? defaultEmail : ""} className={clsx("input mt-1", errors[k] && "input-error")} aria-invalid={!!errors[k]} />
          {errors[k] && <p className="mt-1 text-xs text-red-700">{errors[k]}</p>}
        </div>
      ))}
      <div>
        <label className="label" htmlFor="q-message">Message</label>
        <textarea id="q-message" name="message" rows={3} className="input mt-1" placeholder="Site visit availability, preferred brands, timeline…" />
      </div>
      {errors.form && <p role="alert" className="text-sm text-red-700">{errors.form}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy}>Submit as quote request</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={(e) => send("email-sales", e.currentTarget.form!)}>Email BOM to sales team</button>
      </div>
    </form>
  );
}
