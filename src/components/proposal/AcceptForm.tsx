"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export function AcceptForm({ token, companyName, defaultName, defaultEmail }: { token: string; companyName: string; defaultName: string; defaultEmail: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const body = { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), note: String(fd.get("note") ?? ""), agree: fd.get("agree") === "on" };
    const errs: Record<string, string> = {};
    if (body.name.trim().length < 2) errs.name = "Enter your full name";
    if (!/^\S+@\S+\.\S+$/.test(body.email)) errs.email = "Enter a valid email";
    if (!body.agree) errs.agree = "Tick the box to confirm";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/proposal/${encodeURIComponent(token)}/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => null);
      if (!res.ok) setErrors(j?.errors ?? { form: j?.error ?? "Could not record your acceptance. Please try again." });
      else router.refresh();
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["name", "email"] as const).map((k) => (
          <div key={k} className="min-w-0">
            <label className="label" htmlFor={`a-${k}`}>{k === "name" ? "Full name" : "Email"}<span className="text-red-600"> *</span></label>
            <input id={`a-${k}`} name={k} type={k === "email" ? "email" : "text"} autoComplete={k} defaultValue={k === "name" ? defaultName : defaultEmail} className={clsx("input mt-1", errors[k] && "input-error")} aria-invalid={!!errors[k]} />
            {errors[k] && <p className="mt-1 text-xs text-red-700">{errors[k]}</p>}
          </div>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="a-note">Note for our team (optional)</label>
        <textarea id="a-note" name="note" rows={2} maxLength={1000} className="input mt-1" placeholder="Preferred site-visit dates, questions…" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agree" className="mt-1" aria-invalid={!!errors.agree} />
        <span>
          I accept this preliminary quotation and ask {companyName} to proceed with the site survey and final design. I understand that quantities and prices may change after
          the survey, that generation, savings and subsidy figures are estimates and not guarantees, and that grid connection needs utility approval.
        </span>
      </label>
      {errors.agree && <p className="text-xs text-red-700">{errors.agree}</p>}
      {errors.form && <p role="alert" className="text-sm text-red-700">{errors.form}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Recording…" : "Accept proposal"}</button>
      <p className="text-xs text-ink-muted">We record your name, email, the time, your IP address and browser as an electronic acceptance record. This is not a certified digital signature.</p>
    </form>
  );
}
