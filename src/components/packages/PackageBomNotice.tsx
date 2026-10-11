import { Alert } from "@/components/ui/Alert";

/** Shown on projects whose BOM was started from a standard package. */
export function PackageBomNotice({ pkg }: { pkg: { name: string; capacityKwp: unknown; moduleCount: number | null; moduleWp: number | null; notes: string | null } }) {
  return (
    <Alert tone="info" title={`BOM started from standard package ${pkg.name}`}>
      {Number(pkg.capacityKwp)} kWp{pkg.moduleCount && pkg.moduleWp ? ` (${pkg.moduleCount} × ${pkg.moduleWp} Wp)` : ""}. Lines are copied from the package and marked estimated.
      The calculation engine does not recalculate this BOM, so string design, cable sizing and compatibility checks have not been run: engineering must verify them.
      {pkg.notes && <span className="mt-1 block">{pkg.notes}</span>}
    </Alert>
  );
}
