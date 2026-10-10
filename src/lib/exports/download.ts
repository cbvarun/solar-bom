import { exportBaseName, type ExportPayload, type QuotationSnapshot } from "./payload";

export type ExportFormat = "pdf" | "xlsx" | "csv";

const MIME: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8",
};

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 404 ? "Not found, or you don't have access." : `The server returned ${res.status}.`);
  return res.json() as Promise<T>;
}

async function build(fmt: ExportFormat, payload: ExportPayload, quote?: { quotationNumber: string; validUntil: string }): Promise<Blob> {
  // Generators load on demand so pages don't carry pdfkit or ExcelJS.
  if (fmt === "pdf") return (await import("./pdf")).bomPdf(payload, quote);
  if (fmt === "xlsx") return new Blob([(await (await import("./xlsx")).bomXlsx(payload)) as BlobPart], { type: MIME.xlsx });
  return new Blob([(await import("./csv")).bomCsv(payload)], { type: MIME.csv });
}

export async function downloadBomExport(projectId: string, fmt: ExportFormat) {
  const payload = await getJson<ExportPayload>(`/api/projects/${projectId}/export-data`);
  save(await build(fmt, payload), `${exportBaseName(payload)}.${fmt}`);
}

export async function downloadQuotationPdf(quotationId: string) {
  const s = await getJson<QuotationSnapshot>(`/api/quotations/${quotationId}/snapshot`);
  save(await build("pdf", s.payload, { quotationNumber: s.quotationNumber, validUntil: s.validUntil }), `${s.quotationNumber}.pdf`);
}
