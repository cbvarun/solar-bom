import { describe, expect, it } from "vitest";
import { filterPackages, parsePackageFilters, type FilterablePackage } from "../../package-filter";

const pkg = (capacityKwp: number, supplyPhase: string, extra: Partial<FilterablePackage> = {}): FilterablePackage & { id: string } => ({
  id: `${capacityKwp}-${supplyPhase}`, capacityKwp, supplyPhase, systemType: "GRID_TIED", moduleCount: Math.round(capacityKwp / 0.59),
  customerTypes: ["RESIDENTIAL"], roofTypes: [], sortOrder: capacityKwp * 10, ...extra,
});
const all = [pkg(2.36, "SINGLE"), pkg(4.72, "SINGLE"), pkg(5.31, "SINGLE"), pkg(5.31, "THREE"), pkg(10.03, "THREE"), pkg(20, "THREE", { customerTypes: [] })];
const ids = (r: { id: string }[]) => r.map((p) => p.id);

describe("parsePackageFilters", () => {
  it("defaults to residential and recommended order", () => {
    expect(parsePackageFilters({})).toMatchObject({ customer: "RESIDENTIAL", kwp: null, roof: null, sort: "recommended" });
  });
  it("lets 'any' clear the customer type and ignores bad values", () => {
    expect(parsePackageFilters({ customer: "any", kwp: "-3", supply: "FOUR", sort: "x" })).toMatchObject({ customer: null, kwp: null, supply: null, sort: "recommended" });
  });
});

describe("filterPackages", () => {
  it("keeps unrestricted packages for any customer type", () => {
    expect(ids(filterPackages(all, parsePackageFilters({ customer: "COMMERCIAL" })).shown)).toEqual(["20-THREE"]);
  });
  it("matches capacity within 25% and puts the closest first", () => {
    const r = filterPackages(all, parsePackageFilters({ kwp: "5" }));
    expect(ids(r.shown)).toEqual(["4.72-SINGLE", "5.31-SINGLE", "5.31-THREE"]);
  });
  it("combines supply with capacity", () => {
    expect(ids(filterPackages(all, parsePackageFilters({ kwp: "5", supply: "THREE" })).shown)).toEqual(["5.31-THREE"]);
  });
  it("suggests the nearest packages when nothing is within range", () => {
    const r = filterPackages(all, parsePackageFilters({ kwp: "14" }));
    expect(r.shown).toEqual([]);
    expect(ids(r.closest)).toEqual(["10.03-THREE", "20-THREE"]);
  });
  it("treats an empty roof list as suitable for every roof", () => {
    const roofed = [...all, pkg(3, "SINGLE", { roofTypes: ["METAL_SHEET"] })];
    expect(ids(filterPackages(roofed, parsePackageFilters({ roof: "RCC_FLAT", kwp: "3" })).shown)).toEqual(["2.36-SINGLE"]);
    expect(ids(filterPackages(roofed, parsePackageFilters({ roof: "METAL_SHEET", kwp: "3" })).shown)).toEqual(["3-SINGLE", "2.36-SINGLE"]);
  });
  it("sorts by capacity both ways", () => {
    const f = parsePackageFilters({ customer: "any", sort: "capacity-desc" });
    expect(filterPackages(all, f).shown[0].capacityKwp).toBe(20);
    expect(filterPackages(all, { ...f, sort: "capacity-asc" }).shown[0].capacityKwp).toBe(2.36);
  });
});
