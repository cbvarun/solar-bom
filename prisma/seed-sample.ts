import type { PrismaClient } from "@prisma/client";
import { createProject } from "../src/lib/server/projects";
import { SYSTEM } from "../src/lib/server/audit";

/**
 * Illustrative sample project from the brief. Engineering inputs are marked
 * ESTIMATED (provisional) until a design engineer verifies them. No prices
 * and no utility approval are implied.
 */
export async function seedSampleProject(prisma: PrismaClient) {
  if (await prisma.project.findFirst({ where: { isSample: true } })) {
    console.log("Sample project already present.");
    return;
  }
  const module = await prisma.product.findUnique({ where: { sku: "PVM-A-550" } });
  const structure = await prisma.product.findUnique({ where: { sku: "MST-E-RCC-AL" } });
  const provisional = (note: string) => ({ provenance: "ESTIMATED" as const, note });
  const { project } = await createProject(
    prisma,
    {
      name: "Bengaluru Commercial Rooftop Solar",
      location: "Bengaluru, Karnataka",
      customerType: "COMMERCIAL",
      customerName: null, customerEmail: null, customerPhone: null,
      targetCapacityKwp: 5,
      roofType: "RCC_FLAT",
      roofAreaM2: null,
      isExpansion: false,
      systemType: "GRID_TIED",
      supplyPhase: null,
      sanctionedLoad: null, sanctionedLoadUnit: null,
      exportArrangement: null,
      preferredModuleWp: 550,
      preferredModuleMfrId: null, preferredInverterMfrId: null,
      mountingMaterial: "Aluminium", preferredConfiguration: null, budgetRange: null, monitoring: "BASIC_APP",
      selectedModuleId: module?.id ?? null, selectedInverterId: null, selectedStructureId: structure?.id ?? null,
      engineering: {
        moduleCountOverride: 9,
        modulesPerRow: 5,
        dcRouteLengthM: 15,
        acRouteLengthM: 10,
        earthingRouteLengthM: 30,
        earthElectrodes: 2,
        lightningProtection: "TBC",
      },
      inputMeta: {
        moduleCountOverride: provisional("Illustrative array from the brief: 9 × 550 Wp = 4.95 kWp, within the 5 kWp target."),
        modulesPerRow: provisional("Provisional layout pending site survey."),
        dcRouteLengthM: provisional("Provisional route length pending site survey."),
        acRouteLengthM: provisional("Provisional route length pending site survey."),
        earthingRouteLengthM: provisional("Provisional routing pending earthing design."),
        earthElectrodes: provisional("Provisional, subject to soil resistivity test and earthing design."),
      },
    },
    SYSTEM,
    { isSample: true },
  );
  console.log(`Sample project created: ${project.reference}`);
}
