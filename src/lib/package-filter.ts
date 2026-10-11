/** Filters and sorting for the public standard packages page. Pure so it can be unit tested. */

export const CUSTOMER_TYPES = ["RESIDENTIAL", "APARTMENT", "COMMERCIAL", "INDUSTRIAL"] as const;
export const ROOF_TYPES = ["RCC_FLAT", "METAL_SHEET", "SLOPED"] as const;
export const SYSTEM_TYPES = ["GRID_TIED", "HYBRID", "OFF_GRID"] as const;
export const SUPPLY_PHASES = ["SINGLE", "THREE"] as const;
export const PACKAGE_SORTS = { recommended: "Recommended", "capacity-asc": "Capacity: low to high", "capacity-desc": "Capacity: high to low", "modules-asc": "Fewest modules" } as const;
export type PackageSort = keyof typeof PACKAGE_SORTS;

/** A package within this fraction of the target capacity counts as a match. */
export const CAPACITY_TOLERANCE = 0.25;

export interface PackageFilters {
  customer: (typeof CUSTOMER_TYPES)[number] | null;
  kwp: number | null;
  roof: (typeof ROOF_TYPES)[number] | null;
  config: (typeof SYSTEM_TYPES)[number] | null;
  supply: (typeof SUPPLY_PHASES)[number] | null;
  sort: PackageSort;
}

export interface FilterablePackage {
  capacityKwp: number;
  supplyPhase: string;
  systemType: string;
  moduleCount: number | null;
  customerTypes: string[];
  roofTypes: string[];
  sortOrder: number;
}

const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | null => (allowed as readonly string[]).includes(v ?? "") ? (v as T) : null;

/** Read filters from the query string. Customer type defaults to residential; "any" clears it. */
export function parsePackageFilters(sp: Record<string, string | undefined>): PackageFilters {
  const kwp = Number(sp.kwp);
  return {
    customer: sp.customer === undefined || sp.customer === "" ? "RESIDENTIAL" : pick(sp.customer, CUSTOMER_TYPES),
    kwp: Number.isFinite(kwp) && kwp > 0 && kwp <= 10000 ? kwp : null,
    roof: pick(sp.roof, ROOF_TYPES),
    config: pick(sp.config, SYSTEM_TYPES),
    supply: pick(sp.supply, SUPPLY_PHASES),
    sort: sp.sort && sp.sort in PACKAGE_SORTS ? (sp.sort as PackageSort) : "recommended",
  };
}

const withinTarget = (capacity: number, target: number) => Math.abs(capacity - target) <= target * CAPACITY_TOLERANCE;

/**
 * Apply filters and sort. Customer and roof lists that are empty mean the package is not
 * restricted. When nothing is near the target capacity, `closest` holds the packages that
 * pass the other filters, nearest first, so the page can suggest them.
 */
export function filterPackages<T extends FilterablePackage>(pkgs: T[], f: PackageFilters): { shown: T[]; closest: T[] } {
  const base = pkgs.filter((p) =>
    (!f.customer || p.customerTypes.length === 0 || p.customerTypes.includes(f.customer)) &&
    (!f.roof || p.roofTypes.length === 0 || p.roofTypes.includes(f.roof)) &&
    (!f.config || p.systemType === f.config) &&
    (!f.supply || p.supplyPhase === f.supply));
  const gap = (p: T) => (f.kwp == null ? 0 : Math.abs(p.capacityKwp - f.kwp));
  const order = (a: T, b: T) => {
    switch (f.sort) {
      case "capacity-asc": return a.capacityKwp - b.capacityKwp;
      case "capacity-desc": return b.capacityKwp - a.capacityKwp;
      case "modules-asc": return (a.moduleCount ?? Infinity) - (b.moduleCount ?? Infinity) || a.capacityKwp - b.capacityKwp;
      default: return gap(a) - gap(b) || a.sortOrder - b.sortOrder || a.capacityKwp - b.capacityKwp;
    }
  };
  const shown = (f.kwp == null ? base : base.filter((p) => withinTarget(p.capacityKwp, f.kwp!))).sort(order);
  const closest = shown.length || f.kwp == null ? [] : [...base].sort((a, b) => gap(a) - gap(b)).slice(0, 2);
  return { shown, closest };
}
