import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead } from "@/components/admin/Fields";
import { Badge } from "@/components/ui/Badge";
import { QuotePdfButton } from "@/components/exports/QuotePdfButton";
import { CUSTOMER_TYPE_LABEL, formatDateTime, formatINR } from "@/lib/format";
import { ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_TONE, LEGACY_STATUSES, PIPELINE, TERMINAL_STATUSES, endOfTodayBound, formatFollowUp, isFollowUpOverdue, isTerminalStatus, type EnquiryStatusCode } from "@/lib/crm";

const ALL_STATUSES = Object.keys(ENQUIRY_STATUS_LABEL) as EnquiryStatusCode[];
type Filters = { status?: string; due?: string; owner?: string };

/** Build a list URL from the current filters with some overridden (undefined removes). */
function hrefWith(cur: Filters, patch: Filters) {
  const next = { ...cur, ...patch };
  const qs = new URLSearchParams();
  for (const k of ["status", "due", "owner"] as const) if (next[k]) qs.set(k, next[k]!);
  const s = qs.toString();
  return s ? `/admin/enquiries?${s}` : "/admin/enquiries";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs no-underline ${active ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-slate-200 bg-white text-ink hover:border-brand-300"}`}>
      {children}
    </Link>
  );
}

export default async function AdminEnquiries({ searchParams }: { searchParams: Promise<{ status?: string; due?: string; owner?: string }> }) {
  const { session } = await adminCtx();
  const sp = await searchParams;
  const status = ALL_STATUSES.includes(sp.status as EnquiryStatusCode) ? (sp.status as EnquiryStatusCode) : undefined;
  const due = sp.due === "1";
  const ownerParam = sp.owner || undefined;
  const ownerId = ownerParam === "me" ? session.sub : ownerParam === "none" ? null : ownerParam;
  const filters: Filters = { status, due: due ? "1" : undefined, owner: ownerParam };
  const now = new Date();

  const ownerWhere: Prisma.EnquiryWhereInput = ownerParam ? { assignedTo: ownerId } : {};
  const dueWhere: Prisma.EnquiryWhereInput = { nextFollowUpAt: { lt: endOfTodayBound(now) }, status: { notIn: [...TERMINAL_STATUSES] } };
  const where: Prisma.EnquiryWhereInput = { AND: [ownerWhere, status ? { status } : {}, due ? dueWhere : {}] };

  const [enquiries, counts, dueCount, total, quotes, users] = await Promise.all([
    prisma.enquiry.findMany({
      where, include: { project: true, notes: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { notes: true } } },
      orderBy: due ? [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }] : { createdAt: "desc" }, take: 200,
    }),
    prisma.enquiry.groupBy({ by: ["status"], where: ownerWhere, _count: true }),
    prisma.enquiry.count({ where: { AND: [ownerWhere, dueWhere] } }),
    prisma.enquiry.count({ where: ownerWhere }),
    prisma.quotation.findMany({ include: { project: true }, omit: { snapshot: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const countOf = new Map(counts.map((c) => [c.status as string, c._count]));
  const legacyShown = LEGACY_STATUSES.filter((s) => (countOf.get(s) ?? 0) > 0 || status === s);
  const ownerLabel = (id: string | null) => (id ? userName.get(id) ?? "Inactive user" : "Unassigned");

  return (
    <>
      <PageHead title="Enquiries & quotes">Lead pipeline for website enquiries and quote requests, plus BOM quotation requests. Email notification is not configured, so check this list for new requests.</PageHead>
      <section>
        <h2 className="section-title">Enquiries</h2>
        <nav aria-label="Pipeline stages" className="mt-3 flex min-w-0 flex-wrap gap-2">
          <Chip href={hrefWith(filters, { status: undefined, due: undefined })} active={!status && !due}>All <span className="text-ink-muted">{total}</span></Chip>
          {[...PIPELINE, ...legacyShown].map((s) => (
            <Chip key={s} href={hrefWith(filters, { status: s, due: undefined })} active={status === s && !due}>
              {ENQUIRY_STATUS_LABEL[s]} <span className="text-ink-muted">{countOf.get(s) ?? 0}</span>
            </Chip>
          ))}
          <Chip href={hrefWith(filters, { status: undefined, due: due ? undefined : "1" })} active={due}>
            Follow-ups due <span className={dueCount > 0 ? "font-semibold text-red-700" : "text-ink-muted"}>{dueCount}</span>
          </Chip>
        </nav>
        <form method="get" action="/admin/enquiries" className="mt-3 flex min-w-0 flex-wrap items-end gap-2 text-sm">
          {status && <input type="hidden" name="status" value={status} />}
          {due && <input type="hidden" name="due" value="1" />}
          <label className="block min-w-0">
            <span className="label text-xs">Owner</span>
            <select name="owner" defaultValue={ownerParam ?? ""} className="input mt-1 max-w-full py-1.5">
              <option value="">Anyone</option>
              <option value="me">Me</option>
              <option value="none">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-sm btn-secondary">Filter</button>
          {(status || due || ownerParam) && <Link href="/admin/enquiries" className="text-xs">Clear filters</Link>}
        </form>
        <ul className="mt-3 space-y-3">
          {enquiries.map((e) => {
            const overdue = !isTerminalStatus(e.status) && isFollowUpOverdue(e.nextFollowUpAt, now);
            const last = e.notes[0];
            return (
              <li key={e.id} className="card min-w-0 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                      <Link href={`/admin/enquiries/${e.id}`} className="break-words">{e.name}{e.company && ` · ${e.company}`}</Link>
                      <Badge tone={ENQUIRY_STATUS_TONE[e.status]}>{ENQUIRY_STATUS_LABEL[e.status]}</Badge>
                      <Badge>{e.source}</Badge>
                    </p>
                    <p className="break-words text-xs text-ink-muted">
                      <a href={`mailto:${e.email}`}>{e.email}</a>{e.phone && ` · ${e.phone}`}{e.location && ` · ${e.location}`}
                      {e.customerType && ` · ${CUSTOMER_TYPE_LABEL[e.customerType]}`}{e.capacityKwp && ` · ${Number(e.capacityKwp)} kWp`}{e.productSku && ` · product ${e.productSku}`}
                      {" · "}{formatDateTime(e.createdAt)}
                    </p>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words">{e.message}</p>
                    {e.project && <p className="mt-1 text-xs"><Link href={`/projects/${e.project.id}`}>{e.project.reference} · {e.project.name}</Link></p>}
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <div><dt className="inline text-ink-muted">Owner: </dt><dd className="inline">{ownerLabel(e.assignedTo)}</dd></div>
                      <div>
                        <dt className="inline text-ink-muted">Next follow-up: </dt>
                        <dd className="inline">{formatFollowUp(e.nextFollowUpAt)}{overdue && <> <Badge tone="red">overdue</Badge></>}</dd>
                      </div>
                      {e.status === "LOST" && e.lostReason && <div className="min-w-0 break-words"><dt className="inline text-ink-muted">Lost: </dt><dd className="inline">{e.lostReason}</dd></div>}
                    </dl>
                    {last && (
                      <p className="mt-2 break-words rounded border border-slate-100 bg-slate-50 px-2 py-1 text-xs">
                        <span className="text-ink-muted">Last note ({formatDateTime(last.createdAt)}{e._count.notes > 1 ? ` · ${e._count.notes} notes` : ""}): </span>
                        {last.body.length > 160 ? `${last.body.slice(0, 160)}…` : last.body}
                      </p>
                    )}
                  </div>
                  <Link href={`/admin/enquiries/${e.id}`} className="btn-sm btn-secondary no-underline">Open</Link>
                </div>
              </li>
            );
          })}
          {enquiries.length === 0 && <li className="text-sm text-ink-muted">{status || due || ownerParam ? "No enquiries match these filters." : "No enquiries yet."}</li>}
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
                    <td className="font-mono text-xs">{q.number}<span className="block"><Badge tone={q.status === "ACCEPTED" ? "green" : "gray"}>{q.status.toLowerCase()}</Badge></span>{q.acceptedAt && <span className="block text-xs text-ink-muted">by {q.acceptedByName}</span>}{q.shareToken && !q.acceptedAt && <span className="block text-xs text-ink-muted">link shared</span>}</td>
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
