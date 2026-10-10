import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { bestPrice, keySpecs, searchProducts } from "@/lib/server/catalogue";
import { ProductImage } from "@/components/ProductImage";
import { AvailabilityBadge, Badge } from "@/components/ui/Badge";
import { formatINR, AVAILABILITY_LABEL } from "@/lib/format";
import { CompareBar, CompareToggle } from "./CompareControls";

export const metadata: Metadata = { title: "Solar component catalogue" };
export const dynamic = "force-dynamic";

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [categories, manufacturers, products] = await Promise.all([
    prisma.productCategory.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } } }),
    prisma.manufacturer.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    searchProducts({ q: sp.q, category: sp.category, manufacturer: sp.manufacturer, availability: sp.availability }),
  ]);
  const activeCat = categories.find((c) => c.slug === sp.category);

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-1 text-2xl">{activeCat?.name ?? "Solar component catalogue"}</h1>
          <p className="mt-1 text-sm text-ink-muted">{products.length} item{products.length === 1 ? "" : "s"}. Specifications show their data provenance; illustrative template records are clearly marked.</p>
        </div>
        <form className="flex w-full gap-2 sm:w-auto" role="search">
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          <label htmlFor="q" className="sr-only">Search components</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Search name, model, SKU, manufacturer" className="input sm:w-80" />
          <button className="btn-primary">Search</button>
        </form>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filters" className="space-y-6">
          <nav aria-label="Categories">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Category</p>
            <ul className="mt-2 space-y-0.5 text-sm">
              <li><Link href={{ pathname: "/catalogue", query: { ...sp, category: undefined } }} className={!sp.category ? "font-semibold text-brand-900 no-underline" : "text-ink-muted no-underline hover:text-ink"}>All categories</Link></li>
              {categories.map((c, i) => (
                <li key={c.id}>
                  <Link href={{ pathname: "/catalogue", query: { ...sp, category: c.slug } }} className={`flex justify-between gap-2 no-underline ${sp.category === c.slug ? "font-semibold text-brand-900" : "text-ink-muted hover:text-ink"}`}>
                    <span>{i + 1}. {c.name}</span><span className="text-xs text-ink-faint">{c._count.products}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <form className="space-y-3">
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            {sp.q && <input type="hidden" name="q" value={sp.q} />}
            <div>
              <label className="label" htmlFor="manufacturer">Manufacturer</label>
              <select id="manufacturer" name="manufacturer" defaultValue={sp.manufacturer ?? ""} className="input mt-1">
                <option value="">All manufacturers</option>
                {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="availability">Availability</label>
              <select id="availability" name="availability" defaultValue={sp.availability ?? ""} className="input mt-1">
                <option value="">Any</option>
                {Object.entries(AVAILABILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary btn-sm">Apply</button>
              <Link href="/catalogue" className="btn-ghost btn-sm">Reset</Link>
            </div>
          </form>
        </aside>

        <section aria-label="Products">
          {products.length === 0 ? (
            <div className="card p-8 text-center text-sm text-ink-muted">No components match these filters.</div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => {
                const price = bestPrice(p);
                return (
                  <li key={p.id} className="card flex flex-col overflow-hidden">
                    <Link href={`/catalogue/${encodeURIComponent(p.sku)}`} className="block aspect-[16/9] border-b border-slate-100"><ProductImage category={p.category.slug} imageUrl={p.imageUrl} alt={p.name} /></Link>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-ink-muted">{p.sku}</span>
                        {p.illustrative && <Badge tone="gray" title="Generic template record — not a real product">Illustrative</Badge>}
                      </div>
                      <h2 className="mt-1 text-sm font-semibold leading-snug">
                        <Link href={`/catalogue/${encodeURIComponent(p.sku)}`} className="text-ink no-underline hover:text-brand-800">{p.name}</Link>
                      </h2>
                      <p className="text-xs text-ink-muted">{p.manufacturer.name} · {p.model}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {keySpecs(p).map((s) => (
                          <div key={s.label} className="contents"><dt className="text-ink-muted">{s.label}</dt><dd className="text-right font-medium tabular-nums">{s.value}</dd></div>
                        ))}
                      </dl>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                        <div className="text-xs">
                          <p className="font-semibold">{price ? `${formatINR(price.unitPrice)} / ${p.unit}` : "Price on request"}</p>
                          <AvailabilityBadge status={p.availability} leadTimeDays={p.leadTimeDays} />
                        </div>
                        <CompareToggle sku={p.sku} category={p.category.slug} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <CompareBar />
    </div>
  );
}
