import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { adminCtx } from "@/lib/server/admin-page";
import { PageHead } from "@/components/admin/Fields";
import { Badge, ProvenanceBadge } from "@/components/ui/Badge";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string }> }) {
  const { can } = await adminCtx();
  const sp = await searchParams;
  const where: Prisma.ProductWhereInput = {};
  if (sp.status) where.status = sp.status as never;
  if (sp.category) where.categoryId = sp.category;
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }, { model: { contains: sp.q, mode: "insensitive" } }];
  const [products, cats] = await Promise.all([
    prisma.product.findMany({ where, include: { category: true, manufacturer: true, _count: { select: { specifications: true, prices: true, documents: true } } }, orderBy: [{ category: { sortOrder: "asc" } }, { sku: "asc" }], take: 500 }),
    prisma.productCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHead title="Products" actions={can("products.edit") && <Link href="/admin/products/new" className="btn-primary btn-sm">Add product</Link>}>
        Edit catalogue records, technical specifications, supplier prices, certifications and documents. Draft and archived products are hidden from the public catalogue and the BOM engine.
      </PageHead>
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <label className="block"><span className="label text-xs">Search</span><input name="q" defaultValue={sp.q} className="input mt-1 py-1.5" placeholder="SKU, name or model" /></label>
        <label className="block"><span className="label text-xs">Category</span>
          <select name="category" defaultValue={sp.category ?? ""} className="input mt-1 py-1.5"><option value="">All</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block"><span className="label text-xs">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="input mt-1 py-1.5"><option value="">All</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select></label>
        <button className="btn-secondary btn-sm">Filter</button>
      </form>
      <p className="mb-2 text-xs text-ink-muted">{products.length} product(s)</p>
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="table-tech table-compact">
          <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Data source</th><th className="num">Specs</th><th className="num">Prices</th><th className="num">Docs</th><th>Status</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs"><Link href={`/admin/products/${p.id}`}>{p.sku}</Link></td>
                <td>{p.name}<span className="block text-xs text-ink-muted">{p.manufacturer.name} · {p.model}</span></td>
                <td className="text-xs">{p.category.name}</td>
                <td><ProvenanceBadge provenance={p.provenance} /></td>
                <td className="num">{p._count.specifications}</td>
                <td className="num">{p._count.prices}</td>
                <td className="num">{p._count.documents}</td>
                <td><Badge tone={p.status === "ACTIVE" ? "green" : p.status === "DRAFT" ? "yellow" : "gray"}>{p.status.toLowerCase()}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
