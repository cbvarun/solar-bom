/**
 * Energy, savings and subsidy estimates for proposals. Pure functions, no
 * defaults: every rate comes from the caller (configured rules, the
 * customer's tariff, a yield estimate with its source). Results are
 * indicative estimates and are always labelled as such by the UI.
 */

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- Geometry ----------

const EARTH_RADIUS_M = 6_371_008.8;

/** Area of a small polygon given as [lat, lon] vertices, in m². Accurate for roof-sized shapes. */
export function polygonAreaM2(points: [number, number][]): number {
  if (points.length < 3) return 0;
  const lat0 = (points.reduce((s, p) => s + p[0], 0) / points.length) * (Math.PI / 180);
  const xy = points.map(([lat, lon]) => [
    EARTH_RADIUS_M * (lon * Math.PI / 180) * Math.cos(lat0),
    EARTH_RADIUS_M * (lat * Math.PI / 180),
  ]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// ---------- Yield ----------

/** Compass azimuth (0 = north, 90 = east, 180 = south, 270 = west) to PVGIS "aspect" (0 = south, -90 = east, 90 = west). */
export function compassToPvgisAspect(azimuthDeg: number): number {
  let a = ((azimuthDeg % 360) + 360) % 360 - 180;
  if (a === -180) a = 180;
  return a;
}

/** Combine independent loss percentages: 1 − Π(1 − lossᵢ). */
export function combinedLossPct(...lossesPct: (number | null | undefined)[]): number {
  const keep = lossesPct.reduce<number>((k, l) => k * (1 - (l ?? 0) / 100), 1);
  return r2((1 - keep) * 100);
}

export interface YieldEstimate {
  /** Who produced the estimate, e.g. "PVGIS 5.3 (European Commission JRC), PVGIS-SARAH3". */
  source: string;
  specificYieldKwhPerKwpYr: number;
  /** kWh per kWp for Jan..Dec, when available. */
  monthlyKwhPerKwp: number[] | null;
  inputs: { latitude: number; longitude: number; tiltDeg: number; azimuthDeg: number; lossPct: number };
  fetchedAt: string;
}

export interface GenerationEstimate {
  annualKwh: number;
  monthlyKwh: number[] | null;
  specificYieldKwhPerKwpYr: number;
  source: string;
  basis: string;
}

export function scaleGeneration(installedKwp: number, y: { specificYieldKwhPerKwpYr: number; monthlyKwhPerKwp?: number[] | null; source: string }): GenerationEstimate {
  return {
    annualKwh: r0(installedKwp * y.specificYieldKwhPerKwpYr),
    monthlyKwh: y.monthlyKwhPerKwp?.length === 12 ? y.monthlyKwhPerKwp.map((m) => r0(m * installedKwp)) : null,
    specificYieldKwhPerKwpYr: y.specificYieldKwhPerKwpYr,
    source: y.source,
    basis: `${r2(installedKwp)} kWp × ${y.specificYieldKwhPerKwpYr} kWh/kWp/yr (${y.source}). Indicative, not guaranteed.`,
  };
}

// ---------- Subsidy ----------

export interface SubsidySchemeInput {
  name: string;
  customerTypes: string[];
  slabs: { upToKw: number; inrPerKw: number }[];
  maxCapacityKw?: number | null;
  maxAmountInr?: number | null;
}

export interface SubsidyResult {
  eligible: boolean;
  amountInr: number | null;
  basis: string;
}

/**
 * Capacity-slab subsidy: each slab pays inrPerKw for the capacity between the
 * previous slab's limit and its own upToKw. Capacity above the last slab earns
 * nothing more. Eligibility is only indicated, never decided, here.
 */
export function computeSubsidy(s: SubsidySchemeInput, capacityKw: number, customerType: string | null): SubsidyResult {
  if (!s.slabs.length) return { eligible: false, amountInr: null, basis: `${s.name}: amounts not configured.` };
  if (!customerType || !s.customerTypes.includes(customerType)) {
    return { eligible: false, amountInr: null, basis: `${s.name}: not applicable to this customer type.` };
  }
  const cap = s.maxCapacityKw != null ? Math.min(capacityKw, s.maxCapacityKw) : capacityKw;
  const slabs = [...s.slabs].sort((a, b) => a.upToKw - b.upToKw);
  let prev = 0;
  let amount = 0;
  const parts: string[] = [];
  for (const sl of slabs) {
    const kw = Math.max(0, Math.min(cap, sl.upToKw) - prev);
    if (kw > 0) {
      amount += kw * sl.inrPerKw;
      parts.push(`${r2(kw)} kW × ₹${sl.inrPerKw.toLocaleString("en-IN")}`);
    }
    prev = sl.upToKw;
    if (cap <= sl.upToKw) break;
  }
  let capped = "";
  if (s.maxAmountInr != null && amount > s.maxAmountInr) {
    amount = s.maxAmountInr;
    capped = ` (capped at ₹${s.maxAmountInr.toLocaleString("en-IN")})`;
  }
  return {
    eligible: true,
    amountInr: r0(amount),
    basis: `${s.name}: ${parts.join(" + ") || "0 kW"}${capped}. Estimate only; eligibility and amount are decided by the scheme authority.`,
  };
}

// ---------- Savings ----------

export interface SavingsInput {
  annualKwh: number;
  tariffInrPerKwh: number;
  /** System price after subsidy, incl. GST. Null when pricing is incomplete. */
  netCostInr: number | null;
  degradationPctPerYr?: number | null;
  tariffEscalationPctPerYr?: number | null;
  years?: number | null;
}

export interface SavingsResult {
  year1Kwh: number;
  year1SavingsInr: number;
  simplePaybackYears: number | null;
  projection: { year: number; kwh: number; savingsInr: number; cumulativeInr: number }[] | null;
  totalSavingsInr: number | null;
  assumptions: string[];
}

/**
 * Savings assume every generated kWh offsets a purchased kWh at the given
 * tariff (typical under net metering). Export limits, time-of-day tariffs and
 * fixed charges are not modelled.
 */
export function computeSavings(i: SavingsInput): SavingsResult {
  const deg = i.degradationPctPerYr ?? null;
  const esc = i.tariffEscalationPctPerYr ?? null;
  const assumptions = [
    `Every generated kWh offsets a purchased kWh at ₹${i.tariffInrPerKwh}/kWh. Export limits, time-of-day tariffs and fixed charges are not modelled.`,
    deg != null ? `Output falls ${deg}% per year.` : "Module degradation not configured; multi-year output not projected.",
    esc != null ? `Tariff changes ${esc}% per year.` : "Tariff assumed constant.",
  ];
  const year1SavingsInr = r0(i.annualKwh * i.tariffInrPerKwh);
  let projection: SavingsResult["projection"] = null;
  if (i.years && i.years > 0 && deg != null) {
    projection = [];
    let cumulative = 0;
    for (let y = 1; y <= Math.min(50, Math.floor(i.years)); y++) {
      const kwh = i.annualKwh * Math.pow(1 - deg / 100, y - 1);
      const savings = kwh * i.tariffInrPerKwh * Math.pow(1 + (esc ?? 0) / 100, y - 1);
      cumulative += savings;
      projection.push({ year: y, kwh: r0(kwh), savingsInr: r0(savings), cumulativeInr: r0(cumulative) });
    }
  }
  let simplePaybackYears: number | null = null;
  if (i.netCostInr != null && i.netCostInr > 0 && year1SavingsInr > 0) {
    if (projection) {
      const hit = projection.findIndex((p) => p.cumulativeInr >= i.netCostInr!);
      if (hit >= 0) {
        const before = hit === 0 ? 0 : projection[hit - 1].cumulativeInr;
        simplePaybackYears = r2(hit + (i.netCostInr - before) / projection[hit].savingsInr);
      }
    } else {
      simplePaybackYears = r2(i.netCostInr / year1SavingsInr);
    }
  }
  return {
    year1Kwh: r0(i.annualKwh),
    year1SavingsInr,
    simplePaybackYears,
    projection,
    totalSavingsInr: projection ? projection[projection.length - 1].cumulativeInr : null,
    assumptions,
  };
}
