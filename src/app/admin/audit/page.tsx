import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead } from "@/components/admin/Fields";
import { formatDateTime } from "@/lib/format";

const PAGE = 100;

export default async function Audit({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; page?: string }> }) {
  await adminCtx();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.type) where.entityType = sp.type;
  if (sp.q) where.OR = [{ actorLabel: { contains: sp.q, mode: "insensitive" } }, { newValue: { contains: sp.q, mode: "insensitive" } }, { reason: { contains: sp.q, mode: "insensitive" } }, { entityId: sp.q }];
  const [rows, total, types] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entityType"], _count: true, orderBy: { entityType: "asc" } }),
  ]);
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;
  return (
    <>
      <PageHead title="Audit log">Every change to products, prices, rules, compliance records and BOMs, with who made it and why. Entries cannot be edited.</PageHead>
      <form className="mb-3 flex flex-wrap items-end gap-2" role="search">
        <label><span className="label text-xs">Record type</span>
          <select name="type" defaultValue={sp.type ?? ""} className="input mt-1 py-1.5"><option value="">All</option>{types.map((t) => <option key={t.entityType} value={t.entityType}>{t.entityType} ({t._count})</option>)}</select></label>
        <label><span className="label text-xs">Search</span><input name="q" defaultValue={sp.q} className="input mt-1 py-1.5" placeholder="Person, value, reason or record id" /></label>
        <button className="btn-secondary btn-sm">Filter</button>
      </form>
      <p className="mb-2 text-xs text-ink-muted">{total} entries</p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="table-tech table-compact text-xs">
          <thead><tr><th>When</th><th>Who</th><th>Record</th><th>Action</th><th>Change</th><th>Reason</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                <td>{a.actorLabel}</td>
                <td>{a.entityType}<span className="block font-mono text-[10px] text-ink-faint">{a.entityId}</span></td>
                <td>{a.action}{a.field && <span className="block text-ink-muted">{a.field}</span>}</td>
                <td className="max-w-xs break-words">{a.oldValue != null && <span className="text-ink-muted line-through">{a.oldValue.slice(0, 120)}</span>} {a.newValue?.slice(0, 160)}</td>
                <td className="max-w-xs break-words">{a.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-3 text-sm">
        {page > 1 && <Link href={qs(page - 1)}>← Newer</Link>}
        {page * PAGE < total && <Link href={qs(page + 1)}>Older →</Link>}
      </div>
    </>
  );
}
