import { describe, expect, it } from "vitest";
import { combinedLossPct, compassToPvgisAspect, computeSavings, computeSubsidy, polygonAreaM2, scaleGeneration } from "..";

describe("roof outline area", () => {
  it("measures a 10 m × 20 m rectangle in Bengaluru within 0.5%", () => {
    const lat = 12.9716, lon = 77.5946;
    const dLat = 10 / 111_195;
    const dLon = 20 / (111_195 * Math.cos((lat * Math.PI) / 180));
    const a = polygonAreaM2([[lat, lon], [lat + dLat, lon], [lat + dLat, lon + dLon], [lat, lon + dLon]]);
    expect(a).toBeGreaterThan(199);
    expect(a).toBeLessThan(201);
  });
  it("returns 0 for fewer than three points", () => {
    expect(polygonAreaM2([[12, 77], [12.1, 77]])).toBe(0);
  });
});

describe("yield helpers", () => {
  it("converts compass azimuth to PVGIS aspect", () => {
    expect(compassToPvgisAspect(180)).toBe(0);
    expect(compassToPvgisAspect(90)).toBe(-90);
    expect(compassToPvgisAspect(270)).toBe(90);
    expect(compassToPvgisAspect(0)).toBe(180);
  });
  it("combines losses multiplicatively", () => {
    expect(combinedLossPct(14, 5)).toBeCloseTo(18.3, 1);
    expect(combinedLossPct(14, null)).toBe(14);
  });
  it("scales per-kWp yield to the installed capacity", () => {
    const g = scaleGeneration(5, { specificYieldKwhPerKwpYr: 1400, monthlyKwhPerKwp: Array(12).fill(1400 / 12), source: "test" });
    expect(g.annualKwh).toBe(7000);
    expect(g.monthlyKwh?.reduce((a, b) => a + b, 0)).toBeCloseTo(7000, -1);
  });
});

describe("subsidy", () => {
  const scheme = { name: "Scheme", customerTypes: ["RESIDENTIAL"], slabs: [{ upToKw: 2, inrPerKw: 100 }, { upToKw: 3, inrPerKw: 50 }], maxAmountInr: 240 };
  it("applies slabs in order", () => {
    expect(computeSubsidy(scheme, 1.5, "RESIDENTIAL").amountInr).toBe(150);
    expect(computeSubsidy(scheme, 2.5, "RESIDENTIAL").amountInr).toBe(225);
  });
  it("pays nothing above the last slab and respects the cap", () => {
    expect(computeSubsidy(scheme, 10, "RESIDENTIAL").amountInr).toBe(240);
    expect(computeSubsidy({ ...scheme, maxAmountInr: null }, 10, "RESIDENTIAL").amountInr).toBe(250);
  });
  it("is not applied to other customer types or unconfigured schemes", () => {
    expect(computeSubsidy(scheme, 3, "COMMERCIAL").eligible).toBe(false);
    expect(computeSubsidy({ ...scheme, slabs: [] }, 3, "RESIDENTIAL").amountInr).toBeNull();
  });
  it("limits capacity when a maximum is set", () => {
    expect(computeSubsidy({ ...scheme, maxAmountInr: null, maxCapacityKw: 2 }, 3, "RESIDENTIAL").amountInr).toBe(200);
  });
});

describe("savings", () => {
  it("computes first-year savings and simple payback without a projection", () => {
    const s = computeSavings({ annualKwh: 7000, tariffInrPerKwh: 8, netCostInr: 280_000 });
    expect(s.year1SavingsInr).toBe(56_000);
    expect(s.simplePaybackYears).toBe(5);
    expect(s.projection).toBeNull();
  });
  it("projects with degradation and escalation", () => {
    const s = computeSavings({ annualKwh: 1000, tariffInrPerKwh: 10, netCostInr: 25_000, degradationPctPerYr: 1, tariffEscalationPctPerYr: 2, years: 25 });
    expect(s.projection).toHaveLength(25);
    expect(s.projection![1].kwh).toBe(990);
    expect(s.projection![1].savingsInr).toBe(Math.round(990 * 10 * 1.02));
    expect(s.simplePaybackYears).toBeGreaterThan(2);
    expect(s.simplePaybackYears).toBeLessThan(2.5);
  });
  it("gives no payback without a complete price", () => {
    expect(computeSavings({ annualKwh: 1000, tariffInrPerKwh: 8, netCostInr: null }).simplePaybackYears).toBeNull();
  });
});
