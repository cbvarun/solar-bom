import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CableOption, EngineCatalogue, InverterSpec, ModuleSpec, Phase, ProductRef, RoleKey, RoofType, Rules, ServiceRef, StructureSpec, SystemType,
} from "@/lib/engine";
import { defaultRules } from "@/lib/engine";

type Db = PrismaClient | Prisma.TransactionClient;

const productInclude = { specifications: true, manufacturer: true, category: true } as const;
type ProductWithSpecs = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function specMap(p: ProductWithSpecs) {
  const m = new Map<string, { n: number | null; t: string | null }>();
  for (const s of p.specifications) m.set(s.key, { n: s.valueNumber == null ? null : Number(s.valueNumber), t: s.valueText });
  return {
    n: (k: string) => m.get(k)?.n ?? null,
    t: (k: string) => m.get(k)?.t ?? null,
    has: (k: string) => m.has(k),
  };
}

function ref(p: ProductWithSpecs): ProductRef {
  return { id: p.id, sku: p.sku, name: p.name, manufacturer: p.manufacturer.name, model: p.model, unit: p.unit, illustrative: p.illustrative };
}

function req(v: number | null, what: string, p: ProductWithSpecs): number {
  if (v == null) throw new MissingSpecError(`${p.sku}: missing ${what}`);
  return v;
}
export class MissingSpecError extends Error {}

export function toModule(p: ProductWithSpecs): ModuleSpec {
  const s = specMap(p);
  return {
    ...ref(p),
    pmaxW: req(s.n("pmax_w"), "pmax_w", p), vocV: req(s.n("voc_v"), "voc_v", p), iscA: req(s.n("isc_a"), "isc_a", p),
    vmpV: req(s.n("vmp_v"), "vmp_v", p), impA: req(s.n("imp_a"), "imp_a", p), betaVocPctPerC: req(s.n("beta_voc_pct_per_c"), "beta_voc_pct_per_c", p),
    gammaPmaxPctPerC: s.n("gamma_pmax_pct_per_c") ?? undefined, betaVmpPctPerC: s.n("beta_vmp_pct_per_c") ?? undefined,
    lengthMm: req(s.n("length_mm"), "length_mm", p), widthMm: req(s.n("width_mm"), "width_mm", p),
    maxSystemVoltageV: req(s.n("max_system_voltage_v"), "max_system_voltage_v", p), maxSeriesFuseA: s.n("max_series_fuse_a") ?? undefined,
  };
}

export function toInverter(p: ProductWithSpecs): InverterSpec {
  const s = specMap(p);
  const flag = (k: string) => (s.n(k) ?? 0) >= 1;
  return {
    ...ref(p),
    inverterType: (s.t("inverter_type") ?? "GRID_TIED") as SystemType,
    phase: (s.t("phase") ?? "SINGLE") as Phase,
    ratedAcW: req(s.n("rated_ac_w"), "rated_ac_w", p), maxDcPowerW: s.n("max_dc_power_w") ?? undefined,
    maxDcVoltageV: req(s.n("max_dc_voltage_v"), "max_dc_voltage_v", p), mpptMinV: req(s.n("mppt_min_v"), "mppt_min_v", p),
    mpptMaxV: req(s.n("mppt_max_v"), "mppt_max_v", p), startVoltageV: s.n("start_voltage_v") ?? undefined,
    mpptCount: req(s.n("mppt_count"), "mppt_count", p), stringsPerMppt: req(s.n("strings_per_mppt"), "strings_per_mppt", p),
    maxInputCurrentPerMpptA: req(s.n("max_input_current_per_mppt_a"), "max_input_current_per_mppt_a", p),
    maxShortCircuitCurrentPerMpptA: req(s.n("max_isc_per_mppt_a"), "max_isc_per_mppt_a", p),
    acNominalVoltageV: s.n("ac_nominal_voltage_v") ?? 230,
    integrated: { dcSwitch: flag("integrated_dc_switch"), dcSpd: flag("integrated_dc_spd"), acSpd: flag("integrated_ac_spd"), monitoring: flag("integrated_monitoring"), exportLimiting: flag("export_limiting") },
  };
}

export function toStructure(p: ProductWithSpecs): StructureSpec {
  const s = specMap(p);
  return {
    ...ref(p),
    material: s.t("material_class") ?? p.material ?? "Unspecified",
    railStockLengthM: req(s.n("rail_stock_length_m"), "rail_stock_length_m", p), railsPerRow: req(s.n("rails_per_row"), "rails_per_row", p),
    endClampsPerRailEnd: req(s.n("end_clamps_per_rail_end"), "end_clamps_per_rail_end", p),
    midClampsPerJointPerRail: req(s.n("mid_clamps_per_joint_per_rail"), "mid_clamps_per_joint_per_rail", p),
    moduleGapMm: s.n("module_gap_mm") ?? 20, railOverhangMm: s.n("rail_overhang_mm") ?? 50,
    roofTypes: (s.t("roof_types") ?? "").split(",").map((x) => x.trim()).filter(Boolean) as RoofType[],
  };
}

export function toCable(p: ProductWithSpecs): CableOption {
  const s = specMap(p);
  return {
    ...ref(p), kind: (s.t("cable_kind") ?? "DC") as "DC" | "AC", csaMm2: req(s.n("csa_mm2"), "csa_mm2", p),
    ampacityA: req(s.n("ampacity_a"), "ampacity_a", p), resistanceOhmPerKm: req(s.n("resistance_ohm_per_km"), "resistance_ohm_per_km", p),
    cores: s.n("cores") ?? undefined,
  };
}

/** Load active catalogue products into the engine's typed structures. Products with incomplete specs are reported, not guessed. */
export async function loadEngineCatalogue(db: Db): Promise<{ catalogue: EngineCatalogue; skipped: string[] }> {
  const products = await db.product.findMany({ where: { status: "ACTIVE" }, include: productInclude, orderBy: { sku: "asc" } });
  const services = await db.installationService.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const skipped: string[] = [];
  const cat: EngineCatalogue = { modules: [], inverters: [], structures: [], cables: [], roles: {}, services: [] };
  for (const p of products) {
    const s = specMap(p);
    try {
      if (p.category.slug === "pv-modules" && s.has("pmax_w")) cat.modules.push(toModule(p));
      else if (p.category.slug === "inverters" && s.has("rated_ac_w")) cat.inverters.push(toInverter(p));
      else if (p.category.slug === "mounting-structures" && s.has("rail_stock_length_m")) cat.structures.push(toStructure(p));
      else if (s.has("csa_mm2") && s.has("cable_kind")) cat.cables.push(toCable(p));
      const role = s.t("bom_role") as RoleKey | null;
      if (role && !cat.roles[role]) cat.roles[role] = ref(p);
    } catch (e) {
      if (e instanceof MissingSpecError) skipped.push(e.message);
      else throw e;
    }
  }
  cat.services = services.map<ServiceRef>((x) => ({ code: x.code, name: x.name, unit: x.unit, basis: x.basis as ServiceRef["basis"] }));
  return { catalogue: cat, skipped };
}

export async function loadRules(db: Db): Promise<Rules> {
  const rows = await db.engineRule.findMany();
  const rules = defaultRules();
  for (const r of rows) rules[r.key] = r.valueNumber == null ? null : Number(r.valueNumber);
  return rules;
}
