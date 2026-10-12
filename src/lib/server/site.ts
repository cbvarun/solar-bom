import "server-only";
import { cache } from "react";
import { Prisma, type PrismaClient } from "@prisma/client";
import { computeSavings, computeSubsidy, scaleGeneration, compassToPvgisAspect, type YieldEstimate } from "@/lib/engine";
import type { EnergySummary } from "@/lib/energy-summary";
import { defaultRules } from "@/lib/engine";
import { bomPricing, engineSnapshot, loadBomForPricing } from "./bom";

type Db = PrismaClient | Prisma.TransactionClient;
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? null : Number(v));

export class YieldServiceError extends Error {}

// PVGIS_API_URL exists only so tests can point at a stub; production uses the JRC endpoint.
const PVGIS_URL = process.env.PVGIS_API_URL || "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc";

/**
 * Yield per kWp from PVGIS, the European Commission's free PV performance
 * service (no key). Outside Europe it uses satellite or reanalysis data; the
 * database used is recorded in the source. Network time is not CPU time, so
 * this is cheap on Workers.
 */
export async function fetchPvgisYield(p: { latitude: number; longitude: number; tiltDeg: number | null; azimuthDeg: number | null; lossPct: number }): Promise<YieldEstimate> {
  const q = new URLSearchParams({
    lat: String(p.latitude), lon: String(p.longitude), peakpower: "1", loss: String(p.lossPct), outputformat: "json", mountingplace: "free", pvtechchoice: "crystSi",
  });
  if (p.tiltDeg == null || p.azimuthDeg == null) q.set("optimalangles", "1");
  else { q.set("angle", String(p.tiltDeg)); q.set("aspect", String(compassToPvgisAspect(p.azimuthDeg))); }
  let res: Response;
  try {
    res = await fetch(`${PVGIS_URL}?${q}`, { signal: AbortSignal.timeout(20_000), headers: { accept: "application/json" } });
  } catch {
    throw new YieldServiceError("The PVGIS service could not be reached. Try again later, or enter an engineer-verified specific yield in the configuration.");
  }
  const body = (await res.json().catch(() => null)) as PvgisResponse | { message?: string } | null;
  if (!res.ok || !body || !("outputs" in body)) {
    const msg = body && "message" in body && body.message ? body.message : `HTTP ${res.status}`;
    throw new YieldServiceError(`PVGIS could not estimate this location: ${msg}`);
  }
  const ey = body.outputs?.totals?.fixed?.E_y;
  if (typeof ey !== "number" || !(ey > 0)) throw new YieldServiceError("PVGIS returned no annual yield for this location.");
  const monthly = body.outputs.monthly?.fixed?.slice().sort((a, b) => a.month - b.month).map((m) => Math.round(m.E_m * 10) / 10) ?? null;
  const fixed = body.inputs?.mounting_system?.fixed;
  const tilt = fixed?.slope?.value ?? p.tiltDeg ?? 0;
  const aspect = fixed?.azimuth?.value;
  const db = body.inputs?.meteo_data?.radiation_db;
  return {
    source: `PVGIS 5.3, European Commission JRC${db ? `, ${db} data` : ""}`,
    specificYieldKwhPerKwpYr: Math.round(ey),
    monthlyKwhPerKwp: monthly?.length === 12 ? monthly : null,
    inputs: { latitude: p.latitude, longitude: p.longitude, tiltDeg: tilt, azimuthDeg: aspect != null ? (aspect + 180) % 360 : p.azimuthDeg ?? 180, lossPct: p.lossPct },
    fetchedAt: new Date().toISOString(),
  };
}

interface PvgisResponse {
  inputs?: {
    meteo_data?: { radiation_db?: string };
    mounting_system?: { fixed?: { slope?: { value?: number }; azimuth?: { value?: number } } };
  };
  outputs: {
    totals?: { fixed?: { E_y?: number } };
    monthly?: { fixed?: { month: number; E_m: number }[] };
  };
}

/** Cached per request while rendering, so the site page and its energy summary share one read. */
export const loadSite = cache((db: Db, projectId: string) => db.siteAssessment.findUnique({ where: { projectId } }));

const SAVINGS_RULES = ["savings_degradation_pct_per_yr", "savings_tariff_escalation_pct_per_yr", "savings_analysis_years"] as const;

