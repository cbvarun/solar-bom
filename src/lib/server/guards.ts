import type { ProjectForm } from "@/lib/validation";

/** Only design engineers (or admins) may mark inputs as engineer-verified. */
export function sanitizeProvenance(f: ProjectForm, canVerify: boolean): ProjectForm {
  if (canVerify || !f.inputMeta) return f;
  const inputMeta = Object.fromEntries(
    Object.entries(f.inputMeta).map(([k, v]) => [k, v.provenance === "ENGINEER_VERIFIED" ? { ...v, provenance: "MEASURED" as const } : v]),
  );
  return { ...f, inputMeta };
}
