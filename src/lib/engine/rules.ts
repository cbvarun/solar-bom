import type { Rules } from "./types";

/**
 * Configurable engineering parameters. Defaults are seeded into the
 * EngineRule table and edited from the admin dashboard. Values flagged as
 * assumptions are placeholders that engineering must confirm per project;
 * they are not regulatory requirements.
 */
export interface RuleDefinition {
  key: string;
  label: string;
  group: string;
  defaultValue: number | null;
  unit: string | null;
  description: string;
  isAssumption: boolean;
}

export const RULE_DEFINITIONS: RuleDefinition[] = [
  // Electrical design
  { key: "design_min_temp_c", label: "Design minimum ambient/cell temperature", group: "Electrical", defaultValue: 10, unit: "°C", isAssumption: true,
    description: "Used to compute string open-circuit voltage at the coldest expected condition. Replace with site climate data." },
  { key: "design_max_cell_temp_c", label: "Design maximum cell temperature", group: "Electrical", defaultValue: 70, unit: "°C", isAssumption: true,
    description: "Used to compute minimum string MPP voltage on hot days for the MPPT lower-bound check." },
  { key: "dc_ac_ratio_min", label: "Minimum DC/AC ratio", group: "Electrical", defaultValue: 0.9, unit: "ratio", isAssumption: true,
    description: "Lower bound for acceptable inverter loading. Confirm against inverter manufacturer guidance." },
  { key: "dc_ac_ratio_max", label: "Maximum DC/AC ratio", group: "Electrical", defaultValue: 1.3, unit: "ratio", isAssumption: true,
    description: "Upper bound for inverter loading. Must not exceed the inverter's permitted maximum DC input power." },
  { key: "dc_ac_ratio_target", label: "Target DC/AC ratio", group: "Electrical", defaultValue: 1.1, unit: "ratio", isAssumption: true,
    description: "Preferred inverter loading used to rank compatible inverters." },
  { key: "isc_safety_factor", label: "DC design current factor (× Isc)", group: "Electrical", defaultValue: 1.25, unit: "×", isAssumption: true,
    description: "Multiplier on module short-circuit current for DC circuit design current. Confirm against the applicable wiring standard." },
  { key: "power_factor", label: "Inverter output power factor for cable sizing", group: "Electrical", defaultValue: 1, unit: "pf", isAssumption: true,
    description: "Power factor used to derive AC design current." },
  { key: "string_fuse_parallel_threshold", label: "Parallel strings per MPPT requiring string fuses", group: "Electrical", defaultValue: 3, unit: "strings", isAssumption: true,
    description: "When the number of parallel strings on one MPPT input reaches this value, string overcurrent protection is listed for engineering review." },
  { key: "external_dc_isolator_always", label: "List external DC isolator even when integrated", group: "Electrical", defaultValue: 1, unit: "1 = yes / 0 = no", isAssumption: true,
    description: "Some utilities or designs require an external DC isolator in addition to the inverter's integrated switch. Confirm per project." },
  { key: "single_phase_max_kw", label: "Max inverter AC rating on single-phase supply", group: "Grid", defaultValue: null, unit: "kW", isAssumption: true,
    description: "Leave blank until confirmed from current BESCOM/KERC requirements. When blank, the check is raised as an outstanding item instead of being enforced." },
  { key: "sanctioned_load_ratio_limit", label: "Max AC capacity / sanctioned load", group: "Grid", defaultValue: null, unit: "ratio", isAssumption: true,
    description: "Leave blank until confirmed from current BESCOM/KERC requirements. When blank, the comparison is raised as an outstanding item." },
  { key: "ac_voltage_single_v", label: "Nominal single-phase voltage", group: "Grid", defaultValue: 230, unit: "V", isAssumption: false,
    description: "Nominal LV single-phase voltage used for AC current and voltage-drop estimates." },
  { key: "ac_voltage_three_v", label: "Nominal three-phase line voltage", group: "Grid", defaultValue: 415, unit: "V", isAssumption: false,
    description: "Nominal LV three-phase line-to-line voltage used for AC current and voltage-drop estimates." },
  // Cables
  { key: "dc_vdrop_limit_pct", label: "DC voltage-drop limit", group: "Cables", defaultValue: 1.5, unit: "%", isAssumption: true,
    description: "Maximum DC voltage drop used for preliminary cable sizing. Confirm against the project specification." },
  { key: "ac_vdrop_limit_pct", label: "AC voltage-drop limit", group: "Cables", defaultValue: 1.5, unit: "%", isAssumption: true,
    description: "Maximum AC voltage drop from inverter to point of interconnection used for preliminary sizing." },
  { key: "dc_routing_allowance_pct", label: "DC routing allowance", group: "Cables", defaultValue: 10, unit: "%", isAssumption: true,
    description: "Added to measured DC route lengths for bends, slack and routing deviations." },
  { key: "ac_routing_allowance_pct", label: "AC routing allowance", group: "Cables", defaultValue: 10, unit: "%", isAssumption: true,
    description: "Added to measured AC route lengths." },
  { key: "termination_allowance_m", label: "Termination allowance per cable end", group: "Cables", defaultValue: 0.5, unit: "m", isAssumption: true,
    description: "Extra length per cable end for terminations." },
  { key: "dc_array_internal_m_per_string", label: "In-array DC cable per string", group: "Cables", defaultValue: 3, unit: "m", isAssumption: true,
    description: "Return/jumper run within the array per string, in addition to the home-run route. Replace with the string layout drawing." },
  { key: "default_ambient_derating", label: "Default ambient temperature derating factor", group: "Cables", defaultValue: 0.87, unit: "factor", isAssumption: true,
    description: "Applied to cable ampacity when no project-specific factor is entered. Take from the cable manufacturer's derating tables." },
  { key: "default_grouping_derating", label: "Default grouping derating factor", group: "Cables", defaultValue: 0.8, unit: "factor", isAssumption: true,
    description: "Applied for grouped cables when no project-specific factor is entered." },
  { key: "connector_spare_pct", label: "Connector spares", group: "Cables", defaultValue: 10, unit: "%", isAssumption: true,
    description: "Spare DC connector pairs added for site losses." },
  { key: "conduit_allowance_pct", label: "Conduit/tray allowance over route length", group: "Cables", defaultValue: 10, unit: "%", isAssumption: true,
    description: "Added to combined DC and AC route lengths for containment." },
  // Mounting
  { key: "default_modules_per_row", label: "Default modules per row (no layout yet)", group: "Mounting", defaultValue: 5, unit: "modules", isAssumption: true,
    description: "Only used to produce a provisional layout when no row layout is entered." },
  { key: "provisional_support_spacing_m", label: "Provisional support spacing along rail", group: "Mounting", defaultValue: null, unit: "m", isAssumption: true,
    description: "Optional. If set, used to produce an ESTIMATED support/anchor count before the structural design is available. Leave blank to require the engineered spacing." },
  { key: "roof_area_factor", label: "Roof area per module area", group: "Mounting", defaultValue: 1.6, unit: "×", isAssumption: true,
    description: "Gross roof area needed per unit of module area (row spacing, walkways, setbacks). Confirm from the site layout." },
  // Commercial
  { key: "quotation_validity_days", label: "Quotation validity", group: "Commercial", defaultValue: 15, unit: "days", isAssumption: false,
    description: "Default validity period printed on quotations." },
];

export function defaultRules(): Rules {
  return Object.fromEntries(RULE_DEFINITIONS.map((r) => [r.key, r.defaultValue]));
}

export function rule(rules: Rules, key: string): number | null {
  if (key in rules) return rules[key] ?? null;
  const def = RULE_DEFINITIONS.find((r) => r.key === key);
  return def ? def.defaultValue : null;
}

export function ruleLabel(key: string): string {
  return RULE_DEFINITIONS.find((r) => r.key === key)?.label ?? key;
}
