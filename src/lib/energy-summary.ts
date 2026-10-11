import type { GenerationEstimate, SavingsResult, SubsidyResult } from "@/lib/engine";

/**
 * Generation, subsidy and savings estimates for a project, as plain JSON.
 * Shown on the project, in exports and on the web proposal, always labelled
 * as indicative. Each part is null with a reason when it cannot be estimated.
 */
export interface EnergySummary {
  location: { latitude: number; longitude: number } | null;
  installedKwp: number | null;
  generation: GenerationEstimate | null;
  generationNote: string | null;
  subsidy: (SubsidyResult & { schemeName: string; sourceUrl: string | null; verified: boolean }) | null;
  tariff: { inrPerKwh: number; source: string | null } | null;
  grossCostInr: number | null;
  netCostInr: number | null;
  savings: SavingsResult | null;
  savingsNote: string | null;
}

export const ESTIMATE_DISCLAIMER =
  "Generation, savings, subsidy and payback are indicative estimates, not guarantees. Actual output depends on weather, shading, maintenance and the final design; subsidy eligibility and amounts are decided by the scheme authority and DISCOM.";
