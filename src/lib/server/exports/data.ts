import "server-only";
import { prisma } from "@/lib/db";
import { company } from "@/lib/company";
import type { PricingResult } from "@/lib/engine";
import type { ExportPayload } from "@/lib/exports/payload";
import { bomPricing, engineSnapshot, loadBom } from "../bom";
import { serializeItems } from "../serialize";
import { formatSpecValue } from "../catalogue";
import { energySummary } from "../site";
import { CUSTOMER_TYPE_LABEL, EXPORT_LABEL, PHASE_LABEL, ROOF_LABEL, SYSTEM_LABEL, TBC } from "@/lib/format";

const n = (v: unknown) => (v == null ? null : Number(v));

/**
 * Collects the data for a BOM export as plain JSON. The documents themselves
 * are generated in the browser (src/lib/exports) to keep server CPU per
 * request low.
 */
export async function buildExportPayload(projectId: string): Promise<ExportPayload> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { designInputs: true } });
  const bom = await loadBom(prisma, projectId);
  if (!bom) throw new Error("Project has no BOM");
  const pricing: PricingResult = bomPricing(bom);
  const items = serializeItems(bom).filter((i) => !i.removed);
  const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
  const majorIds = [...new Set(items.filter((i) => ["PV_MODULES", "INVERTER", "MOUNTING"].includes(i.section) && i.productId).map((i) => i.productId!))].slice(0, 4);
  const [compliance, priceEntries, validityRule, majors, energy] = await Promise.all([
    prisma.projectComplianceItem.findMany({ where: { projectId }, include: { template: { include: { standard: true } } }, orderBy: { template: { sortOrder: "asc" } } }),
    prisma.priceListEntry.findMany({ where: { productId: { in: productIds }, priceList: { active: true } }, include: { supplier: true } }),
    prisma.engineRule.findUnique({ where: { key: "quotation_validity_days" } }),
    prisma.product.findMany({ where: { id: { in: majorIds } }, include: { specifications: { orderBy: { sortOrder: "asc" } } } }),
    // Estimates are optional in exports; a failure here must not block the BOM.
    energySummary(prisma, projectId).catch((e) => { console.error("energy summary failed", e); return null; }),
  ]);
  const d = project.designInputs;
  const v = (x: unknown, map?: Record<string, string>) => (x == null || x === "" ? TBC : map ? map[String(x)] ?? String(x) : String(x));
  return {
    company: { name: company.name, address: company.address, phone: company.phone, email: company.email, gstin: company.gstin },
    project: { reference: project.reference, name: project.name, location: project.location, customerName: project.customerName, customerEmail: project.customerEmail, customerPhone: project.customerPhone },
    bom: {
      id: bom.id, currentRevision: bom.currentRevision, status: bom.status, pricesIncludeGst: bom.pricesIncludeGst,
      costItems: bom.costItems.map((c) => ({ label: c.label, notes: c.notes, amount: n(c.amount), gstRatePercent: n(c.gstRatePercent) })),
    },
    items,
    pricing,
    calc: engineSnapshot(bom),
    compliance: compliance.map((c) => ({
      area: c.template.area, title: c.template.title, standardCode: c.template.standard?.code ?? null, officialUrl: c.template.standard?.officialUrl ?? null,
      status: c.status, notes: c.notes, reviewedBy: c.reviewedBy, reviewedAt: c.reviewedAt?.toISOString() ?? null,
    })),
    priceEntries: priceEntries.map((e) => ({ productId: e.productId, supplierName: e.supplier?.name ?? null, unitPrice: Number(e.unitPrice), leadTimeDays: e.leadTimeDays })),
    design: [
      ["Target capacity", d?.targetCapacityKwp != null ? `${Number(d.targetCapacityKwp)} kWp` : TBC],
      ["Customer type", v(project.customerType, CUSTOMER_TYPE_LABEL)],
      ["Roof type", v(d?.roofType, ROOF_LABEL)],
      ["Available roof area", d?.roofAreaM2 != null ? `${Number(d.roofAreaM2)} m²` : TBC],
      ["Electrical configuration", v(d?.systemType, SYSTEM_LABEL)],
      ["Supply", v(d?.supplyPhase, PHASE_LABEL)],
      ["Sanctioned load", d?.sanctionedLoad != null ? `${Number(d.sanctionedLoad)} ${d.sanctionedLoadUnit ?? ""}` : TBC],
      ["Export arrangement", v(d?.exportArrangement, EXPORT_LABEL)],
    ],
    majors: majorIds.flatMap((id) => {
      const m = majors.find((p) => p.id === id);
      if (!m) return [];
      return [{
        name: m.name, sku: m.sku, illustrative: m.illustrative,
        specs: m.specifications.filter((x) => x.key !== "bom_role").slice(0, 14).map((s) => ({ label: s.label, value: formatSpecValue(s), provenance: s.provenance.replace(/_/g, " ").toLowerCase() })),
      }];
    }),
    energy,
    validityDays: validityRule?.valueNumber != null ? Number(validityRule.valueNumber) : 15,
    generatedAt: new Date().toISOString(),
  };
}
