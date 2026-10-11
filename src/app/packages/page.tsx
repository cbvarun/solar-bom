import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { PackageFilterBar } from "@/components/packages/PackageFilterBar";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { sectionLabel } from "@/lib/engine";
import { CUSTOMER_TYPE_LABEL, PHASE_LABEL, ROOF_LABEL, SYSTEM_LABEL } from "@/lib/format";
import { filterPackages, parsePackageFilters, type PackageFilters } from "@/lib/package-filter";

export const metadata: Metadata = { title: "Standard rooftop solar packages" };
export const dynamic = "force-dynamic";

const qty = (d: number | { toString(): string }) => Number(d.toString()).toLocaleString("en-IN", { maximumFractionDigits: 3 });

const loadPackages = async () => (await prisma.standardPackage.findMany({
  where: { active: true },
  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  include: { lines: { orderBy: { lineNo: "asc" }, include: { product: { select: { sku: true, status: true } } } } },
})).map((p) => ({ ...p, capacityKwp: Number(p.capacityKwp) }));
type Pkg = Awaited<ReturnType<typeof loadPackages>>[number];

const listOr = (values: string[], labels: Record<string, string>, any: string) => (values.length ? values.map((v) => labels[v] ?? v).join(", ") : any);

function PackageCard({ p, target }: { p: Pkg; target: number | null }) {
  const diff = target == null ? null : p.capacityKwp - target;
  return (
    <li id={p.code} className="min-w-0 scroll-mt-20 md:has-[>details[open]]:col-span-2 xl:has-[>details[open]]:col-span-3">
      <details className="group card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="text-lg font-semibold">{qty(p.capacityKwp)} kWp</h2>
              <span className="text-sm text-ink-muted">{PHASE_LABEL[p.supplyPhase]} · {SYSTEM_LABEL[p.systemType]}</span>
            </div>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
              {p.moduleCount && p.moduleWp && <><dt className="text-ink-muted">Modules</dt><dd>{p.moduleCount} × {p.moduleWp} Wp</dd></>}
              <dt className="text-ink-muted">Suits</dt><dd>{listOr(p.customerTypes, CUSTOMER_TYPE_LABEL, "Any customer type")}</dd>
              <dt className="text-ink-muted">Roof</dt><dd>{listOr(p.roofTypes, ROOF_LABEL, "Any roof (structure chosen at survey)")}</dd>
            </dl>
            {diff != null && (
              <p className="mt-2"><Badge tone={Math.abs(diff) < 0.05 ? "green" : "gray"}>
                {Math.abs(diff) < 0.05 ? "Matches your target" : `${qty(Math.abs(diff))} kWp ${diff > 0 ? "above" : "below"} your target`}
              </Badge></p>
            )}
          </div>
          <span className="mt-1 flex items-center gap-1 whitespace-nowrap text-xs text-brand-700">
            <span className="group-open:hidden">Details</span><span className="hidden group-open:inline">Hide</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-open:rotate-180" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" /></svg>
          </span>
        </summary>
        <div className="border-t border-slate-200 p-4">
          <p className="text-xs text-ink-muted">{p.name} · items as listed in our standard package</p>
          <div className="mt-2 overflow-x-auto">
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
          <p className="mt-2 text-xs text-ink-muted">Not listed: mounting structure, cabling and installation, which depend on your roof.</p>
          <details className="mt-3">
            <summary className="btn-primary btn-sm cursor-pointer list-none">Enquire about this package</summary>
            <div className="mt-3">
              <EnquiryForm source="package-quote" packageCode={p.code} compact idPrefix={`pkg-${p.code}`}
                defaultMessage={`I'm interested in the ${p.name} package (${qty(p.capacityKwp)} kWp, ${PHASE_LABEL[p.supplyPhase].toLowerCase()}).`} />
            </div>
          </details>
        </div>
      </details>
    </li>
  );
}

const isFiltered = (f: PackageFilters) => f.customer !== "RESIDENTIAL" || f.kwp != null || f.roof || f.config || f.supply || f.sort !== "recommended";

export default async function PublicPackages({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = parsePackageFilters(await searchParams);
  const packages = await loadPackages();
  const { shown, closest } = filterPackages(packages, filters);
  return (
    <div className="container-page py-8">
      <p className="eyebrow">Standard packages</p>
      <h1 className="mt-1 text-2xl">Standard Rooftop Solar Packages</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-muted">
        Common system sizes and the main items each one includes. Narrow them down below, open a package for its item list, and send us an enquiry; our team will arrange a site survey and a quotation.
      </p>

      <div className="mt-5"><PackageFilterBar value={filters} /></div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p aria-live="polite">Showing <strong>{shown.length}</strong> of {packages.length} package{packages.length === 1 ? "" : "s"}</p>
        {isFiltered(filters) && <Link href="/packages" scroll={false} className="text-sm">Reset filters</Link>}
      </div>

      {shown.length > 0 ? (
        <ul className="mt-3 grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => <PackageCard key={p.id} p={p} target={filters.kwp} />)}
        </ul>
      ) : (
        <div className="mt-3">
          <p className="card p-4 text-sm">
            No standard package matches these filters{filters.kwp ? ` within 25% of ${qty(filters.kwp)} kWp` : ""}. You can <Link href="/configure">configure your own project</Link> or <Link href="/#enquiry">send a general enquiry</Link>.
          </p>
          {closest.length > 0 && (
            <>
              <h2 className="section-title mt-6">Closest packages</h2>
              <ul className="mt-3 grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                {closest.map((p) => <PackageCard key={p.id} p={p} target={filters.kwp} />)}
              </ul>
            </>
          )}
        </div>
      )}

      <Alert tone="note" className="mt-8 max-w-3xl">
        Item lists are indicative and taken from our standard package documents. The final design, quantities and price are confirmed only after a site survey. A package is not a BESCOM approval, and choosing one does not by itself make a project compliant.
      </Alert>
    </div>
  );
}
