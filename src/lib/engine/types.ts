/**
 * Calculation engine types. The engine is pure TypeScript with no UI or
 * database dependencies so engineering rules can be tested independently.
 */

export type Phase = "SINGLE" | "THREE";
export type SystemType = "GRID_TIED" | "HYBRID" | "OFF_GRID";
export type RoofType = "RCC_FLAT" | "METAL_SHEET" | "SLOPED";
export type ExportArrangement = "NET_METERING" | "OTHER_APPROVED" | "EXPORT_LIMITED";
export type QuantityStatus = "CALCULATED" | "ESTIMATED" | "ENGINEER_VERIFIED" | "TO_BE_CONFIRMED";
/** How a site/engineering input was obtained. */
export type InputProvenance = "MEASURED" | "ENGINEER_VERIFIED" | "ESTIMATED";

export const BOM_SECTIONS = [
  { key: "PV_MODULES", label: "PV modules" },
  { key: "MOUNTING", label: "Mounting structure and roof anchors" },
  { key: "INVERTER", label: "Inverter and power conversion" },
  { key: "DC_WIRING", label: "DC wiring and protection" },
  { key: "AC_WIRING", label: "AC wiring and protection" },
  { key: "EARTHING", label: "Earthing and bonding" },
  { key: "LIGHTNING", label: "Lightning protection" },
  { key: "METERING", label: "Metering and grid interconnection" },
  { key: "MONITORING", label: "Monitoring and communications" },
  { key: "CABLE_MGMT", label: "Cable management and installation accessories" },
  { key: "SAFETY", label: "Safety equipment" },
  { key: "SERVICES", label: "Engineering, installation and commissioning services" },
] as const;
export type BomSectionKey = (typeof BOM_SECTIONS)[number]["key"];

export interface ProductRef {
  id: string;
  sku: string;
  name: string;
  manufacturer: string;
  model: string;
  unit: string;
  illustrative?: boolean;
}

export interface ModuleSpec extends ProductRef {
  pmaxW: number;
  vocV: number;
  iscA: number;
  vmpV: number;
  impA: number;
  /** Temperature coefficient of Voc, %/°C (negative). */
  betaVocPctPerC: number;
  /** Temperature coefficient of Pmax, %/°C (negative); used to approximate Vmp drift if no Vmp coefficient. */
  gammaPmaxPctPerC?: number;
  betaVmpPctPerC?: number;
  lengthMm: number;
  widthMm: number;
  maxSystemVoltageV: number;
  maxSeriesFuseA?: number;
}

export interface InverterSpec extends ProductRef {
  inverterType: SystemType; // GRID_TIED inverters cannot serve HYBRID projects, etc.
  phase: Phase;
  ratedAcW: number;
  maxDcPowerW?: number;
  maxDcVoltageV: number;
  mpptMinV: number;
  mpptMaxV: number;
  startVoltageV?: number;
  mpptCount: number;
  stringsPerMppt: number;
  maxInputCurrentPerMpptA: number;
  maxShortCircuitCurrentPerMpptA: number;
  acNominalVoltageV: number;
  integrated: {
    dcSwitch: boolean;
    dcSpd: boolean;
    acSpd: boolean;
    monitoring: boolean;
    exportLimiting?: boolean;
  };
}

export interface StructureSpec extends ProductRef {
  material: string;
  railStockLengthM: number;
  railsPerRow: number;
  endClampsPerRailEnd: number;
  midClampsPerJointPerRail: number;
  moduleGapMm: number;
  railOverhangMm: number;
  roofTypes: RoofType[];
}

export interface CableOption extends ProductRef {
  kind: "DC" | "AC";
  csaMm2: number;
  /** Reference current-carrying capacity before derating, A (from datasheet for the reference installation method). */
  ampacityA: number;
  /** Conductor resistance at operating temperature, ohm/km. */
  resistanceOhmPerKm: number;
  cores?: number;
}

/** Products that fill generic BOM roles (connectors, isolators, SPDs ...). */
export type RoleKey =
  | "mc4_connector"
  | "dc_isolator"
  | "dc_spd"
  | "string_fuse"
  | "dcdb"
  | "acdb"
  | "ac_isolator"
  | "ac_mcb"
  | "rcd"
  | "ac_spd"
  | "earth_electrode"
  | "earth_conductor"
  | "bonding_kit"
  | "lightning_arrester"
  | "down_conductor"
  | "net_meter"
  | "generation_meter"
  | "export_limiter"
  | "monitoring_logger"
  | "conduit"
  | "cable_tray"
  | "cable_ties"
  | "roof_anchor"
  | "waterproofing"
  | "structure_support"
  | "rail_splice"
  | "end_clamp"
  | "mid_clamp"
  | "warning_signage"
  | "fire_extinguisher"
  | "battery";

