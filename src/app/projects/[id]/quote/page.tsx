import { prisma } from "@/lib/db";
import { loadProjectOr404 } from "@/lib/server/access";
import { bomPricing, loadBom } from "@/lib/server/bom";
import { ExportButtons } from "@/components/exports/ExportButtons";
import { QuotePdfButton } from "@/components/exports/QuotePdfButton";
import { QuoteRequestForm } from "@/components/project/QuoteRequestForm";
import { Alert } from "@/components/ui/Alert";
import { formatDate, formatINR } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/server/permissions";
import { SharePanel } from "@/components/proposal/SharePanel";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, access } = await loadProjectOr404(id);
  const bom = await loadBom(prisma, id);
  if (!bom) return null;
  const pricing = bomPricing(bom);
  const session = await getSession();
  const canShare = !!session && can(session.roles, "quotations.share");
  const quotes = access === "edit" ? await prisma.quotation.findMany({ where: { projectId: id }, omit: { snapshot: true }, orderBy: { createdAt: "desc" } }) : [];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="section-title">Export the BOM</h2>
          <p className="mt-1 text-sm text-ink-muted">Exports reflect BOM revision {bom.currentRevision} including your latest edits. All documents are marked preliminary.</p>
          <ExportButtons projectId={id} />
        </section>
        <section className="card p-5">
          <h2 className="section-title">Cost summary</h2>
          <dl className="mt-3 grid max-w-md grid-cols-2 gap-y-1 text-sm">
            <dt className="text-ink-muted">Subtotal (excl. GST)</dt><dd className="num">{formatINR(pricing.subtotalExGst)}</dd>
            <dt className="text-ink-muted">GST</dt><dd className="num">{formatINR(pricing.gstTotal)}</dd>
            <dt className="font-semibold">Estimated total (incl. GST)</dt><dd className="num font-semibold">{formatINR(pricing.grandTotal)}</dd>
          </dl>
          {!pricing.complete && <Alert tone="warning" className="mt-3">{pricing.unpricedLines} line(s) have no unit price and {pricing.untaxedLines} have no GST rate. Our sales team will complete pricing from current supplier quotations.</Alert>}
        </section>
        {access === "edit" && (
          <section className="card p-5">
            <h2 className="section-title">Quotation history</h2>
            {quotes.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No quotations generated yet.</p> : (<>
              {canShare && <p className="mt-1 text-sm text-ink-muted">Share a quotation as a web proposal the customer can open on their phone, download as PDF and accept online. Sharing marks a requested quotation as issued.</p>}
              <table className="table-tech table-compact mt-3">
                <thead><tr><th>Number</th><th>Rev</th><th>Status</th><th className="num">Total</th><th>Valid until</th><th /></tr></thead>
                <tbody>{quotes.map((q) => {
                  const t = q.totals as { total?: number };
                  return (
                    <tr key={q.id}>
                      <td className="font-mono text-xs">{q.number}</td><td>{q.revisionNo}</td>
                      <td>{q.status.toLowerCase()}{q.acceptedAt && <span className="block text-xs text-ink-muted">by {q.acceptedByName}, {formatDate(q.acceptedAt)}</span>}</td>
                      <td className="num">{formatINR(t.total ?? null)}</td><td>{formatDate(q.validUntil)}</td>
                      <td>
                        <QuotePdfButton quotationId={q.id} storedPdf={!!q.pdfStorageKey} />
                        {canShare && <SharePanel quotationId={q.id} number={q.number} initialToken={q.shareToken} accepted={!!q.acceptedAt}
                          customerName={project.customerName ?? q.contactName} customerEmail={project.customerEmail ?? q.contactEmail} customerPhone={project.customerPhone} />}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </>)}
          </section>
        )}
      </div>
      <section className="card h-fit p-5">
        <h2 className="section-title">Send to our sales team</h2>
        <p className="mt-1 text-sm text-ink-muted">Submit this BOM as a quote request, or send it to sales for review. A numbered quotation is created and stored with the project.</p>
        <div className="mt-4"><QuoteRequestForm projectId={id} defaultName={project.customerName ?? ""} defaultEmail={project.customerEmail ?? ""} /></div>
      </section>
    </div>
  );
}
