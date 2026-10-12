import Link from "next/link";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead, Select, Hidden } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { assignBom } from "../actions";
import { formatDateTime } from "@/lib/format";

const tone = (s: string) => (s === "APPROVED" ? "green" : s === "REJECTED" ? "red" : s === "SUBMITTED" ? "blue" : "gray") as "green" | "red" | "blue" | "gray";

export default async function AdminProjects({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { can } = await adminCtx();
  const { status } = await searchParams;
  const [boms, users] = await Promise.all([
    prisma.bOMHeader.findMany({
      where: status ? { status: status as never } : undefined,
      include: { project: true, assignedTo: true, _count: { select: { items: true } }, revisions: { orderBy: { revisionNo: "desc" }, take: 1, omit: { snapshot: true } } },
      orderBy: { updatedAt: "desc" }, take: 200,
    }),
    prisma.user.findMany({ where: { active: true, roles: { some: {} } }, orderBy: { name: "asc" } }),
  ]);
  const canAssign = can("projects.assign");
  return (
    <>
      <PageHead title="Projects & BOMs">Assign BOMs to engineers and open revisions awaiting review. Approval happens on each project’s “Revisions & audit” tab.</PageHead>
      <nav className="mb-3 flex flex-wrap gap-2 text-xs" aria-label="Filter by status">
        {["", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].map((s) => (
          <Link key={s} href={s ? `?status=${s}` : "?"} className={`rounded-full border px-3 py-1 no-underline ${status === s || (!status && !s) ? "border-brand-800 bg-brand-800 text-white" : "border-slate-300 text-ink"}`}>{s ? s.toLowerCase() : "all"}</Link>
        ))}
      </nav>
      <div className="relative overflow-x-auto rounded border border-slate-200">
        <table className="table-tech table-compact">
          <thead><tr><th>Project</th><th>Status</th><th className="num">Lines</th><th>Updated</th><th>Assigned engineer</th></tr></thead>
          <tbody>
            {boms.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/projects/${b.projectId}/bom`} className="font-medium">{b.project.name}</Link>
                  <span className="block font-mono text-xs text-ink-muted">{b.project.reference}{b.project.isSample ? " · sample" : ""}</span>
                </td>
                <td><Badge tone={tone(b.status)}>Rev {b.currentRevision} · {b.status.toLowerCase()}</Badge>
                  {b.status === "SUBMITTED" && <Link href={`/projects/${b.projectId}/history`} className="ml-2 text-xs">Review →</Link>}</td>
                <td className="num">{b._count.items}</td>
                <td className="whitespace-nowrap text-xs">{formatDateTime(b.updatedAt)}</td>
                <td>
                  {canAssign ? (
                    <ActionForm action={assignBom} className="flex items-end gap-2">
                      <Hidden name="bomId" value={b.id} />
                      <Select label="Engineer" name="userId" empty="Unassigned" defaultValue={b.assignedToId} options={users.map((u) => ({ value: u.id, label: u.name }))} className="min-w-40 [&_.label]:sr-only" />
                      <Submit variant="secondary">Save</Submit>
                    </ActionForm>
                  ) : (b.assignedTo?.name ?? "—")}
                </td>
              </tr>
            ))}
            {boms.length === 0 && <tr><td colSpan={5} className="text-ink-muted">No BOMs.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