/** Just the savings assumptions, rather than every engine and compatibility rule. */
async function loadSavingsRules(db: Db) {
  const rules = defaultRules();
  for (const r of await db.engineRule.findMany({ where: { key: { in: [...SAVINGS_RULES] } }, select: { key: true, valueNumber: true } })) {
    rules[r.key] = r.valueNumber == null ? null : Number(r.valueNumber);
  }
  return rules;
}

/** Generation, subsidy and savings for a project from its site data, BOM and configured rules. */
export async function energySummary(db: Db, projectId: string): Promise<EnergySummary> {
  const [project, site, bom, rules] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId }, select: { customerType: true } }),
    loadSite(db, projectId),
    loadBomForPricing(db, projectId),
    loadSavingsRules(db),
  ]);
  const calc = bom ? engineSnapshot(bom) : null;
  const pricing = bom ? bomPricing(bom) : null;
  // Package BOMs have no engine result; their capacity comes from the package.
  const pkg = !calc && bom?.sourcePackageId ? await db.standardPackage.findUnique({ where: { id: bom.sourcePackageId }, select: { capacityKwp: true } }) : null;
  const installedKwp = calc?.summary.installedDcW != null ? calc.summary.installedDcW / 1000 : pkg ? Number(pkg.capacityKwp) : null;
  const location = site?.latitude != null && site.longitude != null ? { latitude: Number(site.latitude), longitude: Number(site.longitude) } : null;

  // Generation: an engineer-verified yield wins; otherwise the PVGIS estimate for the location.
  let generation: EnergySummary["generation"] = null;
  let generationNote: string | null = null;
  const pvgis = site?.yieldEstimate as YieldEstimate | null | undefined;
  const engYield = calc?.summary.annualGeneration && installedKwp ? (calc.summary.annualGeneration.kwh / installedKwp) : null;
  if (!installedKwp) generationNote = "Installed capacity is not known yet.";
  else if (engYield) {
    const source = calc!.summary.annualGeneration!.basis.match(/\(([^)]+)\)/)?.[1] ?? "engineer-verified specific yield";
    generation = scaleGeneration(installedKwp, { specificYieldKwhPerKwpYr: Math.round(engYield), monthlyKwhPerKwp: null, source: `${source}, engineer-verified` });
  } else if (pvgis) {
    generation = scaleGeneration(installedKwp, { ...pvgis, source: `${pvgis.source}; estimate for this location, not a site survey` });
  } else generationNote = "Mark the site on the map and run the yield estimate, or enter an engineer-verified specific yield.";

  // Subsidy: only an active scheme chosen for this project, with amounts configured.
  let subsidy: EnergySummary["subsidy"] = null;
  if (site?.subsidySchemeId && installedKwp) {
    const s = await db.subsidyScheme.findUnique({ where: { id: site.subsidySchemeId } });
    if (s?.active) {
      const r = computeSubsidy({ name: s.name, customerTypes: s.customerTypes, slabs: (s.slabs as { upToKw: number; inrPerKw: number }[]) ?? [], maxCapacityKw: num(s.maxCapacityKw), maxAmountInr: num(s.maxAmountInr) }, installedKwp, project.customerType);
      subsidy = { ...r, schemeName: s.name, sourceUrl: s.sourceUrl, verified: s.verificationStatus === "VERIFIED" };
    }
  }

  const tariff = site?.tariffInrPerKwh != null ? { inrPerKwh: Number(site.tariffInrPerKwh), source: site.tariffSource } : null;
  const grossCostInr = pricing && pricing.complete && pricing.grandTotal > 0 ? pricing.grandTotal : null;
  const netCostInr = grossCostInr != null ? Math.max(0, grossCostInr - (subsidy?.amountInr ?? 0)) : null;

  let savings: EnergySummary["savings"] = null;
  let savingsNote: string | null = null;
  if (!generation) savingsNote = "Needs a generation estimate.";
  else if (!tariff) savingsNote = "Enter the customer's electricity tariff to estimate savings.";
  else {
    savings = computeSavings({
      annualKwh: generation.annualKwh, tariffInrPerKwh: tariff.inrPerKwh, netCostInr,
      degradationPctPerYr: rules.savings_degradation_pct_per_yr, tariffEscalationPctPerYr: rules.savings_tariff_escalation_pct_per_yr, years: rules.savings_analysis_years,
    });
    if (netCostInr == null) savingsNote = "Payback is shown once every BOM line is priced and has a GST rate.";
  }

  return { location, installedKwp, generation, generationNote, subsidy, tariff, grossCostInr, netCostInr, savings, savingsNote };
}
