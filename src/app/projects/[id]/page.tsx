import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadProjectOr404 } from "@/lib/server/access";
import { bomPricing, engineSnapshot, loadBom } from "@/lib/server/bom";
import { sectionLabel } from "@/lib/engine";
import { HBarChart } from "@/components/project/SummaryCharts";
import { Alert, PreliminaryNotice } from "@/components/ui/Alert";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { Term } from "@/components/ui/Term";
import { EXPORT_LABEL, PHASE_LABEL, ROOF_LABEL, SYSTEM_LABEL, VERIFICATION_LABEL, formatINR, formatNum } from "@/lib/format";

export default async function ProjectSummary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project } = await loadProjectOr404(id);
  const bom = await loadBom(prisma, id);
  const calc = bom ? engineSnapshot(bom) : null;
  const pricing = bom ? bomPricing(bom) : null;
  const compliance = await prisma.projectComplianceItem.groupBy({ by: ["status"], where: { projectId: id }, _count: true });
  const s = calc?.summary;
  const d = project.designInputs;
  const errors = calc?.checks.filter((c) => c.severity === "error") ?? [];
  const warnings = calc?.checks.filter((c) => c.severity !== "error") ?? [];
  const active = bom?.items.filter((i) => !i.removed) ?? [];

  const costData = pricing ? Object.entries(pricing.bySection).map(([k, v]) => ({ label: sectionLabel(k), value: v.subtotal })).sort((a, b) => b.value - a.value) : [];
  const lineCounts = new Map<string, number>();
  for (const i of active) lineCounts.set(i.section, (lineCounts.get(i.section) ?? 0) + 1);
  const lineData = [...lineCounts.entries()].map(([k, v]) => ({ label: sectionLabel(k), value: v }));
  const tbc = active.filter((i) => i.quantityStatus === "TO_BE_CONFIRMED").length;
  const est = active.filter((i) => i.quantityStatus === "ESTIMATED").length;

  const tile = (label: React.ReactNode, value: React.ReactNode, sub?: React.ReactNode) => (
    <div className="card p-4"><p className="text-xs text-ink-muted">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>{sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}</div>
  );

  return (
    <div className="space-y-6">
      <PreliminaryNotice compact />
      {errors.length > 0 && (
        <Alert tone="error" title={`${errors.length} configuration issue${errors.length > 1 ? "s" : ""} to resolve`}>
          <ul className="list-disc pl-5">{errors.map((c) => <li key={c.key}>{c.message}</li>)}</ul>
        </Alert>
      )}

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile(<>Target DC capacity</>, d?.targetCapacityKwp != null ? `${Number(d.targetCapacityKwp)} kWp` : "TBC")}
        {tile(<>Installed DC capacity</>, s?.installedDcW != null ? `${formatNum(s.installedDcW / 1000)} kWp` : "—", s?.moduleCount != null ? `${s.moduleCount} × ${s.moduleWp} Wp${s.formulaModuleCount !== s.moduleCount ? ` (formula: ${s.formulaModuleCount})` : ""}` : undefined)}
        {tile(<>Inverter AC capacity</>, s?.inverterAcW ? `${s.inverterAcW / 1000} kW` : "—", s?.selectedInverter ?? "No compatible inverter")}
        {tile(<Term k="dcac" />, s?.dcAcRatio ?? "—")}
        {tile(<>Module count</>, s?.moduleCount ?? "—", s?.stringLayout ? `Strings: ${s.stringLayout.modulesPerString.join(" + ")}` : undefined)}
        {tile(<>Estimated roof area</>, s?.estimatedRoofAreaM2 != null ? `${s.estimatedRoofAreaM2} m²` : "—", d?.roofAreaM2 != null ? `Available: ${Number(d.roofAreaM2)} m²` : "Available area TBC")}
        {tile(<>Estimated project cost</>, pricing && pricing.subtotalExGst > 0 ? formatINR(pricing.grandTotal) : "Not priced", pricing ? (pricing.unpricedLines ? `${pricing.unpricedLines} line(s) without a price; ${pricing.untaxedLines} without GST rate` : pricing.untaxedLines ? `${pricing.untaxedLines} line(s) without GST rate` : "All lines priced and taxed") : undefined)}
        {tile(<>Quantity status</>, `${active.length - est - tbc}/${active.length}`, `calculated or verified · ${est} estimated · ${tbc} to be confirmed`)}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="section-title">Cost breakdown by category</h2>
          <p className="text-xs text-ink-muted">Excluding GST. Only priced lines are included.</p>
          <HBarChart data={costData} title="Subtotal (excl. GST)" valueKind="inr" emptyText="No prices entered yet. Add supplier-quoted unit prices in the BOM to see the cost distribution." />
        </section>
        <section className="card p-5">
          <h2 className="section-title">Equipment by BOM section</h2>
          <p className="text-xs text-ink-muted">Number of active BOM lines per section.</p>
          <HBarChart data={lineData} title="BOM lines" valueKind="count" emptyText="No BOM lines yet." />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-1">
          <h2 className="section-title">Major equipment</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-ink-muted">PV modules</dt><dd>{s?.selectedModule ?? "—"}</dd></div>
            <div><dt className="text-ink-muted">Inverter</dt><dd>{s?.selectedInverter ?? "—"}</dd></div>
            <div><dt className="text-ink-muted">Mounting structure</dt><dd>{s?.selectedStructure ?? "—"}</dd></div>
            <div><dt className="text-ink-muted">DC cable (preliminary)</dt><dd>{s?.dcCable ? `${s.dcCable.csaMm2} mm², Vd ${s.dcCable.voltageDropPct}%` : "TBC"}</dd></div>
            <div><dt className="text-ink-muted">AC cable (preliminary)</dt><dd>{s?.acCable ? `${s.acCable.csaMm2} mm², Vd ${s.acCable.voltageDropPct}%` : "TBC"}</dd></div>
          </dl>
          <h3 className="mt-5 text-sm font-semibold">Configuration</h3>
          <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
            <dt className="text-ink-muted">Roof</dt><dd>{d?.roofType ? ROOF_LABEL[d.roofType] : "TBC"}</dd>
            <dt className="text-ink-muted">System</dt><dd>{d?.systemType ? SYSTEM_LABEL[d.systemType] : "TBC"}</dd>
            <dt className="text-ink-muted">Supply</dt><dd>{d?.supplyPhase ? PHASE_LABEL[d.supplyPhase] : "TBC"}</dd>
            <dt className="text-ink-muted">Export</dt><dd>{d?.exportArrangement ? EXPORT_LABEL[d.exportArrangement] : "TBC"}</dd>
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="section-title">Estimated annual generation</h2>
          {s?.annualGeneration ? (
            <>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{s.annualGeneration.kwh.toLocaleString("en-IN")} kWh/yr</p>
              <p className="mt-1 text-xs text-ink-muted">{s.annualGeneration.basis}</p>
              <p className="mt-2 text-xs font-medium text-solar-700">Indicative only. Generation, savings and payback are not guaranteed.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">Not estimated. {s?.annualGenerationUnavailableReason}</p>
          )}
          <h2 className="section-title mt-6">Compliance and approvals</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {compliance.map((c) => <li key={c.status} className="flex justify-between"><VerificationBadge status={c.status} /><span className="tabular-nums">{c._count}</span></li>)}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">Selecting certified products does not make the project compliant. <Link href={`/projects/${id}/compliance`}>Open checklist</Link>.</p>
          <p className="mt-1 text-xs text-ink-muted">BESCOM approval: <strong>not obtained</strong> unless recorded as verified in the checklist.</p>
        </section>
        <section className="card p-5">
          <h2 className="section-title">Outstanding engineering checks</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(calc?.outstanding ?? []).map((o) => <li key={o}>{o}</li>)}</ul>
          {warnings.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold">Warnings and notes</h3>
              <ul className="mt-1 space-y-1 text-xs">{warnings.map((w) => <li key={w.key}><Badge tone={w.severity === "warning" ? "yellow" : "blue"}>{w.severity}</Badge> {w.message}</li>)}</ul>
            </>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="section-title">Key design assumptions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table-tech table-compact">
            <thead><tr><th>Assumption</th><th>Value</th><th>Source</th></tr></thead>
            <tbody>{(calc?.assumptions ?? []).map((a) => <tr key={a.key}><td>{a.label}</td><td className="tabular-nums">{a.value}</td><td className="text-xs text-ink-muted">{a.source}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {calc && calc.inverterEvaluations.length > 0 && (
        <section className="card p-5">
          <h2 className="section-title">Module–inverter compatibility</h2>
          <p className="text-xs text-ink-muted">Every catalogue inverter evaluated against this array with the configured rules.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="table-tech table-compact">
              <thead><tr><th>Inverter</th><th className="num">AC kW</th><th className="num">DC/AC</th><th>Strings</th><th className="num"><Term k="voc">Voc (cold)</Term></th><th>Result</th></tr></thead>
              <tbody>
                {calc.inverterEvaluations.map((e) => (
                  <tr key={e.inverterId}>
                    <td>{e.label}{e.label === s?.selectedInverter && <Badge tone="green" className="ml-1">Selected</Badge>}</td>
                    <td className="num">{e.ratedAcW / 1000}</td>
                    <td className="num">{e.dcAcRatio ?? "—"}</td>
                    <td>{e.layout?.modulesPerString.join(" + ") ?? "—"}</td>
                    <td className="num">{e.layout ? `${e.layout.vocAtMinTempV} V` : "—"}</td>
                    <td>{e.compatible ? <Badge tone="green">Compatible</Badge> : <><Badge tone="red">Incompatible</Badge><ul className="mt-1 text-xs text-ink-muted">{e.issues.filter((i) => i.severity === "error").map((i) => <li key={i.key}>{i.message}</li>)}</ul></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="text-xs text-ink-muted">Compliance statuses: {Object.values(VERIFICATION_LABEL).join(" · ")}.</p>
    </div>
  );
}
