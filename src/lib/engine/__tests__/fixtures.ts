import type { EngineCatalogue, InverterSpec, ModuleSpec, StructureSpec } from "../types";

// Illustrative test fixtures — generic values, not any manufacturer's datasheet.
export const module550: ModuleSpec = {
  id: "m550", sku: "PV-MOD-550", name: "Mono PERC module 550 Wp (illustrative)", manufacturer: "Illustrative A", model: "IA-550M", unit: "nos",
  pmaxW: 550, vocV: 49.5, iscA: 14.0, vmpV: 41.6, impA: 13.2, betaVocPctPerC: -0.27, gammaPmaxPctPerC: -0.35,
  lengthMm: 2278, widthMm: 1134, maxSystemVoltageV: 1500, maxSeriesFuseA: 25,
};

const baseInv = {
  unit: "nos", inverterType: "GRID_TIED" as const, maxDcVoltageV: 600, mpptMinV: 90, mpptMaxV: 550, startVoltageV: 100,
  stringsPerMppt: 1, maxInputCurrentPerMpptA: 16, maxShortCircuitCurrentPerMpptA: 20, acNominalVoltageV: 230,
  integrated: { dcSwitch: true, dcSpd: true, acSpd: false, monitoring: true },
};
export const inv4k: InverterSpec = { ...baseInv, id: "i4", sku: "INV-4K", name: "String inverter 4 kW 1-ph (illustrative)", manufacturer: "Illustrative B", model: "IB-4K", phase: "SINGLE", ratedAcW: 4000, maxDcPowerW: 6000, mpptCount: 2 };
export const inv5k: InverterSpec = { ...baseInv, id: "i5", sku: "INV-5K", name: "String inverter 5 kW 1-ph (illustrative)", manufacturer: "Illustrative B", model: "IB-5K", phase: "SINGLE", ratedAcW: 5000, maxDcPowerW: 7500, mpptCount: 2 };
export const inv10k3: InverterSpec = { ...baseInv, id: "i10", sku: "INV-10K3", name: "String inverter 10 kW 3-ph (illustrative)", manufacturer: "Illustrative B", model: "IB-10K3", phase: "THREE", ratedAcW: 10000, maxDcPowerW: 15000, maxDcVoltageV: 1100, mpptMinV: 160, mpptMaxV: 950, mpptCount: 2, stringsPerMppt: 2, maxInputCurrentPerMpptA: 32, maxShortCircuitCurrentPerMpptA: 40, acNominalVoltageV: 415 };

export const structure: StructureSpec = {
  id: "s1", sku: "MS-RCC-AL", name: "Elevated RCC roof structure (illustrative)", manufacturer: "Illustrative C", model: "IC-RCC", unit: "nos",
  material: "Aluminium", railStockLengthM: 4.2, railsPerRow: 2, endClampsPerRailEnd: 1, midClampsPerJointPerRail: 1, moduleGapMm: 20, railOverhangMm: 50, roofTypes: ["RCC_FLAT"],
};

export const catalogue: EngineCatalogue = {
  modules: [module550],
  inverters: [inv4k, inv5k, inv10k3],
  structures: [structure],
  cables: [
    { id: "dc4", sku: "DC-4", name: "PV cable 4 mm²", manufacturer: "Illustrative D", model: "PV4", unit: "m", kind: "DC", csaMm2: 4, ampacityA: 55, resistanceOhmPerKm: 5.09 },
    { id: "dc6", sku: "DC-6", name: "PV cable 6 mm²", manufacturer: "Illustrative D", model: "PV6", unit: "m", kind: "DC", csaMm2: 6, ampacityA: 70, resistanceOhmPerKm: 3.39 },
    { id: "ac4", sku: "AC-4", name: "AC cable 4 mm² 3C", manufacturer: "Illustrative D", model: "AC4", unit: "m", kind: "AC", csaMm2: 4, ampacityA: 36, resistanceOhmPerKm: 5.52, cores: 3 },
    { id: "ac6", sku: "AC-6", name: "AC cable 6 mm² 3C", manufacturer: "Illustrative D", model: "AC6", unit: "m", kind: "AC", csaMm2: 6, ampacityA: 46, resistanceOhmPerKm: 3.69, cores: 3 },
  ],
  roles: {},
  services: [
    { code: "DESIGN_ENG", name: "Design and engineering", unit: "lot", basis: "FIXED" },
    { code: "INSTALL", name: "Installation and commissioning", unit: "kWp", basis: "PER_KWP" },
    { code: "NET_METERING_LIAISON", name: "Net-metering application liaison", unit: "lot", basis: "FIXED" },
  ],
};
