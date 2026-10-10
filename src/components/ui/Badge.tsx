import clsx from "clsx";
import { AVAILABILITY_LABEL, PROVENANCE_LABEL, QUANTITY_STATUS_LABEL, VERIFICATION_LABEL } from "@/lib/format";

const tones = {
  green: "bg-brand-50 text-brand-800 ring-brand-200",
  yellow: "bg-solar-50 text-solar-700 ring-solar-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  purple: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, title, className }: { tone?: Tone; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={clsx("inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const QS_TONE: Record<string, Tone> = { CALCULATED: "blue", ESTIMATED: "yellow", ENGINEER_VERIFIED: "green", TO_BE_CONFIRMED: "red" };
export function QuantityStatusBadge({ status }: { status: string }) {
  const help: Record<string, string> = {
    CALCULATED: "Calculated by the rules engine from confirmed or measured inputs",
    ESTIMATED: "Based on provisional inputs or configured assumptions — confirm at site survey/design",
    ENGINEER_VERIFIED: "Quantity verified by a design engineer",
    TO_BE_CONFIRMED: "Cannot be calculated yet — needs design or site data",
  };
  return <Badge tone={QS_TONE[status] ?? "gray"} title={help[status]}>{QUANTITY_STATUS_LABEL[status] ?? status}</Badge>;
}

const VS_TONE: Record<string, Tone> = { PENDING_VERIFICATION: "gray", UNDER_ENGINEERING_REVIEW: "blue", VERIFIED: "green", NOT_APPLICABLE: "purple", REQUIRES_CORRECTIVE_ACTION: "red" };
export function VerificationBadge({ status }: { status: string }) {
  return <Badge tone={VS_TONE[status] ?? "gray"}>{VERIFICATION_LABEL[status] ?? status}</Badge>;
}

const PV_TONE: Record<string, Tone> = { MANUFACTURER_VERIFIED: "green", SUPPLIER_QUOTED: "blue", ENGINEER_ENTERED: "blue", USER_ESTIMATE: "yellow", ILLUSTRATIVE: "gray" };
export function ProvenanceBadge({ provenance }: { provenance: string }) {
  return <Badge tone={PV_TONE[provenance] ?? "gray"}>{PROVENANCE_LABEL[provenance] ?? provenance}</Badge>;
}

const AV_TONE: Record<string, Tone> = { IN_STOCK: "green", LEAD_TIME: "yellow", ON_REQUEST: "blue", DISCONTINUED: "red", UNKNOWN: "gray" };
export function AvailabilityBadge({ status, leadTimeDays }: { status: string; leadTimeDays?: number | null }) {
  return <Badge tone={AV_TONE[status] ?? "gray"}>{AVAILABILITY_LABEL[status] ?? status}{status === "LEAD_TIME" && leadTimeDays ? ` · ${leadTimeDays} d` : ""}</Badge>;
}
