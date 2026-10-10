import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead, Field, Hidden, Check, Select, Area, ReadOnlyNote, opts } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { DocumentUpload } from "@/components/admin/DocumentUpload";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { saveCheckTemplate, saveStandard } from "../actions";
import { formatDate, VERIFICATION_LABEL } from "@/lib/format";

const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : "");

export default async function ComplianceLibrary() {
  const { can } = await adminCtx();
  const [standards, templates, docs] = await Promise.all([
    prisma.complianceStandard.findMany({ include: { _count: { select: { certifications: true, checks: true } } }, orderBy: [{ authority: "asc" }, { code: "asc" }] }),
    prisma.complianceCheckTemplate.findMany({ include: { standard: true }, orderBy: { sortOrder: "asc" } }),
    prisma.complianceDocument.findMany({ where: { productId: null }, include: { standard: true, project: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const edit = can("compliance.edit");
  const stdOpts = standards.map((s) => ({ value: s.id, label: `${s.code} · ${s.title.slice(0, 60)}` }));
  const stdForm = (s?: (typeof standards)[number]) => (
    <ActionForm action={saveStandard} resetOnSuccess={!s}>
      <Hidden name="id" value={s?.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Code" name="code" defaultValue={s?.code} required />
        <Field label="Title" name="title" defaultValue={s?.title} required className="lg:col-span-3" />
        <Field label="Authority" name="authority" defaultValue={s?.authority} required hint="BIS, IEC, MNRE, CEA, BESCOM, KERC…" />
        <Field label="Scope" name="scope" defaultValue={s?.scope} required />
        <Field label="Revision / edition" name="revision" defaultValue={s?.revision} />
        <Field label="Revision date" name="revisionDate" type="date" defaultValue={d(s?.revisionDate)} />
        <Field label="Official source" name="officialUrl" defaultValue={s?.officialUrl} placeholder="https://" className="sm:col-span-2" />
        <Select label="Verification" name="verificationStatus" options={opts(VERIFICATION_LABEL)} defaultValue={s?.verificationStatus ?? "PENDING_VERIFICATION"} />
        <div className="flex items-end pb-2"><Check label="Active" name="active" defaultChecked={s?.active ?? true} /></div>
        <Area label="Applicability notes" name="applicabilityNotes" defaultValue={s?.applicabilityNotes} className="sm:col-span-2 lg:col-span-4" rows={2} />
      </div>
      <div className="mt-2 text-right"><Submit variant={s ? "secondary" : "primary"}>{s ? "Save source" : "Add source"}</Submit></div>
    </ActionForm>
  );
  const tplForm = (t?: (typeof templates)[number]) => (
    <ActionForm action={saveCheckTemplate} resetOnSuccess={!t}>
      <Hidden name="id" value={t?.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Key" name="key" defaultValue={t?.key} required />
        <Field label="Title" name="title" defaultValue={t?.title} required className="lg:col-span-2" />
        <Field label="Area" name="area" defaultValue={t?.area} required />
        <Area label="What must be checked" name="description" defaultValue={t?.description} required rows={2} className="sm:col-span-2" />
        <Select label="Source" name="standardId" options={stdOpts} defaultValue={t?.standardId} empty="None" />
        <Field label="Order" name="sortOrder" type="number" defaultValue={t?.sortOrder} />
      </div>
      <div className="mt-2 flex items-center justify-between"><Check label="Active" name="active" defaultChecked={t?.active ?? true} /><Submit variant={t ? "secondary" : "primary"}>{t ? "Save" : "Add checklist item"}</Submit></div>
    </ActionForm>
  );
  return (
    <>
      <PageHead title="Compliance library">
        Standards, regulations and utility procedures that projects are checked against. Requirements change, so every source records its revision and a link to the official publication, and stays “pending verification” until an engineer has checked it against that publication.
      </PageHead>
      {!edit && <ReadOnlyNote what="the compliance library" />}

      <section>
        <h2 className="section-title">Sources</h2>
        <ul className="mt-3 space-y-2">
          {standards.map((s) => (
            <li key={s.id} className="card p-3">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <Badge>{s.authority}</Badge> <VerificationBadge status={s.verificationStatus} /> {s._count.checks} checklist item(s) · {s._count.certifications} product certification(s)
                {s.verifiedAt && <span>· verified {formatDate(s.verifiedAt)} by {s.verifiedBy}</span>}
              </p>
              {edit ? stdForm(s) : (
                <p className="text-sm"><span className="font-medium">{s.code}</span> · {s.title} {s.officialUrl && <a href={s.officialUrl} target="_blank" rel="noopener noreferrer">official source ↗</a>}</p>
              )}
            </li>
          ))}
        </ul>
        {edit && <details className="card mt-3 p-4"><summary className="cursor-pointer text-sm font-medium">Add source</summary><div className="mt-3">{stdForm()}</div></details>}
      </section>

      <section className="mt-8">
        <h2 className="section-title">Project checklist template</h2>
        <p className="mt-1 text-xs text-ink-muted">Each new project gets these items, all starting as “pending verification”. Existing projects pick up new items when their checklist is refreshed.</p>
        <ul className="mt-3 space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="card p-3">
              {edit ? tplForm(t) : <p className="text-sm"><span className="font-medium">{t.title}</span> · {t.area}<span className="block text-xs text-ink-muted">{t.description}</span></p>}
            </li>
          ))}
        </ul>
        {edit && <details className="card mt-3 p-4"><summary className="cursor-pointer text-sm font-medium">Add checklist item</summary><div className="mt-3">{tplForm()}</div></details>}
      </section>

      <section className="mt-8">
        <h2 className="section-title">Regulatory and project documents</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded border border-slate-200 text-sm">
          {docs.map((x) => (
            <li key={x.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span><Badge>{x.docType.toLowerCase()}</Badge> <a href={`/api/documents/${x.id}`}>{x.title}</a>{x.revision && ` · rev ${x.revision}`}{x.standard && ` · ${x.standard.code}`}{x.project && ` · ${x.project.reference}`}</span>
              <span className="text-xs text-ink-muted">{x.uploadedBy} · {formatDate(x.createdAt)}</span>
            </li>
          ))}
          {docs.length === 0 && <li className="px-3 py-2 text-ink-muted">None yet.</li>}
        </ul>
        {can("documents.upload") && <DocumentUpload standards={stdOpts} />}
      </section>
    </>
  );
}
