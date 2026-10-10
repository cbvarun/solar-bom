"use client";
import { useState } from "react";
import clsx from "clsx";

type Errors = Record<string, string>;

export function EnquiryForm({ source = "website", productSku, projectId, compact = false, defaultMessage = "" }: {
  source?: "website" | "quote-request" | "product-quote"; productSku?: string; projectId?: string; compact?: boolean; defaultMessage?: string;
}) {
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const errs: Errors = {};
    if (!String(body.name ?? "").trim()) errs.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(String(body.email ?? ""))) errs.email = "Enter a valid email";
    if (String(body.message ?? "").trim().length < 5) errs.message = "Tell us a little about the project";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await fetch("/api/enquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, source, productSku, projectId }) });
    setBusy(false);
    const json = await res.json();
    if (!res.ok) setErrors(json.errors ?? { form: "Could not submit. Please try again." });
    else setDone(json.delivery?.message ?? "Submitted.");
  }

  if (done) {
    return (
      <div role="status" className="rounded-md border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        <p className="font-semibold">Thank you — your request has been recorded.</p>
        <p className="mt-1">{done}</p>
      </div>
    );
  }

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={`enq-${name}`}>{label}{props.required && <span className="text-red-600"> *</span>}</label>
      <input id={`enq-${name}`} name={name} className={clsx("input mt-1", errors[name] && "input-error")} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `enq-${name}-err` : undefined} {...props} />
      {errors[name] && <p id={`enq-${name}-err`} className="mt-1 text-xs text-red-700">{errors[name]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className={clsx("grid gap-4", !compact && "sm:grid-cols-2")}>
        {field("name", "Name", { required: true, autoComplete: "name" })}
        {field("email", "Email", { required: true, type: "email", autoComplete: "email" })}
        {field("phone", "Phone", { type: "tel", autoComplete: "tel" })}
        {!compact && field("company", "Company / society", { autoComplete: "organization" })}
        {!compact && (
          <div>
            <label className="label" htmlFor="enq-customerType">Customer type</label>
            <select id="enq-customerType" name="customerType" className="input mt-1" defaultValue="">
              <option value="">Select…</option>
              <option value="RESIDENTIAL">Residential</option><option value="APARTMENT">Apartment</option>
              <option value="COMMERCIAL">Commercial</option><option value="INDUSTRIAL">Industrial</option>
            </select>
          </div>
        )}
        {!compact && field("capacityKwp", "Approximate capacity (kWp)", { inputMode: "decimal" })}
        {!compact && field("location", "Site location (area, Bengaluru)")}
      </div>
      <div>
        <label className="label" htmlFor="enq-message">Message<span className="text-red-600"> *</span></label>
        <textarea id="enq-message" name="message" rows={compact ? 3 : 4} defaultValue={defaultMessage} className={clsx("input mt-1", errors.message && "input-error")} aria-invalid={!!errors.message} />
        {errors.message && <p className="mt-1 text-xs text-red-700">{errors.message}</p>}
      </div>
      {errors.form && <p role="alert" className="text-sm text-red-700">{errors.form}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : source === "website" ? "Send enquiry" : "Request a quote"}</button>
    </form>
  );
}
