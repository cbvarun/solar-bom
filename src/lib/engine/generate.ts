import { procurementLength, sizeCable } from "./cables";
import { selectInverter, evaluateInverter } from "./inverter";
import { buildRows, mountingQuantities } from "./mounting";
import { installedCapacityW, moduleAreaM2, moduleCount, round } from "./pv";
import { RULE_DEFINITIONS, rule, ruleLabel } from "./rules";
import type {
  Assumption,
  BomLineDraft,
  BomSectionKey,
  Check,
  EngineCatalogue,
  EngineeringInputs,
  EngineResult,
  EngineSummary,
  InputProvenance,
  InverterEvaluation,
  InverterSpec,
  ModuleSpec,
  ProductRef,
  ProjectInputs,
  QuantityStatus,
  RoleKey,
  Rules,
  StructureSpec,
} from "./types";

const PENDING_DESIGN = "Rating per approved electrical design";

/**
 * Generate a preliminary BOM from project inputs, catalogue data and the
 * configured rules. Output is indicative and must be verified by engineering;
 * it is not a substitute for electrical, structural or utility approval.
 */
export function generateBom(input: ProjectInputs, catalogue: EngineCatalogue, rules: Rules): EngineResult {
  const checks: Check[] = [];
  const assumptions: Assumption[] = [];
  const outstanding: string[] = [];
  const lines: BomLineDraft[] = [];
  const eng: EngineeringInputs = input.engineering ?? {};
  const meta = input.inputMeta ?? {};

  const usedRules = new Set<string>();
  const R = (key: string): number | null => {
    usedRules.add(key);
    return rule(rules, key);
  };
  /** Status for a quantity derived from an engineering input. */
  const statusFor = (field: keyof EngineeringInputs): QuantityStatus => {
    const p: InputProvenance | undefined = meta[field]?.provenance;
    if (p === "ENGINEER_VERIFIED") return "ENGINEER_VERIFIED";
    if (p === "MEASURED") return "CALCULATED";
    return "ESTIMATED";
  };
  const describeInput = (field: keyof EngineeringInputs, label: string, value: unknown, unit = "") => {
    const p = meta[field]?.provenance ?? "ESTIMATED";
    assumptions.push({
      key: `input.${field}`,
      label,
      value: `${value}${unit ? " " + unit : ""}`,
      source: p === "ENGINEER_VERIFIED" ? "Engineer-verified input" : p === "MEASURED" ? "Measured on site" : "Provisional estimate — confirm at site survey",
    });
  };

  const add = (l: Omit<BomLineDraft, "itemCode"> & { itemCode?: string; product?: ProductRef | null }) => {
    const { product, ...rest } = l;
    lines.push({
      itemCode: l.itemCode ?? product?.sku ?? `GEN-${l.ruleKey.toUpperCase()}`,
      productId: product?.id ?? null,
      manufacturer: product?.manufacturer ?? null,
      model: product?.model ?? null,
      ...rest,
    } as BomLineDraft);
  };
  const role = (k: RoleKey) => catalogue.roles[k] ?? null;

  // ---------- Inputs completeness ----------
  const target = input.targetCapacityKwp ?? null;
  if (target == null) checks.push({ key: "missing_capacity", severity: "error", area: "Inputs", message: "Target capacity (kWp) is required to size the system." });
  if (!input.roofType) outstanding.push("Roof type to be confirmed during site survey.");
  if (!input.systemType) outstanding.push("Electrical configuration (grid-tied / hybrid / off-grid) to be confirmed.");
  if (!input.supplyPhase) outstanding.push("Supply phase (single / three) to be confirmed from the electricity bill or site survey.");
  if (input.roofAreaM2 == null) outstanding.push("Available roof area to be measured during site survey.");
  if (input.sanctionedLoadKw == null) outstanding.push("Existing sanctioned load to be confirmed from the BESCOM bill.");
  if (!input.exportArrangement) outstanding.push("Metering / export arrangement to be confirmed with BESCOM.");
  if (input.roofType && input.roofType !== "RCC_FLAT") {
    checks.push({ key: "roof_rules_pending", severity: "warning", area: "Mounting",
      message: `Mounting rules for ${input.roofType === "METAL_SHEET" ? "metal-sheet" : "sloped"} roofs are not yet configured. Mounting lines need manual specification by engineering.` });
  }
  if (input.systemType === "OFF_GRID") {
    checks.push({ key: "offgrid_rules_pending", severity: "warning", area: "System design",
      message: "Off-grid design rules (autonomy, battery and charge-controller sizing) are not yet configured. Treat the BOM as a starting point only." });
  }

  // ---------- Module ----------
  const mod: ModuleSpec | null = pickModule(catalogue.modules, input);
  if (!mod) checks.push({ key: "no_module", severity: "error", area: "PV modules", message: "No PV module matches the selection. Choose a module from the catalogue." });

  const summary: EngineSummary = {
    targetDcW: target != null ? target * 1000 : null,
    formulaModuleCount: null,
    moduleCount: null,
    moduleWp: mod?.pmaxW ?? null,
    installedDcW: null,
    inverterAcW: null,
    dcAcRatio: null,
    estimatedRoofAreaM2: null,
    availableRoofAreaM2: input.roofAreaM2 ?? null,
    stringLayout: null,
    selectedModule: mod ? `${mod.manufacturer} ${mod.model}` : null,
    selectedInverter: null,
    selectedStructure: null,
    dcCable: null,
    acCable: null,
    annualGeneration: null,
    annualGenerationUnavailableReason: null,
  };

  if (target == null || !mod) {
    return { summary, lines, checks, assumptions, inverterEvaluations: [], outstanding };
  }

  const formulaCount = moduleCount(target * 1000, mod.pmaxW);
  const override = eng.moduleCountOverride != null && eng.moduleCountOverride > 0 ? Math.round(eng.moduleCountOverride) : null;
  const count = override ?? formulaCount;
  const installedW = installedCapacityW(count, mod.pmaxW);
  summary.formulaModuleCount = formulaCount;
  summary.moduleCount = count;
  summary.installedDcW = installedW;
  const formulaText = `ceil(${round(target * 1000, 1)} W ÷ ${mod.pmaxW} W) = ${formulaCount} modules (${round((formulaCount * mod.pmaxW) / 1000, 3)} kWp)`;
  if (override != null && override !== formulaCount) {
    checks.push({ key: "module_override", severity: "info", area: "PV modules",
      message: `Design array set to ${override} modules (${round(installedW / 1000, 3)} kWp) by design input; the capacity formula gives ${formulaCount}.` });
    describeInput("moduleCountOverride", "Design array (module count)", override, "modules");
  }

  add({
    ruleKey: "pv_modules", section: "PV_MODULES", product: mod, name: mod.name,
    specification: `${mod.pmaxW} Wp, Voc ${mod.vocV} V, Isc ${mod.iscA} A, ${mod.lengthMm}×${mod.widthMm} mm`,
    unit: "nos", calculatedQty: count, quantityStatus: override != null ? statusFor("moduleCountOverride") : "CALCULATED",
    quantityBasis: override != null
      ? `Formula: ${formulaText}. Design array: ${count} × ${mod.pmaxW} W = ${round(installedW / 1000, 3)} kWp (design input).`
      : `${formulaText}; installed ${count} × ${mod.pmaxW} W = ${round(installedW / 1000, 3)} kWp`,
    complianceReq: "BIS/IEC module standards and MNRE ALMM listing as applicable — verify per project category and date.",
    technicalNotes: mod.illustrative ? "Illustrative template module; replace with a verified manufacturer datasheet before procurement." : null,
  });

  // Roof area
  const areaFactor = R("roof_area_factor");
  if (areaFactor != null) {
    const est = round(count * moduleAreaM2(mod) * areaFactor, 1);
    summary.estimatedRoofAreaM2 = est;
    if (input.roofAreaM2 != null && est > input.roofAreaM2) {
      checks.push({ key: "roof_area", severity: "error", area: "Layout",
        message: `Estimated roof area ${est} m² exceeds the available ${input.roofAreaM2} m². Reduce capacity or confirm the usable area at site survey.` });
    }
  }

  // ---------- Inverter ----------
  const minTemp = eng.designMinTempC ?? R("design_min_temp_c") ?? 10;
  if (eng.designMinTempC != null) describeInput("designMinTempC", "Design minimum temperature", eng.designMinTempC, "°C");
  const invCtx = {
    moduleCount: count,
    module: mod,
    systemType: input.systemType ?? null,
    supplyPhase: input.supplyPhase ?? null,
    sanctionedLoadKw: input.sanctionedLoadKw ?? null,
    minTempC: minTemp,
    rules,
  };
  ["dc_ac_ratio_min", "dc_ac_ratio_max", "dc_ac_ratio_target", "design_max_cell_temp_c"].forEach((k) => usedRules.add(k));

  let evaluations: InverterEvaluation[];
  let chosenEval: InverterEvaluation | null;
  let inv: InverterSpec | null = null;
  if (input.selectedInverterId) {
    const selected = catalogue.inverters.find((i) => i.id === input.selectedInverterId) ?? null;
    if (!selected) {
      checks.push({ key: "inverter_missing", severity: "error", area: "Inverter", message: "Selected inverter is not in the catalogue." });
      evaluations = [];
      chosenEval = null;
    } else {
      chosenEval = evaluateInverter(selected, invCtx);
      evaluations = [chosenEval, ...catalogue.inverters.filter((i) => i.id !== selected.id).map((i) => evaluateInverter(i, invCtx))];
      inv = selected;
      if (!chosenEval.compatible) {
        checks.push({ key: "inverter_incompatible", severity: "error", area: "Inverter compatibility",
          message: `Selected inverter ${chosenEval.label} is incompatible with ${count} × ${mod.model}. See the compatibility table.` });
      }
    }
  } else {
    const sel = selectInverter(catalogue.inverters, invCtx, input.preferredInverterManufacturer);
    evaluations = sel.evaluations;
    chosenEval = sel.best;
    inv = chosenEval ? catalogue.inverters.find((i) => i.id === chosenEval!.inverterId) ?? null : null;
    if (!inv) {
      checks.push({ key: "no_compatible_inverter", severity: "error", area: "Inverter compatibility",
        message: "No catalogue inverter is compatible with this array and supply. Review module count, phase and system type." });
    }
  }
  if (chosenEval) checks.push(...chosenEval.issues.map((i) => ({ ...i, key: `inv.${i.key}` })));

  assumptions.push({ key: "rule.design_min_temp_c", label: "Design minimum temperature for Voc", value: `${minTemp} °C`,
    source: eng.designMinTempC != null ? "Project input" : "Configured engineering rule (assumption)" });

  let layout = chosenEval?.layout ?? null;
  summary.stringLayout = layout;
  if (inv) {
    summary.inverterAcW = inv.ratedAcW;
    summary.dcAcRatio = round(installedW / inv.ratedAcW, 3);
    summary.selectedInverter = `${inv.manufacturer} ${inv.model}`;
    add({
      ruleKey: "inverter", section: "INVERTER", product: inv, name: inv.name,
      specification: `${inv.ratedAcW / 1000} kW AC, ${inv.phase === "SINGLE" ? "1-ph" : "3-ph"}, ${inv.mpptCount} MPPT, ${inv.mpptMinV}–${inv.mpptMaxV} V MPPT, ${inv.maxDcVoltageV} V max DC`,
      unit: "nos", calculatedQty: 1, quantityStatus: chosenEval?.compatible ? "CALCULATED" : "TO_BE_CONFIRMED",
      quantityBasis: `DC/AC ratio ${round(installedW / inv.ratedAcW, 2)}; string plan ${layout ? layout.modulesPerString.join(" + ") : "n/a"} modules; Voc at ${minTemp} °C = ${layout?.vocAtMinTempV ?? "n/a"} V`,
      complianceReq: "Inverter safety/grid-code standards and BESCOM-approved list where applicable — verify.",
      technicalNotes: inv.illustrative ? "Illustrative template inverter; confirm against manufacturer datasheet. Provisional, subject to compatibility checks." : "Subject to compatibility checks.",
    });
    if (input.sanctionedLoadKw != null) {
      const ratioLimit = R("sanctioned_load_ratio_limit");
      const acKw = inv.ratedAcW / 1000;
      if (ratioLimit == null) {
        outstanding.push(`Confirm ${acKw} kW AC against sanctioned load ${input.sanctionedLoadKw} kW under current BESCOM/KERC rules.`);
      } else if (acKw > input.sanctionedLoadKw * ratioLimit) {
        checks.push({ key: "sanctioned_load", severity: "error", area: "Grid interconnection",
          message: `Inverter ${acKw} kW exceeds ${ratioLimit} × sanctioned load (${input.sanctionedLoadKw} kW) per configured rule.` });
      }
    }
    if (inv.phase === "SINGLE" && R("single_phase_max_kw") == null) {
      outstanding.push("Confirm the permitted single-phase interconnection capacity with BESCOM (rule not configured).");
    }
  }

  // Battery
  if (input.systemType === "HYBRID" || input.systemType === "OFF_GRID") {
    const cap = eng.batteryCapacityKwh ?? null;
    add({
      ruleKey: "battery", section: "INVERTER", product: role("battery"), name: role("battery")?.name ?? "Battery energy storage system",
      specification: cap ? `${cap} kWh usable (to be confirmed); compatible with selected inverter` : "Capacity per load and backup study",
      unit: "set", calculatedQty: cap ? 1 : null, quantityStatus: cap ? statusFor("batteryCapacityKwh") : "TO_BE_CONFIRMED",
      quantityBasis: cap ? `Battery capacity input ${cap} kWh` : "Requires load profile and backup-hours input",
      complianceReq: "Battery safety standards and inverter-battery compatibility list — verify.",
    });
    if (!cap) outstanding.push("Battery capacity to be sized from the load profile and required backup hours.");
  }

  // ---------- Mounting ----------
  const struct: StructureSpec | null = pickStructure(catalogue.structures, input);
  if (struct) {
    summary.selectedStructure = `${struct.manufacturer} ${struct.model}`;
    const mpr = eng.modulesPerRow ?? R("default_modules_per_row") ?? 5;
    const rows = buildRows(count, mpr, eng.rows);
    const layoutKnown = eng.modulesPerRow != null || eng.rows != null;
    const layoutStatus: QuantityStatus = layoutKnown ? statusFor(eng.modulesPerRow != null ? "modulesPerRow" : "rows") : "ESTIMATED";
    if (layoutKnown) describeInput(eng.modulesPerRow != null ? "modulesPerRow" : "rows", "Module layout", `${rows.length} row(s): ${rows.join(" + ")} modules`);
    else assumptions.push({ key: "rule.default_modules_per_row", label: "Provisional module layout", value: `${rows.length} row(s): ${rows.join(" + ")} modules (portrait)`, source: "Configured default — replace with site layout" });

    const spacing = eng.engineeredSupportSpacingM ?? R("provisional_support_spacing_m");
    const spacingFromDesign = eng.engineeredSupportSpacingM != null;
    const q = mountingQuantities(rows, mod, struct, spacing);
    const basis = `${rows.length} row(s) of ${rows.join("/")} modules, ${struct.railsPerRow} rails per row, ${struct.railStockLengthM} m rail stock`;
    const roofOk = !input.roofType || struct.roofTypes.includes(input.roofType);
    if (!roofOk) checks.push({ key: "structure_roof", severity: "error", area: "Mounting", message: `${struct.model} is not specified for the selected roof type.` });

    add({ ruleKey: "mount_rails", section: "MOUNTING", product: struct, name: struct.name, specification: `${struct.material} rail, ${struct.railStockLengthM} m stock length`,
      unit: "nos", calculatedQty: q.railPieces, quantityStatus: layoutStatus, quantityBasis: `${basis}; total rail ${q.railTotalM} m`,
      complianceReq: "Structural design for wind loading on RCC roof — engineering approval required." });
    if (q.splices > 0) add({ ruleKey: "mount_splices", section: "MOUNTING", product: role("rail_splice"), name: role("rail_splice")?.name ?? "Rail splice kit",
      specification: `Compatible with ${struct.model}`, unit: "nos", calculatedQty: q.splices, quantityStatus: layoutStatus, quantityBasis: "(rail pieces − 1) per rail" });
    add({ ruleKey: "mount_end_clamps", section: "MOUNTING", product: role("end_clamp"), name: role("end_clamp")?.name ?? "End clamp",
      specification: `For ${mod.widthMm > 0 ? "module frame" : "module"}; per manufacturer clamping arrangement`, unit: "nos", calculatedQty: q.endClamps, quantityStatus: layoutStatus,
      quantityBasis: `${struct.endClampsPerRailEnd} per rail end × 2 ends × ${struct.railsPerRow} rails × ${rows.length} rows`,
      technicalNotes: "Clamping zones must follow the module manufacturer's installation manual." });
    add({ ruleKey: "mount_mid_clamps", section: "MOUNTING", product: role("mid_clamp"), name: role("mid_clamp")?.name ?? "Mid clamp",
      specification: "Per manufacturer clamping arrangement", unit: "nos", calculatedQty: q.midClamps, quantityStatus: layoutStatus,
      quantityBasis: `${struct.midClampsPerJointPerRail} per module joint per rail × ${struct.railsPerRow} rails` });

    const supportStatus: QuantityStatus = q.supports == null ? "TO_BE_CONFIRMED" : spacingFromDesign ? statusFor("engineeredSupportSpacingM") : "ESTIMATED";
    add({ ruleKey: "mount_supports", section: "MOUNTING", product: role("structure_support"), name: role("structure_support")?.name ?? "Structure support leg / base",
      specification: `${struct.material}; height and tilt per structural design`, unit: "nos", calculatedQty: q.supports, quantityStatus: supportStatus,
      quantityBasis: q.supports == null ? "Determined from the engineered structural layout (support spacing not yet available)" : `${q.supportBasis}${spacingFromDesign ? "" : " (provisional spacing)"}` });

    const anchorsPer = eng.anchorsPerSupport ?? null;
    const anchors = q.supports != null && anchorsPer != null ? q.supports * anchorsPer : null;
    add({ ruleKey: "roof_anchors", section: "MOUNTING", product: role("roof_anchor"), name: role("roof_anchor")?.name ?? "RCC roof anchor fastener",
      specification: "Type, size and embedment per structural design and pull-out test", unit: "nos", calculatedQty: anchors,
      quantityStatus: anchors == null ? "TO_BE_CONFIRMED" : supportStatus === "ENGINEER_VERIFIED" && statusFor("anchorsPerSupport") === "ENGINEER_VERIFIED" ? "ENGINEER_VERIFIED" : "ESTIMATED",
      quantityBasis: anchors == null ? "Determined from the engineered structural layout — not a fixed number per project" : `${q.supports} supports × ${anchorsPer} anchors per support`,
      complianceReq: "RCC roof anchorage, pull-out capacity and waterproofing — structural engineer approval." });
    if (input.roofType === "RCC_FLAT" || !input.roofType) {
      add({ ruleKey: "waterproofing", section: "MOUNTING", product: role("waterproofing"), name: role("waterproofing")?.name ?? "Waterproofing treatment at anchor points",
        specification: "Compatible with existing roof membrane; drainage paths kept clear", unit: "set", calculatedQty: q.supports, quantityStatus: q.supports == null ? "TO_BE_CONFIRMED" : "ESTIMATED",
        quantityBasis: q.supports == null ? "One set per support location, once the structural layout is fixed" : "One set per support location" });
    }
    if (q.supports == null) outstanding.push("Structural design: support spacing, anchors and wind-load check for the roof.");
  } else {
    checks.push({ key: "no_structure", severity: "warning", area: "Mounting", message: "No mounting structure selected or none matches the roof type. Mounting lines need manual specification." });
  }

  // ---------- DC wiring ----------
  const strings = layout?.modulesPerString.length ?? 0;
  const iscFactor = R("isc_safety_factor") ?? 1.25;
  const ambient = eng.ambientDeratingFactor ?? R("default_ambient_derating") ?? 1;
  const grouping = eng.groupingDeratingFactor ?? R("default_grouping_derating") ?? 1;
  assumptions.push({ key: "derating", label: "Cable derating factors (ambient × grouping)", value: `${ambient} × ${grouping}`,
    source: eng.ambientDeratingFactor != null ? "Project input" : "Configured default — confirm from cable manufacturer tables and installation method" });
  const dcRoute = eng.dcRouteLengthM ?? null;
  if (layout && strings > 0) {
    const internal = R("dc_array_internal_m_per_string") ?? 0;
    const allowance = R("dc_routing_allowance_pct") ?? 0;
    const term = R("termination_allowance_m") ?? 0;
    if (dcRoute != null) {
      describeInput("dcRouteLengthM", "DC route length, array to inverter (one way)", dcRoute, "m");
      const perStringRoute = dcRoute + internal;
      const total = procurementLength(2 * perStringRoute * strings, allowance, 2 * 2 * strings, term);
      const stringVmp = Math.min(...layout.modulesPerString) * mod.vmpV;
      const sizing = sizeCable(catalogue.cables, {
        kind: "DC", lengthM: perStringRoute, designCurrentA: mod.iscA * iscFactor, operatingCurrentA: mod.impA,
        voltageV: stringVmp, vdropLimitPct: R("dc_vdrop_limit_pct") ?? 1.5, deratingFactor: ambient * grouping,
      });
      if (sizing.option) summary.dcCable = { csaMm2: sizing.option.csaMm2, designCurrentA: round(mod.iscA * iscFactor), voltageDropPct: sizing.voltageDropPct! };
      else checks.push({ key: "dc_cable_size", severity: "error", area: "DC wiring", message: `No DC cable in the catalogue meets the current and voltage-drop limits (${sizing.rejected.map((r) => `${r.csaMm2} mm²: ${r.reason}`).join("; ")}).` });
      add({ ruleKey: "dc_cable", section: "DC_WIRING", product: sizing.option, name: sizing.option?.name ?? "DC solar cable",
        specification: sizing.option ? `${sizing.option.csaMm2} mm² single-core PV cable (red/black split); preliminary Vd ${sizing.voltageDropPct}%` : "Size per approved electrical design",
        unit: "m", calculatedQty: total, quantityStatus: statusFor("dcRouteLengthM"),
        quantityBasis: `${strings} string(s) × 2 conductors × (${dcRoute} m route + ${internal} m in-array) + ${allowance}% routing + ${term} m per termination`,
        complianceReq: "Cable sizing for current, voltage drop, installation method, ambient temperature and derating — engineering verification.",
        technicalNotes: `Design current ${round(mod.iscA * iscFactor)} A (Isc × ${iscFactor}); derating ${round(ambient * grouping, 3)}.` });
    } else {
      add({ ruleKey: "dc_cable", section: "DC_WIRING", name: "DC solar cable", specification: "Size per approved electrical design", unit: "m",
        calculatedQty: null, quantityStatus: "TO_BE_CONFIRMED", quantityBasis: "Requires DC route length from the string layout and actual routing" });
      outstanding.push("Measure the DC cable route from array to inverter.");
    }
    const spare = R("connector_spare_pct") ?? 0;
    const pairs = Math.ceil(strings * 2 * (1 + spare / 100));
    add({ ruleKey: "dc_connectors", section: "DC_WIRING", product: role("mc4_connector"), name: role("mc4_connector")?.name ?? "DC connector pair (mated to module connector type)",
      specification: "Must be the same make/type as the module connector, or certified as intermateable", unit: "pair", calculatedQty: pairs, quantityStatus: "CALCULATED",
      quantityBasis: `${strings} string(s) × 2 field terminations + ${spare}% spares`,
      technicalNotes: "Mixing connector brands is a common cause of failures; verify intermateability." });

    // DC protection — avoid duplicating functions integrated in the inverter.
    const designDcCurrent = round(mod.iscA * iscFactor);
    const maxStringsPerMppt = Math.max(...layout.mppts.map((m) => m.length));
    const usedMppts = layout.mppts.filter((m) => m.length > 0).length;
    const extIso = (R("external_dc_isolator_always") ?? 0) >= 1;
    const needIso = inv ? !inv.integrated.dcSwitch || extIso : true;
    const needDcSpd = inv ? !inv.integrated.dcSpd : true;
    const fuseThreshold = R("string_fuse_parallel_threshold") ?? 3;
    const needFuses = maxStringsPerMppt >= fuseThreshold;
    if (needIso) add({ ruleKey: "dc_isolator", section: "DC_WIRING", product: role("dc_isolator"), name: role("dc_isolator")?.name ?? "DC isolator",
      specification: `${PENDING_DESIGN}; DC-rated for ≥ ${layout.vocAtMinTempV} V and design current ${designDcCurrent} A (indicative)`, unit: "nos",
      calculatedQty: usedMppts, quantityStatus: "ESTIMATED", quantityBasis: `One per used MPPT input (${usedMppts})${inv?.integrated.dcSwitch ? "; inverter has an integrated DC switch — external isolator listed per configured rule" : ""}`,
      complianceReq: "Isolation and switching requirements per CEA safety regulations and approved design." });
    if (needDcSpd) add({ ruleKey: "dc_spd", section: "DC_WIRING", product: role("dc_spd"), name: role("dc_spd")?.name ?? "DC surge protection device",
      specification: `${PENDING_DESIGN}; Ucpv ≥ ${layout.vocAtMinTempV} V (indicative)`, unit: "nos", calculatedQty: 1, quantityStatus: "ESTIMATED",
      quantityBasis: "One per DC distribution point; type and count per surge-protection design" });
    else assumptions.push({ key: "dc_spd_integrated", label: "DC surge protection", value: "Integrated in inverter — no separate DC SPD listed", source: "Inverter specification (verify datasheet)" });
    if (needFuses) add({ ruleKey: "string_fuses", section: "DC_WIRING", product: role("string_fuse"), name: role("string_fuse")?.name ?? "String fuse (gPV) with holder",
      specification: `${PENDING_DESIGN}; must not exceed module max series fuse${mod.maxSeriesFuseA ? ` (${mod.maxSeriesFuseA} A)` : ""}`, unit: "nos",
      calculatedQty: strings * 2, quantityStatus: "ESTIMATED", quantityBasis: `${maxStringsPerMppt} parallel strings on an MPPT ≥ threshold ${fuseThreshold}; fuse on + and − of each string` });
    if (needIso || needDcSpd || needFuses) add({ ruleKey: "dcdb", section: "DC_WIRING", product: role("dcdb"), name: role("dcdb")?.name ?? "DC distribution box (DCDB)",
      specification: "Enclosure with IP rating suitable for outdoor/rooftop; houses listed DC protection", unit: "nos", calculatedQty: 1, quantityStatus: "ESTIMATED",
      quantityBasis: "One enclosure for external DC protection devices" });
  } else if (inv) {
    outstanding.push("String design is not valid; DC wiring cannot be calculated.");
  }

  // ---------- AC wiring ----------
  const acRoute = eng.acRouteLengthM ?? null;
  if (inv) {
    const phaseV = inv.phase === "THREE" ? (R("ac_voltage_three_v") ?? 415) : (R("ac_voltage_single_v") ?? 230);
    const pf = R("power_factor") ?? 1;
    const iAc = inv.phase === "THREE" ? inv.ratedAcW / (Math.sqrt(3) * phaseV * pf) : inv.ratedAcW / (phaseV * pf);
    const allowance = R("ac_routing_allowance_pct") ?? 0;
    const term = R("termination_allowance_m") ?? 0;
    if (acRoute != null) {
      describeInput("acRouteLengthM", "AC route length, inverter to point of interconnection", acRoute, "m");
      const sizing = sizeCable(catalogue.cables, { kind: "AC", lengthM: acRoute, designCurrentA: iAc, operatingCurrentA: iAc, voltageV: phaseV,
        phase: inv.phase, vdropLimitPct: R("ac_vdrop_limit_pct") ?? 1.5, deratingFactor: ambient * grouping });
      if (sizing.option) summary.acCable = { csaMm2: sizing.option.csaMm2, designCurrentA: round(iAc), voltageDropPct: sizing.voltageDropPct! };
      else checks.push({ key: "ac_cable_size", severity: "error", area: "AC wiring", message: `No AC cable in the catalogue meets the current and voltage-drop limits.` });
      add({ ruleKey: "ac_cable", section: "AC_WIRING", product: sizing.option, name: sizing.option?.name ?? "AC cable",
        specification: sizing.option ? `${sizing.option.csaMm2} mm² ${sizing.option.cores ?? ""}${sizing.option.cores ? "-core " : ""}Cu; preliminary Vd ${sizing.voltageDropPct}%` : "Size per approved electrical design",
        unit: "m", calculatedQty: procurementLength(acRoute, allowance, 2, term), quantityStatus: statusFor("acRouteLengthM"),
        quantityBasis: `${acRoute} m route + ${allowance}% routing + 2 × ${term} m terminations`,
        complianceReq: "AC cable sizing per approved design and CEA regulations.",
        technicalNotes: `Design current ${round(iAc)} A at ${phaseV} V, pf ${pf}.` });
    } else {
      add({ ruleKey: "ac_cable", section: "AC_WIRING", name: "AC cable", specification: "Size per approved electrical design", unit: "m", calculatedQty: null,
        quantityStatus: "TO_BE_CONFIRMED", quantityBasis: "Requires AC route length from inverter to the point of interconnection" });
      outstanding.push("Measure the AC cable route from inverter to the point of interconnection.");
    }
    add({ ruleKey: "acdb", section: "AC_WIRING", product: role("acdb"), name: role("acdb")?.name ?? "AC distribution box (ACDB)",
      specification: "Houses AC isolation, overcurrent and residual-current protection", unit: "nos", calculatedQty: 1, quantityStatus: "ESTIMATED", quantityBasis: "One per inverter output" });
    add({ ruleKey: "ac_mcb", section: "AC_WIRING", product: role("ac_mcb"), name: role("ac_mcb")?.name ?? "AC circuit breaker (MCB/MCCB)",
      specification: `${PENDING_DESIGN}; ${inv.phase === "THREE" ? "4-pole" : "2-pole"}; indicative output current ${round(iAc)} A`, unit: "nos", calculatedQty: 1, quantityStatus: "ESTIMATED",
      quantityBasis: "One per inverter output", complianceReq: "Protective-device rating from the approved electrical design only." });
    add({ ruleKey: "rcd", section: "AC_WIRING", product: role("rcd"), name: role("rcd")?.name ?? "Residual current device",
      specification: `${PENDING_DESIGN}; type per inverter manufacturer guidance`, unit: "nos", calculatedQty: 1, quantityStatus: "TO_BE_CONFIRMED",
      quantityBasis: "Requirement and type depend on inverter topology and earthing system — engineering to confirm" });
    if (!inv.integrated.acSpd) add({ ruleKey: "ac_spd", section: "AC_WIRING", product: role("ac_spd"), name: role("ac_spd")?.name ?? "AC surge protection device",
      specification: `${PENDING_DESIGN}`, unit: "nos", calculatedQty: 1, quantityStatus: "ESTIMATED", quantityBasis: "One at ACDB; coordinate with building SPD" });
    else assumptions.push({ key: "ac_spd_integrated", label: "AC surge protection", value: "Integrated in inverter — no separate AC SPD listed", source: "Inverter specification (verify datasheet)" });
  }

  // ---------- Earthing ----------
  if (eng.earthingRouteLengthM != null) describeInput("earthingRouteLengthM", "Earthing conductor routing length", eng.earthingRouteLengthM, "m");
  add({ ruleKey: "earth_conductor", section: "EARTHING", product: role("earth_conductor"), name: role("earth_conductor")?.name ?? "Earthing conductor",
    specification: "Material and size per earthing design", unit: "m",
    calculatedQty: eng.earthingRouteLengthM != null ? procurementLength(eng.earthingRouteLengthM, R("dc_routing_allowance_pct") ?? 0, 0, 0) : null,
    quantityStatus: eng.earthingRouteLengthM != null ? statusFor("earthingRouteLengthM") : "TO_BE_CONFIRMED",
    quantityBasis: eng.earthingRouteLengthM != null ? `Measured routing ${eng.earthingRouteLengthM} m + routing allowance` : "Requires measured routing of the earthing conductors",
    complianceReq: "Earthing and bonding per CEA regulations and the earthing design." });
  if (eng.earthElectrodes != null) describeInput("earthElectrodes", "Earth electrodes from site design", eng.earthElectrodes, "nos");
  add({ ruleKey: "earth_electrodes", section: "EARTHING", product: role("earth_electrode"), name: role("earth_electrode")?.name ?? "Earth electrode with pit",
    specification: "Type per earthing design and soil resistivity test", unit: "nos", calculatedQty: eng.earthElectrodes ?? null,
    quantityStatus: eng.earthElectrodes != null ? statusFor("earthElectrodes") : "TO_BE_CONFIRMED",
    quantityBasis: eng.earthElectrodes != null ? "From site earthing design input" : "Determined by site design and applicable requirements — not a fixed number of pits" });
  add({ ruleKey: "bonding", section: "EARTHING", product: role("bonding_kit"), name: role("bonding_kit")?.name ?? "Equipotential bonding kit (module frames and structure)",
    specification: "Bonding lugs/washers compatible with module frame and rail", unit: "lot", calculatedQty: 1, quantityStatus: "ESTIMATED", quantityBasis: "One lot per array" });
  if (eng.earthElectrodes == null) outstanding.push("Earthing design: soil resistivity test and electrode count.");

  // ---------- Lightning ----------
  const lp = eng.lightningProtection ?? "TBC";
  if (lp === "YES" || lp === "TBC") {
    add({ ruleKey: "lightning_arrester", section: "LIGHTNING", product: role("lightning_arrester"), name: role("lightning_arrester")?.name ?? "Lightning protection air terminal",
      specification: "Type and protection zone per lightning risk assessment", unit: "set", calculatedQty: lp === "YES" ? 1 : null,
      quantityStatus: lp === "YES" ? "ESTIMATED" : "TO_BE_CONFIRMED", quantityBasis: lp === "YES" ? "Required per risk assessment input; count per protection-zone design" : "Requirement subject to lightning risk assessment" });
    add({ ruleKey: "down_conductor", section: "LIGHTNING", product: role("down_conductor"), name: role("down_conductor")?.name ?? "Lightning down conductor",
      specification: "Per lightning protection design", unit: "m", calculatedQty: lp === "YES" ? eng.downConductorLengthM ?? null : null,
      quantityStatus: lp === "YES" && eng.downConductorLengthM != null ? statusFor("downConductorLengthM") : "TO_BE_CONFIRMED",
      quantityBasis: eng.downConductorLengthM != null ? `Routing ${eng.downConductorLengthM} m` : "Requires measured routing" });
    if (lp === "TBC") outstanding.push("Lightning risk assessment to decide whether lightning protection is required.");
  } else {
    assumptions.push({ key: "lightning", label: "Lightning protection", value: "Not required", source: "Project input (risk assessment)" });
  }

  // ---------- Metering ----------
  const exp = input.exportArrangement;
  if (exp === "NET_METERING" || exp === "OTHER_APPROVED" || !exp) {
    add({ ruleKey: "net_meter", section: "METERING", product: role("net_meter"), name: role("net_meter")?.name ?? "Bi-directional energy meter",
      specification: "Make/type as approved by BESCOM; testing through the utility process", unit: "nos", calculatedQty: 1, quantityStatus: exp ? "ESTIMATED" : "TO_BE_CONFIRMED",
      quantityBasis: "One per service connection, subject to the approved metering arrangement",
      complianceReq: "BESCOM metering and interconnection approval required." });
  }
  add({ ruleKey: "generation_meter", section: "METERING", product: role("generation_meter"), name: role("generation_meter")?.name ?? "Solar generation meter",
    specification: "If required by the applicable metering arrangement", unit: "nos", calculatedQty: null, quantityStatus: "TO_BE_CONFIRMED",
    quantityBasis: "Requirement depends on the current BESCOM/KERC metering arrangement" });
  if (exp === "EXPORT_LIMITED") {
    const integrated = inv?.integrated.exportLimiting;
    add({ ruleKey: "export_limiter", section: "METERING", product: role("export_limiter"), name: role("export_limiter")?.name ?? "Export-limiting meter/CT kit",
      specification: "Compatible with the selected inverter's export control function", unit: "set", calculatedQty: 1, quantityStatus: "ESTIMATED",
      quantityBasis: integrated ? "Inverter supports export limiting; external meter/CT still needed for measurement" : "Required for export-limited configuration" });
  }

  // ---------- Monitoring ----------
  if (input.monitoring !== "NONE") {
    const needLogger = input.monitoring === "ADVANCED" || (inv ? !inv.integrated.monitoring : true);
    if (needLogger) add({ ruleKey: "monitoring", section: "MONITORING", product: role("monitoring_logger"), name: role("monitoring_logger")?.name ?? "Monitoring data logger / communication module",
      specification: "Compatible with selected inverter; internet connectivity by customer", unit: "nos", calculatedQty: 1, quantityStatus: "ESTIMATED",
      quantityBasis: input.monitoring === "ADVANCED" ? "Advanced monitoring requested" : "Inverter has no integrated monitoring" });
    else assumptions.push({ key: "monitoring_integrated", label: "Monitoring", value: "Inverter-integrated monitoring; no separate logger listed", source: "Inverter specification (verify)" });
  }

  // ---------- Cable management ----------
  if (dcRoute != null || acRoute != null) {
    const route = (dcRoute ?? 0) + (acRoute ?? 0);
    const pct = R("conduit_allowance_pct") ?? 0;
    add({ ruleKey: "conduit", section: "CABLE_MGMT", product: role("conduit"), name: role("conduit")?.name ?? "UV-resistant conduit / cable tray",
      specification: "Containment for DC and AC runs; size per cable fill", unit: "m", calculatedQty: round(route * (1 + pct / 100), 1),
      quantityStatus: dcRoute != null && acRoute != null ? (statusFor("dcRouteLengthM") === "ESTIMATED" || statusFor("acRouteLengthM") === "ESTIMATED" ? "ESTIMATED" : "CALCULATED") : "ESTIMATED",
      quantityBasis: `(DC ${dcRoute ?? "?"} m + AC ${acRoute ?? "?"} m) + ${pct}%` });
  } else {
    add({ ruleKey: "conduit", section: "CABLE_MGMT", name: "UV-resistant conduit / cable tray", specification: "Containment for DC and AC runs", unit: "m", calculatedQty: null,
      quantityStatus: "TO_BE_CONFIRMED", quantityBasis: "Requires measured cable routes" });
  }
  add({ ruleKey: "cable_ties", section: "CABLE_MGMT", product: role("cable_ties"), name: role("cable_ties")?.name ?? "UV-stabilised cable ties, glands and lugs",
    specification: "Installation consumables", unit: "lot", calculatedQty: 1, quantityStatus: "ESTIMATED", quantityBasis: "One lot per project" });

  // ---------- Safety ----------
  add({ ruleKey: "signage", section: "SAFETY", product: role("warning_signage"), name: role("warning_signage")?.name ?? "Warning and identification labels",
    specification: "DC/AC isolation, dual-supply and shutdown labels", unit: "set", calculatedQty: 1, quantityStatus: "ESTIMATED", quantityBasis: "One set per installation" });
  add({ ruleKey: "fire_extinguisher", section: "SAFETY", product: role("fire_extinguisher"), name: role("fire_extinguisher")?.name ?? "Fire extinguisher suitable for electrical fires",
    specification: "Type and count per site safety plan", unit: "nos", calculatedQty: null, quantityStatus: "TO_BE_CONFIRMED", quantityBasis: "Per site safety plan" });

  // ---------- Services ----------
  const kwp = installedW / 1000;
  for (const s of catalogue.services) {
    if (s.code === "NET_METERING_LIAISON" && exp && exp !== "NET_METERING") continue;
    add({ ruleKey: `svc_${s.code.toLowerCase()}`, section: "SERVICES", itemCode: s.code, name: s.name, specification: s.basis === "PER_KWP" ? `Per kWp of installed DC capacity` : "Lump sum",
      unit: s.unit, calculatedQty: s.basis === "PER_KWP" ? round(kwp, 3) : 1, quantityStatus: "CALCULATED", quantityBasis: s.basis === "PER_KWP" ? `${round(kwp, 3)} kWp installed` : "One per project" });
  }

  // ---------- Generation ----------
  if (eng.specificYieldKwhPerKwpYr != null && eng.specificYieldSource && meta.specificYieldKwhPerKwpYr?.provenance === "ENGINEER_VERIFIED") {
    summary.annualGeneration = { kwh: Math.round(kwp * eng.specificYieldKwhPerKwpYr),
      basis: `${round(kwp, 3)} kWp × ${eng.specificYieldKwhPerKwpYr} kWh/kWp/yr (${eng.specificYieldSource}). Indicative, not guaranteed.` };
  } else {
    summary.annualGenerationUnavailableReason = "Requires an engineer-verified specific yield with a cited source (e.g. a simulation for this site). Not estimated from defaults.";
  }

  // Rule assumptions actually used
  for (const key of usedRules) {
    const v = rule(rules, key);
    if (v == null) continue;
    if (assumptions.some((a) => a.key === `rule.${key}`)) continue;
    const unit = RULE_DEFINITIONS.find((r) => r.key === key)?.unit;
    assumptions.push({ key: `rule.${key}`, label: ruleLabel(key), value: unit && !unit.includes("/") ? `${v} ${unit}` : String(v), source: "Configured engineering rule" });
  }

  outstanding.push("Electrical design approval (protective-device ratings, cable sizing, string plan).");
  outstanding.push("BESCOM interconnection and metering approval.");

  return { summary, lines, checks, assumptions, inverterEvaluations: evaluations, outstanding: [...new Set(outstanding)] };
}

