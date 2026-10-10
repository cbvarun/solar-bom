import { prisma } from "@/lib/db";
import { projectAccess } from "@/lib/auth";
import { buildExportData } from "@/lib/server/exports/data";
import { bomCsv } from "@/lib/server/exports/csv";
import { bomXlsx } from "@/lib/server/exports/xlsx";
import { bomPdf } from "@/lib/server/exports/pdf";
import { notFound } from "@/lib/server/api";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; format: string }> }) {
  const { id, format } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || (await projectAccess(project)) === "none") return notFound();
  const d = await buildExportData(id);
  const base = `${project.reference}-BOM-rev${d.bom.currentRevision}`;
  const headers = (type: string, ext: string) => ({ "content-type": type, "content-disposition": `attachment; filename="${base}.${ext}"`, "cache-control": "no-store" });
  switch (format) {
    case "csv":
      return new Response(bomCsv(d), { headers: headers("text/csv; charset=utf-8", "csv") });
    case "xlsx":
      return new Response(new Uint8Array(await bomXlsx(d)), { headers: headers("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx") });
    case "pdf":
      return new Response(new Uint8Array(await bomPdf(d)), { headers: headers("application/pdf", "pdf") });
    default:
      return notFound();
  }
}
