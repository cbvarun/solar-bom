import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { bestPrice, formatSpecValue, productCardInclude } from "@/lib/server/catalogue";
import { editableProjects } from "@/lib/server/access";
import { ProductImage } from "@/components/ProductImage";
import { Alert } from "@/components/ui/Alert";
import { AvailabilityBadge, Badge, ProvenanceBadge, VerificationBadge } from "@/components/ui/Badge";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { formatDate, formatINR } from "@/lib/format";
import { AddToBom } from "./AddToBom";

export const dynamic = "force-dynamic";

async function load(sku: string) {
  return prisma.product.findUnique({
    where: { sku: decodeURIComponent(sku) },
    include: {
      ...productCardInclude,
      taxClass: true,
      documents: { orderBy: { createdAt: "desc" } },
      certifications: { include: { standard: true, document: true } },
      compatibilityA: { include: { productB: { include: { manufacturer: true } } } },
      compatibilityB: { include: { productA: { include: { manufacturer: true } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }): Promise<Metadata> {
  const p = await load((await params).sku);
  return { title: p ? `${p.name} (${p.sku})` : "Product not found" };
}

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const p = await load((await params).sku);
  if (!p || p.status === "DRAFT") notFound();
  const price = bestPrice(p);
  const projects = await editableProjects();
  const datasheets = p.documents.filter((d) => d.docType === "DATASHEET");
  const otherDocs = p.documents.filter((d) => d.docType !== "DATASHEET");
  const suppliers = [...new Map(p.prices.filter((e) => e.supplier).map((e) => [e.supplier!.id, e.supplier!])).values()];
  const compat = [
    ...p.compatibilityA.map((c) => ({ id: c.id, other: c.productB, compatible: c.compatible, notes: c.notes, provenance: c.provenance })),
    ...p.compatibilityB.map((c) => ({ id: c.id, other: c.productA, compatible: c.compatible, notes: c.notes, provenance: c.provenance })),
  ];
  const ratingSpecs = p.specifications.filter((s) => s.key !== "bom_role");

  return (
    <div className="container-page py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-muted">
        <Link href="/catalogue">Catalogue</Link> / <Link href={`/catalogue?category=${p.category.slug}`}>{p.category.name}</Link> / <span>{p.sku}</span>
      </nav>

      {p.status === "ARCHIVED" && <Alert tone="warning" className="mt-4">This product is archived and is not offered for new projects.</Alert>}
      {p.illustrative && (
        <Alert tone="note" className="mt-4" title="Illustrative template record">
          This is a generic template used to demonstrate the catalogue and BOM engine. It is not a real product, and its values are not a manufacturer datasheet.
          Replace it with verified manufacturer data before procurement.
        </Alert>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <div className="card aspect-[4/3] overflow-hidden"><ProductImage category={p.category.slug} imageUrl={p.imageUrl} alt={p.name} /></div>
          {!p.imageUrl && <p className="mt-2 text-xs text-ink-muted">Schematic illustration. No verified product image uploaded.</p>}
        </div>
        <div>
          <p className="eyebrow">{p.category.name}</p>
          <h1 className="mt-1 text-2xl">{p.name}</h1>
          <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-ink-muted">Manufacturer</dt><dd>{p.manufacturer.name}</dd>
            <dt className="text-ink-muted">Model</dt><dd className="font-mono">{p.model}</dd>
            <dt className="text-ink-muted">Item code (SKU)</dt><dd className="font-mono">{p.sku}</dd>
            <dt className="text-ink-muted">Quantity unit</dt><dd>{p.unit}</dd>
            <dt className="text-ink-muted">Data provenance</dt><dd><ProvenanceBadge provenance={p.provenance} /></dd>
            <dt className="text-ink-muted">Stock / lead time</dt><dd><AvailabilityBadge status={p.availability} leadTimeDays={p.leadTimeDays} /></dd>
            <dt className="text-ink-muted">Indicative price</dt>
            <dd>{price ? (
              <span>{formatINR(price.unitPrice)} / {p.unit} <span className="text-xs text-ink-muted">({price.includesGst ? "incl." : "excl."} GST · {price.supplier ?? "supplier"} · valid to {formatDate(price.validTo)})</span></span>
            ) : <span>Price on request <span className="text-xs text-ink-muted">(no current supplier quotation on record)</span></span>}</dd>
            <dt className="text-ink-muted">GST classification</dt>
            <dd>{p.taxClass ? <>{p.taxClass.code} — {p.taxClass.ratePercent != null ? `${Number(p.taxClass.ratePercent)}%` : <span className="text-ink-muted">rate not configured</span>}</> : <span className="text-ink-muted">Not classified</span>}</dd>
            <dt className="text-ink-muted">Warranty</dt>
            <dd>{p.warrantyText ? <>{p.warrantyText} {p.warrantyProvenance && <ProvenanceBadge provenance={p.warrantyProvenance} />}</> : <span className="text-ink-muted">Not stated — awaiting manufacturer documentation</span>}</dd>
          </dl>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <AddToBom productId={p.id} unit={p.unit} projects={projects} disabled={p.status !== "ACTIVE"} />
            <a href="#quote" className="btn-secondary">Request a Quote</a>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="section-title">Technical specifications</h2>
          <div className="card mt-3 overflow-x-auto">
            <table className="table-tech table-compact">
              <thead><tr><th>Parameter</th><th className="num">Value</th><th>Tolerance</th><th>Source</th></tr></thead>
              <tbody>
                {ratingSpecs.map((s) => (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td className="num whitespace-nowrap">{formatSpecValue(s)}</td>
                    <td className="text-ink-muted">{s.tolerance ?? "—"}</td>
                    <td><ProvenanceBadge provenance={s.provenance} />{s.verifiedAt && <span className="ml-1 text-xs text-ink-muted">{formatDate(s.verifiedAt)}</span>}</td>
                  </tr>
                ))}
                <tr><td>Dimensions</td><td className="num">{p.dimensionsText ?? "—"}</td><td /><td /></tr>
                <tr><td>Weight</td><td className="num">{p.weightKg != null ? `${Number(p.weightKg)} kg` : "—"}</td><td /><td /></tr>
                <tr><td>Material</td><td className="num">{p.material ?? "—"}</td><td /><td /></tr>
                <tr><td>Ingress protection</td><td className="num">{p.ipRating ?? "—"}</td><td /><td /></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-8">
          <div>
            <h2 className="section-title">Certifications</h2>
            {p.certifications.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No certifications on record. Certification claims are only shown once a certificate is uploaded and verified.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {p.certifications.map((c) => (
                  <li key={c.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span>{c.standard.code} — {c.standard.title}{c.certificateNo && <span className="text-ink-muted"> · Cert. {c.certificateNo}</span>}</span>
                    <VerificationBadge status={c.verificationStatus} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-muted">A certified product does not by itself make a project compliant; see the project compliance checklist.</p>
          </div>

          <div>
            <h2 className="section-title">Technical documents</h2>
            {datasheets.length + otherDocs.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No verified datasheet or certificate uploaded yet.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {[...datasheets, ...otherDocs].map((d) => (
                  <li key={d.id}>
                    <a href={d.storageKey ? `/api/documents/${d.id}` : d.externalUrl ?? "#"} target={d.externalUrl ? "_blank" : undefined} rel="noreferrer">{d.title}</a>{" "}
                    <Badge>{d.docType.toLowerCase()}</Badge> {d.revision && <span className="text-xs text-ink-muted">rev. {d.revision}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="section-title">Compatibility</h2>
            {compat.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No explicit compatibility records. Module–inverter compatibility is checked per project by the calculation engine (string voltage, MPPT window, current, phase and DC/AC ratio).</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {compat.map((c) => (
                  <li key={c.id}>
                    <Badge tone={c.compatible ? "green" : "red"}>{c.compatible ? "Compatible" : "Incompatible"}</Badge>{" "}
                    <Link href={`/catalogue/${encodeURIComponent(c.other.sku)}`}>{c.other.name}</Link>{c.notes && <span className="text-ink-muted"> — {c.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="section-title">Suppliers</h2>
            {suppliers.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No supplier linked yet.</p> : (
              <ul className="mt-2 text-sm">{suppliers.map((s) => <li key={s.id}>{s.name}{s.city && <span className="text-ink-muted"> · {s.city}</span>}</li>)}</ul>
            )}
          </div>
        </section>
      </div>

      <section id="quote" className="mt-10 scroll-mt-20">
        <h2 className="section-title">Request a quote</h2>
        <div className="card mt-3 max-w-2xl p-5">
          <EnquiryForm source="product-quote" productSku={p.sku} compact defaultMessage={`Please quote for ${p.name} (${p.sku}). Quantity: `} />
        </div>
      </section>
    </div>
  );
}
