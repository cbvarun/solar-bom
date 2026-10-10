import Link from "next/link";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead, Select, Hidden } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { updateEnquiry } from "../actions";
import { QuotePdfButton } from "@/components/exports/QuotePdfButton";
import { CUSTOMER_TYPE_LABEL, formatDateTime, formatINR } from "@/lib/format";

export default async function AdminEnquiries() {
  const { can } = await adminCtx();
  const [enquiries, quotes, users] = await Promise.all([
    prisma.enquiry.findMany({ include: { project: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.quotation.findMany({ include: { project: true }, omit: { snapshot: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const canManage = can("enquiries.manage");
  const userName = new Map(users.map((u) => [u.id, u.name]));
  return (
    <>
      <PageHead title="Enquiries & quotes">Website enquiries, product quote requests and BOM quotation requests. Email notification is not configured, so check this list for new requests.</PageHead>
      <section>
        <h2 className="section-title">Enquiries</h2>
        <ul className="mt-3 space-y-3">
          {enquiries.map((e) => (
            <li key={e.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{e.name}{e.company && ` · ${e.company}`} <Badge tone={e.status === "NEW" ? "yellow" : e.status === "CLOSED" ? "gray" : "blue"}>{e.status.toLowerCase().replace("_", " ")}</Badge> <Badge>{e.source}</Badge></p>
                  <p className="text-xs text-ink-muted">
                    <a href={`mailto:${e.email}`}>{e.email}</a>{e.phone && ` · ${e.phone}`}{e.location && ` · ${e.location}`}
                    {e.customerType && ` · ${CUSTOMER_TYPE_LABEL[e.customerType]}`}{e.capacityKwp && ` · ${Number(e.capacityKwp)} kWp`}{e.productSku && ` · product ${e.productSku}`}
                    {" · "}{formatDateTime(e.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{e.message}</p>
                  {e.project && <p className="mt-1 text-xs"><Link href={`/projects/${e.project.id}`}>{e.project.reference} · {e.project.name}</Link></p>}
                </div>
                {canManage ? (
                  <ActionForm action={updateEnquiry} className="flex flex-wrap items-end gap-2">
                    <Hidden name="id" value={e.id} />
                    <Select label="Status" name="status" defaultValue={e.status} options={[{ value: "NEW", label: "New" }, { value: "IN_PROGRESS", label: "In progress" }, { value: "CLOSED", label: "Closed" }]} />
                    <Select label="Owner" name="assignedTo" empty="Unassigned" defaultValue={e.assignedTo} options={users.map((u) => ({ value: u.id, label: u.name }))} />
                    <Submit variant="secondary">Save</Submit>
                  </ActionForm>
                ) : <p className="text-xs text-ink-muted">Owner: {e.assignedTo ? userName.get(e.assignedTo) ?? "—" : "unassigned"}</p>}
              </div>
            </li>
          ))}
          {enquiries.length === 0 && <li className="text-sm text-ink-muted">No enquiries yet.</li>}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="section-title">Quotation requests</h2>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200">
          <table className="table-tech table-compact">
            <thead><tr><th>Number</th><th>Project</th><th>Contact</th><th>Rev</th><th className="num">Priced total</th><th>Valid until</th><th>PDF</th></tr></thead>
            <tbody>
              {quotes.map((q) => {
                const t = q.totals as { total?: number | null; unpricedLines?: number; untaxedLines?: number } | null;
                return (
                  <tr key={q.id}>
                    <td className="font-mono text-xs">{q.number}<span className="block"><Badge>{q.status.toLowerCase()}</Badge></span></td>
                    <td><Link href={`/projects/${q.projectId}/quote`}>{q.project.reference}</Link><span className="block text-xs text-ink-muted">{q.project.name}</span></td>
                    <td className="text-xs">{q.contactName}<span className="block">{q.contactEmail}</span></td>
                    <td>{q.revisionNo}</td>
                    <td className="num">{formatINR(t?.total ?? null)}{t && ((t.unpricedLines ?? 0) > 0 || (t.untaxedLines ?? 0) > 0) && <span className="block text-xs text-solar-700">incomplete pricing</span>}</td>
                    <td className="text-xs">{q.validUntil ? formatDateTime(q.validUntil).split(",")[0] : "—"}</td>
                    <td><QuotePdfButton quotationId={q.id} storedPdf={!!q.pdfStorageKey} label="Download" /></td>
                  </tr>
                );
              })}
              {quotes.length === 0 && <tr><td colSpan={7} className="text-ink-muted">No quotation requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
