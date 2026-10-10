import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession, ownedProjectTokens } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { CUSTOMER_TYPE_LABEL, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await getSession();
  const owned = await ownedProjectTokens();
  const where = session ? {} : { OR: [{ id: { in: Object.keys(owned) } }, { isSample: true }] };
  const rows = await prisma.project.findMany({ where, orderBy: [{ isSample: "desc" }, { updatedAt: "desc" }], take: 200, include: { designInputs: true, boms: { select: { status: true, currentRevision: true } } } });
  const visible = session ? rows : rows.filter((r) => r.isSample || (r.ownerToken && owned[r.id] === r.ownerToken));
  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Projects</p>
          <h1 className="mt-1 text-2xl">{session ? "All projects" : "Your projects"}</h1>
          {!session && <p className="mt-1 text-sm text-ink-muted">Projects you create on this device are listed here. The sample project is read-only; duplicate it to edit.</p>}
        </div>
        <Link href="/configure" className="btn-primary">New project</Link>
      </div>
      <div className="card mt-6 overflow-x-auto">
        <table className="table-tech">
          <thead><tr><th>Reference</th><th>Project</th><th>Customer type</th><th className="num">Target kWp</th><th>BOM</th><th>Updated</th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-ink-muted">No projects yet. <Link href="/configure">Configure your first project</Link>.</td></tr>}
            {visible.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.reference}</td>
                <td><Link href={`/projects/${p.id}`} className="font-medium">{p.name}</Link> {p.isSample && <Badge tone="yellow">Sample</Badge>}<div className="text-xs text-ink-muted">{p.location ?? "Location TBC"}</div></td>
                <td>{p.customerType ? CUSTOMER_TYPE_LABEL[p.customerType] : "—"}</td>
                <td className="num">{p.designInputs?.targetCapacityKwp != null ? Number(p.designInputs.targetCapacityKwp) : "TBC"}</td>
                <td>{p.boms[0] ? <span className="text-xs">Rev {p.boms[0].currentRevision} · {p.boms[0].status.toLowerCase()}</span> : "—"}</td>
                <td className="text-xs text-ink-muted">{formatDate(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
