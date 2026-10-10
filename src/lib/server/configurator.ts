import "server-only";
import { prisma } from "@/lib/db";
import { loadEngineCatalogue, loadRules } from "./engine-data";
import type { ConfiguratorOptions, EngValues, FormValues, MetaValues } from "@/components/configurator/ConfigureForm";
import type { ProjectWithInputs } from "./projects";

export async function configuratorOptions(): Promise<ConfiguratorOptions> {
  const { catalogue } = await loadEngineCatalogue(prisma);
  const rules = await loadRules(prisma);
  const mfrs = await prisma.manufacturer.findMany({ where: { archived: false }, select: { id: true, name: true } });
  const byName = (n: string) => mfrs.find((m) => m.name === n)!;
  const uniq = <T,>(a: T[]) => [...new Set(a)];
  return {
    moduleManufacturers: uniq(catalogue.modules.map((m) => m.manufacturer)).map(byName),
    inverterManufacturers: uniq(catalogue.inverters.map((m) => m.manufacturer)).map(byName),
    moduleWattages: uniq(catalogue.modules.map((m) => m.pmaxW)).sort((a, b) => a - b),
    modules: catalogue.modules.map((m) => ({ id: m.id, label: `${m.model} — ${m.pmaxW} Wp` })),
    inverters: catalogue.inverters.map((i) => ({ id: i.id, label: `${i.model} — ${i.ratedAcW / 1000} kW ${i.phase === "SINGLE" ? "1-ph" : "3-ph"} ${i.inverterType === "HYBRID" ? "hybrid" : ""}`.trim() })),
    structures: catalogue.structures.map((s) => ({ id: s.id, label: `${s.model} — ${s.material}` })),
    catalogue,
    rules,
  };
}

export function formInitial(p: ProjectWithInputs): { values: FormValues; eng: EngValues; meta: MetaValues; yieldSource: string } {
  const d = p.designInputs;
  const s = (x: unknown) => (x == null ? "" : String(x));
  const eng = (d?.engineering ?? {}) as Record<string, unknown>;
  const meta = (d?.inputMeta ?? {}) as Record<string, { provenance: string }>;
  return {
    values: {
      name: p.name, location: s(p.location), customerType: s(p.customerType), customerName: s(p.customerName), customerEmail: s(p.customerEmail), customerPhone: s(p.customerPhone),
      targetCapacityKwp: s(d?.targetCapacityKwp), roofType: s(d?.roofType), roofAreaM2: s(d?.roofAreaM2), isExpansion: s(d?.isExpansion),
      systemType: s(d?.systemType), supplyPhase: s(d?.supplyPhase), sanctionedLoad: s(d?.sanctionedLoad), sanctionedLoadUnit: s(d?.sanctionedLoadUnit),
      exportArrangement: s(d?.exportArrangement), preferredModuleWp: s(d?.preferredModuleWp), preferredModuleMfrId: s(d?.preferredModuleMfrId),
      preferredInverterMfrId: s(d?.preferredInverterMfrId), mountingMaterial: s(d?.mountingMaterial), preferredConfiguration: s(d?.preferredConfiguration),
      budgetRange: s(d?.budgetRange), monitoring: s(d?.monitoring), selectedModuleId: s(d?.selectedModuleId), selectedInverterId: s(d?.selectedInverterId),
      selectedStructureId: s(d?.selectedStructureId),
    },
    eng: Object.fromEntries(Object.entries(eng).filter(([k]) => k !== "specificYieldSource").map(([k, v]) => [k, s(v)])),
    meta: Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v.provenance])),
    yieldSource: s(eng.specificYieldSource),
  };
}
