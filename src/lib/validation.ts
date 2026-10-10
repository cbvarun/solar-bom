import { z } from "zod";

/** Blank strings become null so "unknown" stays distinct from a value. */
const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const optNum = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v) : v),
    z.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).nullable(),
  );
const optInt = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v) : v),
    z.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).nullable(),
  );
const optStr = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());
const optEnum = <const T extends [string, ...string[]]>(vals: T) => z.preprocess(blankToNull, z.enum(vals).nullable());

export const inputProvenance = z.enum(["MEASURED", "ENGINEER_VERIFIED", "ESTIMATED"]);

export const engineeringSchema = z.object({
  moduleCountOverride: optInt(1, 100000, "Design module count"),
  modulesPerRow: optInt(1, 200, "Modules per row"),
  rows: optInt(1, 500, "Rows"),
  dcRouteLengthM: optNum(0, 5000, "DC route length"),
  acRouteLengthM: optNum(0, 5000, "AC route length"),
  earthingRouteLengthM: optNum(0, 5000, "Earthing route length"),
  earthElectrodes: optInt(0, 200, "Earth electrodes"),
  engineeredSupportSpacingM: optNum(0.3, 10, "Support spacing"),
  anchorsPerSupport: optInt(1, 20, "Anchors per support"),
  lightningProtection: optEnum(["YES", "NO", "TBC"]),
  downConductorLengthM: optNum(0, 2000, "Down conductor length"),
  designMinTempC: optNum(-20, 40, "Design minimum temperature"),
  ambientDeratingFactor: optNum(0.3, 1.2, "Ambient derating factor"),
  groupingDeratingFactor: optNum(0.3, 1, "Grouping derating factor"),
  batteryCapacityKwh: optNum(0, 10000, "Battery capacity"),
  specificYieldKwhPerKwpYr: optNum(500, 2500, "Specific yield"),
  specificYieldSource: optStr(300),
});
export type EngineeringForm = z.infer<typeof engineeringSchema>;

export const projectSchema = z
  .object({
    name: z.string().trim().min(2, "Project name is required").max(120),
    location: optStr(200),
    customerType: optEnum(["RESIDENTIAL", "APARTMENT", "COMMERCIAL", "INDUSTRIAL"]),
    customerName: optStr(120),
    customerEmail: z.preprocess(blankToNull, z.string().trim().email("Enter a valid email").max(200).nullable()),
    customerPhone: z.preprocess(blankToNull, z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number").nullable()),
    targetCapacityKwp: optNum(0.5, 5000, "Target capacity"),
    roofType: optEnum(["RCC_FLAT", "METAL_SHEET", "SLOPED"]),
    roofAreaM2: optNum(1, 1000000, "Roof area"),
    isExpansion: z.preprocess((v) => (v === "" || v == null ? null : v === true || v === "true"), z.boolean().nullable()),
    systemType: optEnum(["GRID_TIED", "HYBRID", "OFF_GRID"]),
    supplyPhase: optEnum(["SINGLE", "THREE"]),
    sanctionedLoad: optNum(0.1, 100000, "Sanctioned load"),
    sanctionedLoadUnit: optEnum(["kW", "kVA"]),
    exportArrangement: optEnum(["NET_METERING", "OTHER_APPROVED", "EXPORT_LIMITED"]),
    preferredModuleWp: optInt(100, 1000, "Module wattage"),
    preferredModuleMfrId: optStr(64),
    preferredInverterMfrId: optStr(64),
    mountingMaterial: optStr(60),
    preferredConfiguration: optStr(200),
    budgetRange: optStr(60),
    monitoring: optEnum(["NONE", "BASIC_APP", "ADVANCED"]),
    selectedModuleId: optStr(64),
    selectedInverterId: optStr(64),
    selectedStructureId: optStr(64),
    engineering: engineeringSchema.partial().optional(),
    inputMeta: z.record(z.object({ provenance: inputProvenance, note: z.string().max(300).optional() })).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.systemType === "HYBRID" && v.exportArrangement === "EXPORT_LIMITED") return;
    if (v.systemType === "OFF_GRID" && v.exportArrangement) {
      ctx.addIssue({ code: "custom", path: ["exportArrangement"], message: "An off-grid system has no grid export arrangement. Leave blank or change the configuration." });
    }
    if (v.sanctionedLoad != null && !v.sanctionedLoadUnit) {
      ctx.addIssue({ code: "custom", path: ["sanctionedLoadUnit"], message: "Choose kW or kVA for the sanctioned load." });
    }
    if (v.engineering?.lightningProtection !== "YES" && v.engineering?.downConductorLengthM != null) {
      ctx.addIssue({ code: "custom", path: ["engineering", "downConductorLengthM"], message: "Down conductor length applies only when lightning protection is required." });
    }
    if (v.engineering?.specificYieldKwhPerKwpYr != null && !v.engineering.specificYieldSource) {
      ctx.addIssue({ code: "custom", path: ["engineering", "specificYieldSource"], message: "Cite the source of the specific yield (e.g. a site simulation)." });
    }
  });
export type ProjectForm = z.infer<typeof projectSchema>;

export const enquirySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z.preprocess(blankToNull, z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number").nullable()),
  company: optStr(120),
  customerType: optEnum(["RESIDENTIAL", "APARTMENT", "COMMERCIAL", "INDUSTRIAL"]),
  location: optStr(200),
  capacityKwp: optNum(0.5, 5000, "Capacity"),
  message: z.string().trim().min(5, "Tell us a little about the project").max(4000),
  productSku: optStr(64),
  projectId: optStr(64),
  source: z.enum(["website", "quote-request", "product-quote"]).default("website"),
});

export const bomItemPatchSchema = z.object({
  procurementQty: optNum(0, 10_000_000, "Procurement quantity").optional(),
  unitPrice: optNum(0, 1_000_000_000, "Unit price").optional(),
  gstRatePercent: optNum(0, 100, "GST rate").optional(),
  quantityStatus: z.enum(["CALCULATED", "ESTIMATED", "ENGINEER_VERIFIED", "TO_BE_CONFIRMED"]).optional(),
  specification: optStr(1000).optional(),
  technicalNotes: optStr(2000).optional(),
  supplierRemarks: optStr(2000).optional(),
  supplierName: optStr(200).optional(),
  complianceReq: optStr(1000).optional(),
  complianceStatus: z.enum(["PENDING_VERIFICATION", "UNDER_ENGINEERING_REVIEW", "VERIFIED", "NOT_APPLICABLE", "REQUIRES_CORRECTIVE_ACTION"]).optional(),
  availability: z.enum(["IN_STOCK", "LEAD_TIME", "ON_REQUEST", "DISCONTINUED", "UNKNOWN"]).optional(),
  name: z.string().trim().min(1).max(300).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  productId: optStr(64).optional(),
  reason: optStr(500).optional(),
});

export const bomItemCreateSchema = z.object({
  section: z.enum(["PV_MODULES", "MOUNTING", "INVERTER", "DC_WIRING", "AC_WIRING", "EARTHING", "LIGHTNING", "METERING", "MONITORING", "CABLE_MGMT", "SAFETY", "SERVICES"]),
  productId: optStr(64),
  name: z.string().trim().min(1, "Name is required").max(300),
  specification: optStr(1000),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  procurementQty: optNum(0, 10_000_000, "Quantity"),
  unitPrice: optNum(0, 1_000_000_000, "Unit price"),
  reason: optStr(500),
});

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
