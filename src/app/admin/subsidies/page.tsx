import { prisma } from "@/lib/db";
import { adminCtx, n } from "@/lib/server/admin-page";
import { PageHead, Field, Area, Hidden, Check, Select, ReadOnlyNote } from "@/components/admin/Fields";
import { ActionForm, Submit } from "@/components/admin/ActionForm";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { saveSubsidyScheme } from "../subsidy-actions";
import { SLAB_ROWS } from "@/lib/subsidy";
import { CUSTOMER_TYPE_LABEL, formatDateTime } from "@/lib/format";

type Slab = { upToKw: number; inrPerKw: number };
type Scheme = Awaited<ReturnType<typeof prisma.subsidyScheme.findMany>>[number];

function SchemeForm({ s }: { s?: Scheme }) {
  const slabs = (s?.slabs as Slab[] | undefined) ?? [];
  return (
    <ActionForm action={saveSubsidyScheme} className="grid gap-3 sm:grid-cols-2">
      <Hidden name="id" value={s?.id} />
      <Field label="Code" name="code" required defaultValue={s?.code} hint="e.g. PM_SURYA_GHAR" />
      <Field label="Name" name="name" required defaultValue={s?.name} />
      <fieldset className="sm:col-span-2">
        <legend className="label">Customer types</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {Object.entries(CUSTOMER_TYPE_LABEL).map(([k, label]) => <Check key={k} label={label} name="customerTypes" value={k} defaultChecked={s ? s.customerTypes.includes(k as never) : k === "RESIDENTIAL"} />)}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="label">Assistance by capacity slab</legend>
        <p className="hint">Each row pays the amount per kW for capacity above the previous row&apos;s limit, up to this row&apos;s limit. Copy the figures from the official notification.</p>
        <div className="mt-2 grid gap-2">
          {Array.from({ length: SLAB_ROWS }, (_, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Field label={`Slab ${i + 1}: up to (kW)`} name={`slab${i}_upToKw`} type="number" step="any" defaultValue={slabs[i]?.upToKw ?? null} />
              <Field label="Amount (₹ per kW)" name={`slab${i}_inrPerKw`} type="number" step="any" defaultValue={slabs[i]?.inrPerKw ?? null} />
            </div>
          ))}
        </div>
      </fieldset>
      <Field label="Maximum capacity counted (kW)" name="maxCapacityKw" type="number" step="any" defaultValue={n(s?.maxCapacityKw)} hint="Optional" />
      <Field label="Maximum amount (₹)" name="maxAmountInr" type="number" step="any" defaultValue={n(s?.maxAmountInr)} hint="Optional cap per installation" />
      <Field label="Official source (https link)" name="sourceUrl" defaultValue={s?.sourceUrl} className="sm:col-span-2" />
      <Area label="Notes" name="notes" defaultValue={s?.notes} className="sm:col-span-2" />
      <Select label="Verification" name="verificationStatus" defaultValue={s?.verificationStatus === "VERIFIED" || s?.verificationStatus === "UNDER_ENGINEERING_REVIEW" ? s.verificationStatus : "PENDING_VERIFICATION"}
        options={[{ value: "PENDING_VERIFICATION", label: "Pending verification" }, { value: "UNDER_ENGINEERING_REVIEW", label: "Under review" }, { value: "VERIFIED", label: "Verified against source" }]} />
      <div className="flex items-end"><Check label="Active (offered on projects)" name="active" defaultChecked={s?.active ?? false} /></div>
      <div className="sm:col-span-2 text-right"><Submit>{s ? "Save scheme" : "Add scheme"}</Submit></div>
    </ActionForm>
  );
}

export default async function Subsidies() {
  const { can } = await adminCtx();
  const schemes = await prisma.subsidyScheme.findMany({ orderBy: { name: "asc" } });
  const edit = can("subsidies.edit");
  return (
    <>
      <PageHead title="Subsidies">Government assistance shown as an estimate on projects and proposals. Nothing is pre-filled: enter the current amounts from the official notification, link the source, and activate the scheme. Proposals always state that eligibility and the final amount are decided by the scheme authority.</PageHead>
      {!edit && <ReadOnlyNote what="subsidy schemes" />}
      <ul className="space-y-4">
        {schemes.map((s) => (
          <li key={s.id} className="card min-w-0 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{s.name}</p>
              <Badge tone={s.active ? "green" : "gray"}>{s.active ? "active" : "inactive"}</Badge>
              <VerificationBadge status={s.verificationStatus} />
            </div>
            <p className="mt-1 break-all text-xs text-ink-muted">
              {s.code} · {s.customerTypes.map((t) => CUSTOMER_TYPE_LABEL[t]).join(", ")} · {((s.slabs as Slab[]) ?? []).length ? (s.slabs as Slab[]).map((x) => `up to ${x.upToKw} kW: ₹${x.inrPerKw.toLocaleString("en-IN")}/kW`).join("; ") : "no amounts entered"}
              {s.maxAmountInr != null && ` · cap ₹${Number(s.maxAmountInr).toLocaleString("en-IN")}`}
              {s.verifiedBy && ` · verified by ${s.verifiedBy}, ${formatDateTime(s.verifiedAt)}`}
            </p>
            {s.sourceUrl && <p className="mt-1 text-xs"><a href={s.sourceUrl} target="_blank" rel="noreferrer" className="break-all">{s.sourceUrl}</a></p>}
            {edit && <details className="mt-3"><summary className="cursor-pointer text-sm">Edit</summary><div className="mt-3"><SchemeForm s={s} /></div></details>}
          </li>
        ))}
        {schemes.length === 0 && <li className="text-sm text-ink-muted">No schemes yet.</li>}
      </ul>
      {edit && (
        <section className="card mt-6 p-4">
          <h2 className="section-title">Add a scheme</h2>
          <div className="mt-3"><SchemeForm /></div>
        </section>
      )}
    </>
  );
}
