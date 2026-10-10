import { describe, expect, it } from "vitest";
import {
  defaultRules, designStrings, evaluateInverter, generateBom, installedCapacityW, moduleCount, mountingQuantities,
  buildRows, priceBom, priceLine, sizeCable, voltageDropPct, tempCorrected,
} from "..";
import { catalogue, inv10k3, inv4k, inv5k, module550, structure } from "./fixtures";

const rules = defaultRules();

describe("PV module quantity", () => {
  it("uses ceiling of target W / module W", () => {
    expect(moduleCount(5000, 550)).toBe(10);
    expect(moduleCount(4950, 550)).toBe(9);
    expect(moduleCount(4951, 550)).toBe(10);
    expect(moduleCount(100000, 545)).toBe(184);
  });
  it("computes installed capacity", () => {
    expect(installedCapacityW(9, 550)).toBe(4950);
  });
  it("rejects invalid input", () => {
    expect(() => moduleCount(0, 550)).toThrow();
    expect(() => moduleCount(5000, 0)).toThrow();
  });
});

describe("String design", () => {
  it("corrects Voc for cold temperature", () => {
    expect(tempCorrected(49.5, -0.27, 10)).toBeCloseTo(49.5 * (1 + 0.0027 * 15), 6);
  });
  it("places 9 modules in one string on a 600 V inverter", () => {
    const { layout, issues } = designStrings(9, module550, inv5k, { minTempC: 10, maxCellTempC: 70, iscFactor: 1.25 });
    expect(layout?.modulesPerString).toEqual([9]);
    expect(layout!.vocAtMinTempV).toBeLessThan(600);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
  it("splits when one string would exceed max DC voltage", () => {
    const { layout } = designStrings(18, module550, inv5k, { minTempC: 10, maxCellTempC: 70, iscFactor: 1.25 });
    expect(layout?.modulesPerString).toEqual([9, 9]);
    expect(layout?.mppts.filter((m) => m.length).length).toBe(2);
  });
  it("flags when modules cannot fit the inverter's inputs", () => {
    const { layout, issues } = designStrings(40, module550, inv5k, { minTempC: 10, maxCellTempC: 70, iscFactor: 1.25 });
    expect(layout).toBeNull();
    expect(issues[0].key).toBe("string_layout_impossible");
  });
  it("flags too few modules for the MPPT window", () => {
    const { issues } = designStrings(3, module550, inv10k3, { minTempC: 10, maxCellTempC: 70, iscFactor: 1.25 });
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });
  it("flags short-circuit current over the MPPT limit", () => {
    const weak = { ...inv5k, stringsPerMppt: 2, mpptCount: 1, maxShortCircuitCurrentPerMpptA: 20 };
    const { issues } = designStrings(18, module550, weak, { minTempC: 10, maxCellTempC: 70, iscFactor: 1.25 });
    expect(issues.some((i) => i.key === "mppt_isc_exceeded")).toBe(true);
  });
});

describe("Inverter compatibility", () => {
  const ctx = { moduleCount: 9, module: module550, systemType: "GRID_TIED" as const, supplyPhase: "SINGLE" as const, sanctionedLoadKw: null, minTempC: 10, rules };
  it("accepts 4 kW and 5 kW single-phase for 4.95 kWp", () => {
    expect(evaluateInverter(inv4k, ctx).compatible).toBe(true);
    expect(evaluateInverter(inv5k, ctx).compatible).toBe(true);
  });
  it("rejects three-phase inverter on single-phase supply", () => {
    const e = evaluateInverter(inv10k3, ctx);
    expect(e.compatible).toBe(false);
    expect(e.issues.some((i) => i.key === "phase_mismatch")).toBe(true);
  });
  it("rejects grid-tied inverter for a hybrid system", () => {
    expect(evaluateInverter(inv5k, { ...ctx, systemType: "HYBRID" }).compatible).toBe(false);
  });
  it("flags DC/AC ratio above maximum", () => {
    const e = evaluateInverter(inv4k, { ...ctx, moduleCount: 11 });
    expect(e.issues.some((i) => i.key === "dc_ac_high")).toBe(true);
  });
});

describe("Mounting", () => {
  it("derives clamps and rails from layout", () => {
    const rows = buildRows(9, 5);
    expect(rows).toEqual([5, 4]);
    const q = mountingQuantities(rows, module550, structure, null);
    expect(q.endClamps).toBe(2 * 2 * 1 * 2);
    expect(q.midClamps).toBe((4 + 3) * 2);
    expect(q.supports).toBeNull(); // needs engineered spacing
  });
  it("scales supports with layout instead of a fixed number", () => {
    const a = mountingQuantities(buildRows(9, 5), module550, structure, 1.5);
    const b = mountingQuantities(buildRows(18, 6), module550, structure, 1.5);
    expect(b.supports!).toBeGreaterThan(a.supports!);
  });
});

describe("Cable sizing", () => {
  it("computes two-wire voltage drop", () => {
    const vd = voltageDropPct({ kind: "DC", lengthM: 20, designCurrentA: 17.5, operatingCurrentA: 13.2, voltageV: 374.4, vdropLimitPct: 1.5, deratingFactor: 1 }, 5.09);
    expect(vd).toBeCloseTo((2 * 20 * 13.2 * 0.00509) / 374.4 * 100, 6);
  });
  it("upsizes when voltage drop is exceeded", () => {
    const r = sizeCable(catalogue.cables, { kind: "AC", lengthM: 20, designCurrentA: 21.7, operatingCurrentA: 21.7, voltageV: 230, phase: "SINGLE", vdropLimitPct: 1.5, deratingFactor: 0.7 });
    expect(r.option?.csaMm2).toBe(6);
    expect(r.rejected[0].csaMm2).toBe(4);
  });
  it("returns null when nothing fits", () => {
    const r = sizeCable(catalogue.cables, { kind: "AC", lengthM: 400, designCurrentA: 21.7, operatingCurrentA: 21.7, voltageV: 230, phase: "SINGLE", vdropLimitPct: 1.5, deratingFactor: 0.7 });
    expect(r.option).toBeNull();
  });
});

describe("Pricing", () => {
  it("computes subtotal and GST exclusive", () => {
    expect(priceLine({ id: "a", section: "PV_MODULES", quantity: 9, unitPrice: 1000, gstRatePercent: 5 }, false)).toMatchObject({ subtotal: 9000, gst: 450, total: 9450 });
  });
  it("back-calculates GST from inclusive prices", () => {
    const p = priceLine({ id: "a", section: "PV_MODULES", quantity: 1, unitPrice: 1180, gstRatePercent: 18 }, true);
    expect(p.subtotal).toBe(1000);
    expect(p.gst).toBe(180);
  });
  it("does not invent tax when GST class is not configured", () => {
    const p = priceLine({ id: "a", section: "X", quantity: 2, unitPrice: 100, gstRatePercent: null }, false);
    expect(p.gst).toBeNull();
    expect(p.taxed).toBe(false);
  });
  it("totals with extras and counts unpriced lines", () => {
    const r = priceBom(
      [
        { id: "1", section: "PV_MODULES", quantity: 2, unitPrice: 100, gstRatePercent: 12 },
        { id: "2", section: "SERVICES", quantity: 1, unitPrice: 500, gstRatePercent: 18 },
        { id: "3", section: "AC_WIRING", quantity: null, unitPrice: 10, gstRatePercent: 18 },
      ],
      [{ label: "Transport", amount: 300, gstRatePercent: 18 }],
      false,
    );
    expect(r.equipmentSubtotal).toBe(200);
    expect(r.servicesSubtotal).toBe(500);
    expect(r.extrasSubtotal).toBe(300);
    expect(r.gstTotal).toBe(24 + 90 + 54);
    expect(r.grandTotal).toBe(1000 + 168);
    expect(r.unpricedLines).toBe(1);
    expect(r.complete).toBe(false);
  });
});

describe("BOM generation — sample 5 kWp project", () => {
  const input = {
    targetCapacityKwp: 5, roofType: "RCC_FLAT" as const, roofAreaM2: 60, systemType: "GRID_TIED" as const, supplyPhase: "SINGLE" as const,
    exportArrangement: "NET_METERING" as const, preferredModuleWp: 550,
    engineering: { modulesPerRow: 5, dcRouteLengthM: 15, acRouteLengthM: 12, earthElectrodes: 3, earthingRouteLengthM: 40, lightningProtection: "TBC" as const },
    inputMeta: { dcRouteLengthM: { provenance: "ESTIMATED" as const }, earthElectrodes: { provenance: "ESTIMATED" as const } },
  };
  const r = generateBom(input, catalogue, rules);

  it("calculates 10 modules for 5 kWp at 550 Wp and installed 5.5 kWp", () => {
    expect(r.summary.moduleCount).toBe(10);
    expect(r.summary.installedDcW).toBe(5500);
  });
  it("calculates 9 modules / 4.95 kWp for a 4.95 kWp target", () => {
    const r2 = generateBom({ ...input, targetCapacityKwp: 4.95 }, catalogue, rules);
    expect(r2.summary.moduleCount).toBe(9);
    expect(r2.summary.installedDcW).toBe(4950);
    expect([4000, 5000]).toContain(r2.summary.inverterAcW);
  });
  it("selects a compatible single-phase inverter", () => {
    expect(r.summary.inverterAcW).toBe(5000);
    expect(r.inverterEvaluations.find((e) => e.inverterId === "i10")?.compatible).toBe(false);
  });
  it("covers every required BOM section except optional ones", () => {
    const sections = new Set(r.lines.map((l) => l.section));
    for (const s of ["PV_MODULES", "MOUNTING", "INVERTER", "DC_WIRING", "AC_WIRING", "EARTHING", "LIGHTNING", "METERING", "CABLE_MGMT", "SAFETY", "SERVICES"]) {
      expect(sections.has(s as never)).toBe(true);
    }
  });
  it("gives every line a unit and a quantity basis", () => {
    for (const l of r.lines) {
      expect(l.unit).toBeTruthy();
      expect(l.quantityBasis).toBeTruthy();
    }
  });
  it("marks provisional quantities as estimated or to be confirmed", () => {
    const by = (k: string) => r.lines.find((l) => l.ruleKey === k)!;
    expect(by("dc_cable").quantityStatus).toBe("ESTIMATED");
    expect(by("earth_electrodes").quantityStatus).toBe("ESTIMATED");
    expect(by("roof_anchors").quantityStatus).toBe("TO_BE_CONFIRMED");
    expect(by("roof_anchors").calculatedQty).toBeNull();
    expect(by("pv_modules").quantityStatus).toBe("CALCULATED");
  });
  it("does not duplicate SPD/isolator functions integrated in the inverter", () => {
    expect(r.lines.some((l) => l.ruleKey === "dc_spd")).toBe(false);
    expect(r.lines.some((l) => l.ruleKey === "ac_spd")).toBe(true);
  });
  it("does not estimate generation without verified yield", () => {
    expect(r.summary.annualGeneration).toBeNull();
    expect(r.summary.annualGenerationUnavailableReason).toBeTruthy();
  });
  it("flags missing capacity", () => {
    const bad = generateBom({ ...input, targetCapacityKwp: null }, catalogue, rules);
    expect(bad.checks.some((c) => c.key === "missing_capacity" && c.severity === "error")).toBe(true);
    expect(bad.lines).toHaveLength(0);
  });
  it("flags roof area shortfall", () => {
    const small = generateBom({ ...input, roofAreaM2: 10 }, catalogue, rules);
    expect(small.checks.some((c) => c.key === "roof_area")).toBe(true);
  });
  it("flags an explicitly selected incompatible inverter", () => {
    const x = generateBom({ ...input, selectedInverterId: "i10" }, catalogue, rules);
    expect(x.checks.some((c) => c.key === "inverter_incompatible")).toBe(true);
  });
  it("records outstanding engineering checks", () => {
    expect(r.outstanding.some((o) => o.includes("Structural design"))).toBe(true);
    expect(r.outstanding.some((o) => o.includes("Lightning risk"))).toBe(true);
  });
});

describe("Design array override", () => {
  it("keeps the formula result visible while designing to the override", () => {
    const r = generateBom({ targetCapacityKwp: 5, systemType: "GRID_TIED", supplyPhase: "SINGLE", preferredModuleWp: 550,
      engineering: { moduleCountOverride: 9 }, inputMeta: { moduleCountOverride: { provenance: "ESTIMATED" } } }, catalogue, rules);
    expect(r.summary.formulaModuleCount).toBe(10);
    expect(r.summary.moduleCount).toBe(9);
    expect(r.summary.installedDcW).toBe(4950);
    const pv = r.lines.find((l) => l.ruleKey === "pv_modules")!;
    expect(pv.quantityStatus).toBe("ESTIMATED");
    expect(pv.quantityBasis).toContain("= 10 modules");
  });
});
