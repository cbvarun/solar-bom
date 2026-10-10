import { ActionForm, Submit } from "./ActionForm";
import { Field, Hidden, Select } from "./Fields";
import { uploadDocument } from "@/app/admin/actions";

const TYPES = [
  { value: "DATASHEET", label: "Datasheet" }, { value: "CERTIFICATE", label: "Certificate" }, { value: "TEST_REPORT", label: "Test report" },
  { value: "REGULATION", label: "Regulation / standard" }, { value: "APPROVAL", label: "Approval" }, { value: "OTHER", label: "Other" },
];

/** Upload a PDF/PNG/JPEG (checked by content, max 15 MB) or record an official https link. */
export function DocumentUpload({ productId, standardId, projectId, standards }: { productId?: string; standardId?: string; projectId?: string; standards?: { value: string; label: string }[] }) {
  return (
    <details className="card mt-3 p-4">
      <summary className="cursor-pointer text-sm font-medium">Upload a document or add an official link</summary>
      <ActionForm action={uploadDocument} className="mt-3" resetOnSuccess>
        <Hidden name="productId" value={productId} /><Hidden name="projectId" value={projectId} />
        {!standards && <Hidden name="standardId" value={standardId} />}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Title" name="title" required className="lg:col-span-2" />
          <Select label="Type" name="docType" options={TYPES} defaultValue={productId ? "DATASHEET" : "REGULATION"} />
          {standards && <Select label="Related standard / source" name="standardId" options={standards} empty="None" />}
          <Field label="Revision" name="revision" />
          <Field label="Issued" name="issuedAt" type="date" />
          <Field label="Expires" name="expiresAt" type="date" />
          <label className="block lg:col-span-2"><span className="label text-xs">File (PDF, PNG or JPEG, max 15 MB)</span>
            <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" className="mt-1 block w-full text-sm" /></label>
          <Field label="…or official link" name="externalUrl" type="url" placeholder="https://" />
        </div>
        <div className="mt-3"><Submit>Store document</Submit></div>
      </ActionForm>
    </details>
  );
}
