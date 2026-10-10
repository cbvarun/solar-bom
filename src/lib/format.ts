const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

export function formatINR(v: number | null | undefined): string {
  return v == null ? "—" : inr.format(v);
}
export function formatNum(v: number | null | undefined, unit?: string): string {
  if (v == null || Number.isNaN(v)) return "—";
  return unit ? `${num.format(v)} ${unit}` : num.format(v);
}
export function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const QUANTITY_STATUS_LABEL: Record<string, string> = {
  CALCULATED: "Calculated",
  ESTIMATED: "Estimated",
  ENGINEER_VERIFIED: "Engineer-verified",
  TO_BE_CONFIRMED: "To be confirmed",
};
export const VERIFICATION_LABEL: Record<string, string> = {
  PENDING_VERIFICATION: "Pending verification",
  UNDER_ENGINEERING_REVIEW: "Under engineering review",
  VERIFIED: "Verified",
  NOT_APPLICABLE: "Not applicable",
  REQUIRES_CORRECTIVE_ACTION: "Requires corrective action",
};
export const PROVENANCE_LABEL: Record<string, string> = {
  MANUFACTURER_VERIFIED: "Manufacturer-verified",
  SUPPLIER_QUOTED: "Supplier-quoted",
  ENGINEER_ENTERED: "Engineer-entered",
  USER_ESTIMATE: "User estimate",
  ILLUSTRATIVE: "Illustrative (not verified)",
};
export const AVAILABILITY_LABEL: Record<string, string> = {
  IN_STOCK: "In stock",
  LEAD_TIME: "Lead time",
  ON_REQUEST: "On request",
  DISCONTINUED: "Discontinued",
  UNKNOWN: "Not confirmed",
};
export const CUSTOMER_TYPE_LABEL: Record<string, string> = { RESIDENTIAL: "Residential", APARTMENT: "Apartment", COMMERCIAL: "Commercial", INDUSTRIAL: "Industrial" };
export const ROOF_LABEL: Record<string, string> = { RCC_FLAT: "RCC flat roof", METAL_SHEET: "Metal-sheet roof", SLOPED: "Sloped roof" };
export const SYSTEM_LABEL: Record<string, string> = { GRID_TIED: "Grid-tied without battery", HYBRID: "Hybrid with battery backup", OFF_GRID: "Off-grid" };
export const PHASE_LABEL: Record<string, string> = { SINGLE: "Single-phase", THREE: "Three-phase" };
export const EXPORT_LABEL: Record<string, string> = { NET_METERING: "Net metering", OTHER_APPROVED: "Other approved export arrangement", EXPORT_LIMITED: "Export-limited" };
export const MONITORING_LABEL: Record<string, string> = { NONE: "No monitoring", BASIC_APP: "Basic app monitoring", ADVANCED: "Advanced / multi-inverter monitoring" };
export const TBC = "To be confirmed during site survey";
