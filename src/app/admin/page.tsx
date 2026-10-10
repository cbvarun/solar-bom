import Link from "next/link";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead } from "@/components/admin/Fields";
import { Alert } from "@/components/ui/Alert";
import { formatDateTime, PROVENANCE_LABEL } from "@/lib/format";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { session } = await adminCtx();
  const { denied } = await searchParams;
  const [newEnq, pendingReviews, myBoms, products, provCounts, standards, taxUnset, pricesCount, quotes, recent] = await Promise.all([
    prisma.enquiry.count({ where: { status: "NEW" } }),
    prisma.bOMRevision.findMany({ where: { status: "SUBMITTED" }, include: { bom: { include: { project: true } } }, orderBy: { createdAt: "asc" }, take: 10 }),
    prisma.bOMHeader.findMany({ where: { assignedToId: session.sub }, include: { project: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.groupBy({ by: ["provenance"], _count: true }),
    prisma.complianceStandard.groupBy({ by: ["verificationStatus"], _count: true }),
    prisma.taxClass.count({ where: { ratePercent: null } }),
    prisma.priceListEntry.count(),
    prisma.quotation.count({ where: { status: "REQUESTED" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const unverifiedStandards = standards.filter((s) => s.verificationStatus !== "VERIFIED").reduce((a, s) => a + s._count, 0);
  const tiles = [
    { label: "New enquiries", value: newEnq, href: "/admin/enquiries" },
    { label: "Quote requests open", value: quotes, href: "/admin/enquiries" },
    { label: "Revisions awaiting review", value: pendingReviews.length, href: "/admin/projects" },
    { label: "Active products", value: products, href: "/admin/products" },
    { label: "Supplier prices on file", value: pricesCount, href: "/admin/pricing" },
    { label: "Compliance sources not verified", value: unverifiedStandards, href: "/admin/compliance" },
  ];
  return (
    <>
      <PageHead title="Dashboard">Work queues and data-quality signals for the catalogue and BOMs.</PageHead>
      {denied && <Alert tone="warning" className="mb-4" title="Not permitted">Your role cannot open that page.</Alert>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="card p-4 no-underline hover:border-brand-300">
            <p className="text-xs text-ink-muted">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{t.value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {taxUnset > 0 && <Alert tone="warning" title="GST rates not configured">{taxUnset} tax class(es) have no rate. BOM totals show GST as “not configured” for those lines until procurement records the rate and its source under <Link href="/admin/pricing">Pricing & GST</Link>.</Alert>}
        {pricesCount === 0 && <Alert tone="info" title="No supplier prices">The catalogue has no supplier-quoted prices yet. Prices appear in BOMs only after procurement records a quotation reference for each one.</Alert>}
        <Alert tone="info" title="Catalogue provenance">{provCounts.map((p) => `${PROVENANCE_LABEL[p.provenance]}: ${p._count}`).join(" · ")}. Illustrative records are templates, not real product claims.</Alert>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="section-title">Awaiting engineering review</h2>
          {pendingReviews.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Nothing submitted.</p> : (
            <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200 text-sm">
              {pendingReviews.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 px-3 py-2">
                  <Link href={`/projects/${r.bom.projectId}/history`}>{r.bom.project.reference} · {r.bom.project.name}</Link>
                  <span className="text-xs text-ink-muted">Rev {r.revisionNo} · {formatDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="section-title mt-6">Assigned to you</h2>
          {myBoms.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No BOMs assigned.</p> : (
            <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200 text-sm">
              {myBoms.map((b) => <li key={b.id} className="px-3 py-2"><Link href={`/projects/${b.projectId}/bom`}>{b.project.reference} · {b.project.name}</Link> <span className="text-xs text-ink-muted">({b.status.toLowerCase()})</span></li>)}
            </ul>
          )}
        </section>
        <section>
          <h2 className="section-title">Recent activity</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200 text-xs">
            {recent.map((a) => (
              <li key={a.id} className="break-words px-3 py-2">
                <span className="font-medium">{a.actorLabel}</span> · {a.action} {a.entityType}{a.field ? `.${a.field}` : ""}
                {a.newValue && <span className="text-ink-muted"> → {a.newValue.slice(0, 80)}</span>}
                <span className="block text-ink-faint">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/audit" className="mt-2 inline-block text-xs">Full audit log →</Link>
        </section>
      </div>
    </>
  );
}
