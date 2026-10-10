import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadProjectOr404 } from "@/lib/server/access";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/server/permissions";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Area, Hidden, Select, opts } from "@/components/admin/Fields";
import { DocumentUpload } from "@/components/admin/DocumentUpload";
import { Alert } from "@/components/ui/Alert";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { refreshChecklist, updateComplianceItem } from "@/app/admin/actions";
import { formatDate, formatDateTime, VERIFICATION_LABEL } from "@/lib/format";

export default async function ProjectCompliance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project } = await loadProjectOr404(id);
  const session = await getSession();
  const canEdit = !!session && can(session.roles, "compliance.edit");
  const canUpload = !!session && can(session.roles, "documents.upload");
  const [items, projectDocs, bom] = await Promise.all([
    prisma.projectComplianceItem.findMany({ where: { projectId: id }, include: { template: { include: { standard: { include: { documents: true } } } }, evidence: true }, orderBy: { template: { sortOrder: "asc" } } }),
    prisma.complianceDocument.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } }),
    prisma.bOMHeader.findFirst({ where: { projectId: id }, include: { items: { where: { removed: false, productId: { not: null } }, include: { product: { include: { certifications: { include: { standard: true } } } } } } } }),
  ]);
  const counts = Object.fromEntries(Object.keys(VERIFICATION_LABEL).map((k) => [k, items.filter((i) => i.status === k).length]));
  const areas = [...new Set(items.map((i) => i.template.area))];
  const equipment = [...new Map((bom?.items ?? []).map((i) => [i.product!.id, i.product!])).values()];

  return (
    <div className="space-y-6">
      <Alert tone="warning" title="This checklist is not a compliance certificate">
        It tracks what engineering must confirm for this project in Bengaluru, Karnataka. Selecting certified equipment does not by itself make an installation compliant, and requirements from BIS, MNRE, CEA, BESCOM and KERC change over time; each item links to its official source.
        {project.isSample && " This sample project has not been submitted to BESCOM and holds no approvals."}
      </Alert>

      <section aria-label="Checklist summary" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Object.entries(VERIFICATION_LABEL).map(([k, label]) => (
          <div key={k} className="card p-3"><p className="text-xs text-ink-muted">{label}</p><p className="text-xl font-semibold">{counts[k]}</p></div>
        ))}
      </section>

      {canEdit && (
        <ActionForm action={refreshChecklist}><Hidden name="projectId" value={id} /><Submit variant="secondary">Add new template items to this checklist</Submit></ActionForm>
      )}

      {areas.map((area) => (
        <section key={area}>
          <h2 className="section-title">{area}</h2>
          <ul className="mt-3 space-y-3">
            {items.filter((i) => i.template.area === area).map((i) => {
              const evidenceOpts = [...projectDocs, ...(i.template.standard?.documents ?? [])].map((d) => ({ value: d.id, label: `${d.title}${d.revision ? ` (rev ${d.revision})` : ""}` }));
              return (
                <li key={i.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 max-w-3xl">
                      <p className="font-medium">{i.template.title}</p>
                      <p className="mt-1 text-sm text-ink-muted">{i.template.description}</p>
                      {i.template.standard && (
                        <p className="mt-1 text-xs">
                          Source: {i.template.standard.code} · {i.template.standard.title}
                          {i.template.standard.revision ? ` (rev ${i.template.standard.revision})` : " (revision not recorded)"}
                          {i.template.standard.officialUrl && <> · <a href={i.template.standard.officialUrl} target="_blank" rel="noopener noreferrer">official source ↗</a></>}
                          {i.template.standard.verificationStatus !== "VERIFIED" && <> · <Badge tone="yellow">source not yet verified</Badge></>}
                        </p>
                      )}
                    </div>
                    <VerificationBadge status={i.status} />
                  </div>
                  {(i.notes || i.evidence || i.reviewedBy) && (
                    <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs">
                      {i.notes && <p className="whitespace-pre-wrap">{i.notes}</p>}
                      {i.evidence && <p>Evidence: <a href={`/api/documents/${i.evidence.id}`}>{i.evidence.title}</a></p>}
                      {i.reviewedBy && <p className="text-ink-muted">{i.reviewedBy} · {formatDateTime(i.reviewedAt)}</p>}
                    </div>
                  )}
                  {canEdit && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-brand-800">Update status</summary>
                      <ActionForm action={updateComplianceItem} className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1.4fr_2fr_auto] lg:items-end">
                        <Hidden name="id" value={i.id} />
                        <Select label="Status" name="status" options={opts(VERIFICATION_LABEL)} defaultValue={i.status} />
                        <Select label="Evidence document" name="evidenceDocumentId" options={evidenceOpts} defaultValue={i.evidenceDocumentId} empty="None" />
                        <Area label="Notes / corrective action" name="notes" defaultValue={i.notes} rows={1} />
                        <Submit>Save</Submit>
                      </ActionForm>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {items.length === 0 && <p className="text-sm text-ink-muted">No checklist items. {canEdit ? "Use the button above to add the current template." : "Staff will set up the checklist."}</p>}

      <section>
        <h2 className="section-title">Equipment certifications on file</h2>
        <p className="mt-1 text-xs text-ink-muted">Certification records for the products in this BOM. These are inputs to the checklist above, not a substitute for it.</p>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200">
          <table className="table-tech table-compact">
            <thead><tr><th>Product</th><th>Certifications</th></tr></thead>
            <tbody>
              {equipment.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/catalogue/${p.sku}`}>{p.name}</Link>{p.illustrative && <span className="block text-xs text-solar-700">Illustrative template, not a real product</span>}</td>
                  <td className="text-xs">{p.certifications.length === 0 ? <span className="text-ink-muted">None recorded</span> : p.certifications.map((c) => (
                    <span key={c.id} className="mr-2 inline-flex items-center gap-1">{c.standard.code} <VerificationBadge status={c.verificationStatus} /></span>
                  ))}</td>
                </tr>
              ))}
              {equipment.length === 0 && <tr><td colSpan={2} className="text-ink-muted">No catalogue products in the BOM.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {(projectDocs.length > 0 || canUpload) && (
        <section>
          <h2 className="section-title">Project documents</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded border border-slate-200 text-sm">
            {projectDocs.map((d) => <li key={d.id} className="px-3 py-2"><Badge>{d.docType.toLowerCase()}</Badge> <a href={`/api/documents/${d.id}`}>{d.title}</a> <span className="text-xs text-ink-muted">· {formatDate(d.createdAt)}</span></li>)}
            {projectDocs.length === 0 && <li className="px-3 py-2 text-ink-muted">No project documents yet (site survey reports, structural certificates, utility correspondence).</li>}
          </ul>
          {canUpload && <DocumentUpload projectId={id} />}
        </section>
      )}
    </div>
  );
}
