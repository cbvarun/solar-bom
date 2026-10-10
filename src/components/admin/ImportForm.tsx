"use client";
import { startTransition, useActionState } from "react";
import { runImport } from "@/app/admin/actions";

export function ImportForm() {
  const [state, action, pending] = useActionState(runImport, null);
  const errors = Object.entries(state?.errors ?? {});
  return (
    <form className="card p-4" aria-busy={pending} onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
      startTransition(() => action(fd));
    }}>
      <label className="block"><span className="label">CSV or XLSX file (max 5 MB, 2,000 rows)</span>
        <input type="file" name="file" required accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-1 block w-full text-sm" /></label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" name="commit" value="false" className="btn-secondary btn-sm" disabled={pending}>Validate (preview)</button>
        <button type="submit" name="commit" value="true" className="btn-primary btn-sm" disabled={pending}>Import</button>
      </div>
      {pending && <p className="mt-2 text-xs text-ink-muted">Checking file…</p>}
      {state?.message && <p role="status" className={`mt-3 text-sm ${state.ok ? "text-brand-800" : "text-red-700"}`}>{state.message}</p>}
      {errors.length > 0 && (
        <div className="mt-2 max-h-80 overflow-auto rounded border border-red-200">
          <table className="table-tech table-compact"><thead><tr><th>Row</th><th>Problem</th></tr></thead>
            <tbody>{errors.map(([k, v], i) => <tr key={i}><td className="whitespace-nowrap text-xs">{k}</td><td className="text-xs">{v}</td></tr>)}</tbody></table>
        </div>
      )}
    </form>
  );
}
