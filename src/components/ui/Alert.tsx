import clsx from "clsx";

const styles = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-solar-300 bg-solar-50 text-solar-700",
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-brand-200 bg-brand-50 text-brand-800",
  note: "border-slate-200 bg-slate-50 text-ink",
} as const;

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof styles; title?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "note"} className={clsx("rounded-md border px-4 py-3 text-sm", styles[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={clsx(title && "mt-1")}>{children}</div>}
    </div>
  );
}

export function PreliminaryNotice({ compact = false }: { compact?: boolean }) {
  return (
    <Alert tone="warning" title={compact ? undefined : "Preliminary estimate"}>
      {compact
        ? "Preliminary estimate — quantities are indicative until verified by an approved engineering design."
        : "Quantities, ratings and costs on this page are preliminary and generated from configurable rules. They are not a substitute for electrical, structural or BESCOM/utility approval. Lines marked Estimated or To be confirmed must be verified by a design engineer before procurement."}
    </Alert>
  );
}
