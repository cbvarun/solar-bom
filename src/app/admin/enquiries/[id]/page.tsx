import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead, Field, Area, Select, Hidden } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { NewFromPackage } from "@/components/packages/NewFromPackage";
import { addEnquiryNote, updateEnquiry } from "../../actions";
import { CUSTOMER_TYPE_LABEL, formatDateTime } from "@/lib/format";
import { ENQUIRY_STATUS_LABEL, ENQUIRY_STATUS_TONE, followUpKey, formatFollowUp, isFollowUpOverdue, isTerminalStatus, statusOptions, type EnquiryStatusCode } from "@/lib/crm";

const FIELD_LABEL: Record<string, string> = { status: "Status", assignedTo: "Owner", nextFollowUpAt: "Next follow-up", lostReason: "Lost reason", notes: "Note", projectId: "Project" };

export default async function EnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { can } = await adminCtx();
  const e = await prisma.enquiry.findUnique({ where: { id }, include: { project: true, package: true, notes: { orderBy: { createdAt: "desc" } } } });
  if (!e) notFound();
  const [users, history] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.auditLog.findMany({ where: { entityType: "Enquiry", entityId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const canManage = can("enquiries.manage");
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const owner = e.assignedTo ? userName.get(e.assignedTo) ?? "Unknown user" : "Unassigned";
  const overdue = !isTerminalStatus(e.status) && isFollowUpOverdue(e.nextFollowUpAt);

  /** Make audit values readable: status labels, user names, dates. */
  const show = (field: string | null, v: string | null) => {
    if (v == null || v === "∅") return "—";
    if (field === "status") return ENQUIRY_STATUS_LABEL[v as EnquiryStatusCode] ?? v;
    if (field === "assignedTo") return userName.get(v) ?? v;
    if (field === "nextFollowUpAt") return formatFollowUp(v);
    return v;
  };
  const ownerOptions = users.filter((u) => u.active || u.id === e.assignedTo).map((u) => ({ value: u.id, label: u.active ? u.name : `${u.name} (inactive)` }));

  return (
    <>
      <nav className="mb-2 text-xs text-ink-muted"><Link href="/admin/enquiries">Enquiries</Link> / {e.name}</nav>
      <PageHead title={`${e.name}${e.company ? ` · ${e.company}` : ""}`} actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ENQUIRY_STATUS_TONE[e.status]}>{ENQUIRY_STATUS_LABEL[e.status]}</Badge>
          <Badge>{e.source}</Badge>
        </div>
      }>
        Received {formatDateTime(e.createdAt)} · last updated {formatDateTime(e.updatedAt)}
      </PageHead>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <h2 className="section-title">Details</h2>
          <dl className="card mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 text-sm">
            <dt className="text-ink-muted">Email</dt><dd className="break-all"><a href={`mailto:${e.email}`}>{e.email}</a></dd>
            <dt className="text-ink-muted">Phone</dt><dd>{e.phone ? <a href={`tel:${e.phone}`}>{e.phone}</a> : "—"}</dd>
            <dt className="text-ink-muted">Location</dt><dd className="break-words">{e.location ?? "—"}</dd>
            <dt className="text-ink-muted">Customer type</dt><dd>{e.customerType ? CUSTOMER_TYPE_LABEL[e.customerType] : "—"}</dd>
            <dt className="text-ink-muted">Capacity</dt><dd>{e.capacityKwp ? `${Number(e.capacityKwp)} kWp` : "—"}</dd>
            {e.package && <><dt className="text-ink-muted">Package</dt><dd className="break-words"><Link href={`/admin/packages#${e.package.code}`}>{e.package.name}</Link>{!e.package.active && <> <Badge>inactive</Badge></>}</dd></>}
            {e.productSku && <><dt className="text-ink-muted">Product</dt><dd className="break-all font-mono text-xs">{e.productSku}</dd></>}
            <dt className="text-ink-muted">Project</dt>
            <dd className="break-words">{e.project ? <Link href={`/projects/${e.project.id}`}>{e.project.reference} · {e.project.name}</Link> : "—"}</dd>
            <dt className="text-ink-muted">Owner</dt><dd>{owner}</dd>
            <dt className="text-ink-muted">Next follow-up</dt>
            <dd>{formatFollowUp(e.nextFollowUpAt)}{overdue && <> <Badge tone="red">overdue</Badge></>}</dd>
            {e.status === "LOST" && <><dt className="text-ink-muted">Lost reason</dt><dd className="whitespace-pre-wrap break-words">{e.lostReason ?? "—"}</dd></>}
          </dl>
          <h3 className="mt-4 text-sm font-semibold">Message</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{e.message}</p>
          {e.package && !e.project && can("packages.use") && e.package.active && (
            <details className="card mt-4 p-4">
              <summary className="cursor-pointer text-sm font-medium">Create project from {e.package.name}</summary>
              <p className="mt-2 text-xs text-ink-muted">Filled in from this enquiry. The new project is linked to the enquiry, and its BOM starts as the package lines marked estimated.</p>
              <div className="mt-3">
                <NewFromPackage packageId={e.package.id} packageName={e.package.name} enquiryId={e.id}
                  defaults={{ name: `${e.name}${e.location ? ` · ${e.location}` : ""} · ${Number(e.package.capacityKwp)} kWp`, location: e.location, customerName: e.name, customerPhone: e.phone, customerEmail: e.email, customerType: e.customerType }} />
              </div>
            </details>
          )}
        </section>

        <section className="min-w-0">
          <h2 className="section-title">Pipeline</h2>
          {canManage ? (
            <div className="card mt-3 p-4">
              <ActionForm action={updateEnquiry} className="group">
                <Hidden name="id" value={e.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="Status" name="status" defaultValue={e.status} options={statusOptions(e.status)} />
                  <Select label="Owner" name="assignedTo" empty="Unassigned" defaultValue={e.assignedTo} options={ownerOptions} />
                  <Field label="Next follow-up" name="nextFollowUpAt" type="date" defaultValue={followUpKey(e.nextFollowUpAt)} hint="Leave blank for no follow-up" />
                </div>
                {/* Shown only while "Lost" is selected (CSS :has); the server also enforces it. */}
                <div className="mt-3 hidden group-has-[option[value=LOST]:checked]:block">
                  <Area label="Lost reason" name="lostReason" defaultValue={e.lostReason} rows={2} required={false} hint="Required when status is Lost (max 500 characters)" />
                </div>
                <div className="mt-3"><Submit>Save</Submit></div>
              </ActionForm>
            </div>
          ) : (
            <Alert tone="note" className="mt-3">Your role can view this enquiry but not change it.</Alert>
          )}

          <h2 className="section-title mt-6">Notes</h2>
          {canManage && (
            <ActionForm action={addEnquiryNote} resetOnSuccess className="mt-3">
              <Hidden name="enquiryId" value={e.id} />
              <Area label="Add note" name="body" rows={3} required hint="Calls, site visits, what was promised (max 4000 characters)" />
              <div className="mt-2"><Submit variant="secondary">Add note</Submit></div>
            </ActionForm>
          )}
          {e.notes.length === 0 ? <p className="mt-3 text-sm text-ink-muted">No notes yet.</p> : (
            <ol className="mt-3 space-y-2">
              {e.notes.map((nt) => (
                <li key={nt.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                  <p className="text-xs text-ink-muted">{formatDateTime(nt.createdAt)} · {nt.author}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{nt.body}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="mt-8 min-w-0">
        <h2 className="section-title">History</h2>
        {history.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No recorded changes.</p> : (
          <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200 text-xs">
            {history.map((a) => (
              <li key={a.id} className="break-words px-3 py-2">
                <span className="font-medium">{a.actorLabel ?? "—"}</span> · {a.action}
                {a.field && <> {FIELD_LABEL[a.field] ?? a.field}</>}
                {a.action === "note" ? <span className="text-ink-muted">: {a.newValue}</span>
                  : (a.oldValue != null || a.newValue != null) && <span className="text-ink-muted">: {show(a.field, a.oldValue)} → {show(a.field, a.newValue)}</span>}
                {a.reason && <span className="block text-ink-muted">Reason: {a.reason}</span>}
                <span className="block text-ink-faint">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
