import { prisma } from "@/lib/db";
import { adminCtx, n } from "@/lib/server/admin-page";
import { PageHead, Field, Hidden, Check, Select, ReadOnlyNote } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { saveRule, toggleCompatRule } from "../actions";
import { formatDateTime } from "@/lib/format";
import { LOCKED_COMPAT_RULES, MANUAL_COMPAT_RULES } from "@/lib/engine/rules";

export default async function Rules() {
  const { can } = await adminCtx();
  const [rules, compat] = await Promise.all([
    prisma.engineRule.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] }),
    prisma.compatibilityRule.findMany({ orderBy: { key: "asc" } }),
  ]);
  const edit = can("rules.edit");
  const groups = [...new Set(rules.map((r) => r.group))];
  return (
    <>
      <PageHead title="Engineering rules">BOM formula parameters and compatibility checks used by the calculation engine. Changing a value affects BOMs only when they are recalculated, and every change is logged with its reason.</PageHead>
      {!edit && <ReadOnlyNote what="engineering rules" />}
      {groups.map((g) => (
        <section key={g} className="mb-6">
          <h2 className="section-title capitalize">{g.replace(/_/g, " ")}</h2>
          <div className="mt-3 overflow-x-auto rounded border border-slate-200">
            <table className="table-tech table-compact">
              <thead><tr><th>Rule</th><th>Value</th>{edit && <th>Change</th>}</tr></thead>
              <tbody>
                {rules.filter((r) => r.group === g).map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-md">
                      <p className="font-medium">{r.label} {r.isAssumption && <Badge tone="yellow">assumption</Badge>}</p>
                      <p className="text-xs text-ink-muted">{r.description}</p>
                      <p className="font-mono text-[11px] text-ink-faint">{r.key}{r.updatedBy && ` · ${r.updatedBy}, ${formatDateTime(r.updatedAt)}`}</p>
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{r.valueNumber == null ? <span className="text-ink-muted">not set</span> : `${Number(r.valueNumber)} ${r.unit ?? ""}`}</td>
                    {edit && (
                      <td>
                        <ActionForm action={saveRule} className="grid gap-2 sm:grid-cols-[7rem_1fr] sm:items-end">
                          <Hidden name="id" value={r.id} />
                          <Field label={`Value${r.unit ? ` (${r.unit})` : ""}`} name="valueNumber" type="number" step="any" defaultValue={n(r.valueNumber)} />
                          <Field label="Reason for change" name="reason" required />
                          <Check label="Treat as assumption" name="isAssumption" defaultChecked={r.isAssumption} />
                          <div className="text-right"><Submit variant="secondary">Save</Submit></div>
                        </ActionForm>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <section>
        <h2 className="section-title">Compatibility checks</h2>
        <p className="mt-1 text-xs text-ink-muted">An error marks an inverter as incompatible; a warning is listed for engineering review. A check that is switched off still appears on the BOM as information, so it is never hidden. Voltage and current limits are locked.</p>
        <ul className="mt-3 space-y-2">
          {compat.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-end justify-between gap-3 p-3 text-sm">
              <div className="min-w-0 max-w-xl">
                <p className="font-mono text-xs">{c.key}</p>
                <p>{c.description}</p>
                {LOCKED_COMPAT_RULES.includes(c.key) && <p className="mt-1 text-xs text-ink-muted">Locked: protects equipment limits.</p>}
                {MANUAL_COMPAT_RULES.includes(c.key) && <p className="mt-1 text-xs text-solar-700">Not evaluated by the engine; check manually against both datasheets.</p>}
              </div>
              {edit && !LOCKED_COMPAT_RULES.includes(c.key) && !MANUAL_COMPAT_RULES.includes(c.key) ? (
                <ActionForm action={toggleCompatRule} className="flex items-end gap-2">
                  <Hidden name="id" value={c.id} />
                  <Select label="Enabled" name="enabled" options={[{ value: "true", label: "On" }, { value: "false", label: "Off" }]} defaultValue={String(c.enabled)} />
                  <Select label="Severity" name="severity" options={[{ value: "error", label: "Error" }, { value: "warning", label: "Warning" }]} defaultValue={c.severity} />
                  <Submit variant="secondary">Save</Submit>
                </ActionForm>
              ) : <span><Badge tone={c.enabled ? "green" : "gray"}>{c.enabled ? "on" : "off"}</Badge> <Badge>{c.severity}</Badge></span>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
