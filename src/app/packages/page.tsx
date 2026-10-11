import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { sectionLabel } from "@/lib/engine";
import { PHASE_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "Standard rooftop solar packages" };
export const dynamic = "force-dynamic";

const qty = (d: { toString(): string }) => Number(d.toString()).toLocaleString("en-IN", { maximumFractionDigits: 3 });

export default async function PublicPackages() {
  const packages = await prisma.standardPackage.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { lines: { orderBy: { lineNo: "asc" }, include: { product: { select: { sku: true, status: true } } } } },
  });
  return (
    <div className="container-page py-8">
      <p className="eyebrow">Standard packages</p>
      <h1 className="mt-1 text-2xl">Standard Rooftop Solar Packages</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-muted">
        Common system sizes and the main items each one includes. Pick the size closest to your needs and send us an enquiry; our team will contact you to arrange a site survey and a quotation.
      </p>
      <Alert tone="note" className="mt-4 max-w-3xl">
        Item lists are indicative and taken from our standard package documents. Mounting structure, cabling and installation are not listed here and depend on your roof. The final design, quantities and price are confirmed only after a site survey. A package is not a BESCOM approval, and choosing one does not by itself make a project compliant.
      </Alert>

      {packages.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No standard packages are listed right now. <Link href="/#enquiry">Send us an enquiry</Link> or <Link href="/configure">configure a project</Link> instead.</p>
      ) : (
        <ul className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
          {packages.map((p) => (
            <li key={p.id} id={p.code} className="card flex min-w-0 scroll-mt-20 flex-col p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{qty(p.capacityKwp)} kWp</h2>
                <Badge>{PHASE_LABEL[p.supplyPhase]}</Badge>
              </div>
              <p className="text-xs text-ink-muted">{p.name}{p.moduleCount && p.moduleWp ? ` · ${p.moduleCount} × ${p.moduleWp} Wp modules` : ""}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="table-tech table-compact">
                  <caption className="sr-only">Items in {p.name}</caption>
                  <thead><tr><th>Item</th><th className="num">Qty</th><th>Make / scope</th></tr></thead>
                  <tbody>{p.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.product?.status === "ACTIVE" ? <Link href={`/catalogue/${encodeURIComponent(l.product.sku)}`}>{l.description}</Link> : l.description}
                        <span className="block text-xs text-ink-muted">{sectionLabel(l.section)}</span>
                      </td>
                      <td className="num whitespace-nowrap">{qty(l.quantity)} {l.unit}</td>
                      <td className="text-xs">{l.makeScope ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <details className="mt-auto pt-3">
                <summary className="btn-primary btn-sm cursor-pointer list-none">Enquire about this package</summary>
                <div className="mt-3">
                  <EnquiryForm source="package-quote" packageCode={p.code} compact idPrefix={`pkg-${p.code}`}
                    defaultMessage={`I'm interested in the ${p.name} package (${qty(p.capacityKwp)} kWp, ${PHASE_LABEL[p.supplyPhase].toLowerCase()}).`} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-ink-muted">Need something different? <Link href="/configure">Configure your own project</Link> or <Link href="/#enquiry">send a general enquiry</Link>.</p>
    </div>
  );
}
