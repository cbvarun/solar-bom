import { round, tempCorrected } from "./pv";
import type { Check, InverterSpec, ModuleSpec, StringLayout } from "./types";

export interface StringDesignContext {
  minTempC: number;
  maxCellTempC: number;
  iscFactor: number;
}

/**
 * Arrange `count` modules into series strings for an inverter and validate
 * voltage and current limits. Returns the layout (or null) and any issues.
 */
export function designStrings(
  count: number,
  mod: ModuleSpec,
  inv: InverterSpec,
  ctx: StringDesignContext,
): { layout: StringLayout | null; issues: Check[] } {
  const issues: Check[] = [];
  const vocMin = tempCorrected(mod.vocV, mod.betaVocPctPerC, ctx.minTempC);
  const vmpCoeff = mod.betaVmpPctPerC ?? mod.gammaPmaxPctPerC ?? mod.betaVocPctPerC;
  const vmpHot = tempCorrected(mod.vmpV, vmpCoeff, ctx.maxCellTempC);
  const vmpCold = tempCorrected(mod.vmpV, vmpCoeff, ctx.minTempC);

  const systemLimit = Math.min(inv.maxDcVoltageV, mod.maxSystemVoltageV);
  const maxSeries = Math.floor(systemLimit / vocMin);
  const minSeries = Math.max(1, Math.ceil(Math.max(inv.mpptMinV, inv.startVoltageV ?? 0) / vmpHot));

  if (maxSeries < minSeries) {
    issues.push({
      key: "string_window_empty",
      severity: "error",
      area: "Inverter compatibility",
      message: `No valid string length: maximum ${maxSeries} modules (Voc at ${ctx.minTempC} °C = ${round(vocMin)} V/module vs ${systemLimit} V limit) is below minimum ${minSeries} modules (MPPT/start voltage).`,
    });
    return { layout: null, issues };
  }

  const slots = inv.mpptCount * inv.stringsPerMppt;
  let chosen: number[] | null = null;
  for (let s = 1; s <= Math.min(slots, count); s++) {
    const base = Math.floor(count / s);
    const extra = count % s;
    const sizes = Array.from({ length: s }, (_, i) => base + (i < extra ? 1 : 0));
    if (sizes.every((n) => n >= minSeries && n <= maxSeries)) {
      chosen = sizes;
      break;
    }
  }

  if (!chosen) {
    const reason =
      count < minSeries
        ? `${count} modules is fewer than the minimum string length of ${minSeries}`
        : `${count} modules cannot be split into at most ${slots} strings of ${minSeries}–${maxSeries} modules`;
    issues.push({ key: "string_layout_impossible", severity: "error", area: "Inverter compatibility", message: `String design not possible: ${reason}.` });
    return { layout: null, issues };
  }

  // Distribute strings across MPPTs, keeping equal-length strings together.
  const mppts: number[][] = Array.from({ length: inv.mpptCount }, () => []);
  const order = chosen.map((n, i) => ({ n, i })).sort((a, b) => b.n - a.n);
  for (const { i } of order) {
    // Prefer an MPPT already holding strings of the same length, else the emptiest.
    let target = mppts.findIndex((m) => m.length > 0 && m.length < inv.stringsPerMppt && chosen![m[0]] === chosen![i]);
    if (target < 0) {
      const empty = mppts.findIndex((m) => m.length === 0);
      target = empty >= 0 ? empty : mppts.findIndex((m) => m.length < inv.stringsPerMppt);
    }
    mppts[target].push(i);
  }

  for (const [mi, strs] of mppts.entries()) {
    if (strs.length === 0) continue;
    const lengths = new Set(strs.map((i) => chosen![i]));
    if (lengths.size > 1) {
      issues.push({ key: "mppt_mixed_lengths", severity: "warning", area: "Inverter compatibility",
        message: `MPPT ${mi + 1} combines strings of different lengths (${[...lengths].join(", ")} modules); expect mismatch losses. Review the string plan.` });
    }
    const iscTotal = mod.iscA * strs.length;
    if (iscTotal > inv.maxShortCircuitCurrentPerMpptA) {
      issues.push({ key: "mppt_isc_exceeded", severity: "error", area: "Inverter compatibility",
        message: `MPPT ${mi + 1}: short-circuit current ${round(iscTotal)} A exceeds the inverter limit of ${inv.maxShortCircuitCurrentPerMpptA} A.` });
    }
    const impTotal = mod.impA * strs.length;
    if (impTotal > inv.maxInputCurrentPerMpptA) {
      issues.push({ key: "mppt_imp_clipping", severity: "warning", area: "Inverter compatibility",
        message: `MPPT ${mi + 1}: operating current ${round(impTotal)} A exceeds the usable input current of ${inv.maxInputCurrentPerMpptA} A; current will be clipped.` });
    }
  }

  const longest = Math.max(...chosen);
  const shortest = Math.min(...chosen);
  if (longest * vmpCold > inv.mpptMaxV) {
    issues.push({ key: "mpp_above_mppt", severity: "warning", area: "Inverter compatibility",
      message: `String MPP voltage at ${ctx.minTempC} °C (${round(longest * vmpCold)} V) exceeds the MPPT upper limit of ${inv.mpptMaxV} V.` });
  }
  if (shortest * vmpHot < inv.mpptMinV) {
    issues.push({ key: "mpp_below_mppt", severity: "error", area: "Inverter compatibility",
      message: `String MPP voltage at ${ctx.maxCellTempC} °C (${round(shortest * vmpHot)} V) is below the MPPT lower limit of ${inv.mpptMinV} V.` });
  }

  return {
    layout: {
      modulesPerString: chosen,
      mppts,
      vocAtMinTempV: round(longest * vocMin),
      vmpAtMaxTempV: round(shortest * vmpHot),
      vmpAtMinTempV: round(longest * vmpCold),
      maxSeries,
      minSeries,
    },
    issues,
  };
}
