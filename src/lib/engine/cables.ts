import { round } from "./pv";
import type { CableOption } from "./types";

export interface CableSizingInput {
  kind: "DC" | "AC";
  /** One-way route length, m. */
  lengthM: number;
  /** Design current for ampacity check, A. */
  designCurrentA: number;
  /** Operating current used for voltage drop, A. */
  operatingCurrentA: number;
  /** Circuit voltage (string Vmp for DC, nominal for AC), V. */
  voltageV: number;
  phase?: "SINGLE" | "THREE";
  vdropLimitPct: number;
  deratingFactor: number;
}

export interface CableSizingResult {
  option: CableOption | null;
  voltageDropPct: number | null;
  deratedAmpacityA: number | null;
  rejected: { csaMm2: number; reason: string }[];
}

/** Voltage drop in % for a two-wire (DC / single-phase) or three-phase circuit. */
export function voltageDropPct(i: CableSizingInput, resistanceOhmPerKm: number): number {
  const rPerM = resistanceOhmPerKm / 1000;
  const factor = i.kind === "AC" && i.phase === "THREE" ? Math.sqrt(3) : 2;
  return ((factor * i.lengthM * i.operatingCurrentA * rPerM) / i.voltageV) * 100;
}

/**
 * Pick the smallest cable that satisfies the derated current capacity and
 * voltage-drop limit. Preliminary only: final sizing follows the approved
 * electrical design (installation method, ambient temperature, grouping).
 */
export function sizeCable(options: CableOption[], input: CableSizingInput): CableSizingResult {
  const rejected: CableSizingResult["rejected"] = [];
  const sorted = options.filter((o) => o.kind === input.kind).sort((a, b) => a.csaMm2 - b.csaMm2);
  for (const o of sorted) {
    const derated = o.ampacityA * input.deratingFactor;
    const vd = voltageDropPct(input, o.resistanceOhmPerKm);
    if (derated < input.designCurrentA) {
      rejected.push({ csaMm2: o.csaMm2, reason: `derated capacity ${round(derated, 1)} A < design current ${round(input.designCurrentA, 1)} A` });
      continue;
    }
    if (vd > input.vdropLimitPct) {
      rejected.push({ csaMm2: o.csaMm2, reason: `voltage drop ${round(vd)} % > limit ${input.vdropLimitPct} %` });
      continue;
    }
    return { option: o, voltageDropPct: round(vd, 3), deratedAmpacityA: round(derated, 1), rejected };
  }
  return { option: null, voltageDropPct: null, deratedAmpacityA: null, rejected };
}

/** Length to procure: route × (1 + allowance) + terminations. */
export function procurementLength(routeM: number, allowancePct: number, ends: number, terminationM: number): number {
  return round(routeM * (1 + allowancePct / 100) + ends * terminationM, 1);
}
