"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { generateBom, type EngineCatalogue, type ProjectInputs, type Rules } from "@/lib/engine";
import { fieldErrors, projectSchema } from "@/lib/validation";
import { Term } from "@/components/ui/Term";
import { TBC } from "@/lib/format";

export interface ConfiguratorOptions {
  moduleManufacturers: { id: string; name: string }[];
  inverterManufacturers: { id: string; name: string }[];
  moduleWattages: number[];
  modules: { id: string; label: string }[];
  inverters: { id: string; label: string }[];
  structures: { id: string; label: string }[];
  catalogue: EngineCatalogue;
  rules: Rules;
}

export type FormValues = Record<string, string>;
export type EngValues = Record<string, string>;
export type MetaValues = Record<string, string>;

const STEPS = ["Project details", "Electrical configuration", "Design preferences", "Site & engineering inputs", "Review"] as const;

const ENG_FIELDS: { key: string; label: string; unit?: string; hint?: string; kind?: "select"; options?: [string, string][] }[] = [
  { key: "modulesPerRow", label: "Modules per row", unit: "modules", hint: "From the roof layout. Drives rails and clamps." },
  { key: "rows", label: "Number of rows", unit: "rows" },
  { key: "moduleCountOverride", label: "Design array size (override)", unit: "modules", hint: "Only if engineering deliberately differs from ceil(target ÷ module W)." },
  { key: "dcRouteLengthM", label: "DC route length, array → inverter (one way)", unit: "m" },
  { key: "acRouteLengthM", label: "AC route length, inverter → point of interconnection", unit: "m" },
  { key: "earthingRouteLengthM", label: "Earthing conductor routing length", unit: "m" },
  { key: "earthElectrodes", label: "Earth electrodes (from earthing design)", unit: "nos" },
  { key: "engineeredSupportSpacingM", label: "Engineered support spacing along rail", unit: "m", hint: "From the structural design. Needed for supports and anchors." },
  { key: "anchorsPerSupport", label: "Anchors per support", unit: "nos" },
  { key: "lightningProtection", label: "Lightning protection required?", kind: "select", options: [["", "To be confirmed"], ["TBC", "Subject to risk assessment"], ["YES", "Yes"], ["NO", "No (per risk assessment)"]] },
  { key: "downConductorLengthM", label: "Lightning down-conductor length", unit: "m" },
  { key: "designMinTempC", label: "Design minimum temperature", unit: "°C", hint: "Overrides the configured rule for Voc checks." },
  { key: "ambientDeratingFactor", label: "Cable ambient derating factor", unit: "×" },
  { key: "groupingDeratingFactor", label: "Cable grouping derating factor", unit: "×" },
  { key: "batteryCapacityKwh", label: "Battery usable capacity (hybrid/off-grid)", unit: "kWh" },
  { key: "specificYieldKwhPerKwpYr", label: "Specific yield (site simulation)", unit: "kWh/kWp/yr", hint: "Engineer-verified with a cited source; otherwise generation is not estimated." },
];

function toPayload(v: FormValues, eng: EngValues, meta: MetaValues, yieldSource: string) {
  const engineering: Record<string, unknown> = {};
  const inputMeta: Record<string, { provenance: string }> = {};
  for (const f of ENG_FIELDS) {
    if (eng[f.key] !== undefined && eng[f.key] !== "") {
      engineering[f.key] = eng[f.key];
      if (f.key !== "lightningProtection") inputMeta[f.key] = { provenance: meta[f.key] || "ESTIMATED" };
    }
  }
  if (yieldSource) engineering.specificYieldSource = yieldSource;
  return { ...v, engineering, inputMeta };
}

