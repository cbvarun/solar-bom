"use client";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { BOM_SECTIONS, type Check, type PricingResult } from "@/lib/engine";
import type { BomItemDTO } from "@/lib/server/serialize";
import { AvailabilityBadge, Badge, QuantityStatusBadge, VerificationBadge } from "@/components/ui/Badge";
import { AVAILABILITY_LABEL, PROVENANCE_LABEL, QUANTITY_STATUS_LABEL, VERIFICATION_LABEL, formatINR, formatNum } from "@/lib/format";
import { Term } from "@/components/ui/Term";

interface ProductOpt { id: string; sku: string; name: string; category: string; categorySlug: string; section: string; manufacturer: string; unit: string }
interface CostItem { label: string; amount: number | null; gstRatePercent: number | null; notes: string | null }

const sectionLabel = (k: string) => BOM_SECTIONS.find((s) => s.key === k)?.label ?? k;

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? (j.errors ? Object.values(j.errors).join(" ") : "Request failed"));
  return j;
}

export function BomEditor(props: {
  projectId: string;
  readOnly: boolean;
  items: BomItemDTO[];
  pricing: PricingResult;
  header: { status: string; revision: number; pricesIncludeGst: boolean };
  costItems: CostItem[];
  checks: Check[];
  products: ProductOpt[];
  permissions: { verify: boolean; price: boolean; staff: boolean };
}) {
  const { projectId, readOnly, items, pricing, header, permissions } = props;
  const router = useRouter();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [f, setF] = useState({ section: "", manufacturer: "", compliance: "", availability: "", qstatus: "", removed: false, q: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [showCosts, setShowCosts] = useState(false);

  const priced = useMemo(() => new Map(pricing.lines.map((l) => [l.id, l])), [pricing]);
  const manufacturers = useMemo(() => [...new Set(items.map((i) => i.manufacturer).filter(Boolean))] as string[], [items]);

  const visible = items.filter((i) =>
    (f.removed || !i.removed) &&
    (!f.section || i.section === f.section) &&
    (!f.manufacturer || i.manufacturer === f.manufacturer) &&
    (!f.compliance || i.complianceStatus === f.compliance) &&
    (!f.availability || i.availability === f.availability) &&
    (!f.qstatus || i.quantityStatus === f.qstatus) &&
    (!f.q || `${i.name} ${i.itemCode} ${i.specification ?? ""}`.toLowerCase().includes(f.q.toLowerCase())),
  );
  const grouped = BOM_SECTIONS.map((s) => ({ ...s, rows: visible.filter((i) => i.section === s.key) })).filter((g) => g.rows.length);

  async function run(label: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(label);
    setFlash(null);
    try {
      await fn();
      setFlash({ ok: true, text: ok });
      router.refresh();
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }
  const patch = (id: string, body: Record<string, unknown>) => run(`patch-${id}`, () => api(`/api/projects/${projectId}/bom/items/${id}`, "PATCH", body), "Saved. Change recorded in the audit trail.");

  const cols = 14;
  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-muted">
          Revision <strong className="text-ink">{header.revision}</strong> · status <strong className="text-ink">{header.status.toLowerCase()}</strong> ·
          prices <strong className="text-ink">{header.pricesIncludeGst ? "include" : "exclude"} GST</strong>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm" disabled={!!busy} onClick={() => run("regen", () => api(`/api/projects/${projectId}/bom/regenerate`, "POST"), "Recalculated. Your procurement overrides, prices and manual lines were kept.")}>
              {busy === "regen" ? "Recalculating…" : "Recalculate from configuration"}
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setShowAdd((v) => !v)}>Add line</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowCosts((v) => !v)}>Pricing & other costs</button>
            <button className="btn-secondary btn-sm" disabled={!!busy} onClick={() => {
              const summary = window.prompt("Describe the changes in this revision");
              if (summary) run("rev", () => api(`/api/projects/${projectId}/bom/revisions`, "POST", { summary }), "Revision saved.");
            }}>Save revision</button>
            <button className="btn-primary btn-sm" disabled={!!busy || header.status === "SUBMITTED"} onClick={() => run("submit", () => api(`/api/projects/${projectId}/bom/submit`, "POST"), "Submitted for engineering review.")}>
              Submit for engineering review
            </button>
          </div>
        )}
      </div>
      {flash && <p role="status" className={clsx("mt-3 rounded-md px-3 py-2 text-sm", flash.ok ? "bg-brand-50 text-brand-900" : "bg-red-50 text-red-800")}>{flash.text}</p>}

      {props.checks.filter((c) => c.severity === "error").length > 0 && (
        <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Incompatible or incomplete configuration</p>
          <ul className="mt-1 list-disc pl-5">{props.checks.filter((c) => c.severity === "error").map((c) => <li key={c.key}>{c.message}</li>)}</ul>
        </div>
      )}

      {showAdd && !readOnly && <AddLine projectId={projectId} products={props.products} onDone={() => { setShowAdd(false); router.refresh(); }} />}
      {showCosts && !readOnly && <CostsEditor projectId={projectId} initial={props.costItems} pricesIncludeGst={header.pricesIncludeGst} canSetGst={permissions.staff} onDone={() => { setShowCosts(false); router.refresh(); }} />}

      {/* Filters */}
      <form className="mt-4 grid gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3 lg:grid-cols-7" onSubmit={(e) => e.preventDefault()} aria-label="BOM filters">
        <input className="input" placeholder="Search lines" aria-label="Search lines" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className="input" aria-label="Component category" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
          <option value="">All categories</option>{BOM_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="input" aria-label="Manufacturer" value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })}>
          <option value="">All manufacturers</option>{manufacturers.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className="input" aria-label="Compliance status" value={f.compliance} onChange={(e) => setF({ ...f, compliance: e.target.value })}>
          <option value="">Any compliance status</option>{Object.entries(VERIFICATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" aria-label="Availability" value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })}>
          <option value="">Any availability</option>{Object.entries(AVAILABILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" aria-label="Quantity status" value={f.qstatus} onChange={(e) => setF({ ...f, qstatus: e.target.value })}>
          <option value="">Any quantity status</option>{Object.entries(QUANTITY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.removed} onChange={(e) => setF({ ...f, removed: e.target.checked })} /> Show removed</label>
      </form>

      {/* Table */}
      <div className="card mt-4 overflow-x-auto">
        <table className="table-tech table-compact min-w-[1400px] text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-6"><span className="sr-only">Details</span></th>
              <th>Item code</th><th>Component / specification</th><th>Unit</th>
              <th className="num">Calc. qty</th><th className="num">Procurement qty</th><th>Qty status</th>
              <th>Manufacturer / model</th><th className="num">Unit price ₹</th><th className="num">Subtotal</th>
              <th className="num"><Term k="gst">GST</Term></th><th className="num">Total</th><th>Availability</th><th>Compliance / notes</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && <tr><td colSpan={cols} className="py-8 text-center text-ink-muted">No lines match these filters.</td></tr>}
            {grouped.map((g) => (
              <Fragment key={g.key}>
                <tr className="bg-brand-50/70"><td colSpan={cols} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-900">{BOM_SECTIONS.findIndex((s) => s.key === g.key) + 1}. {g.label} <span className="font-normal normal-case text-ink-muted">({g.rows.length})</span></td></tr>
                {g.rows.map((i) => {
                  const p = priced.get(i.id);
                  const open = expanded === i.id;
                  return (
                    <Fragment key={i.id}>
                      <tr className={clsx(i.removed && "opacity-50 line-through decoration-slate-400", open && "bg-slate-50")}>
                        <td>
                          <button className="text-ink-muted hover:text-ink" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} details for ${i.name}`} onClick={() => setExpanded(open ? null : i.id)}>{open ? "▾" : "▸"}</button>
                        </td>
                        <td className="whitespace-nowrap font-mono text-[11px]">{i.itemCode}{i.isManual && <Badge className="ml-1" tone="purple">manual</Badge>}</td>
                        <td className="min-w-[260px]"><p className="font-medium">{i.name}</p><p className="text-xs text-ink-muted">{i.specification}</p></td>
                        <td>{i.unit}</td>
                        <td className="num" title={i.quantityBasis ?? undefined}>{i.calculatedQty == null ? <span className="text-ink-faint">TBC</span> : formatNum(i.calculatedQty)}</td>
                        <td className="num">
                          <NumCell key={`q-${i.procurementQty}`} disabled={readOnly || i.removed} value={i.procurementQty} label={`Procurement quantity for ${i.name}`} highlight={i.procurementQty !== i.calculatedQty}
                            onCommit={(v) => patch(i.id, { procurementQty: v, reason: "Procurement quantity edited" })} />
                        </td>
                        <td><QuantityStatusBadge status={i.quantityStatus} /></td>
                        <td className="text-xs">{i.manufacturer ?? "—"}<br /><span className="font-mono text-ink-muted">{i.model ?? ""}</span></td>
                        <td className="num">
                          <NumCell key={`p-${i.unitPrice}`} disabled={readOnly || i.removed} value={i.unitPrice} label={`Unit price for ${i.name}`} onCommit={(v) => patch(i.id, { unitPrice: v, reason: "Unit price edited" })} />
                          {i.priceProvenance && <span className="block text-[10px] text-ink-muted">{PROVENANCE_LABEL[i.priceProvenance]}</span>}
                        </td>
                        <td className="num">{p?.subtotal != null ? formatINR(p.subtotal) : "—"}</td>
                        <td className="num">{i.gstRatePercent != null ? `${i.gstRatePercent}%` : <span className="text-[11px] text-ink-faint" title="GST rate not configured for this classification">not set</span>}<br /><span className="text-[11px] text-ink-muted">{p?.gst != null ? formatINR(p.gst) : ""}</span></td>
                        <td className="num font-medium">{p?.total != null ? formatINR(p.total) : "—"}</td>
                        <td><AvailabilityBadge status={i.availability} /></td>
                        <td className="min-w-[220px] text-[11px]">
                          <VerificationBadge status={i.complianceStatus} />
                          {i.complianceReq && <p className="mt-1 line-clamp-2 text-ink-muted" title={i.complianceReq}>{i.complianceReq}</p>}
                          {i.technicalNotes && <p className="mt-1 line-clamp-2" title={i.technicalNotes}><span className="font-semibold">Note:</span> {i.technicalNotes}</p>}
                          {i.supplierRemarks && <p className="mt-1 line-clamp-2" title={i.supplierRemarks}><span className="font-semibold">Supplier:</span> {i.supplierRemarks}</p>}
                        </td>
                      </tr>
                      {open && <LineDetails item={i} readOnly={readOnly} permissions={permissions} products={props.products} onPatch={(b) => patch(i.id, b)}
                        onRemove={(removed, reason) => run(`rm-${i.id}`, () => api(`/api/projects/${projectId}/bom/items/${i.id}/remove`, "POST", { removed, reason }), removed ? "Line removed (kept in history)." : "Line restored.")} cols={cols} />}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="text-xs text-ink-muted">
          <p>Line subtotal = procurement quantity × unit price. GST is calculated from each line&apos;s tax classification; lines without a configured rate show no GST rather than an assumed one.</p>
          <p className="mt-1">Hover a calculated quantity to see its basis, or open a line for the full assumption, compliance requirement and notes.</p>
        </div>
        <dl className="card grid grid-cols-2 gap-y-1 p-4 text-sm">
          <dt className="text-ink-muted">Equipment</dt><dd className="num">{formatINR(pricing.equipmentSubtotal)}</dd>
          <dt className="text-ink-muted">Services</dt><dd className="num">{formatINR(pricing.servicesSubtotal)}</dd>
          <dt className="text-ink-muted">Transport & other costs</dt><dd className="num">{formatINR(pricing.extrasSubtotal)}</dd>
          <dt className="border-t border-slate-100 pt-1 text-ink-muted">Subtotal (excl. GST)</dt><dd className="num border-t border-slate-100 pt-1">{formatINR(pricing.subtotalExGst)}</dd>
          <dt className="text-ink-muted">GST</dt><dd className="num">{formatINR(pricing.gstTotal)}</dd>
          <dt className="border-t border-slate-200 pt-1 font-semibold">Estimated total (incl. GST)</dt><dd className="num border-t border-slate-200 pt-1 font-semibold">{formatINR(pricing.grandTotal)}</dd>
          {!pricing.complete && <dd className="col-span-2 mt-2 text-xs text-solar-700">Incomplete: {pricing.unpricedLines} line(s) without a price, {pricing.untaxedLines} without a GST rate. The total covers priced lines only.</dd>}
        </dl>
      </div>
    </div>
  );
}

function NumCell({ value, onCommit, disabled, label, highlight }: { value: number | null; onCommit: (v: number | null) => void; disabled?: boolean; label: string; highlight?: boolean }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  const [err, setErr] = useState(false);
  const commit = () => {
    const t = v.trim();
    const n = t === "" ? null : Number(t);
    if (n != null && (!Number.isFinite(n) || n < 0)) { setErr(true); return; }
    setErr(false);
    if (n !== value) onCommit(n);
  };
  if (disabled) return <span>{value == null ? "—" : formatNum(value)}</span>;
  return (
    <input aria-label={label} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      aria-invalid={err} title={err ? "Enter a non-negative number" : undefined}
      className={clsx("w-24 rounded border px-1.5 py-1 text-right text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200", err ? "border-red-500" : highlight ? "border-solar-400 bg-solar-50" : "border-slate-300")} />
  );
}

function LineDetails({ item: i, readOnly, permissions, products, onPatch, onRemove, cols }: {
  item: BomItemDTO; readOnly: boolean; permissions: { verify: boolean; price: boolean; staff: boolean }; products: ProductOpt[];
  onPatch: (b: Record<string, unknown>) => void; onRemove: (removed: boolean, reason: string | null) => void; cols: number;
}) {
  const [notes, setNotes] = useState({ technicalNotes: i.technicalNotes ?? "", supplierRemarks: i.supplierRemarks ?? "", supplierName: i.supplierName ?? "", complianceReq: i.complianceReq ?? "", specification: i.specification ?? "" });
  const alternatives = products.filter((p) => p.section === i.section && p.id !== i.productId);
  return (
    <tr className="bg-slate-50">
      <td />
      <td colSpan={cols - 1} className="pb-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 text-xs">
            <p><span className="font-semibold">Quantity basis:</span> {i.quantityBasis ?? "—"}</p>
            <p><span className="font-semibold">Compliance requirement:</span> {i.complianceReq ?? "—"}</p>
            <p className="flex items-center gap-2"><span className="font-semibold">Compliance status:</span> <VerificationBadge status={i.complianceStatus} /></p>
            {i.productSku && <p><a href={`/catalogue/${encodeURIComponent(i.productSku)}`} target="_blank" rel="noreferrer">View catalogue item {i.productSku}</a></p>}
            {i.taxClassCode && <p><span className="font-semibold">Tax class:</span> {i.taxClassCode}</p>}
          </div>
          {!readOnly ? (
            <>
              <div className="space-y-2">
                {(["specification", "technicalNotes", "supplierRemarks", "supplierName", "complianceReq"] as const).map((k) => (
                  <div key={k}>
                    <label className="text-xs font-medium" htmlFor={`${i.id}-${k}`}>{({ specification: "Technical specification", technicalNotes: "Technical notes", supplierRemarks: "Supplier remarks", supplierName: "Supplier", complianceReq: "Compliance requirement" })[k]}</label>
                    <textarea id={`${i.id}-${k}`} rows={k === "supplierName" ? 1 : 2} className="input mt-0.5 text-xs" value={notes[k]} onChange={(e) => setNotes({ ...notes, [k]: e.target.value })}
                      onBlur={() => notes[k] !== (i[k] ?? "") && onPatch({ [k]: notes[k], reason: `${k} edited` })} />
                  </div>
                ))}
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium" htmlFor={`${i.id}-qs`}>Quantity status</label>
                  <select id={`${i.id}-qs`} className="input mt-0.5 text-xs" value={i.quantityStatus} onChange={(e) => onPatch({ quantityStatus: e.target.value, reason: "Quantity status changed" })}>
                    {Object.entries(QUANTITY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k} disabled={k === "ENGINEER_VERIFIED" && !permissions.verify}>{v}{k === "ENGINEER_VERIFIED" && !permissions.verify ? " (design engineer only)" : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-medium" htmlFor={`${i.id}-cs`}>Compliance status</label>
                  <select id={`${i.id}-cs`} className="input mt-0.5 text-xs" value={i.complianceStatus} onChange={(e) => onPatch({ complianceStatus: e.target.value })}>
                    {Object.entries(VERIFICATION_LABEL).map(([k, v]) => <option key={k} value={k} disabled={k === "VERIFIED" && !permissions.verify}>{v}</option>)}
                  </select>
                </div>
                {permissions.price && (
                  <div>
                    <label className="font-medium" htmlFor={`${i.id}-gst`}>GST rate % (override)</label>
                    <input id={`${i.id}-gst`} className="input mt-0.5 text-xs" inputMode="decimal" defaultValue={i.gstRatePercent ?? ""} onBlur={(e) => {
                      const v = e.target.value.trim() === "" ? null : Number(e.target.value);
                      if (v !== i.gstRatePercent) onPatch({ gstRatePercent: v, reason: "GST rate set" });
                    }} />
                  </div>
                )}
                <div>
                  <label className="font-medium" htmlFor={`${i.id}-av`}>Availability</label>
                  <select id={`${i.id}-av`} className="input mt-0.5 text-xs" value={i.availability} onChange={(e) => onPatch({ availability: e.target.value })}>
                    {Object.entries(AVAILABILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {alternatives.length > 0 && (
                  <div>
                    <label className="font-medium" htmlFor={`${i.id}-rep`}>Replace with</label>
                    <select id={`${i.id}-rep`} className="input mt-0.5 text-xs" defaultValue="" onChange={(e) => e.target.value && onPatch({ productId: e.target.value, reason: "Product replaced" })}>
                      <option value="">Choose a catalogue item…</option>
                      {alternatives.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                    </select>
                  </div>
                )}
                <button className={i.removed ? "btn-secondary btn-sm" : "btn-danger btn-sm"} onClick={() => {
                  const reason = window.prompt(i.removed ? "Reason for restoring this line" : "Reason for removing this line");
                  if (reason !== null) onRemove(!i.removed, reason || null);
                }}>{i.removed ? "Restore line" : "Remove line"}</button>
              </div>
            </>
          ) : (
            <div className="text-xs lg:col-span-2">
              <p><span className="font-semibold">Technical notes:</span> {i.technicalNotes ?? "—"}</p>
              <p><span className="font-semibold">Supplier remarks:</span> {i.supplierRemarks ?? "—"}</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddLine({ projectId, products, onDone }: { projectId: string; products: ProductOpt[]; onDone: () => void }) {
  const [mode, setMode] = useState<"catalogue" | "custom">("catalogue");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await api(`/api/projects/${projectId}/bom/items`, "POST", { ...fd, reason: fd.reason || "Manual line added" });
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="card mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" noValidate>
      <fieldset className="flex gap-4 text-sm sm:col-span-2 lg:col-span-4">
        <legend className="sr-only">Line source</legend>
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "catalogue"} onChange={() => setMode("catalogue")} /> From catalogue</label>
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "custom"} onChange={() => setMode("custom")} /> Custom item</label>
      </fieldset>
      {mode === "catalogue" ? (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="add-product">Catalogue item</label>
          <select id="add-product" name="productId" className="input mt-1" required>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
      ) : (
        <>
          <div><label className="label" htmlFor="add-name">Name</label><input id="add-name" name="name" className="input mt-1" required /></div>
          <div><label className="label" htmlFor="add-unit">Unit</label><input id="add-unit" name="unit" className="input mt-1" placeholder="nos, m, set, lot" required /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="add-spec">Specification</label><input id="add-spec" name="specification" className="input mt-1" /></div>
        </>
      )}
      <div>
        <label className="label" htmlFor="add-section">BOM section</label>
        <select id="add-section" name="section" className="input mt-1" defaultValue="CABLE_MGMT">{BOM_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
      </div>
      <div><label className="label" htmlFor="add-qty">Quantity</label><input id="add-qty" name="procurementQty" inputMode="decimal" className="input mt-1" /></div>
      <div><label className="label" htmlFor="add-price">Unit price ₹ (optional)</label><input id="add-price" name="unitPrice" inputMode="decimal" className="input mt-1" /></div>
      <div className="sm:col-span-2 lg:col-span-1"><label className="label" htmlFor="add-reason">Reason</label><input id="add-reason" name="reason" className="input mt-1" /></div>
      {err && <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">{err}</p>}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button className="btn-primary btn-sm">Add line</button><button type="button" className="btn-ghost btn-sm" onClick={onDone}>Cancel</button></div>
      <p className="text-xs text-ink-muted sm:col-span-2 lg:col-span-4">Section is taken from the product&apos;s category for catalogue items.</p>
    </form>
  );
}

function CostsEditor({ projectId, initial, pricesIncludeGst, canSetGst, onDone }: { projectId: string; initial: CostItem[]; pricesIncludeGst: boolean; canSetGst: boolean; onDone: () => void }) {
  const [rows, setRows] = useState<CostItem[]>(initial.length ? initial : [{ label: "Transport and logistics", amount: null, gstRatePercent: null, notes: null }]);
  const [incl, setIncl] = useState(pricesIncludeGst);
  const [err, setErr] = useState<string | null>(null);
  const upd = (i: number, k: keyof CostItem, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === "label" || k === "notes" ? v : v === "" ? null : Number(v) } : r)));
  async function save() {
    try {
      await api(`/api/projects/${projectId}/bom/costs`, "PUT", { pricesIncludeGst: incl, items: rows.filter((r) => r.label.trim()) });
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    }
  }
  return (
    <div className="card mt-4 p-4">
      <h3 className="text-sm font-semibold">Pricing basis and other project costs</h3>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={incl} onChange={(e) => setIncl(e.target.checked)} /> Unit prices entered in this BOM <strong>include</strong> GST</label>
      <table className="table-tech table-compact mt-3">
        <thead><tr><th>Cost item</th><th className="num">Amount ₹</th><th className="num">GST %</th><th>Notes</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input aria-label="Cost label" className="input" value={r.label} onChange={(e) => upd(i, "label", e.target.value)} /></td>
              <td><input aria-label="Amount" className="input text-right" inputMode="decimal" value={r.amount ?? ""} onChange={(e) => upd(i, "amount", e.target.value)} /></td>
              <td><input aria-label="GST rate" className="input text-right" inputMode="decimal" disabled={!canSetGst} value={r.gstRatePercent ?? ""} onChange={(e) => upd(i, "gstRatePercent", e.target.value)} /></td>
              <td><input aria-label="Notes" className="input" value={r.notes ?? ""} onChange={(e) => upd(i, "notes", e.target.value)} /></td>
              <td><button className="btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button className="btn-secondary btn-sm" onClick={() => setRows([...rows, { label: "", amount: null, gstRatePercent: null, notes: null }])}>Add cost item</button>
        <button className="btn-primary btn-sm" onClick={save}>Save</button>
        <button className="btn-ghost btn-sm" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