function pickModule(mods: ModuleSpec[], input: ProjectInputs): ModuleSpec | null {
  if (input.selectedModuleId) return mods.find((m) => m.id === input.selectedModuleId) ?? null;
  let pool = mods;
  if (input.preferredModuleManufacturer) {
    const f = pool.filter((m) => m.manufacturer === input.preferredModuleManufacturer);
    if (f.length) pool = f;
  }
  if (input.preferredModuleWp) {
    const exact = pool.filter((m) => m.pmaxW === input.preferredModuleWp);
    if (exact.length) return exact[0];
    return [...pool].sort((a, b) => Math.abs(a.pmaxW - input.preferredModuleWp!) - Math.abs(b.pmaxW - input.preferredModuleWp!))[0] ?? null;
  }
  return [...pool].sort((a, b) => b.pmaxW - a.pmaxW)[0] ?? null;
}

function pickStructure(structs: StructureSpec[], input: ProjectInputs): StructureSpec | null {
  if (input.selectedStructureId) return structs.find((s) => s.id === input.selectedStructureId) ?? null;
  let pool = input.roofType ? structs.filter((s) => s.roofTypes.includes(input.roofType!)) : structs;
  if (input.mountingMaterial) {
    const f = pool.filter((s) => s.material.toLowerCase().includes(input.mountingMaterial!.toLowerCase()));
    if (f.length) pool = f;
  }
  return pool[0] ?? null;
}

export function sectionLabel(key: BomSectionKey | string): string {
  const map: Record<string, string> = {
    PV_MODULES: "PV modules", MOUNTING: "Mounting structure and roof anchors", INVERTER: "Inverter and power conversion",
    DC_WIRING: "DC wiring and protection", AC_WIRING: "AC wiring and protection", EARTHING: "Earthing and bonding",
    LIGHTNING: "Lightning protection", METERING: "Metering and grid interconnection", MONITORING: "Monitoring and communications",
    CABLE_MGMT: "Cable management and installation accessories", SAFETY: "Safety equipment", SERVICES: "Engineering, installation and commissioning services",
  };
  return map[key] ?? key;
}