export function ConfigureForm({ options, initial, projectId, canSetVerified }: {
  options: ConfiguratorOptions;
  initial?: { values: FormValues; eng: EngValues; meta: MetaValues; yieldSource: string };
  projectId?: string;
  canSetVerified: boolean;
}) {
  const [step, setStep] = useState(0);
  const [v, setV] = useState<FormValues>(initial?.values ?? { customerType: "", roofType: "", systemType: "", supplyPhase: "", exportArrangement: "", monitoring: "BASIC_APP" });
  const [eng, setEng] = useState<EngValues>(initial?.eng ?? {});
  const [meta, setMeta] = useState<MetaValues>(initial?.meta ?? {});
  const [yieldSource, setYieldSource] = useState(initial?.yieldSource ?? "");
  const [tbc, setTbc] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  const parsed = useMemo(() => projectSchema.safeParse(toPayload(v, eng, meta, yieldSource)), [v, eng, meta, yieldSource]);

  // Live preview using the same engine as the server.
  const preview = useMemo(() => {
    if (!parsed.success) return null;
    const d = parsed.data;
    const mfr = (id: string | null) => [...options.moduleManufacturers, ...options.inverterManufacturers].find((m) => m.id === id)?.name ?? null;
    const inputs: ProjectInputs = {
      targetCapacityKwp: d.targetCapacityKwp, roofType: d.roofType, roofAreaM2: d.roofAreaM2, systemType: d.systemType, supplyPhase: d.supplyPhase,
      sanctionedLoadKw: d.sanctionedLoadUnit === "kW" ? d.sanctionedLoad : null, exportArrangement: d.exportArrangement, preferredModuleWp: d.preferredModuleWp,
      preferredModuleManufacturer: mfr(d.preferredModuleMfrId), preferredInverterManufacturer: mfr(d.preferredInverterMfrId), mountingMaterial: d.mountingMaterial,
      monitoring: d.monitoring, selectedModuleId: d.selectedModuleId, selectedInverterId: d.selectedInverterId, selectedStructureId: d.selectedStructureId,
      engineering: d.engineering as ProjectInputs["engineering"], inputMeta: d.inputMeta as ProjectInputs["inputMeta"],
    };
    try {
      return generateBom(inputs, options.catalogue, options.rules);
    } catch {
      return null;
    }
  }, [parsed, options]);

  const STEP_FIELDS: string[][] = [
    ["name", "location", "customerType", "customerName", "customerEmail", "customerPhone", "targetCapacityKwp", "roofType", "roofAreaM2", "isExpansion"],
    ["systemType", "supplyPhase", "sanctionedLoad", "sanctionedLoadUnit", "exportArrangement"],
    ["preferredModuleWp", "preferredModuleMfrId", "preferredInverterMfrId", "mountingMaterial", "preferredConfiguration", "budgetRange", "monitoring", "selectedModuleId", "selectedInverterId", "selectedStructureId"],
    ENG_FIELDS.map((f) => `engineering.${f.key}`).concat("engineering.specificYieldSource"),
    [],
  ];

  function validateStep(i: number): boolean {
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    const relevant = Object.fromEntries(Object.entries(errs).filter(([k]) => i === 4 || STEP_FIELDS[i].includes(k)));
    setErrors(i === 4 ? errs : relevant);
    return Object.keys(i === 4 ? errs : relevant).length === 0;
  }

  async function submit() {
    if (!validateStep(4)) {
      const first = Object.keys(fieldErrors((parsed as { error: import("zod").ZodError }).error))[0];
      const idx = STEP_FIELDS.findIndex((s) => s.includes(first));
      if (idx >= 0) setStep(idx);
      return;
    }
    setBusy(true);
    setServerError(null);
    const res = await fetch(projectId ? `/api/projects/${projectId}` : "/api/projects", {
      method: projectId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toPayload(v, eng, meta, yieldSource)),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (j.errors) setErrors(j.errors);
      setServerError(j.error ?? "Please correct the highlighted fields.");
      return;
    }
    window.location.href = `/projects/${j.id}`;
  }

  // ---- field helpers ----
  const err = (k: string) => errors[k];
  const describedBy = (k: string, hint?: string) => [err(k) ? `${k}-err` : null, hint ? `${k}-hint` : null].filter(Boolean).join(" ") || undefined;

  function Field({ k, label, required, hint, children, allowTbc = true }: { k: string; label: React.ReactNode; required?: boolean; hint?: string; children: (p: { id: string; disabled: boolean; className: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode; allowTbc?: boolean }) {
    const isTbc = !!tbc[k];
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={k} className="label">{label}{required && <span className="text-red-600"> *</span>}</label>
          {allowTbc && !required && (
            <label className="flex items-center gap-1 text-[11px] text-ink-muted">
              <input type="checkbox" className="h-3.5 w-3.5 accent-brand-700" checked={isTbc}
                onChange={(e) => { setTbc((t) => ({ ...t, [k]: e.target.checked })); if (e.target.checked) set(k, ""); }} />
              To be confirmed
            </label>
          )}
        </div>
        <div className="mt-1">{children({ id: k, disabled: isTbc, className: clsx("input", err(k) && "input-error"), "aria-invalid": !!err(k), "aria-describedby": describedBy(k, hint) })}</div>
        {isTbc && <p className="hint">{TBC}</p>}
        {hint && !isTbc && <p id={`${k}-hint`} className="hint">{hint}</p>}
        {err(k) && <p id={`${k}-err`} className="mt-1 text-xs text-red-700">{err(k)}</p>}
      </div>
    );
  }
  const text = (k: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (p: Parameters<Parameters<typeof Field>[0]["children"]>[0]) => (
    <input {...p} {...props} value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
  );
  const select = (k: string, opts: [string, string][], placeholder = "Select…") => (p: Parameters<Parameters<typeof Field>[0]["children"]>[0]) => (
    <select {...p} value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)}>
      <option value="">{placeholder}</option>
      {opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
    </select>
  );

  const errorCount = parsed.success ? 0 : parsed.error.issues.length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <ol className="flex flex-wrap gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => (i < step || validateStep(step)) && setStep(i)} aria-current={i === step ? "step" : undefined}
                className={clsx("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", i === step ? "border-brand-700 bg-brand-800 text-white" : i < step ? "border-brand-200 bg-brand-50 text-brand-800" : "border-slate-200 text-ink-muted")}>
                <span className="font-semibold">{i + 1}</span><span className="hidden sm:inline">{s}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-2 h-1 rounded bg-slate-100" aria-hidden><div className="h-1 rounded bg-solar-400 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>

        <form className="card mt-6 p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); if (step < 4) { if (validateStep(step)) setStep(step + 1); } else submit(); }} noValidate>
          <h2 className="text-lg">{STEPS[step]}</h2>
          {step === 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{Field({ k: "name", label: "Project name", required: true, allowTbc: false, children: text("name", { autoComplete: "off" }) })}</div>
              {Field({ k: "location", label: "Installation location", hint: "Area / locality in Bengaluru", children: text("location") })}
              {Field({ k: "customerType", label: "Customer type", children: select("customerType", [["RESIDENTIAL", "Residential"], ["APARTMENT", "Apartment"], ["COMMERCIAL", "Commercial"], ["INDUSTRIAL", "Industrial"]]) })}
              {Field({ k: "targetCapacityKwp", label: <Term k="kwp">Target capacity (kWp)</Term>, hint: "DC capacity. Required to generate the BOM.", children: text("targetCapacityKwp", { inputMode: "decimal" }) })}
              {Field({ k: "roofType", label: "Roof type", children: select("roofType", [["RCC_FLAT", "RCC flat roof"], ["METAL_SHEET", "Metal-sheet roof"], ["SLOPED", "Sloped roof"]]) })}
              {Field({ k: "roofAreaM2", label: "Available roof area (m²)", children: text("roofAreaM2", { inputMode: "decimal" }) })}
              {Field({ k: "isExpansion", label: "Installation", children: select("isExpansion", [["false", "New installation"], ["true", "Expansion of an existing system"]]) })}
              <fieldset className="sm:col-span-2 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <legend className="sr-only">Contact (optional)</legend>
                {Field({ k: "customerName", label: "Contact name", allowTbc: false, children: text("customerName", { autoComplete: "name" }) })}
                {Field({ k: "customerEmail", label: "Email", allowTbc: false, children: text("customerEmail", { type: "email", autoComplete: "email" }) })}
                {Field({ k: "customerPhone", label: "Phone", allowTbc: false, children: text("customerPhone", { type: "tel", autoComplete: "tel" }) })}
              </fieldset>
            </div>
          )}
          {step === 1 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Field({ k: "systemType", label: "Electrical configuration", children: select("systemType", [["GRID_TIED", "Grid-tied without battery"], ["HYBRID", "Hybrid with battery backup"], ["OFF_GRID", "Off-grid"]]) })}
              {Field({ k: "supplyPhase", label: "Supply", hint: "From the electricity bill or meter", children: select("supplyPhase", [["SINGLE", "Single-phase"], ["THREE", "Three-phase"]]) })}
              {Field({ k: "sanctionedLoad", label: <Term k="sanctioned">Existing sanctioned load</Term>, children: text("sanctionedLoad", { inputMode: "decimal" }) })}
              {Field({ k: "sanctionedLoadUnit", label: "Sanctioned load unit", children: select("sanctionedLoadUnit", [["kW", "kW"], ["kVA", "kVA"]]) })}
              <div className="sm:col-span-2">{Field({ k: "exportArrangement", label: <Term k="netmetering">Metering / export arrangement</Term>, children: select("exportArrangement", [["NET_METERING", "Net metering"], ["OTHER_APPROVED", "Other approved export arrangement"], ["EXPORT_LIMITED", "Export-limited configuration"]]) })}</div>
              <p className="sm:col-span-2 text-xs text-ink-muted">Eligibility for each arrangement depends on current KERC/BESCOM rules and is confirmed during the application.</p>
            </div>
          )}
          {step === 2 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Field({ k: "preferredModuleWp", label: "Preferred module wattage (Wp)", children: select("preferredModuleWp", options.moduleWattages.map((w) => [String(w), `${w} Wp`]), "No preference") })}
              {Field({ k: "preferredModuleMfrId", label: "Preferred module manufacturer", children: select("preferredModuleMfrId", options.moduleManufacturers.map((m) => [m.id, m.name]), "No preference") })}
              {Field({ k: "preferredInverterMfrId", label: "Preferred inverter manufacturer", children: select("preferredInverterMfrId", options.inverterManufacturers.map((m) => [m.id, m.name]), "No preference") })}
              {Field({ k: "mountingMaterial", label: "Mounting structure material", children: select("mountingMaterial", [["Aluminium", "Aluminium"], ["Galvanised steel", "Hot-dip galvanised steel"]], "No preference") })}
              {Field({ k: "preferredConfiguration", label: "Preferred system configuration", hint: "e.g. elevated structure for terrace use, east-west layout", children: text("preferredConfiguration") })}
              {Field({ k: "budgetRange", label: "Budget range", children: select("budgetRange", [["< ₹3 lakh", "Under ₹3 lakh"], ["₹3–10 lakh", "₹3–10 lakh"], ["₹10–50 lakh", "₹10–50 lakh"], ["> ₹50 lakh", "Over ₹50 lakh"]], "Not specified") })}
              {Field({ k: "monitoring", label: "Monitoring requirements", children: select("monitoring", [["NONE", "No monitoring"], ["BASIC_APP", "Basic app monitoring"], ["ADVANCED", "Advanced / multi-inverter monitoring"]]) })}
              <details className="sm:col-span-2 rounded-md border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">Select specific catalogue items (optional)</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  {Field({ k: "selectedModuleId", label: "Module", allowTbc: false, children: select("selectedModuleId", options.modules.map((m) => [m.id, m.label]), "Auto-select") })}
                  {Field({ k: "selectedInverterId", label: "Inverter", allowTbc: false, children: select("selectedInverterId", options.inverters.map((m) => [m.id, m.label]), "Auto-select compatible") })}
                  {Field({ k: "selectedStructureId", label: "Structure", allowTbc: false, children: select("selectedStructureId", options.structures.map((m) => [m.id, m.label]), "Auto-select") })}
                </div>
              </details>
            </div>
          )}
          {step === 3 && (
            <div className="mt-4">
              <p className="text-sm text-ink-muted">Optional. Fill in what is known from the site survey or engineering design. Leave the rest blank — the BOM marks those lines <em>To be confirmed</em>. Set each value&apos;s source so quantities are labelled correctly.</p>
              <div className="mt-4 divide-y divide-slate-100">
                {ENG_FIELDS.map((f) => {
                  const k = `engineering.${f.key}`;
                  return (
                    <div key={f.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_140px_170px] sm:items-start">
                      <div>
                        <label htmlFor={k} className="label">{f.label}{f.unit && <span className="font-normal text-ink-muted"> ({f.unit})</span>}</label>
                        {f.hint && <p className="hint">{f.hint}</p>}
                        {err(k) && <p className="mt-1 text-xs text-red-700">{err(k)}</p>}
                      </div>
                      {f.kind === "select" ? (
                        <select id={k} className="input" value={eng[f.key] ?? ""} onChange={(e) => setEng((s) => ({ ...s, [f.key]: e.target.value }))}>
                          {f.options!.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
                        </select>
                      ) : (
                        <input id={k} className={clsx("input", err(k) && "input-error")} inputMode="decimal" value={eng[f.key] ?? ""} placeholder="TBC"
                          aria-invalid={!!err(k)} onChange={(e) => setEng((s) => ({ ...s, [f.key]: e.target.value }))} />
                      )}
                      {f.kind !== "select" ? (
                        <select aria-label={`Source of ${f.label}`} className="input" value={meta[f.key] ?? "ESTIMATED"} disabled={!eng[f.key]}
                          onChange={(e) => setMeta((s) => ({ ...s, [f.key]: e.target.value }))}>
                          <option value="ESTIMATED">Provisional estimate</option>
                          <option value="MEASURED">Measured on site</option>
                          {canSetVerified && <option value="ENGINEER_VERIFIED">Engineer-verified</option>}
                        </select>
                      ) : <span />}
                      {f.key === "specificYieldKwhPerKwpYr" && (
                        <div className="sm:col-span-3">
                          <label htmlFor="engineering.specificYieldSource" className="label">Source of specific yield</label>
                          <input id="engineering.specificYieldSource" className={clsx("input mt-1", err("engineering.specificYieldSource") && "input-error")} value={yieldSource} onChange={(e) => setYieldSource(e.target.value)} placeholder="e.g. site simulation report ref., date" />
                          {err("engineering.specificYieldSource") && <p className="mt-1 text-xs text-red-700">{err("engineering.specificYieldSource")}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {step === 4 && (
            <Review v={v} eng={eng} options={options} errors={errors} />
          )}

          {serverError && <p role="alert" className="mt-4 text-sm text-red-700">{serverError}</p>}
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            <div className="flex gap-2">
              {step < 3 && <button type="button" className="btn-ghost" onClick={() => validateStep(step) && setStep(4)}>Skip to review</button>}
              <button type="submit" className="btn-primary" disabled={busy}>{step < 4 ? "Continue" : busy ? "Generating…" : projectId ? "Save and regenerate BOM" : "Save project and generate BOM"}</button>
            </div>
          </div>
        </form>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start" aria-live="polite">
        <div className="card p-4">
          <p className="eyebrow">Live preview</p>
          {!preview || preview.summary.moduleCount == null ? (
            <p className="mt-2 text-sm text-ink-muted">{errorCount > 0 && v.name ? "Fix the highlighted inputs to see a preview." : "Enter a target capacity to preview module count and inverter compatibility."}</p>
          ) : (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-ink-muted">Modules</dt><dd className="num">{preview.summary.moduleCount} × {preview.summary.moduleWp} Wp</dd>
              {preview.summary.formulaModuleCount !== preview.summary.moduleCount && <><dt className="text-ink-muted">Formula count</dt><dd className="num">{preview.summary.formulaModuleCount}</dd></>}
              <dt className="text-ink-muted">Installed DC</dt><dd className="num">{((preview.summary.installedDcW ?? 0) / 1000).toFixed(2)} kWp</dd>
              <dt className="text-ink-muted">Inverter</dt><dd className="num">{preview.summary.inverterAcW ? `${preview.summary.inverterAcW / 1000} kW AC` : "None compatible"}</dd>
              <dt className="text-ink-muted"><Term k="dcac">DC/AC</Term></dt><dd className="num">{preview.summary.dcAcRatio ?? "—"}</dd>
              <dt className="text-ink-muted"><Term k="string">Strings</Term></dt><dd className="num">{preview.summary.stringLayout?.modulesPerString.join(" + ") ?? "—"}</dd>
              <dt className="text-ink-muted">Roof area est.</dt><dd className="num">{preview.summary.estimatedRoofAreaM2 ?? "—"} m²</dd>
            </dl>
          )}
          {preview && preview.checks.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              {preview.checks.slice(0, 6).map((c) => (
                <li key={c.key} className={c.severity === "error" ? "text-red-700" : c.severity === "warning" ? "text-solar-700" : "text-ink-muted"}>
                  <strong className="font-semibold">{c.severity === "error" ? "Error" : c.severity === "warning" ? "Warning" : "Note"}:</strong> {c.message}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-ink-muted">Preliminary — the saved BOM is generated server-side with the current catalogue and rules, and is subject to engineering verification.</p>
        </div>
      </aside>
    </div>
  );
}

function Review({ v, eng, options, errors }: { v: FormValues; eng: EngValues; options: ConfiguratorOptions; errors: Record<string, string> }) {
  const show = (val: string | undefined, map?: Record<string, string>) => (val ? (map?.[val] ?? val) : <span className="text-ink-faint italic">{TBC}</span>);
  const mfr = (id?: string) => [...options.moduleManufacturers, ...options.inverterManufacturers].find((m) => m.id === id)?.name;
  const rows: [string, React.ReactNode][] = [
    ["Project name", v.name || <span className="text-red-700">Required</span>],
    ["Location", show(v.location)], ["Customer type", show(v.customerType, { RESIDENTIAL: "Residential", APARTMENT: "Apartment", COMMERCIAL: "Commercial", INDUSTRIAL: "Industrial" })],
    ["Target capacity", v.targetCapacityKwp ? `${v.targetCapacityKwp} kWp` : show("")], ["Roof type", show(v.roofType, { RCC_FLAT: "RCC flat roof", METAL_SHEET: "Metal-sheet roof", SLOPED: "Sloped roof" })],
    ["Roof area", v.roofAreaM2 ? `${v.roofAreaM2} m²` : show("")], ["Installation", show(v.isExpansion, { false: "New installation", true: "Expansion" })],
    ["Configuration", show(v.systemType, { GRID_TIED: "Grid-tied without battery", HYBRID: "Hybrid with battery", OFF_GRID: "Off-grid" })],
    ["Supply", show(v.supplyPhase, { SINGLE: "Single-phase", THREE: "Three-phase" })],
    ["Sanctioned load", v.sanctionedLoad ? `${v.sanctionedLoad} ${v.sanctionedLoadUnit ?? ""}` : show("")],
    ["Export arrangement", show(v.exportArrangement, { NET_METERING: "Net metering", OTHER_APPROVED: "Other approved", EXPORT_LIMITED: "Export-limited" })],
    ["Module preference", [v.preferredModuleWp && `${v.preferredModuleWp} Wp`, mfr(v.preferredModuleMfrId)].filter(Boolean).join(", ") || "No preference"],
    ["Inverter preference", mfr(v.preferredInverterMfrId) ?? "No preference"],
    ["Mounting material", v.mountingMaterial || "No preference"], ["Monitoring", show(v.monitoring, { NONE: "None", BASIC_APP: "Basic app", ADVANCED: "Advanced" })],
    ["Engineering inputs entered", `${Object.values(eng).filter(Boolean).length} of ${ENG_FIELDS.length}`],
  ];
  return (
    <div className="mt-4">
      {Object.keys(errors).length > 0 && <p role="alert" className="mb-3 text-sm text-red-700">Some inputs need attention: {Object.values(errors).join(" ")}</p>}
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, val]) => <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1"><dt className="text-ink-muted">{k}</dt><dd className="text-right">{val}</dd></div>)}
      </dl>
      <p className="mt-4 text-xs text-ink-muted">Saving creates the project, generates a preliminary BOM and a compliance checklist with every item pending verification.</p>
    </div>
  );
}
