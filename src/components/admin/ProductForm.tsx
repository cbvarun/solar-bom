import { ActionForm, Submit } from "./ActionForm";
import { Area, Check, Field, Hidden, Select, opts } from "./Fields";
import { saveProduct } from "@/app/admin/actions";
import { AVAILABILITY_LABEL, PROVENANCE_LABEL } from "@/lib/format";

type P = {
  id?: string; sku?: string; name?: string; model?: string; description?: string | null; categoryId?: string; manufacturerId?: string; taxClassId?: string | null; unit?: string;
  availability?: string; leadTimeDays?: number | null; warrantyText?: string | null; warrantyProvenance?: string | null; ipRating?: string | null; material?: string | null;
  dimensionsText?: string | null; weightKg?: number | null; imageUrl?: string | null; provenance?: string; illustrative?: boolean;
};
type O = { value: string; label: string };

export function ProductForm({ p, categories, manufacturers, taxClasses, disabled }: { p?: P; categories: O[]; manufacturers: O[]; taxClasses: O[]; disabled?: boolean }) {
  const body = (
    <>
      <Hidden name="id" value={p?.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="SKU / item code" name="sku" defaultValue={p?.sku} required maxLength={64} />
        <Field label="Name" name="name" defaultValue={p?.name} required className="lg:col-span-2" />
        <Field label="Model" name="model" defaultValue={p?.model} required />
        <Select label="Category" name="categoryId" options={categories} defaultValue={p?.categoryId} required empty="Choose…" />
        <Select label="Manufacturer" name="manufacturerId" options={manufacturers} defaultValue={p?.manufacturerId} required empty="Choose…" />
        <Field label="Unit" name="unit" defaultValue={p?.unit ?? "nos"} required hint="nos, m, set, lot, pair, kWh…" />
        <Select label="GST / tax class" name="taxClassId" options={taxClasses} defaultValue={p?.taxClassId} empty="Not classified" />
        <Select label="Record source" name="provenance" options={opts(PROVENANCE_LABEL)} defaultValue={p?.provenance ?? "ENGINEER_ENTERED"} hint="Applies to the record as a whole; each specification carries its own source." />
        <Select label="Availability" name="availability" options={opts(AVAILABILITY_LABEL)} defaultValue={p?.availability ?? "UNKNOWN"} />
        <Field label="Lead time (days)" name="leadTimeDays" type="number" defaultValue={p?.leadTimeDays} />
        <Field label="IP rating" name="ipRating" defaultValue={p?.ipRating} />
        <Field label="Material" name="material" defaultValue={p?.material} />
        <Field label="Dimensions" name="dimensionsText" defaultValue={p?.dimensionsText} />
        <Field label="Weight (kg)" name="weightKg" type="number" step="any" defaultValue={p?.weightKg} />
        <Field label="Warranty (as stated by source)" name="warrantyText" defaultValue={p?.warrantyText} className="lg:col-span-2" />
        <Select label="Warranty source" name="warrantyProvenance" options={opts(PROVENANCE_LABEL)} defaultValue={p?.warrantyProvenance} empty="—" />
        <Field label="Image URL" name="imageUrl" defaultValue={p?.imageUrl} hint="https:// or a site path; leave blank for the category drawing." className="lg:col-span-2" />
        <div className="flex items-end pb-2"><Check label="Illustrative template (not a real product)" name="illustrative" defaultChecked={p?.illustrative ?? false} /></div>
        <Area label="Description" name="description" defaultValue={p?.description} className="sm:col-span-2 lg:col-span-3" />
      </div>
    </>
  );
  if (disabled) return <fieldset disabled className="opacity-80">{body}</fieldset>;
  return (
    <ActionForm action={saveProduct}>
      {body}
      <div className="mt-3"><Submit>{p?.id ? "Save product" : "Create product"}</Submit></div>
    </ActionForm>
  );
}
