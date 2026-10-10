import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const productCardInclude = {
  category: true,
  manufacturer: true,
  specifications: { orderBy: { sortOrder: "asc" } },
  prices: { include: { supplier: true, priceList: true } },
} as const;
export type ProductCard = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export interface CatalogueFilters {
  q?: string;
  category?: string;
  manufacturer?: string;
  availability?: string;
}

export async function searchProducts(f: CatalogueFilters) {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  if (f.category) where.category = { slug: f.category };
  if (f.manufacturer) where.manufacturerId = f.manufacturer;
  if (f.availability) where.availability = f.availability as Prisma.EnumAvailabilityStatusFilter["equals"];
  if (f.q) {
    const q = f.q.trim().slice(0, 100);
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { manufacturer: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  return prisma.product.findMany({ where, include: productCardInclude, orderBy: [{ category: { sortOrder: "asc" } }, { sku: "asc" }], take: 200 });
}

const KEY_SPECS: Record<string, string[]> = {
  "pv-modules": ["pmax_w", "voc_v", "isc_a"],
  inverters: ["rated_ac_w", "phase", "mppt_count", "max_dc_voltage_v"],
  "mounting-structures": ["material_class", "rail_stock_length_m"],
  "dc-cables-connectors": ["csa_mm2", "ampacity_a"],
  "ac-cables-accessories": ["csa_mm2", "cores"],
};

export function keySpecs(p: ProductCard): { label: string; value: string }[] {
  const keys = KEY_SPECS[p.category.slug] ?? [];
  const out: { label: string; value: string }[] = [];
  for (const k of keys) {
    const s = p.specifications.find((x) => x.key === k);
    if (!s) continue;
    out.push({ label: s.label, value: formatSpecValue(s) });
  }
  if (p.ipRating) out.push({ label: "Ingress protection", value: p.ipRating });
  return out.slice(0, 4);
}

export function formatSpecValue(s: { valueNumber: Prisma.Decimal | null; valueText: string | null; unit: string | null; key?: string }): string {
  if (s.valueNumber != null) {
    const n = Number(s.valueNumber);
    if (s.unit === "1/0") return n >= 1 ? "Yes" : "No";
    return `${n.toLocaleString("en-IN", { maximumFractionDigits: 3 })}${s.unit ? ` ${s.unit}` : ""}`;
  }
  const t = s.valueText ?? "—";
  const map: Record<string, string> = { SINGLE: "Single-phase", THREE: "Three-phase", GRID_TIED: "Grid-tied", HYBRID: "Hybrid", OFF_GRID: "Off-grid", RCC_FLAT: "RCC flat roof" };
  return t.split(",").map((x) => map[x.trim()] ?? x.trim()).join(", ");
}

/** Lowest current supplier-quoted price, if any. Never invented. */
export function bestPrice(p: ProductCard) {
  const now = new Date();
  const valid = p.prices.filter((e) => e.priceList.active && (!e.validTo || e.validTo > now));
  if (!valid.length) return null;
  const e = valid.sort((a, b) => Number(a.unitPrice) - Number(b.unitPrice))[0];
  return { unitPrice: Number(e.unitPrice), includesGst: e.priceList.pricesIncludeGst, supplier: e.supplier?.name ?? null, provenance: e.provenance, validTo: e.validTo, quoteRef: e.quoteRef };
}
