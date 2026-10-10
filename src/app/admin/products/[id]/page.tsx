import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { adminCtx, n } from "@/lib/server/admin-page";
import { PageHead, Field, Select, Hidden, opts, Area } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { ProductForm } from "@/components/admin/ProductForm";
import { DocumentUpload } from "@/components/admin/DocumentUpload";
import { Badge, ProvenanceBadge, VerificationBadge } from "@/components/ui/Badge";
import { deletePrice, deleteSpec, saveCertification, saveCompatibility, savePrice, saveSpec, setProductStatus } from "../../actions";
import { formatDate, formatINR, PROVENANCE_LABEL, VERIFICATION_LABEL } from "@/lib/format";

const SPEC_PROV = { MANUFACTURER_VERIFIED: PROVENANCE_LABEL.MANUFACTURER_VERIFIED, ENGINEER_ENTERED: PROVENANCE_LABEL.ENGINEER_ENTERED, SUPPLIER_QUOTED: PROVENANCE_LABEL.SUPPLIER_QUOTED, ILLUSTRATIVE: PROVENANCE_LABEL.ILLUSTRATIVE };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { can } = await adminCtx();
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      specifications: { orderBy: [{ sortOrder: "asc" }, { key: "asc" }], include: { sourceDocument: true } },
      prices: { include: { supplier: true, priceList: true }, orderBy: { updatedAt: "desc" } },
      certifications: { include: { standard: true, document: true } },
      documents: { orderBy: { createdAt: "desc" } },
      compatibilityA: { include: { productB: true } }, compatibilityB: { include: { productA: true } },
      category: true,
    },
  });
  if (!p) notFound();
  const [cats, mfrs, taxes, suppliers, lists, standards, others] = await Promise.all([
    prisma.productCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.manufacturer.findMany({ orderBy: { name: "asc" } }),
    prisma.taxClass.findMany({ orderBy: { code: "asc" } }),
    prisma.supplier.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    prisma.priceList.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.complianceStandard.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.product.findMany({ where: { id: { not: id }, status: "ACTIVE" }, select: { id: true, sku: true, name: true }, orderBy: { sku: "asc" } }),
  ]);
  const docOpts = p.documents.map((d) => ({ value: d.id, label: `${d.title}${d.revision ? ` (rev ${d.revision})` : ""}` }));
  const compat = [...p.compatibilityA.map((c) => ({ ...c, other: c.productB })), ...p.compatibilityB.map((c) => ({ ...c, other: c.productA }))];
  const edit = can("products.edit"), specs = can("products.specs"), price = can("pricing.edit"), comp = can("compliance.edit"), compat_ = can("compatibility.edit"), docs = can("documents.upload");

  return (
    <>
      <nav className="mb-2 text-xs text-ink-muted"><Link href="/admin/products">Products</Link> / {p.sku}</nav>
      <PageHead title={p.name} actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={p.status === "ACTIVE" ? "green" : p.status === "DRAFT" ? "yellow" : "gray"}>{p.status.toLowerCase()}</Badge>
          {p.status === "ACTIVE" && <Link href={`/catalogue/${p.sku}`} className="text-xs">View in catalogue</Link>}
          {edit && (["ACTIVE", "DRAFT", "ARCHIVED"] as const).filter((s) => s !== p.status).map((s) => (
            <ActionForm key={s} action={setProductStatus} confirm={s === "ARCHIVED" ? "Archive this product? It will no longer be offered in new BOMs." : undefined}>
              <Hidden name="id" value={p.id} /><Hidden name="status" value={s} />
              <Submit variant={s === "ARCHIVED" ? "danger" : "secondary"}>{s === "ACTIVE" ? "Publish" : s === "DRAFT" ? "Move to draft" : "Archive"}</Submit>
            </ActionForm>
          ))}
        </div>
      }>
        <span className="font-mono">{p.sku}</span> · {p.category.name} · <ProvenanceBadge provenance={p.provenance} />
      </PageHead>

      <section className="card p-4">
        <h2 className="section-title mb-3">Product record</h2>
        <ProductForm disabled={!edit} p={{ ...p, weightKg: n(p.weightKg) }}
          categories={cats.map((c) => ({ value: c.id, label: c.name }))} manufacturers={mfrs.map((m) => ({ value: m.id, label: m.name }))}
          taxClasses={taxes.map((t) => ({ value: t.id, label: `${t.code} · ${t.ratePercent == null ? "rate not configured" : `${Number(t.ratePercent)}%`}` }))} />
      </section>

      <section className="mt-6">
        <h2 className="section-title">Technical specifications</h2>
        <p className="mt-1 text-xs text-ink-muted">Keys such as <code>pmax_w</code>, <code>voc_v</code>, <code>ac_rated_w</code> and <code>bom_role</code> are read by the calculation engine. Manufacturer-verified values need a source datasheet (upload it below) and a verification date.</p>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200">
          <table className="table-tech table-compact">
            <thead><tr><th>Key</th><th>Label</th><th>Value</th><th>Tolerance</th><th>Source</th><th>Datasheet</th>{specs && <th />}</tr></thead>
            <tbody>
              {p.specifications.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.key}</td><td>{s.label}</td>
                  <td className="tabular-nums">{s.valueNumber != null ? Number(s.valueNumber) : s.valueText} {s.unit}</td>
                  <td className="text-xs">{s.tolerance ?? "—"}</td>
                  <td><ProvenanceBadge provenance={s.provenance} />{s.verifiedAt && <span className="block text-xs text-ink-muted">{formatDate(s.verifiedAt)} · {s.verifiedBy}</span>}</td>
                  <td className="text-xs">{s.sourceDocument ? <a href={`/api/documents/${s.sourceDocument.id}`}>{s.sourceDocument.title}</a> : "—"}</td>
                  {specs && <td><ActionForm action={deleteSpec} confirm={`Remove ${s.key}?`}><Hidden name="id" value={s.id} /><Submit variant="danger">Remove</Submit></ActionForm></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {specs && (
          <details className="card mt-3 p-4">
            <summary className="cursor-pointer text-sm font-medium">Add or update a specification</summary>
            <ActionForm action={saveSpec} className="mt-3" resetOnSuccess>
              <Hidden name="productId" value={p.id} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Key" name="key" required hint="Existing key = update" />
                <Field label="Label" name="label" required />
                <Field label="Value" name="value" required />
                <Field label="Unit" name="unit" />
                <Field label="Tolerance" name="tolerance" placeholder="e.g. 0/+5 W" />
                <Select label="Source" name="provenance" options={opts(SPEC_PROV)} defaultValue="ENGINEER_ENTERED" />
                <Select label="Source datasheet" name="sourceDocumentId" options={docOpts} empty="None" />
                <Field label="Verified on" name="verifiedAt" type="date" />
              </div>
              <div className="mt-3"><Submit>Save specification</Submit></div>
            </ActionForm>
          </details>
        )}
      </section>

      <section className="mt-6">
        <h2 className="section-title">Supplier prices</h2>
        <p className="mt-1 text-xs text-ink-muted">Each price must come from a supplier quotation; record its reference and validity. When a BOM is recalculated, the lowest unexpired price fills any line that has no price yet; prices someone already entered are never overwritten.</p>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200">
          <table className="table-tech table-compact">
            <thead><tr><th>Price list</th><th>Supplier</th><th className="num">Unit price</th><th>Quote ref</th><th>Valid to</th><th className="num">Lead time</th><th>Source</th>{price && <th />}</tr></thead>
            <tbody>
              {p.prices.map((e) => (
                <tr key={e.id}>
                  <td className="text-xs">{e.priceList.name}{e.priceList.pricesIncludeGst ? " (incl. GST)" : " (excl. GST)"}</td>
                  <td>{e.supplier?.name ?? "—"}</td><td className="num">{formatINR(Number(e.unitPrice))}</td>
                  <td className="text-xs">{e.quoteRef}</td>
                  <td className="text-xs">{e.validTo ? <span className={e.validTo < new Date() ? "text-red-700" : ""}>{formatDate(e.validTo)}{e.validTo < new Date() && " (expired)"}</span> : "—"}</td>
                  <td className="num">{e.leadTimeDays ?? "—"}</td>
                  <td><ProvenanceBadge provenance={e.provenance} /></td>
                  {price && <td><ActionForm action={deletePrice} confirm="Remove this price?"><Hidden name="id" value={e.id} /><Submit variant="danger">Remove</Submit></ActionForm></td>}
                </tr>
              ))}
              {p.prices.length === 0 && <tr><td colSpan={8} className="text-ink-muted">No prices recorded. BOM lines for this product stay unpriced.</td></tr>}
            </tbody>
          </table>
        </div>
        {price && (lists.length === 0 ? <p className="mt-2 text-xs text-ink-muted">Create an active price list under <Link href="/admin/pricing">Pricing & GST</Link> first.</p> : (
          <details className="card mt-3 p-4">
            <summary className="cursor-pointer text-sm font-medium">Record a supplier price</summary>
            <ActionForm action={savePrice} className="mt-3" resetOnSuccess>
              <Hidden name="productId" value={p.id} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select label="Price list" name="priceListId" options={lists.map((l) => ({ value: l.id, label: l.name }))} required />
                <Select label="Supplier" name="supplierId" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} empty="—" />
                <Field label={`Unit price (INR per ${p.unit})`} name="unitPrice" type="number" step="0.01" required />
                <Field label="Quotation reference" name="quoteRef" required />
                <Field label="Valid to" name="validTo" type="date" />
                <Field label="Lead time (days)" name="leadTimeDays" type="number" />
                <Select label="Source" name="provenance" options={[{ value: "SUPPLIER_QUOTED", label: "Supplier-quoted" }, { value: "ENGINEER_ENTERED", label: "Engineer-entered" }, { value: "USER_ESTIMATE", label: "Estimate" }]} />
              </div>
              <div className="mt-3"><Submit>Save price</Submit></div>
            </ActionForm>
          </details>
        ))}
      </section>

      <section className="mt-6">
        <h2 className="section-title">Certifications</h2>
        <p className="mt-1 text-xs text-ink-muted">A certification is only “verified” once the certificate itself is attached and checked. A certified product does not make a project compliant; the project checklist is reviewed separately.</p>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200">
          <table className="table-tech table-compact">
            <thead><tr><th>Standard</th><th>Certificate no.</th><th>Valid until</th><th>Status</th><th>Evidence</th></tr></thead>
            <tbody>
              {p.certifications.map((c) => (
                <tr key={c.id}>
                  <td>{c.standard.code}<span className="block text-xs text-ink-muted">{c.standard.title}</span></td>
                  <td className="text-xs">{c.certificateNo ?? "—"}</td><td className="text-xs">{formatDate(c.validUntil)}</td>
                  <td><VerificationBadge status={c.verificationStatus} />{c.notes && <span className="block text-xs">{c.notes}</span>}</td>
                  <td className="text-xs">{c.document ? <a href={`/api/documents/${c.document.id}`}>{c.document.title}</a> : "—"}</td>
                </tr>
              ))}
              {p.certifications.length === 0 && <tr><td colSpan={5} className="text-ink-muted">No certifications recorded.</td></tr>}
            </tbody>
          </table>
        </div>
        {comp && (
          <details className="card mt-3 p-4">
            <summary className="cursor-pointer text-sm font-medium">Record a certification</summary>
            <ActionForm action={saveCertification} className="mt-3">
              <Hidden name="productId" value={p.id} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Select label="Standard" name="standardId" options={standards.map((s) => ({ value: s.id, label: `${s.code} · ${s.title.slice(0, 50)}` }))} required />
                <Field label="Certificate / registration no." name="certificateNo" />
                <Field label="Valid until" name="validUntil" type="date" />
                <Select label="Certificate document" name="documentId" options={docOpts} empty="None attached" />
                <Select label="Status" name="verificationStatus" options={opts(VERIFICATION_LABEL)} defaultValue="PENDING_VERIFICATION" />
                <Area label="Notes" name="notes" rows={2} />
              </div>
              <div className="mt-3"><Submit>Save certification</Submit></div>
            </ActionForm>
          </details>
        )}
      </section>

      <section className="mt-6">
        <h2 className="section-title">Compatibility records</h2>
        <p className="mt-1 text-xs text-ink-muted">Explicit, engineer-confirmed pairings (for example a clamp range verified against a module frame). Electrical compatibility is also checked by the calculation rules.</p>
        <ul className="mt-3 divide-y divide-slate-100 rounded border border-slate-200 text-sm">
          {compat.map((c) => (
            <li key={c.id} className="px-3 py-2">
              <Badge tone={c.compatible ? "green" : "red"}>{c.compatible ? "compatible" : "not compatible"}</Badge>{" "}
              <Link href={`/admin/products/${c.other.id}`}>{c.other.sku}</Link> · {c.other.name}{c.notes && <span className="text-xs text-ink-muted"> · {c.notes}</span>}
            </li>
          ))}
          {compat.length === 0 && <li className="px-3 py-2 text-ink-muted">None recorded.</li>}
        </ul>
        {compat_ && (
          <ActionForm action={saveCompatibility} className="card mt-3 grid gap-3 p-4 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
            <Hidden name="productAId" value={p.id} />
            <Select label="Other product" name="productBId" options={others.map((o) => ({ value: o.id, label: `${o.sku} · ${o.name}` }))} required />
            <Select label="Result" name="compatible" options={[{ value: "true", label: "Compatible" }, { value: "false", label: "Not compatible" }]} />
            <Field label="Notes / basis" name="notes" />
            <Submit variant="secondary">Save</Submit>
          </ActionForm>
        )}
      </section>

      <section className="mt-6">
        <h2 className="section-title">Documents</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded border border-slate-200 text-sm">
          {p.documents.map((d) => (
            <li key={d.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span><Badge>{d.docType.toLowerCase()}</Badge> <a href={`/api/documents/${d.id}`}>{d.title}</a>{d.revision && ` · rev ${d.revision}`}</span>
              <span className="text-xs text-ink-muted">{d.uploadedBy} · {formatDate(d.createdAt)}{d.expiresAt && ` · expires ${formatDate(d.expiresAt)}`}</span>
            </li>
          ))}
          {p.documents.length === 0 && <li className="px-3 py-2 text-ink-muted">No datasheets or certificates attached.</li>}
        </ul>
        {docs && <DocumentUpload productId={p.id} />}
      </section>
    </>
  );
}
