import type { VerificationStatus } from "@prisma/client";
import type { EngineResult, PricingResult } from "@/lib/engine";
import type { BomItemDTO } from "@/lib/server/serialize";
import type { EnergySummary } from "@/lib/energy-summary";

/**
 * Everything a BOM export needs, as plain JSON. The server assembles it
 * (database work only) and the browser turns it into PDF, XLSX or CSV, so
 * document generation never runs inside a request on the server.
 */
export interface ExportPayload {
  company: { name: string; address: string; phone: string; email: string; gstin: string };
  project: { reference: string; name: string; location: string | null; customerName: string | null; customerEmail: string | null; customerPhone: string | null };
  bom: {
    id: string;
    currentRevision: number;
    status: string;
    pricesIncludeGst: boolean;
    costItems: { label: string; notes: string | null; amount: number | null; gstRatePercent: number | null }[];
  };
  items: BomItemDTO[];
  pricing: PricingResult;
  calc: EngineResult | null;
  compliance: { area: string; title: string; standardCode: string | null; officialUrl: string | null; status: VerificationStatus; notes: string | null; reviewedBy: string | null; reviewedAt: string | null }[];
  priceEntries: { productId: string; supplierName: string | null; unitPrice: number; leadTimeDays: number | null }[];
  design: [string, string][];
  /** Major equipment (modules, inverter, structure) with specification values already formatted. */
  majors: { name: string; sku: string; illustrative: boolean; specs: { label: string; value: string; provenance: string }[] }[];
  /** Generation, subsidy and savings estimates. Absent in quotations issued before estimates existed. */
  energy?: EnergySummary | null;
  validityDays: number;
  generatedAt: string;
}

/** A quotation stores the payload as it was when the quotation was issued. */
export interface QuotationSnapshot {
  quotationNumber: string;
  validUntil: string;
  payload: ExportPayload;
}

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

export const exportBaseName = (p: ExportPayload) => `${p.project.reference}-BOM-rev${p.bom.currentRevision}`;
