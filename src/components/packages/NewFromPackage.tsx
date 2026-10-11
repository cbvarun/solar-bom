"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CUSTOMER_TYPE_LABEL } from "@/lib/format";

type Defaults = Partial<Record<"name" | "location" | "customerName" | "customerPhone" | "customerEmail" | "customerType", string | null>>;

export function NewFromPackage({ packageId, packageName, defaults = {}, enquiryId }: { packageId: string; packageName: string; defaults?: Defaults; enquiryId?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement) {
    const body = Object.fromEntries(new FormData(form).entries());
    if (String(body.name ?? "").trim().length < 2) { setErrors({ name: "Project name is required" }); return; }
    setBusy(true); setErrors({});
    try {
      const res = await fetch(`/api/packages/${packageId}/projects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, enquiryId }) });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setErrors(j?.errors ?? { form: j?.error ?? "Could not create the project." }); setBusy(false); return; }
      router.push(`/projects/${j.projectId}/bom`);
    } catch { setErrors({ form: "Network error." }); setBusy(false); }
  }
  const field = (name: string, label: string, type = "text") => (
    <label className="block min-w-0">
      <span className="label text-xs">{label}{name === "name" && <span className="text-red-700"> *</span>}</span>
      <input name={name} type={type} defaultValue={defaults[name as keyof Defaults] ?? undefined} className={clsx("input mt-1 py-1.5", errors[name] && "input-error")} aria-invalid={!!errors[name]} />
      {errors[name] && <span className="mt-1 block text-xs text-red-700">{errors[name]}</span>}
    </label>
  );
  return (
    <form className="grid gap-3 sm:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
      {field("name", "Project name")}
      {field("location", "Location")}
      {field("customerName", "Customer name")}
      {field("customerPhone", "Customer phone", "tel")}
      {field("customerEmail", "Customer email", "email")}
      <label className="block min-w-0">
        <span className="label text-xs">Customer type</span>
        <select name="customerType" className="input mt-1 py-1.5" defaultValue={defaults.customerType ?? ""}><option value="">Not set</option>{Object.entries(CUSTOMER_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </label>
      {errors.form && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{errors.form}</p>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={busy}>{busy ? "Creating…" : `Create project from ${packageName}`}</button></div>
    </form>
  );
}
