import { rule } from "./rules";
import { designStrings } from "./strings";
import { round } from "./pv";
import type { Check, InverterEvaluation, InverterSpec, ModuleSpec, Phase, Rules, SystemType } from "./types";

export interface InverterContext {
  moduleCount: number;
  module: ModuleSpec;
  systemType: SystemType | null;
  supplyPhase: Phase | null;
  sanctionedLoadKw: number | null;
  minTempC: number;
  rules: Rules;
}

function typeCompatible(inv: SystemType, project: SystemType | null): boolean {
  if (!project) return true;
  if (project === "GRID_TIED") return inv === "GRID_TIED" || inv === "HYBRID";
  return inv === project;
}

/** Evaluate one inverter against the array and the configured rules. */
export function evaluateInverter(inv: InverterSpec, ctx: InverterContext): InverterEvaluation {
  const issues: Check[] = [];
  const installedW = ctx.moduleCount * ctx.module.pmaxW;
  const ratio = inv.ratedAcW > 0 ? installedW / inv.ratedAcW : null;

  if (!typeCompatible(inv.inverterType, ctx.systemType)) {
    issues.push({ key: "inverter_type", severity: "error", area: "Inverter compatibility",
      message: `${inv.inverterType.replace("_", "-").toLowerCase()} inverter does not suit a ${ctx.systemType?.replace("_", "-").toLowerCase()} system.` });
  }
  if (ctx.supplyPhase && inv.phase !== ctx.supplyPhase) {
    issues.push({ key: "phase_mismatch", severity: "error", area: "Inverter compatibility",
      message: `${inv.phase === "SINGLE" ? "Single" : "Three"}-phase inverter on a ${ctx.supplyPhase === "SINGLE" ? "single" : "three"}-phase supply.` });
  }
  const spMax = rule(ctx.rules, "single_phase_max_kw");
  if (inv.phase === "SINGLE" && spMax != null && inv.ratedAcW / 1000 > spMax) {
    issues.push({ key: "single_phase_limit", severity: "error", area: "Grid interconnection",
      message: `${inv.ratedAcW / 1000} kW exceeds the configured single-phase limit of ${spMax} kW.` });
  }
  const rMin = rule(ctx.rules, "dc_ac_ratio_min");
  const rMax = rule(ctx.rules, "dc_ac_ratio_max");
  if (ratio != null && rMin != null && ratio < rMin) {
    issues.push({ key: "dc_ac_low", severity: "error", area: "Inverter sizing",
      message: `DC/AC ratio ${round(ratio)} is below the configured minimum of ${rMin}; the inverter is oversized.` });
  }
  if (ratio != null && rMax != null && ratio > rMax) {
    issues.push({ key: "dc_ac_high", severity: "error", area: "Inverter sizing",
      message: `DC/AC ratio ${round(ratio)} exceeds the configured maximum of ${rMax}.` });
  }
  if (inv.maxDcPowerW && installedW > inv.maxDcPowerW) {
    issues.push({ key: "max_dc_power", severity: "error", area: "Inverter sizing",
      message: `Array ${installedW / 1000} kWp exceeds the inverter's maximum DC input of ${inv.maxDcPowerW / 1000} kW.` });
  }

  const { layout, issues: stringIssues } = designStrings(ctx.moduleCount, ctx.module, inv, {
    minTempC: ctx.minTempC,
    maxCellTempC: rule(ctx.rules, "design_max_cell_temp_c") ?? 70,
    iscFactor: rule(ctx.rules, "isc_safety_factor") ?? 1.25,
  });
  issues.push(...stringIssues);

  return {
    inverterId: inv.id,
    label: `${inv.manufacturer} ${inv.model}`,
    ratedAcW: inv.ratedAcW,
    dcAcRatio: ratio == null ? null : round(ratio, 3),
    compatible: !issues.some((i) => i.severity === "error"),
    issues,
    layout,
  };
}

/**
 * Rank candidate inverters. Returns all evaluations and the recommended one:
 * the compatible inverter whose DC/AC ratio is closest to the target.
 */
export function selectInverter(
  candidates: InverterSpec[],
  ctx: InverterContext,
  preferredManufacturer?: string | null,
): { evaluations: InverterEvaluation[]; best: InverterEvaluation | null } {
  const pool = preferredManufacturer
    ? candidates.filter((c) => c.manufacturer === preferredManufacturer)
    : candidates;
  const evaluations = (pool.length ? pool : candidates).map((inv) => evaluateInverter(inv, ctx));
  const target = rule(ctx.rules, "dc_ac_ratio_target") ?? 1.1;
  const best = evaluations
    .filter((e) => e.compatible)
    .sort((a, b) => Math.abs((a.dcAcRatio ?? 99) - target) - Math.abs((b.dcAcRatio ?? 99) - target) || a.ratedAcW - b.ratedAcW)[0] ?? null;
  return { evaluations, best };
}
