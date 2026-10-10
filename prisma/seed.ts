/**
 * Seed data. Every product, manufacturer and supplier here is an
 * ILLUSTRATIVE template: generic values chosen to exercise the calculation
 * engine. None of it is a real product claim. No prices, certifications,
 * warranties or stock levels are asserted. Replace with verified
 * manufacturer data before use.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { RULE_DEFINITIONS } from "../src/lib/engine/rules";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const CATEGORIES = [
  ["pv-modules", "Solar PV modules", "PV_MODULES"],
  ["inverters", "String and hybrid inverters", "INVERTER"],
  ["mounting-structures", "Solar mounting structures", "MOUNTING"],
  ["dc-cables-connectors", "DC cables and connectors", "DC_WIRING"],
  ["ac-cables-accessories", "AC cables and electrical accessories", "AC_WIRING"],
  ["dc-protection", "DC protection and combiner boxes", "DC_WIRING"],
  ["ac-distribution", "AC distribution and protection panels", "AC_WIRING"],
  ["surge-protection", "Surge protection devices", "DC_WIRING"],
  ["earthing-bonding", "Earthing and bonding equipment", "EARTHING"],
  ["lightning-protection", "Lightning protection", "LIGHTNING"],
  ["metering", "Net metering and energy meters", "METERING"],
  ["monitoring", "Monitoring systems and data loggers", "MONITORING"],
  ["cable-management", "Cable trays, conduits and enclosures", "CABLE_MGMT"],
  ["roof-anchoring", "Roof anchoring and waterproofing accessories", "MOUNTING"],
  ["battery-storage", "Battery storage systems", "INVERTER"],
  ["installation-safety", "Installation, commissioning and safety accessories", "SAFETY"],
] as const;

type Spec = [key: string, label: string, value: number | string, unit?: string];

interface SeedProduct {
  sku: string;
  name: string;
  model: string;
  category: string;
  mfr: string;
  unit: string;
  tax?: string;
  description?: string;
  ip?: string;
  material?: string;
  dims?: string;
  weight?: number;
  specs: Spec[];
}

const MFR = {
  A: "Sample Manufacturer A (illustrative)",
  B: "Sample Manufacturer B (illustrative)",
  C: "Sample Manufacturer C (illustrative)",
  D: "Sample Manufacturer D (illustrative)",
  E: "Sample Manufacturer E (illustrative)",
};

const moduleSpecs = (w: number, voc: number, isc: number, vmp: number, imp: number, l: number, wd: number): Spec[] => [
  ["pmax_w", "Rated power (Pmax, STC)", w, "Wp"],
  ["voc_v", "Open-circuit voltage (Voc)", voc, "V"],
  ["isc_a", "Short-circuit current (Isc)", isc, "A"],
  ["vmp_v", "Voltage at Pmax (Vmp)", vmp, "V"],
  ["imp_a", "Current at Pmax (Imp)", imp, "A"],
  ["beta_voc_pct_per_c", "Temperature coefficient of Voc", -0.27, "%/°C"],
  ["gamma_pmax_pct_per_c", "Temperature coefficient of Pmax", -0.35, "%/°C"],
  ["length_mm", "Length", l, "mm"],
  ["width_mm", "Width", wd, "mm"],
  ["max_system_voltage_v", "Maximum system voltage", 1500, "V"],
  ["max_series_fuse_a", "Maximum series fuse rating", 25, "A"],
  ["cell_type", "Cell technology", "Monocrystalline (generic)"],
];

const inverterSpecs = (o: {
  type: string; phase: string; ac: number; dcMax: number; vdc: number; mpptMin: number; mpptMax: number; start: number;
  mppts: number; spm: number; imax: number; isc: number; vac: number; dcSw: number; dcSpd: number; acSpd: number; mon: number; expLim: number;
}): Spec[] => [
  ["inverter_type", "Inverter type", o.type],
  ["phase", "AC phase", o.phase],
  ["rated_ac_w", "Rated AC output power", o.ac, "W"],
  ["max_dc_power_w", "Maximum DC input power", o.dcMax, "W"],
  ["max_dc_voltage_v", "Maximum DC input voltage", o.vdc, "V"],
  ["mppt_min_v", "MPPT voltage range (min)", o.mpptMin, "V"],
  ["mppt_max_v", "MPPT voltage range (max)", o.mpptMax, "V"],
  ["start_voltage_v", "Start-up voltage", o.start, "V"],
  ["mppt_count", "Number of MPPTs", o.mppts, "nos"],
  ["strings_per_mppt", "Strings per MPPT", o.spm, "nos"],
  ["max_input_current_per_mppt_a", "Max input current per MPPT", o.imax, "A"],
  ["max_isc_per_mppt_a", "Max short-circuit current per MPPT", o.isc, "A"],
  ["ac_nominal_voltage_v", "Nominal AC voltage", o.vac, "V"],
  ["integrated_dc_switch", "Integrated DC switch", o.dcSw, "1/0"],
  ["integrated_dc_spd", "Integrated DC SPD", o.dcSpd, "1/0"],
  ["integrated_ac_spd", "Integrated AC SPD", o.acSpd, "1/0"],
  ["integrated_monitoring", "Integrated monitoring interface", o.mon, "1/0"],
  ["export_limiting", "Export-limiting function", o.expLim, "1/0"],
];

const role = (r: string): Spec => ["bom_role", "BOM role", r];

const PRODUCTS: SeedProduct[] = [
  // Modules
  { sku: "PVM-A-550", name: "Mono PERC module 550 Wp (template)", model: "SMA-550M-144", category: "pv-modules", mfr: MFR.A, unit: "nos", tax: "GST-SOLAR-GOODS",
    description: "Illustrative 144 half-cell module template used for the sample project.", material: "Anodised aluminium frame, tempered glass", dims: "2278 × 1134 × 35 mm", weight: 28,
    specs: moduleSpecs(550, 49.5, 14.0, 41.6, 13.2, 2278, 1134) },
  { sku: "PVM-A-540", name: "Mono PERC module 540 Wp (template)", model: "SMA-540M-144", category: "pv-modules", mfr: MFR.A, unit: "nos", tax: "GST-SOLAR-GOODS",
    material: "Anodised aluminium frame, tempered glass", dims: "2278 × 1134 × 35 mm", weight: 28, specs: moduleSpecs(540, 49.3, 13.8, 41.4, 13.05, 2278, 1134) },
  { sku: "PVM-B-545", name: "TOPCon bifacial module 545 Wp (template)", model: "SMB-545N-BF", category: "pv-modules", mfr: MFR.B, unit: "nos", tax: "GST-SOLAR-GOODS",
    material: "Aluminium frame, dual glass", dims: "2278 × 1134 × 30 mm", weight: 32, specs: moduleSpecs(545, 49.9, 13.9, 41.9, 13.0, 2278, 1134) },
  { sku: "PVM-B-440", name: "Mono module 440 Wp (template)", model: "SMB-440M-108", category: "pv-modules", mfr: MFR.B, unit: "nos", tax: "GST-SOLAR-GOODS",
    material: "Aluminium frame, tempered glass", dims: "1722 × 1134 × 30 mm", weight: 21, specs: moduleSpecs(440, 39.0, 14.1, 32.6, 13.5, 1722, 1134) },
  // Inverters
  { sku: "INV-C-3K1", name: "Grid-tied string inverter 3 kW, single-phase (template)", model: "SMC-GT3K-1P", category: "inverters", mfr: MFR.C, unit: "nos", tax: "GST-SOLAR-GOODS", ip: "IP65",
    specs: inverterSpecs({ type: "GRID_TIED", phase: "SINGLE", ac: 3000, dcMax: 4500, vdc: 600, mpptMin: 90, mpptMax: 550, start: 100, mppts: 1, spm: 1, imax: 16, isc: 20, vac: 230, dcSw: 1, dcSpd: 1, acSpd: 0, mon: 1, expLim: 1 }) },
  { sku: "INV-C-4K1", name: "Grid-tied string inverter 4 kW, single-phase (template)", model: "SMC-GT4K-1P", category: "inverters", mfr: MFR.C, unit: "nos", tax: "GST-SOLAR-GOODS", ip: "IP65",
    specs: inverterSpecs({ type: "GRID_TIED", phase: "SINGLE", ac: 4000, dcMax: 6000, vdc: 600, mpptMin: 90, mpptMax: 550, start: 100, mppts: 2, spm: 1, imax: 16, isc: 20, vac: 230, dcSw: 1, dcSpd: 1, acSpd: 0, mon: 1, expLim: 1 }) },
  { sku: "INV-C-5K1", name: "Grid-tied string inverter 5 kW, single-phase (template)", model: "SMC-GT5K-1P", category: "inverters", mfr: MFR.C, unit: "nos", tax: "GST-SOLAR-GOODS", ip: "IP65",
    specs: inverterSpecs({ type: "GRID_TIED", phase: "SINGLE", ac: 5000, dcMax: 7500, vdc: 600, mpptMin: 90, mpptMax: 550, start: 100, mppts: 2, spm: 1, imax: 16, isc: 20, vac: 230, dcSw: 1, dcSpd: 1, acSpd: 0, mon: 1, expLim: 1 }) },
  { sku: "INV-C-10K3", name: "Grid-tied string inverter 10 kW, three-phase (template)", model: "SMC-GT10K-3P", category: "inverters", mfr: MFR.C, unit: "nos", tax: "GST-SOLAR-GOODS", ip: "IP65",
    specs: inverterSpecs({ type: "GRID_TIED", phase: "THREE", ac: 10000, dcMax: 15000, vdc: 1100, mpptMin: 160, mpptMax: 950, start: 180, mppts: 2, spm: 2, imax: 32, isc: 40, vac: 415, dcSw: 1, dcSpd: 1, acSpd: 1, mon: 1, expLim: 1 }) },
  { sku: "INV-C-25K3", name: "Grid-tied string inverter 25 kW, three-phase (template)", model: "SMC-GT25K-3P", category: "inverters", mfr: MFR.C, unit: "nos", tax: "GST-SOLAR-GOODS", ip: "IP66",
    specs: inverterSpecs({ type: "GRID_TIED", phase: "THREE", ac: 25000, dcMax: 37500, vdc: 1100, mpptMin: 180, mpptMax: 1000, start: 200, mppts: 3, spm: 2, imax: 32, isc: 40, vac: 415, dcSw: 1, dcSpd: 1, acSpd: 1, mon: 1, expLim: 1 }) },
  { sku: "INV-D-5KH", name: "Hybrid inverter 5 kW, single-phase (template)", model: "SMD-HY5K-1P", category: "inverters", mfr: MFR.D, unit: "nos", tax: "GST-SOLAR-GOODS", ip: "IP65",
    specs: inverterSpecs({ type: "HYBRID", phase: "SINGLE", ac: 5000, dcMax: 6500, vdc: 550, mpptMin: 120, mpptMax: 500, start: 125, mppts: 2, spm: 1, imax: 16, isc: 20, vac: 230, dcSw: 1, dcSpd: 0, acSpd: 0, mon: 1, expLim: 1 }) },
  // Mounting
  { sku: "MST-E-RCC-AL", name: "Elevated RCC flat-roof structure, aluminium rail (template)", model: "SME-RCC-AL-E", category: "mounting-structures", mfr: MFR.E, unit: "nos", tax: "GST-SOLAR-GOODS",
    material: "Aluminium alloy rails, stainless-steel fasteners", description: "Rail-based elevated structure for RCC roofs. Tilt, height and foundation details per structural design.",
    specs: [["rail_stock_length_m", "Rail stock length", 4.2, "m"], ["rails_per_row", "Rails per module row", 2, "nos"], ["end_clamps_per_rail_end", "End clamps per rail end", 1, "nos"],
      ["mid_clamps_per_joint_per_rail", "Mid clamps per module joint per rail", 1, "nos"], ["module_gap_mm", "Gap between modules", 20, "mm"], ["rail_overhang_mm", "Rail overhang each end", 50, "mm"],
      ["roof_types", "Suitable roof types", "RCC_FLAT"], ["material_class", "Structure material", "Aluminium"]] },
  { sku: "MST-E-RCC-GI", name: "Elevated RCC flat-roof structure, hot-dip galvanised steel (template)", model: "SME-RCC-GI-E", category: "mounting-structures", mfr: MFR.E, unit: "nos", tax: "GST-SOLAR-GOODS",
    material: "Hot-dip galvanised steel", specs: [["rail_stock_length_m", "Rail stock length", 6, "m"], ["rails_per_row", "Rails per module row", 2, "nos"], ["end_clamps_per_rail_end", "End clamps per rail end", 1, "nos"],
      ["mid_clamps_per_joint_per_rail", "Mid clamps per module joint per rail", 1, "nos"], ["module_gap_mm", "Gap between modules", 20, "mm"], ["rail_overhang_mm", "Rail overhang each end", 50, "mm"],
      ["roof_types", "Suitable roof types", "RCC_FLAT"], ["material_class", "Structure material", "Galvanised steel"]] },
  { sku: "MST-E-SPL", name: "Rail splice kit (template)", model: "SME-SPL", category: "mounting-structures", mfr: MFR.E, unit: "nos", specs: [role("rail_splice")] },
  { sku: "MST-E-ECL", name: "End clamp, 30–35 mm frame (template)", model: "SME-EC35", category: "mounting-structures", mfr: MFR.E, unit: "nos", material: "Aluminium", specs: [role("end_clamp")] },
  { sku: "MST-E-MCL", name: "Mid clamp, 30–35 mm frame (template)", model: "SME-MC35", category: "mounting-structures", mfr: MFR.E, unit: "nos", material: "Aluminium", specs: [role("mid_clamp")] },
  { sku: "MST-E-LEG", name: "Support leg with base plate (template)", model: "SME-LEG", category: "mounting-structures", mfr: MFR.E, unit: "nos", specs: [role("structure_support")] },
  // DC
  { sku: "DCC-D-4", name: "PV DC cable 4 mm² (template)", model: "SMD-PV4", category: "dc-cables-connectors", mfr: MFR.D, unit: "m", tax: "GST-ELEC-GOODS",
    specs: [["cable_kind", "Cable type", "DC"], ["csa_mm2", "Conductor cross-section", 4, "mm²"], ["ampacity_a", "Reference current capacity (before derating)", 55, "A"], ["resistance_ohm_per_km", "Conductor resistance", 5.09, "Ω/km"]] },
  { sku: "DCC-D-6", name: "PV DC cable 6 mm² (template)", model: "SMD-PV6", category: "dc-cables-connectors", mfr: MFR.D, unit: "m", tax: "GST-ELEC-GOODS",
    specs: [["cable_kind", "Cable type", "DC"], ["csa_mm2", "Conductor cross-section", 6, "mm²"], ["ampacity_a", "Reference current capacity (before derating)", 70, "A"], ["resistance_ohm_per_km", "Conductor resistance", 3.39, "Ω/km"]] },
  { sku: "DCC-D-10", name: "PV DC cable 10 mm² (template)", model: "SMD-PV10", category: "dc-cables-connectors", mfr: MFR.D, unit: "m", tax: "GST-ELEC-GOODS",
    specs: [["cable_kind", "Cable type", "DC"], ["csa_mm2", "Conductor cross-section", 10, "mm²"], ["ampacity_a", "Reference current capacity (before derating)", 98, "A"], ["resistance_ohm_per_km", "Conductor resistance", 1.95, "Ω/km"]] },
  { sku: "DCN-D-PAIR", name: "DC connector pair (template)", model: "SMD-CONN", category: "dc-cables-connectors", mfr: MFR.D, unit: "pair", ip: "IP68", specs: [role("mc4_connector")] },
  // AC cables
  { sku: "ACC-D-4-3C", name: "AC cable 4 mm² 3-core Cu (template)", model: "SMD-AC4-3C", category: "ac-cables-accessories", mfr: MFR.D, unit: "m", tax: "GST-ELEC-GOODS",
    specs: [["cable_kind", "Cable type", "AC"], ["csa_mm2", "Conductor cross-section", 4, "mm²"], ["ampacity_a", "Reference current capacity (before derating)", 36, "A"], ["resistance_ohm_per_km", "Conductor resistance", 5.52, "Ω/km"], ["cores", "Cores", 3, "nos"]] },
  { sku: "ACC-D-6-3C", name: "AC cable 6 mm² 3-core Cu (template)", model: "SMD-AC6-3C", category: "ac-cables-accessories", mfr: MFR.D, unit: "m", tax: "GST-ELEC-GOODS",
    specs: [["cable_kind", "Cable type", "AC"], ["csa_mm2", "Conductor cross-section", 6, "mm²"], ["ampacity_a", "Reference current capacity (before derating)", 46, "A"], ["resistance_ohm_per_km", "Conductor resistance", 3.69, "Ω/km"], ["cores", "Cores", 3, "nos"]] },
  { sku: "ACC-D-10-4C", name: "AC cable 10 mm² 4-core Cu (template)", model: "SMD-AC10-4C", category: "ac-cables-accessories", mfr: MFR.D, unit: "m", tax: "GST-ELEC-GOODS",
    specs: [["cable_kind", "Cable type", "AC"], ["csa_mm2", "Conductor cross-section", 10, "mm²"], ["ampacity_a", "Reference current capacity (before derating)", 60, "A"], ["resistance_ohm_per_km", "Conductor resistance", 2.19, "Ω/km"], ["cores", "Cores", 4, "nos"]] },
  // Protection
  { sku: "DCP-D-ISO", name: "DC isolator, 2-pole (template)", model: "SMD-DCISO", category: "dc-protection", mfr: MFR.D, unit: "nos", tax: "GST-ELEC-GOODS", ip: "IP66", specs: [role("dc_isolator")] },
  { sku: "DCP-D-FUSE", name: "gPV string fuse with holder (template)", model: "SMD-GPV", category: "dc-protection", mfr: MFR.D, unit: "nos", tax: "GST-ELEC-GOODS", specs: [role("string_fuse")] },
  { sku: "DCP-D-DCDB", name: "DC distribution box enclosure (template)", model: "SMD-DCDB", category: "dc-protection", mfr: MFR.D, unit: "nos", tax: "GST-ELEC-GOODS", ip: "IP65", material: "Polycarbonate", specs: [role("dcdb")] },
  { sku: "ACP-D-ACDB", name: "AC distribution box enclosure (template)", model: "SMD-ACDB", category: "ac-distribution", mfr: MFR.D, unit: "nos", tax: "GST-ELEC-GOODS", ip: "IP65", specs: [role("acdb")] },
  { sku: "ACP-D-MCB", name: "AC circuit breaker (template)", model: "SMD-MCB", category: "ac-distribution", mfr: MFR.D, unit: "nos", tax: "GST-ELEC-GOODS", specs: [role("ac_mcb")] },
  { sku: "ACP-D-RCD", name: "Residual current device (template)", model: "SMD-RCD", category: "ac-distribution", mfr: MFR.D, unit: "nos", tax: "GST-ELEC-GOODS", specs: [role("rcd")] },
  { sku: "SPD-D-DC", name: "DC surge protection device, Type 2 (template)", model: "SMD-SPD-DC", category: "surge-protection", mfr: MFR.D, unit: "nos", tax: "GST-ELEC-GOODS", specs: [role("dc_spd")] },
  { sku: "SPD-D-AC", name: "AC surge protection device, Type 2 (template)", model: "SMD-SPD-AC", category: "surge-protection", mfr: MFR.D, unit: "nos", tax: "GST-ELEC-GOODS", specs: [role("ac_spd")] },
  // Earthing / lightning
  { sku: "ERT-E-ELEC", name: "Earth electrode with inspection pit (template)", model: "SME-EE", category: "earthing-bonding", mfr: MFR.E, unit: "nos", tax: "GST-ELEC-GOODS", specs: [role("earth_electrode")] },
  { sku: "ERT-E-COND", name: "Earthing conductor (template)", model: "SME-EC", category: "earthing-bonding", mfr: MFR.E, unit: "m", tax: "GST-ELEC-GOODS", specs: [role("earth_conductor")] },
  { sku: "ERT-E-BOND", name: "Module/structure bonding kit (template)", model: "SME-BK", category: "earthing-bonding", mfr: MFR.E, unit: "lot", specs: [role("bonding_kit")] },
  { sku: "LPS-E-AT", name: "Lightning air terminal set (template)", model: "SME-LA", category: "lightning-protection", mfr: MFR.E, unit: "set", specs: [role("lightning_arrester")] },
  { sku: "LPS-E-DC", name: "Lightning down conductor (template)", model: "SME-LDC", category: "lightning-protection", mfr: MFR.E, unit: "m", specs: [role("down_conductor")] },
  // Metering / monitoring
  { sku: "MTR-C-BIDI", name: "Bi-directional energy meter (template — utility-approved make required)", model: "SMC-NM", category: "metering", mfr: MFR.C, unit: "nos", specs: [role("net_meter")] },
  { sku: "MTR-C-GEN", name: "Solar generation meter (template)", model: "SMC-GM", category: "metering", mfr: MFR.C, unit: "nos", specs: [role("generation_meter")] },
  { sku: "MTR-C-EXP", name: "Export-limiting meter and CT kit (template)", model: "SMC-EL", category: "metering", mfr: MFR.C, unit: "set", specs: [role("export_limiter")] },
  { sku: "MON-C-LOG", name: "Monitoring data logger (template)", model: "SMC-DL", category: "monitoring", mfr: MFR.C, unit: "nos", specs: [role("monitoring_logger")] },
  // Cable management / roof / safety / battery
  { sku: "CBM-E-CND", name: "UV-resistant conduit (template)", model: "SME-CND25", category: "cable-management", mfr: MFR.E, unit: "m", specs: [role("conduit")] },
  { sku: "CBM-E-TRAY", name: "Perforated cable tray (template)", model: "SME-TRAY", category: "cable-management", mfr: MFR.E, unit: "m", specs: [role("cable_tray")] },
  { sku: "CBM-E-ACC", name: "Cable ties, glands and lugs kit (template)", model: "SME-ACC", category: "cable-management", mfr: MFR.E, unit: "lot", specs: [role("cable_ties")] },
  { sku: "RFA-E-ANC", name: "RCC anchor fastener (template)", model: "SME-ANC", category: "roof-anchoring", mfr: MFR.E, unit: "nos", specs: [role("roof_anchor")] },
  { sku: "RFA-E-WP", name: "Anchor-point waterproofing kit (template)", model: "SME-WP", category: "roof-anchoring", mfr: MFR.E, unit: "set", specs: [role("waterproofing")] },
  { sku: "BAT-D-LFP", name: "Lithium iron phosphate battery module (template)", model: "SMD-LFP", category: "battery-storage", mfr: MFR.D, unit: "set", specs: [role("battery"), ["chemistry", "Chemistry", "LFP (generic)"]] },
  { sku: "SAF-E-SIGN", name: "Solar warning and identification label set (template)", model: "SME-LBL", category: "installation-safety", mfr: MFR.E, unit: "set", specs: [role("warning_signage")] },
  { sku: "SAF-E-EXT", name: "Fire extinguisher for electrical fires (template)", model: "SME-FE", category: "installation-safety", mfr: MFR.E, unit: "nos", specs: [role("fire_extinguisher")] },
];

const STANDARDS: { code: string; title: string; authority: string; scope: string; url: string; notes: string }[] = [
  { code: "IEC 61215", title: "Terrestrial PV modules — design qualification and type approval", authority: "IEC", scope: "Modules", url: "https://webstore.iec.ch", notes: "Commonly referenced for module qualification. Confirm the applicable edition and Indian adoption." },
  { code: "IEC 61730", title: "PV module safety qualification", authority: "IEC", scope: "Modules", url: "https://webstore.iec.ch", notes: "Module safety. Confirm edition and the corresponding BIS standard." },
  { code: "BIS-CRS-SOLAR", title: "BIS Compulsory Registration Scheme for solar PV products", authority: "BIS", scope: "Modules, inverters", url: "https://www.crsbis.in", notes: "Check whether the specific product type is notified and the registration is valid on the procurement date." },
  { code: "IEC 62109", title: "Safety of power converters for use in PV power systems", authority: "IEC", scope: "Inverters", url: "https://webstore.iec.ch", notes: "Inverter safety. Confirm edition and BIS registration status." },
  { code: "IEC 62116", title: "Utility-interconnected PV inverters — islanding prevention test procedure", authority: "IEC", scope: "Inverters", url: "https://webstore.iec.ch", notes: "Anti-islanding. Confirm against BESCOM/CEA connectivity requirements." },
  { code: "MNRE-ALMM", title: "MNRE Approved List of Models and Manufacturers (ALMM)", authority: "MNRE", scope: "Modules, cells", url: "https://mnre.gov.in", notes: "Applicability depends on the project category, scheme and the current MNRE order. Check List-I (modules) and any list for cells in force on the relevant date." },
  { code: "CEA-SAFETY-2023", title: "CEA (Measures relating to Safety and Electric Supply) Regulations", authority: "CEA", scope: "Electrical safety", url: "https://cea.nic.in", notes: "Record the current regulation and amendments after verification." },
  { code: "CEA-DG-CONNECTIVITY", title: "CEA Technical Standards for Connectivity of Distributed Generation Resources", authority: "CEA", scope: "Grid interconnection", url: "https://cea.nic.in", notes: "Record the current regulation and amendments after verification." },
  { code: "BESCOM-RTS", title: "BESCOM rooftop solar application and interconnection procedure", authority: "BESCOM", scope: "Grid interconnection", url: "https://bescom.karnataka.gov.in", notes: "Capacity limits, metering arrangement, approved equipment and documentation change over time. Store the current circular here." },
  { code: "KERC-RTS", title: "KERC orders on rooftop solar metering and tariff", authority: "KERC", scope: "Metering/export", url: "https://kerc.karnataka.gov.in", notes: "Net-metering / other export arrangements and eligibility. Store the current order here." },
  { code: "IS 875-3", title: "Design loads for buildings and structures — wind loads", authority: "BIS", scope: "Structural", url: "https://www.bis.gov.in", notes: "Wind-load basis for structure design. Confirm edition." },
  { code: "IS 3043", title: "Code of practice for earthing", authority: "BIS", scope: "Earthing", url: "https://www.bis.gov.in", notes: "Earthing design basis. Confirm edition." },
  { code: "IEC 62305", title: "Protection against lightning", authority: "IEC", scope: "Lightning", url: "https://webstore.iec.ch", notes: "Risk assessment determines whether an LPS is required. Confirm Indian adoption." },
  { code: "IEC 61643", title: "Low-voltage surge protective devices", authority: "IEC", scope: "Surge protection", url: "https://webstore.iec.ch", notes: "SPD selection and testing. Confirm applicable parts for PV DC side." },
];

const CHECKS: { key: string; title: string; area: string; description: string; std?: string; applies?: object }[] = [
  { key: "equip_module_std", area: "Equipment", title: "PV module standards and BIS registration", std: "BIS-CRS-SOLAR", description: "Verify the selected module's test certificates and BIS registration against the current requirements. A certified product does not by itself make the project compliant." },
  { key: "equip_almm", area: "Equipment", title: "MNRE ALMM applicability", std: "MNRE-ALMM", description: "Determine whether ALMM applies to this project category and date, and confirm the module (and cell, if applicable) listing." },
  { key: "equip_inverter_std", area: "Equipment", title: "Inverter safety, grid-code and registration", std: "IEC 62109", description: "Verify inverter certificates, anti-islanding and utility acceptance." },
  { key: "equip_bos", area: "Equipment", title: "Balance-of-system equipment standards", description: "Cables, switchgear, SPDs and enclosures meet the project specification." },
  { key: "grid_application", area: "Grid interconnection", title: "BESCOM application and technical feasibility", std: "BESCOM-RTS", description: "Application filed, feasibility approved, capacity within permitted limits for the sanctioned load." },
  { key: "grid_metering", area: "Grid interconnection", title: "Approved metering and export arrangement", std: "KERC-RTS", description: "Metering arrangement and meter make/type as approved by BESCOM; export arrangement matches the current order." },
  { key: "grid_connectivity", area: "Grid interconnection", title: "Connectivity standards (protection, anti-islanding)", std: "CEA-DG-CONNECTIVITY", description: "Interconnection protection settings per current CEA connectivity regulations and BESCOM requirements." },
  { key: "safety_cea", area: "Electrical safety", title: "CEA electrical safety regulations", std: "CEA-SAFETY-2023", description: "Design, installation and inspection meet the current CEA safety regulations, including any inspection required before energisation." },
  { key: "elec_design", area: "Electrical safety", title: "Approved electrical design", description: "String plan, cable sizing (current, voltage drop, method, ambient, derating) and protective-device ratings approved by a design engineer." },
  { key: "struct_adequacy", area: "Structural", title: "Roof structural adequacy", std: "IS 875-3", description: "Roof slab capacity checked for added dead load and wind loading." },
  { key: "struct_anchorage", area: "Structural", title: "RCC roof anchorage and pull-out", description: "Anchor type, embedment and pull-out capacity verified; layout approved.", applies: { roofTypes: ["RCC_FLAT"] } },
  { key: "struct_waterproofing", area: "Structural", title: "Waterproofing and drainage", description: "Anchor-point waterproofing specified; drainage paths unobstructed.", applies: { roofTypes: ["RCC_FLAT"] } },
  { key: "earthing_design", area: "Earthing and protection", title: "Earthing and bonding design", std: "IS 3043", description: "Soil resistivity tested; electrode count and conductor sizes from design; equipotential bonding of frames and structure." },
  { key: "spd_design", area: "Earthing and protection", title: "Surge protection design", std: "IEC 61643", description: "SPD types, locations and coordination, accounting for SPDs integrated in the inverter." },
  { key: "lightning_risk", area: "Earthing and protection", title: "Lightning risk assessment", std: "IEC 62305", description: "Risk assessment completed; LPS provided where required." },
];

async function main() {
  // Roles & users
  const roleDefs = [
    ["ADMIN", "Administrator", "Full access including users, pricing and rules"],
    ["SALES_ENGINEER", "Sales engineer", "Projects, quotations and enquiries"],
    ["DESIGN_ENGINEER", "Design engineer", "Engineering inputs, verification and BOM approval"],
    ["PROCUREMENT", "Procurement", "Suppliers, pricing and lead times"],
  ] as const;
  for (const [code, name, description] of roleDefs) {
    await prisma.role.upsert({ where: { code }, update: { name, description }, create: { code, name, description } });
  }
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "ChangeMe-2026!";
  const hash = await bcrypt.hash(demoPassword, 10);
  const users = [
    ["admin@example.com", "Admin User", ["ADMIN"]],
    ["sales@example.com", "Sales Engineer", ["SALES_ENGINEER"]],
    ["design@example.com", "Design Engineer", ["DESIGN_ENGINEER"]],
    ["procurement@example.com", "Procurement Officer", ["PROCUREMENT"]],
  ] as const;
  for (const [email, name, roles] of users) {
    const u = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash: hash } });
    for (const code of roles) {
      const r = await prisma.role.findUniqueOrThrow({ where: { code } });
      await prisma.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: r.id } }, update: {}, create: { userId: u.id, roleId: r.id } });
    }
  }

  // Categories
  for (const [i, [slug, name, bomSection]] of CATEGORIES.entries()) {
    await prisma.productCategory.upsert({ where: { slug }, update: { name, bomSection, sortOrder: i }, create: { slug, name, bomSection, sortOrder: i } });
  }

  // Tax classes — rates intentionally not set; finance must configure from current GST notifications.
  const taxes = [
    ["GST-SOLAR-GOODS", "Solar power generating system and parts", null],
    ["GST-ELEC-GOODS", "Electrical goods (cables, switchgear, enclosures)", null],
    ["GST-SERVICES", "Engineering and professional services", null],
    ["GST-WORKS-CONTRACT", "Installation works contract", null],
  ] as const;
  for (const [code, description, hsnSac] of taxes) {
    await prisma.taxClass.upsert({ where: { code }, update: {}, create: { code, description, hsnSac, ratePercent: null,
      sourceNote: "Rate not configured. Set from the current GST rate notification for the applicable HSN/SAC and record the source.", sourceUrl: "https://cbic-gst.gov.in" } });
  }

  // Manufacturers / suppliers
  for (const name of Object.values(MFR)) {
    await prisma.manufacturer.upsert({ where: { name }, update: {}, create: { name, illustrative: true, notes: "Placeholder record for demonstration. Replace with a real manufacturer." } });
  }
  for (const name of ["Sample Supplier — Bengaluru (illustrative)", "Sample Distributor — Karnataka (illustrative)"]) {
    await prisma.supplier.upsert({ where: { name }, update: {}, create: { name, city: "Bengaluru", illustrative: true, notes: "Placeholder supplier. No contact details or quotations on record." } });
  }

  // Products
  const taxByCode = Object.fromEntries((await prisma.taxClass.findMany()).map((t) => [t.code, t.id]));
  const catBySlug = Object.fromEntries((await prisma.productCategory.findMany()).map((c) => [c.slug, c.id]));
  const mfrByName = Object.fromEntries((await prisma.manufacturer.findMany()).map((m) => [m.name, m.id]));
  for (const p of PRODUCTS) {
    const data = {
      name: p.name, model: p.model, description: p.description ?? "Illustrative template record. Specifications are generic values for demonstrating the BOM engine and are not a manufacturer datasheet.",
      categoryId: catBySlug[p.category], manufacturerId: mfrByName[p.mfr], taxClassId: p.tax ? taxByCode[p.tax] : null, unit: p.unit,
      ipRating: p.ip ?? null, material: p.material ?? null, dimensionsText: p.dims ?? null, weightKg: p.weight != null ? new Prisma.Decimal(p.weight) : null,
      illustrative: true, provenance: "ILLUSTRATIVE" as const, availability: "UNKNOWN" as const,
    };
    const prod = await prisma.product.upsert({ where: { sku: p.sku }, update: data, create: { sku: p.sku, ...data } });
    for (const [i, [key, label, value, unit]] of p.specs.entries()) {
      const isNum = typeof value === "number";
      const v = { label, valueNumber: isNum ? new Prisma.Decimal(value) : null, valueText: isNum ? null : value, unit: unit ?? null, provenance: "ILLUSTRATIVE" as const, sortOrder: i };
      await prisma.productSpecification.upsert({ where: { productId_key: { productId: prod.id, key } }, update: v, create: { productId: prod.id, key, ...v } });
    }
  }

  // Compatibility rules
  const compatRules = [
    ["phase_match", "Inverter AC phase must match the supply phase", "error"],
    ["system_type_match", "Inverter type must suit the electrical configuration (grid-tied / hybrid / off-grid)", "error"],
    ["string_voc_cold", "String Voc at design minimum temperature must not exceed inverter or module maximum system voltage", "error"],
    ["mppt_window", "String MPP voltage must remain within the MPPT window across design temperatures", "error"],
    ["mppt_current", "Parallel string current must not exceed the inverter's per-MPPT limits", "error"],
    ["dc_ac_ratio", "DC/AC ratio within configured limits and below inverter maximum DC power", "error"],
    ["connector_intermate", "DC connectors must match the module connector type or be certified intermateable", "warning"],
  ] as const;
  for (const [key, description, severity] of compatRules) {
    await prisma.compatibilityRule.upsert({ where: { key }, update: { description, severity }, create: { key, description, severity } });
  }

  // Engine rules
  for (const r of RULE_DEFINITIONS) {
    await prisma.engineRule.upsert({
      where: { key: r.key },
      update: { label: r.label, group: r.group, description: r.description, unit: r.unit, isAssumption: r.isAssumption },
      create: { key: r.key, label: r.label, group: r.group, description: r.description, unit: r.unit, isAssumption: r.isAssumption,
        valueNumber: r.defaultValue == null ? null : new Prisma.Decimal(r.defaultValue), provenance: "ENGINEER_ENTERED" },
    });
  }

  // Services (no prices — to be quoted)
  const services = [
    ["DESIGN_ENG", "Design and engineering (electrical & layout)", "lot", "FIXED"],
    ["STRUCT_ASSESS", "Structural assessment of roof and structure design", "lot", "FIXED"],
    ["INSTALL_COMM", "Installation, testing and commissioning", "kWp", "PER_KWP"],
    ["NET_METERING_LIAISON", "BESCOM application and metering liaison", "lot", "FIXED"],
  ] as const;
  for (const [code, name, unit, basis] of services) {
    await prisma.installationService.upsert({ where: { code }, update: { name, unit, basis }, create: { code, name, unit, basis, unitPrice: null } });
  }

  // Compliance standards and checklist templates
  for (const s of STANDARDS) {
    await prisma.complianceStandard.upsert({ where: { code: s.code }, update: {}, create: {
      code: s.code, title: s.title, authority: s.authority, scope: s.scope, officialUrl: s.url,
      applicabilityNotes: `${s.notes} Applicability, current revision and effective dates must be verified against the official source before marking as verified.`,
    } });
  }
  const stdByCode = Object.fromEntries((await prisma.complianceStandard.findMany()).map((s) => [s.code, s.id]));
  for (const [i, c] of CHECKS.entries()) {
    await prisma.complianceCheckTemplate.upsert({ where: { key: c.key }, update: { title: c.title, area: c.area, description: c.description, sortOrder: i },
      create: { key: c.key, title: c.title, area: c.area, description: c.description, standardId: c.std ? stdByCode[c.std] : null, appliesTo: c.applies ?? undefined, sortOrder: i } });
  }

  // Empty price list
  if (!(await prisma.priceList.findFirst())) {
    await prisma.priceList.create({ data: { name: "Standard price list", pricesIncludeGst: false, notes: "No prices loaded. Add supplier-quoted prices with references before issuing quotations." } });
  }

  console.log(`Seeded ${PRODUCTS.length} illustrative products, ${STANDARDS.length} standards, ${CHECKS.length} checklist items.`);
  console.log(`Demo staff accounts use the password from SEED_DEMO_PASSWORD (default documented in README).`);
}

main()
  .then(async () => {
    const { seedSampleProject } = await import("./seed-sample");
    await seedSampleProject(prisma);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
