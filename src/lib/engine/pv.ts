import type { ModuleSpec } from "./types";

/** Number of modules = ceil(target DC W ÷ module rated W). */
export function moduleCount(targetDcW: number, moduleWp: number): number {
  if (!(targetDcW > 0)) throw new Error("Target DC capacity must be greater than zero");
  if (!(moduleWp > 0)) throw new Error("Module rated power must be greater than zero");
  // Guard against floating-point noise (e.g. 4950/550 = 9.000000000000002).
  return Math.ceil(Number((targetDcW / moduleWp).toFixed(9)));
}

/** Actual installed DC capacity = module count × module rated power. */
export function installedCapacityW(count: number, moduleWp: number): number {
  return count * moduleWp;
}

export function moduleAreaM2(m: Pick<ModuleSpec, "lengthMm" | "widthMm">): number {
  return (m.lengthMm / 1000) * (m.widthMm / 1000);
}

/** Voltage corrected for temperature with a %/°C coefficient. */
export function tempCorrected(valueAtStc: number, coeffPctPerC: number, tempC: number): number {
  return valueAtStc * (1 + (coeffPctPerC / 100) * (tempC - 25));
}

export function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
