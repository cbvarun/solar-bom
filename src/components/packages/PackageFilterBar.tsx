"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CUSTOMER_TYPE_LABEL, PHASE_LABEL, ROOF_LABEL, SYSTEM_LABEL } from "@/lib/format";
import { CUSTOMER_TYPES, PACKAGE_SORTS, ROOF_TYPES, SUPPLY_PHASES, SYSTEM_TYPES, type PackageFilters } from "@/lib/package-filter";

/**
 * Filter and sort controls for the public packages page. Changes apply straight away by
 * updating the query string; without JavaScript the form still submits as a GET.
 */
export function PackageFilterBar({ value }: { value: PackageFilters }) {
  const router = useRouter();
  const path = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [kwp, setKwp] = useState(value.kwp?.toString() ?? "");
  useEffect(() => setKwp(value.kwp?.toString() ?? ""), [value.kwp]);

  function apply() {
    if (!form.current) return;
    const qs = new URLSearchParams();
    for (const [k, v] of new FormData(form.current).entries()) {
      const s = String(v).trim();
      // Residential is the default customer type, so it stays out of the URL.
      if (s && !(k === "customer" && s === "RESIDENTIAL") && !(k === "sort" && s === "recommended")) qs.set(k, s);
    }
    const q = qs.toString();
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  }
  const soon = () => { clearTimeout(timer.current); timer.current = setTimeout(apply, 450); };

  const select = (name: keyof PackageFilters, label: string, current: string, options: [string, string][], anyLabel?: string) => (
    <label className="block min-w-0">
      <span className="label text-xs">{label}</span>
      <select name={name} defaultValue={current} key={`${name}-${current}`} onChange={apply} className="input mt-1 py-1.5">
        {anyLabel && <option value={name === "customer" ? "any" : ""}>{anyLabel}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <form ref={form} action={path} method="get" role="search" aria-label="Filter packages"
      onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); apply(); }}
      className="card grid min-w-0 grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
      {select("customer", "Customer type", value.customer ?? "any", CUSTOMER_TYPES.map((c) => [c, CUSTOMER_TYPE_LABEL[c]]), "Any customer")}
      <label className="block min-w-0">
        <span className="label text-xs">Target capacity</span>
        <span className="relative mt-1 block">
          <input name="kwp" type="number" inputMode="decimal" min="0.5" step="any" placeholder="e.g. 5" value={kwp}
            onChange={(e) => { setKwp(e.target.value); soon(); }} className="input py-1.5 pr-12" />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-muted">kWp</span>
        </span>
      </label>
      {select("roof", "Roof type", value.roof ?? "", ROOF_TYPES.map((r) => [r, ROOF_LABEL[r]]), "Any roof")}
      {select("config", "Electrical configuration", value.config ?? "", SYSTEM_TYPES.map((s) => [s, SYSTEM_LABEL[s]]), "Any configuration")}
      {select("supply", "Supply", value.supply ?? "", SUPPLY_PHASES.map((s) => [s, PHASE_LABEL[s]]), "Any supply")}
      {select("sort", "Sort by", value.sort, Object.entries(PACKAGE_SORTS).map(([k, l]) => [k, k === "recommended" && value.kwp ? "Closest to target" : l]))}
      <noscript><button className="btn-primary btn-sm col-span-full justify-self-start">Apply filters</button></noscript>
    </form>
  );
}