export interface ServiceRef {
  code: string;
  name: string;
  unit: string;
  basis: "FIXED" | "PER_KWP";
}

/** Site and engineering inputs. Every field is optional; missing values become outstanding checks. */
export interface EngineeringInputs {
  /** Engineer-selected array size when it deliberately differs from the formula result. */
  moduleCountOverride?: number | null;
  modulesPerRow?: number | null;
  rows?: number | null;
  dcRouteLengthM?: number | null;
  acRouteLengthM?: number | null;
  earthingRouteLengthM?: number | null;
  earthElectrodes?: number | null;
  engineeredSupportSpacingM?: number | null;
  anchorsPerSupport?: number | null;
  lightningProtection?: "YES" | "NO" | "TBC" | null;
  downConductorLengthM?: number | null;
  designMinTempC?: number | null;
  ambientDeratingFactor?: number | null;
  groupingDeratingFactor?: number | null;
  batteryCapacityKwh?: number | null;
  specificYieldKwhPerKwpYr?: number | null;
  specificYieldSource?: string | null;
}

export type InputMeta = Partial<Record<keyof EngineeringInputs, { provenance: InputProvenance; note?: string }>>;

export interface ProjectInputs {
  targetCapacityKwp?: number | null;
  roofType?: RoofType | null;
  roofAreaM2?: number | null;
  systemType?: SystemType | null;
  supplyPhase?: Phase | null;
  sanctionedLoadKw?: number | null;
  exportArrangement?: ExportArrangement | null;
  preferredModuleWp?: number | null;
  preferredModuleManufacturer?: string | null;
  preferredInverterManufacturer?: string | null;
  mountingMaterial?: string | null;
  monitoring?: "NONE" | "BASIC_APP" | "ADVANCED" | null;
  selectedModuleId?: string | null;
  selectedInverterId?: string | null;
  selectedStructureId?: string | null;
  engineering?: EngineeringInputs;
  inputMeta?: InputMeta;
}

export interface EngineCatalogue {
  modules: ModuleSpec[];
  inverters: InverterSpec[];
  structures: StructureSpec[];
  cables: CableOption[];
  roles: Partial<Record<RoleKey, ProductRef>>;
  services: ServiceRef[];
}

export type Rules = Record<string, number | null>;

export type CheckSeverity = "error" | "warning" | "info";
export interface Check {
  key: string;
  severity: CheckSeverity;
  area: string;
  message: string;
}

export interface Assumption {
  key: string;
  label: string;
  value: string;
  source: string;
}

export interface BomLineDraft {
  ruleKey: string;
  section: BomSectionKey;
  itemCode: string;
  name: string;
  specification: string;
  unit: string;
  calculatedQty: number | null;
  quantityStatus: QuantityStatus;
  quantityBasis: string;
  productId?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  complianceReq?: string | null;
  technicalNotes?: string | null;
}

export interface StringLayout {
  modulesPerString: number[];
  /** strings assigned to each MPPT, by string index */
  mppts: number[][];
  vocAtMinTempV: number;
  vmpAtMaxTempV: number;
  vmpAtMinTempV: number;
  maxSeries: number;
  minSeries: number;
}

export interface InverterEvaluation {
  inverterId: string;
  label: string;
  ratedAcW: number;
  dcAcRatio: number | null;
  compatible: boolean;
  issues: Check[];
  layout: StringLayout | null;
}

export interface EngineSummary {
  targetDcW: number | null;
  /** ceil(target W ÷ module W) */
  formulaModuleCount: number | null;
  /** Module count used for the design (formula result unless overridden). */
  moduleCount: number | null;
  moduleWp: number | null;
  installedDcW: number | null;
  inverterAcW: number | null;
  dcAcRatio: number | null;
  estimatedRoofAreaM2: number | null;
  availableRoofAreaM2: number | null;
  stringLayout: StringLayout | null;
  selectedModule: string | null;
  selectedInverter: string | null;
  selectedStructure: string | null;
  dcCable: { csaMm2: number; designCurrentA: number; voltageDropPct: number } | null;
  acCable: { csaMm2: number; designCurrentA: number; voltageDropPct: number } | null;
  annualGeneration: { kwh: number; basis: string } | null;
  annualGenerationUnavailableReason: string | null;
}

export interface EngineResult {
  summary: EngineSummary;
  lines: BomLineDraft[];
  checks: Check[];
  assumptions: Assumption[];
  inverterEvaluations: InverterEvaluation[];
  outstanding: string[];
}
