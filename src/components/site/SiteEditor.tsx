"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { LatLon } from "./SiteMap";

const SiteMap = dynamic(() => import("./SiteMap").then((m) => m.SiteMap), { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-md bg-slate-100 sm:h-[440px]" /> });

export interface SiteValues {
  latitude: number | null;
  longitude: number | null;
  roofOutline: LatLon[];
  tiltDeg: number | null;
  azimuthDeg: number | null;
  systemLossPct: number | null;
  shadingLossPct: number | null;
  tariffInrPerKwh: number | null;
  tariffSource: string | null;
  subsidySchemeId: string | null;
}

const s = (v: number | string | null) => (v == null ? "" : String(v));

const FIELD_LABEL: Record<string, string> = {
  latitude: "Site location", longitude: "Site location", roofOutline: "Roof outline", tiltDeg: "Array tilt", azimuthDeg: "Array direction",
  systemLossPct: "System losses", shadingLossPct: "Shading loss", tariffInrPerKwh: "Electricity tariff", tariffSource: "Tariff source",
  subsidySchemeId: "Subsidy scheme", applyRoofArea: "Roof area option",
};

/** A failure message that always says what went wrong, naming each rejected field. */
function failureText(status: number, j: { error?: string; errors?: Record<string, string> }, action: string) {
  if (j.error) return j.error;
  const errs = Object.entries(j.errors ?? {});
  if (errs.length) return `Please correct: ${errs.map(([k, m]) => `${FIELD_LABEL[k] ?? k} (${m})`).join("; ")}.`;
  return `${action} failed: the server returned an error (HTTP ${status}). Reload the page to see what was kept, then try again.`;
}

export function SiteEditor({ projectId, initial, schemes, readOnly, hasEstimate }: {
  projectId: string;
  initial: SiteValues;
  schemes: { id: string; name: string; verified: boolean }[];
  readOnly: boolean;
  hasEstimate: boolean;
}) {
  const router = useRouter();
  const [pin, setPin] = useState<LatLon | null>(initial.latitude != null && initial.longitude != null ? [initial.latitude, initial.longitude] : null);
  const [outline, setOutline] = useState<LatLon[]>(initial.roofOutline);
  const [optimal, setOptimal] = useState(initial.tiltDeg == null && initial.azimuthDeg == null);
  const [f, setF] = useState({
    tiltDeg: s(initial.tiltDeg), azimuthDeg: s(initial.azimuthDeg), systemLossPct: s(initial.systemLossPct), shadingLossPct: s(initial.shadingLossPct),
    tariffInrPerKwh: s(initial.tariffInrPerKwh), tariffSource: s(initial.tariffSource), subsidySchemeId: s(initial.subsidySchemeId),
  });
  const [applyRoofArea, setApplyRoofArea] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "yield" | null>(null);
  const [dirty, setDirty] = useState(false);
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };

  const formBody = () => ({
      latitude: pin?.[0] ?? null, longitude: pin?.[1] ?? null, roofOutline: outline.length >= 3 ? outline : null,
      tiltDeg: optimal ? null : f.tiltDeg, azimuthDeg: optimal ? null : f.azimuthDeg, systemLossPct: f.systemLossPct, shadingLossPct: f.shadingLossPct,
      tariffInrPerKwh: f.tariffInrPerKwh, tariffSource: f.tariffSource, subsidySchemeId: f.subsidySchemeId, applyRoofArea,
  });

  async function save(): Promise<boolean> {
    setBusy("save");
    setMsg(null);
    setErrors({});
    try {
      const res = await fetch(`/api/projects/${projectId}/site`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(formBody()) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.errors) setErrors(j.errors);
        setMsg({ tone: "error", text: failureText(res.status, j, "Save") });
        return false;
      }
      setDirty(false);
      setApplyRoofArea(false);
      setMsg(j.regenerateError
        ? { tone: "error", text: `Saved, and the roof area was applied, but the BOM could not be regenerated: ${j.regenerateError} Open the BOM tab to regenerate it.` }
        : { tone: "ok", text: `Saved.${j.regenerated ? " Roof area applied and BOM regenerated." : ""}${j.yieldCleared ? " Location or losses changed, so run the yield estimate again." : ""}` });
      router.refresh();
      return true;
    } catch {
      setMsg({ tone: "error", text: "Could not reach the server." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  // Saves the form and estimates in one request, so the estimate always uses what is on screen.
  async function estimate() {
    setBusy("yield");
    setMsg(null);
    setErrors({});
    try {
      const res = await fetch(`/api/projects/${projectId}/site/yield`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(formBody()) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { if (j.errors) setErrors(j.errors); setMsg({ tone: "error", text: failureText(res.status, j, "Estimate") }); }
      else { setDirty(false); setApplyRoofArea(false); setMsg({ tone: "ok", text: `Estimated ${j.specificYieldKwhPerKwpYr} kWh per kWp per year (${j.source}).` }); router.refresh(); }
    } catch {
      setMsg({ tone: "error", text: "Could not reach the server." });
    } finally {
      setBusy(null);
    }
  }

  const num = (k: keyof typeof f, label: string, unit: string, hint?: string, disabled?: boolean) => (
    <div>
      <label htmlFor={`site-${k}`} className="label">{label} <span className="font-normal text-ink-muted">({unit})</span></label>
      <input id={`site-${k}`} className={clsx("input mt-1", errors[k] && "input-error")} inputMode="decimal" value={f[k]} disabled={readOnly || disabled}
        aria-invalid={!!errors[k]} onChange={(e) => set(k, e.target.value)} />
      {hint && <p className="hint">{hint}</p>}
      {errors[k] && <p className="mt-1 text-xs text-red-700">{errors[k]}</p>}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="card min-w-0 p-5">
        <h2 className="section-title">Site location and roof</h2>
        <div className="mt-3">
          <SiteMap pin={pin} outline={outline} readOnly={readOnly} onPin={(p) => { setPin(p); setDirty(true); }} onOutline={(o) => { setOutline(o); setDirty(true); }} />
        </div>
        <p className="mt-1 text-xs text-ink-muted">{pin ? `Site: ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}` : "Site not marked yet. Choose Mark site and click the building."} {(errors.latitude || errors.longitude) && <span className="text-red-700">{errors.latitude ?? errors.longitude}</span>}
          {errors.roofOutline && <span className="block text-red-700">{errors.roofOutline}</span>}</p>
        {!readOnly && outline.length >= 3 && (
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={applyRoofArea} onChange={(e) => { setApplyRoofArea(e.target.checked); setDirty(true); }} />
            <span>Use the outline area as the available roof area in the configuration. This regenerates the BOM checks.</span>
          </label>
        )}
      </section>
      <section className="card min-w-0 p-5">
        <h2 className="section-title">Yield and savings inputs</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={optimal} disabled={readOnly} onChange={(e) => { setOptimal(e.target.checked); setDirty(true); }} />
            <span>Let PVGIS choose the optimal tilt and direction</span>
          </label>
          {num("tiltDeg", "Array tilt", "°", "From horizontal. Flat RCC roofs typically use a low fixed tilt; use the design value.", optimal)}
          {num("azimuthDeg", "Array direction", "° compass", "180 = facing south, 90 = east, 270 = west.", optimal)}
          {num("systemLossPct", "System losses", "%", "Cables, inverter, dirt and mismatch. PVGIS suggests 14% when no design value is available.")}
          {num("shadingLossPct", "Shading loss", "%", "From a shade survey of nearby buildings and trees. Leave blank if not assessed.")}
          {num("tariffInrPerKwh", "Customer's electricity tariff", "₹/kWh", "Energy charge per kWh from the customer's bill.")}
          <div>
            <label htmlFor="site-tariffSource" className="label">Tariff source</label>
            <input id="site-tariffSource" className="input mt-1" value={f.tariffSource} disabled={readOnly} placeholder="e.g. BESCOM bill, Aug 2026" onChange={(e) => set("tariffSource", e.target.value)} />
            {errors.tariffSource && <p className="mt-1 text-xs text-red-700">{errors.tariffSource}</p>}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="site-subsidy" className="label">Subsidy scheme</label>
            <select id="site-subsidy" className="input mt-1" value={f.subsidySchemeId} disabled={readOnly} onChange={(e) => set("subsidySchemeId", e.target.value)}>
              <option value="">None</option>
              {schemes.map((x) => <option key={x.id} value={x.id}>{x.name}{x.verified ? "" : " (amounts pending verification)"}</option>)}
            </select>
            {errors.subsidySchemeId && <p className="mt-1 text-xs text-red-700">{errors.subsidySchemeId}</p>}
            <p className="hint">{schemes.length ? "Only schemes activated by your team appear here." : "No subsidy scheme is active. Staff can set one up under Admin → Subsidies."}</p>
          </div>
        </div>
        {msg && <p role={msg.tone === "error" ? "alert" : "status"} className={clsx("mt-4 text-sm", msg.tone === "error" ? "text-red-700" : "text-brand-800")}>{msg.text}</p>}
        {!readOnly && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" disabled={busy !== null} onClick={save}>{busy === "save" ? "Saving…" : "Save"}</button>
            <button type="button" className="btn-primary" disabled={busy !== null || !pin} onClick={estimate}>{busy === "yield" ? "Estimating…" : hasEstimate ? "Re-run yield estimate" : "Estimate yield (PVGIS)"}</button>
          </div>
        )}
        {!readOnly && !pin && <p className="mt-2 text-xs text-solar-700">To estimate yield, click <strong>Mark site</strong> above the map, then click the building.</p>}
        <p className="mt-3 text-xs text-ink-muted">The yield estimate uses PVGIS, a free service of the European Commission&apos;s Joint Research Centre. It sends only the coordinates, angles and losses.</p>
      </section>
    </div>
  );
}
