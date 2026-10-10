import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { bestPrice, formatSpecValue, productCardInclude } from "@/lib/server/catalogue";
import { AvailabilityBadge, ProvenanceBadge } from "@/components/ui/Badge";
import { ProductImage } from "@/components/ProductImage";
import { formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Compare components" };
export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ skus?: string }> }) {
  const skus = ((await searchParams).skus ?? "").split(",").map((s) => decodeURIComponent(s.trim())).filter(Boolean).slice(0, 4);
  const products = await prisma.product.findMany({ where: { sku: { in: skus } }, include: productCardInclude });
  const ordered = skus.map((s) => products.find((p) => p.sku === s)).filter((p): p is NonNullable<typeof p> => !!p);
  if (ordered.length < 2) {
    return <div className="container-page py-12"><p>Select at least two components from the <Link href="/catalogue">catalogue</Link> to compare.</p></div>;
  }
  const keys: { key: string; label: string }[] = [];
  for (const p of ordered) for (const s of p.specifications) if (s.key !== "bom_role" && !keys.some((k) => k.key === s.key)) keys.push({ key: s.key, label: s.label });
  const differs = (key: string) => new Set(ordered.map((p) => { const s = p.specifications.find((x) => x.key === key); return s ? formatSpecValue(s) : "—"; })).size > 1;

  return (
    <div className="container-page py-8">
      <p className="eyebrow">Catalogue</p>
      <h1 className="mt-1 text-2xl">Compare components</h1>
      <p className="mt-1 text-sm text-ink-muted">Differences are highlighted. Check the source of each value before relying on it.</p>
      <div className="card mt-6 overflow-x-auto">
        <table className="table-tech table-compact min-w-[640px]">
          <thead>
            <tr>
              <th className="w-48">Parameter</th>
              {ordered.map((p) => (
                <th key={p.id} className="normal-case tracking-normal">
                  <div className="h-20 w-32"><ProductImage category={p.category.slug} imageUrl={p.imageUrl} alt={p.name} /></div>
                  <Link href={`/catalogue/${encodeURIComponent(p.sku)}`} className="mt-1 block text-sm font-semibold text-ink">{p.name}</Link>
                  <span className="block text-xs font-normal">{p.manufacturer.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><td>Item code</td>{ordered.map((p) => <td key={p.id} className="font-mono text-xs">{p.sku}</td>)}</tr>
            <tr><td>Model</td>{ordered.map((p) => <td key={p.id}>{p.model}</td>)}</tr>
            <tr><td>Data provenance</td>{ordered.map((p) => <td key={p.id}><ProvenanceBadge provenance={p.provenance} /></td>)}</tr>
            {keys.map((k) => (
              <tr key={k.key} className={differs(k.key) ? "bg-solar-50/60" : undefined}>
                <td>{k.label}</td>
                {ordered.map((p) => { const s = p.specifications.find((x) => x.key === k.key); return <td key={p.id} className="tabular-nums">{s ? formatSpecValue(s) : "—"}</td>; })}
              </tr>
            ))}
            <tr><td>Dimensions</td>{ordered.map((p) => <td key={p.id}>{p.dimensionsText ?? "—"}</td>)}</tr>
            <tr><td>Weight</td>{ordered.map((p) => <td key={p.id}>{p.weightKg != null ? `${Number(p.weightKg)} kg` : "—"}</td>)}</tr>
            <tr><td>Warranty</td>{ordered.map((p) => <td key={p.id}>{p.warrantyText ?? "Not stated"}</td>)}</tr>
            <tr><td>Indicative price</td>{ordered.map((p) => { const pr = bestPrice(p); return <td key={p.id}>{pr ? `${formatINR(pr.unitPrice)} / ${p.unit}` : "On request"}</td>; })}</tr>
            <tr><td>Availability</td>{ordered.map((p) => <td key={p.id}><AvailabilityBadge status={p.availability} leadTimeDays={p.leadTimeDays} /></td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
