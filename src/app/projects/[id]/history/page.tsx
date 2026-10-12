import { prisma } from "@/lib/db";
import { loadProjectOr404 } from "@/lib/server/access";
import { getSession, hasRole } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { ReviewControls } from "@/components/bom/ReviewControls";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await loadProjectOr404(id);
  const session = await getSession();
  const bom = await prisma.bOMHeader.findFirst({ where: { projectId: id }, include: { revisions: { orderBy: { revisionNo: "desc" }, omit: { snapshot: true } }, items: { select: { id: true, name: true } } } });
  const itemIds = bom?.items.map((i) => i.id) ?? [];
  const itemNames = new Map(bom?.items.map((i) => [i.id, i.name]));
  const logs = await prisma.auditLog.findMany({
    where: { OR: [{ entityId: id }, { entityId: { in: [...itemIds, bom?.id ?? "", ...(bom?.revisions.map((r) => r.id) ?? [])] } }] },
    orderBy: { createdAt: "desc" }, take: 500,
  });
  const canReview = hasRole(session, "DESIGN_ENGINEER");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section>
        <h2 className="section-title">BOM revisions</h2>
        <ol className="mt-3 space-y-2">
          {bom?.revisions.map((r) => (
            <li key={r.id} className="card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Rev {r.revisionNo}</span>
                <Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "red" : r.status === "SUBMITTED" ? "blue" : "gray"}>{r.status.toLowerCase()}</Badge>
              </div>
              <p className="mt-1">{r.summary}</p>
              <p className="mt-1 text-xs text-ink-muted">{r.createdBy} · {formatDateTime(r.createdAt)}</p>
              {r.reviewedBy && <p className="mt-1 text-xs">Reviewed by {r.reviewedBy} on {formatDateTime(r.reviewedAt)}{r.reviewNotes && `: ${r.reviewNotes}`}</p>}
              {canReview && r.status === "SUBMITTED" && <ReviewControls revisionId={r.id} />}
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="section-title">Audit trail</h2>
        <p className="text-xs text-ink-muted">Every change to inputs, quantities, specifications, prices and approvals.</p>
        <div className="card mt-3 max-h-[70vh] overflow-auto">
          <table className="table-tech table-compact text-xs">
            <thead className="sticky top-0"><tr><th>When</th><th>Who</th><th>What</th><th>Change</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td>{l.actorLabel}</td>
                  <td>{l.action}{l.field && <> · <span className="font-mono">{l.field}</span></>}<div className="text-ink-muted">{l.entityType === "BOMItem" ? itemNames.get(l.entityId) : l.entityType}</div></td>
                  <td className="max-w-xs break-words">{l.oldValue != null && <span className="text-red-700 line-through">{l.oldValue}</span>} {l.newValue != null && <span className="text-brand-800">{l.newValue}</span>}{l.reason && <div className="text-ink-muted">{l.reason}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
