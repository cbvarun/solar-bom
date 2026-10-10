import { prisma } from "@/lib/db";
import { company } from "@/lib/company";
import { sectionLabel, type PricingResult } from "@/lib/engine";
import { bomPricing, engineSnapshot, loadBom } from "../bom";
import { serializeItems, type BomItemDTO } from "../serialize";
import { CUSTOMER_TYPE_LABEL, EXPORT_LABEL, PHASE_LABEL, ROOF_LABEL, SYSTEM_LABEL, TBC } from "@/lib/format";

export const STANDARD_EXCLUSIONS = [
  "Civil works beyond anchor-point preparation, roof repairs and pre-existing waterproofing defects.",
  "BESCOM/utility fees, meter testing charges, security deposits and statutory inspection fees unless listed.",
  "Strengthening of the roof slab or building structure if required by the structural assessment.",
  "Upgrades to the existing electrical installation, service cable or sanctioned load.",
  "Internet connectivity for monitoring.",
  "Items marked Estimated or To be confirmed are subject to change after site survey and engineering design.",
];

export const STANDARD_TERMS = [
  "This document is a preliminary estimate generated from configurable engineering rules. It is not a substitute for an approved electrical, structural or utility design.",
  "Quantities, ratings and cable sizes are indicative until verified by a design engineer. Protective-device ratings will be taken only from the approved electrical design.",
  "Prices are indicative and subject to supplier confirmation at the time of order. GST is shown only where a tax classification and rate have been configured.",
  "Estimated generation, savings and payback, where shown, are indicative and not guaranteed.",
  "Selection of certified equipment does not by itself establish project compliance. Compliance status is recorded per item in the project checklist.",
  "Grid interconnection and metering are subject to BESCOM approval under the rules in force at the time of application.",
];

export async function buildExportData(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { designInputs: true } });
  const bom = await loadBom(prisma, projectId);
  if (!bom) throw new Error("Project has no BOM");
  const pricing: PricingResult = bomPricing(bom);
  const calc = engineSnapshot(bom);
  const items = serializeItems(bom).filter((i) => !i.removed);
  const priced = new Map(pricing.lines.map((l) => [l.id, l]));
  const compliance = await prisma.projectComplianceItem.findMany({ where: { projectId }, include: { template: { include: { standard: true } }, evidence: true }, orderBy: { template: { sortOrder: "asc" } } });
  const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
  const priceEntries = await prisma.priceListEntry.findMany({ where: { productId: { in: productIds }, priceList: { active: true } }, include: { supplier: true } });
  const validityRule = await prisma.engineRule.findUnique({ where: { key: "quotation_validity_days" } });
  const d = project.designInputs;
  const v = (x: unknown, map?: Record<string, string>) => (x == null || x === "" ? TBC : map ? map[String(x)] ?? String(x) : String(x));
  const design: [string, string][] = [
    ["Target capacity", d?.targetCapacityKwp != null ? `${Number(d.targetCapacityKwp)} kWp` : TBC],
    ["Customer type", v(project.customerType, CUSTOMER_TYPE_LABEL)],
    ["Roof type", v(d?.roofType, ROOF_LABEL)],
    ["Available roof area", d?.roofAreaM2 != null ? `${Number(d.roofAreaM2)} m²` : TBC],
    ["Electrical configuration", v(d?.systemType, SYSTEM_LABEL)],
    ["Supply", v(d?.supplyPhase, PHASE_LABEL)],
    ["Sanctioned load", d?.sanctionedLoad != null ? `${Number(d.sanctionedLoad)} ${d.sanctionedLoadUnit ?? ""}` : TBC],
    ["Export arrangement", v(d?.exportArrangement, EXPORT_LABEL)],
  ];
  return {
    company, project, bom, items, pricing, priced, calc, compliance, priceEntries, design,
    validityDays: validityRule?.valueNumber != null ? Number(validityRule.valueNumber) : 15,
    sectionLabel,
    generatedAt: new Date(),
  };
}
export type ExportData = Awaited<ReturnType<typeof buildExportData>>;
export type { BomItemDTO };
