import clsx from "clsx";

type Opt = { value: string; label: string };

/** Small, server-renderable form fields for admin forms. */
export function Field({ label, name, defaultValue, type = "text", required, hint, className, placeholder, step, maxLength }: {
  label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; hint?: string; className?: string; placeholder?: string; step?: string; maxLength?: number;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="label text-xs">{label}{required && <span aria-hidden className="text-red-700"> *</span>}</span>
      <input className="input mt-1 py-1.5" name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} step={step} maxLength={maxLength} />
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Area({ label, name, defaultValue, rows = 3, hint, className, required }: { label: string; name: string; defaultValue?: string | null; rows?: number; hint?: string; className?: string; required?: boolean }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label text-xs">{label}{required && <span aria-hidden className="text-red-700"> *</span>}</span>
      <textarea className="input mt-1 py-1.5" name={name} rows={rows} defaultValue={defaultValue ?? ""} required={required} />
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Select({ label, name, options, defaultValue, required, hint, className, empty }: {
  label: string; name: string; options: Opt[]; defaultValue?: string | null; required?: boolean; hint?: string; className?: string; empty?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="label text-xs">{label}{required && <span aria-hidden className="text-red-700"> *</span>}</span>
      <select className="input mt-1 py-1.5" name={name} defaultValue={defaultValue ?? ""} required={required}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Check({ label, name, defaultChecked, value }: { label: string; name: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300" />
      {label}
    </label>
  );
}

export function Hidden({ name, value }: { name: string; value: string | null | undefined }) {
  return <input type="hidden" name={name} value={value ?? ""} />;
}

export function PageHead({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-3xl">
        <h1 className="text-2xl">{title}</h1>
        {children && <div className="mt-1 text-sm text-ink-muted">{children}</div>}
      </div>
      {actions}
    </header>
  );
}

export function ReadOnlyNote({ what }: { what: string }) {
  return <p className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-ink-muted">Your role can view {what} but not change it.</p>;
}

export const opts = (labels: Record<string, string>): Opt[] => Object.entries(labels).map(([value, label]) => ({ value, label }));
